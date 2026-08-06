/**
 * @file location.service.ts
 * @description Servicio Consolidado de Ubicaciones Físicas (Admin Panel, Layout HU-127 y Muelles HU-030).
 * Actúa como Fuente Única de Verdad (SSOT) para las entidades de ubicación del almacén.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DockItem, DockOperationalStatus } from '../../inventory/models/warehouse-location.models';
import { ReceptionAppointment } from '../../receiving/models/reception-appointment.models';
import { DockEligibilityCheck, DockRecommendation } from '../../receiving/models/dock-assignment.models';

// ─── Interfaces Compatibles (Layout HU-127 & Admin Panel) ──────────────────
export type LocationType = 'RACK' | 'DOCK' | 'FLOOR' | 'RAMP' | 'STAGING' | 'QUARANTINE' | 'VIRTUAL' | 'PALLET';

export interface Location {
  id: string;
  code: string;
  name: string;
  type: any;
  branchId?: string;
  branchName?: string;
  sectionId?: string;
  sectionName?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  level?: number | string;
  position?: string;
  coordX?: number;
  coordY?: number;
  coordZ?: number;
  warehouseId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'MAINTENANCE';
  statusReason?: string;
  blockReason?: string;
  capacity?: number;
  capacityUnits?: number;
  currentOccupancy?: number;
  isBlocked?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationResponse {
  success: boolean;
  message: string;
  data: Location;
}

export interface LocationListResponse {
  success: boolean;
  message: string;
  data: Location[];
}

export interface LocationAuditEntryDto {
  id: string;
  logId?: string;
  locationId: string;
  action: string;
  performedBy: string;
  username?: string;
  performedAt: string;
  createdAt?: string;
  details?: any[];
}

export interface LocationAuditResponse {
  success: boolean;
  message: string;
  data: LocationAuditEntryDto[];
}

const INITIAL_DOCKS_SEED: Record<string, DockItem> = {
  'AND-01': {
    id: 'LOC-AND-01',
    code: 'AND-01',
    displayName: 'Muelle AND-01',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    operationalStatus: 'AVAILABLE',
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  'AND-02': {
    id: 'LOC-AND-02',
    code: 'AND-02',
    displayName: 'Muelle AND-02',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    operationalStatus: 'AVAILABLE',
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  'AND-03': {
    id: 'LOC-AND-03',
    code: 'AND-03',
    displayName: 'Muelle AND-03',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    operationalStatus: 'RESERVED',
    reservedAppointmentId: 'APT-0005',
    reservationExpiresAt: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  'AND-04': {
    id: 'LOC-AND-04',
    code: 'AND-04',
    displayName: 'Muelle AND-04',
    branchId: 'SUC-001',
    branchName: 'Planta Central CDMX',
    operationalStatus: 'MAINTENANCE',
    version: 1,
    updatedAt: new Date().toISOString(),
  },
};

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly http = inject(HttpClient);

  // Signals de compatibilidad Admin Panel & Layout
  readonly locations = signal<Location[]>([]);

  // Mapa Reactivo de Muelles por Código (Fuente Única de Verdad HU-030)
  private readonly _docksMap = signal<Record<string, DockItem>>({ ...INITIAL_DOCKS_SEED });
  readonly docksMap = this._docksMap.asReadonly();
  readonly allDocks = computed(() => Object.values(this._docksMap()));

  // ─── HU-127 & Admin Panel: Métodos de Backend API ─────────────────────────
  getAll(): Location[] {
    return this.locations();
  }

  loadLocations(): Observable<Location[]> {
    return this.http.get<LocationListResponse>('/api/v1/locations').pipe(
      map((res) => {
        const list = res.data || [];
        this.locations.set(list);
        return list;
      }),
      catchError(() => {
        const fallback = this.locations();
        return of(fallback);
      })
    );
  }

  getLocations(): Observable<LocationListResponse> {
    return this.http.get<LocationListResponse>('/api/v1/locations').pipe(
      catchError(() => of({ success: true, message: 'Mock data', data: this.locations() }))
    );
  }

  create(payload: any): Observable<LocationResponse> {
    return this.http.post<LocationResponse>('/api/v1/locations', payload).pipe(
      catchError(() => of({ success: true, message: 'Creado', data: { id: `LOC-${Date.now()}`, ...payload, status: 'ACTIVE' } }))
    );
  }

  update(id: string, payload: any): Observable<LocationResponse> {
    return this.http.put<LocationResponse>(`/api/v1/locations/${id}`, payload).pipe(
      catchError(() => of({ success: true, message: 'Actualizado', data: { id, ...payload, status: 'ACTIVE' } }))
    );
  }

  changeStatus(id: string, status: string, reason?: string): Observable<LocationResponse> {
    return this.http.patch<LocationResponse>(`/api/v1/locations/${id}/status`, { status, reason }).pipe(
      catchError(() => of({ success: true, message: 'Estado actualizado', data: { id, status: status as any } as Location }))
    );
  }

  toggleBlock(id: string, isBlocked: boolean, reason?: string): Observable<LocationResponse> {
    return this.changeStatus(id, isBlocked ? 'BLOCKED' : 'ACTIVE', reason);
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`/api/v1/locations/${id}`).pipe(
      catchError(() => of({ success: true, message: 'Eliminado' }))
    );
  }

  getLocationAudit(id: string): Observable<LocationAuditResponse> {
    return this.http.get<LocationAuditResponse>(`/api/v1/locations/${id}/audit`).pipe(
      catchError(() => of({ success: true, message: 'Audit log', data: [] }))
    );
  }

  // ─── HU-030: Métodos SSOT de Muelles de Descarga ───────────────────────

  /**
   * Consulta Pura de Muelles por Sucursal.
   * IMPORTANTE: No ejecuta mutaciones de signals dentro de la consulta.
   */
  getDocksForBranch(branchId: string): DockItem[] {
    return this.allDocks().filter((d) => d.branchId === branchId);
  }

  /**
   * Obtiene un muelle específico por código.
   */
  getDockByCode(dockCode: string): DockItem | undefined {
    return this._docksMap()[dockCode];
  }

  /**
   * Limpia explícitamente las reservas vencidas (Comando imperativo fuera de lecturas puras).
   */
  cleanupExpiredReservations(branchId: string): string[] {
    const expiredCodes: string[] = [];
    const now = new Date().getTime();
    const docks = this.getDocksForBranch(branchId);

    docks.forEach((d) => {
      if (d.operationalStatus === 'RESERVED' && d.reservationExpiresAt) {
        const expires = new Date(d.reservationExpiresAt).getTime();
        if (now > expires) {
          expiredCodes.push(d.code);
          this._expireReservation(d.code);
        }
      }
    });

    return expiredCodes;
  }

  /** HARD GATES: Evalúa elegibilidad de asignación para una cita */
  evaluateEligibility(appointment: ReceptionAppointment | null, activeBranchId = 'SUC-001'): DockEligibilityCheck {
    const blockers: string[] = [];

    if (!appointment) {
      return { isEligible: false, blockers: ['No se especificó la cita de recepción.'] };
    }

    // 0. Validación de Contexto de Sucursal
    if (appointment.branchId !== activeBranchId) {
      blockers.push(`La cita pertenece a la sucursal ${appointment.branchName} (${appointment.branchId}), no compatible con la sucursal activa.`);
    }

    // 1. Check-In en Caseta (HU-027)
    const clearance = appointment.arrivalClearanceStatus;
    const isAdmitted = clearance === 'CLEARED' || clearance === 'WARNING_CLEARED';
    if (!isAdmitted) {
      if (!clearance || clearance === 'PENDING') {
        blockers.push('El vehículo no ha completado la evaluación de caseta (Check-In pendiente).');
      } else if (clearance === 'REVIEW_REQUIRED') {
        blockers.push('El arribo del vehículo requiere revisión de supervisor en caseta.');
      } else if (clearance === 'BLOCKED') {
        blockers.push('El vehículo fue bloqueado en caseta por incidencias graves sin resolver.');
      } else if (clearance === 'REJECTED_AT_GATE') {
        blockers.push('El vehículo fue rechazado físicamente en caseta de acceso.');
      } else {
        blockers.push('Evaluación de caseta no autorizada para asignación de muelle.');
      }
    }

    // 2. Estado de Cita (FSM Logística)
    if (['CANCELLED', 'COMPLETED', 'REJECTED', 'NO_SHOW'].includes(appointment.status)) {
      blockers.push(`La cita se encuentra en estado '${appointment.status}' (Inactiva para asignación).`);
    }

    // 3. Validación Documental OC (HU-029)
    const poStatus = appointment.poValidationStatus;
    if (poStatus === 'REJECTED') {
      blockers.push('La Orden de Compra asociada fue rechazada documentalmente (HU-029).');
    } else if (poStatus === 'PENDING') {
      blockers.push('La Orden de Compra se encuentra pendiente de validación documental.');
    }

    // 4. Incidencias Abiertas de Caseta
    if (appointment.openArrivalIncidentsCount && appointment.openArrivalIncidentsCount > 0) {
      blockers.push('El transporte registra incidencias de caseta abiertas sin resolver.');
    }

    return {
      isEligible: blockers.length === 0,
      blockers,
    };
  }

  /** OPERATIONAL DOCK RECOMMENDATION ENGINE (Engine Determínistico V1) */
  recommendDock(appointment: ReceptionAppointment, activeBranchId = 'SUC-001'): DockRecommendation {
    const branchDocks = this.getDocksForBranch(activeBranchId);
    const availableDocks = branchDocks.filter((d) => d.operationalStatus === 'AVAILABLE');
    const now = new Date().toISOString();

    if (availableDocks.length === 0) {
      return {
        suggestedDockId: '',
        suggestedDockCode: '',
        category: 'UNAVAILABLE',
        algorithm: 'DETERMINISTIC_FIRST_AVAILABLE_V1',
        reasons: ['No existen muelles disponibles actualmente en la sucursal (Saturación de patio).'],
        evaluatedDocksCount: branchDocks.length,
        generatedAt: now,
      };
    }

    const preferred = availableDocks[0];

    return {
      suggestedDockId: preferred.id,
      suggestedDockCode: preferred.code,
      category: 'OPTIMAL',
      algorithm: 'DETERMINISTIC_FIRST_AVAILABLE_V1',
      reasons: [
        `Muelle ${preferred.code} seleccionado por ser la primera posición operativa en estado AVAILABLE en ${preferred.branchName}.`,
        `Sin reservas o colisiones físicas registradas.`,
        appointment.priority === 'URGENT' ? `Recomendado con prioridad de atención Urgente (P1).` : `Posición estándar asignada por algoritmo.`,
      ],
      evaluatedDocksCount: branchDocks.length,
      generatedAt: now,
    };
  }

  /** Reservar Muelle con comprobación de versión e idempotencia */
  reserveDock(
    dockCode: string,
    appointmentId: string,
    expectedVersion?: number,
    durationMinutes = 20
  ): DockItem {
    const dock = this._docksMap()[dockCode];
    if (!dock) throw new Error(`El muelle ${dockCode} no existe.`);

    // Control Optimista de Concurrencia
    if (expectedVersion !== undefined && dock.version !== expectedVersion) {
      throw new Error(`El muelle ${dockCode} fue modificado por otro operador (Versión actual ${dock.version} vs esperada ${expectedVersion}). Actualice los datos.`);
    }

    // Idempotencia: Si ya está reservado por esta misma cita, retorna sin alterar
    if (dock.operationalStatus === 'RESERVED' && dock.reservedAppointmentId === appointmentId) {
      return dock;
    }

    // Validación de Disponibilidad Estricta
    if (dock.operationalStatus === 'OCCUPIED') {
      throw new Error(`El muelle ${dockCode} ya se encuentra ocupado físicamente por otra unidad.`);
    }
    if (dock.operationalStatus === 'RESERVED') {
      throw new Error(`El muelle ${dockCode} está reservado por la recepción ${dock.reservedAppointmentId}.`);
    }
    if (dock.operationalStatus === 'MAINTENANCE' || dock.operationalStatus === 'OUT_OF_SERVICE' || dock.operationalStatus === 'BLOCKED') {
      throw new Error(`El muelle ${dockCode} no está disponible (Estado: ${dock.operationalStatus}).`);
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const updated: DockItem = {
      ...dock,
      operationalStatus: 'RESERVED',
      reservedAppointmentId: appointmentId,
      reservationExpiresAt: expiresAt,
      version: dock.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this._docksMap.update((map) => ({ ...map, [dockCode]: updated }));
    return updated;
  }

  /** Iniciar Posicionamiento / Traslado (Protege contra expiración de timer) */
  startPositioning(dockCode: string, appointmentId: string, expectedVersion?: number): DockItem {
    const dock = this._docksMap()[dockCode];
    if (!dock) throw new Error(`El muelle ${dockCode} no existe.`);

    if (expectedVersion !== undefined && dock.version !== expectedVersion) {
      throw new Error(`El muelle ${dockCode} cambió de versión. Actualice la vista.`);
    }

    // Propiedad: Requiere que la cita sea la poseedora de la reserva
    if (dock.reservedAppointmentId && dock.reservedAppointmentId !== appointmentId) {
      throw new Error(`El muelle ${dockCode} pertenece a la recepción ${dock.reservedAppointmentId}.`);
    }

    const updated: DockItem = {
      ...dock,
      operationalStatus: 'RESERVED',
      reservedAppointmentId: appointmentId,
      reservationExpiresAt: undefined, // Elimina la expiración mientras el camión maniobra
      positioningStartedAt: new Date().toISOString(),
      version: dock.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this._docksMap.update((map) => ({ ...map, [dockCode]: updated }));
    return updated;
  }

  /** Confirmar Ocupación Física del Muelle */
  confirmOccupancy(dockCode: string, appointmentId: string, expectedVersion?: number): DockItem {
    const dock = this._docksMap()[dockCode];
    if (!dock) throw new Error(`El muelle ${dockCode} no existe.`);

    if (expectedVersion !== undefined && dock.version !== expectedVersion) {
      throw new Error(`El muelle ${dockCode} cambió de versión. Actualice la vista.`);
    }

    if (dock.reservedAppointmentId && dock.reservedAppointmentId !== appointmentId && dock.currentAppointmentId !== appointmentId) {
      throw new Error(`El muelle ${dockCode} está asociado a la recepción ${dock.reservedAppointmentId || dock.currentAppointmentId}.`);
    }

    const updated: DockItem = {
      ...dock,
      operationalStatus: 'OCCUPIED',
      currentAppointmentId: appointmentId,
      occupiedSince: new Date().toISOString(),
      reservedAppointmentId: undefined,
      reservationExpiresAt: undefined,
      positioningStartedAt: undefined,
      version: dock.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this._docksMap.update((map) => ({ ...map, [dockCode]: updated }));
    return updated;
  }

  /** Liberar Muelle tras completar maniobra */
  releaseDock(dockCode: string, appointmentId: string, expectedVersion?: number): DockItem {
    const dock = this._docksMap()[dockCode];
    if (!dock) throw new Error(`El muelle ${dockCode} no existe.`);

    if (expectedVersion !== undefined && dock.version !== expectedVersion) {
      throw new Error(`El muelle ${dockCode} cambió de versión. Actualice la vista.`);
    }

    // Propiedad: Verificar que el muelle pertenezca a la cita que intenta liberarlo
    if (dock.currentAppointmentId && dock.currentAppointmentId !== appointmentId) {
      throw new Error(`Este muelle se encuentra ocupado por otra recepción (${dock.currentAppointmentId}).`);
    }
    if (dock.reservedAppointmentId && dock.reservedAppointmentId !== appointmentId && !dock.currentAppointmentId) {
      throw new Error(`Este muelle se encuentra reservado por otra recepción (${dock.reservedAppointmentId}).`);
    }

    const updated: DockItem = {
      ...dock,
      operationalStatus: 'AVAILABLE',
      currentAppointmentId: undefined,
      reservedAppointmentId: undefined,
      reservationExpiresAt: undefined,
      positioningStartedAt: undefined,
      occupiedSince: undefined,
      version: dock.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this._docksMap.update((map) => ({ ...map, [dockCode]: updated }));
    return updated;
  }

  /** Restaura una instancia anterior de muelle (Para compensación / rollback) */
  restoreDockSnapshot(snapshot: DockItem): void {
    this._docksMap.update((map) => ({ ...map, [snapshot.code]: snapshot }));
  }

  /** Resetea el seed inicial para pruebas demo */
  resetToInitialSeed(): void {
    this._docksMap.set({ ...INITIAL_DOCKS_SEED });
  }

  private _expireReservation(dockCode: string): void {
    const dock = this._docksMap()[dockCode];
    if (!dock) return;
    this._docksMap.update((map) => ({
      ...map,
      [dockCode]: {
        ...dock,
        operationalStatus: 'AVAILABLE',
        reservedAppointmentId: undefined,
        reservationExpiresAt: undefined,
        version: dock.version + 1,
        updatedAt: new Date().toISOString(),
      },
    }));
  }
}
