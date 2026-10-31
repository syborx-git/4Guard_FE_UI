import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseMovementsApiService } from '../../../features/warehouse-movements/services/warehouse-movements-api.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { BayRemisionSummary } from '../../../features/warehouse-movements/models/warehouse-movements.models';
import { WarehouseLayoutService } from '../../../features/catalogs/services/warehouse-layout.service';
import { PositionDetail, PositionStatus, WarehouseSection } from '../../../features/catalogs/models/warehouse-catalog.models';

export type BayCategory = 'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING';

export interface SvgBayItem {
  id: string;
  code: string;
  sectionCode: string;
  sectionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: PositionStatus;
  category: 'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING';
  aisle: string;
  rack: string;
  level: number;
  capacityTarimas: number;
  currentTarimas: number;
  skuDescription: string;
  batchNumber?: string;
  rawPosition?: PositionDetail;
  alertType?: 'NONE' | 'WARNING' | 'CRITICAL';
  alertMessage?: string;
}

export interface SectionAisleRoute {
  aisleCode: string;
  sectionCode: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mainCorridorTarget: { x: number; y: number };
}

export interface BayOccupancyItem {
  id: string;
  code: string;
  name: string;
  zone?: string;
  sectionName?: string;
  aisle?: string;
  rack?: string;
  level?: string;
  position?: string;
  capacityPallets: number;
  currentStoredPallets: number;
  availableUnits?: number;
  occupancyPercentage: number;
  status: string;
  isBlocked: boolean;
  category: BayCategory;
  trafficLight: 'GREEN' | 'AMBER' | 'RED';
  isRecommended: boolean;
  storedRemisiones?: BayRemisionSummary[];
}

/**
 * Topología Oficial de 13 Almacenes CAD (H, G, C, I, L, E, K, B, F, M, D, J, A)
 * Distribución geométrica fiel al plano arquitectónico de planta (DXF #Layout Almacen principal.dxf).
 */
