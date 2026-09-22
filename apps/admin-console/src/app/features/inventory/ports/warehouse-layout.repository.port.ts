import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  WarehouseSection,
  PositionDetail
} from '../models/warehouse-layout.models';

export interface WarehouseLayoutRepositoryPort {
  getSections(): Observable<WarehouseSection[]>;
  getPositionsForSection(sectionId: string, status?: string, query?: string): Observable<PositionDetail[]>;
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
