/**
 * Server-Side Ensemble Module
 * Ported from the web app's EnsembleOrchestrator.ts + MedicationParser.ts + rxnormDictionary.ts
 *
 * Provides:
 *  - RxNorm drug dictionary with fuzzy matching
 *  - Regex-based medication parser
 *  - Gemini multi-model retry with exponential backoff
 *  - Weighted confidence voting & candidate merging
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────────────────────────────────────────
// RxNorm Drug Database (top ~80 commonly prescribed)
// ─────────────────────────────────────────────

const DRUG_DATABASE = [
  { name: 'Lisinopril', aliases: ['zestril','prinivil'], drugClass: 'ACE Inhibitor' },
  { name: 'Amlodipine', aliases: ['norvasc'], drugClass: 'Calcium Channel Blocker' },
  { name: 'Atorvastatin', aliases: ['lipitor'], drugClass: 'Statin' },
  { name: 'Metoprolol', aliases: ['lopressor','toprol'], drugClass: 'Beta Blocker' },
  { name: 'Losartan', aliases: ['cozaar'], drugClass: 'ARB' },
  { name: 'Hydrochlorothiazide', aliases: ['hctz','microzide'], drugClass: 'Diuretic' },
  { name: 'Warfarin', aliases: ['coumadin','jantoven'], drugClass: 'Anticoagulant' },
  { name: 'Clopidogrel', aliases: ['plavix'], drugClass: 'Antiplatelet' },
  { name: 'Furosemide', aliases: ['lasix'], drugClass: 'Loop Diuretic' },
  { name: 'Spironolactone', aliases: ['aldactone'], drugClass: 'Potassium-Sparing Diuretic' },
  { name: 'Valsartan', aliases: ['diovan'], drugClass: 'ARB' },
  { name: 'Diltiazem', aliases: ['cardizem','tiazac'], drugClass: 'Calcium Channel Blocker' },
  { name: 'Carvedilol', aliases: ['coreg'], drugClass: 'Beta Blocker' },
  { name: 'Simvastatin', aliases: ['zocor'], drugClass: 'Statin' },
  { name: 'Rosuvastatin', aliases: ['crestor'], drugClass: 'Statin' },
  { name: 'Pravastatin', aliases: ['pravachol'], drugClass: 'Statin' },
  { name: 'Metformin', aliases: ['glucophage','fortamet'], drugClass: 'Biguanide' },
  { name: 'Glipizide', aliases: ['glucotrol'], drugClass: 'Sulfonylurea' },
  { name: 'Insulin Glargine', aliases: ['lantus','basaglar','toujeo'], drugClass: 'Insulin' },
  { name: 'Sitagliptin', aliases: ['januvia'], drugClass: 'DPP-4 Inhibitor' },
  { name: 'Empagliflozin', aliases: ['jardiance'], drugClass: 'SGLT2 Inhibitor' },
  { name: 'Acetaminophen', aliases: ['tylenol','paracetamol','apap'], drugClass: 'Analgesic' },
  { name: 'Ibuprofen', aliases: ['advil','motrin'], drugClass: 'NSAID' },
  { name: 'Naproxen', aliases: ['aleve','naprosyn'], drugClass: 'NSAID' },
  { name: 'Meloxicam', aliases: ['mobic'], drugClass: 'NSAID' },
  { name: 'Tramadol', aliases: ['ultram'], drugClass: 'Opioid Analgesic' },
  { name: 'Gabapentin', aliases: ['neurontin','gralise'], drugClass: 'Anticonvulsant/Neuropathic' },
  { name: 'Pregabalin', aliases: ['lyrica'], drugClass: 'Anticonvulsant/Neuropathic' },
  { name: 'Celecoxib', aliases: ['celebrex'], drugClass: 'COX-2 Inhibitor' },
  { name: 'Diclofenac', aliases: ['voltaren','cataflam'], drugClass: 'NSAID' },
  { name: 'Sertraline', aliases: ['zoloft'], drugClass: 'SSRI' },
  { name: 'Escitalopram', aliases: ['lexapro'], drugClass: 'SSRI' },
  { name: 'Fluoxetine', aliases: ['prozac','sarafem'], drugClass: 'SSRI' },
  { name: 'Citalopram', aliases: ['celexa'], drugClass: 'SSRI' },
  { name: 'Duloxetine', aliases: ['cymbalta'], drugClass: 'SNRI' },
  { name: 'Venlafaxine', aliases: ['effexor'], drugClass: 'SNRI' },
  { name: 'Bupropion', aliases: ['wellbutrin','zyban'], drugClass: 'NDRI' },
  { name: 'Trazodone', aliases: ['desyrel','oleptro'], drugClass: 'SARI' },
  { name: 'Mirtazapine', aliases: ['remeron'], drugClass: 'NaSSA' },
  { name: 'Amitriptyline', aliases: ['elavil'], drugClass: 'TCA' },
  { name: 'Alprazolam', aliases: ['xanax'], drugClass: 'Benzodiazepine' },
  { name: 'Lorazepam', aliases: ['ativan'], drugClass: 'Benzodiazepine' },
  { name: 'Quetiapine', aliases: ['seroquel'], drugClass: 'Atypical Antipsychotic' },
  { name: 'Aripiprazole', aliases: ['abilify'], drugClass: 'Atypical Antipsychotic' },
  { name: 'Albuterol', aliases: ['proventil','ventolin','salbutamol'], drugClass: 'Beta-2 Agonist' },
  { name: 'Fluticasone', aliases: ['flonase','flovent'], drugClass: 'Corticosteroid' },
  { name: 'Montelukast', aliases: ['singulair'], drugClass: 'Leukotriene Modifier' },
  { name: 'Prednisone', aliases: ['deltasone','rayos'], drugClass: 'Corticosteroid' },
  { name: 'Cetirizine', aliases: ['zyrtec'], drugClass: 'Antihistamine' },
  { name: 'Loratadine', aliases: ['claritin'], drugClass: 'Antihistamine' },
  { name: 'Omeprazole', aliases: ['prilosec'], drugClass: 'PPI' },
  { name: 'Pantoprazole', aliases: ['protonix'], drugClass: 'PPI' },
  { name: 'Esomeprazole', aliases: ['nexium'], drugClass: 'PPI' },
  { name: 'Famotidine', aliases: ['pepcid'], drugClass: 'H2 Blocker' },
  { name: 'Ondansetron', aliases: ['zofran'], drugClass: 'Antiemetic' },
  { name: 'Amoxicillin', aliases: ['amoxil','trimox'], drugClass: 'Penicillin' },
  { name: 'Azithromycin', aliases: ['zithromax','z-pack'], drugClass: 'Macrolide' },
  { name: 'Ciprofloxacin', aliases: ['cipro'], drugClass: 'Fluoroquinolone' },
  { name: 'Levofloxacin', aliases: ['levaquin'], drugClass: 'Fluoroquinolone' },
  { name: 'Doxycycline', aliases: ['vibramycin','doryx'], drugClass: 'Tetracycline' },
  { name: 'Metronidazole', aliases: ['flagyl'], drugClass: 'Nitroimidazole' },
  { name: 'Cephalexin', aliases: ['keflex'], drugClass: 'Cephalosporin' },
  { name: 'Nitrofurantoin', aliases: ['macrobid'], drugClass: 'Nitrofuran' },
  { name: 'Clindamycin', aliases: ['cleocin'], drugClass: 'Lincosamide' },
  { name: 'Levothyroxine', aliases: ['synthroid','levoxyl','tirosint'], drugClass: 'Thyroid Hormone' },
  { name: 'Vitamin D', aliases: ['cholecalciferol','ergocalciferol'], drugClass: 'Vitamin' },
  { name: 'Ferrous Sulfate', aliases: ['feosol','iron supplement'], drugClass: 'Iron Supplement' },
  { name: 'Folic Acid', aliases: ['folate'], drugClass: 'Vitamin' },
  { name: 'Zolpidem', aliases: ['ambien'], drugClass: 'Sedative-Hypnotic' },
  { name: 'Tamsulosin', aliases: ['flomax'], drugClass: 'Alpha Blocker' },
  { name: 'Finasteride', aliases: ['proscar','propecia'], drugClass: '5-Alpha Reductase Inhibitor' },
  { name: 'Levetiracetam', aliases: ['keppra'], drugClass: 'Anticonvulsant' },
  { name: 'Lamotrigine', aliases: ['lamictal'], drugClass: 'Anticonvulsant' },
  { name: 'Topiramate', aliases: ['topamax'], drugClass: 'Anticonvulsant' },
  { name: 'Phenytoin', aliases: ['dilantin'], drugClass: 'Anticonvulsant' },
  { name: 'Valproic Acid', aliases: ['depakote','depakene'], drugClass: 'Anticonvulsant' },
];

// ─────────────────────────────────────────────
// Prescription Abbreviations
// ─────────────────────────────────────────────

const PRESCRIPTION_ABBREVIATIONS = {
  'qd': 'once daily', 'od': 'once daily', 'bid': 'twice daily',
  'tid': 'three times daily', 'qid': 'four times daily',
  'q4h': 'every 4 hours', 'q6h': 'every 6 hours', 'q8h': 'every 8 hours',
  'q12h': 'every 12 hours', 'prn': 'as needed', 'hs': 'at bedtime',
  'qhs': 'at bedtime', 'ac': 'before meals', 'pc': 'after meals',
  'stat': 'immediately', 'qam': 'every morning', 'qpm': 'every evening',
  'qwk': 'once weekly', 'biw': 'twice weekly',
  'po': 'by mouth', 'sl': 'sublingual', 'im': 'intramuscular',
  'iv': 'intravenous', 'sc': 'subcutaneous', 'inh': 'inhaled', 'top': 'topically',
};

// ─────────────────────────────────────────────
// Levenshtein Distance & Fuzzy Matching
// ─────────────────────────────────────────────

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost);
    }
  }
  return matrix[a.length][b.length];
}

function findDrugMatch(input, maxDistance = 3) {
  const norm = input.toLowerCase().trim();
  if (norm.length < 3) return null;
  let bestMatch = null, bestDist = Infinity;
  for (const drug of DRUG_DATABASE) {
    const d = levenshtein(norm, drug.name.toLowerCase());
    if (d < bestDist) { bestDist = d; bestMatch = drug; }
    for (const alias of drug.aliases) {
      const ad = levenshtein(norm, alias.toLowerCase());
      if (ad < bestDist) { bestDist = ad; bestMatch = drug; }
    }
    if (bestDist === 0) break;
  }
  if (bestMatch && bestDist <= maxDistance) {
    const maxLen = Math.max(norm.length, bestMatch.name.length);
    return { drug: bestMatch, confidence: Math.max(0, 1 - bestDist / maxLen) };
  }
  return null;
}

function normalizeDrugName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function isSameDrug(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (Math.max(a.length, b.length) <= 3) return a === b;
  return levenshtein(a, b) <= 2;
}

// ─────────────────────────────────────────────
// Regex Medication Parser
// ─────────────────────────────────────────────

const MEDICATION_PATTERNS = [
  /(?:^|\n)\s*(?:\d+[.)]\s*)?([A-Za-z][\w\s-]*?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s*(.*?)(?=\n|$)/gi,
  /([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s+(?:PO|IM|IV|SC|INH|TOP|SL)?\s*(BID|TID|QID|QD|OD|PRN|HS|Q\d+H|QAM|QPM|QWK|once\s+daily|twice\s+daily|three\s+times\s+daily|four\s+times\s+daily|at\s+bedtime|as\s+needed|every\s+\d+\s+hours?)(?:\s|$)/gi,
  /(?:Tab\.?|Cap\.?|Inj\.?|Syp\.?)\s+([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s*([\d-]+(?:\s*[-x]\s*[\d-]+)*(?:\s*(?:before|after|with)\s+(?:meals?|food|breakfast|lunch|dinner))?)/gi,
  /(?:Rx:?\s*)?([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)(?:\s+(.*?))?(?=\n|$)/gi,
];

function decodeDoseSchedule(schedule) {
  const m = schedule.match(/^(\d)-(\d)-(\d)$/);
  if (m) {
    const parts = [];
    if (m[1] !== '0') parts.push(`${m[1]} in the morning`);
    if (m[2] !== '0') parts.push(`${m[2]} in the afternoon`);
    if (m[3] !== '0') parts.push(`${m[3]} at night`);
    return parts.join(', ') || 'as directed';
  }
  return schedule;
}

function normalizeFrequency(raw) {
  let normalized = raw.trim();
  if (/^\d-\d-\d$/.test(normalized)) return decodeDoseSchedule(normalized);
  const words = normalized.split(/\s+/);
  return words.map(w => {
    const lower = w.toLowerCase().replace(/[.,;:]/g, '');
    return PRESCRIPTION_ABBREVIATIONS[lower] || w;
  }).join(' ') || 'as directed';
}

export function parseMedications(ocrText) {
  const results = [];
  const seenDrugs = new Set();
  for (const pattern of MEDICATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(ocrText)) !== null) {
      const rawDrugName = match[1].trim();
      const dosageAmount = match[2];
      const dosageUnit = match[3];
      const rawFrequency = match[4] || '';
      if (rawDrugName.length < 3) continue;
      const drugMatch = findDrugMatch(rawDrugName);
      const drugName = drugMatch ? drugMatch.drug.name : rawDrugName;
      const confidence = drugMatch ? drugMatch.confidence : 0.3;
      const drugClass = drugMatch?.drug.drugClass;
      const key = `${drugName.toLowerCase()}-${dosageAmount}${dosageUnit}`;
      if (seenDrugs.has(key)) continue;
      seenDrugs.add(key);
      results.push({
        drugName, dosage: `${dosageAmount}${dosageUnit}`,
        frequency: normalizeFrequency(rawFrequency),
        confidence, drugClass, rawMatch: match[0].trim(),
      });
    }
  }
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

export function extractEntities(text) {
  const drugs = [], dosages = [], frequencies = [];
  for (const word of text.split(/[\s,;:]+/)) {
    const m = findDrugMatch(word, 2);
    if (m) drugs.push(m.drug.name);
  }
  const dp = /\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|IU|mEq)/gi;
  let dm; while ((dm = dp.exec(text)) !== null) dosages.push(dm[0].trim());
  for (const [abbr, full] of Object.entries(PRESCRIPTION_ABBREVIATIONS)) {
    if (full.includes('daily') || full.includes('times') || full.includes('hours') || full.includes('bedtime') || full.includes('needed')) {
      if (new RegExp(`\\b${abbr}\\b`, 'gi').test(text)) frequencies.push(full);
    }
  }
  return { drugs: [...new Set(drugs)], dosages: [...new Set(dosages)], frequencies: [...new Set(frequencies)] };
}

// ─────────────────────────────────────────────
// Gemini Multi-Model Retry
// ─────────────────────────────────────────────

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];
const PERMANENTLY_UNAVAILABLE = new Set();

function parseGeminiModels() {
  const configured = process.env.VITE_GEMINI_MODELS;
  if (!configured) return DEFAULT_MODELS;
  const parsed = configured.split(',').map(m => m.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_MODELS;
}

function isRetryableError(msg) {
  const lower = msg.toLowerCase();
  return lower.includes('429') || lower.includes('quota') || lower.includes('503') ||
    lower.includes('500') || lower.includes('overloaded') || lower.includes('high demand') ||
    lower.includes('temporarily unavailable') || lower.includes('timeout');
}

export async function callGeminiWithRetry(genAI, parts, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 60000;
  const models = parseGeminiModels();
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const modelsToTry = models.filter(m => !PERMANENTLY_UNAVAILABLE.has(m));
    const active = modelsToTry.length > 0 ? modelsToTry : models;

    for (const modelName of active) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const resultPromise = model.generateContent(parts);
        const result = await Promise.race([
          resultPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini timeout after ${timeoutMs}ms`)), timeoutMs))
        ]);
        console.log(`[Ensemble] ✅ Gemini model "${modelName}" succeeded`);
        return result;
      } catch (error) {
        lastError = error;
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes('404')) {
          PERMANENTLY_UNAVAILABLE.add(modelName);
          console.warn(`[Ensemble] Model "${modelName}" returned 404 — trying next...`);
          continue;
        }
        if (isRetryableError(errMsg)) {
          console.warn(`[Ensemble] Model "${modelName}" overloaded — trying next...`);
          continue;
        }
        throw error;
      }
    }

    if (attempt < maxRetries) {
      const waitMs = Math.min(15000, 5000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
      console.log(`[Ensemble] All models failed, retrying in ${waitMs}ms (attempt ${attempt+1}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastError || new Error('All Gemini models failed');
}

// ─────────────────────────────────────────────
// Weighted Voting & Candidate Merging
// ─────────────────────────────────────────────

const MODEL_WEIGHTS = { donut: 0.40, regex: 0.25, gemini: 0.35 };
const AGREEMENT_BONUS = { 3: 1.30, 2: 1.15, 1: 1.00 };

export function mergeCandidates(candidates) {
  const groups = new Map();
  for (const c of candidates) {
    const norm = normalizeDrugName(c.drugName);
    let matched = false;
    for (const [key, group] of groups) {
      if (isSameDrug(norm, key)) { group.push({ ...c, normalizedName: norm }); matched = true; break; }
    }
    if (!matched) groups.set(norm, [{ ...c, normalizedName: norm }]);
  }

  const results = [];
  for (const group of groups.values()) {
    const sources = [...new Set(group.map(c => c.source))];
    const best = pickBestCandidate(group);
    let weightedConf = 0, totalWeight = 0;
    const sourceDetails = {};
    for (const c of group) {
      const w = MODEL_WEIGHTS[c.source] || 0.25;
      weightedConf += c.confidence * w;
      totalWeight += w;
      sourceDetails[c.source] = { confidence: c.confidence };
    }
    const baseConf = totalWeight > 0 ? weightedConf / totalWeight : 0;
    const bonus = AGREEMENT_BONUS[Math.min(sources.length, 3)] || 1;
    const finalConf = Math.min(0.99, baseConf * bonus);

    if (finalConf < 0.10) continue;
    if (finalConf < 0.20 && sources.length === 1 && sources[0] === 'donut') continue;

    results.push({
      drugName: best.drugName, dosage: best.dosage, frequency: best.frequency,
      confidence: finalConf, sources, sourceDetails,
    });
  }
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

function pickBestCandidate(group) {
  for (const c of group) {
    const m = findDrugMatch(c.drugName);
    if (m && m.confidence > 0.8) return { ...c, drugName: m.drug.name };
  }
  const priority = ['gemini', 'donut', 'regex'];
  for (const src of priority) {
    const c = group.find(g => g.source === src);
    if (c) return c;
  }
  return group.sort((a, b) => b.confidence - a.confidence)[0];
}

// ─────────────────────────────────────────────
// Full Gemini Prompt (matches web app)
// ─────────────────────────────────────────────

export const GEMINI_PROMPT = `You are a clinical pharmacist AI assistant. Analyze the following prescription and return a JSON object with the extracted medications.

CRITICAL RULES:
- Extract EVERY medication/drug name you see, even if you do not recognize it.
- Include brand names, generic names, and local/regional drug names.
- NEVER use the word "Missing", "N/A", "Unknown", or "Not specified" as values. Use an empty string "" instead.
- If dosage or frequency is not written on the prescription, use "" (empty string).
- Items prefixed with "G." or "Rx" are medications — always include them.

INSTRUCTIONS:
1. If an image is provided, read ALL text from the prescription image first
2. Identify EVERY medication mentioned — do NOT skip any, even if unfamiliar
3. For each medication, extract: drugName, dosage, frequency, route
4. Correct any obvious OCR errors in drug names (e.g., "Llsinopril" → "Lisinopril")
5. Expand any abbreviations (BID → twice daily, QD → once daily, PO → by mouth)
6. If dosage/frequency is not present on the prescription, use empty string ""
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
