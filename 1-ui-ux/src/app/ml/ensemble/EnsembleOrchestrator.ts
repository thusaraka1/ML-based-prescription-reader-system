/**
 * Ensemble Orchestrator
 * 
 * Runs multiple prescription analysis models IN PARALLEL and merges their results
 * using weighted confidence voting for maximum accuracy.
 * 
 * Models:
 *   1. Donut (custom model via FastAPI backend) — image → medications directly
 *   2. Local Regex + RxNorm Dictionary — text → medications (fast, offline)
 *   3. Gemini AI — text/image → medications (cloud, highest intelligence)
 * 
 * Ensemble Strategy:
 *   - All models run simultaneously via Promise.allSettled
 *   - Results merged by drug name (case-insensitive, fuzzy matched)
 *   - Confidence boosted when multiple models agree
 *   - Source attribution tracks which models found each medication
 */

import { Medication } from '../../models/Medication';
import { parseMedications, ParsedMedication, extractEntities } from '../nlp/MedicationParser';
import { verifyPrescriptionWithGemini, isGeminiEnabled, GeminiMedicationResult } from '../nlp/geminiService';
import { analyzePrescriptionWithDonut, isDonutEnabled, DonutMedicationResult } from '../nlp/donutService';
import { findDrugMatch } from '../nlp/rxnormDictionary';
import { modelAccuracyTracker } from './ModelAccuracyTracker';

const DONUT_TASK_TIMEOUT_MS = Number(
  import.meta.env.VITE_ENSEMBLE_DONUT_TIMEOUT_MS ||
  import.meta.env.VITE_DONUT_PREDICT_TIMEOUT_MS ||
  180000
);
const GEMINI_TASK_TIMEOUT_MS = Number(import.meta.env.VITE_ENSEMBLE_GEMINI_TIMEOUT_MS || 180000);
const GEMINI_ATTACH_IMAGE_TEXT_THRESHOLD = Number(import.meta.env.VITE_GEMINI_ATTACH_IMAGE_TEXT_THRESHOLD || 200);

function withTaskTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type ModelSource = 'donut' | 'regex' | 'gemini';

export interface EnsembleMedication {
  medication: Medication;
  confidence: number;
  sources: ModelSource[];
  sourceDetails: {
    donut?: { confidence: number; raw?: string };
    regex?: { confidence: number; drugClass?: string };
    gemini?: { confidence: number; warnings?: string[] };
  };
}

export interface EnsembleResult {
  medications: EnsembleMedication[];
  overallConfidence: number;
  sourcesUsed: ModelSource[];
  modelAgreementRate: number;
  corrections: string[];
  timings: {
    donutMs?: number;
    regexMs?: number;
    geminiMs?: number;
    totalMs: number;
  };
  rawOutputs: {
    donut?: DonutMedicationResult;
    regex?: ParsedMedication[];
    gemini?: GeminiMedicationResult;
  };
}

