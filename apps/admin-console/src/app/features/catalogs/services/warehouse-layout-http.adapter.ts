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

/**
 * Topología Real de 12 Almacenes (A, B, C, D, E, F, G, H, I, K, L, M)
 * 1,180 Fijas (100% Base Nominal: 25,960 T)
 * 474 Temporales (Buffer Extra: 10,428 T)
 * 48 Precarga (4 por Almacén)
 * Total: 1,702 Posiciones Físicas
 */
const SEED_SECTIONS: WarehouseSection[] = [
  {
    id: 'sec-a',
    code: 'A',
    name: 'Almacén A — Materia Prima & Secos',
    category: 'Materia Prima / PT',
    posFijas: 175,
    posTemp: 50,
    posPreload: 4,
    capacidadTarimas: 3850,
    factorEstiba: '22 tarimas/pos',
    materials: ['LALA-MILK-1L · Leche Entera 1L', 'ENVASE VIDRIO NESCAFE DOLCA 180G'],
    notes: '175 Fijas · 50 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '265,125 588,125 588,365 265,365',
    labelPosition: { x: 426, y: 235 },
    sublabelPosition: { x: 426, y: 260 }
  },
  {
    id: 'sec-b',
    code: 'B',
    name: 'Almacén B — Almacenamiento General',
    category: 'Almacenamiento General',
    posFijas: 37,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 814,
    factorEstiba: '22 tarimas/pos',
    materials: ['BOTELLA VIDRIO SALSA INGLESA C&B 1090 G'],
    notes: '37 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '265,670 420,670 420,840 265,840',
    labelPosition: { x: 342, y: 745 },
    sublabelPosition: { x: 342, y: 765 }
  },
  {
    id: 'sec-c',
    code: 'C',
    name: 'Almacén C — Alta Rotación',
    category: 'Alta Rotación',
    posFijas: 72,
    posTemp: 50,
    posPreload: 4,
    capacidadTarimas: 1584,
    factorEstiba: '22 tarimas/pos',
    materials: ['ENVASE DE VIDRIO SIGNATURE 250G MX'],
    notes: '72 Fijas · 50 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '430,670 588,670 588,840 430,840',
    labelPosition: { x: 509, y: 745 },
    sublabelPosition: { x: 509, y: 765 }
  },
  {
    id: 'sec-d',
    code: 'D',
    name: 'Almacén D — Insumos & Empaque',
    category: 'Insumos / Packaging',
    posFijas: 117,
    posTemp: 50,
    posPreload: 4,
    capacidadTarimas: 2574,
    factorEstiba: '22 tarimas/pos',
    materials: ['CASE CORRUGATED NESCAFE CLASICO 12X85G'],
    notes: '117 Fijas · 50 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '602,125 783,125 783,245 602,245',
    labelPosition: { x: 692, y: 180 },
    sublabelPosition: { x: 692, y: 200 }
  },
  {
    id: 'sec-e',
    code: 'E',
    name: 'Almacén E — Racks Densos',
    category: 'Racks Convencionales',
    posFijas: 112,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 2464,
    factorEstiba: '22 tarimas/pos',
    materials: ['LATA HOJALATA CORTA PEELOFF D 153 MM'],
    notes: '112 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '602,255 783,255 783,365 602,365',
    labelPosition: { x: 692, y: 305 },
    sublabelPosition: { x: 692, y: 325 }
  },
  {
    id: 'sec-f',
    code: 'F',
    name: 'Almacén F — Cuarentena QM & Auditoría',
    category: 'Inspección QA / QM',
    posFijas: 91,
    posTemp: 64,
    posPreload: 4,
    capacidadTarimas: 2002,
    factorEstiba: '22 tarimas/pos',
    materials: ['NESP-CAPS-10P · Cápsulas Nespresso'],
    notes: '91 Fijas · 64 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '797,125 890,125 890,365 797,365',
    labelPosition: { x: 843, y: 235 },
    sublabelPosition: { x: 843, y: 260 }
  },
  {
    id: 'sec-g',
    code: 'G',
    name: 'Almacén G — Zona de Despacho & Staging',
    category: 'Outbound Staging',
    posFijas: 38,
    posTemp: 50,
    posPreload: 4,
    capacidadTarimas: 836,
    factorEstiba: '22 tarimas/pos',
    materials: ['SGM-JUICE-1L · Jugo del Valle'],
    notes: '38 Fijas · 50 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '897,125 973,125 973,365 897,365',
    labelPosition: { x: 935, y: 235 },
    sublabelPosition: { x: 935, y: 260 }
  },
  {
    id: 'sec-h',
    code: 'H',
    name: 'Almacén H — Conservación & Químicos',
    category: 'Materia Prima Especial',
    posFijas: 86,
    posTemp: 20,
    posPreload: 4,
    capacidadTarimas: 1892,
    factorEstiba: '22 tarimas/pos',
    materials: ['ADHESIVO BASE AGUA V3869 HB FULLER'],
    notes: '86 Fijas · 20 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '797,670 973,670 973,840 797,840',
    labelPosition: { x: 885, y: 745 },
    sublabelPosition: { x: 885, y: 765 }
  },
  {
    id: 'sec-i',
    code: 'I',
    name: 'Almacén I — Pasillo Central Racks',
    category: 'Rack Alta Densidad',
    posFijas: 117,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 2574,
    factorEstiba: '22 tarimas/pos',
    materials: ['ALP-YOG-250G · Yogurt Alpura'],
    notes: '117 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '265,375 588,375 588,660 265,660',
    labelPosition: { x: 426, y: 505 },
    sublabelPosition: { x: 426, y: 530 }
  },
  {
    id: 'sec-k',
    code: 'K',
    name: 'Almacén K — Reserva y Traspasos',
    category: 'Reserva General',
    posFijas: 22,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 484,
    factorEstiba: '22 tarimas/pos',
    materials: ['DAN-MILK-1L · Danone Entera'],
    notes: '22 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '897,375 973,375 973,660 897,660',
    labelPosition: { x: 935, y: 505 },
    sublabelPosition: { x: 935, y: 530 }
  },
  {
    id: 'sec-l',
    code: 'L',
    name: 'Almacén L — Producto Terminado Nestlé',
    category: 'Producto Terminado',
    posFijas: 181,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 3982,
    factorEstiba: '22 tarimas/pos',
    materials: ['LA LECHERA LCA LATA 48X375G MX', 'ABUELITA TABLETA 24X540G MX'],
    notes: '181 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '797,375 890,375 890,660 797,660',
    labelPosition: { x: 843, y: 505 },
    sublabelPosition: { x: 843, y: 530 }
  },
  {
    id: 'sec-m',
    code: 'M',
    name: 'Almacén M — Consolidación & Despacho',
    category: 'Consolidación',
    posFijas: 132,
    posTemp: 40,
    posPreload: 4,
    capacidadTarimas: 2904,
    factorEstiba: '22 tarimas/pos',
    materials: ['COFFEE-MATE ORIGINAL 12X640G N1MX'],
    notes: '132 Fijas · 40 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '602,375 783,375 783,660 602,660',
    labelPosition: { x: 692, y: 505 },
    sublabelPosition: { x: 692, y: 530 }
  }
];

