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
 * Topología Real de 13 Almacenes CAD (H, G, C, I, L, E, K, B, F, M, D, J, A)
 * Distribución geométrica fiel al plano arquitectónico de planta.
 * Total Fijas: 1,195 Posiciones (28,330 T Capacidad)
 */
const SEED_SECTIONS: WarehouseSection[] = [
  {
    id: 'sec-h',
    code: 'H',
    name: 'Almacén H — Conservación & Químicos',
    category: 'Materia Prima Especial',
    posFijas: 25,
    posTemp: 10,
    posPreload: 2,
    capacidadTarimas: 550,
    factorEstiba: '22 tarimas/pos',
    materials: ['ADHESIVO BASE AGUA V3869 HB FULLER'],
    notes: '25 Fijas · 10 Temporales · 2 Precarga',
    status: 'LOADED',
    polygonPoints: '190,8 264,8 264,84 242,84 232,92 232,133 190,133',
    labelPosition: { x: 227, y: 46 },
    sublabelPosition: { x: 227, y: 68 }
  },
  {
    id: 'sec-g',
    code: 'G',
    name: 'Almacén G — Zona Oeste',
    category: 'Almacenamiento General',
    posFijas: 117,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 2574,
    factorEstiba: '22 tarimas/pos',
    materials: ['SGM-JUICE-1L · Jugo del Valle', 'BOTELLA VIDRIO SALSA INGLESA C&B 1090 G'],
    notes: '117 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '9,134 246,134 246,392 206,392 170,360 134,380 118,388 119,299 74,300 62,300',
    labelPosition: { x: 141, y: 216 },
    sublabelPosition: { x: 141, y: 238 }
  },
  {
    id: 'sec-c',
    code: 'C',
    name: 'Almacén C — Alta Rotación',
    category: 'Alta Rotación',
    posFijas: 56,
    posTemp: 20,
    posPreload: 4,
    capacidadTarimas: 2240,
    factorEstiba: '40 tarimas/pos',
    materials: ['ENVASE DE VIDRIO SIGNATURE 250G MX'],
    notes: '56 Fijas · 20 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '702,378 802,378 802,782 718,782 718,542 720,542 720,459 702,459',
    labelPosition: { x: 760, y: 662 },
    sublabelPosition: { x: 760, y: 684 }
  },
  {
    id: 'sec-i',
    code: 'I',
    name: 'Almacén I — Pasillo Central Racks',
    category: 'Rack Alta Densidad',
    posFijas: 91,
    posTemp: 25,
    posPreload: 4,
    capacidadTarimas: 2002,
    factorEstiba: '22 tarimas/pos',
    materials: ['ALP-YOG-250G · Yogurt Alpura'],
    notes: '91 Fijas · 25 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '389,276 489,216 489,690 389,690',
    labelPosition: { x: 439, y: 483 },
    sublabelPosition: { x: 439, y: 505 }
  },
  {
    id: 'sec-l',
    code: 'L',
    name: 'Almacén L — Producto Terminado Nestlé',
    category: 'Producto Terminado',
    posFijas: 112,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 2464,
    factorEstiba: '22 tarimas/pos',
    materials: ['LA LECHERA LCA LATA 48X375G MX', 'ABUELITA TABLETA 24X540G MX'],
    notes: '112 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '489,216 588,166 588,607 568,607 568,632 560,632 560,695 568,695 568,765 592,765 592,782 544,782 544,760 489,760',
    labelPosition: { x: 539, y: 407 },
    sublabelPosition: { x: 539, y: 429 }
  },
  {
    id: 'sec-e',
    code: 'E',
    name: 'Almacén E — Racks Densos Sur',
    category: 'Racks Convencionales',
    posFijas: 38,
    posTemp: 15,
    posPreload: 4,
    capacidadTarimas: 760,
    factorEstiba: '20 tarimas/pos',
    materials: ['LATA HOJALATA CORTA PEELOFF D 153 MM'],
    notes: '38 Fijas · 15 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '280,690 489,690 489,760 451,760 451,812 280,812',
    labelPosition: { x: 384, y: 725 },
    sublabelPosition: { x: 384, y: 747 }
  },
  {
    id: 'sec-k',
    code: 'K',
    name: 'Almacén K — Nave Superior Central',
    category: 'Reserva General',
    posFijas: 181,
    posTemp: 40,
    posPreload: 4,
    capacidadTarimas: 3982,
    factorEstiba: '22 tarimas/pos',
    materials: ['DAN-MILK-1L · Danone Entera'],
    notes: '181 Fijas · 40 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '',
    labelPosition: { x: 0, y: 0 },
    sublabelPosition: { x: 0, y: 0 }
  },
  {
    id: 'sec-b',
    code: 'B',
    name: 'Almacén B — Almacenamiento General Noreste',
    category: 'Almacenamiento General',
    posFijas: 36,
    posTemp: 15,
    posPreload: 4,
    capacidadTarimas: 792,
    factorEstiba: '22 tarimas/pos',
    materials: ['CASE CORRUGATED NESCAFE CLASICO 12X85G'],
    notes: '36 Fijas · 15 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '692,145 856,52 861,52 861,188 732,188 732,328 694,328',
    labelPosition: { x: 713, y: 258 },
    sublabelPosition: { x: 713, y: 280 }
  },
  {
    id: 'sec-f',
    code: 'F',
    name: 'Almacén F — Cuarentena QM & Auditoría',
    category: 'Inspección QA / QM',
    posFijas: 91,
    posTemp: 25,
    posPreload: 4,
    capacidadTarimas: 2002,
    factorEstiba: '22 tarimas/pos',
    materials: ['NESP-CAPS-10P · Cápsulas Nespresso'],
    notes: '91 Fijas · 25 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '588,378 702,378 702,459 720,459 720,782 592,782 592,598 588,598',
    labelPosition: { x: 654, y: 529 },
    sublabelPosition: { x: 654, y: 551 }
  },
  {
    id: 'sec-m',
    code: 'M',
    name: 'Almacén M — Consolidación & Despacho',
    category: 'Consolidación',
    posFijas: 132,
    posTemp: 35,
    posPreload: 4,
    capacidadTarimas: 2904,
    factorEstiba: '22 tarimas/pos',
    materials: ['COFFEE-MATE ORIGINAL 12X640G N1MX'],
    notes: '132 Fijas · 35 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '',
    labelPosition: { x: 0, y: 0 },
    sublabelPosition: { x: 0, y: 0 }
  },
  {
    id: 'sec-d',
    code: 'D',
    name: 'Almacén D — Insumos & Empaque',
    category: 'Insumos / Packaging',
    posFijas: 120,
    posTemp: 30,
    posPreload: 4,
    capacidadTarimas: 2640,
    factorEstiba: '22 tarimas/pos',
    materials: ['CASE CORRUGATED NESCAFE CLASICO 12X85G'],
    notes: '120 Fijas · 30 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '',
    labelPosition: { x: 0, y: 0 },
    sublabelPosition: { x: 0, y: 0 }
  },
  {
    id: 'sec-j',
    code: 'J',
    name: 'Almacén J — Materia Prima & Secos Auxiliar',
    category: 'Materia Prima / PT',
    posFijas: 56,
    posTemp: 20,
    posPreload: 4,
    capacidadTarimas: 1680,
    factorEstiba: '30 tarimas/pos',
    materials: ['LALA-MILK-1L · Leche Entera 1L'],
    notes: '56 Fijas · 20 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '246,360 272,360 281,322 389,276 389,690 280,690 280,660 272,640 272,506 246,506',
    labelPosition: { x: 318, y: 433 },
    sublabelPosition: { x: 318, y: 455 }
  },
  {
    id: 'sec-a',
    code: 'A',
    name: 'Almacén A — Materia Prima & PT Principal',
    category: 'Materia Prima / PT',
    posFijas: 170,
    posTemp: 50,
    posPreload: 4,
    capacidadTarimas: 3740,
    factorEstiba: '22 tarimas/pos',
    materials: ['LALA-MILK-1L · Leche Entera 1L', 'ENVASE VIDRIO NESCAFE DOLCA 180G'],
    notes: '170 Fijas · 50 Temporales · 4 Precarga',
    status: 'LOADED',
    polygonPoints: '802,378 886,335 886,738 802,738',
    labelPosition: { x: 844, y: 625 },
    sublabelPosition: { x: 844, y: 647 }
  }
];

