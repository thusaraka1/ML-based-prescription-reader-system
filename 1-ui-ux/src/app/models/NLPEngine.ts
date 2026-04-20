import { Medication } from './Medication';
import { parseMedications, ParsedMedication } from '../ml/nlp/MedicationParser';
import { analyzeWithCloudNLP, isCloudNLPEnabled, MedicationEntity } from '../ml/nlp/cloudNLPService';
import { verifyPrescriptionWithGemini, isGeminiEnabled } from '../ml/nlp/geminiService';
import { runEnsemble, EnsembleResult, EnsembleMedication, ModelSource } from '../ml/ensemble/EnsembleOrchestrator';
import { checkDonutHealth, isDonutEnabledSync } from '../ml/nlp/donutService';

export interface NLPResult {
  medications: Medication[];
  confidence: number;
  source: 'local' | 'cloud' | 'gemini' | 'combined' | 'ensemble';
  details: ParsedMedication[];
  geminiVerified: boolean;
  corrections: string[];
  processingTimeMs: number;
  /** Raw extracted text from AI models (Gemini rawText or Donut raw_text) */
  rawText?: string;
  /** Ensemble-specific data (present when ensemble mode is active) */
  ensemble?: {
    sourcesUsed: ModelSource[];
    modelAgreementRate: number;
    medicationSources: { drugName: string; sources: ModelSource[]; confidence: number }[];
    timings: EnsembleResult['timings'];
    donutAvailable: boolean;
  };
}

export class NLPEngine {
  modelVersion: string;
  private confidenceThreshold: number;

  constructor(modelVersion: string, confidenceThreshold: number = 0.5) {
    this.modelVersion = modelVersion;
    this.confidenceThreshold = confidenceThreshold;
  }

  /**
   * Full NLP parsing pipeline with ensemble support:
   * 
   * ┌─ Ensemble Mode (when Donut backend is available) ─┐
   * │  Runs ALL models in parallel:                       │
   * │  1. Donut custom model (image → medications)        │
   * │  2. Local regex + RxNorm (text → medications)       │
   * │  3. Gemini AI verification (text/image → meds)      │
   * │  Results merged via weighted confidence voting       │
   * └───────────────────────────────────────────────────────┘
   * 
   * ┌─ Fallback Mode (no Donut backend) ────────────────┐
   * │  Sequential pipeline (existing behavior):          │
   * │  1. Local regex + RxNorm (fast, offline)            │
   * │  2. Cloud Healthcare NLP (if confidence < threshold)│
   * │  3. Gemini verification (optional)                  │
   * └───────────────────────────────────────────────────────┘
   */
  async parseTextToMedication(
    extractedText: string,
    imageBase64?: string,
    imageSource?: File | string,
    donutPromise?: Promise<any>
  ): Promise<NLPResult> {
    const startTime = performance.now();
    console.log(`NLP Engine v${this.modelVersion} parsing text...`);

    // Check if Donut backend is available for ensemble mode
    const donutHealth = await checkDonutHealth();
    const useEnsemble = donutHealth.status === 'ok' && (imageSource || donutPromise);

    if (useEnsemble) {
      return this.runEnsemblePipeline(extractedText, imageSource || '', imageBase64, startTime, donutPromise);
    }

    // Fallback: existing sequential pipeline
    return this.runSequentialPipeline(extractedText, imageBase64, startTime);
  }

  /**
   * Ensemble pipeline: Donut + Regex + Gemini in parallel.
   */
  private async runEnsemblePipeline(
    extractedText: string,
    imageSource: File | string,
    imageBase64: string | undefined,
    startTime: number,
    donutPromise?: Promise<any>
  ): Promise<NLPResult> {
    console.log('[NLP] 🚀 Running ENSEMBLE mode (Donut + Regex + Gemini)');

    const ensembleResult = await runEnsemble(extractedText, imageSource, imageBase64, donutPromise);

    const processingTimeMs = performance.now() - startTime;

    // Extract raw text from whichever AI model provided it
    const rawText = ensembleResult.rawOutputs.gemini?.rawText
      || ensembleResult.rawOutputs.donut?.raw_text
      || '';

    return {
      medications: ensembleResult.medications.map(m => m.medication),
      confidence: ensembleResult.overallConfidence,
      source: 'ensemble',
      details: ensembleResult.rawOutputs.regex || [],
      geminiVerified: ensembleResult.sourcesUsed.includes('gemini'),
      corrections: ensembleResult.corrections,
      processingTimeMs,
      rawText,
      ensemble: {
        sourcesUsed: ensembleResult.sourcesUsed,
        modelAgreementRate: ensembleResult.modelAgreementRate,
        medicationSources: ensembleResult.medications.map(m => ({
          drugName: m.medication.drugName,
          sources: m.sources,
          confidence: m.confidence,
        })),
        timings: ensembleResult.timings,
        donutAvailable: true,
      },
    };
  }

