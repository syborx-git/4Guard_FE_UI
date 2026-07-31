/**
 * @file user-activity.service.ts
 * @description Servicio de Actividad por Usuario (HU-146) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ESTADO ACTUAL: MOCK
 * ═══════════════════════════════════════════════════════════════════════════
 * Todos los datos provienen de user-activity.mock.ts.
 * No existe endpoint real en esta etapa.
 *
 * Para conectar backend:
 *  1. Inyectar HttpClient
 *  2. Reemplazar MOCK_ACTIVITY_EVENTS con GET /api/user-activity/events
 *  3. Reemplazar MOCK_REPORT_PROFILES con GET /api/user-activity/profiles
 *  4. Implementar POST/PUT/DELETE para perfiles
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA: CRUD DE PERFILES EN MEMORIA
 * ═══════════════════════════════════════════════════════════════════════════
 * El CRUD de ActivityReportProfile es en memoria con Angular Signals.
 * Los cambios NO persisten al refrescar la página ya que no existe
 * persistencia backend para este recurso en esta primera etapa.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * El frontend NO escribe directamente en audit_logs ni modifica audit.service.ts.
 * Las acciones de crear/editar/eliminar/activar/desactivar perfiles deben
 * ser registradas por el backend dentro de la misma transacción.
 * audit.service.ts NO fue modificado.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE SEGURIDAD — RLS
 * ═══════════════════════════════════════════════════════════════════════════
 * La validación definitiva de RLS, permisos y alcance de datos DEBE ejecutarse
 * en backend y base de datos. El filtrado aquí es solo para evaluación de UX.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay, tap, map } from 'rxjs/operators';
import {
  UserActivityEvent,
  ActivityReportProfile,
  ActivityFilters,
  ActivityKpis,
  PaginationState,
  ActivityResult,
  ActivitySeverity,
} from './user-activity.models';
import {
  MOCK_ACTIVITY_EVENTS,
  MOCK_REPORT_PROFILES,
} from './user-activity.mock';
import { ToastService } from '../../core/services/toast.service';
import { environment } from '../../../environments/environment';

export interface UserActivityDetailDto {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface UserActivityLogResponseDto {
  logId: string;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: UserActivityDetailDto[];
}

export interface ApiResponseWrapper<T> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Hora fuera de turno: antes de 06:00 o después de 22:00 ──────────────────

function isOutsideShiftHour(isoString: string): boolean {
  const date = new Date(isoString);
  const hours = date.getHours();
  return hours < 6 || hours >= 22;
}

function mapLogDtoToEvent(log: UserActivityLogResponseDto): UserActivityEvent {
  const result: ActivityResult = log.details?.some(d => d.newValue === 'FAILED' || d.newValue === 'REJECTED') ? 'ERROR' : 'SUCCESS';
  const severity: ActivitySeverity = log.action.includes('DELETE') || log.action.includes('CRITICAL') ? 'HIGH' : log.action.includes('UPDATE') || log.action.includes('STATUS') ? 'MEDIUM' : 'INFO';

  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  if (log.details && Array.isArray(log.details)) {
    log.details.forEach(d => {
      previousValues[d.fieldName] = d.oldValue;
      newValues[d.fieldName] = d.newValue;
    });
  }

  return {
    id: log.logId || `log-${Date.now()}`,
    occurredAt: log.createdAt || new Date().toISOString(),
    userId: log.userId || 'u-system',
    userName: log.username || 'Usuario Sistema',
    userEmail: `${log.username || 'user'}@4guard.mx`,
    userRole: 'OPERATOR',
    organizationId: '',
    warehouseId: 'BR-01',
    warehouseName: 'Almacén Principal',
    module: log.entityType || 'Sistema',
    action: log.action || 'ACTIVITY',
    entityType: log.entityType || 'SYSTEM',
    entityId: log.entityId,
    description: `Acción ${log.action} ejecutada sobre ${log.entityType || 'sistema'}`,
    result,
    severity,
    previousValues,
    newValues,
    ipAddress: log.ipAddress || '192.168.1.1',
    device: 'Web Console',
    browser: log.userAgent || 'Chrome',
    outsideShift: isOutsideShiftHour(log.createdAt || new Date().toISOString())
  };
}

// ─── Filtro de texto libre ────────────────────────────────────────────────────

function matchesText(event: UserActivityEvent, text: string): boolean {
  const q = text.toLowerCase();
  return (
    event.userName.toLowerCase().includes(q) ||
    event.userEmail.toLowerCase().includes(q) ||
    event.module.toLowerCase().includes(q) ||
    event.action.toLowerCase().includes(q) ||
    event.description.toLowerCase().includes(q) ||
    (event.entityId?.toLowerCase().includes(q) ?? false) ||
    (event.entityType?.toLowerCase().includes(q) ?? false)
  );
}

@Injectable({
  providedIn: 'root',
})
export class UserActivityService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/audit/user-activity`;
  // ─── Eventos base (inmutables durante la sesión) ──────────────────────────

  /** Todos los eventos disponibles — provienen exclusivamente del backend */
  private readonly _allEvents = signal<UserActivityEvent[]>([]);

  /** Filtros actualmente aplicados */
  private readonly _activeFilters = signal<ActivityFilters | null>(null);

  /** Estado de carga */
  readonly isLoading = signal<boolean>(false);

  /** Estado de error */
  readonly hasError = signal<boolean>(false);

  // ─── Computed: Eventos filtrados ──────────────────────────────────────────

  /**
   * Eventos filtrados según los filtros activos.
   * Se calcula automáticamente cuando cambian los filtros o los eventos base.
   * NUNCA sobreescribe _allEvents.
   */
  readonly filteredEvents = computed<UserActivityEvent[]>(() => {
    const filters = this._activeFilters();
    const events = this._allEvents();

    if (!filters) return events;

    return events.filter((event) => {
      // Rango de fechas
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom + 'T00:00:00');
        if (new Date(event.occurredAt) < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo + 'T23:59:59');
        if (new Date(event.occurredAt) > to) return false;
      }

      // Usuario
      if (filters.userName) {
        if (!event.userName.toLowerCase().includes(filters.userName.toLowerCase())) return false;
      }

      // Rol
      if (filters.userRole) {
        if (event.userRole !== filters.userRole) return false;
      }

      // Almacén
      if (filters.warehouse) {
        if (event.warehouseId !== filters.warehouse) return false;
      }

      // Módulo
      if (filters.module) {
        if (event.module !== filters.module) return false;
      }

      // Acción
      if (filters.action) {
        if (event.action !== filters.action) return false;
      }

      // Resultado
      if (filters.result) {
        if (event.result !== filters.result) return false;
      }

      // Criticidad
      if (filters.severity) {
        if (event.severity !== filters.severity) return false;
      }

      // Solo fuera de horario
      if (filters.outsideShiftOnly) {
        if (!event.outsideShift) return false;
      }

      // Texto libre
      if (filters.searchText && filters.searchText.trim().length > 0) {
        if (!matchesText(event, filters.searchText)) return false;
      }

      return true;
    });
  });

  // ─── Computed: KPIs sobre eventos filtrados ───────────────────────────────

  /**
   * KPIs calculados sobre filteredEvents.
   * - activeUsers: usuarios únicos con al menos un evento
   * - totalEvents: total de eventos filtrados
   * - criticalOperations: severity HIGH o CRITICAL
   * - errorsOrRejections: result ERROR o REJECTED
   * - outsideShiftCount: outsideShift === true
   */
  readonly kpis = computed<ActivityKpis>(() => {
    const events = this.filteredEvents();

    const uniqueUsers = new Set(events.map((e) => e.userId));

    return {
      activeUsers: uniqueUsers.size,
      totalEvents: events.length,
      criticalOperations: events.filter(
        (e) => e.severity === 'HIGH' || e.severity === 'CRITICAL'
      ).length,
      errorsOrRejections: events.filter(
        (e) => e.result === 'ERROR' || e.result === 'REJECTED'
      ).length,
      outsideShiftCount: events.filter((e) => e.outsideShift === true).length,
    };
  });

  // ─── Perfiles de reporte (CRUD en memoria) ────────────────────────────────

  /**
   * Lista reactiva de perfiles guardados.
   * NOTA: Los cambios son solo en memoria y se pierden al refrescar.
   */
  private readonly _profiles = signal<ActivityReportProfile[]>(MOCK_REPORT_PROFILES);

  readonly profiles = this._profiles.asReadonly();

  // ─── API de Eventos ───────────────────────────────────────────────────────

  /**
   * Aplica filtros. Reinicia la paginación a la primera página.
   * No sobreescribe los eventos base.
   */
  applyFilters(filters: ActivityFilters): void {
    this._activeFilters.set({ ...filters });
  }

  /**
   * Limpia todos los filtros activos.
   * También devuelve a la primera página.
   */
  clearFilters(): void {
    this._activeFilters.set(null);
  }

  /**
   * Retorna los filtros activos actuales.
   */
  getActiveFilters(): ActivityFilters | null {
    return this._activeFilters();
  }

  /**
   * Simula una recarga de datos desde el backend.
   * En producción: HTTP GET /api/user-activity/events con los filtros como query params.
   */
  refreshEvents(): Observable<UserActivityEvent[]> {
    this.isLoading.set(true);
    this.hasError.set(false);

    let params = new HttpParams();
    const filters = this._activeFilters();
    if (filters) {
      if (filters.action) params = params.set('action', filters.action);
      if (filters.dateFrom) params = params.set('fromDate', `${filters.dateFrom}T00:00:00Z`);
      if (filters.dateTo) params = params.set('toDate', `${filters.dateTo}T23:59:59Z`);
    }

    return this.http.get<ApiResponseWrapper<UserActivityLogResponseDto[]>>(this.API_URL, { params }).pipe(
      map(res => {
        const events = (res.success && Array.isArray(res.data))
          ? res.data.map(log => mapLogDtoToEvent(log))
          : [];
        this._allEvents.set(events);
        return events;
      }),
      catchError((err: HttpErrorResponse) => {
        this.hasError.set(true);
        this._allEvents.set([]);
        const errorMsg = err.error?.message ?? 'No se pudo conectar con el servicio de auditoría de BD';
        this.toast.error(errorMsg);
        return of([]);
      }),
      tap({
        next: () => this.isLoading.set(false),
        error: () => this.isLoading.set(false)
      })
    );
  }

  /**
   * Marca la carga como completada.
   */
  completeLoad(): void {
    this.isLoading.set(false);
  }

  // ─── API de Perfiles (CRUD en memoria) ───────────────────────────────────

  /**
   * Retorna todos los perfiles.
   * En producción: GET /api/user-activity/profiles
   */
  getProfiles(): ActivityReportProfile[] {
    return this._profiles();
  }

  /**
   * Crea un nuevo perfil de reporte.
   * Valida que el código sea único.
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   * La auditoría de esta acción es responsabilidad del backend.
   *
   * En producción: POST /api/user-activity/profiles
   */
  createProfile(
    data: Omit<ActivityReportProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): { success: boolean; error?: string } {
    const existing = this._profiles().find(
      (p) => p.code.toLowerCase() === data.code.toLowerCase()
    );
    if (existing) {
      return { success: false, error: `El código "${data.code}" ya está en uso.` };
    }

    const newProfile: ActivityReportProfile = {
      ...data,
      id: `prof-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this._profiles.update((list) => [...list, newProfile]);
    return { success: true };
  }

  /**
   * Actualiza un perfil existente.
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   * La auditoría de esta acción es responsabilidad del backend.
   *
   * En producción: PUT /api/user-activity/profiles/{id}
   */
  updateProfile(
    id: string,
    data: Partial<ActivityReportProfile>
  ): { success: boolean; error?: string } {
    const index = this._profiles().findIndex((p) => p.id === id);
    if (index === -1) {
      return { success: false, error: 'Perfil no encontrado.' };
    }

    // Verificar código único si se está cambiando
    if (data.code) {
      const duplicate = this._profiles().find(
        (p) => p.code.toLowerCase() === data.code!.toLowerCase() && p.id !== id
      );
      if (duplicate) {
        return { success: false, error: `El código "${data.code}" ya está en uso.` };
      }
    }

    this._profiles.update((list) =>
      list.map((p) =>
        p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      )
    );
    return { success: true };
  }

  /**
   * Duplica un perfil existente con un nuevo nombre y código.
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   *
   * En producción: POST /api/user-activity/profiles/{id}/duplicate
   */
  duplicateProfile(
    id: string,
    currentUserId: string
  ): { success: boolean; error?: string } {
    const original = this._profiles().find((p) => p.id === id);
    if (!original) {
      return { success: false, error: 'Perfil original no encontrado.' };
    }

    const timestamp = Date.now();
    const newProfile: ActivityReportProfile = {
      ...original,
      id: `prof-${timestamp}`,
      name: `${original.name} (copia)`,
      code: `${original.code}-COPY-${timestamp.toString().slice(-4)}`,
      visibility: 'PRIVATE',
      status: 'INACTIVE',
      ownerId: currentUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this._profiles.update((list) => [...list, newProfile]);
    return { success: true };
  }

  /**
   * Activa o desactiva un perfil.
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   *
   * En producción: PATCH /api/user-activity/profiles/{id}/status
   */
  toggleProfileStatus(id: string): { success: boolean; error?: string } {
    const profile = this._profiles().find((p) => p.id === id);
    if (!profile) {
      return { success: false, error: 'Perfil no encontrado.' };
    }

    this._profiles.update((list) =>
      list.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
    return { success: true };
  }

  /**
   * Elimina un perfil de reporte.
   *
   * Reglas:
   * - Solo se puede eliminar si es PRIVADO y pertenece al usuario actual.
   * - Los perfiles SHARED o de otro propietario son de solo lectura (no eliminables).
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   *
   * En producción: DELETE /api/user-activity/profiles/{id}
   */
  deleteProfile(
    id: string,
    currentUserId: string
  ): { success: boolean; error?: string } {
    const profile = this._profiles().find((p) => p.id === id);
    if (!profile) {
      return { success: false, error: 'Perfil no encontrado.' };
    }

    if (profile.visibility === 'SHARED') {
      return {
        success: false,
        error: 'No se pueden eliminar perfiles compartidos. Contáctate con el propietario.',
      };
    }

    if (profile.ownerId !== currentUserId) {
      return {
        success: false,
        error: 'Solo puedes eliminar tus propios perfiles privados.',
      };
    }

    this._profiles.update((list) => list.filter((p) => p.id !== id));
    return { success: true };
  }

  // ─── Exportación simulada ─────────────────────────────────────────────────

  /**
   * Simula la exportación de datos.
   * En producción: POST /api/user-activity/export con los filtros y formato
   * como body. El backend genera el archivo y retorna una URL de descarga.
   *
   * NOTA DE AUDITORÍA: El frontend NO escribe en audit_logs.
   * El backend debe registrar la exportación dentro de la transacción.
   */
  simulateExport(format: 'XLSX' | 'CSV' | 'PDF'): Observable<{ success: boolean; message: string }> {
    return of({
      success: true,
      message: `Exportación generada correctamente con los filtros actuales. Formato: ${format}`,
    }).pipe(delay(1500));
  }

  // ─── Helpers para la Timeline ─────────────────────────────────────────────

  /**
   * Retorna los eventos filtrados de un usuario específico, ordenados por fecha.
   * La vista Timeline requiere un usuario seleccionado.
   */
  getEventsForUser(userId: string): UserActivityEvent[] {
    return this.filteredEvents()
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }

  /**
   * Retorna los usuarios únicos presentes en los eventos filtrados.
   */
  getUniqueUsers(): Array<{ userId: string; userName: string }> {
    const map = new Map<string, string>();
    this.filteredEvents().forEach((e) => map.set(e.userId, e.userName));
    return Array.from(map.entries()).map(([userId, userName]) => ({ userId, userName }));
  }
}
