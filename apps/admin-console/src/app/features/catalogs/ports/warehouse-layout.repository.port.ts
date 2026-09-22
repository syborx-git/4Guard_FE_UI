import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  WarehouseSection,
  PositionDetail,
  WarehouseTopologyData
} from '../models/warehouse-catalog.models';

export interface WarehouseLayoutRepositoryPort {
  getTopology(): Observable<WarehouseTopologyData>;
  getSections(): Observable<WarehouseSection[]>;
  getPositionsForSection(sectionId: string, status?: string, query?: string): Observable<PositionDetail[]>;
  getAllPositions(sectionId?: string, status?: string, query?: string): Observable<PositionDetail[]>;
  updatePositionStatus(
    positionId: string,
    action: 'BLOCK' | 'RELEASE' | 'OCCUPY',
    meta?: { reasonCode?: string; comment?: string }
  ): Observable<PositionDetail>;
  getBlockReasons(): Observable<string[]>;
}

export const WAREHOUSE_LAYOUT_REPOSITORY = new InjectionToken<WarehouseLayoutRepositoryPort>(
  'WAREHOUSE_LAYOUT_REPOSITORY'
);
