export class Medication {
  id?: number;
  drugName: string;
  dosage: string;
  frequency: string;

  constructor(drugName: string, dosage: string, frequency: string, id?: number) {
    this.id = id;
    this.drugName = drugName;
    this.dosage = dosage;
    this.frequency = frequency;
  }

  toString(): string {
    return `${this.drugName} - ${this.dosage}, ${this.frequency}`;
  }
}
