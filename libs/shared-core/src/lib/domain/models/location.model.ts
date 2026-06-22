/**
 * @file location.model.ts
 * @description Modelo de dominio para Ubicaciones dentro del almacén.
 * Soporta coordenadas 2D y 3D para el mapa del almacén en admin-console.
 */

/**
 * Tipos de ubicación en el almacén.
 */
export enum LocationType {
  /** Rack de almacenamiento estándar */
  RACK = 'RACK',
  /** Zona de andén de recepción */
  DOCK_RECEIVING = 'DOCK_RECEIVING',
  /** Zona de andén de despacho */
  DOCK_SHIPPING = 'DOCK_SHIPPING',
  /** Zona de staging/preparación de pedidos */
  STAGING = 'STAGING',
  /** Zona de cuarentena QM */
  QUARANTINE_ZONE = 'QUARANTINE_ZONE',
  /** Zona de devoluciones */
  RETURNS = 'RETURNS',
  /** Almacenamiento refrigerado */
  COLD_STORAGE = 'COLD_STORAGE',
}

/**
 * Coordenadas 2D para el mapa SVG del almacén.
 */
export interface Coordinates2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Coordenadas 3D para visualización Three.js.
 */
export interface Coordinates3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Ubicación física dentro del almacén.
 * Mapea el DTO LocationResponseDto del backend.
 */
export interface Location {
  /** Identificador único (UUID) */
  id: string;

  /** Código legible de la ubicación (ej: "A-01-02-3" = Pasillo-Fila-Columna-Nivel) */
  code: string;

  /** Tipo de zona */
  type: LocationType;

  /** ID de la sucursal */
  branchId: string;

  /** Pasillo (Aisle) */
  aisle: string;

  /** Fila dentro del pasillo */
  row: number;

  /** Columna dentro de la fila */
  column: number;

  /** Nivel/altura del rack (1 = piso) */
  level: number;

  /** Capacidad máxima en unidades */
  maxCapacity: number;

  /** Cantidad actual de ítems */
  currentOccupancy: number;

  /** Indica si la ubicación está bloqueada para operaciones */
  isBlocked: boolean;

  /** Coordenadas para el mapa 2D (SVG) */
  coords2D: Coordinates2D | null;

  /** Coordenadas para el mapa 3D */
  coords3D: Coordinates3D | null;

  /** Restricciones de almacenamiento (temperatura, etc.) */
  restrictions: string[];

  /** Fecha de creación (ISO 8601) */
  createdAt: string;
}

/**
 * Porcentaje de ocupación de una ubicación.
 */
export function getOccupancyPercent(location: Location): number {
  if (location.maxCapacity === 0) return 0;
  return Math.round((location.currentOccupancy / location.maxCapacity) * 100);
}
