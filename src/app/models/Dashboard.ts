import { Resident } from './Resident';
import { Alert } from './Alert';
import { RecommendationEngine } from './RecommendationEngine';
import { OCREngine } from './OCREngine';
import { NLPEngine } from './NLPEngine';
import { EmotionAnalysisEngine } from './EmotionAnalysisEngine';
import { Caretaker, LeaveRequest } from './Caretaker';
import { EmergencyAlert } from './EmergencyAlert';
import { SystemComponent } from './SystemComponent';
import { Appointment } from './Appointment';

export class Dashboard {
  residents: Resident[];
  alerts: Alert[];
  recommendationEngine: RecommendationEngine;
  ocrEngine: OCREngine;
  nlpEngine: NLPEngine;
  emotionAnalysisEngine: EmotionAnalysisEngine;
  caretakers: Caretaker[];
  emergencyAlerts: EmergencyAlert[];
  systemComponents: SystemComponent[];
  appointments: Appointment[];

  constructor() {
    this.residents = [];
    this.alerts = [];
    this.recommendationEngine = new RecommendationEngine();
    this.ocrEngine = new OCREngine('2.5.1');
    this.nlpEngine = new NLPEngine('3.1.0');
    this.emotionAnalysisEngine = new EmotionAnalysisEngine('1.8.2');
    this.caretakers = [];
    this.emergencyAlerts = [];
    this.systemComponents = [];
    this.appointments = [];
  }

  // Resident management
  addResident(resident: Resident): void {
    this.residents.push(resident);
  }

  removeResident(residentId: string): void {
    this.residents = this.residents.filter(r => r.residentId !== residentId);
  }

  getResident(residentId: string): Resident | undefined {
    return this.residents.find(r => r.residentId === residentId);
  }

  // Caretaker management
  addCaretaker(caretaker: Caretaker): void {
    this.caretakers.push(caretaker);
  }

  removeCaretaker(caretakerId: string): void {
    this.caretakers = this.caretakers.filter(c => c.caretakerId !== caretakerId);
  }

  getCaretaker(caretakerId: string): Caretaker | undefined {
    return this.caretakers.find(c => c.caretakerId === caretakerId);
  }

  // Emergency alerts
  addEmergencyAlert(alert: EmergencyAlert): void {
    this.emergencyAlerts.push(alert);
  }

  getActiveEmergencyAlerts(): EmergencyAlert[] {
    return this.emergencyAlerts.filter(a => !a.acknowledged);
  }

  // System components
  addSystemComponent(component: SystemComponent): void {
    this.systemComponents.push(component);
  }

  removeSystemComponent(componentId: string): void {
    this.systemComponents = this.systemComponents.filter(c => c.componentId !== componentId);
  }

  getSystemComponent(componentId: string): SystemComponent | undefined {
    return this.systemComponents.find(c => c.componentId === componentId);
  }

  // Appointments
  addAppointment(appointment: Appointment): void {
    this.appointments.push(appointment);
  }

  getAppointmentsForResident(residentId: string): Appointment[] {
    return this.appointments.filter(a => a.residentId === residentId);
  }

  getUpcomingAppointments(): Appointment[] {
    const now = new Date();
    return this.appointments.filter(a => 
      a.appointmentDate >= now && a.status === 'scheduled'
    );
  }

  // Leave requests
  getPendingLeaveRequests(): LeaveRequest[] {
    return this.caretakers.flatMap(c => c.getPendingLeaveRequests());
  }

  processPrescriptionImage(residentId: string, imageData: string, doctorName: string): void {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return;
    }

    // Step 1: OCR extracts text from image
    const extractedText = this.ocrEngine.extractText(imageData);

    // Step 2: NLP parses text to create medications
    const medications = this.nlpEngine.parseTextToMedication(extractedText);

    // Step 3: Create prescription and add medications
    const { Prescription } = require('./Prescription');
    const prescription = new Prescription(
      `RX-${Date.now()}`,
      new Date(),
      doctorName
    );

    medications.forEach(med => prescription.addMedication(med));
    resident.addPrescription(prescription);

    console.log(`✓ Prescription processed for ${resident.name}`);
    console.log(`  ${medications.length} medications extracted`);
  }

  analyzeResidentEmotion(residentId: string, facialImage?: string, vocalAudio?: string): void {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return;
    }

    const emotionalState = this.emotionAnalysisEngine.analyzeResident(facialImage, vocalAudio);
    resident.addEmotionalState(emotionalState);

    console.log(`✓ Emotional analysis completed for ${resident.name}`);
    console.log(`  Score: ${emotionalState.stateScore} (${emotionalState.getEmotionalLevel()})`);
  }

  refreshAlerts(): void {
    this.alerts = this.recommendationEngine.analyzeAllResidents(this.residents);
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  getCriticalAlerts(): Alert[] {
    return this.alerts.filter(a => !a.acknowledged && (a.severityLevel === 'critical' || a.severityLevel === 'high'));
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledge();
    }
  }
}