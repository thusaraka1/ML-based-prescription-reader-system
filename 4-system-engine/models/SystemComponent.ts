export type SystemStatus = 'online' | 'offline' | 'maintenance';

export class SystemComponent {
  componentId: string;
  name: string;
  version: string;
  status: SystemStatus;
  description: string;
  lastUpdated: Date;

  constructor(
    componentId: string,
    name: string,
    version: string,
    description: string,
    status: SystemStatus = 'online'
  ) {
    this.componentId = componentId;
    this.name = name;
    this.version = version;
    this.status = status;
    this.description = description;
    this.lastUpdated = new Date();
  }

  setStatus(status: SystemStatus): void {
    this.status = status;
    this.lastUpdated = new Date();
  }

  updateVersion(version: string): void {
    this.version = version;
    this.lastUpdated = new Date();
  }
}
