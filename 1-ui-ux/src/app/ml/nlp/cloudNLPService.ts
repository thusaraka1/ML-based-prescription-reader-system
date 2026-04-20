/**
 * Google Cloud Healthcare NLP API Service
 * Sends OCR-extracted text to Google Cloud for entity extraction,
 * returning structured medication entities with UMLS codes.
 */

export interface MedicationEntity {
  drugName: string;
  dosage: string;
  frequency: string;
  route: string;
  confidence: number;
  umlsCode?: string;
  drugClass?: string;
}

export interface CloudNLPResult {
  entities: MedicationEntity[];
  rawResponse: unknown;
  processingTimeMs: number;
}

const HEALTHCARE_NLP_ENDPOINT = 'https://healthcare.googleapis.com/v1';
const CLOUD_NLP_AUTH_COOLDOWN_MS = Number(import.meta.env.VITE_CLOUD_NLP_AUTH_COOLDOWN_MS || 1800000);
let cloudNlpDisabledUntil = 0;

/**
 * Call the Google Cloud Healthcare NLP API to extract medical entities
 * from prescription text.
 */
export async function analyzeWithCloudNLP(
  text: string,
  projectId?: string,
  apiKey?: string
): Promise<CloudNLPResult> {
  const startTime = performance.now();

  if (!isCloudNLPEnabled()) {
    return { entities: [], rawResponse: null, processingTimeMs: 0 };
  }

  if (Date.now() < cloudNlpDisabledUntil) {
    return { entities: [], rawResponse: { skipped: 'cloud-nlp-cooldown' }, processingTimeMs: 0 };
  }

  const _projectId = projectId || import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID;
  const _apiKey = apiKey || import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

  if (!_projectId || !_apiKey) {
    console.warn('[CloudNLP] Missing API credentials, skipping cloud analysis');
    return { entities: [], rawResponse: null, processingTimeMs: 0 };
  }

  try {
    const url = `${HEALTHCARE_NLP_ENDPOINT}/projects/${_projectId}/locations/us-central1/services/nlp:analyzeEntities?key=${_apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nlpService: `projects/${_projectId}/locations/us-central1/services/nlp`,
        documentContent: text,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        cloudNlpDisabledUntil = Date.now() + CLOUD_NLP_AUTH_COOLDOWN_MS;
        console.warn('[CloudNLP] Unauthorized response. Temporarily disabling Cloud NLP to avoid repeated failing requests.');
      }
      throw new Error(`Healthcare NLP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const processingTimeMs = performance.now() - startTime;

    // Parse the response entities
    const entities: MedicationEntity[] = [];

    if (data.entityMentions) {
      for (const mention of data.entityMentions) {
        if (mention.type === 'MEDICINE' || mention.type === 'MED_DRUG') {
          entities.push({
            drugName: mention.text?.content || '',
            dosage: extractLinkedAttribute(data, mention, 'DOSAGE'),
            frequency: extractLinkedAttribute(data, mention, 'FREQUENCY'),
            route: extractLinkedAttribute(data, mention, 'ROUTE'),
            confidence: mention.confidence || 0,
            umlsCode: mention.linkedEntities?.[0]?.entityId,
            drugClass: mention.linkedEntities?.[0]?.additionalInfo?.preferredTerm,
          });
        }
      }
    }

    console.log(`[CloudNLP] Extracted ${entities.length} medication entities in ${processingTimeMs.toFixed(0)}ms`);

    return { entities, rawResponse: data, processingTimeMs };
  } catch (error) {
    console.error('[CloudNLP] API call failed:', error);
    return {
      entities: [],
      rawResponse: { error: String(error) },
      processingTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Helper to extract linked attributes (dosage, frequency, route) from
 * the Healthcare NLP API response.
 */
function extractLinkedAttribute(
  fullResponse: Record<string, unknown>,
  drugMention: Record<string, unknown>,
  attributeType: string
): string {
  try {
    const relationships = (fullResponse as Record<string, unknown[]>).relationships || [];
    for (const rel of relationships) {
      const r = rel as Record<string, unknown>;
      if (r.subjectId === (drugMention as Record<string, unknown>).mentionId) {
        const obj = r.objectId as string;
        const allMentions = (fullResponse as Record<string, unknown[]>).entityMentions || [];
        for (const m of allMentions) {
          const mention = m as Record<string, unknown>;
          if (mention.mentionId === obj && mention.type === attributeType) {
            return ((mention.text as Record<string, string>)?.content) || '';
          }
        }
      }
    }
  } catch {
    // Attribute not found
  }
  return '';
}

/**
 * Check if cloud NLP is enabled via environment variables.
 */
export function isCloudNLPEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_CLOUD_NLP === 'true' &&
         !!import.meta.env.VITE_GOOGLE_CLOUD_API_KEY &&
         !!import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID &&
         Date.now() >= cloudNlpDisabledUntil;
}