interface CandidateMedication {
  drugName: string;
  normalizedName: string;
  dosage: string;
  frequency: string;
  confidence: number;
  source: ModelSource;
  extra?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Ensemble Weights
// ─────────────────────────────────────────────

const MODEL_WEIGHTS: Record<ModelSource, number> = {
  donut: 0.40,   // Your custom model — strong for prescription-specific patterns
  regex: 0.25,   // Fast and reliable for standard formats
  gemini: 0.35,  // High intelligence but higher latency
};

// Confidence boosts when models agree
const AGREEMENT_BONUS = {
  3: 1.30,  // All 3 models agree → +30% confidence
  2: 1.15,  // 2 models agree → +15% confidence
  1: 1.00,  // Single source → no bonus
};

// ─────────────────────────────────────────────
// Main Orchestrator
// ─────────────────────────────────────────────

/**
 * Run the ensemble pipeline: all models in parallel, merge with voting.
 * 
 * @param extractedText - OCR text (for regex + Gemini)
 * @param imageSource - Original image (for Donut + Gemini vision)
 * @param imageBase64 - Base64 image data (for Gemini inline)
 */
export async function runEnsemble(
  extractedText: string,
  imageSource?: File | string,
  imageBase64?: string,
  donutPromise?: Promise<DonutMedicationResult | null>
): Promise<EnsembleResult> {
  const startTime = performance.now();
  const sourcesUsed: ModelSource[] = [];
  const corrections: string[] = [];
  const timings: EnsembleResult['timings'] = { totalMs: 0 };
  const rawOutputs: EnsembleResult['rawOutputs'] = {};

  // Build the parallel tasks
  const tasks: Promise<CandidateMedication[]>[] = [];
  const taskLabels: string[] = [];

  // Task 1: Donut (custom model)
  const donutEnabled = (imageSource || donutPromise) ? await isDonutEnabled() : false;
  if (donutEnabled && (imageSource || donutPromise)) {
    taskLabels.push('donut');
    tasks.push(
      (async () => {
        const t0 = performance.now();
        try {
          // If a donutPromise was pre-started by the upload component,
          // wrap it in a timeout to avoid infinite waits
          const result = donutPromise 
            ? await withTaskTimeout(donutPromise, DONUT_TASK_TIMEOUT_MS, 'Donut (pre-started)')
            : await withTaskTimeout(
                analyzePrescriptionWithDonut(imageSource!, DONUT_TASK_TIMEOUT_MS),
                DONUT_TASK_TIMEOUT_MS + 1000,
                'Donut'
              );
          
          if (!result) return [];
          timings.donutMs = performance.now() - t0;
          rawOutputs.donut = result;

          const directCandidates = result.medications.map(m => ({
            drugName: m.drugName,
            normalizedName: normalizeDrugName(m.drugName),
            dosage: m.dosage,
            frequency: m.frequency,
            confidence: m.confidence,
            source: 'donut' as ModelSource,
          }));

          if (directCandidates.length > 0) {
            sourcesUsed.push('donut');
            return directCandidates;
          }

          // Some Donut outputs are unstructured text. Re-parse raw text using local parser as a fallback.
          const fallbackParsed = result.raw_text ? parseMedications(result.raw_text) : [];
          if (fallbackParsed.length > 0) {
            console.log(`[Ensemble] Donut fallback parser recovered ${fallbackParsed.length} medication(s) from raw output`);
            sourcesUsed.push('donut');
            return fallbackParsed.map(r => ({
              drugName: r.medication.drugName,
              normalizedName: normalizeDrugName(r.medication.drugName),
              dosage: r.medication.dosage,
              frequency: r.medication.frequency,
              confidence: Math.max(0.45, Math.min(0.75, r.confidence * 0.9)),
              source: 'donut' as ModelSource,
            }));
          }

          // Last-resort recovery: extract likely entities even if full regex parsing failed.
          const entities = result.raw_text ? extractEntities(result.raw_text) : { drugs: [], dosages: [], frequencies: [] };
          if (entities.drugs.length > 0) {
            console.log(`[Ensemble] Donut entity recovery found ${entities.drugs.length} potential medication(s)`);
            sourcesUsed.push('donut');
            return entities.drugs.map((drug, idx) => ({
              drugName: drug,
              normalizedName: normalizeDrugName(drug),
              dosage: entities.dosages[idx] || entities.dosages[0] || '',
              frequency: entities.frequencies[idx] || entities.frequencies[0] || 'as directed',
              confidence: 0.42,
              source: 'donut' as ModelSource,
            }));
          }

          return [];
        } catch (error) {
          timings.donutMs = performance.now() - t0;
          console.warn('[Ensemble] Donut failed:', error);
          return [];
        }
      })()
    );
  }

  // Task 2: Local Regex + RxNorm (always runs — fast and offline)
  taskLabels.push('regex');
  tasks.push(
    (async () => {
      const t0 = performance.now();
      try {
        const results = parseMedications(extractedText);
        timings.regexMs = performance.now() - t0;
        rawOutputs.regex = results;
        if (results.length > 0) sourcesUsed.push('regex');

        return results.map(r => ({
          drugName: r.medication.drugName,
          normalizedName: normalizeDrugName(r.medication.drugName),
          dosage: r.medication.dosage,
          frequency: r.medication.frequency,
          confidence: r.confidence,
          source: 'regex' as ModelSource,
          extra: { drugClass: r.matchedDrugClass },
        }));
      } catch (error) {
        timings.regexMs = performance.now() - t0;
        console.warn('[Ensemble] Regex parser failed:', error);
        return [];
      }
    })()
  );

  // Task 3: Gemini (cloud AI)
  if (isGeminiEnabled() && (extractedText.trim().length > 5 || !!imageBase64)) {
    taskLabels.push('gemini');
    tasks.push(
      (async () => {
        const t0 = performance.now();
        try {
          // Always attach image when OCR text is empty/minimal so Gemini can extract directly
          const includeImageForGemini = !!imageBase64 && extractedText.trim().length < GEMINI_ATTACH_IMAGE_TEXT_THRESHOLD;
          const textForGemini = extractedText.trim().length > 0
            ? extractedText
            : 'No reliable OCR text available. Extract ALL medications directly from the prescription image. Include drug names, dosages, and frequencies.';
          
          // When text is empty, we MUST include the image for Gemini to work
          const shouldIncludeImage = includeImageForGemini || extractedText.trim().length < 10;
          const result = await withTaskTimeout(
            verifyPrescriptionWithGemini(textForGemini, shouldIncludeImage ? imageBase64 : undefined),
            GEMINI_TASK_TIMEOUT_MS,
            'Gemini'
          );
          timings.geminiMs = performance.now() - t0;
          rawOutputs.gemini = result;

          if (result.medications.length > 0) {
            sourcesUsed.push('gemini');
          }
          if (result.corrections.length > 0) {
            corrections.push(...result.corrections);
          }

          return result.medications.map(m => ({
            drugName: m.drugName,
            normalizedName: normalizeDrugName(m.drugName),
            dosage: m.dosage,
            frequency: m.frequency,
            confidence: m.confidence,
            source: 'gemini' as ModelSource,
            extra: { warnings: m.warnings, route: m.route },
          }));
        } catch (error) {
          timings.geminiMs = performance.now() - t0;
          console.warn('[Ensemble] Gemini failed:', error);
          return [];
        }
      })()
    );
  }

  // Run all models in parallel with early exit
  // When any model finds medications, give remaining models a grace period instead of waiting forever
  const EARLY_EXIT_GRACE_MS = 15000; // 15s grace for remaining models after first success
  console.log(`[Ensemble] 🚀 Running ${tasks.length} models in parallel: [${taskLabels.join(', ')}]`);
  const parallelStartTime = performance.now();

  // Wrap each task to track completion and enable early exit
  const taskResults: (CandidateMedication[] | Error)[] = new Array(tasks.length).fill(null);
  let resolvedCount = 0;
  let hasMedications = false;

  const results = await new Promise<PromiseSettledResult<CandidateMedication[]>[]>((resolveAll) => {
    let earlyExitTimer: ReturnType<typeof setTimeout> | null = null;
    let allDone = false;

    const checkCompletion = () => {
      if (allDone) return;
      if (resolvedCount === tasks.length) {
        allDone = true;
        if (earlyExitTimer) clearTimeout(earlyExitTimer);
        finalize();
      }
    };

    const startGraceTimer = () => {
      if (earlyExitTimer || allDone) return;
      const remaining = tasks.length - resolvedCount;
      if (remaining > 0) {
        console.log(`[Ensemble] ⚡ Found medications — giving ${remaining} remaining model(s) ${EARLY_EXIT_GRACE_MS/1000}s grace period`);
        earlyExitTimer = setTimeout(() => {
          if (!allDone) {
            allDone = true;
            console.log(`[Ensemble] ⏰ Grace period expired — proceeding with available results`);
            finalize();
          }
        }, EARLY_EXIT_GRACE_MS);
      }
    };

    const finalize = () => {
      const settled: PromiseSettledResult<CandidateMedication[]>[] = taskResults.map(r => {
        if (r === null) return { status: 'fulfilled' as const, value: [] }; // Not yet resolved, treat as empty
        if (r instanceof Error) return { status: 'rejected' as const, reason: r };
        return { status: 'fulfilled' as const, value: r };
      });
      resolveAll(settled);
    };

    tasks.forEach((task, i) => {
      task.then(
        (value) => {
          taskResults[i] = value;
          resolvedCount++;
          if (value.length > 0) {
            hasMedications = true;
            startGraceTimer();
          }
          checkCompletion();
        },
        (error) => {
          taskResults[i] = error instanceof Error ? error : new Error(String(error));
          resolvedCount++;
          checkCompletion();
        }
      );
    });
  });

  const parallelDuration = performance.now() - parallelStartTime;

  // Collect all candidates with detailed logging
  const allCandidates: CandidateMedication[] = [];
  const modelResults: string[] = [];

  results.forEach((result, i) => {
    const label = taskLabels[i];
    const timing = label === 'donut' ? timings.donutMs
      : label === 'regex' ? timings.regexMs
      : label === 'gemini' ? timings.geminiMs
      : undefined;
    const timingStr = timing !== undefined ? `${Math.round(timing)}ms` : 'n/a';

    if (result.status === 'fulfilled') {
      const count = result.value.length;
      allCandidates.push(...result.value);
      modelResults.push(`  ✅ ${label}: ${count} medication(s) in ${timingStr}`);
      if (count > 0) {
        result.value.forEach(c => {
          modelResults.push(`     → ${c.drugName} ${c.dosage} ${c.frequency} (${(c.confidence * 100).toFixed(0)}%)`);
        });
      }
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const shortErr = errMsg.length > 80 ? errMsg.substring(0, 80) + '...' : errMsg;
      modelResults.push(`  ❌ ${label}: FAILED in ${timingStr} — ${shortErr}`);
    }
  });

  // Print structured summary
  console.log(
    `[Ensemble] ── Model Results (${Math.round(parallelDuration)}ms parallel) ──\n` +
    modelResults.join('\n')
  );

  console.log(`[Ensemble] Total candidates: ${allCandidates.length} from ${sourcesUsed.length} sources (${sourcesUsed.join(', ') || 'none'})`);

  // Merge and vote
  const mergedMedications = mergeCandidates(allCandidates);

  // Calculate overall metrics
  const overallConfidence = mergedMedications.length > 0
    ? mergedMedications.reduce((sum, m) => sum + m.confidence, 0) / mergedMedications.length
    : 0;

  const agreementCounts = mergedMedications.map(m => m.sources.length);
  const modelAgreementRate = agreementCounts.length > 0
    ? agreementCounts.reduce((sum, c) => sum + c, 0) / (agreementCounts.length * sourcesUsed.length)
    : 0;

  timings.totalMs = performance.now() - startTime;

  // Track per-model performance
  modelAccuracyTracker.recordPrediction(mergedMedications);

  console.log(
    `[Ensemble] ✅ Complete: ${mergedMedications.length} medications, ` +
    `${(overallConfidence * 100).toFixed(0)}% confidence, ` +
    `${Math.round(timings.totalMs)}ms total ` +
    `(donut: ${timings.donutMs ? Math.round(timings.donutMs) + 'ms' : 'n/a'}, ` +
    `regex: ${timings.regexMs ? Math.round(timings.regexMs) + 'ms' : 'n/a'}, ` +
    `gemini: ${timings.geminiMs ? Math.round(timings.geminiMs) + 'ms' : 'n/a'})`
  );

  return {
    medications: mergedMedications,
    overallConfidence,
    sourcesUsed,
    modelAgreementRate,
    corrections,
    timings,
    rawOutputs,
  };
}

// ─────────────────────────────────────────────
// Merging & Voting
// ─────────────────────────────────────────────

/**
 * Merge candidates from all models using weighted confidence voting.
 * Groups by normalized drug name and combines evidence.
 */
function mergeCandidates(candidates: CandidateMedication[]): EnsembleMedication[] {
  const groups = new Map<string, CandidateMedication[]>();

  // Group by normalized drug name (fuzzy matching)
  for (const candidate of candidates) {
    let matched = false;

    for (const [key, group] of groups) {
      if (isSameDrug(candidate.normalizedName, key)) {
        group.push(candidate);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.set(candidate.normalizedName, [candidate]);
    }
  }

  // Vote within each group
  const results: EnsembleMedication[] = [];

  for (const group of groups.values()) {
    const sources = [...new Set(group.map(c => c.source))];

    // Pick the best drug name (prefer RxNorm-matched names)
    const bestCandidate = pickBestCandidate(group);

    // Combine confidence using weighted voting
    let weightedConfidence = 0;
    let totalWeight = 0;
    const sourceDetails: EnsembleMedication['sourceDetails'] = {};

    for (const candidate of group) {
      const weight = MODEL_WEIGHTS[candidate.source];
      weightedConfidence += candidate.confidence * weight;
      totalWeight += weight;

      // Build source details
      if (candidate.source === 'donut') {
        sourceDetails.donut = { confidence: candidate.confidence };
      } else if (candidate.source === 'regex') {
        sourceDetails.regex = {
          confidence: candidate.confidence,
          drugClass: candidate.extra?.drugClass as string | undefined,
        };
      } else if (candidate.source === 'gemini') {
        sourceDetails.gemini = {
          confidence: candidate.confidence,
          warnings: candidate.extra?.warnings as string[] | undefined,
        };
      }
    }

    // Normalize weighted confidence
    const baseConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;

    // Apply agreement bonus
    const agreementBonus = AGREEMENT_BONUS[Math.min(sources.length, 3) as 1 | 2 | 3];
    const finalConfidence = Math.min(0.99, baseConfidence * agreementBonus);

    results.push({
      medication: new Medication(
        bestCandidate.drugName,
        bestCandidate.dosage,
        bestCandidate.frequency
      ),
      confidence: finalConfidence,
      sources,
      sourceDetails,
    });
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  // Filter out extremely low-confidence noise (< 20%), but keep everything else.
  // We apply a stricter filter for uncorroborated Donut-only results, since its fallback regex often hallucinates.
  return results.filter(r => {
    if (r.confidence < 0.20) return false;
    
    // Discard very-low-confidence candidates that ONLY came from Donut (hallucinations)
    if (r.confidence < 0.25 && r.sources.length === 1 && r.sources[0] === 'donut') {
      return false;
    }
    
    return true;
  });
}

/**
 * Pick the best candidate from a group of matches for the same drug.
 * Prefers: RxNorm-matched name > longer name > higher confidence.
 */
function pickBestCandidate(group: CandidateMedication[]): CandidateMedication {
  // Try to find a RxNorm-matched version
  for (const c of group) {
    const match = findDrugMatch(c.drugName);
    if (match && match.confidence > 0.8) {
      return {
        ...c,
        drugName: match.drug.name, // Use canonical RxNorm name
      };
    }
  }

  // Prefer Gemini's name (usually most accurate), then Donut, then regex
  const priority: ModelSource[] = ['gemini', 'donut', 'regex'];
  for (const source of priority) {
    const candidate = group.find(c => c.source === source);
    if (candidate) return candidate;
  }

  // Fallback: highest confidence
  return group.sort((a, b) => b.confidence - a.confidence)[0];
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Normalize a drug name for comparison.
 */
function normalizeDrugName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Check if two normalized drug names refer to the same medication.
 * Uses Levenshtein distance for fuzzy matching.
 */
function isSameDrug(a: string, b: string): boolean {
  if (a === b) return true;

  // One is a substring of the other
  if (a.includes(b) || b.includes(a)) return true;

  // Levenshtein distance ≤ 2 for similar names
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return a === b;

  const distance = levenshtein(a, b);
  return distance <= 2;
}

/**
 * Simple Levenshtein distance.
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}
