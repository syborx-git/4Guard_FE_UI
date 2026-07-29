/**
 * @file alerts-config.service.ts
 * @description Servicio dummy tipado para HU-134 — Configuración de Alertas y Notificaciones.
 * Simula todas las operaciones CRUD y trazabilidad de auditoría mediante Angular Signals y RxJS.
 */

import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';
import {
  AlertConfiguration,
  AlertHistoryEntry,
  AlertAuditEntry,
  AlertStatus,
  DUMMY_ALERTS,
  DUMMY_ALERT_HISTORY,
  DUMMY_ALERT_AUDIT,
} from './alerts-config.models';

export interface ServiceResult<T> {
  data: T;
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AlertsConfigService {
  // ─── Estado interno mutable en Signals ─────────────────────────────────
  private _alerts = signal<AlertConfiguration[]>([...DUMMY_ALERTS]);
  private _historyEntries = signal<AlertHistoryEntry[]>([...DUMMY_ALERT_HISTORY]);
  private _auditEntries = signal<AlertAuditEntry[]>([...DUMMY_ALERT_AUDIT]);

  // ─── Señales públicas de solo lectura ──────────────────────────────────
  readonly alerts = this._alerts.asReadonly();
  readonly historyEntries = this._historyEntries.asReadonly();
  readonly auditEntries = this._auditEntries.asReadonly();

  // Delay simulado de red (500ms)
  private readonly MOCK_DELAY_MS = 500;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna todas las reglas de alerta configuradas. */
  getAlerts(): Observable<ServiceResult<AlertConfiguration[]>> {
    return of({
      data: [...this._alerts()],
      message: 'Reglas de alerta cargadas correctamente.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Retorna una regla de alerta por ID. */
  getAlertById(id: string): Observable<ServiceResult<AlertConfiguration>> {
    const found = this._alerts().find((a) => a.id === id);
    if (!found) {
      return throwError(() => ({
        success: false,
        message: 'Regla de alerta no encontrada.',
      })).pipe(delay(200));
    }
    return of({
      data: { ...found },
      message: 'Regla encontrada.',
      success: true,
    }).pipe(delay(200));
  }

  /** Retorna el historial de cambios de una regla específica. */
  getAlertHistory(alertId: string): AlertHistoryEntry[] {
    return this._historyEntries().filter((h) => h.alertId === alertId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Crea una nueva regla de alerta. */
  createAlert(
    payload: Omit<AlertConfiguration, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<ServiceResult<AlertConfiguration>> {
    const now = new Date().toISOString();

    const existing = this._alerts().find(
      (a) => a.name.trim().toLowerCase() === payload.name.trim().toLowerCase()
    );
    if (existing) {
      return throwError(() => ({
        success: false,
        message: `Ya existe una regla de alerta con el nombre "${payload.name}".`,
      })).pipe(delay(200));
    }

    const newAlert: AlertConfiguration = {
      ...payload,
      id: `alt-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    // Actualizar estado reactivo
    this._alerts.update((list) => [newAlert, ...list]);

    // Registrar historial y auditoría
    this._addHistoryEntry({
      alertId: newAlert.id,
      user: payload.updatedBy,
      changeSummary: `Creación inicial de la regla de alerta "${newAlert.name}" con prioridad ${newAlert.priority}.`,
      newStatus: newAlert.status,
    });

    this._addAuditEntry({
      entityId: newAlert.id,
      action: 'CREATE',
      performedBy: payload.updatedBy,
      details: `Regla "${newAlert.name}" creada para evento ${newAlert.event}.`,
    });

    return of({
      data: newAlert,
      message: `Regla de alerta "${newAlert.name}" creada exitosamente.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Actualiza una regla de alerta existente. */
  updateAlert(
    id: string,
    payload: Partial<Omit<AlertConfiguration, 'id' | 'organizationId' | 'createdAt'>>,
    performedBy: string
  ): Observable<ServiceResult<AlertConfiguration>> {
    const list = this._alerts();
    const idx = list.findIndex((a) => a.id === id);

    if (idx === -1) {
      return throwError(() => ({
        success: false,
        message: 'Regla de alerta no encontrada.',
      })).pipe(delay(200));
    }

    const previous = { ...list[idx] };
    const updated: AlertConfiguration = {
      ...list[idx],
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: performedBy,
    };

    this._alerts.update((arr) => {
      const copy = [...arr];
      copy[idx] = updated;
      return copy;
    });

    // Registrar historial y auditoría
    this._addHistoryEntry({
      alertId: id,
      user: performedBy,
      changeSummary: `Modificación de parámetros: Evento ${updated.event}, Prioridad ${updated.priority}, Condición ${updated.condition} ${updated.value} ${updated.unit}.`,
      previousStatus: previous.status,
      newStatus: updated.status,
    });

    this._addAuditEntry({
      entityId: id,
      action: 'UPDATE',
      performedBy,
      details: `Actualización de regla "${updated.name}".`,
    });

    return of({
      data: updated,
      message: `Regla de alerta "${updated.name}" actualizada correctamente.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Activa o inactiva una regla de alerta. */
  toggleAlertStatus(
    id: string,
    newStatus: AlertStatus,
    performedBy: string
  ): Observable<ServiceResult<AlertConfiguration>> {
    const alert = this._alerts().find((a) => a.id === id);
    if (!alert) {
      return throwError(() => ({ success: false, message: 'Regla no encontrada.' })).pipe(
        delay(200)
      );
    }

    const actionType = newStatus === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE';

    return this.updateAlert(id, { status: newStatus }, performedBy);
  }

  // ─── Helpers privados ──────────────────────────────────────────────────
  private _addHistoryEntry(
    entry: Omit<AlertHistoryEntry, 'id' | 'timestamp'>
  ): void {
    const newEntry: AlertHistoryEntry = {
      ...entry,
      id: `his-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    this._historyEntries.update((arr) => [newEntry, ...arr]);
  }

  private _addAuditEntry(
    entry: Omit<AlertAuditEntry, 'id' | 'organizationId' | 'performedAt'>
  ): void {
    const newEntry: AlertAuditEntry = {
      ...entry,
      id: `aud-${Date.now()}`,
      organizationId: 'org-4guard-mx-001',
      performedAt: new Date().toISOString(),
    };
    this._auditEntries.update((arr) => [newEntry, ...arr]);
  }
}
