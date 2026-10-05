import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  WarehouseLayoutRepositoryPort
} from '../ports/warehouse-layout.repository.port';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats,
  WarehouseTopologyData,
  InitializeSectionRequest
} from '../models/warehouse-catalog.models';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const SEED_SECTIONS: WarehouseSection[] = [
  {
    id: 'sec-a',
    code: 'A',
    name: 'Nave A — Recepción Primaria & PT',
    category: 'Materia Prima / PT',
    posFijas: 110,
    capacidadTarimas: 2420,
    factorEstiba: '22 tarimas/pos',
    materials: ['LALA-MILK-1L · Leche Entera 1L'],
    notes: 'Zona de alta rotación en andén principal.',
    status: 'LOADED',
    polygonPoints: '265,125 588,125 588,365 265,365',
    labelPosition: { x: 426, y: 235 },
    sublabelPosition: { x: 426, y: 260 }
  },
  {
    id: 'sec-e',
    code: 'E',
    name: 'Nave E — Almacenamiento General',
    category: 'Almacenamiento Racks',
    posFijas: 95,
    capacidadTarimas: 2090,
    factorEstiba: '22 tarimas/pos',
    materials: ['BIMBO-BREAD-680G · Pan Cero Cero'],
    notes: 'Posiciones en rack con temperatura ambiente.',
    status: 'LOADED',
    polygonPoints: '602,125 783,125 783,365 602,365',
    labelPosition: { x: 692, y: 235 },
    sublabelPosition: { x: 692, y: 260 }
  },
  {
    id: 'sec-f',
    code: 'F (D)',
    name: 'Nave F (D) — Cuarentena & Calidad QM',
    category: 'Inspección QA / QM',
    posFijas: 85,
    capacidadTarimas: 1870,
    factorEstiba: '22 tarimas/pos',
    materials: ['NESP-CAPS-10P · Cápsulas Nespresso'],
    notes: 'Posiciones restringidas para auditoría QM.',
    status: 'LOADED',
    polygonPoints: '797,125 890,125 890,365 797,365',
    labelPosition: { x: 843, y: 235 },
    sublabelPosition: { x: 843, y: 260 }
  },
  {
    id: 'sec-g',
    code: 'G',
    name: 'Nave G — Zona de Despacho & Staging',
    category: 'Outbound Staging',
    posFijas: 120,
    capacidadTarimas: 2640,
    factorEstiba: '22 tarimas/pos',
    materials: ['SGM-JUICE-1L · Jugo del Valle'],
    notes: 'Staging previo a embarque.',
    status: 'LOADED',
    polygonPoints: '897,125 973,125 973,365 897,365',
    labelPosition: { x: 935, y: 235 },
    sublabelPosition: { x: 935, y: 260 }
  },
  {
    id: 'sec-i',
    code: 'I',
    name: 'Nave I — Pasillo Central Racks',
    category: 'Rack Alta Densidad',
    posFijas: 105,
    capacidadTarimas: 2310,
    factorEstiba: '22 tarimas/pos',
    materials: ['ALP-YOG-250G · Yogurt Alpura'],
    notes: 'Almacén central nave I.',
    status: 'LOADED',
    polygonPoints: '265,375 588,375 588,660 265,660',
    labelPosition: { x: 426, y: 505 },
    sublabelPosition: { x: 426, y: 530 }
  },
  {
    id: 'sec-j',
    code: 'J (C)',
    name: 'Nave J (C) — Congelados & Refrigerados',
    category: 'Cadena de Frío',
    posFijas: 90,
    capacidadTarimas: 1980,
    factorEstiba: '22 tarimas/pos',
    materials: ['SIG-JAM-500G · Jamón Fud'],
    notes: 'Cámara fría -18°C.',
    status: 'LOADED',
    polygonPoints: '602,375 783,375 783,660 602,660',
    labelPosition: { x: 692, y: 505 },
    sublabelPosition: { x: 692, y: 530 }
  },
  {
    id: 'sec-l',
    code: 'L',
    name: 'Nave L — Material de empaque y tarimas',
    category: 'Empaque / Insumos',
    posFijas: 100,
    capacidadTarimas: 2200,
    factorEstiba: '22 tarimas/pos',
    materials: ['BOX-MASTER-01 · Caja Master Corrugado'],
    notes: 'Insumos de empaque.',
    status: 'LOADED',
    polygonPoints: '797,375 890,375 890,660 797,660',
    labelPosition: { x: 843, y: 505 },
    sublabelPosition: { x: 843, y: 530 }
  },
  {
    id: 'sec-k',
    code: 'K',
    name: 'Nave K — Reserva y Traspasos',
    category: 'Reserva General',
    posFijas: 110,
    capacidadTarimas: 2420,
    factorEstiba: '22 tarimas/pos',
    materials: ['DAN-MILK-1L · Danone Entera'],
    notes: 'Nave K reserva.',
    status: 'LOADED',
    polygonPoints: '897,375 973,375 973,660 897,660',
    labelPosition: { x: 935, y: 505 },
    sublabelPosition: { x: 935, y: 530 }
  },
  {
    id: 'sec-b',
    code: 'B',
    name: 'Nave B — Expansión Futura',
    category: 'Futura Expansión',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: 'En definición',
    materials: [],
    notes: 'Área en homologación.',
    status: 'PENDING',
    polygonPoints: '265,670 588,670 588,840 265,840',
    labelPosition: { x: 426, y: 745 },
    sublabelPosition: { x: 426, y: 765 }
  },
  {
    id: 'sec-c',
    code: 'C',
    name: 'Nave C — Expansión Futura',
    category: 'Futura Expansión',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: 'En definición',
    materials: [],
    notes: 'Área en homologación.',
    status: 'PENDING',
    polygonPoints: '602,670 783,670 783,840 602,840',
    labelPosition: { x: 692, y: 745 },
    sublabelPosition: { x: 692, y: 765 }
  },
  {
    id: 'sec-h',
    code: 'H',
    name: 'Nave H — Expansión Futura',
    category: 'Futura Expansión',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: 'En definición',
    materials: [],
    notes: 'Área en homologación.',
    status: 'PENDING',
    polygonPoints: '797,670 973,670 973,840 797,840',
    labelPosition: { x: 885, y: 745 },
    sublabelPosition: { x: 885, y: 765 }
  }
];

