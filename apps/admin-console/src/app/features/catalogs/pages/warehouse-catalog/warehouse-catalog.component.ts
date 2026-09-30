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

  // ─── Sub-Pestañas ────────────────────────────────────────────────────────
  protected readonly activeTab = signal<WarehouseSubTab>('topology');

  // ─── Datos Reactivos del Backend ─────────────────────────────────────────
  protected readonly sections   = this.layoutService.sections;
  protected readonly stats      = this.layoutService.stats;
  protected readonly blockReasons = this.layoutService.blockReasons;
  protected readonly allPositions = this.layoutService.allPositions;
  protected readonly isLoadingAllPositions = this.layoutService.isLoadingAllPositions;
  protected readonly isLoadingTopology = this.layoutService.isLoadingTopology;

  // ─── Filtros de Pestaña 2: Consulta de Bahías ────────────────────────────
  protected readonly selectedZone    = signal<string>('ALL');
  protected readonly occupancyFilter = signal<string>('ALL');
  protected readonly searchBayCode   = signal<string>('');

  // ─── Estado de Pestaña 1: Mapa Interactivo SVG ───────────────────────────
  protected readonly selectedSection  = signal<WarehouseSection | null>(null);
  protected readonly hoveredSection   = signal<WarehouseSection | null>(null);
  protected readonly tooltipCoords    = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  protected readonly isTooltipVisible = signal<boolean>(false);

  protected readonly sectionSearchQuery  = signal<string>('');
  protected readonly sectionStatusFilter = signal<'ALL' | 'OCCUPIED' | 'AVAILABLE' | 'BLOCKED'>('ALL');
  protected readonly isDetailPanelOpen   = computed(() => this.selectedSection() !== null);

  // ─── Zoom & Pan (Blueprint SVG) ──────────────────────────────────────────
  protected readonly zoomScale = signal<number>(1.0);
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
    const list   = this.currentSectionPositions();
    const query  = this.sectionSearchQuery().trim().toLowerCase();
    const filter = this.sectionStatusFilter();

    return list.filter((pos) => {
      const matchQ = !query ||
        pos.code.toLowerCase().includes(query) ||
        pos.skuDescription.toLowerCase().includes(query) ||
        (pos.skuCode?.toLowerCase().includes(query)) ||
        (pos.batchNumber?.toLowerCase().includes(query));
      const matchS = filter === 'ALL' || pos.status === filter;
      return matchQ && matchS;
    });
  });

  protected readonly sectionMetrics = computed(() => {
    const sec = this.selectedSection();
    if (!sec) return null;
    const positions = this.currentSectionPositions();
    const total     = positions.length;
    const occupied  = positions.filter(p => p.status === 'OCCUPIED').length;
    const available = positions.filter(p => p.status === 'AVAILABLE').length;
    const blocked   = positions.filter(p => p.status === 'BLOCKED').length;
    const totalCapacity = sec.capacidadTarimas > 0
      ? sec.capacidadTarimas
      : positions.reduce((acc, p) => acc + (p.capacityTarimas || 22), 0);

    return {
      total,
      capacityTarimas: totalCapacity,
      factorEstiba: sec.factorEstiba,
      materialsCount: sec.materials.length,
      occupied,
      available,
      blocked,
      occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0
    };
  });

  // ─── Computados: Consulta de Bahías (Pestaña 2) ─────────────────────────
  protected readonly filteredBays = computed<WarehouseBay[]>(() => {
    const positions = this.allPositions();
    const zFilter   = this.selectedZone();
    const occFilter = this.occupancyFilter();
    const query     = this.searchBayCode().toLowerCase().trim();

    return positions
      .filter((p) => {
        const matchZone = zFilter === 'ALL' || p.sectionId === zFilter || p.sectionName === zFilter;
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

        return matchZone && matchOcc && matchQuery;
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
