/**
 * @file warehouse-layout.models.ts
 * @description Modelos para la topología física, geometría SVG y posiciones del Almacén General 4GUARD WMS.
 */

export type SectionStatus = 'LOADED' | 'PENDING';

export type PositionStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'MAINTENANCE';

export interface PositionDetail {
  id: string;             // e.g. 'POS-A-001'
  positionNumber: number; // 1..170
  code: string;           // e.g. 'POS-001'
  sectionId: string;      // e.g. 'A'
  sectionName: string;
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
  id: string;                  // 'A', 'E', 'F (D)', 'G', 'I', 'J(C)', 'L', 'K', 'B', 'C', 'H'
  code: string;                // 'A', 'E', etc.
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
