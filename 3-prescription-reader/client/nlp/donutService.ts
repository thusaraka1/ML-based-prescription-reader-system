/**
 * Donut Model Service
 * Calls the local Donut FastAPI backend for prescription image → medication extraction.
 * Falls back gracefully if the backend is not running.
 */

export interface DonutMedicationResult {
  medications: {
    drugName: string;
    dosage: string;
    frequency: string;
    confidence: number;
    source: string;
  }[];
  raw_text: string;
  confidence: number;
  model: string;
  device: string;
  processing_time_ms: number;
}

export interface DonutHealthStatus {
  status: 'ok' | 'loading' | 'offline';
  model: string;
  device: string;
  gpu_available: boolean;
  active_inferences?: number;
  max_concurrent_inferences?: number;
}

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;

const DONUT_API_URL = env.VITE_DONUT_API_URL || 'http://localhost:8000';
const HEALTH_CHECK_TIMEOUT = 3000;  // 3 seconds
const PREDICT_TIMEOUT = Number(env.VITE_DONUT_PREDICT_TIMEOUT_MS || 120000); // default 120s
const CPU_PREDICT_TIMEOUT = Number(env.VITE_DONUT_CPU_PREDICT_TIMEOUT_MS || 240000); // default 240s on CPU
const DONUT_RETRY_DELAY_MS = Number(env.VITE_DONUT_RETRY_DELAY_MS || 1500);
const DONUT_OFFLINE_COOLDOWN_MS = Number(env.VITE_DONUT_OFFLINE_COOLDOWN_MS || 60000);

function isDonutFeatureEnabled(): boolean {
  return env.VITE_ENABLE_CUSTOM_MODEL === 'true';
}

// Cache the health status to avoid repeated checks
let cachedHealthStatus: DonutHealthStatus | null = null;
let lastHealthCheck = 0;
let offlineCooldownUntil = 0;
const HEALTH_CACHE_MS = 10000; // Re-check every 10 seconds

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

/**
 * Check if the Donut backend server is running and the model is loaded.
 */
export async function checkDonutHealth(forceRefresh: boolean = false): Promise<DonutHealthStatus> {
  const now = Date.now();

  if (!isDonutFeatureEnabled()) {
    cachedHealthStatus = { status: 'offline', model: '', device: '', gpu_available: false };
    lastHealthCheck = now;
    return cachedHealthStatus;
  }

  if (!forceRefresh && cachedHealthStatus && now - lastHealthCheck < HEALTH_CACHE_MS) {
    return cachedHealthStatus;
  }

  if (!forceRefresh && now < offlineCooldownUntil && cachedHealthStatus?.status === 'offline') {
    return cachedHealthStatus;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${DONUT_API_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      cachedHealthStatus = await response.json();
      lastHealthCheck = now;
      return cachedHealthStatus!;
    }

    cachedHealthStatus = { status: 'offline', model: '', device: '', gpu_available: false };
    lastHealthCheck = now;
    offlineCooldownUntil = now + DONUT_OFFLINE_COOLDOWN_MS;
    return cachedHealthStatus;
  } catch {
    cachedHealthStatus = { status: 'offline', model: '', device: '', gpu_available: false };
    lastHealthCheck = now;
    offlineCooldownUntil = now + DONUT_OFFLINE_COOLDOWN_MS;
    return cachedHealthStatus;
  }
}

/**
 * Check if the Donut custom model backend is available and enabled.
 */
export async function isDonutEnabled(): Promise<boolean> {
  if (!isDonutFeatureEnabled()) return false;

  const health = await checkDonutHealth();
  return health.status === 'ok';
}

/**
 * Synchronous check — uses cached status (does NOT make a network call).
 * Use this for render-time checks; call checkDonutHealth() first to populate cache.
 */
export function isDonutEnabledSync(): boolean {
  if (!isDonutFeatureEnabled()) return false;
  return cachedHealthStatus?.status === 'ok' || false;
}

// ─────────────────────────────────────────────
// Prediction
// ─────────────────────────────────────────────

/**
 * Send a prescription image to the Donut backend for analysis.
 * 
 * @param imageSource - File object or base64 data URL
 * @returns Structured medication extraction results
 * @throws Error if backend is offline or inference fails
 */
export async function analyzePrescriptionWithDonut(
  imageSource: File | string,
  timeoutMs: number = PREDICT_TIMEOUT
): Promise<DonutMedicationResult> {
  const effectiveTimeout = (cachedHealthStatus?.device || '').toLowerCase() === 'cpu'
    ? Math.max(timeoutMs, CPU_PREDICT_TIMEOUT)
    : timeoutMs;

  const runAttempt = async (attempt: number): Promise<DonutMedicationResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      let response: Response;

      if (imageSource instanceof File) {
        // Send as multipart form data
        const formData = new FormData();
        formData.append('image', imageSource);

        response = await fetch(`${DONUT_API_URL}/api/predict`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } else {
        // Send as base64 JSON
        response = await fetch(`${DONUT_API_URL}/api/predict-base64`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageSource }),
          signal: controller.signal,
        });
      }

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const detail = errorData.detail || response.statusText;

        // Retry once when backend is saturated.
        if (attempt === 0 && (response.status === 503 || response.status === 429)) {
          await new Promise(r => setTimeout(r, DONUT_RETRY_DELAY_MS));
          return runAttempt(attempt + 1);
        }

        throw new Error(`Donut API error: ${detail}`);
      }

      const result: DonutMedicationResult = await response.json();

      console.log(
        `[Donut] ✅ ${result.medications.length} medications extracted in ` +
        `${result.processing_time_ms.toFixed(0)}ms (${result.device})`
      );

      return result;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('[Donut] Request timed out — backend may be overloaded');
        throw new Error(`Donut model timed out after ${Math.round(effectiveTimeout / 1000)}s. The server may be busy or running on CPU.`);
      }

      throw error;
    }
  };

  try {
    return await runAttempt(0);
  } catch (error) {
    console.error('[Donut] Analysis failed:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
// Model Info
// ─────────────────────────────────────────────

/**
 * Get detailed model information from the backend.
 */
export async function getDonutModelInfo(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${DONUT_API_URL}/api/model-info`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}
