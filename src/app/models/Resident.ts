import { Prescription } from './Prescription';
import { EmotionalState } from './EmotionalState';

export interface PersonalDetails {
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  children?: string[];
  roomNumber?: string;
  floorNumber?: string;
  admissionDate?: Date;
  medicalHistory?: string;
  allergies?: string[];
}

export class Resident {
  residentId: string;
  name: string;
  age: number;
  prescriptions: Prescription[];
  emotionalStates: EmotionalState[];
  personalDetails: PersonalDetails;

  constructor(residentId: string, name: string, age: number) {
    this.residentId = residentId;
    this.name = name;
    this.age = age;
    this.prescriptions = [];
    this.emotionalStates = [];
    this.personalDetails = {};
  }

  updatePersonalDetails(details: Partial<PersonalDetails>): void {
    this.personalDetails = { ...this.personalDetails, ...details };
  }

  addPrescription(prescription: Prescription): void {
    this.prescriptions.push(prescription);
  }

  removePrescription(prescriptionId: string): void {
    // Remove prescription (this will also delete all associated medications due to composition)
    this.prescriptions = this.prescriptions.filter(p => p.prescriptionId !== prescriptionId);
  }

  addEmotionalState(state: EmotionalState): void {
    this.emotionalStates.push(state);
  }

  getLatestEmotionalState(): EmotionalState | null {
    if (this.emotionalStates.length === 0) return null;
    return this.emotionalStates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
  }

  getAllMedications() {
    return this.prescriptions.flatMap(p => p.medications);
  }
}