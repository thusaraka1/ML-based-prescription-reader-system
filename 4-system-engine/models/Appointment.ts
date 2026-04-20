export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export class Appointment {
  appointmentId: string;
  residentId: string;
  residentName: string;
  doctorName: string;
  specialization: string;
  appointmentDate: Date;
  appointmentTime: string;
  reason: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;

  constructor(
    appointmentId: string,
    residentId: string,
    residentName: string,
    doctorName: string,
    specialization: string,
    appointmentDate: Date,
    appointmentTime: string,
    reason: string
  ) {
    this.appointmentId = appointmentId;
    this.residentId = residentId;
    this.residentName = residentName;
    this.doctorName = doctorName;
    this.specialization = specialization;
    this.appointmentDate = appointmentDate;
    this.appointmentTime = appointmentTime;
    this.reason = reason;
    this.status = 'scheduled';
    this.createdAt = new Date();
  }

  cancel(): void {
    this.status = 'cancelled';
  }

  complete(notes?: string): void {
    this.status = 'completed';
    this.notes = notes;
  }

  reschedule(newDate: Date, newTime: string): void {
    this.appointmentDate = newDate;
    this.appointmentTime = newTime;
    this.status = 'rescheduled';
  }
}
