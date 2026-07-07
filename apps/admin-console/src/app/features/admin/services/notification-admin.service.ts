import { Injectable, signal } from '@angular/core';

export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface NotificationAdminItem {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: Date;
  read: boolean;
  technicalMetadata: string; // JSON string
}

@Injectable({
  providedIn: 'root'
})
export class NotificationAdminService {
  private readonly items = signal<NotificationAdminItem[]>([
    {
      id: 'not-1',
      title: 'Bloqueo Permanente de Cuenta',
      message: 'La cuenta del operador jorge.rojas ha sido bloqueada permanentemente tras alcanzar 5 intentos de inicio de sesión fallidos consecutivamente.',
      severity: 'CRITICAL',
      createdAt: new Date('2026-07-06T21:15:00'),
      read: false,
      technicalMetadata: '{\n  "username": "jorge.rojas",\n  "failedAttempts": 5,\n  "triggeredBy": "AuthSystem",\n  "actionTaken": "PERMANENT_LOCKOUT"\n}'
    },
    {
      id: 'not-2',
      title: 'Ubicación Bloqueada por Calidad',
      message: 'La ubicación física SMS-02 / FR-01 / F-12-04-02 ha sido puesta en estado bloqueado por carlos.mendoza. Razón: Mantenimiento preventivo de refrigeración.',
      severity: 'WARNING',
      createdAt: new Date('2026-07-06T18:00:00'),
      read: true,
      technicalMetadata: '{\n  "locationId": "loc-3",\n  "locationCode": "F-12-04-02",\n  "blockedBy": "carlos.mendoza",\n  "reasonCode": "MAINT_REF_CAM"\n}'
    },
    {
      id: 'not-3',
      title: 'Nueva Organización Registrada',
      message: 'Se ha creado satisfactoriamente la organización Apex Manufacturing (Código: APX-MFG) en la base de datos corporativa.',
      severity: 'INFO',
      createdAt: new Date('2026-07-05T11:20:00'),
      read: true,
      technicalMetadata: '{\n  "orgId": "org-3",\n  "orgCode": "APX-MFG",\n  "taxId": "AMF201130CC5",\n  "createdBy": "enrique"\n}'
    }
  ]);

  readonly notifications = this.items.asReadonly();

  getAll(): NotificationAdminItem[] {
    return this.items();
  }

  create(notif: Omit<NotificationAdminItem, 'id' | 'createdAt' | 'read'>): void {
    const newNotif: NotificationAdminItem = {
      ...notif,
      id: `not-${Date.now()}`,
      createdAt: new Date(),
      read: false
    };
    this.items.update(list => [newNotif, ...list]); // newest first
  }

  markAsRead(id: string): void {
    this.items.update(list => list.map(item => 
      item.id === id ? { ...item, read: true } : item
    ));
  }

  markAllAsRead(): void {
    this.items.update(list => list.map(item => ({ ...item, read: true })));
  }

  delete(id: string): void {
    this.items.update(list => list.filter(item => item.id !== id));
  }
}
