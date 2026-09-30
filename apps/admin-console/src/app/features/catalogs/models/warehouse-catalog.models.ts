/**
 * @file warehouse-catalog.models.ts
 * @description Modelos e interfaces unificados para el Catálogo de Almacén, Topología 2D y Consulta de Bahías.
 * Mapea las 11 naves reales y 885-915 posiciones físicas de PostgreSQL [HU-048 / HU-127].
 */

export type SectionStatus = 'LOADED' | 'PENDING';

export type PositionStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'MAINTENANCE';

export interface PositionDetail {
  id: string;             // UUID de la ubicación en BD o código
  positionNumber: number; // Número ordinal 1..N
  code: string;           // Código de ubicación (ej. 'POS-A-001', 'A-01')
  sectionId: string;      // UUID de la sección/almacén
  sectionName: string;    // Nombre descriptivo de la nave
  skuCode?: string;
  skuDescription: string;
  status: PositionStatus;
  capacityTarimas: number;
  currentTarimas: number;
  batchNumber?: string;
  lastMovement?: string;
  blockReason?: string;
}

export interface WarehouseSection {
  id: string;                  // UUID de la sección
  code: string;                // 'A', 'E', 'F (D)', 'G', 'I', 'J(C)', 'L', 'K', 'B', 'C', 'H'
  name: string;
  category: string;
  posFijas: number;
  capacidadTarimas: number;
  factorEstiba: string;
  materials: string[];
  notes: string;
  status: SectionStatus;
  polygonPoints: string;
  labelPosition: { x: number; y: number };
  sublabelPosition: { x: number; y: number };
  positions?: PositionDetail[];
}

export interface WarehouseLayoutStats {
  totalSections: number;
  loadedSections: number;
  pendingSections: number;
  totalPositions: number;
  totalCapacityTarimas: number;
  occupiedPositions: number;
  blockedPositions: number;
}

export interface WarehouseTopologyData {
  sections: WarehouseSection[];
  stats: WarehouseLayoutStats;
}

// Compatibilidad y vistas tabulares de Consulta de Bahías
export type BayOccupancyStatus = 'DESOCUPADA' | 'PARCIAL' | 'SATURADA' | 'BLOQUEADA';

export interface WarehouseBay {
  id: string;
  bayCode: string;
  warehouseZone: string;
  warehouseZoneName: string;
  description: string;
  capacityPallets: number;
  occupiedPallets: number;
  occupancyPercentage: number;
  status: BayOccupancyStatus;
  skuStored?: string;
  lotStored?: string;
  lastMovement: string;
  rawPosition: PositionDetail;
}

export interface InitializeSectionRequest {
  category: string;
  posFijas: number;
  capacidadTarimas: number;
  factorEstiba: string;
  notes?: string;
  generateLocations?: boolean;
  authorizedSkuIds?: string[];
}
