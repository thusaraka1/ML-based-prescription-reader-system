// Analyze API route — Full Ensemble Mode (Donut + Regex + Gemini)
// Matches the web app's EnsembleOrchestrator pipeline exactly.
import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  parseMedications,
  extractEntities,
  callGeminiWithRetry,
  mergeCandidates,
  GEMINI_PROMPT,
} from './ensemble.js';

const router = Router();

// Configure Gemini
let genAI = null;
if (process.env.VITE_GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
  console.log('✅ Gemini API initialized for ensemble analysis');
} else {
  console.warn('⚠️  VITE_GEMINI_API_KEY not set — Gemini will be unavailable in ensemble');
}

const DONUT_URL = (process.env.VITE_DONUT_API_URL || 'http://localhost:8000') + '/api/predict-base64';
const DONUT_TIMEOUT_MS = Number(process.env.VITE_ENSEMBLE_DONUT_TIMEOUT_MS || 180000);
const GEMINI_TIMEOUT_MS = Number(process.env.VITE_ENSEMBLE_GEMINI_TIMEOUT_MS || 120000);

router.post('/analyze-prescription', async (req, res) => {
  const startTime = Date.now();
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    console.log('[Ensemble] 🚀 Starting prescription analysis...');

    const candidates = [];
    const sourcesUsed = [];
    const corrections = [];
    const timings = {};
    let donutRawText = '';
    let geminiRawText = '';

    // ── Task 1: Donut (custom ML model) ──
    const donutTask = (async () => {
      const t0 = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DONUT_TIMEOUT_MS);
        const r = await fetch(DONUT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!r.ok) throw new Error(`Donut HTTP ${r.status}`);
        const result = await r.json();
        timings.donutMs = Date.now() - t0;
        donutRawText = result.raw_text || '';

        // Direct structured medications
        if (result.medications && result.medications.length > 0) {
          sourcesUsed.push('donut');
          return result.medications.map(m => ({
            drugName: m.drugName || m.drug_name || m.name,
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            confidence: m.confidence || 0.7,
            source: 'donut',
          }));
        }

        // Fallback: parse Donut raw text with regex
        if (result.raw_text) {
          const fallback = parseMedications(result.raw_text);
          if (fallback.length > 0) {
            console.log(`[Ensemble] Donut fallback parser recovered ${fallback.length} medication(s)`);
            sourcesUsed.push('donut');
            return fallback.map(r => ({
              drugName: r.drugName, dosage: r.dosage, frequency: r.frequency,
              confidence: Math.max(0.45, Math.min(0.75, r.confidence * 0.9)),
              source: 'donut',
            }));
          }

          // Last-resort: entity extraction
          const entities = extractEntities(result.raw_text);
          if (entities.drugs.length > 0) {
            console.log(`[Ensemble] Donut entity recovery found ${entities.drugs.length} drug(s)`);
            sourcesUsed.push('donut');
            return entities.drugs.map((drug, idx) => ({
              drugName: drug,
              dosage: entities.dosages[idx] || entities.dosages[0] || '',
              frequency: entities.frequencies[idx] || entities.frequencies[0] || 'as directed',
              confidence: 0.42,
              source: 'donut',
            }));
          }
        }
        return [];
      } catch (err) {
        timings.donutMs = Date.now() - t0;
        console.warn('[Ensemble] Donut failed:', err.message);
        return [];
      }
    })();

    // ── Task 2: Regex Parser (runs on Donut raw text once available) ──
    const regexTask = donutTask.then(donutCandidates => {
      const t0 = Date.now();
      try {
        // Use donut raw text for regex parsing (if available)
        const textToParse = donutRawText;
        if (!textToParse || textToParse.trim().length < 5) {
          timings.regexMs = Date.now() - t0;
          return { donutCandidates, regexCandidates: [] };
        }
        const results = parseMedications(textToParse);
        timings.regexMs = Date.now() - t0;
        if (results.length > 0) sourcesUsed.push('regex');
        const regexCandidates = results.map(r => ({
          drugName: r.drugName, dosage: r.dosage, frequency: r.frequency,
          confidence: r.confidence, source: 'regex',
        }));
        return { donutCandidates, regexCandidates };
      } catch (err) {
        timings.regexMs = Date.now() - t0;
        console.warn('[Ensemble] Regex failed:', err.message);
        return { donutCandidates, regexCandidates: [] };
      }
    });

    // ── Task 3: Gemini (cloud AI with multi-model retry) ──
    const geminiTask = (async () => {
      if (!genAI) return [];
      const t0 = Date.now();
      try {
        let cleanBase64 = image;
        const dataUrlMatch = image.match(/^data:([^;]+);base64,(.+)$/);
        if (dataUrlMatch) {
          cleanBase64 = dataUrlMatch[2];
        } else {
          cleanBase64 = image.replace(/^data:[^;]+;base64,/, '');
        }

        const parts = [
          { text: GEMINI_PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
        ];

        const result = await callGeminiWithRetry(genAI, parts, {
          maxRetries: 2,
          timeoutMs: GEMINI_TIMEOUT_MS,
        });

        timings.geminiMs = Date.now() - t0;
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const parsed = JSON.parse(jsonMatch[0]);
        geminiRawText = parsed.rawText || '';
        if (parsed.corrections?.length > 0) corrections.push(...parsed.corrections);

        if (parsed.medications?.length > 0) {
          sourcesUsed.push('gemini');
          // Clean up Gemini's tendency to return "Missing"/"N/A" for empty fields
          const cleanField = (v) => {
            if (!v || typeof v !== 'string') return '';
            const lower = v.trim().toLowerCase();
            if (['missing', 'n/a', 'unknown', 'not specified', 'not available', 'none', '-'].includes(lower)) return '';
            return v.trim();
          };
          return parsed.medications.map(m => ({
            drugName: m.drugName, dosage: cleanField(m.dosage),
            frequency: cleanField(m.frequency), confidence: m.confidence || 0.9,
            source: 'gemini',
          }));
        }
        return [];
      } catch (err) {
        timings.geminiMs = Date.now() - t0;
        console.error('[Ensemble] Gemini failed:', err.message);
        return [];
      }
    })();

    // ── Run all tasks in parallel (regex depends on donut) ──
    const [regexResult, geminiCandidates] = await Promise.all([regexTask, geminiTask]);
    const { donutCandidates, regexCandidates } = regexResult;

    candidates.push(...donutCandidates, ...regexCandidates, ...geminiCandidates);

    // ── Merge with weighted voting ──
    const mergedMedications = mergeCandidates(candidates);

    const rawText = geminiRawText || donutRawText || '';
    const totalMs = Date.now() - startTime;

    // Log structured summary
    console.log(
      `[Ensemble] ── Results (${totalMs}ms) ──\n` +
      `  Donut: ${donutCandidates.length} meds (${timings.donutMs || 'n/a'}ms)\n` +
      `  Regex: ${regexCandidates.length} meds (${timings.regexMs || 'n/a'}ms)\n` +
      `  Gemini: ${geminiCandidates.length} meds (${timings.geminiMs || 'n/a'}ms)\n` +
      `  ✅ Final: ${mergedMedications.length} merged medications from [${sourcesUsed.join(', ')}]`
    );

    res.json({
      raw_text: rawText,
      medications: mergedMedications,
      ensemble_sources: {
        donut_used: sourcesUsed.includes('donut'),
        regex_used: sourcesUsed.includes('regex'),
        gemini_used: sourcesUsed.includes('gemini'),
        sources: [...new Set(sourcesUsed)],
      },
      corrections,
      timings: { ...timings, totalMs },
    });

  } catch (err) {
    console.error('[Analyze] Error:', err);
    res.status(500).json({ error: 'Failed to analyze prescription' });
  }
});

export default router;
