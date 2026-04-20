export class EmotionalState {
  timestamp: Date;
  stateScore: number; // Range: 0-100 (0 = very negative, 100 = very positive)

  constructor(timestamp: Date, stateScore: number) {
    this.timestamp = timestamp;
    this.stateScore = stateScore;
  }

  getEmotionalLevel(): string {
    if (this.stateScore >= 80) return 'Excellent';
    if (this.stateScore >= 60) return 'Good';
    if (this.stateScore >= 40) return 'Fair';
    if (this.stateScore >= 20) return 'Poor';
    return 'Critical';
  }

  getColor(): string {
    if (this.stateScore >= 80) return 'green';
    if (this.stateScore >= 60) return 'blue';
    if (this.stateScore >= 40) return 'yellow';
    if (this.stateScore >= 20) return 'orange';
    return 'red';
  }
}
