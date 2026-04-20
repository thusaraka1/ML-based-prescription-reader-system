/**
 * Gemini API Service
 * Uses Google's Gemini model for:
 * 1. Prescription OCR verification & correction
 * 2. Medication extraction from ambiguous text
 * 3. Meal plan generation (see meal-plan module)
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

const DEFAULT_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

function parseGeminiModels(): string[] {
  const configured = import.meta.env.VITE_GEMINI_MODELS as string | undefined;
  if (!configured) return DEFAULT_GEMINI_MODELS;

  const parsed = configured
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_GEMINI_MODELS;
}

// Models to try, in order of preference. Override with VITE_GEMINI_MODELS="modelA,modelB".
const GEMINI_MODELS = parseGeminiModels();
const PERMANENTLY_UNAVAILABLE_MODELS = new Set<string>();

const OVERLOAD_RETRY_BASE_MS = 5000;
const OVERLOAD_RETRY_MAX_MS = 15000;
const GEMINI_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_REQUEST_TIMEOUT_MS || 60000);
const GEMINI_VERIFY_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_VERIFY_TIMEOUT_MS || 60000);
const GEMINI_VISION_TIMEOUT_MS = Number(import.meta.env.VITE_GEMINI_VISION_TIMEOUT_MS || 90000);
const GEMINI_VERIFY_MAX_RETRIES = Number(import.meta.env.VITE_GEMINI_VERIFY_MAX_RETRIES || 2);
const GEMINI_VISION_MAX_RETRIES = Number(import.meta.env.VITE_GEMINI_VISION_MAX_RETRIES || 2);

async function withGeminiRequestTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    task.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isRetryableGeminiError(errMsg: string): boolean {
  return (
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errMsg.includes('503') ||
    errMsg.includes('500') ||
    errMsg.includes('overloaded') ||
    errMsg.includes('high demand') ||
    errMsg.includes('temporarily unavailable') ||
    errMsg.includes('timeout')
  );
}

function computeBackoffDelay(attempt: number): number {
  const exponential = Math.min(OVERLOAD_RETRY_MAX_MS, OVERLOAD_RETRY_BASE_MS * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 500);
  return exponential + jitter;
}

/**
 * Initialize the Gemini API client. Must be called before any API calls.
 */
function getModel(modelOverride?: string): GenerativeModel {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured in environment');
  }

  if (modelOverride) {
    if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: modelOverride });
  }

  if (model) return model;

  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: GEMINI_MODELS[0] });
  return model;
}

/**
 * Retry a Gemini API call with model fallback on 429 errors.
 */
