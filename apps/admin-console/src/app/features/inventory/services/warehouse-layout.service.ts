/**
 * @file warehouse-layout.service.ts
 * @description Servicio de Gestión de Topología y Datos del Almacén con Persistencia en LocalStorage (SDOP / ADR-001).
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseLayoutStats
} from '../models/warehouse-layout.models';
import { WarehouseLayoutHttpAdapter } from './warehouse-layout-http.adapter';

const STORAGE_KEY = '4guard_warehouse_layout_v1';

export const INITIAL_WAREHOUSE_SECTIONS: WarehouseSection[] = [
  {
    id: 'A',
    code: 'A',
    name: 'Almacén A - Embarques y Café Verde',
    category: 'Secos & Producto Terminado',
    posFijas: 170,
    capacidadTarimas: 3740,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '43211385 Envase Vidrio NESCAFE DOLCA 180g',
      '43519988 Envase Vidrio NESCAFE DOLCA 175+25g'
    ],
    notes: 'Área QUALAMEX en posiciones 149 a 170. Incluye Rampa 2.',
    status: 'LOADED',
    polygonPoints: '800,188 976,188 976,330 878,330 878,790 800,790',
    labelPosition: { x: 865, y: 530 },
    sublabelPosition: { x: 865, y: 548 }
  },
  {
    id: 'E',
    code: 'E',
    name: 'Almacén E - Envasado Menor',
    category: 'Materia Prima & Insumos',
    posFijas: 38,
    capacidadTarimas: 760,
    factorEstiba: '20 tarimas/pos',
    materials: [
      '41165316 Envase Vidrio NESCAFE DOLCA 50g',
      '44242440 Envase Vidrio NESCAFE ICE 170g'
    ],
    notes: 'Rampas 6, 7 y 8. Espacio para maniobra de montacargas.',
    status: 'LOADED',
    polygonPoints: '310,670 506,670 506,738 468,738 468,787 338,787 338,836 274,836 274,765 310,765',
    labelPosition: { x: 412, y: 720 },
    sublabelPosition: { x: 412, y: 738 }
  },
  {
    id: 'F (D)',
    code: 'F (D)',
    name: 'Almacén F (D) - Almacén Central de Vidrio',
    category: 'Empaque & Vidrio Industrial',
    posFijas: 120,
    capacidadTarimas: 2640,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '41165277 Botella Vidrio Salsa Inglesa C&B 1090g',
      '44271527 Envase Vidrio Dawn NESCAFE 350g Ligero MX',
      '41165274 BOTELLA VIDRIO JUGOS Y SALSAS MAG 800ML',
      'Área de Cartón'
    ],
    notes: 'Incluye Oficinas de mantenimiento y almacén de cartón.',
    status: 'LOADED',
    polygonPoints: '600,369 722,369 722,760 635,760 635,824 597,824 597,710 600,710',
    labelPosition: { x: 665, y: 585 },
    sublabelPosition: { x: 665, y: 603 }
  },
  {
    id: 'G',
    code: 'G',
    name: 'Almacén G - Racks e Irregular Norte',
    category: 'General Central & Palletizado',
    posFijas: 117,
    capacidadTarimas: 2574,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '44270022 Envase Vidrio Dawn NESCAFE 200g Ligera MX',
      '41165316 Envase Vidrio NESCAFE DOLCA 50g',
      '44318043 Jar Glass Dawn NESCAFE 100g 2',
      '43140353 Envase Vidrio Dawn NESCAFE 300g MX'
    ],
    notes: 'Nave con columnas estructurales en cuadrícula.',
    status: 'LOADED',
    polygonPoints: '56,137 280,137 280,355 240,387 160,352 160,400 110,296 56,137',
    labelPosition: { x: 195, y: 240 },
    sublabelPosition: { x: 195, y: 258 }
  },
  {
    id: 'I',
    code: 'I',
    name: 'Almacén I - Alta Rotación',
    category: 'Insumos Especiales',
    posFijas: 91,
    capacidadTarimas: 2002,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '43211385 Envase Vidrio NESCAFE DOLCA 180g',
      '43759735 Envase Vidrio NESCAFE DOLCA 85g MX',
      '44318043 Jar Glass Dawn NESCAFE 100g 2',
      '43510616 Envase Vidrio NESCAFE DOLCA 85g MX'
    ],
    notes: 'Bahía longitudinal con pasillos de distribución central.',
    status: 'LOADED',
    polygonPoints: '412,298 506,252 506,670 412,670',
    labelPosition: { x: 459, y: 470 },
    sublabelPosition: { x: 459, y: 488 }
  },
  {
    id: 'J(C)',
    code: 'J(C)',
    name: 'Almacén J(C) - Líquidos y Salsas',
    category: 'Granel & Tambores',
    posFijas: 56,
    capacidadTarimas: 2240,
    factorEstiba: '40 tarimas/pos',
    materials: [
      '41165272 BOTELLA VIDRIO JUGOS Y SALSAS MAG 100ML',
      '41165273 BOTELLA VIDRIO JUGOS Y SALSAS MAG 200ML',
      '41165275 BOTELLA VIDRIO SALSA INGLESA C&B 160 G',
      '41165276 BOTELLA VIDRIO SALSA INGLESA C&B 320 G',
      '43457162 BOTELLA VIDRIO MAGGI 50ML',
      'Área de Cartón'
    ],
    notes: 'Alta capacidad de estiba por posición (40 tarimas/rack).',
    status: 'LOADED',
    polygonPoints: '280,323 310,323 312,298 412,298 412,670 310,670 310,642 280,642 280,494 298,494 298,355 280,355',
    labelPosition: { x: 360, y: 470 },
    sublabelPosition: { x: 360, y: 488 }
  },
  {
    id: 'L',
    code: 'L',
    name: 'Almacén L - Consolidación de Frascos',
    category: 'Cuarentena & Retenidos',
    posFijas: 112,
    capacidadTarimas: 2464,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '44271537 Envase Vidrio Dawn NESCAFE Ligero 120g',
      '43543406 Envase Vidrio NESCAFE Dawn Jar 230g MX'
    ],
    notes: '112 posiciones numeradas consecutivas 1 al 112.',
    status: 'LOADED',
    polygonPoints: '506,252 600,166 600,238 600,738 506,738',
    labelPosition: { x: 553, y: 470 },
    sublabelPosition: { x: 553, y: 488 }
  },
  {
    id: 'K',
    code: 'K',
    name: 'Almacén K - Racks Libres & Anexo',
    category: 'Almacén Anexo Exterior',
    posFijas: 181,
    capacidadTarimas: 3982,
    factorEstiba: '22 tarimas/pos',
    materials: [
      '41165793 NESCAFE CLASICO 300g',
      'Signature 250g/100g/200g',
      '43759734 24K 50g'
    ],
    notes: 'Racks libres para sobreflujo y consolidación de estiba pesada.',
    status: 'LOADED',
    polygonPoints: '600,166 734,130 734,369 600,369',
    labelPosition: { x: 667, y: 245 },
    sublabelPosition: { x: 667, y: 263 }
  },
  {
    id: 'H',
    code: 'H',
    name: 'Sección H (Pendiente)',
    category: 'Área Técnica',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: '--',
    materials: [],
    notes: 'Pendiente de carga de archivo Excel de catálogo.',
    status: 'PENDING',
    polygonPoints: '228,17 298,17 298,87 268,91 268,135 228,135',
    labelPosition: { x: 263, y: 60 },
    sublabelPosition: { x: 263, y: 75 }
  },
  {
    id: 'B',
    code: 'Sección B (Pendiente)',
    name: 'Sección B (Pendiente)',
    category: 'Área Futura',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: '--',
    materials: [],
    notes: 'Pendiente de carga de archivo Excel de catálogo.',
    status: 'PENDING',
    polygonPoints: '734,130 853,52 853,188 734,188',
    labelPosition: { x: 793, y: 125 },
    sublabelPosition: { x: 793, y: 140 }
  },
  {
    id: 'C',
    code: 'Sección C (Pendiente)',
    name: 'Sección C (Pendiente)',
    category: 'Área Futura',
    posFijas: 0,
    capacidadTarimas: 0,
    factorEstiba: '--',
    materials: [],
    notes: 'Pendiente de carga de archivo Excel de catálogo.',
    status: 'PENDING',
    polygonPoints: '722,369 800,369 800,760 722,760',
    labelPosition: { x: 760, y: 585 },
    sublabelPosition: { x: 760, y: 600 }
  }
];

@Injectable({
  providedIn: 'root'
})
export class WarehouseLayoutService {
  private readonly httpAdapter = inject(WarehouseLayoutHttpAdapter);
  private readonly _sections = signal<WarehouseSection[]>([]);
  private readonly _positionsCache = new Map<string, PositionDetail[]>();
  private readonly _positionsVersion = signal<number>(0);
  private readonly _loadingPositions = new Set<string>();

  readonly sections = computed(() => this._sections());

  readonly stats = computed<WarehouseLayoutStats>(() => {
    // Reactividad: escucha versiones de posiciones y secciones
    this._positionsVersion();
    const list = this._sections();
    const loaded = list.filter((s) => s.status === 'LOADED');
    const pending = list.filter((s) => s.status === 'PENDING');

    const totalPos = loaded.reduce((sum, s) => sum + s.posFijas, 0);
    const totalCap = loaded.reduce((sum, s) => sum + s.capacidadTarimas, 0);

    // Contabilizar estados en caché de posiciones
    let occupied = 0;
    let blocked = 0;
    loaded.forEach((s) => {
      const positions = this._positionsCache.get(s.id) || [];
      positions.forEach((p) => {
        if (p.status === 'OCCUPIED') occupied++;
        else if (p.status === 'BLOCKED') blocked++;
      });
    });

    return {
      totalSections: list.length,
      loadedSections: loaded.length,
      pendingSections: pending.length,
      totalPositions: totalPos,
      totalCapacityTarimas: totalCap,
      occupiedPositions: occupied,
      blockedPositions: blocked
    };
  });

  constructor() {
    this.initData();
  }

  private initData(): void {
    // 1. Cargar cache local inmediatamente para visualización instantánea
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this._sections.set(parsed);
        } else {
          this._sections.set(INITIAL_WAREHOUSE_SECTIONS);
        }
      } else {
        this._sections.set(INITIAL_WAREHOUSE_SECTIONS);
      }
    } catch {
      this._sections.set(INITIAL_WAREHOUSE_SECTIONS);
    }

    // 2. Conexión HTTP al Backend en segundo plano para sincronizar topología real
    this.httpAdapter.getSections().subscribe({
      next: (backendSections) => {
        if (backendSections && backendSections.length > 0) {
          this._sections.set(backendSections);
          this.persist();
        }
      },
      error: (err) => {
        console.warn('Backend warehouse-map no disponible, usando topología local.', err);
      }
    });
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._sections()));
    } catch {
      // Ignore quota errors
    }
  }

  resetToDefaults(): void {
    this._positionsCache.clear();
    this._loadingPositions.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(`${STORAGE_KEY}_positions`);
    } catch {}

    this._sections.set(INITIAL_WAREHOUSE_SECTIONS);
    this.persist();
    this._positionsVersion.update(v => v + 1);

    // Re-sincronizar con el backend
    this.httpAdapter.getSections().subscribe({
      next: (backendSections) => {
        if (backendSections && backendSections.length > 0) {
          this._sections.set(backendSections);
          this.persist();
        }
      },
      error: () => {}
    });
  }

  getSectionById(id: string): WarehouseSection | undefined {
    return this._sections().find((s) => s.id === id);
  }

  /**
   * Obtiene o genera las posiciones detalladas de una sección.
   * Conecta HTTP con el backend y actualiza reactivamente los componentes vía señales.
   */
  getPositionsForSection(sectionId: string): PositionDetail[] {
    // Reactividad: cualquier computed que invoque este método se registrará contra _positionsVersion
    this._positionsVersion();

    if (this._positionsCache.has(sectionId)) {
      return this._positionsCache.get(sectionId)!;
    }

    const section = this.getSectionById(sectionId);
    if (!section || section.status === 'PENDING' || section.posFijas === 0) {
      return [];
    }

    // Si la sección tiene un UUID real del backend y no está en proceso de carga, disparar fetch HTTP
    const isBackendUuid = sectionId.includes('-') && sectionId.length > 10;
    if (isBackendUuid && !this._loadingPositions.has(sectionId)) {
      this._loadingPositions.add(sectionId);
      this.httpAdapter.getPositionsForSection(sectionId).subscribe({
        next: (positions) => {
          this._loadingPositions.delete(sectionId);
          if (positions && positions.length > 0) {
            this._positionsCache.set(sectionId, positions);
            this.savePositionsToStorage(sectionId, positions);
            this._positionsVersion.update(v => v + 1);
          }
        },
        error: (err) => {
          this._loadingPositions.delete(sectionId);
          console.warn(`Fallo carga HTTP de posiciones para sección ${sectionId}, usando fallback local.`, err);
        }
      });
    }

    // Intentar leer de localStorage si ya existían posiciones modificadas
    const storageKey = `${STORAGE_KEY}_pos_${sectionId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === section.posFijas) {
          this._positionsCache.set(sectionId, parsed);
          return parsed;
        }
      }
    } catch {}

    // Generación determinista inicial basada en la pauta real (fallback inmediato)
    const factorNum = parseInt(section.factorEstiba, 10) || 22;
    const positions: PositionDetail[] = [];

    for (let i = 1; i <= section.posFijas; i++) {
      const mat = section.materials && section.materials.length > 0 ? section.materials[(i - 1) % section.materials.length] : 'Sin Material Asignado';
      const posCode = `POS-${String(i).padStart(3, '0')}`;
      const id = isBackendUuid ? `POS-${section.code}-${i}` : `POS-${section.code}-${i}`;

      const skuMatch = mat.match(/^(\d{8}|\b[A-Za-z0-9-]+\b)/);
      const skuCode = skuMatch ? skuMatch[1] : `SKU-${i}`;

      const hash = ((section.code || 'A').charCodeAt(0) * 17 + i * 13) % 100;
      let status: PositionStatus = 'OCCUPIED';
      let currentTarimas = factorNum;

      if (hash < 10) {
        status = 'BLOCKED';
        currentTarimas = 0;
      } else if (hash < 25) {
        status = 'AVAILABLE';
        currentTarimas = 0;
      } else if (hash < 40) {
        status = 'OCCUPIED';
        currentTarimas = Math.max(1, Math.floor(factorNum * 0.5));
      }

      positions.push({
        id,
        positionNumber: i,
        code: posCode,
        sectionId: section.id,
        sectionName: section.name,
        skuCode,
        skuDescription: mat,
        status,
        capacityTarimas: factorNum,
        currentTarimas,
        batchNumber: `LOTE-${2026}${String((hash % 12) + 1).padStart(2, '0')}-${String(i).padStart(3, '0')}`,
        lastMovement: new Date(Date.now() - hash * 3600000 * 2).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }),
        blockReason: status === 'BLOCKED' ? 'Inspección de Calidad QM (Cuarentena)' : undefined
      });
    }

    this._positionsCache.set(sectionId, positions);
    this.savePositionsToStorage(sectionId, positions);
    return positions;
  }

  updatePositionStatus(
    sectionId: string,
    positionId: string,
    newStatus: PositionStatus,
    meta: { reason?: string; comment?: string } = {}
  ): void {
    const list = this.getPositionsForSection(sectionId);
    const item = list.find((p) => p.id === positionId);
    if (!item) return;

    // Actualización optimista inmediata en memoria
    item.status = newStatus;
    if (newStatus === 'AVAILABLE') {
      item.currentTarimas = 0;
      item.blockReason    = undefined;
    } else if (newStatus === 'OCCUPIED') {
      item.currentTarimas = item.capacityTarimas;
      item.blockReason    = undefined;
    } else if (newStatus === 'BLOCKED') {
      item.currentTarimas = 0;
      const parts: string[] = [];
      if (meta.reason)  parts.push(meta.reason);
      if (meta.comment) parts.push(`Nota: ${meta.comment}`);
      item.blockReason = parts.length ? parts.join(' — ') : 'Bloqueo Manual por Supervisor WMS';
    }

    this.savePositionsToStorage(sectionId, list);
    this._positionsVersion.update(v => v + 1);

    // Si la posición tiene ID de PostgreSQL (UUID), sincronizar vía PATCH HTTP
    const isBackendPosition = positionId.includes('-') && positionId.length > 20 && !positionId.startsWith('POS-');
    if (isBackendPosition) {
      const action = newStatus === 'AVAILABLE' ? 'RELEASE' : (newStatus === 'BLOCKED' ? 'BLOCK' : 'OCCUPY');
      this.httpAdapter.updatePositionStatus(positionId, action, {
        reasonCode: meta.reason,
        comment: meta.comment
      }).subscribe({
        next: (updatedPos) => {
          // Confirmar con datos exactos del servidor
          const idx = list.findIndex(p => p.id === positionId);
          if (idx !== -1) {
            list[idx] = updatedPos;
            this.savePositionsToStorage(sectionId, list);
            this._positionsVersion.update(v => v + 1);
          }
        },
        error: (err) => {
          console.error('Error al sincronizar estado de posición con backend:', err);
        }
      });
    }
  }

  private savePositionsToStorage(sectionId: string, positions: PositionDetail[]): void {
    try {
      localStorage.setItem(`${STORAGE_KEY}_pos_${sectionId}`, JSON.stringify(positions));
    } catch {}
  }
}
