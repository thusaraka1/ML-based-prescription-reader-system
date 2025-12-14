import { Medication } from './Medication';

export class NLPEngine {
  modelVersion: string;

  constructor(modelVersion: string) {
    this.modelVersion = modelVersion;
  }

  parseTextToMedication(extractedText: string): Medication[] {
    // Mock NLP processing
    // In a real system, this would use NLP techniques to parse medication details
    console.log(`NLP Engine v${this.modelVersion} parsing text...`);
    
    const medications: Medication[] = [];
    const lines = extractedText.split('\n').filter(line => line.trim());
    
    // Simple pattern matching for demonstration
    lines.forEach(line => {
      const medicationPattern = /(\w+)\s+(\d+mg)\s+(.*)/i;
      const match = line.match(medicationPattern);
      
      if (match) {
        const [, drugName, dosage, frequency] = match;
        medications.push(new Medication(drugName, dosage, frequency));
      }
    });
    
    // If pattern matching fails, return mock data
    if (medications.length === 0) {
      medications.push(
        new Medication('Lisinopril', '10mg', 'once daily'),
        new Medication('Metformin', '500mg', 'twice daily'),
        new Medication('Atorvastatin', '20mg', 'once daily at bedtime')
      );
    }
    
    return medications;
  }
}
