export class EmergencyAlert {
  alertId: string;
  caretakerId: string;
  caretakerName: string;
  message: string;
  location?: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;

  constructor(
    alertId: string,
    caretakerId: string,
    caretakerName: string,
    message: string,
    location?: string
  ) {
    this.alertId = alertId;
    this.caretakerId = caretakerId;
    this.caretakerName = caretakerName;
    this.message = message;
    this.location = location;
    this.timestamp = new Date();
    this.acknowledged = false;
  }

  acknowledge(adminName: string): void {
    this.acknowledged = true;
    this.acknowledgedBy = adminName;
    this.acknowledgedAt = new Date();
  }
}
