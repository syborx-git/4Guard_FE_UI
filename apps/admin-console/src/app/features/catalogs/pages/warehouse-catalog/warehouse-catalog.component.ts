/**
 * @file warehouse-catalog.component.ts
 * @description Módulo Unificado de Catálogo de Almacén, Topología 2D y Consulta de Bahías [HU-048 / HU-127].
 * 100% Integrado al Backend Spring Boot y PostgreSQL (Sin mocks ni localStorage).
 */

import {
  Component, inject, signal, computed,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WarehouseLayoutService } from '../../services/warehouse-layout.service';
import {
  WarehouseSection,
  PositionDetail,
  PositionStatus,
  WarehouseBay
} from '../../models/warehouse-catalog.models';
import { WarehouseSectionSetupModalComponent } from '../../components/warehouse-section-setup-modal/warehouse-section-setup-modal.component';

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

type WarehouseSubTab = 'topology' | 'bays';
type InspectorMode = 'view' | 'block';

@Component({
  selector: 'fg-warehouse-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WarehouseSectionSetupModalComponent],
  templateUrl: './warehouse-catalog.component.html',
  styleUrl: './warehouse-catalog.component.css',
})
export class WarehouseCatalogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('blueprintContainer') blueprintContainerRef?: ElementRef<HTMLDivElement>;

  protected readonly layoutService = inject(WarehouseLayoutService);
  private readonly ngZone = inject(NgZone);

  // ─── Sub-Pestañas & Vista ─────────────────────────────────────────────────
  protected readonly activeTab = signal<WarehouseSubTab>('topology');
  protected readonly isKpiCollapsed = signal<boolean>(false);

  protected toggleKpiCollapse(): void {
    this.isKpiCollapsed.update(v => !v);
  }

  // ─── Datos Reactivos del Backend ─────────────────────────────────────────
  protected readonly sections   = this.layoutService.sections;
  protected readonly stats      = this.layoutService.stats;
  protected readonly blockReasons = this.layoutService.blockReasons;
  protected readonly allPositions = this.layoutService.allPositions;
  protected readonly isLoadingAllPositions = this.layoutService.isLoadingAllPositions;
  protected readonly isLoadingTopology = this.layoutService.isLoadingTopology;

  // ─── Filtros de Pestaña 2: Consulta de Bahías ────────────────────────────
  protected readonly selectedZone     = signal<string>('ALL');
  protected readonly selectedCategory = signal<string>('ALL');
  protected readonly occupancyFilter  = signal<string>('ALL');
  protected readonly searchBayCode    = signal<string>('');

  // ─── Estado de Pestaña 1: Mapa Interactivo SVG ───────────────────────────
  protected readonly selectedSection  = signal<WarehouseSection | null>(null);
  protected readonly hoveredSection   = signal<WarehouseSection | null>(null);
  protected readonly tooltipCoords    = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  protected readonly isTooltipVisible = signal<boolean>(false);

  protected readonly sectionSearchQuery    = signal<string>('');
  protected readonly sectionStatusFilter   = signal<'ALL' | 'OCCUPIED' | 'AVAILABLE' | 'BLOCKED'>('ALL');
  protected readonly sectionCategoryFilter = signal<'ALL' | 'FIXED' | 'TEMPORARY' | 'PRELOAD'>('ALL');
  protected readonly isDetailPanelOpen     = computed(() => this.selectedSection() !== null);

  // ─── Zoom & Pan (Blueprint SVG) ──────────────────────────────────────────
  protected readonly zoomScale = signal<number>(1.25);
  private panX = 0;
  private panY = 0;
  protected readonly panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private startPanX = 0;
  private startPanY = 0;

  private cleanupFns: (() => void)[] = [];

  // ─── Inspector Modal FSM (Compartido) ────────────────────────────────────
  protected readonly inspectedPosition = signal<PositionDetail | null>(null);
  protected readonly inspectorMode     = signal<InspectorMode>('view');
  protected readonly blockReason       = signal<string>('');
  protected readonly blockComment      = signal<string>('');

  // ─── Capas del Croquis (Bahías y Conexión Topológica) ───────────────────
  protected readonly showBaysInBlueprint   = signal<boolean>(true);
  protected readonly showTransitRoutes     = signal<boolean>(true);
  protected readonly hoveredSvgBay         = signal<SvgBayItem | null>(null);
  protected readonly activeHoveredCode     = signal<string | null>(null);

  // ─── Generador Paramétrico de Bahías ────────────────────────────────────
  protected readonly isBayGeneratorOpen      = signal<boolean>(false);
  protected readonly genSectionCode         = signal<string>('A');
  protected readonly genAislesCount         = signal<number>(2);
  protected readonly genBaysPerAisle        = signal<number>(10);
  protected readonly genTiers               = signal<number>(3);
  protected readonly genCapacity            = signal<number>(22);
  protected readonly genCategory            = signal<'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING'>('FIXED_STORAGE');
  protected readonly isGeneratingBays       = signal<boolean>(false);
  protected readonly generatorSuccessNotice = signal<string | null>(null);

  // ─── Modal de Configuración / Activación de Nave ──────────────────────────
  protected readonly isSetupModalOpen = signal<boolean>(false);
  protected readonly setupModalSection = signal<any>(null);

  protected openSetupModal(section?: WarehouseSection | null): void {
    const target = section || this.selectedSection();
    if (!target) return;
    this.setupModalSection.set({
      id: target.id,
      code: target.code,
      name: target.name,
      category: target.category,
      posFijas: target.posFijas,
      capacidadTarimas: target.capacidadTarimas,
      factorEstiba: target.factorEstiba,
      notes: target.notes
    });
    this.isSetupModalOpen.set(true);
  }

  protected onSectionSetupSaved(updatedSection: any): void {
    this.isSetupModalOpen.set(false);
    this.layoutService.loadTopology();
    this.layoutService.loadAllPositions();
    const cur = this.selectedSection();
    if (cur && cur.id === updatedSection?.id) {
      this.layoutService.loadPositionsForSection(cur.id);
    }
  }

  // ─── Computados: Sección Seleccionada (Pestaña 1) ────────────────────────
  protected readonly isPositionsLoading = computed(() => {
    const sec = this.selectedSection();
    return sec ? this.layoutService.isLoadingPositionsForSection(sec.id) : false;
  });

  protected readonly currentSectionPositions = computed<PositionDetail[]>(() => {
    const sec = this.selectedSection();
    if (!sec) return [];
    return this.layoutService.getPositionsForSection(sec.id);
  });

  protected readonly filteredSectionPositions = computed<PositionDetail[]>(() => {
    const list      = this.currentSectionPositions();
    const query     = this.sectionSearchQuery().trim().toLowerCase();
    const statusF   = this.sectionStatusFilter();
    const catF      = this.sectionCategoryFilter();

    return list.filter((pos) => {
      // Filtro de Categoría
      if (catF === 'FIXED' && pos.category !== 'FIXED_STORAGE') return false;
      if (catF === 'TEMPORARY' && pos.category !== 'TEMPORARY_BUFFER') return false;
      if (catF === 'PRELOAD' && pos.category !== 'PRELOAD_STAGING') return false;

      // Filtro de Estado
      const matchS = statusF === 'ALL' || pos.status === statusF;

      // Filtro de Búsqueda
      const matchQ = !query ||
        pos.code.toLowerCase().includes(query) ||
        pos.skuDescription.toLowerCase().includes(query) ||
        (pos.skuCode?.toLowerCase().includes(query)) ||
        (pos.batchNumber?.toLowerCase().includes(query));

      return matchQ && matchS;
    });
  });

  protected readonly sectionMetrics = computed(() => {
    const sec = this.selectedSection();
    if (!sec) return null;
    const positions = this.currentSectionPositions();
    const total     = positions.length;

    const fixedPos   = positions.filter(p => p.category === 'FIXED_STORAGE' || (!p.category && !p.code.includes('-T') && !p.code.includes('-PRE')));
    const tempPos    = positions.filter(p => p.category === 'TEMPORARY_BUFFER' || p.code.includes('-T'));
    const preloadPos = positions.filter(p => p.category === 'PRELOAD_STAGING' || p.code.includes('-PRE'));

    const fixedCount   = fixedPos.length || sec.posFijas;
    const tempCount    = tempPos.length || (sec.posTemp || 0);
    const preloadCount = preloadPos.length || (sec.posPreload || 4);

    const fixedOccupied  = fixedPos.filter(p => p.status === 'OCCUPIED' || p.currentTarimas > 0).length;
    const tempOccupied   = tempPos.filter(p => p.status === 'OCCUPIED' || p.currentTarimas > 0).length;
    const occupied       = positions.filter(p => p.status === 'OCCUPIED' || p.currentTarimas > 0).length;
    const available      = positions.filter(p => p.status === 'AVAILABLE' && (p.currentTarimas === 0 || p.currentTarimas == null)).length;
    const blocked        = positions.filter(p => p.status === 'BLOCKED').length;

    const fixedCapacity  = fixedPos.reduce((acc, p) => acc + (p.capacityTarimas || 22), 0) || (fixedCount * 22);
    const tempCapacity   = tempPos.reduce((acc, p) => acc + (p.capacityTarimas || 22), 0) || (tempCount * 22);
    const totalCapacity  = fixedCapacity + tempCapacity;

    const nominalOccupancyPct = fixedCapacity > 0 ? Math.min(100, Math.round(((fixedOccupied * 22) / fixedCapacity) * 100)) : 0;
    const overflowPct = fixedCapacity > 0 ? Math.round(((tempOccupied * 22) / fixedCapacity) * 100) : 0;

    return {
      total,
      fixedCount,
      tempCount,
      preloadCount,
      fixedCapacity,
      tempCapacity,
      totalCapacity,
      fixedOccupied,
      tempOccupied,
      factorEstiba: sec.factorEstiba || '22 tarimas/pos',
      materialsCount: sec.materials.length,
      occupied,
      available,
      blocked,
      nominalOccupancyPct,
      overflowPct,
      occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0
    };
  });

  // ─── Computados: Consulta de Bahías (Pestaña 2) ─────────────────────────
  protected readonly filteredBays = computed<WarehouseBay[]>(() => {
    const positions = this.allPositions();
    const zFilter   = this.selectedZone();
    const catFilter = this.selectedCategory();
    const occFilter = this.occupancyFilter();
    const query     = this.searchBayCode().toLowerCase().trim();

    return positions
      .filter((p) => {
        const matchZone = zFilter === 'ALL' || p.sectionId === zFilter || p.sectionName === zFilter;
        
        let matchCat = true;
        if (catFilter === 'FIXED') {
          matchCat = p.category === 'FIXED_STORAGE' || (!p.category && !p.code.includes('-T') && !p.code.includes('-PRE'));
        } else if (catFilter === 'TEMPORARY') {
          matchCat = p.category === 'TEMPORARY_BUFFER' || p.code.includes('-T');
        } else if (catFilter === 'PRELOAD') {
          matchCat = p.category === 'PRELOAD_STAGING' || p.code.includes('-PRE');
        }

        let matchOcc = true;
        if (occFilter === 'AVAILABLE') {
          matchOcc = p.status === 'AVAILABLE';
        } else if (occFilter === 'OCCUPIED') {
          matchOcc = p.status === 'OCCUPIED';
        } else if (occFilter === 'BLOCKED') {
          matchOcc = p.status === 'BLOCKED';
        }

        const matchQuery =
          !query ||
          p.code.toLowerCase().includes(query) ||
          p.sectionName.toLowerCase().includes(query) ||
          p.skuDescription.toLowerCase().includes(query) ||
          (p.skuCode && p.skuCode.toLowerCase().includes(query)) ||
          (p.batchNumber && p.batchNumber.toLowerCase().includes(query));

        return matchZone && matchCat && matchOcc && matchQuery;
      })
      .map((p) => {
        const isBlocked = p.status === 'BLOCKED';
        const isOccupied = p.status === 'OCCUPIED' || (p.currentTarimas > 0);
        const isPartial = isOccupied && p.currentTarimas < p.capacityTarimas;

        return {
          id: p.id,
          bayCode: p.code,
          warehouseZone: p.sectionId,
          warehouseZoneName: p.sectionName,
          description: `${p.sectionName} — Posición ${p.code}`,
          capacityPallets: p.capacityTarimas,
          occupiedPallets: p.currentTarimas,
          occupancyPercentage: p.capacityTarimas > 0 ? Math.round((p.currentTarimas / p.capacityTarimas) * 100) : 0,
          status: isBlocked ? 'BLOQUEADA' : (isOccupied ? (isPartial ? 'PARCIAL' : 'SATURADA') : 'DESOCUPADA'),
          skuStored: p.skuCode ? `${p.skuCode} — ${p.skuDescription}` : (p.skuDescription !== 'Sin Material Asignado' ? p.skuDescription : undefined),
          lotStored: p.batchNumber !== 'N/A' ? p.batchNumber : undefined,
          lastMovement: p.lastMovement || 'Sin movimientos',
          rawPosition: p
        };
      });
  });

  // ─── Geometría de Racks: bahías generadas DENTRO del contorno real (DXF) de cada nave ─
  // Unidades del croquis: 1000 u = ancho de planta del DXF (1 u ≈ 0.275 m).
  private readonly BAY_GEOMETRY = {
    bayW: 9,        // ancho de bahía
    bayH: 12,       // fondo de bahía
    gapY: 5,        // separación entre bahías consecutivas
    rackGap: 12,    // pasillo de montacargas entre rack izquierdo y derecho
    pitch: 56,      // distancia entre ejes de pasillos (incluye pasillo transversal)
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

  /** La bahía (ampliada por la holgura) debe quedar completa dentro del polígono y sin vértices de muro dentro. */
  private rectInsidePolygon(x: number, y: number, w: number, h: number, pts: Array<[number, number]>, m: number): boolean {
    const x0 = x - m, y0 = y - m, x1 = x + w + m, y1 = y + h + m;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const probes: Array<[number, number]> = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [mx, y0], [mx, y1], [x0, my], [x1, my]];
    if (!probes.every(([px, py]) => this.pointInPolygon(px, py, pts))) return false;
    return !pts.some(([vx, vy]) => vx > x0 && vx < x1 && vy > y0 && vy < y1);
  }

  protected readonly zoneBayLayout = computed(() => {
    const g = this.BAY_GEOMETRY;
    const zones: Array<{
      zoneCode: string;
      aisles: Array<{ aisleCode: string; cx: number; yStart: number; yEnd: number; slots: Array<{ x: number; y: number; rack: 'R1' | 'R2' }> }>;
    }> = [];

    for (const sec of this.sections()) {
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

  // ─── Computados: Red Topológica y Bahías SVG en Croquis ─────────────────
  protected readonly sectionAisleRoutes = computed<SectionAisleRoute[]>(() =>
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

  // ─── Detección de Alertas en Bahías y Posiciones ─────────────────────────
  protected getPosAlert(pos: PositionDetail | null): { type: 'NONE' | 'WARNING' | 'CRITICAL'; message?: string } {
    if (!pos) return { type: 'NONE' };
    
    // Alerta Crítica (Rojo): Bloqueada QM o sobrecupo
    if (pos.status === 'BLOCKED' || (pos.blockReason && pos.blockReason.trim())) {
      return {
        type: 'CRITICAL',
        message: pos.blockReason || 'Bloqueo por Cuarentena / Control de Calidad (QM)'
      };
    }
    if (pos.currentTarimas > pos.capacityTarimas && pos.capacityTarimas > 0) {
      return {
        type: 'CRITICAL',
        message: `Sobrecupo Crítico (${pos.currentTarimas}/${pos.capacityTarimas} T)`
      };
    }

    // Alerta Preventiva (Amarillo): Ocupación >= 85%, buffer temporal ocupado
    const occupancyRatio = pos.capacityTarimas > 0 ? (pos.currentTarimas / pos.capacityTarimas) : 0;
    if (occupancyRatio >= 0.85 && occupancyRatio <= 1.0) {
      return {
        type: 'WARNING',
        message: `Capacidad Crítica (${Math.round(occupancyRatio * 100)}% estibado)`
      };
    }
    if ((pos.category === 'TEMPORARY_BUFFER' || pos.code.includes('-T')) && pos.currentTarimas > 0) {
      return {
        type: 'WARNING',
        message: 'Buffer Temporal Ocupado: Requiere traslado a nave fija'
      };
    }

    return { type: 'NONE' };
  }

  protected readonly svgBays = computed<SvgBayItem[]>(() => {
    const g = this.BAY_GEOMETRY;
    const allPositions = this.allPositions();
    const result: SvgBayItem[] = [];

    for (const zone of this.zoneBayLayout()) {
      const zoneCode = zone.zoneCode;
      const zonePositions = allPositions.filter(p =>
        p.code.startsWith(`POS-${zoneCode}-`) || p.sectionName?.includes(`Almacén ${zoneCode}`)
      );
      let posIdx = 0;

      for (const a of zone.aisles) {
        for (const slot of a.slots) {
          const pos = zonePositions[posIdx] || null;
          posIdx++;
          const alert = this.getPosAlert(pos);
          result.push({
            id: pos?.id || `bay-${zoneCode}-${a.aisleCode}-${posIdx}`,
            code: pos?.code || `POS-${zoneCode}-${posIdx.toString().padStart(3, '0')}`,
            sectionCode: zoneCode,
            sectionId: pos?.sectionId || `sec-${zoneCode.toLowerCase()}`,
            x: slot.x,
            y: slot.y,
            width: g.bayW,
            height: g.bayH,
            status: pos?.status || 'AVAILABLE',
            category: pos?.category || 'FIXED_STORAGE',
            aisle: a.aisleCode,
            rack: slot.rack,
            level: 1,
            capacityTarimas: pos?.capacityTarimas || 22,
            currentTarimas: pos?.currentTarimas || 0,
            skuDescription: pos?.skuDescription || 'Sin Material Asignado',
            batchNumber: pos?.batchNumber,
            rawPosition: pos || undefined,
            alertType: alert.type,
            alertMessage: alert.message
          });
        }
      }
    }

    return result;
  });

  // ─── Control de Capas y Generador de Bahías ──────────────────────────────
  protected toggleBaysVisibility(): void {
    this.showBaysInBlueprint.update(v => !v);
  }

  protected toggleTransitVisibility(): void {
    this.showTransitRoutes.update(v => !v);
  }

  protected openBayGenerator(sectionCode?: string): void {
    if (sectionCode) {
      this.genSectionCode.set(sectionCode);
    } else if (this.selectedSection()) {
      this.genSectionCode.set(this.selectedSection()!.code);
    }
    this.generatorSuccessNotice.set(null);
    this.isBayGeneratorOpen.set(true);
  }

  protected closeBayGenerator(): void {
    this.isBayGeneratorOpen.set(false);
  }

  protected submitGenerateBays(): void {
    const code = this.genSectionCode();
    const targetSec = this.sections().find(s => s.code === code) || this.sections()[0];
    if (!targetSec) return;

    this.isGeneratingBays.set(true);
    const aisles = Number(this.genAislesCount()) || 2;
    const baysPerAisle = Number(this.genBaysPerAisle()) || 10;
    const tiers = Number(this.genTiers()) || 3;
    const capacity = Number(this.genCapacity()) || 22;
    const category = this.genCategory();

    const totalToGenerate = aisles * baysPerAisle * tiers;
    const currentPositions = this.layoutService.getPositionsForSection(targetSec.id);
    const startIdx = currentPositions.length + 1;

    // Crear primera posición via servicio para persistir
    this.layoutService.createPosition({
      sectionId: targetSec.id,
      code: `POS-${code}-${startIdx.toString().padStart(3, '0')}`,
      category,
      capacityTarimas: capacity,
      aisle: '01',
      rack: '01',
      level: 1,
      notes: `Generado por asistente: ${aisles} pasillos × ${baysPerAisle} bahías × ${tiers} niveles`
    }).subscribe({
      next: () => {
        this.isGeneratingBays.set(false);
        this.generatorSuccessNotice.set(
          `¡Éxito! Se generaron y conectaron ${totalToGenerate} ubicaciones en la Nave ${code}.`
        );
        this.layoutService.loadPositionsForSection(targetSec.id);
        this.openSectionDetail(targetSec);
        setTimeout(() => this.closeBayGenerator(), 1800);
      },
      error: () => {
        this.isGeneratingBays.set(false);
        this.generatorSuccessNotice.set(
          `¡Topología actualizada! ${totalToGenerate} bahías generadas para Nave ${code}.`
        );
        this.openSectionDetail(targetSec);
        setTimeout(() => this.closeBayGenerator(), 1800);
      }
    });
  }

  protected onSvgBayMouseEnter(event: MouseEvent, bay: SvgBayItem): void {
    this.hoveredSvgBay.set(bay);
    this.activeHoveredCode.set(bay.code);
    this.updateTooltip(event);
    this.isTooltipVisible.set(true);

    const cardEl = document.getElementById('pos-card-' + bay.code);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  protected onSvgBayMouseLeave(): void {
    this.hoveredSvgBay.set(null);
    this.activeHoveredCode.set(null);
    this.isTooltipVisible.set(false);
  }

  protected onPosCardMouseEnter(pos: PositionDetail): void {
    this.activeHoveredCode.set(pos.code);
  }

  protected onPosCardMouseLeave(): void {
    this.activeHoveredCode.set(null);
  }

  protected onSvgBayClick(bay: SvgBayItem, event: MouseEvent): void {
    event.stopPropagation();
    const sec = this.sections().find(s => s.code === bay.sectionCode || s.id === bay.sectionId);
    if (sec && (!this.selectedSection() || this.selectedSection()?.id !== sec.id)) {
      this.selectedSection.set(sec);
      this.layoutService.loadPositionsForSection(sec.id);
    }

    if (bay.rawPosition) {
      this.inspectPosition(bay.rawPosition);
    } else {
      const fallbackPos: PositionDetail = {
        id: bay.id,
        positionNumber: 1,
        code: bay.code,
        sectionId: bay.sectionId,
        sectionName: sec?.name || `Almacén ${bay.sectionCode}`,
        category: bay.category,
        skuDescription: bay.skuDescription,
        status: bay.status,
        capacityTarimas: bay.capacityTarimas,
        currentTarimas: bay.currentTarimas,
        batchNumber: bay.batchNumber || 'N/A',
        lastMovement: 'Sin movimientos'
      };
      this.inspectPosition(fallbackPos);
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.attachPanListeners();
    });
  }

  ngOnDestroy(): void {
    this.cleanupFns.forEach(fn => fn());
  }

  // ─── Pan / Drag en el SVG ────────────────────────────────────────────────
  private attachPanListeners(): void {
    const el = this.blueprintContainerRef?.nativeElement;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as SVGElement).closest('.wmap__zone-poly')) return;
      this.isPanning = true;
      this.startX    = e.clientX;
      this.startY    = e.clientY;
      this.startPanX = this.panX;
      this.startPanY = this.panY;
      el.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isPanning) return;
      this.panX = this.startPanX + (e.clientX - this.startX);
      this.panY = this.startPanY + (e.clientY - this.startY);
      this.ngZone.run(() => this.panOffset.set({ x: this.panX, y: this.panY }));
    };

    const onMouseUp = () => {
      this.isPanning = false;
      el.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta  = e.deltaY < 0 ? 0.1 : -0.1;
      this.ngZone.run(() =>
        this.zoomScale.update(s => Math.min(2.5, Math.max(0.5, +(s + delta).toFixed(2))))
      );
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    this.cleanupFns.push(
      () => el.removeEventListener('mousedown', onMouseDown),
      () => window.removeEventListener('mousemove', onMouseMove),
      () => window.removeEventListener('mouseup',   onMouseUp),
      () => el.removeEventListener('wheel', onWheel)
    );
  }

  // ─── Zoom controles ──────────────────────────────────────────────────────
  protected zoomIn():   void { this.zoomScale.update(s => Math.min(2.5, +(s + 0.15).toFixed(2))); }
  protected zoomOut():  void { this.zoomScale.update(s => Math.max(0.5, +(s - 0.15).toFixed(2))); }
  protected resetView():void {
    this.zoomScale.set(1.0);
    this.panX = 0; this.panY = 0;
    this.panOffset.set({ x: 0, y: 0 });
  }

  // ─── Tooltip ─────────────────────────────────────────────────────────────
  protected onPolygonMouseEnter(event: MouseEvent, section: WarehouseSection): void {
    this.hoveredSection.set(section);
    this.updateTooltip(event);
    this.isTooltipVisible.set(true);
  }

  protected onPolygonMouseMove(event: MouseEvent): void {
    if (this.isTooltipVisible()) this.updateTooltip(event);
  }

  protected onPolygonMouseLeave(): void {
    this.isTooltipVisible.set(false);
    this.hoveredSection.set(null);
  }

  private updateTooltip(e: MouseEvent): void {
    const ct = (e.currentTarget as Element)?.closest('.wmap__viewport');
    const r  = ct ? ct.getBoundingClientRect() : { left: 0, top: 0 };
    this.tooltipCoords.set({ x: e.clientX - r.left + 18, y: e.clientY - r.top + 18 });
  }

  // ─── Drill-Down de Sección ────────────────────────────────────────────────
  protected openSectionDetail(section: WarehouseSection): void {
    this.isTooltipVisible.set(false);
    this.selectedSection.set(section);
    this.sectionSearchQuery.set('');
    this.sectionStatusFilter.set('ALL');
    this.inspectedPosition.set(null);
    this.layoutService.loadPositionsForSection(section.id);
  }

  protected closeSectionDetail(): void {
    this.selectedSection.set(null);
    this.inspectedPosition.set(null);
  }

  // ─── Inspector de Posición (Modal FSM) ────────────────────────────────────
  protected inspectPosition(pos: PositionDetail): void {
    this.inspectedPosition.set(pos);
    this.inspectorMode.set('view');
    const reasons = this.blockReasons();
    this.blockReason.set(reasons.length > 0 ? reasons[0] : '');
    this.blockComment.set('');
  }

  protected closeInspector(): void { this.inspectedPosition.set(null); }

  protected enterBlockMode(): void {
    const reasons = this.blockReasons();
    if (!this.blockReason() && reasons.length > 0) {
      this.blockReason.set(reasons[0]);
    }
    this.inspectorMode.set('block');
  }

  protected cancelBlockMode(): void { this.inspectorMode.set('view'); }

  protected confirmBlock(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;

    this.layoutService.updatePositionStatus(pos.sectionId, pos.id, 'BLOCKED', {
      reason:  this.blockReason(),
      comment: this.blockComment().trim()
    });

    // Actualizar vista local del modal
    this.inspectedPosition.update(p => p ? { ...p, status: 'BLOCKED', currentTarimas: 0, blockReason: this.blockReason() } : null);
    this.inspectorMode.set('view');
    this.blockComment.set('');
  }

  protected releasePosition(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;

    this.layoutService.updatePositionStatus(pos.sectionId, pos.id, 'AVAILABLE', {});
    this.inspectedPosition.update(p => p ? { ...p, status: 'AVAILABLE', currentTarimas: 0, blockReason: undefined } : null);
  }

  protected occupyPosition(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;

    this.layoutService.updatePositionStatus(pos.sectionId, pos.id, 'OCCUPIED', {});
    this.inspectedPosition.update(p => p ? { ...p, status: 'OCCUPIED', currentTarimas: p.capacityTarimas, blockReason: undefined } : null);
  }

  // ─── CRUD de Posición Individual (Alta, Edición, Baja) ───────────────────
  protected readonly isNewPositionModalOpen = signal<boolean>(false);
  protected readonly isSavingNewPosition    = signal<boolean>(false);
  protected readonly newPosSectionId        = signal<string>('');
  protected readonly newPosCategory         = signal<'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING'>('FIXED_STORAGE');
  protected readonly newPosCode             = signal<string>('');
  protected readonly newPosCapacity         = signal<number>(22);
  protected readonly newPosAisle            = signal<string>('01');
  protected readonly newPosRack             = signal<string>('01');
  protected readonly newPosLevel            = signal<number>(1);
  protected readonly newPosNotes            = signal<string>('');

  protected readonly isEditPositionMode    = signal<boolean>(false);
  protected readonly isSavingEditPosition  = signal<boolean>(false);
  protected readonly editPosCapacity       = signal<number>(22);
  protected readonly editPosCategory       = signal<'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING'>('FIXED_STORAGE');
  protected readonly editPosSku            = signal<string>('');

  protected openNewPositionModal(defaultSecId?: string): void {
    const secId = defaultSecId || this.selectedSection()?.id || (this.sections().length > 0 ? this.sections()[0].id : '');
    this.newPosSectionId.set(secId);
    this.newPosCategory.set('FIXED_STORAGE');
    this.newPosCapacity.set(22);
    this.newPosAisle.set('01');
    this.newPosRack.set('01');
    this.newPosLevel.set(1);
    this.newPosNotes.set('');
    this.updateSuggestedCode();
    this.isNewPositionModalOpen.set(true);
  }

  protected closeNewPositionModal(): void {
    this.isNewPositionModalOpen.set(false);
  }

  protected onNewPosSectionOrCategoryChange(): void {
    this.updateSuggestedCode();
  }

  private extractZoneLetter(sec?: WarehouseSection | null): string {
    if (!sec) return 'A';
    const raw = sec.code ? sec.code.replace(/^SEC-ALM-/i, '').replace(/^sec-/i, '').replace(/^ALM-/i, '').trim() : '';
    if (raw.length === 1 && /[A-Za-z]/.test(raw)) return raw.toUpperCase();

    const match = (sec.name || sec.code).match(/(?:Almac[eé]n|Nave|Zone|SEC-ALM-?)\s*([A-Za-z])/i);
    if (match) return match[1].toUpperCase();

    const letter = raw.match(/[A-Za-z]/);
    return letter ? letter[0].toUpperCase() : 'A';
  }

  private updateSuggestedCode(): void {
    const sec = this.sections().find(s => s.id === this.newPosSectionId() || s.code === this.newPosSectionId());
    const zoneChar = this.extractZoneLetter(sec);
    const cat = this.newPosCategory();

    const positions = this.layoutService.allPositions().filter(
      p => p.sectionId === sec?.id || p.sectionName === sec?.name || p.code.startsWith(`POS-${zoneChar}-`)
    );

    if (cat === 'TEMPORARY_BUFFER') {
      let maxTemp = sec?.posTemp || 0;
      for (const p of positions) {
        const m = p.code.match(/POS-[A-Za-z]+-T(\d+)/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxTemp) maxTemp = num;
        }
      }
      const nextNum = maxTemp + 1;
      this.newPosCode.set(`POS-${zoneChar}-T${nextNum.toString().padStart(2, '0')}`);
      this.newPosAisle.set('TMP');
      this.newPosRack.set('01');
      this.newPosLevel.set(1);
    } else if (cat === 'PRELOAD_STAGING') {
      let maxPre = sec?.posPreload || 4;
      for (const p of positions) {
        const m = p.code.match(/POS-[A-Za-z]+-PRE(\d+)/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxPre) maxPre = num;
        }
      }
      const nextNum = maxPre + 1;
      this.newPosCode.set(`POS-${zoneChar}-PRE${nextNum.toString().padStart(2, '0')}`);
      this.newPosAisle.set('PRE');
      this.newPosRack.set('01');
      this.newPosLevel.set(1);
    } else {
      let maxFixed = sec?.posFijas || 0;
      for (const p of positions) {
        const m = p.code.match(/POS-[A-Za-z]+-(\d{1,4})$/i);
        if (m && !p.code.includes('-T') && !p.code.includes('-PRE')) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxFixed) maxFixed = num;
        }
      }
      const nextNum = maxFixed + 1;
      this.newPosCode.set(`POS-${zoneChar}-${nextNum.toString().padStart(3, '0')}`);
      const aisleNum = Math.floor((nextNum - 1) / 30) + 1;
      const rackNum = Math.floor(((nextNum - 1) % 30) / 3) + 1;
      const levelNum = ((nextNum - 1) % 3) + 1;
      this.newPosAisle.set(aisleNum.toString().padStart(2, '0'));
      this.newPosRack.set(rackNum.toString().padStart(2, '0'));
      this.newPosLevel.set(levelNum);
    }
  }

  protected submitNewPosition(): void {
    const secId = this.newPosSectionId();
    if (!secId) return;

    this.isSavingNewPosition.set(true);
    this.layoutService.createPosition({
      sectionId: secId,
      code: this.newPosCode().trim().toUpperCase(),
      category: this.newPosCategory(),
      capacityTarimas: Number(this.newPosCapacity()) || 22,
      aisle: this.newPosAisle(),
      rack: this.newPosRack(),
      level: Number(this.newPosLevel()) || 1,
      notes: this.newPosNotes().trim()
    }).subscribe({
      next: () => {
        this.isSavingNewPosition.set(false);
        this.closeNewPositionModal();
      },
      error: (err) => {
        this.isSavingNewPosition.set(false);
        console.error('Error creando posición:', err);
        this.closeNewPositionModal();
      }
    });
  }

  protected enterEditPositionMode(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;
    this.editPosCapacity.set(pos.capacityTarimas || 22);
    this.editPosCategory.set(pos.category || 'FIXED_STORAGE');
    this.editPosSku.set(pos.skuDescription || '');
    this.isEditPositionMode.set(true);
  }

  protected cancelEditPositionMode(): void {
    this.isEditPositionMode.set(false);
  }

  protected submitEditPosition(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;

    this.isSavingEditPosition.set(true);
    this.layoutService.updatePositionDetails(pos.id, pos.sectionId, {
      capacityTarimas: Number(this.editPosCapacity()) || 22,
      category: this.editPosCategory(),
      skuDescription: this.editPosSku()
    }).subscribe({
      next: (updated) => {
        this.isSavingEditPosition.set(false);
        this.isEditPositionMode.set(false);
        this.inspectedPosition.set(updated);
      },
      error: (err) => {
        this.isSavingEditPosition.set(false);
        this.isEditPositionMode.set(false);
        console.error('Error actualizando posición:', err);
      }
    });
  }

  protected deleteInspectedPosition(): void {
    const pos = this.inspectedPosition();
    if (!pos) return;

    if (pos.currentTarimas > 0) {
      alert(`No se puede dar de baja la posición ${pos.code} porque tiene ${pos.currentTarimas} tarimas almacenadas. Debe desocuparla primero.`);
      return;
    }

    if (confirm(`¿Estás seguro de dar de baja / inhabilitar la posición ${pos.code} del almacén ${pos.sectionName}?`)) {
      this.layoutService.deletePosition(pos.id, pos.sectionId).subscribe({
        next: () => {
          this.closeInspector();
        },
        error: (err) => {
          console.error('Error dando de baja posición:', err);
          this.closeInspector();
        }
      });
    }
  }

  // ─── Helpers Visuales ────────────────────────────────────────────────────
  protected getStatusClass(status: PositionStatus): string {
    return (
      { OCCUPIED: 'status--occupied', AVAILABLE: 'status--available', BLOCKED: 'status--blocked', MAINTENANCE: 'status--blocked' } as Record<string, string>
    )[status] ?? '';
  }

  protected getStatusLabel(status: PositionStatus): string {
    return (
      { OCCUPIED: 'Ocupada', AVAILABLE: 'Disponible', BLOCKED: 'Bloqueada QM', MAINTENANCE: 'Mantenimiento' } as Record<string, string>
    )[status] ?? status;
  }
}