export async function callWithRetry<T>(
  fn: (m: GenerativeModel) => Promise<T>,
  options?: {
    maxRetries?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 1;
  const timeoutMs = options?.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const modelsToTry = GEMINI_MODELS.filter(modelName => !PERMANENTLY_UNAVAILABLE_MODELS.has(modelName));
    const activeModels = modelsToTry.length > 0 ? modelsToTry : GEMINI_MODELS;

    for (const modelName of activeModels) {
      try {
        const m = getModel(modelName);
        const result = await withGeminiRequestTimeout(fn(m), timeoutMs);
        model = m; // Cache the working model
        return result;
      } catch (error: unknown) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);

        // 404 = API not enabled or model doesn't exist — try next model
        if (errMsg.includes('404')) {
          PERMANENTLY_UNAVAILABLE_MODELS.add(modelName);
          console.warn(`[Gemini] Model "${modelName}" returned 404 — trying next model...`);
          continue;
        }

        // 429/5xx and overload text indicate temporary pressure, so we rotate models and retry.
        if (isRetryableGeminiError(errMsg.toLowerCase())) {
          console.warn(`[Gemini] Model "${modelName}" overloaded/limited (${errMsg.substring(0, 50)}...), trying next...`);
          continue;
        }

        // Any other syntax/auth error — throw immediately
        throw error;
      }
    }

    // All models failed this attempt
    if (attempt < maxRetries) {
      const waitMs = computeBackoffDelay(attempt);
      console.log(`[Gemini] All models failed, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  // Build a helpful error message
  const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
  if (errMsg.includes('404')) {
    throw new Error(
      'Gemini API models not found (404). Check VITE_GEMINI_MODELS and ensure "Generative Language API" is enabled:\n' +
      'Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n' +
      'and click "Enable".'
    );
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export interface GeminiMedicationResult {
  medications: {
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    confidence: number;
    warnings: string[];
  }[];
  corrections: string[];
  overallConfidence: number;
  rawText?: string;
}

/**
 * Verify and correct OCR-extracted medication text using Gemini.
 * Gemini cross-checks the OCR output and fills in missing/ambiguous fields.
 */
export async function verifyPrescriptionWithGemini(
  ocrText: string,
  imageBase64?: string
): Promise<GeminiMedicationResult> {
  const prompt = `You are a clinical pharmacist AI assistant. Analyze the following prescription and return a JSON object with the extracted medications.

${ocrText.trim().length > 10 ? `OCR Text:
"""
${ocrText}
"""
` : 'No OCR text is available. Extract ALL information directly from the prescription image.\n'}
INSTRUCTIONS:
1. If an image is provided, read ALL text from the prescription image first
2. Identify every medication mentioned
3. For each medication, extract: drugName, dosage, frequency, route
4. Correct any obvious OCR errors in drug names (e.g., "Llsinopril" → "Lisinopril")
5. Expand any abbreviations (BID → twice daily, QD → once daily, PO → by mouth)
6. If a field is ambiguous or missing, provide your best interpretation with lower confidence
7. Flag any potential drug interactions as warnings
8. Rate your confidence 0-1 for each medication
9. Include the raw text you extracted from the image in "rawText"

Return ONLY valid JSON in this exact format:
{
  "rawText": "Full text extracted from the prescription image",
  "medications": [
    {
      "drugName": "Lisinopril",
      "dosage": "10mg",
      "frequency": "once daily",
      "route": "by mouth",
      "confidence": 0.95,
      "warnings": []
    }
  ],
  "corrections": ["Corrected 'Llsinopril' to 'Lisinopril'"],
  "overallConfidence": 0.9
}`;

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
    ];

    // If an image is provided, include it for visual verification
    if (imageBase64) {
      let mimeType = 'image/jpeg';
      let cleanBase64 = imageBase64;
      
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      } else {
        // Fallback for hard replacement just in case
        cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    const result = await callWithRetry(
      m => m.generateContent(parts),
      {
        maxRetries: GEMINI_VERIFY_MAX_RETRIES,
        timeoutMs: GEMINI_VERIFY_TIMEOUT_MS,
      }
    );
    const responseText = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiMedicationResult;
    console.log(`[Gemini] Verified ${parsed.medications.length} medications with ${(parsed.overallConfidence * 100).toFixed(0)}% confidence`);
    if (parsed.rawText) {
      console.log(`[Gemini] Extracted ${parsed.rawText.length} chars of raw text`);
    }

    return parsed;
  } catch (error) {
    console.error('[Gemini] Verification failed:', error);
    return {
      medications: [],
      corrections: [],
      overallConfidence: 0,
      rawText: '',
    };
  }
}

/**
 * Check if Gemini verification is enabled and configured.
 */
export function isGeminiEnabled(): boolean {
  return !!import.meta.env.VITE_GEMINI_API_KEY;
}

/**
 * Get the Gemini model instance for use by other modules (e.g., meal planning).
 */
export function getGeminiModel(): GenerativeModel {
  return getModel();
}

/**
 * Gemini Vision OCR — Extract text directly from a prescription image.
 * This is the easiest way to get OCR working: just needs a Gemini API key.
 * No model files needed.
 */
export async function geminiVisionOCR(
  imageSource: File | string
): Promise<{ text: string; confidence: number }> {
  const gemini = getModel();

  const prompt = `You are an expert medical OCR system. Extract ALL text from this prescription image exactly as written.

INSTRUCTIONS:
1. Read every line of text in the image, including the doctor's name, date, patient info, and all medications
2. Preserve the original formatting and line breaks
3. If handwriting is unclear, provide your best interpretation with [?] after uncertain words
4. Include dosages, frequencies, and any special instructions exactly as written
5. Do NOT add any commentary — just the extracted text

Return ONLY the extracted text, nothing else.`;

  try {
    // Convert File to base64 if needed
    let base64Data: string;
    let mimeType = 'image/jpeg';

    if (imageSource instanceof File) {
      mimeType = imageSource.type || 'image/jpeg';
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageSource);
      });
    } else {
      // base64 data URL string processing
      const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageSource.replace(/^data:[^;]+;base64,/, '');
      }
    }

    const contentParts = [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ];

    const result = await callWithRetry(
      m => m.generateContent(contentParts),
      {
        maxRetries: GEMINI_VISION_MAX_RETRIES,
        timeoutMs: GEMINI_VISION_TIMEOUT_MS,
      }
    );

    const extractedText = result.response.text().trim();
    console.log(`[Gemini Vision OCR] Extracted ${extractedText.length} characters`);

    return {
      text: extractedText,
      confidence: 0.85, // Gemini is generally high-confidence for printed text
    };
  } catch (error) {
    console.error('[Gemini Vision OCR] Failed:', error);
    throw error;
  }
}
