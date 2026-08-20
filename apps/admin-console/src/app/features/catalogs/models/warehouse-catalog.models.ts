/**
 * @file warehouse-catalog.models.ts
 * @description Modelos e interfaces para el Catálogo de Almacén y Topología de Posiciones.
 * Mapea fielmente las 6 bodegas reales de 4Guard WMS.
 */

export type WarehouseZoneCode = 'A' | 'APC' | 'AT' | 'B' | 'BPC' | 'BT';

export interface WarehouseZoneInfo {
  code: WarehouseZoneCode;
  name: string;
  description: string;
  totalPositions: number;
  prefix: string;
  type: 'ALMACENAMIENTO_GENERAL' | 'STAGING_PRECARGA' | 'SATURACION_TEMPORAL';
}

export const WAREHOUSE_ZONES: WarehouseZoneInfo[] = [
  {
    code: 'A',
    name: 'Bodega A',
    description: 'Almacén Principal A (175 Posiciones fijas)',
    totalPositions: 175,
    prefix: 'A-',
    type: 'ALMACENAMIENTO_GENERAL',
  },
  {
    code: 'APC',
    name: 'Bodega APC (Pre-Carga)',
    description: 'Área de Pre-Carga y Staging Outbound (6 Posiciones)',
    totalPositions: 6,
    prefix: 'APC-',
    type: 'STAGING_PRECARGA',
  },
  {
    code: 'AT',
    name: 'Bodega AT (Saturación Nestlé)',
    description: 'Área de Saturación Temporal Nestlé (46 Posiciones)',
    totalPositions: 46,
    prefix: 'AT-',
    type: 'SATURACION_TEMPORAL',
  },
  {
    code: 'B',
    name: 'Bodega B',
    description: 'Almacén Secundario B (37 Posiciones)',
    totalPositions: 37,
    prefix: 'B-',
    type: 'ALMACENAMIENTO_GENERAL',
  },
  {
    code: 'BPC',
    name: 'Bodega BPC',
    description: 'Pre-Carga Secundarias (6 Posiciones)',
    totalPositions: 6,
    prefix: 'BPC-',
    type: 'STAGING_PRECARGA',
  },
  {
    code: 'BT',
    name: 'Bodega BT',
    description: 'Saturación Temporal B (12 Posiciones)',
    totalPositions: 12,
    prefix: 'BT-',
    type: 'SATURACION_TEMPORAL',
  },
];

export type BayOccupancyStatus = 'DESOCUPADA' | 'PARCIAL' | 'SATURADA';

export interface WarehouseBay {
  id: string;
  bayCode: string; // e.g. A-1, APC-3, AT-24
  warehouseZone: WarehouseZoneCode;
  description: string;
  capacityPallets: number;
  occupiedPallets: number;
  occupancyPercentage: number;
  status: BayOccupancyStatus;
  skuStored?: string;
  lotStored?: string;
  lastMovement: string;
}
