export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export class LeaveRequest {
  requestId: string;
  caretakerId: string;
  caretakerName: string;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  requestDate: Date;
  reviewedBy?: string;
  reviewDate?: Date;
  temporaryReplacement?: string;

  constructor(
    requestId: string,
    caretakerId: string,
    caretakerName: string,
    startDate: Date,
    endDate: Date,
    reason: string
  ) {
    this.requestId = requestId;
    this.caretakerId = caretakerId;
    this.caretakerName = caretakerName;
    this.startDate = startDate;
    this.endDate = endDate;
    this.numberOfDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    this.reason = reason;
    this.status = 'pending';
    this.requestDate = new Date();
  }

  approve(adminName: string, replacement?: string): void {
    this.status = 'approved';
    this.reviewedBy = adminName;
    this.reviewDate = new Date();
    this.temporaryReplacement = replacement;
  }

  reject(adminName: string): void {
    this.status = 'rejected';
    this.reviewedBy = adminName;
    this.reviewDate = new Date();
  }
}

export class Caretaker {
  caretakerId: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  dateJoined: Date;
  assignedResidents: string[]; // Array of resident IDs
  isActive: boolean;
  leaveRequests: LeaveRequest[];

  constructor(
    caretakerId: string,
    name: string,
    email: string,
    phone: string,
    specialization: string
  ) {
    this.caretakerId = caretakerId;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.specialization = specialization;
    this.dateJoined = new Date();
    this.assignedResidents = [];
    this.isActive = true;
    this.leaveRequests = [];
  }

  addLeaveRequest(request: LeaveRequest): void {
    this.leaveRequests.push(request);
  }

  getPendingLeaveRequests(): LeaveRequest[] {
    return this.leaveRequests.filter(r => r.status === 'pending');
  }
}
