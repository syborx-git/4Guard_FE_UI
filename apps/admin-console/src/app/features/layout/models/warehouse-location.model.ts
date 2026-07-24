/**
 * @file warehouse-location.model.ts
 * @description Modelos de dominio para el módulo de Gestión de Layout y Ubicaciones.
 * HU-127 — 4GUARD WMS
 */

// ── Enums de tipo ─────────────────────────────────────────────────────────────

/** Tipo de estructura física de la ubicación (según BE spec) */
export type LocationType =
  | 'PALLET' // Rack de tarimas / pallets
  | 'BIN'    // Gaveta / bin de almacenamiento pequeño
  | 'SHELF'  // Estantería / repisa
  | 'RAMP';  // Rampa de recepción/despacho

/** Estado FSM de la ubicación */
export type LocationStatus =
  | 'ACTIVE'       // Operativa y disponible
  | 'BLOCKED'      // Bloqueada (requiere motivo)
  | 'MAINTENANCE'  // En mantenimiento (requiere motivo)
  | 'INACTIVE';    // Desactivada

// ── Etiquetas UI ──────────────────────────────────────────────────────────────

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  PALLET: 'Pallet / Tarima',
  BIN:    'Bin / Gaveta',
  SHELF:  'Shelf / Estantería',
  RAMP:   'Rampa',
};

export const LOCATION_STATUS_LABELS: Record<LocationStatus, string> = {
  ACTIVE:      'Activa',
  BLOCKED:     'Bloqueada',
  MAINTENANCE: 'Mantenimiento',
  INACTIVE:    'Inactiva',
};

// ── Interfaces de dominio ─────────────────────────────────────────────────────

/**
 * Ubicación física del almacén.
 */
export interface WarehouseLocation {
  id: string;
  code: string;        // Único. Ej: "ALMC-A-R1-N2"
  name: string;        // Nombre descriptivo. Ej: "Pasillo A – Rack 1 – Nivel 2"

  // Relaciones
  warehouseId: string;
  warehouseName: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;

  // Jerarquía física
  aisle?: string;      // Pasillo (A, B, C...)
  rack?: string;       // Rack (R1, R2...)
  level?: string;      // Nivel (N1, N2...)
  position?: string;   // Posición (P1, P2...)
  coordX?: number;
  coordY?: number;
  coordZ?: number;

  // Clasificación
  locationType: LocationType;

  // Capacidad
  maxCapacity: number;

  // Ocupación — SOLO LECTURA
  currentOccupancy?: number;
  occupancyPercentage?: number;  // Calculado: currentOccupancy / maxCapacity * 100
  availableCapacity?: number;    // Calculado: maxCapacity - currentOccupancy

  // Estado FSM
  status: LocationStatus;
  observations?: string;

  // Auditoría — SOLO LECTURA
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  lastAction: string;

  // Permisos condicionales
  canDelete?: boolean;
  canDeactivate?: boolean;
  canBlock?: boolean;
  canReactivate?: boolean;
}

export interface LocationAuditDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

/**
 * Entrada del historial de auditoría de una ubicación.
 */
export interface LocationAuditEntry {
  id: string;
  locationId?: string;
  action: string;
  summary?: string;
  performedBy: string;
  performedAt: string;
  username?: string;
  createdAt?: string;
  details?: LocationAuditDetail[];
  reason?: string;
  timelineIcon?: string;
  timelineColor?: 'create' | 'update' | 'status' | 'delete' | 'info';
}

// ── Payloads de escritura ─────────────────────────────────────────────────────

/** Payload para crear/editar una ubicación en Layout Management */
export interface CreateLocationPayload {
  code: string;
  name: string;
  warehouseId: string;
  warehouseName?: string;
  zoneId: string;
  zoneCode?: string;
  zoneName?: string;
  aisle?: string;
  rack?: string;
  level?: string;
  position?: string;
  coordX?: number;
  coordY?: number;
  coordZ?: number;
  locationType: LocationType;
  maxCapacity: number;
  observations?: string;
}

export type UpdateLocationPayload = CreateLocationPayload;

/** Payload para cambiar el estado FSM de una ubicación */
export interface ChangeStatusPayload {
  status: LocationStatus;
  reason?: string; // Obligatorio para BLOCKED y MAINTENANCE
}

// ── Árbol jerárquico ──────────────────────────────────────────────────────────

/** Nodo del árbol jerárquico */
export interface LocationTreeNode {
  id: string;                  // ID único del nodo
  label: string;
  level: 'zone' | 'aisle' | 'rack' | 'leaf';
  isExpanded: boolean;
  count: number;               // Total de ubicaciones hijas (recursivo)
  statusSummary: {
    active: number;
    blocked: number;
    maintenance: number;
    inactive: number;
  };
  children: LocationTreeNode[];
  location?: WarehouseLocation; // Solo en nodos hoja (leaf)
}

/** Zona del almacén para el selector del formulario */
export interface WarehouseZone {
  id: string;
  code: string;
  name: string;
}

// ── FSM: transiciones permitidas ─────────────────────────────────────────────

export const LOCATION_FSM_TRANSITIONS: Record<LocationStatus, LocationStatus[]> = {
  ACTIVE:      ['BLOCKED', 'MAINTENANCE', 'INACTIVE'],
  BLOCKED:     ['ACTIVE'],
  MAINTENANCE: ['ACTIVE'],
  INACTIVE:    ['ACTIVE'],
};

export const STATUS_REQUIRES_REASON: Partial<Record<LocationStatus, boolean>> = {
  BLOCKED:     true,
  MAINTENANCE: true,
};

