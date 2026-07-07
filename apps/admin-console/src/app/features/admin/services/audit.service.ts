import { Injectable, signal } from '@angular/core';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOCKOUT';

export interface AuditLog {
  id: string;
  timestamp: Date;
  username: string;
  entityType: string; // e.g., 'users', 'locations', 'organizations'
  entityId: string;
  action: AuditAction;
  ipAddress: string;
  userAgent: string;
  beforeState: string; // JSON string
  afterState: string; // JSON string
}

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private readonly items = signal<AuditLog[]>([
    {
      id: 'aud-1',
      timestamp: new Date('2026-07-06T21:15:00'),
      username: 'enrique',
      entityType: 'users',
      entityId: 'usr-3',
      action: 'UPDATE',
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      beforeState: '{\n  "username": "jorge.rojas",\n  "status": "ACTIVE",\n  "isEnabled": true,\n  "permanentlyLocked": false\n}',
      afterState: '{\n  "username": "jorge.rojas",\n  "status": "SUSPENDED",\n  "isEnabled": false,\n  "permanentlyLocked": true\n}'
    },
    {
      id: 'aud-2',
      timestamp: new Date('2026-07-06T18:00:00'),
      username: 'carlos.mendoza',
      entityType: 'locations',
      entityId: 'loc-3',
      action: 'UPDATE',
      ipAddress: '192.168.10.88',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      beforeState: '{\n  "code": "SMS-F1-05",\n  "isBlocked": false,\n  "blockReason": ""\n}',
      afterState: '{\n  "code": "SMS-F1-05",\n  "isBlocked": true,\n  "blockReason": "Mantenimiento preventivo de refrigeración"\n}'
    },
    {
      id: 'aud-3',
      timestamp: new Date('2026-07-05T11:20:00'),
      username: 'enrique',
      entityType: 'organizations',
      entityId: 'org-3',
      action: 'CREATE',
      ipAddress: '187.211.45.10',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
      beforeState: 'null',
      afterState: '{\n  "id": "org-3",\n  "name": "Apex Manufacturing",\n  "code": "APX-MFG",\n  "taxId": "AMF201130CC5",\n  "type": "MANUFACTURING",\n  "status": "INACTIVE"\n}'
    },
    {
      id: 'aud-4',
      timestamp: new Date('2026-07-05T09:05:00'),
      username: 'jorge.rojas',
      entityType: 'session',
      entityId: 'session-jorge',
      action: 'LOGIN',
      ipAddress: '192.168.1.102',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      beforeState: 'null',
      afterState: '{\n  "loginSuccessful": true,\n  "failedAttemptsAtLogin": 0\n}'
    }
  ]);

  readonly auditLogs = this.items.asReadonly();

  getAll(): AuditLog[] {
    return this.items();
  }

  // Logs are inmutable: only appending is allowed
  logAction(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newLog: AuditLog = {
      ...log,
      id: `aud-${Date.now()}`,
      timestamp: new Date()
    };
    this.items.update(list => [newLog, ...list]);
  }
}