const SEED_STATS: WarehouseLayoutStats = {
  totalSections: 11,
  loadedSections: 8,
  pendingSections: 3,
  totalPositions: 815,
  totalCapacityTarimas: 17930,
  occupiedPositions: 542,
  blockedPositions: 24
};

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
      map(res => {
        const rawSections = res.data?.sections || [];
        if (rawSections.length === 0) {
          return {
            sections: SEED_SECTIONS,
            stats: SEED_STATS
          };
        }
        return {
          sections: rawSections.map(s => this.mapSectionFromBackend(s)),
          stats: this.mapStatsFromBackend(res.data?.globalStats)
        };
      }),
      catchError(() => {
        return of({
          sections: SEED_SECTIONS,
          stats: SEED_STATS
        });
      })
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
      map(res => {
        const data = res.data || [];
        if (data.length === 0) {
          return this.generateSeedPositionsForSection(sectionId);
        }
        return data.map(p => this.mapPositionFromBackend(p));
      }),
      catchError(() => of(this.generateSeedPositionsForSection(sectionId)))
    );
  }

  getAllPositions(sectionId?: string, status?: string, query?: string): Observable<PositionDetail[]> {
    const branchId = (environment as any).defaultBranchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';
    let params = new HttpParams().set('branchId', branchId);
    if (sectionId && sectionId !== 'ALL') params = params.set('sectionId', sectionId);
    if (status && status !== 'ALL') params = params.set('status', status);
    if (query && query.trim()) params = params.set('search', query.trim());

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/positions`, { params }).pipe(
      map(res => {
        const data = res.data || [];
        if (data.length === 0) {
          return this.generateAllSeedPositions();
        }
        return data.map(p => this.mapPositionFromBackend(p));
      }),
      catchError(() => of(this.generateAllSeedPositions()))
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
      map(res => this.mapPositionFromBackend(res.data)),
      catchError(() => of({
        id: positionId,
        positionNumber: 1,
        code: 'POS-A-001',
        sectionId: 'sec-a',
        sectionName: 'Nave A — Recepción Primaria & PT',
        skuCode: 'LALA-MILK-1L',
        skuDescription: 'Leche Lala Entera UHT 1L (Caja 12 pzas)',
        status: (action === 'BLOCK' ? 'BLOCKED' : action === 'RELEASE' ? 'AVAILABLE' : 'OCCUPIED') as PositionStatus,
        capacityTarimas: 22,
        currentTarimas: action === 'BLOCK' ? 10 : action === 'RELEASE' ? 0 : 22,
        batchNumber: 'LOT-2026-901',
        lastMovement: 'Actualizado manualmente (Modo Demo)'
      }))
    );
  }

  getBlockReasons(): Observable<string[]> {
    return this.http.get<ApiResponse<{ code: string; description: string }[]>>(`${this.baseUrl}/catalogs/block-reasons`).pipe(
      map(res => (res.data || []).map(r => r.description)),
      catchError(() => of([
        'Desviación de Embalaje / Cuarentena QM',
        'Caducidad Próxima / Bloqueo FSM',
        'Humedad o Daño Físico',
        'Dictamen de Auditoría Pendiente'
      ]))
    );
  }

  initializeSection(sectionId: string, payload: InitializeSectionRequest): Observable<any> {
    const url = `${environment.apiBaseUrl}/api/v1/warehouse-sections/${sectionId}/initialize`;
    return this.http.post<ApiResponse<any>>(url, payload).pipe(
      map(res => res.data),
      catchError(() => of({ success: true }))
    );
  }

  private mapStatsFromBackend(raw: any): WarehouseLayoutStats {
    if (!raw) {
      return SEED_STATS;
    }
    return {
      totalSections: raw.totalSections ?? SEED_STATS.totalSections,
      loadedSections: raw.loadedSections ?? SEED_STATS.loadedSections,
      pendingSections: raw.pendingSections ?? SEED_STATS.pendingSections,
      totalPositions: raw.totalPositions ?? SEED_STATS.totalPositions,
      totalCapacityTarimas: raw.totalCapacityTarimas ?? SEED_STATS.totalCapacityTarimas,
      occupiedPositions: raw.occupiedPositions ?? SEED_STATS.occupiedPositions,
      blockedPositions: raw.blockedPositions ?? SEED_STATS.blockedPositions
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

  private generateSeedPositionsForSection(sectionId: string): PositionDetail[] {
    const section = SEED_SECTIONS.find(s => s.id === sectionId) || SEED_SECTIONS[0];
    const count = section.posFijas > 0 ? Math.min(section.posFijas, 16) : 0;
    const list: PositionDetail[] = [];

    const statuses: PositionStatus[] = ['OCCUPIED', 'AVAILABLE', 'BLOCKED', 'OCCUPIED'];
    const skus = [
      { code: 'LALA-MILK-1L', desc: 'Leche Lala Entera UHT 1L (Caja 12 pzas)' },
      { code: 'BIMBO-BREAD-680G', desc: 'Pan Cero Cero Bimbo 680g' },
      { code: 'NESP-CAPS-10P', desc: 'Cápsulas Nespresso Ristretto Intenso x10' },
      { code: 'SIG-JAM-500G', desc: 'Jamón Fud Pavo Virginia 500g' }
    ];

    for (let i = 1; i <= (count || 12); i++) {
      const status = statuses[(i - 1) % statuses.length];
      const sku = skus[(i - 1) % skus.length];
      const posNum = i.toString().padStart(3, '0');
      list.push({
        id: `pos-${section.code.toLowerCase()}-${i}`,
        positionNumber: i,
        code: `POS-${section.code.replace(/[^A-Z]/g, '')}-${posNum}`,
        sectionId: section.id,
        sectionName: section.name,
        skuCode: status !== 'AVAILABLE' ? sku.code : undefined,
        skuDescription: status !== 'AVAILABLE' ? sku.desc : 'Sin Material Asignado',
        status: status,
        capacityTarimas: 22,
        currentTarimas: status === 'OCCUPIED' ? 22 : status === 'BLOCKED' ? 10 : 0,
        batchNumber: status !== 'AVAILABLE' ? `LOT-2026-${900 + i}` : 'N/A',
        lastMovement: '2026-09-30 14:30 · Ingreso Racks',
        blockReason: status === 'BLOCKED' ? 'Desviación de Embalaje / Cuarentena QM' : undefined
      });
    }

    return list;
  }

  private generateAllSeedPositions(): PositionDetail[] {
    const all: PositionDetail[] = [];
    for (const sec of SEED_SECTIONS.filter(s => s.status === 'LOADED')) {
      all.push(...this.generateSeedPositionsForSection(sec.id));
    }
    return all;
  }
}
