import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WarehouseLayoutRepositoryPort } from '../ports/warehouse-layout.repository.port';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus
} from '../models/warehouse-layout.models';

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

  // Fallback cache local en caso de desconexión de red
  private readonly STORAGE_KEY = '4guard_warehouse_layout_resilience_cache';

  getSections(): Observable<WarehouseSection[]> {
    const branchId = (environment as any).defaultBranchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    const params = new HttpParams().set('branchId', branchId);

    return this.http.get<ApiResponse<{ sections: any[] }>>(`${this.baseUrl}/topology`, { params }).pipe(
      map(res => {
        const sections = res.data.sections.map(s => this.mapSectionFromBackend(s));
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sections));
        } catch {}
        return sections;
      }),
      catchError(err => {
        console.warn('Fallo conexión HTTP con Backend, recuperando cache de resiliencia...', err);
        const cached = localStorage.getItem(this.STORAGE_KEY);
        return cached ? of(JSON.parse(cached)) : throwError(() => err);
      })
    );
  }

  getPositionsForSection(sectionId: string, status?: string, query?: string): Observable<PositionDetail[]> {
    let params = new HttpParams();
    if (status && status !== 'ALL') params = params.set('status', status);
    if (query && query.trim()) params = params.set('search', query.trim());

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/sections/${sectionId}/positions`, { params }).pipe(
      map(res => res.data.map(p => this.mapPositionFromBackend(p)))
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
      map(res => res.data.map(r => r.description)),
      catchError(() => of([
        'Cuarentena QM — Sospecha de contaminación',
        'Cuarentena QM — Inspección de calidad en proceso',
        'Mantenimiento — Reparación de rack o estructura',
        'Bloqueo administrativo — Pendiente de revisión por supervisor'
      ]))
    );
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
      blockReason: raw.blockReason
    };
  }
}