const SEED_STATS: WarehouseLayoutStats = {
  totalSections: 12,
  loadedSections: 12,
  pendingSections: 0,
  totalPositions: 1702,
  totalCapacityTarimas: 25960,
  occupiedPositions: 0,
  blockedPositions: 0
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
        const mapped = data.map(p => this.mapPositionFromBackend(p));
        return this.ensureSectionPositionsComplete(sectionId, mapped);
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
        const mapped = data.map(p => this.mapPositionFromBackend(p));
        return this.ensureAllPositionsComplete(mapped);
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
        sectionName: 'Almacén A',
        category: 'FIXED_STORAGE' as const,
        skuCode: 'LALA-MILK-1L',
        skuDescription: 'Leche Lala Entera UHT 1L (Caja 12 pzas)',
        status: (action === 'BLOCK' ? 'BLOCKED' : action === 'RELEASE' ? 'AVAILABLE' : 'OCCUPIED') as PositionStatus,
        capacityTarimas: 22,
        currentTarimas: action === 'BLOCK' ? 10 : action === 'RELEASE' ? 0 : 22,
        batchNumber: 'LOT-2026-901',
        lastMovement: 'Actualizado manualmente (Modo Demo)'
      } as PositionDetail))
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

  createPosition(payload: import('../models/warehouse-catalog.models').CreatePositionRequest): Observable<PositionDetail> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/positions`, payload).pipe(
      map(res => this.mapPositionFromBackend(res.data)),
      catchError(() => {
        const sec = SEED_SECTIONS.find(s => s.id === payload.sectionId) || SEED_SECTIONS[0];
        const category = payload.category || 'FIXED_STORAGE';
        const code = payload.code || `POS-${sec.code}-${Date.now().toString().slice(-3)}`;
        return of({
          id: `pos-${sec.code.toLowerCase()}-${Date.now().toString().slice(-4)}`,
          positionNumber: 999,
          code,
          sectionId: sec.id,
          sectionName: sec.name,
          category,
          skuDescription: 'Sin Material Asignado',
          status: 'AVAILABLE' as PositionStatus,
          capacityTarimas: payload.capacityTarimas || 22,
          currentTarimas: 0,
          batchNumber: 'N/A',
          lastMovement: 'Alta reciente'
        });
      })
    );
  }

  updatePositionDetails(positionId: string, payload: import('../models/warehouse-catalog.models').UpdatePositionDetailsRequest): Observable<PositionDetail> {
    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/positions/${positionId}`, payload).pipe(
      map(res => this.mapPositionFromBackend(res.data)),
      catchError(() => of({
        id: positionId,
        positionNumber: 1,
        code: payload.code || 'POS-MOD',
        sectionId: 'sec-a',
        sectionName: 'Almacén A',
        category: payload.category || 'FIXED_STORAGE',
        skuCode: payload.skuCode,
        skuDescription: payload.skuDescription || 'Sin Material Asignado',
        status: 'AVAILABLE' as PositionStatus,
        capacityTarimas: payload.capacityTarimas || 22,
        currentTarimas: 0,
        batchNumber: 'N/A',
        lastMovement: 'Modificado recientemente'
      }))
    );
  }

  deletePosition(positionId: string): Observable<void> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/positions/${positionId}`).pipe(
      map(() => void 0),
      catchError(() => of(void 0))
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
    const codeClean = raw.code ? raw.code.replace('SEC-ALM-', '') : raw.name;
    const matchedSeed = SEED_SECTIONS.find(s => s.code === codeClean || s.id === raw.id);

    return {
      id: raw.id,
      code: codeClean,
      name: raw.name,
      category: raw.category || matchedSeed?.category || 'General',
      posFijas: raw.posFijas || matchedSeed?.posFijas || 0,
      posTemp: matchedSeed?.posTemp || 0,
      posPreload: matchedSeed?.posPreload || 4,
      capacidadTarimas: raw.capacidadTarimas || matchedSeed?.capacidadTarimas || 0,
      factorEstiba: raw.factorEstiba || '22 tarimas/pos',
      materials: raw.materials && raw.materials.length > 0 ? raw.materials : (matchedSeed?.materials || []),
      notes: raw.notes || matchedSeed?.notes || '',
      status: 'LOADED',
      polygonPoints: raw.polygonPoints || matchedSeed?.polygonPoints || '',
      labelPosition: { x: Number(raw.labelPosition?.x || matchedSeed?.labelPosition.x || 0), y: Number(raw.labelPosition?.y || matchedSeed?.labelPosition.y || 0) },
      sublabelPosition: { x: Number(raw.sublabelPosition?.x || matchedSeed?.sublabelPosition.x || 0), y: Number(raw.sublabelPosition?.y || matchedSeed?.sublabelPosition.y || 0) }
    };
  }

  private mapPositionFromBackend(raw: any): PositionDetail {
    let category: 'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING' = 'FIXED_STORAGE';
    if (raw.category) {
      category = raw.category;
    } else if (raw.code && raw.code.includes('-T')) {
      category = 'TEMPORARY_BUFFER';
    } else if (raw.code && (raw.code.includes('-PRE') || raw.code.includes('PRECARGA'))) {
      category = 'PRELOAD_STAGING';
    }

    return {
      id: raw.id,
      positionNumber: raw.positionNumber,
      code: raw.code,
      sectionId: raw.sectionId,
      sectionName: raw.sectionName,
      category,
      skuCode: raw.skuCode,
      skuDescription: raw.skuDescription || 'Sin Material Asignado',
      status: raw.status as PositionStatus,
      capacityTarimas: raw.capacityTarimas || 22,
      currentTarimas: raw.currentTarimas || 0,
      batchNumber: raw.batchNumber || 'N/A',
      lastMovement: raw.lastMovement || 'Sin movimientos',
      blockReason: raw.blockReason || (raw.isBlocked ? raw.statusReason : undefined)
    };
  }

  private generateSeedPositionsForSection(sectionId: string): PositionDetail[] {
    const section = SEED_SECTIONS.find(s => s.id === sectionId || s.code === sectionId) || SEED_SECTIONS[0];
    const fixedCount = section.posFijas || 175;
    const tempCount = section.posTemp || 50;
    const preloadCount = section.posPreload || 4;
    const list: PositionDetail[] = [];
    const zoneChar = section.code.replace(/[^A-Z]/g, '') || 'A';

    // 1. Fijas
    for (let i = 1; i <= fixedCount; i++) {
      const posNum = i.toString().padStart(3, '0');
      list.push({
        id: `pos-${zoneChar.toLowerCase()}-${posNum}`,
        positionNumber: i,
        code: `POS-${zoneChar}-${posNum}`,
        sectionId: section.id,
        sectionName: section.name,
        category: 'FIXED_STORAGE',
        skuDescription: 'Sin Material Asignado',
        status: 'AVAILABLE',
        capacityTarimas: 22,
        currentTarimas: 0,
        batchNumber: 'N/A',
        lastMovement: 'Sin movimientos'
      });
    }

    // 2. Temporales
    for (let i = 1; i <= tempCount; i++) {
      const posNum = i.toString().padStart(2, '0');
      list.push({
        id: `pos-${zoneChar.toLowerCase()}-t${posNum}`,
        positionNumber: fixedCount + i,
        code: `POS-${zoneChar}-T${posNum}`,
        sectionId: section.id,
        sectionName: section.name,
        category: 'TEMPORARY_BUFFER',
        skuDescription: 'Sin Material Asignado',
        status: 'AVAILABLE',
        capacityTarimas: 22,
        currentTarimas: 0,
        batchNumber: 'N/A',
        lastMovement: 'Sin movimientos'
      });
    }

    // 3. Precarga
    for (let i = 1; i <= preloadCount; i++) {
      list.push({
        id: `pos-${zoneChar.toLowerCase()}-pre0${i}`,
        positionNumber: fixedCount + tempCount + i,
        code: `POS-${zoneChar}-PRE0${i}`,
        sectionId: section.id,
        sectionName: section.name,
        category: 'PRELOAD_STAGING',
        skuDescription: 'Sin Material Asignado',
        status: 'AVAILABLE',
        capacityTarimas: 22,
        currentTarimas: 0,
        batchNumber: 'N/A',
        lastMovement: 'Sin movimientos'
      });
    }

    return list;
  }

  private generateAllSeedPositions(): PositionDetail[] {
    const all: PositionDetail[] = [];
    for (const sec of SEED_SECTIONS) {
      all.push(...this.generateSeedPositionsForSection(sec.id));
    }
    return all;
  }

  private ensureSectionPositionsComplete(sectionId: string, backendPositions: PositionDetail[]): PositionDetail[] {
    const seedSection = this.generateSeedPositionsForSection(sectionId);
    const mapByCode = new Map<string, PositionDetail>();

    for (const seed of seedSection) {
      mapByCode.set(seed.code, seed);
    }

    for (const b of backendPositions) {
      if (mapByCode.has(b.code)) {
        const existing = mapByCode.get(b.code)!;
        mapByCode.set(b.code, {
          ...existing,
          id: b.id || existing.id,
          status: b.status || existing.status,
          currentTarimas: b.currentTarimas ?? existing.currentTarimas,
          skuCode: b.skuCode || existing.skuCode,
          skuDescription: (b.skuDescription && b.skuDescription !== 'Sin Material Asignado') ? b.skuDescription : existing.skuDescription,
          batchNumber: b.batchNumber !== 'N/A' ? b.batchNumber : existing.batchNumber,
          lastMovement: b.lastMovement !== 'Sin movimientos' ? b.lastMovement : existing.lastMovement,
          blockReason: b.blockReason || existing.blockReason
        });
      } else {
        mapByCode.set(b.code, b);
      }
    }

    return Array.from(mapByCode.values());
  }

  private ensureAllPositionsComplete(backendPositions: PositionDetail[]): PositionDetail[] {
    const seedAll = this.generateAllSeedPositions();
    const mapByCode = new Map<string, PositionDetail>();

    for (const seed of seedAll) {
      mapByCode.set(seed.code, seed);
    }

    for (const b of backendPositions) {
      if (mapByCode.has(b.code)) {
        const existing = mapByCode.get(b.code)!;
        mapByCode.set(b.code, {
          ...existing,
          id: b.id || existing.id,
          status: b.status || existing.status,
          currentTarimas: b.currentTarimas ?? existing.currentTarimas,
          skuCode: b.skuCode || existing.skuCode,
          skuDescription: (b.skuDescription && b.skuDescription !== 'Sin Material Asignado') ? b.skuDescription : existing.skuDescription,
          batchNumber: b.batchNumber !== 'N/A' ? b.batchNumber : existing.batchNumber,
          lastMovement: b.lastMovement !== 'Sin movimientos' ? b.lastMovement : existing.lastMovement,
          blockReason: b.blockReason || existing.blockReason
        });
      } else {
        mapByCode.set(b.code, b);
      }
    }

    return Array.from(mapByCode.values());
  }
}
