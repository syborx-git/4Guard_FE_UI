/**
 * @file layout.service.ts
 * @description Servicio de Gestión de Layout y Ubicaciones — 4GUARD WMS.
 * HU-127
 *
 * Implementación MOCK con Observable — preparada para sustituir por llamadas
 * HTTP reales sin modificar la interfaz del componente.
 *
 * Patrón: of(data).pipe(delay(600)) simula latencia de red (~600ms).
 * NO se fija un tiempo arbitrario de espera — en producción el tiempo
 * depende de la respuesta real del backend.
 *
 * DATOS MOCK: Los datos iniciales son exclusivamente demostrativos.
 * Pendientes de validación operativa con 4GUARD.
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';

import {
  WarehouseLocation,
  LocationAuditEntry,
  CreateLocationPayload,
  UpdateLocationPayload,
  ChangeStatusPayload,
  WarehouseZone,
  LocationStatus,
} from '../models/warehouse-location.model';

// ── MOCK: Datos iniciales (pendientes de validación con 4GUARD) ───────────────
// Se usa un ID de almacén representativo; el real vendrá del contexto de sesión.
const MOCK_WAREHOUSE_ID   = 'WH-4GUARD-001';
const MOCK_WAREHOUSE_NAME = '4GUARD — Almacén Principal';

/** MOCK: Zonas del almacén (pendiente confirmación con 4GUARD) */
const MOCK_ZONES: WarehouseZone[] = [
  { id: 'Z-001', code: 'ALMC', name: 'Zona de Almacenamiento' },
  { id: 'Z-002', code: 'RECV', name: 'Zona de Recepción' },
  { id: 'Z-003', code: 'DISP', name: 'Zona de Despacho' },
  { id: 'Z-004', code: 'STAG', name: 'Zona de Staging' },
];

/** MOCK: Ubicaciones iniciales (pendiente validación operativa con 4GUARD) */
const MOCK_LOCATIONS: WarehouseLocation[] = [
  // ── Zona de Almacenamiento — Pasillo A (MOCK)
  {
    id: 'LOC-001', code: 'PA-B01-R1-N1', name: 'Pasillo A – Bahía 01 – Rack 1 – Nivel 1',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'A', bay: '01', rack: 'R1', level: 'N1',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 4, capacityUnit: 'PALLET',
    currentOccupancy: 3, occupancyPercentage: 75, availableCapacity: 1,
    isStorageAllowed: true, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-07-10T14:22:00Z',
    updatedBy: 'juan.garcia@4guard.mx', lastAction: 'UPDATE',
    canDelete: false, canDeactivate: true, canBlock: true, canReactivate: false,
  },
  {
    id: 'LOC-002', code: 'PA-B01-R1-N2', name: 'Pasillo A – Bahía 01 – Rack 1 – Nivel 2',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'A', bay: '01', rack: 'R1', level: 'N2',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 4, capacityUnit: 'PALLET',
    currentOccupancy: 0, occupancyPercentage: 0, availableCapacity: 4,
    isStorageAllowed: true, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'CREATE',
    canDelete: true, canDeactivate: true, canBlock: true, canReactivate: false,
  },
  {
    id: 'LOC-003', code: 'PA-B02-R1-N1', name: 'Pasillo A – Bahía 02 – Rack 1 – Nivel 1',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'A', bay: '02', rack: 'R1', level: 'N1',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 4, capacityUnit: 'PALLET',
    currentOccupancy: 4, occupancyPercentage: 100, availableCapacity: 0,
    isStorageAllowed: true, status: 'BLOCKED', observations: 'Inventario en revisión QM',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-07-12T09:15:00Z',
    updatedBy: 'carlos.mendez@4guard.mx', lastAction: 'STATUS_CHANGE',
    canDelete: false, canDeactivate: false, canBlock: false, canReactivate: true,
  },
  {
    id: 'LOC-004', code: 'PA-B02-R1-N2', name: 'Pasillo A – Bahía 02 – Rack 1 – Nivel 2',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'A', bay: '02', rack: 'R1', level: 'N2',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 4, capacityUnit: 'PALLET',
    currentOccupancy: 2, occupancyPercentage: 50, availableCapacity: 2,
    isStorageAllowed: true, status: 'MAINTENANCE', observations: 'Revisión de estructura metálica',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-07-14T07:00:00Z',
    updatedBy: 'juan.garcia@4guard.mx', lastAction: 'STATUS_CHANGE',
    canDelete: false, canDeactivate: false, canBlock: false, canReactivate: true,
  },
  // ── Zona de Almacenamiento — Pasillo B (MOCK)
  {
    id: 'LOC-005', code: 'PB-B01-R1-N1', name: 'Pasillo B – Bahía 01 – Rack 1 – Nivel 1',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'B', bay: '01', rack: 'R1', level: 'N1',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 6, capacityUnit: 'PALLET',
    currentOccupancy: 1, occupancyPercentage: 17, availableCapacity: 5,
    isStorageAllowed: true, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-06-20T11:30:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'UPDATE',
    canDelete: false, canDeactivate: true, canBlock: true, canReactivate: false,
  },
  {
    id: 'LOC-006', code: 'PB-B01-R1-N2', name: 'Pasillo B – Bahía 01 – Rack 1 – Nivel 2',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-001', zoneCode: 'ALMC', zoneName: 'Zona de Almacenamiento',
    aisle: 'B', bay: '01', rack: 'R1', level: 'N2',
    locationType: 'RACK', logisticFunction: 'STORAGE',
    maxCapacity: 6, capacityUnit: 'PALLET',
    currentOccupancy: 0, occupancyPercentage: 0, availableCapacity: 6,
    isStorageAllowed: true, status: 'INACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-03-05T16:00:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'STATUS_CHANGE',
    canDelete: true, canDeactivate: false, canBlock: false, canReactivate: true,
  },
  // ── Zona de Recepción — Rampas (MOCK)
  {
    id: 'LOC-007', code: 'RECV-RAMP-A', name: 'Rampa A',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-002', zoneCode: 'RECV', zoneName: 'Zona de Recepción',
    locationType: 'RAMP', logisticFunction: 'RECEIVING',
    maxCapacity: 2, capacityUnit: 'PALLET',
    isStorageAllowed: false, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'CREATE',
    canDelete: false, canDeactivate: true, canBlock: true, canReactivate: false,
  },
  {
    id: 'LOC-008', code: 'RECV-RAMP-B', name: 'Rampa B',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-002', zoneCode: 'RECV', zoneName: 'Zona de Recepción',
    locationType: 'RAMP', logisticFunction: 'RECEIVING',
    maxCapacity: 2, capacityUnit: 'PALLET',
    isStorageAllowed: false, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-01-10T08:00:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'CREATE',
    canDelete: false, canDeactivate: true, canBlock: true, canReactivate: false,
  },
  // ── Zona de Staging (MOCK)
  {
    id: 'LOC-009', code: 'STAG-A1', name: 'Staging A1',
    warehouseId: MOCK_WAREHOUSE_ID, warehouseName: MOCK_WAREHOUSE_NAME,
    zoneId: 'Z-004', zoneCode: 'STAG', zoneName: 'Zona de Staging',
    locationType: 'STAGING', logisticFunction: 'DISPATCH',
    maxCapacity: 10, capacityUnit: 'PALLET',
    currentOccupancy: 2, occupancyPercentage: 20, availableCapacity: 8,
    isStorageAllowed: false, status: 'ACTIVE',
    createdAt: '2026-01-10T08:00:00Z', updatedAt: '2026-04-18T10:00:00Z',
    updatedBy: 'admin@4guard.mx', lastAction: 'UPDATE',
    canDelete: false, canDeactivate: true, canBlock: true, canReactivate: false,
  },
];

