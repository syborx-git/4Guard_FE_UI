/**
 * @file warehouse-map.component.ts
 * @description P5 — Mapa Interactivo 2D de Nave y Topología Física [HU-048 / HU-127].
 * 100% Integrado al Backend Spring Boot en tiempo real.
 */

import {
  Component, inject, signal, computed,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WarehouseLayoutService } from '../services/warehouse-layout.service';
import { WarehouseSection, PositionDetail, PositionStatus } from '../models/warehouse-layout.models';

type InspectorMode = 'view' | 'block';

@Component({
  selector: 'fg-warehouse-map',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './warehouse-map.component.html',
  styleUrl: './warehouse-map.component.css'
})
export class WarehouseMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('blueprintContainer') blueprintContainerRef!: ElementRef<HTMLDivElement>;

  protected readonly layoutService = inject(WarehouseLayoutService);
  private readonly ngZone = inject(NgZone);

  // ─── Estado Reactivo ─────────────────────────────────────────────────────
  protected readonly sections = this.layoutService.sections;
  protected readonly stats    = this.layoutService.stats;
  protected readonly blockReasons = this.layoutService.blockReasons;

  protected readonly selectedSection    = signal<WarehouseSection | null>(null);
  protected readonly hoveredSection     = signal<WarehouseSection | null>(null);
  protected readonly tooltipCoords      = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  protected readonly isTooltipVisible   = signal<boolean>(false);

  protected readonly searchQuery        = signal<string>('');
  protected readonly statusFilter       = signal<'ALL' | 'OCCUPIED' | 'AVAILABLE' | 'BLOCKED'>('ALL');

  protected readonly inspectedPosition  = signal<PositionDetail | null>(null);
  protected readonly inspectorMode      = signal<InspectorMode>('view');
  protected readonly blockReason        = signal<string>('');
  protected readonly blockComment       = signal<string>('');
  protected readonly isDetailPanelOpen  = computed(() => this.selectedSection() !== null);

  // ─── Zoom & Pan ──────────────────────────────────────────────────────────
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

  // ─── Computados ──────────────────────────────────────────────────────────
  protected readonly isPositionsLoading = computed(() => {
    const sec = this.selectedSection();
    return sec ? this.layoutService.isLoadingPositionsForSection(sec.id) : false;
  });

  protected readonly currentPositions = computed<PositionDetail[]>(() => {
    const sec = this.selectedSection();
    if (!sec || sec.status === 'PENDING') return [];
    return this.layoutService.getPositionsForSection(sec.id);
  });

  protected readonly filteredPositions = computed<PositionDetail[]>(() => {
    const list   = this.currentPositions();
    const query  = this.searchQuery().trim().toLowerCase();
    const filter = this.statusFilter();

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
    const positions = this.currentPositions();
    const total     = positions.length;
    const occupied  = positions.filter(p => p.status === 'OCCUPIED').length;
    const available = positions.filter(p => p.status === 'AVAILABLE').length;
    const blocked   = positions.filter(p => p.status === 'BLOCKED').length;
    return { total, capacityTarimas: sec.capacidadTarimas, factorEstiba: sec.factorEstiba,
             materialsCount: sec.materials.length, occupied, available, blocked,
             occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
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

  // ─── Pan / Drag ──────────────────────────────────────────────────────────
  private attachPanListeners(): void {
    const el = this.blueprintContainerRef?.nativeElement;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as SVGElement).closest('.wmap__zone-poly')) return; // clic en zona → drill-down
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

  // ─── Drill-Down ───────────────────────────────────────────────────────────
  protected openSectionDetail(section: WarehouseSection): void {
    this.isTooltipVisible.set(false);
    this.selectedSection.set(section);
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.inspectedPosition.set(null);
  }

  protected closeSectionDetail(): void {
    this.selectedSection.set(null);
    this.inspectedPosition.set(null);
  }

  // ─── Inspector de Posición ────────────────────────────────────────────────
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
    const sec = this.selectedSection();
    if (!pos || !sec) return;

    this.layoutService.updatePositionStatus(sec.id, pos.id, 'BLOCKED', {
      reason:  this.blockReason(),
      comment: this.blockComment().trim()
    });

    const updated = this.layoutService.getPositionsForSection(sec.id).find(p => p.id === pos.id);
    if (updated) this.inspectedPosition.set({ ...updated });
    this.inspectorMode.set('view');
    this.blockComment.set('');
  }

  protected releasePosition(): void {
    const pos = this.inspectedPosition();
    const sec = this.selectedSection();
    if (!pos || !sec) return;
    this.layoutService.updatePositionStatus(sec.id, pos.id, 'AVAILABLE', {});
    const updated = this.layoutService.getPositionsForSection(sec.id).find(p => p.id === pos.id);
    if (updated) this.inspectedPosition.set({ ...updated });
  }

  protected occupyPosition(): void {
    const pos = this.inspectedPosition();
    const sec = this.selectedSection();
    if (!pos || !sec) return;
    this.layoutService.updatePositionStatus(sec.id, pos.id, 'OCCUPIED', {});
    const updated = this.layoutService.getPositionsForSection(sec.id).find(p => p.id === pos.id);
    if (updated) this.inspectedPosition.set({ ...updated });
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
