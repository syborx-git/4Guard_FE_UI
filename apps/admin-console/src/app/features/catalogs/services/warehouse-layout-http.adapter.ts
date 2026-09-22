import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  WarehouseLayoutRepositoryPort
} from '../ports/warehouse-layout.repository.port';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats,
  WarehouseTopologyData
} from '../models/warehouse-catalog.models';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseLayoutHttpAdapter implements WarehouseLayoutRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/v1/warehouse-map`;

  getTopology(): Observable<WarehouseTopologyData> {
    const branchId = (environment as any).defaultBranchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    const params = new HttpParams().set('branchId', branchId);

    return this.http.get<ApiResponse<{ sections: any[]; globalStats: any }>>(`${this.baseUrl}/topology`, { params }).pipe(
      map(res => ({
        sections: (res.data?.sections || []).map(s => this.mapSectionFromBackend(s)),
        stats: this.mapStatsFromBackend(res.data?.globalStats)
      }))
    );
  }

  getSections(): Observable<WarehouseSection[]> {
    return this.getTopology().pipe(map(data => data.sections));
  }

  getPositionsForSection(sectionId: string, status?: string, query?: string): Observable<PositionDetail[]> {
    let params = new HttpParams();
    if (status && status !== 'ALL') params = params.set('status', status);
    if (query && query.trim()) params = params.set('search', query.trim());

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/sections/${sectionId}/positions`, { params }).pipe(
      map(res => (res.data || []).map(p => this.mapPositionFromBackend(p)))
    );
  }

  getAllPositions(sectionId?: string, status?: string, query?: string): Observable<PositionDetail[]> {
    const branchId = (environment as any).defaultBranchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    let params = new HttpParams().set('branchId', branchId);
    if (sectionId && sectionId !== 'ALL') params = params.set('sectionId', sectionId);
    if (status && status !== 'ALL') params = params.set('status', status);
    if (query && query.trim()) params = params.set('search', query.trim());

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/positions`, { params }).pipe(
      map(res => (res.data || []).map(p => this.mapPositionFromBackend(p)))
    );
  }

  updatePositionStatus(
    positionId: string,
    action: 'BLOCK' | 'RELEASE' | 'OCCUPY',
    meta: { reasonCode?: string; comment?: string } = {}
  ): Observable<PositionDetail> {
    const payload = {
      targetAction: action,
      reasonCode: meta.reasonCode,
      comment: meta.comment
    };

    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/positions/${positionId}/status`, payload).pipe(
      map(res => this.mapPositionFromBackend(res.data))
    );
  }

  getBlockReasons(): Observable<string[]> {
    return this.http.get<ApiResponse<{ code: string; description: string }[]>>(`${this.baseUrl}/catalogs/block-reasons`).pipe(
      map(res => (res.data || []).map(r => r.description))
    );
  }

  private mapStatsFromBackend(raw: any): WarehouseLayoutStats {
    if (!raw) {
      return {
        totalSections: 0,
        loadedSections: 0,
        pendingSections: 0,
        totalPositions: 0,
        totalCapacityTarimas: 0,
        occupiedPositions: 0,
        blockedPositions: 0
      };
    }
    return {
      totalSections: raw.totalSections ?? 0,
      loadedSections: raw.loadedSections ?? 0,
      pendingSections: raw.pendingSections ?? 0,
      totalPositions: raw.totalPositions ?? 0,
      totalCapacityTarimas: raw.totalCapacityTarimas ?? 0,
      occupiedPositions: raw.occupiedPositions ?? 0,
      blockedPositions: raw.blockedPositions ?? 0
    };
  }

  private mapSectionFromBackend(raw: any): WarehouseSection {
    return {
      id: raw.id,
      code: raw.code ? raw.code.replace('SEC-ALM-', '') : raw.name,
      name: raw.name,
      category: raw.category || 'General',
      posFijas: raw.posFijas || 0,
      capacidadTarimas: raw.capacidadTarimas || 0,
      factorEstiba: raw.factorEstiba || '22 tarimas/pos',
      materials: raw.materials || [],
      notes: raw.notes || '',
      status: raw.status === 'LOADED' ? 'LOADED' : 'PENDING',
      polygonPoints: raw.polygonPoints || '',
      labelPosition: { x: Number(raw.labelPosition?.x || 0), y: Number(raw.labelPosition?.y || 0) },
      sublabelPosition: { x: Number(raw.sublabelPosition?.x || 0), y: Number(raw.sublabelPosition?.y || 0) }
    };
  }

  private mapPositionFromBackend(raw: any): PositionDetail {
    return {
      id: raw.id,
      positionNumber: raw.positionNumber,
      code: raw.code,
      sectionId: raw.sectionId,
      sectionName: raw.sectionName,
      skuCode: raw.skuCode,
      skuDescription: raw.skuDescription || 'Sin Material Asignado',
      status: raw.status as PositionStatus,
      capacityTarimas: raw.capacityTarimas,
      currentTarimas: raw.currentTarimas,
      batchNumber: raw.batchNumber || 'N/A',
      lastMovement: raw.lastMovement || 'Sin movimientos',
      blockReason: raw.blockReason || (raw.isBlocked ? raw.statusReason : undefined)
    };
  }
}