  /**
   * Sequential fallback pipeline (existing behavior).
   */
  private async runSequentialPipeline(
    extractedText: string,
    imageBase64: string | undefined,
    startTime: number
  ): Promise<NLPResult> {
    console.log('[NLP] Running sequential mode (Regex → Cloud NLP → Gemini)');

    // Step 1: Local regex + RxNorm parsing
    const localResults = parseMedications(extractedText);
    const avgLocalConfidence = localResults.length > 0
      ? localResults.reduce((s, r) => s + r.confidence, 0) / localResults.length
      : 0;

    console.log(`[NLP] Local parsing: ${localResults.length} medications, ${(avgLocalConfidence * 100).toFixed(0)}% avg confidence`);

    let finalMedications = localResults.map(r => r.medication);
    let finalConfidence = avgLocalConfidence;
    let source: NLPResult['source'] = 'local';
    let geminiVerified = false;
    let corrections: string[] = [];

    // Step 2: Cloud Healthcare NLP API (if enabled and local confidence is low)
    if (avgLocalConfidence < this.confidenceThreshold && isCloudNLPEnabled()) {
      console.log('[NLP] Local confidence below threshold, calling Cloud Healthcare NLP...');
      const cloudResult = await analyzeWithCloudNLP(extractedText);

      if (cloudResult.entities.length > 0) {
        const cloudMeds = cloudResult.entities.map((e: MedicationEntity) =>
          new Medication(e.drugName, e.dosage, e.frequency)
        );
        finalMedications = mergeMedications(finalMedications, cloudMeds);
        finalConfidence = Math.max(avgLocalConfidence, 
          cloudResult.entities.reduce((s, e) => s + e.confidence, 0) / cloudResult.entities.length
        );
        source = 'cloud';
      }
    }

    // Step 3: Gemini verification (if enabled)
    if (isGeminiEnabled()) {
      console.log('[NLP] Running Gemini verification...');
      // When OCR text is empty/minimal, tell Gemini to extract directly from image
      const textForGemini = extractedText.trim().length > 5
        ? extractedText
        : 'No reliable OCR text available. Please extract all medication information directly from the prescription image.';
      
      try {
        const geminiResult = await verifyPrescriptionWithGemini(textForGemini, imageBase64);

        if (geminiResult.medications.length > 0) {
          const geminiMeds = geminiResult.medications.map(m =>
            new Medication(m.drugName, m.dosage, m.frequency)
          );
          finalMedications = mergeMedications(finalMedications, geminiMeds);
          finalConfidence = Math.max(finalConfidence, geminiResult.overallConfidence);
          corrections = geminiResult.corrections;
          geminiVerified = true;
          source = localResults.length > 0 || isCloudNLPEnabled() ? 'combined' : 'gemini';
        }
      } catch (geminiError) {
        console.warn('[NLP] Gemini verification failed (non-fatal):', geminiError);
        // Don't throw — return whatever we have from local parsing
      }
    }

    // Fallback: if nothing was parsed at all, return empty
    if (finalMedications.length === 0) {
      console.warn('[NLP] No medications extracted from text');
    }

    const processingTimeMs = performance.now() - startTime;

    return {
      medications: finalMedications,
      confidence: finalConfidence,
      source,
      details: localResults,
      geminiVerified,
      corrections,
      processingTimeMs,
      ensemble: {
        sourcesUsed: [source === 'local' ? 'regex' : source === 'gemini' ? 'gemini' : 'regex'],
        modelAgreementRate: 0,
        medicationSources: finalMedications.map(m => ({
          drugName: m.drugName,
          sources: [source === 'local' ? 'regex' as ModelSource : source === 'gemini' ? 'gemini' as ModelSource : 'regex' as ModelSource],
          confidence: finalConfidence,
        })),
        timings: { totalMs: processingTimeMs },
        donutAvailable: false,
      },
    };
  }

  /**
   * Synchronous legacy method for backward compatibility.
   */
  parseTextToMedicationSync(extractedText: string): Medication[] {
    const results = parseMedications(extractedText);
    if (results.length > 0) {
      return results.map(r => r.medication);
    }
    // Fallback to basic parsing if no regex matches
    return this.basicParse(extractedText);
  }

  /**
   * Very basic line-by-line parsing as a last resort.
   */
  private basicParse(text: string): Medication[] {
    const medications: Medication[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const pattern = /(\w+)\s+(\d+mg)\s+(.*)/i;
      const match = line.match(pattern);
      if (match) {
        const [, drugName, dosage, frequency] = match;
        medications.push(new Medication(drugName, dosage, frequency));
      }
    }

    return medications;
  }
}

/**
 * Merge medication lists, preferring entries with more complete data.
 * Deduplicates by drug name (case-insensitive).
 */
function mergeMedications(primary: Medication[], secondary: Medication[]): Medication[] {
  const merged = new Map<string, Medication>();

  // Add primary first
  for (const med of primary) {
    merged.set(med.drugName.toLowerCase(), med);
  }

  // Add secondary, overwriting if they have more complete data
  for (const med of secondary) {
    const key = med.drugName.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, med);
    } else if (
      med.dosage.length > existing.dosage.length ||
      med.frequency.length > existing.frequency.length
    ) {
      merged.set(key, med);
    }
  }

  return Array.from(merged.values());
}