/** MOCK: Historial de auditoría (pendiente implementación real) */
const MOCK_AUDIT_BY_LOCATION: Record<string, LocationAuditEntry[]> = {
  'LOC-001': [
    {
      id: 'AUD-001', locationId: 'LOC-001', action: 'UPDATE',
      performedBy: 'juan.garcia@4guard.mx', performedAt: '2026-07-10T14:22:00Z',
      changes: { maxCapacity: { from: 3, to: 4 } },
    },
    {
      id: 'AUD-002', locationId: 'LOC-001', action: 'CREATE',
      performedBy: 'admin@4guard.mx', performedAt: '2026-01-10T08:00:00Z',
    },
  ],
};

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** Store en memoria para el mock — sustituir por HttpClient en producción */
  private mockStore: WarehouseLocation[] = [...MOCK_LOCATIONS];
  private nextId = 10;

  // ── Consultas ──────────────────────────────────────────────────────────────

  /** Retorna la lista completa de ubicaciones del almacén */
  getLocations(): Observable<WarehouseLocation[]> {
    return of([...this.mockStore]).pipe(delay(600));
  }

  /** Retorna las zonas disponibles del almacén */
  getZones(): Observable<WarehouseZone[]> {
    return of([...MOCK_ZONES]).pipe(delay(300));
  }

  /** Retorna una ubicación por ID */
  getLocationById(id: string): Observable<WarehouseLocation> {
    const loc = this.mockStore.find(l => l.id === id);
    if (!loc) {
      return throwError(() => new Error(`Ubicación ${id} no encontrada`));
    }
    return of({ ...loc }).pipe(delay(300));
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  /** Crea una nueva ubicación */
  createLocation(payload: CreateLocationPayload): Observable<WarehouseLocation> {
    // Validación de código único (el backend real responderá 409)
    const exists = this.mockStore.some(
      l => l.code.toLowerCase() === payload.code.toLowerCase()
    );
    if (exists) {
      return throwError(() => ({
        status: 409,
        message: `El código "${payload.code}" ya existe. Usa un código único.`,
      }));
    }

    const now = new Date().toISOString();
    const newLoc: WarehouseLocation = {
      ...payload,
      id: `LOC-${String(this.nextId++).padStart(3, '0')}`,
      status: 'ACTIVE',
      currentOccupancy: 0,
      occupancyPercentage: 0,
      availableCapacity: payload.maxCapacity,
      createdAt: now,
      updatedAt: now,
      updatedBy: 'sesión-activa@4guard.mx', // Backend lo resuelve desde JWT
      lastAction: 'CREATE',
      canDelete: true,
      canDeactivate: true,
      canBlock: true,
      canReactivate: false,
    };

    this.mockStore = [...this.mockStore, newLoc];
    return of({ ...newLoc }).pipe(delay(700));
  }

  /** Edita una ubicación existente */
  updateLocation(id: string, payload: UpdateLocationPayload): Observable<WarehouseLocation> {
    const idx = this.mockStore.findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => new Error(`Ubicación ${id} no encontrada`));
    }

    // Validación de código único (excluye la propia ubicación)
    const codeConflict = this.mockStore.some(
      l => l.code.toLowerCase() === payload.code.toLowerCase() && l.id !== id
    );
    if (codeConflict) {
      return throwError(() => ({
        status: 409,
        message: `El código "${payload.code}" ya está en uso por otra ubicación.`,
      }));
    }

    const existing = this.mockStore[idx];
    const updated: WarehouseLocation = {
      ...existing,
      ...payload,
      // La ocupación no cambia al editar la configuración
      currentOccupancy:    existing.currentOccupancy,
      occupancyPercentage: existing.occupancyPercentage,
      availableCapacity:   (payload.maxCapacity ?? existing.maxCapacity) - (existing.currentOccupancy ?? 0),
      updatedAt:   new Date().toISOString(),
      updatedBy:   'sesión-activa@4guard.mx', // Backend lo resuelve
      lastAction:  'UPDATE',
    };

    this.mockStore = [
      ...this.mockStore.slice(0, idx),
      updated,
      ...this.mockStore.slice(idx + 1),
    ];
    return of({ ...updated }).pipe(delay(700));
  }

  /** Cambia el estado FSM de una ubicación */
  changeStatus(id: string, payload: ChangeStatusPayload): Observable<WarehouseLocation> {
    const idx = this.mockStore.findIndex(l => l.id === id);
    if (idx === -1) {
      return throwError(() => new Error(`Ubicación ${id} no encontrada`));
    }

    const existing = this.mockStore[idx];
    const newStatus = payload.status;

    // Recalcular flags según el nuevo estado
    const flags = this._calcFlags(newStatus, existing.currentOccupancy ?? 0);

    const updated: WarehouseLocation = {
      ...existing,
      status:    newStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: 'sesión-activa@4guard.mx',
      lastAction: 'STATUS_CHANGE',
      observations: payload.reason
        ? `${payload.reason}`
        : existing.observations,
      ...flags,
    };

    this.mockStore = [
      ...this.mockStore.slice(0, idx),
      updated,
      ...this.mockStore.slice(idx + 1),
    ];
    return of({ ...updated }).pipe(delay(600));
  }

  /** Elimina una ubicación (solo si canDelete === true) */
  deleteLocation(id: string): Observable<void> {
    const loc = this.mockStore.find(l => l.id === id);
    if (!loc) {
      return throwError(() => new Error(`Ubicación ${id} no encontrada`));
    }
    if (!loc.canDelete) {
      return throwError(() => ({
        status: 409,
        message: 'No es posible eliminar esta ubicación porque tiene movimientos o dependencias registradas. Usa la opción "Desactivar".',
      }));
    }
    this.mockStore = this.mockStore.filter(l => l.id !== id);
    return of(undefined).pipe(delay(500));
  }

  // ── Auditoría ──────────────────────────────────────────────────────────────

  /** Retorna el historial de auditoría de una ubicación */
  getLocationHistory(id: string): Observable<LocationAuditEntry[]> {
    const history = MOCK_AUDIT_BY_LOCATION[id] ?? [];
    return of([...history]).pipe(delay(400));
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private _calcFlags(
    status: LocationStatus,
    currentOccupancy: number
  ): Pick<WarehouseLocation, 'canDelete' | 'canDeactivate' | 'canBlock' | 'canReactivate'> {
    return {
      canDelete:     status === 'INACTIVE' && currentOccupancy === 0,
      canDeactivate: status === 'ACTIVE',
      canBlock:      status === 'ACTIVE',
      canReactivate: status !== 'ACTIVE',
    };
  }
}