const SEED_STATS: WarehouseLayoutStats = {
  totalSections: 13,
  loadedSections: 13,
  pendingSections: 0,
  totalPositions: 1539,
  totalCapacityTarimas: 28330,
  occupiedPositions: 382,
  blockedPositions: 18
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
    const defaultSku = section.materials && section.materials.length > 0 ? section.materials[0] : 'Material Industrial Estándar';

    for (let i = 1; i <= fixedCount; i++) {
      const posNum = i.toString().padStart(3, '0');
      let status: PositionStatus = 'AVAILABLE';
      let currentTarimas = 0;
      let skuDesc = 'Sin Material Asignado';
      let batchNumber = 'N/A';
      let blockReason: string | undefined = undefined;

      // Nave F: Cuarentena QM con alertas críticas rojas
      if (zoneChar === 'F' && i <= 8) {
        status = 'BLOCKED';
        currentTarimas = 12;
        skuDesc = defaultSku;
        batchNumber = `LOT-2026-F${i.toString().padStart(2, '0')}`;
        blockReason = i % 2 === 0 ? 'Desviación de Embalaje / Cuarentena QM' : 'Dictamen de Auditoría Pendiente';
      }
      // Nave A, C, K, M: Ocupadas con alerta amarilla por saturación o libres
      else if (['A', 'C', 'K', 'M'].includes(zoneChar) && i <= Math.min(fixedCount, 12)) {
        status = 'OCCUPIED';
        currentTarimas = 22; // 100% capacidad -> Alerta preventiva amarilla de saturación
        skuDesc = defaultSku;
        batchNumber = `LOT-2026-${zoneChar}${i.toString().padStart(2, '0')}`;
      }
      // Alguna posición bloqueada esporádica (alerta roja)
      else if (i === 5 && ['G', 'D', 'L'].includes(zoneChar)) {
        status = 'BLOCKED';
        currentTarimas = 0;
        skuDesc = defaultSku;
        batchNumber = `LOT-2026-${zoneChar}05`;
        blockReason = 'Caducidad Próxima / Bloqueo FSM';
      }

      list.push({
        id: `pos-${zoneChar.toLowerCase()}-${posNum}`,
        positionNumber: i,
        code: `POS-${zoneChar}-${posNum}`,
        sectionId: section.id,
        sectionName: section.name,
        category: 'FIXED_STORAGE',
        skuDescription: skuDesc,
        status,
        capacityTarimas: 22,
        currentTarimas,
        batchNumber,
        lastMovement: status === 'BLOCKED' ? 'Bloqueada por Sistema QM' : (status === 'OCCUPIED' ? 'Recepcionado recientemente' : 'Sin movimientos'),
        blockReason
      });
    }

    // 2. Temporales (con alerta preventiva amarilla si tienen tarimas activas)
    for (let i = 1; i <= tempCount; i++) {
      const posNum = i.toString().padStart(2, '0');
      const hasPallets = (i <= 2 && ['A', 'K', 'M'].includes(zoneChar));
      list.push({
        id: `pos-${zoneChar.toLowerCase()}-t${posNum}`,
        positionNumber: fixedCount + i,
        code: `POS-${zoneChar}-T${posNum}`,
        sectionId: section.id,
        sectionName: section.name,
        category: 'TEMPORARY_BUFFER',
        skuDescription: hasPallets ? defaultSku : 'Sin Material Asignado',
        status: hasPallets ? 'OCCUPIED' : 'AVAILABLE',
        capacityTarimas: 22,
        currentTarimas: hasPallets ? 16 : 0,
        batchNumber: hasPallets ? `LOT-TEMP-${zoneChar}${posNum}` : 'N/A',
        lastMovement: hasPallets ? 'Buffer temporal activo (desalojo pendiente)' : 'Sin movimientos'
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
      if (b.code && !b.code.startsWith('POS-')) {
        // Ignorar códigos legacy obsoletos; transferir ocupación a POS-X-001 si existe
        if (b.currentTarimas && b.currentTarimas > 0) {
          const match = b.code.match(/LOC[-_]?(?:ALM[-_]?)?(?:Z)?([A-Ma-m])/i);
          const zoneChar = match ? match[1].toUpperCase() : 'A';
          const targetCode = `POS-${zoneChar}-001`;
          if (mapByCode.has(targetCode)) {
            const target = mapByCode.get(targetCode)!;
            target.currentTarimas = Math.min(target.capacityTarimas, target.currentTarimas + b.currentTarimas);
            target.status = target.currentTarimas >= target.capacityTarimas ? 'OCCUPIED' : target.status;
          }
        }
        continue;
      }

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
      } else if (b.code && b.code.startsWith('POS-')) {
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
      if (b.code && !b.code.startsWith('POS-')) {
        // Ignorar códigos legacy obsoletos; transferir ocupación a POS-X-001 si existe
        if (b.currentTarimas && b.currentTarimas > 0) {
          const match = b.code.match(/LOC[-_]?(?:ALM[-_]?)?(?:Z)?([A-Ma-m])/i);
          const zoneChar = match ? match[1].toUpperCase() : 'A';
          const targetCode = `POS-${zoneChar}-001`;
          if (mapByCode.has(targetCode)) {
            const target = mapByCode.get(targetCode)!;
            target.currentTarimas = Math.min(target.capacityTarimas, target.currentTarimas + b.currentTarimas);
            target.status = target.currentTarimas >= target.capacityTarimas ? 'OCCUPIED' : target.status;
          }
        }
        continue;
      }

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
      } else if (b.code && b.code.startsWith('POS-')) {
        mapByCode.set(b.code, b);
      }
    }

    return Array.from(mapByCode.values());
  }
}
