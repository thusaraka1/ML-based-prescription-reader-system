/**
 * Medication Parser
 * Advanced regex-based medication extraction from OCR text.
 * Uses multi-pattern matching and RxNorm dictionary fuzzy matching.
 */

import { Medication } from '../../models/Medication';
import { findDrugMatch, expandAbbreviation, PRESCRIPTION_ABBREVIATIONS } from './rxnormDictionary';

export interface ParsedMedication {
  medication: Medication;
  confidence: number;
  matchedDrugClass?: string;
  rawMatch: string;
}

/**
 * Regex patterns for common prescription formats.
 * Each handles different ways doctors write prescriptions.
 */
const MEDICATION_PATTERNS = [
  // "1. Lisinopril 10mg once daily"
  /(?:^|\n)\s*(?:\d+[.)]\s*)?([A-Za-z][\w\s-]*?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s*(.*?)(?=\n|$)/gi,
  
  // "Lisinopril 10 mg PO QD"
  /([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s+(?:PO|IM|IV|SC|INH|TOP|SL)?\s*(BID|TID|QID|QD|OD|PRN|HS|Q\d+H|QAM|QPM|QWK|once\s+daily|twice\s+daily|three\s+times\s+daily|four\s+times\s+daily|at\s+bedtime|as\s+needed|every\s+\d+\s+hours?)(?:\s|$)/gi,
  
  // "Tab. Metformin 500mg 1-0-1" (South Asian format)
  /(?:Tab\.?|Cap\.?|Inj\.?|Syp\.?)\s+([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)\s*([\d-]+(?:\s*[-x]\s*[\d-]+)*(?:\s*(?:before|after|with)\s+(?:meals?|food|breakfast|lunch|dinner))?)/gi,
  
  // "Rx: Atorvastatin 20mg"
  /(?:Rx:?\s*)?([A-Za-z][\w-]*(?:\s+[\w-]+)?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|IU|mEq)(?:\s+(.*?))?(?=\n|$)/gi,
];

/**
 * South Asian dosing format decoder (e.g., "1-0-1" means morning-afternoon-night).
 */
function decodeDoseSchedule(schedule: string): string {
  const match = schedule.match(/^(\d)-(\d)-(\d)$/);
  if (match) {
    const [, morning, afternoon, night] = match;
    const parts: string[] = [];
    if (morning !== '0') parts.push(`${morning} in the morning`);
    if (afternoon !== '0') parts.push(`${afternoon} in the afternoon`);
    if (night !== '0') parts.push(`${night} at night`);
    return parts.join(', ') || 'as directed';
  }
  return schedule;
}

/**
 * Clean and normalize a frequency string by expanding abbreviations.
 */
function normalizeFrequency(raw: string): string {
  let normalized = raw.trim();
  
  // First try to decode South Asian format
  if (/^\d-\d-\d$/.test(normalized)) {
    return decodeDoseSchedule(normalized);
  }
  
  // Expand known abbreviations
  const words = normalized.split(/\s+/);
  const expanded = words.map(word => {
    const lower = word.toLowerCase().replace(/[.,;:]/g, '');
    return PRESCRIPTION_ABBREVIATIONS[lower] || word;
  });
  
  return expanded.join(' ') || 'as directed';
}

/**
 * Parse raw OCR text into structured medication entries.
 * Tries all patterns and deduplicates results.
 */
export function parseMedications(ocrText: string): ParsedMedication[] {
  const results: ParsedMedication[] = [];
  const seenDrugs = new Set<string>();

  for (const pattern of MEDICATION_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(ocrText)) !== null) {
      const rawDrugName = match[1].trim();
      const dosageAmount = match[2];
      const dosageUnit = match[3];
      const rawFrequency = match[4] || '';

      // Skip overly short matches or noise
      if (rawDrugName.length < 3) continue;

      // Fuzzy match against RxNorm dictionary
      const drugMatch = findDrugMatch(rawDrugName);
      const drugName = drugMatch ? drugMatch.drug.name : rawDrugName;
      const confidence = drugMatch ? drugMatch.confidence : 0.3;
      const drugClass = drugMatch?.drug.drugClass;

      // Deduplicate
      const key = `${drugName.toLowerCase()}-${dosageAmount}${dosageUnit}`;
      if (seenDrugs.has(key)) continue;
      seenDrugs.add(key);

      const dosage = `${dosageAmount}${dosageUnit}`;
      const frequency = normalizeFrequency(rawFrequency);

      results.push({
        medication: new Medication(drugName, dosage, frequency),
        confidence,
        matchedDrugClass: drugClass,
        rawMatch: match[0].trim(),
      });
    }
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}

/**
 * Extract all potential medication-related entities from text,
 * including drugs, dosages, and frequencies, even if they're not
 * in a standard prescription format.
 */
export function extractEntities(text: string): {
  drugs: string[];
  dosages: string[];
  frequencies: string[];
} {
  const drugs: string[] = [];
  const dosages: string[] = [];
  const frequencies: string[] = [];

  // Extract drug names via dictionary matching
  const words = text.split(/[\s,;:]+/);
  for (const word of words) {
    const match = findDrugMatch(word, 2);
    if (match) {
      drugs.push(match.drug.name);
    }
  }

  // Extract dosages
  const dosagePattern = /\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|IU|mEq)/gi;
  let dosageMatch: RegExpExecArray | null;
  while ((dosageMatch = dosagePattern.exec(text)) !== null) {
    dosages.push(dosageMatch[0].trim());
  }

  // Extract frequencies
  const freqTerms = Object.keys(PRESCRIPTION_ABBREVIATIONS).filter(k => {
    const category = expandAbbreviation(k);
    return category.includes('daily') || category.includes('times') ||
           category.includes('hours') || category.includes('bedtime') ||
           category.includes('needed') || category.includes('meals') ||
           category.includes('weekly');
  });

  for (const term of freqTerms) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    if (regex.test(text)) {
      frequencies.push(expandAbbreviation(term));
    }
  }

  return {
    drugs: [...new Set(drugs)],
    dosages: [...new Set(dosages)],
    frequencies: [...new Set(frequencies)],
  };
}
