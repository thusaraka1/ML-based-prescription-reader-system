export type UserRole = 'patient' | 'caretaker' | 'admin';

export class User {
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  residentId?: string; // For patients, links to their Resident record

  constructor(userId: string, name: string, role: UserRole, email: string, residentId?: string) {
    this.userId = userId;
    this.name = name;
    this.role = role;
    this.email = email;
    this.residentId = residentId;
  }
}
