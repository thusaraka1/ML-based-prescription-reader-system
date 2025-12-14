import { Alert, SeverityLevel } from './Alert';
import { Resident } from './Resident';
import { Medication } from './Medication';
import { EmotionalState } from './EmotionalState';

export class RecommendationEngine {
  private alertCounter: number = 0;

  generateAlert(
    severityLevel: SeverityLevel,
    message: string
  ): Alert {
    this.alertCounter++;
    const alert = new Alert(
      `ALERT-${Date.now()}-${this.alertCounter}`,
      severityLevel,
      message
    );
    alert.notifyCaretaker();
    return alert;
  }

  analyzeResident(resident: Resident): Alert[] {
    const alerts: Alert[] = [];

    // Check emotional state
    const latestState = resident.getLatestEmotionalState();
    if (latestState) {
      if (latestState.stateScore < 20) {
        alerts.push(
          this.generateAlert(
            'critical',
            `${resident.name} is showing critical emotional distress (score: ${latestState.stateScore}). Immediate attention required.`
          )
        );
      } else if (latestState.stateScore < 40) {
        alerts.push(
          this.generateAlert(
            'high',
            `${resident.name}'s emotional state is poor (score: ${latestState.stateScore}). Consider wellness check.`
          )
        );
      } else if (latestState.stateScore < 60) {
        alerts.push(
          this.generateAlert(
            'medium',
            `${resident.name}'s emotional state is fair (score: ${latestState.stateScore}). Monitor closely.`
          )
        );
      }
    }

    // Check medication count
    const medications = resident.getAllMedications();
    if (medications.length >= 5) {
      alerts.push(
        this.generateAlert(
          'medium',
          `${resident.name} is on ${medications.length} medications. Review for potential drug interactions.`
        )
      );
    }

    // Check for multiple prescriptions from different doctors
    const doctors = new Set(resident.prescriptions.map(p => p.doctorName));
    if (doctors.size > 2) {
      alerts.push(
        this.generateAlert(
          'medium',
          `${resident.name} has prescriptions from ${doctors.size} different doctors. Coordinate care plan.`
        )
      );
    }

    // Check medication compliance patterns
    if (medications.length > 0) {
      const complexMedications = medications.filter(m => 
        m.frequency.includes('times') || m.frequency.includes('twice')
      );
      
      if (complexMedications.length >= 3) {
        alerts.push(
          this.generateAlert(
            'low',
            `${resident.name} has ${complexMedications.length} medications with complex schedules. Consider medication management support.`
          )
        );
      }
    }

    // Positive feedback
    if (latestState && latestState.stateScore >= 80 && medications.length > 0) {
      alerts.push(
        this.generateAlert(
          'low',
          `${resident.name} is showing excellent emotional health despite medication regimen. Continue current care plan.`
        )
      );
    }

    return alerts;
  }

  analyzeAllResidents(residents: Resident[]): Alert[] {
    const allAlerts: Alert[] = [];
    
    residents.forEach(resident => {
      const residentAlerts = this.analyzeResident(resident);
      allAlerts.push(...residentAlerts);
    });

    return allAlerts;
  }
}
