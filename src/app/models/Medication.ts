export class Medication {
  drugName: string;
  dosage: string;
  frequency: string;

  constructor(drugName: string, dosage: string, frequency: string) {
    this.drugName = drugName;
    this.dosage = dosage;
    this.frequency = frequency;
  }

  toString(): string {
    return `${this.drugName} - ${this.dosage}, ${this.frequency}`;
  }
}
