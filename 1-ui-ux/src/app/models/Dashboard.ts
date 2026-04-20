import { Resident } from './Resident';
import { Alert } from './Alert';
import { RecommendationEngine } from './RecommendationEngine';
import { OCREngine } from './OCREngine';
import { NLPEngine, NLPResult } from './NLPEngine';
import { EmotionAnalysisEngine, EmotionAnalysisResult } from './EmotionAnalysisEngine';
import { Caretaker, LeaveRequest } from './Caretaker';
import { EmergencyAlert } from './EmergencyAlert';
import { SystemComponent } from './SystemComponent';
import { Appointment } from './Appointment';
import { Prescription } from './Prescription';
import { Medication } from './Medication';
import { FinishedMedicationRecord } from './Resident';
import { generateMealPlan, regenerateMeal, clearMealPlanCache, MealPlanRequest } from '../ml/meal-plan/MealPlanEngine';
import { WeeklyMealPlan, MealItem } from '../ml/meal-plan/MealPlan';
import { datasetCollector } from '../ml/dataset/DatasetCollector';
import { uploadPrescriptionImage } from '../services/storageService';
import { prescriptionsApi, emotionsApi } from '../services/apiService';
import { pushEmotionUpdate } from '../services/firestoreService';

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

    // Load any saved dataset annotations
    datasetCollector.loadFromLocalStorage();
  }

  /**
   * Initialize all ML engines (lazy model loading).
   */
  async initializeEngines(): Promise<void> {
    await Promise.allSettled([
      this.ocrEngine.initialize(),
      this.emotionAnalysisEngine.initialize(),
    ]);
    console.log('Dashboard: ML engines initialized');
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

  /**
   * Mark a medication as finished for a resident/prescription.
   * Removes it from DB first, then updates in-memory state.
   */
  async finishMedication(
    residentId: string,
    prescriptionId: string,
    medication: Medication
  ): Promise<FinishedMedicationRecord | null> {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return null;
    }

    const prescription = resident.prescriptions.find(p => p.prescriptionId === prescriptionId);
    if (!prescription) {
      console.error('Prescription not found');
      return null;
    }

    let finishedMedication: FinishedMedicationRecord;

    try {
      const response = await prescriptionsApi.finishMedication(prescriptionId, {
        medicationId: medication.id,
        drugName: medication.drugName,
        dosage: medication.dosage,
        frequency: medication.frequency,
      });

      finishedMedication = {
        id: response.finishedMedication.id,
        residentId: response.finishedMedication.residentId,
        prescriptionId: response.finishedMedication.prescriptionId,
        drugName: response.finishedMedication.drugName,
        dosage: response.finishedMedication.dosage,
        frequency: response.finishedMedication.frequency,
        finishedAt: new Date(response.finishedMedication.finishedAt),
      };
    } catch (err) {
      console.warn('⚠️ Failed to mark medication as finished in MySQL:', err);
      return null;
    }

    if (medication.id) {
      prescription.medications = prescription.medications.filter(m => m.id !== medication.id);
    } else {
      const idx = prescription.medications.findIndex(
        m =>
          m.drugName === medication.drugName &&
          m.dosage === medication.dosage &&
          m.frequency === medication.frequency
      );
      if (idx >= 0) {
        prescription.medications.splice(idx, 1);
      }
    }

    if (prescription.medications.length === 0) {
      resident.removePrescription(prescriptionId);
    }

    resident.addFinishedMedication(finishedMedication);

    return finishedMedication;
  }

  /**
   * Persist medications already extracted/verified by the upload modal.
   * This avoids rerunning OCR/NLP after the user confirms AI results.
   */
  async saveProcessedPrescription(
    residentId: string,
    doctorName: string,
    medications: Medication[],
    imageFile?: File | null
  ): Promise<boolean> {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return false;
    }

    if (!medications.length) {
      console.warn('No medications provided for save');
      return false;
    }

    // Step 1: Upload image to Firebase Storage (best effort)
    let imageUrl: string | undefined;
    try {
      if (imageFile) {
        const uploadResult = await uploadPrescriptionImage(imageFile, residentId);
        imageUrl = uploadResult.url;
        console.log(`✓ Image uploaded to Firebase Storage`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Upload skipped in local dev')) {
        console.info('ℹ️ Firebase Storage upload skipped in local dev (continuing with DB save)');
      } else {
        console.warn('⚠️ Image upload to Firebase Storage failed (continuing):', err);
      }
    }

    // Step 2: Create prescription and add medications (in-memory)
    const prescriptionId = `RX-${Date.now()}`;
    const prescription = new Prescription(
      prescriptionId,
      new Date(),
      doctorName
    );

    medications.forEach(med => prescription.addMedication(med));
    resident.addPrescription(prescription);

    // Step 3: Save prescription + medications to MySQL
    let dbSaved = true;
    try {
      await prescriptionsApi.create({
        prescriptionId,
        residentId,
        dateIssued: new Date().toISOString().split('T')[0],
        doctorName,
        imageUrl,
        medications: medications.map(m => ({
          drugName: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
        })),
      });
      console.log(`✓ Prescription saved to MySQL`);
    } catch (err) {
      console.warn('⚠️ MySQL save failed (data is still in-memory):', err);
      dbSaved = false;
    }

    // Step 4: Record for dataset collection (best effort)
    try {
      await datasetCollector.record(
        imageFile || null,
        '',
        medications.map(m => ({
          drugName: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
          wasCorreted: false,
        })),
        1,
        this.ocrEngine.modelVersion,
        imageFile ? 'upload' : 'camera'
      );
    } catch (err) {
      console.warn('⚠️ Dataset record failed (continuing):', err);
    }

    if (dbSaved) {
      console.log(`✓ Confirmed prescription saved for ${resident.name}`);
      console.log(`  ${medications.length} medications stored`);
    } else {
      console.warn(`⚠️ Prescription stored in-memory only for ${resident.name}; DB write failed`);
    }

    return dbSaved;
  }

  /**
   * Process a prescription image using real CRNN OCR + NLP pipeline.
   * Returns the NLP result with confidence scores.
   * Now also persists to Firebase Storage (image) and MySQL (prescription data).
   */
  async processPrescriptionImage(
    residentId: string,
    imageSource: File | string,
    doctorName: string
  ): Promise<NLPResult | null> {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return null;
    }

    // Step 1: OCR extracts text from image
    const ocrResult = await this.ocrEngine.extractText(imageSource);
    console.log(`✓ OCR complete: ${ocrResult.lines.length} lines, ${(ocrResult.confidence * 100).toFixed(0)}% confidence`);

    // Step 2: NLP parses text to create medications
    const imageBase64 = imageSource instanceof File ? undefined : imageSource;
    const nlpResult = await this.nlpEngine.parseTextToMedication(ocrResult.text, imageBase64, imageSource);
    console.log(`✓ NLP complete: ${nlpResult.medications.length} medications, source: ${nlpResult.source}`);

    // Step 3: Upload image to Firebase Storage
    let imageUrl: string | undefined;
    let imagePath: string | undefined;
    try {
      if (imageSource instanceof File) {
        const uploadResult = await uploadPrescriptionImage(imageSource, residentId);
        imageUrl = uploadResult.url;
        imagePath = uploadResult.path;
        console.log(`✓ Image uploaded to Firebase Storage`);
      }
    } catch (err) {
      console.warn('⚠️ Image upload to Firebase Storage failed (continuing):', err);
    }

    // Step 4: Create prescription and add medications (in-memory)
    const prescriptionId = `RX-${Date.now()}`;
    const prescription = new Prescription(
      prescriptionId,
      new Date(),
      doctorName
    );

    nlpResult.medications.forEach(med => prescription.addMedication(med));
    resident.addPrescription(prescription);

    // Step 5: Save prescription + medications to MySQL
    try {
      await prescriptionsApi.create({
        prescriptionId,
        residentId,
        dateIssued: new Date().toISOString().split('T')[0],
        doctorName,
        imageUrl,
        medications: nlpResult.medications.map(m => ({
          drugName: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
        })),
      });
      console.log(`✓ Prescription saved to MySQL`);
    } catch (err) {
      console.warn('⚠️ MySQL save failed (data is still in-memory):', err);
    }

    // Step 6: Record for dataset collection
    await datasetCollector.record(
      imageSource instanceof File ? imageSource : null,
      ocrResult.text,
      nlpResult.medications.map(m => ({
        drugName: m.drugName,
        dosage: m.dosage,
        frequency: m.frequency,
        wasCorreted: false,
      })),
      ocrResult.confidence,
      this.ocrEngine.modelVersion,
      imageSource instanceof File ? 'upload' : 'camera'
    );

    console.log(`✓ Prescription processed for ${resident.name}`);
    console.log(`  ${nlpResult.medications.length} medications extracted`);

    return nlpResult;
  }

  /**
   * Analyze resident emotion using real face-api.js + vocal tone engines.
   * Now also persists to MySQL and pushes real-time update to Firestore.
   */
  async analyzeResidentEmotion(
    residentId: string,
    facialImage?: File | string,
    vocalAudio?: File
  ): Promise<EmotionAnalysisResult | null> {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return null;
    }

    const result = await this.emotionAnalysisEngine.analyzeResident(facialImage, vocalAudio);
    resident.addEmotionalState(result.emotionalState);

    // Save to MySQL
    try {
      await emotionsApi.record({
        residentId,
        stateScore: result.emotionalState.stateScore,
      });
    } catch (err) {
      console.warn('⚠️ Emotion save to MySQL failed:', err);
    }

    // Push real-time update to Firestore
    try {
      await pushEmotionUpdate({
        residentId,
        residentName: resident.name,
        stateScore: result.emotionalState.stateScore,
        emotionalLevel: result.emotionalState.getEmotionalLevel(),
      });
    } catch (err) {
      console.warn('⚠️ Firestore emotion update failed:', err);
    }

    console.log(`✓ Emotional analysis completed for ${resident.name}`);
    console.log(`  Score: ${result.emotionalState.stateScore} (${result.emotionalState.getEmotionalLevel()})`);
    if (result.dominantFacialEmotion) {
      console.log(`  Facial: ${result.dominantFacialEmotion}`);
    }
    if (result.dominantVocalTone) {
      console.log(`  Vocal: ${result.dominantVocalTone}`);
    }

    return result;
  }

  /**
   * Generate a Gemini-powered meal plan for a resident.
   */
  async generateMealPlan(residentId: string): Promise<WeeklyMealPlan | null> {
    const resident = this.getResident(residentId);
    if (!resident) {
      console.error('Resident not found');
      return null;
    }

    const medications = resident.getAllMedications();
    const request: MealPlanRequest = {
      residentId: resident.residentId,
      residentName: resident.name,
      age: resident.age,
      medications: medications.map(m => ({
        name: m.drugName,
        dosage: m.dosage,
        frequency: m.frequency,
      })),
      allergies: resident.personalDetails.allergies || [],
      medicalHistory: resident.personalDetails.medicalHistory || '',
      dietaryRestrictions: resident.personalDetails.dietaryRestrictions || [],
    };

    const plan = await generateMealPlan(request);
    resident.mealPlan = plan;

    console.log(`✓ Meal plan generated for ${resident.name} (${plan.days.length} days)`);
    return plan;
  }

  /**
   * Regenerate a single meal in a resident's plan.
   */
  async regenerateResidentMeal(
    residentId: string,
    dayIndex: number,
    mealType: 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner',
    reason?: string
  ): Promise<MealItem | null> {
    const resident = this.getResident(residentId);
    if (!resident?.mealPlan) {
      console.error('Resident or meal plan not found');
      return null;
    }

    const newMeal = await regenerateMeal(resident.mealPlan, dayIndex, mealType, reason);
    return newMeal;
  }

  /**
   * Clear a resident's cached meal plan.
   */
  clearResidentMealPlan(residentId: string): void {
    const resident = this.getResident(residentId);
    if (resident) {
      resident.mealPlan = undefined;
      clearMealPlanCache(residentId);
    }
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