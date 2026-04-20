export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export class Alert {
  alertId: string;
  severityLevel: SeverityLevel;
  message: string;
  timestamp: Date;
  acknowledged: boolean;

  constructor(alertId: string, severityLevel: SeverityLevel, message: string) {
    this.alertId = alertId;
    this.severityLevel = severityLevel;
    this.message = message;
    this.timestamp = new Date();
    this.acknowledged = false;
  }

  notifyCaretaker(): void {
    // In a real system, this would send notifications via email, SMS, push notification, etc.
    console.log(`🔔 ALERT [${this.severityLevel.toUpperCase()}]: ${this.message}`);
    console.log(`   Timestamp: ${this.timestamp.toLocaleString()}`);
  }

  acknowledge(): void {
    this.acknowledged = true;
  }

  getSeverityColor(): string {
    switch (this.severityLevel) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'blue';
      default: return 'gray';
    }
  }
}
