/**
 * @file warehouse-location.model.ts
 * @description Modelos de dominio para el módulo de Gestión de Layout y Ubicaciones.
 * HU-127 — 4GUARD WMS
 *
 * IMPORTANTE: Este módulo es el maestro de configuración de ubicaciones.
 * Los datos de ocupación (currentOccupancy, occupancyPercentage, availableCapacity)
 * son de SOLO LECTURA y provienen del módulo de Inventario.
 */

// ── Enums de tipo ─────────────────────────────────────────────────────────────

/** Tipo de estructura física de la ubicación */
export type LocationType =
  | 'RACK'      // Rack de almacenamiento vertical
  | 'FLOOR'     // Almacenamiento en piso (floor storage)
  | 'STAGING'   // Zona de preparación/staging
  | 'RAMP'      // Rampa de recepción/despacho
  | 'DOCK';     // Andén (dock)

/** Función logística principal de la ubicación */
export type LogisticFunction =
  | 'STORAGE'   // Almacenamiento regular
  | 'RECEIVING' // Recepción de mercancía
  | 'DISPATCH'  // Despacho / Embarque
  | 'QUALITY'   // Control de calidad / Cuarentena
  | 'OVERFLOW'; // Desbordamiento temporal

/** Estado FSM de la ubicación */
export type LocationStatus =
  | 'ACTIVE'       // Operativa y disponible
  | 'BLOCKED'      // Bloqueada (requiere motivo)
  | 'MAINTENANCE'  // En mantenimiento (requiere motivo)
  | 'INACTIVE';    // Desactivada

/** Unidad de capacidad — tipo controlado, NO string libre */
export type CapacityUnit =
  | 'PALLET'       // Tarimas
  | 'BOX'          // Cajas
  | 'KILOGRAM'     // Kilogramos
  | 'POSITION'     // Posiciones
  | 'CUBIC_METER'; // Metros cúbicos

// ── Etiquetas UI ──────────────────────────────────────────────────────────────

export const CAPACITY_UNIT_LABELS: Record<CapacityUnit, string> = {
  PALLET:      'Tarimas',
  BOX:         'Cajas',
  KILOGRAM:    'Kilogramos',
  POSITION:    'Posiciones',
  CUBIC_METER: 'Metros cúbicos',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  RACK:    'Rack',
  FLOOR:   'Piso',
  STAGING: 'Staging',
  RAMP:    'Rampa',
  DOCK:    'Andén',
};

export const LOGISTIC_FUNCTION_LABELS: Record<LogisticFunction, string> = {
  STORAGE:   'Almacenamiento',
  RECEIVING: 'Recepción',
  DISPATCH:  'Despacho',
  QUALITY:   'Control de Calidad',
  OVERFLOW:  'Desbordamiento',
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
 * Los campos de auditoría y ocupación son SOLO LECTURA desde el frontend.
 * El backend los calcula y los entrega en la respuesta.
 */
export interface WarehouseLocation {
  id: string;
  code: string;        // Obligatorio, único. Ej: "PA-01-R1-N2"
  name: string;        // Nombre descriptivo. Ej: "Pasillo A – Bahía 01"

  // Relaciones con entidades externas (preparadas para backend real)
  warehouseId: string;
  warehouseName: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;

  // Jerarquía física (opcionales según el tipo)
  aisle?: string;      // Pasillo (A, B, C...)
  bay?: string;        // Bahía (01, 02...)
  rack?: string;       // Rack (R1, R2...)
  level?: string;      // Nivel (N1, N2...)
  position?: string;   // Posición (P1, P2...)

  // Clasificación
  locationType: LocationType;
  logisticFunction: LogisticFunction;

  // Capacidad
  maxCapacity: number;       // Editable por el Gerente
  capacityUnit: CapacityUnit;

  // Ocupación — SOLO LECTURA (proviene del módulo de Inventario)
  currentOccupancy?: number;
  occupancyPercentage?: number;  // Calculado: currentOccupancy / maxCapacity * 100
  availableCapacity?: number;    // Calculado: maxCapacity - currentOccupancy

  // Configuración
  isStorageAllowed: boolean;   // false = solo tránsito, no almacenamiento

  // Estado FSM
  status: LocationStatus;
  observations?: string;

  // Auditoría — SOLO LECTURA, generada por el backend transaccionalmente
  createdAt: string;
  updatedAt: string;
  updatedBy: string;   // Backend lo resuelve desde JWT, el frontend NO lo envía
  lastAction: string;

  // Permisos condicionales — el backend determina qué acciones están disponibles
  canDelete?: boolean;
  canDeactivate?: boolean;
  canBlock?: boolean;
  canReactivate?: boolean;
}

/**
 * Entrada del historial de auditoría de una ubicación.
 */
export interface LocationAuditEntry {
  id: string;
  locationId: string;
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'DELETE';
  performedBy: string;
  performedAt: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
}

// ── Payloads de escritura ─────────────────────────────────────────────────────
// El frontend NO envía campos de auditoría. El backend los genera.

/** Payload para crear una nueva ubicación */
export interface CreateLocationPayload {
  code: string;
  name: string;
  warehouseId: string;
  warehouseName: string;
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  aisle?: string;
  bay?: string;
  rack?: string;
  level?: string;
  position?: string;
  locationType: LocationType;
  logisticFunction: LogisticFunction;
  maxCapacity: number;
  capacityUnit: CapacityUnit;
  isStorageAllowed: boolean;
  observations?: string;
}

/** Payload para editar una ubicación existente */
export type UpdateLocationPayload = CreateLocationPayload;

/** Payload para cambiar el estado FSM de una ubicación */
export interface ChangeStatusPayload {
  status: LocationStatus;
  reason?: string; // Obligatorio para BLOCKED y MAINTENANCE
}

// ── Árbol jerárquico ──────────────────────────────────────────────────────────

/** Nodo del árbol jerárquico — construido dinámicamente desde los datos */
export interface LocationTreeNode {
  id: string;                  // ID único del nodo agrupador o de la ubicación
  label: string;
  level: 'zone' | 'aisle' | 'bay' | 'leaf';
  isExpanded: boolean;
  count: number;               // Total de ubicaciones hijas (recursivo)
  statusSummary: {             // Resumen de estados de ubicaciones hijas
    active: number;
    blocked: number;
    maintenance: number;
    inactive: number;
  };
  children: LocationTreeNode[];
  location?: WarehouseLocation; // Solo en nodos hoja (leaf)
}

// ── Zonas mock (DATOS DEMO — pendientes de validación con 4GUARD) ─────────────

/** Zona del almacén para el selector del formulario */
export interface WarehouseZone {
  id: string;
  code: string;
  name: string;
}

// ── FSM: transiciones permitidas ─────────────────────────────────────────────

/** Mapa de transiciones válidas de estado */
export const LOCATION_FSM_TRANSITIONS: Record<LocationStatus, LocationStatus[]> = {
  ACTIVE:      ['BLOCKED', 'MAINTENANCE', 'INACTIVE'],
  BLOCKED:     ['ACTIVE'],
  MAINTENANCE: ['ACTIVE'],
  INACTIVE:    ['ACTIVE'],
};

/** Transiciones que requieren un motivo obligatorio */
export const STATUS_REQUIRES_REASON: Partial<Record<LocationStatus, boolean>> = {
  BLOCKED:     true,
  MAINTENANCE: true,
};