export const OFFICIAL_CAD_SECTIONS: WarehouseSection[] = [
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
    polygonPoints: '588,166 692,145 694,328 694,378 588,378',
    labelPosition: { x: 641, y: 245 },
    sublabelPosition: { x: 641, y: 267 }
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
    polygonPoints: '588,378 650,378 650,782 588,782',
    labelPosition: { x: 619, y: 550 },
    sublabelPosition: { x: 619, y: 572 }
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

export interface WarehouseZoneGroup {
  id: string;
  code: string;
  name: string;
  zone: string;
  sectionName: string;
  categoryLabel?: string;
  polygonPoints?: string;
  labelX?: number;
  labelY?: number;
  sublabelX?: number;
  sublabelY?: number;
  
  // Posiciones Fijas (100% Base Nominal)
  fixedPositionsCount: number;
  fixedAvailableCount: number;
  fixedOccupiedCount: number;
  fixedCapacityPallets: number;
  fixedOccupiedPallets: number;
  fixedAvailablePallets: number;
  nominalOccupancyPercentage: number;

  // Posiciones Temporales (Sobrecupo / Buffer Extra %)
  tempPositionsCount: number;
  tempAvailableCount: number;
  tempOccupiedCount: number;
  tempCapacityPallets: number;
  tempOccupiedPallets: number;
  overflowPercentage: number;

  // Posiciones de Precarga / Carga
  preloadPositionsCount: number;
  preloadOccupiedPallets: number;

  // Totales Generales
  totalPositions: number;
  availablePositions: number;
  occupiedPositions: number;
  blockedPositions: number;
  totalCapacityPallets: number;
  currentStoredPallets: number;
  availablePallets: number;
  trafficLight: 'GREEN' | 'AMBER' | 'RED';

  // Sugerencia de Reubicación
  hasReallocationOpportunity: boolean;
  reallocationCandidateCount: number;

  positions: BayOccupancyItem[];
}

export interface BaySelectionResult {
  locationId: string;
  locationCode: string;
  isOverride: boolean;
  overrideReason?: string;
}

@Component({
  selector: 'fg-bay-occupancy-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bay-occupancy-selector.component.html',
  styleUrls: ['./bay-occupancy-selector.component.css'],
  host: {
    '[class.dark]': 'isDarkMode()',
    '[class.theme-dark]': 'isDarkMode()',
    '[class.theme-light]': '!isDarkMode()',
  }
})
export class BayOccupancySelectorComponent implements OnInit {
  protected readonly isDarkMode = computed(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark') || document.documentElement.classList.contains('theme-dark');
  });
  protected readonly Math = Math;
  // ── ESTADO VISOR 2D TIPO CAD / ALMACÉN ──
  protected readonly zoomScale = signal<number>(1.0);
  protected readonly panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  protected readonly showBaysInBlueprint = signal<boolean>(true);
  protected readonly showTransitRoutes = signal<boolean>(true);
  protected readonly hoveredSvgBay = signal<SvgBayItem | null>(null);
  protected readonly activeHoveredCode = computed(() => this.hoveredSvgBay()?.code || null);

  private isPanning = false;
  private startPanX = 0;
  private startPanY = 0;
  private initialPanOffsetX = 0;
  private initialPanOffsetY = 0;

  private readonly BAY_GEOMETRY = {
    bayW: 9,        // ancho de bahía
    bayH: 12,       // fondo de bahía
    gapY: 5,        // separación entre bahías consecutivas
    rackGap: 12,    // pasillo de montacargas entre rack izquierdo y derecho
    pitch: 56,      // distancia entre ejes de pasillos
    wallMargin: 8   // holgura mínima contra muros
  } as const;

  private parsePolygon(points: string | undefined | null): Array<[number, number]> {
    return (points ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(p => {
        const [x, y] = p.split(',').map(Number);
        return [x, y] as [number, number];
      })
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  }

  private pointInPolygon(x: number, y: number, pts: Array<[number, number]>): boolean {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  private rectInsidePolygon(x: number, y: number, w: number, h: number, pts: Array<[number, number]>, m: number): boolean {
    const x0 = x - m, y0 = y - m, x1 = x + w + m, y1 = y + h + m;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const probes: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [mx, y0], [mx, y1], [x0, my], [x1, my]];
    if (!probes.every(([px, py]) => this.pointInPolygon(px, py, pts))) return false;
    return !pts.some(([vx, vy]) => vx > x0 && vx < x1 && vy > y0 && vy < y1);
  }

  readonly zoneBayLayout = computed(() => {
    const g = this.BAY_GEOMETRY;
    const zones: Array<{
      zoneCode: string;
      aisles: Array<{ aisleCode: string; cx: number; yStart: number; yEnd: number; slots: Array<{ x: number; y: number; rack: 'R1' | 'R2' }> }>;
    }> = [];

    for (const sec of this.displaySections()) {
      const pts = this.parsePolygon(sec.polygonPoints);
      if (pts.length < 3) continue;
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);

      const pairWidth = 2 * g.bayW + g.rackGap;
      const available = (maxX - minX) - 2 * g.wallMargin;
      if (available < pairWidth) continue;
      const count = Math.floor((available - pairWidth) / g.pitch) + 1;
      const firstCx = minX + ((maxX - minX) - (count - 1) * g.pitch) / 2;

      const aisles: Array<{ aisleCode: string; cx: number; yStart: number; yEnd: number; slots: Array<{ x: number; y: number; rack: 'R1' | 'R2' }> }> = [];
      for (let i = 0; i < count; i++) {
        const cx = firstCx + i * g.pitch;
        const xLeft = cx - g.rackGap / 2 - g.bayW;
        const xRight = cx + g.rackGap / 2;
        const slots: Array<{ x: number; y: number; rack: 'R1' | 'R2' }> = [];
        for (let y = minY + g.wallMargin; y + g.bayH <= maxY - g.wallMargin; y += g.bayH + g.gapY) {
          if (this.rectInsidePolygon(xLeft, y, g.bayW, g.bayH, pts, g.wallMargin)) slots.push({ x: xLeft, y, rack: 'R1' });
          if (this.rectInsidePolygon(xRight, y, g.bayW, g.bayH, pts, g.wallMargin)) slots.push({ x: xRight, y, rack: 'R2' });
        }
        if (!slots.length) continue;
        aisles.push({
          aisleCode: `P-${String(aisles.length + 1).padStart(2, '0')}`,
          cx,
          yStart: Math.min(...slots.map(s => s.y)),
          yEnd: Math.max(...slots.map(s => s.y)) + g.bayH,
          slots
        });
      }
      if (aisles.length) zones.push({ zoneCode: sec.code, aisles });
    }
    return zones;
  });

  readonly sectionAisleRoutes = computed<SectionAisleRoute[]>(() =>
    this.zoneBayLayout().flatMap(zone =>
      zone.aisles.map(a => ({
        aisleCode: `${zone.zoneCode}-${a.aisleCode}`,
        sectionCode: zone.zoneCode,
        x1: a.cx,
        y1: a.yStart,
        x2: a.cx,
        y2: a.yEnd,
        mainCorridorTarget: { x: a.cx, y: a.yEnd }
      }))
    )
  );

  readonly svgBays = computed<SvgBayItem[]>(() => {
    const g = this.BAY_GEOMETRY;
    const allBays = this.bays();
    const result: SvgBayItem[] = [];

    const baysByCode = new Map<string, BayOccupancyItem>();
    for (const b of allBays) {
      if (b && b.code) {
        baysByCode.set(b.code.toUpperCase().trim(), b);
      }
    }

    for (const zone of this.zoneBayLayout()) {
      const zoneCode = zone.zoneCode;
      let posIdx = 0;

      for (const a of zone.aisles) {
        for (const slot of a.slots) {
          posIdx++;
          const candidateCode = `POS-${zoneCode}-${posIdx.toString().padStart(3, '0')}`;
          const bayData = baysByCode.get(candidateCode.toUpperCase()) || null;
          const codeKey = bayData?.code || candidateCode;

          const currentTarimas = bayData ? bayData.currentStoredPallets : 0;
          const capacityTarimas = bayData ? bayData.capacityPallets : 22;
          const isBlocked = bayData?.isBlocked || bayData?.status === 'BLOCKED';

          let status: PositionStatus = 'AVAILABLE';
          if (isBlocked) {
            status = 'BLOCKED';
          } else if (currentTarimas >= capacityTarimas && capacityTarimas > 0) {
            status = 'OCCUPIED';
          } else if (currentTarimas > 0) {
            status = 'OCCUPIED';
          }

          const skuDescription = bayData?.storedRemisiones?.[0]?.productName || (currentTarimas > 0 ? 'Mercancía en Bahía' : 'Posición Disponible');
          const batchNumber = bayData?.storedRemisiones?.[0]?.remisionNo;

          result.push({
            id: bayData?.id || `bay-${zoneCode}-${a.aisleCode}-${posIdx}`,
            code: codeKey,
            sectionCode: zoneCode,
            sectionId: `sec-${zoneCode.toLowerCase()}`,
            x: slot.x,
            y: slot.y,
            width: g.bayW,
            height: g.bayH,
            status,
            category: (bayData?.category as any) || 'FIXED_STORAGE',
            aisle: a.aisleCode,
            rack: slot.rack,
            level: 1,
            capacityTarimas,
            currentTarimas,
            skuDescription,
            batchNumber,
            alertType: isBlocked ? 'CRITICAL' : (currentTarimas >= capacityTarimas ? 'WARNING' : 'NONE'),
            alertMessage: isBlocked ? 'Bloqueada por Calidad QM' : undefined
          });
        }
      }
    }

    // Bahías de Staging / Rampas 1..12
    for (const r of this.rampStagingCoords) {
      const bayData = baysByCode.get(r.code.toUpperCase()) || baysByCode.get(`STAGING-R${r.ramp}`) || null;
      const currentTarimas = bayData ? bayData.currentStoredPallets : 0;
      const capacityTarimas = 22;
      const isBlocked = bayData?.isBlocked || bayData?.status === 'BLOCKED';
      const status: PositionStatus = isBlocked ? 'BLOCKED' : (currentTarimas > 0 ? 'OCCUPIED' : 'AVAILABLE');

      result.push({
        id: bayData?.id || `bay-${r.code.toLowerCase()}`,
        code: r.code,
        sectionCode: 'SEC-RAMP',
        sectionId: 'sec-ramp',
        x: r.x,
        y: r.y,
        width: 15,
        height: 13,
        status,
        category: 'TEMPORARY_BUFFER',
        aisle: 'ANDÉN',
        rack: 'PISO',
        level: 1,
        capacityTarimas,
        currentTarimas,
        skuDescription: bayData?.storedRemisiones?.[0]?.productName || `Buffer Temporal Rampa ${r.ramp}`,
        batchNumber: bayData?.storedRemisiones?.[0]?.remisionNo || 'N/A',
        alertType: currentTarimas > 0 ? 'WARNING' : 'NONE',
        alertMessage: currentTarimas > 0 ? `Mercancía en Andén (${currentTarimas} T)` : undefined
      });
    }

    return result;
  });

  protected getBayHeatmapClass(bay: SvgBayItem): string {
    if (bay.status === 'BLOCKED' || bay.alertType === 'CRITICAL') {
      return 'cad__bay-slot--heat-blocked';
    }
    if (bay.category === 'TEMPORARY_BUFFER') {
      if (bay.sectionCode === 'SEC-RAMP' && bay.currentTarimas === 0) {
        return 'cad__bay-slot--ramp-vacant';
      }
      return bay.currentTarimas > 0 ? 'cad__bay-slot--heat-temp' : 'cad__bay-slot--heat-vacant';
    }
    if (bay.category === 'PRELOAD_STAGING') {
      return bay.currentTarimas > 0 ? 'cad__bay-slot--heat-preload' : 'cad__bay-slot--heat-vacant';
    }
    const cap = bay.capacityTarimas || 22;
    const curr = bay.currentTarimas || 0;
    const ratio = cap > 0 ? (curr / cap) : 0;

    if (curr === 0 || ratio === 0) {
      return 'cad__bay-slot--heat-vacant';
    } else if (ratio > 0.80) {
      return 'cad__bay-slot--heat-full';
    } else if (ratio > 0.30) {
      return 'cad__bay-slot--heat-medium';
    } else {
      return 'cad__bay-slot--heat-empty';
    }
  }

  protected onSvgBayMouseEnter(event: MouseEvent, bay: SvgBayItem): void {
    this.hoveredSvgBay.set(bay);
  }

  protected onSvgBayMouseLeave(): void {
    this.hoveredSvgBay.set(null);
  }

  protected onSvgBayClick(bay: SvgBayItem, event: MouseEvent): void {
    event.stopPropagation();
    let found = this.bays().find(b => b.code.toUpperCase() === bay.code.toUpperCase() || b.id === bay.id);
    if (!found) {
      found = {
        id: bay.id,
        code: bay.code,
        name: `Almacén ${bay.sectionCode} · ${bay.code}`,
        zone: `Almacén ${bay.sectionCode}`,
        sectionName: `Almacén ${bay.sectionCode}`,
        aisle: bay.aisle,
        rack: bay.rack,
        level: String(bay.level),
        position: bay.code,
        capacityPallets: bay.capacityTarimas,
        currentStoredPallets: bay.currentTarimas,
        availableUnits: Math.max(0, bay.capacityTarimas - bay.currentTarimas),
        occupancyPercentage: bay.capacityTarimas > 0 ? Math.min(100, Math.round((bay.currentTarimas / bay.capacityTarimas) * 100)) : 0,
        status: bay.status,
        isBlocked: bay.status === 'BLOCKED',
        category: bay.category,
        trafficLight: bay.status === 'BLOCKED' || bay.currentTarimas >= bay.capacityTarimas ? 'RED' : (bay.currentTarimas > 0 ? 'AMBER' : 'GREEN'),
        isRecommended: false,
        storedRemisiones: bay.currentTarimas > 0 ? [{
          receptionFolio: bay.batchNumber || 'INV',
          remisionNo: bay.batchNumber || 'Stock',
          clientName: 'Cliente WMS',
          palletsCount: bay.currentTarimas,
          productName: bay.skuDescription || 'Mercancía',
          status: bay.status
        }] : []
      };
      this.bays.update(l => [found!, ...l]);
    }
    this.selectBay(found);
  }

  // ── CONTROLES DE ZOOM Y PAN ──
  protected onMapMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target && target.classList && target.classList.contains('cad__bay-slot')) return;

    this.isPanning = true;
    this.startPanX = e.clientX;
    this.startPanY = e.clientY;
    this.initialPanOffsetX = this.panOffset().x;
    this.initialPanOffsetY = this.panOffset().y;
  }

  protected onMapMouseMove(e: MouseEvent): void {
    if (!this.isPanning) return;
    const dx = e.clientX - this.startPanX;
    const dy = e.clientY - this.startPanY;
    this.panOffset.set({
      x: this.initialPanOffsetX + dx,
      y: this.initialPanOffsetY + dy
    });
  }

  protected onMapMouseUp(): void {
    this.isPanning = false;
  }

  protected onMapWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    this.zoomScale.update(s => Math.min(3.5, Math.max(0.6, +(s + delta).toFixed(2))));
  }

  protected zoomIn(): void {
    this.zoomScale.update(s => Math.min(3.5, +(s + 0.2).toFixed(2)));
  }

  protected zoomOut(): void {
    this.zoomScale.update(s => Math.max(0.6, +(s - 0.2).toFixed(2)));
  }

  protected setZoom(scale: number): void {
    this.zoomScale.set(scale);
    this.panOffset.set({ x: 0, y: 0 });
  }

  protected resetZoomAndPan(): void {
    this.zoomScale.set(1.0);
    this.panOffset.set({ x: 0, y: 0 });
  }

  protected toggleBaysVisibility(): void {
    this.showBaysInBlueprint.update(v => !v);
  }

  protected toggleTransitVisibility(): void {
    this.showTransitRoutes.update(v => !v);
  }

  private readonly apiService = inject(WarehouseMovementsApiService);
  private readonly layoutService = inject(WarehouseLayoutService);
  private readonly movementsService = inject(WarehouseMovementsService);

  @Input() branchId?: string;
  @Input() selectedLocationId?: string;
  @Input() selectedLocationCode?: string;
  @Input() allowAdminOverride: boolean = true;
  @Input() dialogTitle: string = 'Selector Visual de Ocupación de Bahías';
  @Input() defaultCapacity: number = 22;
  @Input() mode: 'destination' | 'origin' | 'all' = 'destination';

  @Output() locationSelected = new EventEmitter<BaySelectionResult>();
  @Output() closed = new EventEmitter<void>();

  loading = signal<boolean>(false);
  bays = signal<BayOccupancyItem[]>([]);
  searchQuery = signal<string>('');
  selectedBay = signal<BayOccupancyItem | null>(null);
  overrideReason = signal<string>('');
  showOverrideForm = signal<boolean>(false);

  // ── ESTADOS DE NAVEGACIÓN Y VISTA (MAPA 2D vs TARJETAS vs CUADRÍCULA) ──
  activeViewMode = signal<'map' | 'cards' | 'grid'>('map');
  hoveredMapZone = signal<WarehouseSection | null>(null);
  hoveredRamp = signal<string | null>(null);

  readonly rampStagingCoords = [
    { code: 'STAGING-R01', x: 810, y: 785, ramp: 1, label: 'R-01' },
    { code: 'STAGING-R02', x: 792, y: 785, ramp: 2, label: 'R-02' },
    { code: 'STAGING-R03', x: 775, y: 785, ramp: 3, label: 'R-03' },
    { code: 'STAGING-R04', x: 759, y: 785, ramp: 4, label: 'R-04' },
    { code: 'STAGING-R05', x: 743, y: 785, ramp: 5, label: 'R-05' },
    { code: 'STAGING-R06', x: 727, y: 785, ramp: 6, label: 'R-06' },
    { code: 'STAGING-R07', x: 710, y: 785, ramp: 7, label: 'R-07' },
    { code: 'STAGING-R08', x: 332, y: 825, ramp: 8, label: 'R-08' },
    { code: 'STAGING-R09', x: 304, y: 825, ramp: 9, label: 'R-09' },
    { code: 'STAGING-R10', x: 288, y: 825, ramp: 10, label: 'R-10' },
    { code: 'STAGING-R11', x: 260, y: 825, ramp: 11, label: 'R-11' },
    { code: 'STAGING-R12', x: 235, y: 825, ramp: 12, label: 'R-12' },
  ];

  readonly displaySections = computed<WarehouseSection[]>(() => {
    const fromService = this.layoutService.sections();
    return fromService && fromService.length > 0 ? fromService : OFFICIAL_CAD_SECTIONS;
  });

  selectedZoneId = signal<string | null>(null);
  statusFilter = signal<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED'>('ALL');
  categoryFilter = signal<'ALL' | 'FIXED' | 'TEMPORARY' | 'PRELOAD'>('ALL');
  currentPage = signal<number>(1);
  readonly pageSize: number = 24;

  // ── AGRUPACIÓN JERÁRQUICA POR ALMACÉN / ZONA (12 ALMACENES) ──
  zoneGroups = computed<WarehouseZoneGroup[]>(() => {
    const list = this.bays().filter(p => !p.code.startsWith('LOC-') && !p.code.startsWith('LOC_') && !p.code.startsWith('LOCALM-'));
    if (list.length === 0) return [];

    const groupMap = new Map<string, {
      id: string;
      code: string;
      name: string;
      zone: string;
      sectionName: string;
      positions: BayOccupancyItem[];
      macroCapacity: number;
    }>();

    for (const item of list) {
      let zoneKey = (item.zone || '').trim();
      if (!zoneKey || zoneKey.toUpperCase() === 'ALMACÉN' || zoneKey.toUpperCase() === 'GENERAL') {
        const match = item.code.match(/^(?:POS|LOC|LOC-ALM)[-_]?([A-Z0-9]+)/i);
        if (match && match[1]) {
          zoneKey = `Almacén ${match[1].toUpperCase()}`;
        } else if (item.sectionName && item.sectionName !== 'Nave Principal') {
          zoneKey = item.sectionName;
        } else {
          zoneKey = 'Almacén Principal';
        }
      } else if (!zoneKey.toLowerCase().startsWith('almacén') && !zoneKey.toLowerCase().startsWith('zona') && !zoneKey.toLowerCase().startsWith('nave')) {
        zoneKey = `Almacén ${zoneKey.toUpperCase()}`;
      }

      if (!groupMap.has(zoneKey)) {
        groupMap.set(zoneKey, {
          id: zoneKey.toLowerCase().replace(/\s+/g, '-'),
          code: zoneKey,
          name: zoneKey,
          zone: item.zone || zoneKey,
          sectionName: item.sectionName || zoneKey,
          positions: [],
          macroCapacity: 0,
        });
      }

      const g = groupMap.get(zoneKey)!;
      g.positions.push(item);
    }

    return Array.from(groupMap.values()).map((g) => {
      // Separación por categorías de posición
      const fixedPositions = g.positions.filter((p) => p.category === 'FIXED_STORAGE');
      const tempPositions = g.positions.filter((p) => p.category === 'TEMPORARY_BUFFER');
      const preloadPositions = g.positions.filter((p) => p.category === 'PRELOAD_STAGING');

      // 1. Métricas de Posiciones Fijas (100% Base Nominal)
      const fixedPositionsCount = fixedPositions.length;
      const fixedAvailableCount = fixedPositions.filter((p) => !p.isBlocked && p.currentStoredPallets === 0 && p.status === 'ACTIVE').length;
      const fixedOccupiedCount = fixedPositions.filter((p) => p.currentStoredPallets > 0).length;
      const fixedCapacityPallets = fixedPositions.reduce((acc, p) => acc + (p.capacityPallets || this.defaultCapacity), 0);
      const fixedOccupiedPallets = fixedPositions.reduce((acc, p) => acc + (p.currentStoredPallets || 0), 0);
      const fixedAvailablePallets = Math.max(0, fixedCapacityPallets - fixedOccupiedPallets);
      const nominalOccupancyPct = fixedCapacityPallets > 0
        ? Math.min(100, Math.round(((fixedOccupiedPallets / fixedCapacityPallets) * 1000.0) / 10.0))
        : 0;

      // 2. Métricas de Posiciones Temporales (Sobrecupo / Buffer %)
      const tempPositionsCount = tempPositions.length;
      const tempAvailableCount = tempPositions.filter((p) => !p.isBlocked && p.currentStoredPallets === 0 && p.status === 'ACTIVE').length;
      const tempOccupiedCount = tempPositions.filter((p) => p.currentStoredPallets > 0).length;
      const tempCapacityPallets = tempPositions.reduce((acc, p) => acc + (p.capacityPallets || this.defaultCapacity), 0);
      const tempOccupiedPallets = tempPositions.reduce((acc, p) => acc + (p.currentStoredPallets || 0), 0);
      const overflowPct = fixedCapacityPallets > 0
        ? Math.round(((tempOccupiedPallets / fixedCapacityPallets) * 1000.0) / 10.0)
        : 0;

      // 3. Posiciones de Precarga
      const preloadPositionsCount = preloadPositions.length;
      const preloadOccupiedPallets = preloadPositions.reduce((acc, p) => acc + (p.currentStoredPallets || 0), 0);

      // Totales del Almacén
      const totalPos = g.positions.length;
      const availablePos = g.positions.filter((p) => !p.isBlocked && p.currentStoredPallets === 0 && p.status === 'ACTIVE').length;
      const occupiedPos = g.positions.filter((p) => p.currentStoredPallets > 0).length;
      const blockedPos = g.positions.filter((p) => p.isBlocked || p.status !== 'ACTIVE').length;

      const totalCap = fixedCapacityPallets + tempCapacityPallets;
      const totalStored = fixedOccupiedPallets + tempOccupiedPallets + preloadOccupiedPallets;
      const availableUnits = Math.max(0, totalCap - totalStored);

      // Semáforo Nominal
      let trafficLight: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
      if (nominalOccupancyPct > 90 || overflowPct > 0) trafficLight = 'AMBER';
      if (nominalOccupancyPct >= 100 && overflowPct > 15) trafficLight = 'RED';

      // Detección de Sugerencia de Reubicación
      const hasReallocationOpportunity = tempOccupiedCount > 0 && fixedAvailableCount > 0;
      const reallocationCandidateCount = Math.min(tempOccupiedCount, fixedAvailableCount);

      let zoneLetter = 'A';
      const m = g.code.match(/([A-M])/i);
      if (m && m[1]) zoneLetter = m[1].toUpperCase();
      const secDef = this.displaySections().find(s => s.code.toUpperCase() === zoneLetter);

      return {
        id: g.id,
        code: zoneLetter,
        name: g.name,
        zone: g.zone,
        sectionName: g.sectionName,
        categoryLabel: secDef?.category || 'Almacenamiento',
        polygonPoints: secDef?.polygonPoints,
        labelX: secDef?.labelPosition?.x,
        labelY: secDef?.labelPosition?.y,
        sublabelX: secDef?.sublabelPosition?.x,
        sublabelY: secDef?.sublabelPosition?.y,
        
        fixedPositionsCount,
        fixedAvailableCount,
        fixedOccupiedCount,
        fixedCapacityPallets,
        fixedOccupiedPallets,
        fixedAvailablePallets,
        nominalOccupancyPercentage: nominalOccupancyPct,

        tempPositionsCount,
        tempAvailableCount,
        tempOccupiedCount,
        tempCapacityPallets,
        tempOccupiedPallets,
        overflowPercentage: overflowPct,

        preloadPositionsCount,
        preloadOccupiedPallets,

        totalPositions: totalPos,
        availablePositions: availablePos,
        occupiedPositions: occupiedPos,
        blockedPositions: blockedPos,
        totalCapacityPallets: totalCap,
        currentStoredPallets: totalStored,
        availablePallets: availableUnits,
        trafficLight: trafficLight,

        hasReallocationOpportunity,
        reallocationCandidateCount,

        positions: g.positions.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
      };
    });
  });

  // ── FILTRADO DE GRUPOS POR BÚSQUEDA ──
  filteredZoneGroups = computed<WarehouseZoneGroup[]>(() => {
    const list = this.zoneGroups();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;
    return list.filter((g) => {
      const matchName = g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q) || `almacén ${g.code.toLowerCase()}`.includes(q);
      const matchCat = g.categoryLabel?.toLowerCase().includes(q);
      const matchPos = g.positions.some((p) => p.code.toLowerCase().includes(q) || (p.name && p.name.toLowerCase().includes(q)));
      return matchName || matchCat || matchPos;
    });
  });

  // ── RESULTADOS RÁPIDOS DE BÚSQUEDA DIRECTA POR POSICIÓN / NOMBRE ──
  quickSearchResults = computed<BayOccupancyItem[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    const list = this.bays();
    const isOrigin = this.mode === 'origin';
    return list
      .filter((p) => {
        if (isOrigin && p.currentStoredPallets === 0) return false;
        const matchCode = p.code.toLowerCase().includes(q);
        const matchName = p.name && p.name.toLowerCase().includes(q);
        const matchSec = p.sectionName && p.sectionName.toLowerCase().includes(q);
        const matchRem = p.storedRemisiones?.some((r) => r.remisionNo?.toLowerCase().includes(q) || r.productName?.toLowerCase().includes(q));
        return matchCode || matchName || matchSec || matchRem;
      })
      .slice(0, 8);
  });

  // ── MÉTODOS DEL MAPA SVG 2D ──
  getZoneGroupForCode(code: string): WarehouseZoneGroup | undefined {
    const clean = code.toUpperCase().trim();
    return this.zoneGroups().find(
      (g) => g.code.toUpperCase() === clean ||
             g.id.toUpperCase().endsWith(`-${clean.toLowerCase()}`) ||
             g.name.toUpperCase().includes(`ALMACÉN ${clean}`) ||
             g.name.toUpperCase().includes(`ALMACEN ${clean}`)
    );
  }

  isSectionMatchingSearch(code: string): boolean {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return true;
    const sec = this.displaySections().find((s) => s.code.toLowerCase() === code.toLowerCase());
    const grp = this.getZoneGroupForCode(code);
    if (!sec && !grp) return false;
    const matchCode = code.toLowerCase().includes(q) || `almacén ${code.toLowerCase()}`.includes(q) || `almacen ${code.toLowerCase()}`.includes(q);
    const matchName = sec?.name.toLowerCase().includes(q) || grp?.name.toLowerCase().includes(q);
    const matchCat = sec?.category.toLowerCase().includes(q) || grp?.categoryLabel?.toLowerCase().includes(q);
    const matchPos = grp?.positions.some((p) => p.code.toLowerCase().includes(q) || (p.name && p.name.toLowerCase().includes(q)));
    return !!(matchCode || matchName || matchCat || matchPos);
  }

  openZoneFromMap(sec: WarehouseSection): void {
    const grp = this.getZoneGroupForCode(sec.code);
    if (grp) {
      this.openZone(grp);
    } else {
      this.selectedZoneId.set(`almacen-${sec.code.toLowerCase()}`);
      this.currentPage.set(1);
    }
  }

  selectRampStagingBay(rampCode: string): void {
    let found = this.bays().find(b => b.code.toUpperCase() === rampCode.toUpperCase());
    if (!found) {
      const live = this.movementsService.getBayLiveOccupancy(rampCode);
      const current = live ? live.totalPallets : 0;
      found = {
        id: `bay-${rampCode.toLowerCase()}`,
        code: rampCode,
        name: `Rampa ${rampCode.replace('STAGING-R', 'R-')} · Buffer Temporal`,
        zone: 'Buffer Temporal Andenes',
        sectionName: 'Rampas de Recepción',
        capacityPallets: 22,
        currentStoredPallets: current,
        availableUnits: Math.max(0, 22 - current),
        occupancyPercentage: current > 0 ? Math.min(100, Math.round((current / 22) * 100)) : 0,
        status: current >= 22 ? 'OCCUPIED' : (current > 0 ? 'ACTIVE' : 'ACTIVE'),
        isBlocked: false,
        category: 'TEMPORARY_BUFFER',
        trafficLight: current >= 22 ? 'RED' : (current > 0 ? 'AMBER' : 'GREEN'),
        isRecommended: true,
        storedRemisiones: live ? live.remisiones : [],
      };
      this.bays.update(l => [found!, ...l]);
    }
    this.selectBay(found);
  }

  quickSelectBay(bay: BayOccupancyItem): void {
    this.selectBay(bay);
    this.confirmSelection();
  }

  // ── ALMACÉN / ZONA ACTIVA EN DETALLE ──
  activeZoneGroup = computed<WarehouseZoneGroup | null>(() => {
    const id = this.selectedZoneId();
    if (!id) return null;
    return this.zoneGroups().find((g) => g.id === id) || null;
  });

  // ── KPIS GLOBALES PARA LA CABECERA ──
  globalKpis = computed(() => {
    const groups = this.zoneGroups();
    const totalWarehouses = groups.length;
    const totalFixedPositions = groups.reduce((acc, g) => acc + g.fixedPositionsCount, 0);
    const totalTempPositions = groups.reduce((acc, g) => acc + g.tempPositionsCount, 0);
    const totalPreloadPositions = groups.reduce((acc, g) => acc + g.preloadPositionsCount, 0);
    const totalCapacity = groups.reduce((acc, g) => acc + g.fixedCapacityPallets, 0);
    const totalStored = groups.reduce((acc, g) => acc + g.fixedOccupiedPallets, 0);
    const totalPositions = groups.reduce((acc, g) => acc + g.totalPositions, 0);
    const totalAvailable = groups.reduce((acc, g) => acc + g.availablePositions, 0);
    const globalOccupancy = totalCapacity > 0 ? Math.min(100, Math.round(((totalStored / totalCapacity) * 1000.0) / 10.0)) : 0;
    const totalReallocations = groups.filter((g) => g.hasReallocationOpportunity).length;

    return {
      totalWarehouses,
      totalFixedPositions,
      totalTempPositions,
      totalPreloadPositions,
      totalCapacity,
      totalStored,
      totalPositions,
      totalAvailable,
      globalOccupancy,
      totalReallocations,
    };
  });

  // ── FILTRADO DE POSICIONES EN LA ZONA SELECCIONADA ──
  filteredPositions = computed(() => {
    const group = this.activeZoneGroup();
    const list = group ? group.positions : this.bays();
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    const catFilter = this.categoryFilter();

    return list.filter((p) => {
      // Filtro de Categoría
      if (catFilter === 'FIXED' && p.category !== 'FIXED_STORAGE') return false;
      if (catFilter === 'TEMPORARY' && p.category !== 'TEMPORARY_BUFFER') return false;
      if (catFilter === 'PRELOAD' && p.category !== 'PRELOAD_STAGING') return false;

      // Filtro de Estado
      if (filter === 'AVAILABLE' && (p.isBlocked || p.status === 'BLOCKED' || (p.availableUnits != null && p.availableUnits <= 0))) {
        return false;
      }
      if (filter === 'OCCUPIED' && p.currentStoredPallets === 0) {
        return false;
      }
      if (filter === 'BLOCKED' && !p.isBlocked && p.status !== 'BLOCKED') {
        return false;
      }

      // Filtro de Texto
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.aisle && p.aisle.toLowerCase().includes(q)) ||
        (p.rack && p.rack.toLowerCase().includes(q)) ||
        (p.level && p.level.toLowerCase().includes(q)) ||
        (p.sectionName && p.sectionName.toLowerCase().includes(q))
      );
    });
  });

  // ── PAGINACIÓN DE POSICIONES ──
  totalPages = computed(() => {
    const total = this.filteredPositions().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  pagedPositions = computed(() => {
    const list = this.filteredPositions();
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  recommendedBay = computed(() => {
    return this.bays().find((b) => b.isRecommended) || null;
  });

  ngOnInit(): void {
    if (this.layoutService.sections().length === 0) {
      this.layoutService.loadTopology();
    }
    this.loadBays();
  }

  loadBays(): void {
    this.loading.set(true);
    this.layoutService.fetchPositions().subscribe({
      next: (positions: PositionDetail[]) => {
        if (positions && positions.length > 0) {
          const mapped: BayOccupancyItem[] = positions
            .filter((p) => !p.code.startsWith('LOC-') && !p.code.startsWith('LOC_') && !p.code.startsWith('LOCALM-'))
            .map((p) => this.mapPositionDetailToBayItem(p));
          this.injectRampStagingBays(mapped);
          this.bays.set(mapped);
          this.applyPreselection(mapped);
        } else {
          const fallback = this.generateEnterpriseTopology();
          this.injectRampStagingBays(fallback);
          this.bays.set(fallback);
          this.applyPreselection(fallback);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Error al consultar posiciones vía LayoutService, usando topología determinista:', err);
        const fallback = this.generateEnterpriseTopology();
        this.injectRampStagingBays(fallback);
        this.bays.set(fallback);
        this.applyPreselection(fallback);
        this.loading.set(false);
      },
    });
  }

  private injectRampStagingBays(targetList: BayOccupancyItem[]): void {
    const existing = new Set(targetList.map((b) => b.code.toUpperCase()));
    for (const rmp of this.rampStagingCoords) {
      if (!existing.has(rmp.code.toUpperCase())) {
        const live = this.movementsService.getBayLiveOccupancy(rmp.code);
        const current = live ? live.totalPallets : 0;
        targetList.unshift({
          id: `bay-${rmp.code.toLowerCase()}`,
          code: rmp.code,
          name: `Rampa ${rmp.label} · Buffer Temporal`,
          zone: 'Buffer Temporal Andenes',
          sectionName: 'Rampas de Recepción',
          capacityPallets: 22,
          currentStoredPallets: current,
          availableUnits: Math.max(0, 22 - current),
          occupancyPercentage: current > 0 ? Math.min(100, Math.round((current / 22) * 100)) : 0,
          status: current >= 22 ? 'OCCUPIED' : (current > 0 ? 'ACTIVE' : 'ACTIVE'),
          isBlocked: false,
          category: 'TEMPORARY_BUFFER',
          trafficLight: current >= 22 ? 'RED' : (current > 0 ? 'AMBER' : 'GREEN'),
          isRecommended: true,
          storedRemisiones: live ? live.remisiones : [],
        });
      }
    }
  }

  private mapPositionDetailToBayItem(p: PositionDetail): BayOccupancyItem {
    let zoneLetter = 'A';
    const codeMatch = p.code.match(/^(?:POS|LOC|LOC-ALM)[-_]?([A-Z0-9]+)/i);
    if (codeMatch && codeMatch[1]) {
      zoneLetter = codeMatch[1].toUpperCase();
    } else if (p.sectionName) {
      const secMatch = p.sectionName.match(/^(?:Almac[eé]n|Nave|Zona)\s*([A-Za-z0-9]+)/i);
      if (secMatch && secMatch[1]) {
        zoneLetter = secMatch[1].toUpperCase();
      }
    }

    const zoneName = `Almacén ${zoneLetter}`;
    const live = this.movementsService.getBayLiveOccupancy(p.code);
    const dynamicCap = (p as any).capacityUnits || p.capacityTarimas || (p as any).capacity;
    const capacity = dynamicCap != null && dynamicCap > 0 ? dynamicCap : this.defaultCapacity;
    const current = (live && live.totalPallets > 0) ? live.totalPallets : (p.currentTarimas || (live ? live.totalPallets : 0));
    const storedRemisiones = (live && live.remisiones && live.remisiones.length > 0)
      ? live.remisiones
      : (current > 0 ? [{
          receptionFolio: p.batchNumber || 'INV',
          remisionNo: p.skuCode || 'Stock',
          clientName: 'Cliente WMS',
          palletsCount: current,
          productName: p.skuDescription || 'Mercancía',
          status: 'ALMACENADO',
        }] : []);
    const available = Math.max(0, capacity - current);
    const occupancyPct = capacity > 0 ? Math.min(100, Math.round(((current / capacity) * 1000.0) / 10.0)) : 0;

    const isBlocked = p.status === 'BLOCKED' || (p as any).isBlocked === true;
    let trafficLight: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    if (isBlocked || occupancyPct >= 100) {
      trafficLight = 'RED';
    } else if (occupancyPct > 0) {
      trafficLight = 'AMBER';
    }

    let category: BayCategory = p.category || 'FIXED_STORAGE';
    if (!p.category || p.category === 'FIXED_STORAGE') {
      if (p.code.includes('-T') || p.code.includes('TMP') || p.code.startsWith('STAGING') || p.code.includes('BUFFER')) {
        category = 'TEMPORARY_BUFFER';
      } else if (p.code.includes('-PRE') || p.code.includes('PRECARGA') || p.code.includes('PRE')) {
        category = 'PRELOAD_STAGING';
      }
    }

    let aisle = '';
    let rack = '';
    let level = '1';
    let position = p.code;

    const fixedMatch = p.code.match(/POS-[A-Z]+-(\d+)/i);
    const tempMatch = p.code.match(/POS-[A-Z]+-T(\d+)/i);
    const preMatch = p.code.match(/POS-[A-Z]+-PRE(\d+)/i);

    if (fixedMatch) {
      const n = parseInt(fixedMatch[1], 10);
      aisle = String(Math.floor((n - 1) / 30) + 1).padStart(2, '0');
      rack = String(Math.floor(((n - 1) % 30) / 3) + 1).padStart(2, '0');
      level = String(((n - 1) % 3) + 1);
      position = fixedMatch[1];
    } else if (tempMatch) {
      const n = parseInt(tempMatch[1], 10);
      aisle = 'TMP';
      rack = String(Math.floor((n - 1) / 5) + 1).padStart(2, '0');
      level = '1';
      position = `T${tempMatch[1]}`;
    } else if (preMatch) {
      aisle = 'PRE';
      rack = '01';
      level = '1';
      position = `PRE${preMatch[1]}`;
    }

    return {
      id: p.id || p.code,
      code: p.code,
      name: `${zoneName} · ${p.code}`,
      zone: zoneName,
      sectionName: p.sectionName || zoneName,
      aisle,
      rack,
      level,
      position,
      capacityPallets: capacity,
      currentStoredPallets: current,
      availableUnits: available,
      occupancyPercentage: occupancyPct,
      status: isBlocked ? 'BLOCKED' : (current >= capacity ? 'OCCUPIED' : (current > 0 ? 'ACTIVE' : 'ACTIVE')),
      isBlocked: isBlocked,
      category: category,
      trafficLight: trafficLight,
      isRecommended: false,
      storedRemisiones,
    };
  }

  private buildTopologyItem(
    id: string,
    code: string,
    name: string,
    zone: string,
    sectionName: string,
    aisle: string,
    rack: string,
    level: string,
    position: string,
    category: BayCategory,
    capacity: number = this.defaultCapacity
  ): BayOccupancyItem {
    const live = this.movementsService.getBayLiveOccupancy(code);
    const current = live ? live.totalPallets : 0;
    const storedRemisiones = live ? live.remisiones : [];
    const available = Math.max(0, capacity - current);
    const occupancyPct = capacity > 0 ? Math.min(100, Math.round(((current / capacity) * 1000.0) / 10.0)) : 0;

    let trafficLight: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    if (occupancyPct >= 100) {
      trafficLight = 'RED';
    } else if (occupancyPct > 0) {
      trafficLight = 'AMBER';
    }

    return {
      id,
      code,
      name,
      zone,
      sectionName,
      aisle,
      rack,
      level,
      position,
      capacityPallets: capacity,
      currentStoredPallets: current,
      availableUnits: available,
      occupancyPercentage: occupancyPct,
      status: current >= capacity ? 'OCCUPIED' : (current > 0 ? 'ACTIVE' : 'ACTIVE'),
      isBlocked: false,
      category,
      trafficLight,
      isRecommended: false,
      storedRemisiones,
    };
  }

  /**
   * Generador determinista de la topología real de los 12 Almacenes (A..M):
   * 1,180 Fijas, 474 Temporales, 48 Precarga (1,702 Posiciones Reales)
   */
  private generateEnterpriseTopology(): BayOccupancyItem[] {
    const warehouses = [
      { zone: 'A', name: 'Almacén A', fixed: 175, temp: 50, preload: 4 },
      { zone: 'B', name: 'Almacén B', fixed: 37,  temp: 30, preload: 4 },
      { zone: 'C', name: 'Almacén C', fixed: 72,  temp: 50, preload: 4 },
      { zone: 'D', name: 'Almacén D', fixed: 117, temp: 50, preload: 4 },
      { zone: 'E', name: 'Almacén E', fixed: 112, temp: 30, preload: 4 },
      { zone: 'F', name: 'Almacén F', fixed: 91,  temp: 64, preload: 4 },
      { zone: 'G', name: 'Almacén G', fixed: 38,  temp: 50, preload: 4 },
      { zone: 'H', name: 'Almacén H', fixed: 86,  temp: 20, preload: 4 },
      { zone: 'I', name: 'Almacén I', fixed: 117, temp: 30, preload: 4 },
      { zone: 'J', name: 'Almacén J', fixed: 22,  temp: 30, preload: 4 },
      { zone: 'K', name: 'Almacén K', fixed: 181, temp: 30, preload: 4 },
      { zone: 'L', name: 'Almacén L', fixed: 132, temp: 40, preload: 4 },
    ];

    const result: BayOccupancyItem[] = [];
    const defaultCap = this.defaultCapacity;

    for (const wh of warehouses) {
      // 1. Fijas
      for (let i = 1; i <= wh.fixed; i++) {
        const numStr = String(i).padStart(3, '0');
        const code = `POS-${wh.zone}-${numStr}`;
        const aisle = String(Math.floor((i - 1) / 30) + 1).padStart(2, '0');
        const rack = String(Math.floor(((i - 1) % 30) / 3) + 1).padStart(2, '0');
        const level = String(((i - 1) % 3) + 1);
        result.push(
          this.buildTopologyItem(
            `fixed-${wh.zone}-${numStr}`,
            code,
            `${wh.name} · Fija ${numStr}`,
            wh.zone,
            wh.name,
            aisle,
            rack,
            level,
            numStr,
            'FIXED_STORAGE',
            defaultCap
          )
        );
      }

      // 2. Temporales
      for (let i = 1; i <= wh.temp; i++) {
        const numStr = String(i).padStart(2, '0');
        const code = `POS-${wh.zone}-T${numStr}`;
        const aisle = 'TMP';
        const rack = String(Math.floor((i - 1) / 5) + 1).padStart(2, '0');
        const level = '1';
        result.push(
          this.buildTopologyItem(
            `temp-${wh.zone}-${numStr}`,
            code,
            `${wh.name} · Temporal T${numStr}`,
            wh.zone,
            wh.name,
            aisle,
            rack,
            level,
            `T${numStr}`,
            'TEMPORARY_BUFFER',
            defaultCap
          )
        );
      }

      // 3. Precarga
      for (let i = 1; i <= wh.preload; i++) {
        const code = `POS-${wh.zone}-PRE0${i}`;
        result.push(
          this.buildTopologyItem(
            `preload-${wh.zone}-0${i}`,
            code,
            `${wh.name} · Precarga PRE-0${i}`,
            wh.zone,
            wh.name,
            'PRE',
            '01',
            '1',
            `PRE0${i}`,
            'PRELOAD_STAGING',
            defaultCap
          )
        );
      }
    }

    return result;
  }

  private applyPreselection(list: BayOccupancyItem[]): void {
    let matchedBay: BayOccupancyItem | undefined;
    if (this.selectedLocationId) {
      matchedBay = list.find((b) => b.id === this.selectedLocationId);
    }
    
    if (!matchedBay && this.selectedLocationCode) {
      const codeClean = this.selectedLocationCode.toUpperCase().trim();
      matchedBay = list.find((b) => b.code.toUpperCase().trim() === codeClean);
      
      // Si no hay coincidencia exacta de código, buscar por número o zona (ej. LOC-A-01 -> POS-A-001)
      if (!matchedBay) {
        const zoneMatch = codeClean.match(/^(?:POS|LOC|LOC-ALM)[-_]?([A-Z0-9]+)/i);
        if (zoneMatch && zoneMatch[1]) {
          const zoneChar = zoneMatch[1].toUpperCase();
          const groups = this.zoneGroups();
          const targetGroup = groups.find(
            (g) => g.code.toUpperCase().includes(zoneChar) || g.name.toUpperCase().includes(zoneChar) || g.id === `almacén-${zoneChar.toLowerCase()}`
          );
          if (targetGroup) {
            this.selectedZoneId.set(targetGroup.id);
          }
        }
      }
    }

    if (matchedBay) {
      this.selectedBay.set(matchedBay);
      // Auto-abrir la zona correspondiente para contextualizar la posición
      const groups = this.zoneGroups();
      const targetGroup = groups.find((g) => g.positions.some((p) => p.id === matchedBay!.id || p.code === matchedBay!.code));
      if (targetGroup) {
        this.selectedZoneId.set(targetGroup.id);
        const posIndex = targetGroup.positions.findIndex((p) => p.id === matchedBay!.id || p.code === matchedBay!.code);
        if (posIndex >= 0) {
          this.currentPage.set(Math.floor(posIndex / this.pageSize) + 1);
        }
      }
    }
  }

  // ── MÉTODOS DE NAVEGACIÓN Y CONTROL ──
  openZone(group: WarehouseZoneGroup): void {
    this.selectedZoneId.set(group.id);
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.categoryFilter.set('ALL');
    this.currentPage.set(1);
  }

  backToGlobalView(): void {
    this.selectedZoneId.set(null);
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.categoryFilter.set('ALL');
    this.currentPage.set(1);
  }

  setStatusFilter(filter: 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED'): void {
    this.statusFilter.set(filter);
    this.currentPage.set(1);
  }

  setCategoryFilter(filter: 'ALL' | 'FIXED' | 'TEMPORARY' | 'PRELOAD'): void {
    this.categoryFilter.set(filter);
    this.currentPage.set(1);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  selectBay(bay: BayOccupancyItem): void {
    if (bay.isBlocked || bay.status === 'BLOCKED') return;
    this.selectedBay.set(bay);

    if (this.mode === 'origin') {
      this.showOverrideForm.set(false);
      return;
    }

    const rec = this.recommendedBay();
    const isOverriding = rec ? rec.id !== bay.id : false;
    const isSaturated = bay.availableUnits != null && bay.availableUnits <= 0;
    this.showOverrideForm.set(isOverriding || isSaturated);
  }

  confirmSelection(): void {
    const bay = this.selectedBay();
    if (!bay) return;

    if (this.mode === 'origin') {
      this.locationSelected.emit({
        locationId: bay.id,
        locationCode: bay.code,
        isOverride: false,
      });
      return;
    }

    const isSaturated = bay.availableUnits != null && bay.availableUnits <= 0;
    if (isSaturated && !this.allowAdminOverride) {
      return;
    }

    const rec = this.recommendedBay();
    const isOverride = rec ? rec.id !== bay.id : false;

    this.locationSelected.emit({
      locationId: bay.id,
      locationCode: bay.code,
      isOverride: isOverride || isSaturated,
      overrideReason: (isOverride || isSaturated) ? this.overrideReason().trim() : undefined,
    });
  }

  closeModal(): void {
    this.closed.emit();
  }
}
