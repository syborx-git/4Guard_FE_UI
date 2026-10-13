import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseMovementsApiService } from '../../../features/warehouse-movements/services/warehouse-movements-api.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { BayRemisionSummary } from '../../../features/warehouse-movements/models/warehouse-movements.models';
import { WarehouseLayoutService } from '../../../features/catalogs/services/warehouse-layout.service';
import { PositionDetail } from '../../../features/catalogs/models/warehouse-catalog.models';

export type BayCategory = 'FIXED_STORAGE' | 'TEMPORARY_BUFFER' | 'PRELOAD_STAGING';

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

export interface WarehouseMapSectionDef {
  code: string;
  name: string;
  category: string;
  polygonPoints: string;
  labelX: number;
  labelY: number;
  sublabelX: number;
  sublabelY: number;
}

export const WAREHOUSE_MAP_SECTIONS: WarehouseMapSectionDef[] = [
  { code: 'A', name: 'Almacén A — Materia Prima & Secos', category: 'Materia Prima / PT', polygonPoints: '265,125 588,125 588,365 265,365', labelX: 426, labelY: 235, sublabelX: 426, sublabelY: 260 },
  { code: 'B', name: 'Almacén B — Almacenamiento General', category: 'Almacenamiento General', polygonPoints: '265,670 420,670 420,840 265,840', labelX: 342, labelY: 745, sublabelX: 342, sublabelY: 765 },
  { code: 'C', name: 'Almacén C — Alta Rotación', category: 'Alta Rotación', polygonPoints: '430,670 588,670 588,840 430,840', labelX: 509, labelY: 745, sublabelX: 509, sublabelY: 765 },
  { code: 'D', name: 'Almacén D — Insumos & Empaque', category: 'Insumos / Packaging', polygonPoints: '602,125 783,125 783,245 602,245', labelX: 692, labelY: 180, sublabelX: 692, sublabelY: 200 },
  { code: 'E', name: 'Almacén E — Material No Conforme', category: 'Material No Conforme', polygonPoints: '602,255 783,255 783,365 602,365', labelX: 692, labelY: 305, sublabelX: 692, sublabelY: 325 },
  { code: 'F', name: 'Almacén F — Tránsito & Reempaque', category: 'Tránsito / Reempaque', polygonPoints: '797,125 890,125 890,365 797,365', labelX: 843, labelY: 235, sublabelX: 843, sublabelY: 260 },
  { code: 'G', name: 'Almacén G — Picking & Despacho', category: 'Picking / Despacho', polygonPoints: '897,125 973,125 973,365 897,365', labelX: 935, labelY: 235, sublabelX: 935, sublabelY: 260 },
  { code: 'H', name: 'Almacén H — Devoluciones & Scrap', category: 'Devoluciones / Scrap', polygonPoints: '797,670 973,670 973,840 797,840', labelX: 885, labelY: 745, sublabelX: 885, sublabelY: 765 },
  { code: 'I', name: 'Almacén I — Cross-Docking Rápido', category: 'Cross-Docking', polygonPoints: '265,375 588,375 588,660 265,660', labelX: 426, labelY: 505, sublabelX: 426, sublabelY: 530 },
  { code: 'J', name: 'Almacén J — Cuarentena Calidad', category: 'Cuarentena / Calidad', polygonPoints: '897,375 973,375 973,660 897,660', labelX: 935, labelY: 505, sublabelX: 935, sublabelY: 530 },
  { code: 'K', name: 'Almacén K — Carga Pesada & Tarimas', category: 'Carga Pesada', polygonPoints: '797,375 890,375 890,660 797,660', labelX: 843, labelY: 505, sublabelX: 843, sublabelY: 530 },
  { code: 'L', name: 'Almacén L — Carga Masiva & Salidas', category: 'Carga Masiva', polygonPoints: '602,375 783,375 783,660 602,660', labelX: 692, labelY: 505, sublabelX: 692, sublabelY: 530 },
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
})
export class BayOccupancySelectorComponent implements OnInit {
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
  readonly mapSections = WAREHOUSE_MAP_SECTIONS;
  hoveredMapZone = signal<WarehouseMapSectionDef | null>(null);

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
      const m = g.code.match(/([A-L])/i);
      if (m && m[1]) zoneLetter = m[1].toUpperCase();
      const secDef = WAREHOUSE_MAP_SECTIONS.find(s => s.code === zoneLetter);

      return {
        id: g.id,
        code: zoneLetter,
        name: g.name,
        zone: g.zone,
        sectionName: g.sectionName,
        categoryLabel: secDef?.category || 'Almacenamiento',
        polygonPoints: secDef?.polygonPoints,
        labelX: secDef?.labelX,
        labelY: secDef?.labelY,
        sublabelX: secDef?.sublabelX,
        sublabelY: secDef?.sublabelY,
        
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
    const sec = this.mapSections.find((s) => s.code.toLowerCase() === code.toLowerCase());
    const grp = this.getZoneGroupForCode(code);
    if (!sec && !grp) return false;
    const matchCode = code.toLowerCase().includes(q) || `almacén ${code.toLowerCase()}`.includes(q) || `almacen ${code.toLowerCase()}`.includes(q);
    const matchName = sec?.name.toLowerCase().includes(q) || grp?.name.toLowerCase().includes(q);
    const matchCat = sec?.category.toLowerCase().includes(q) || grp?.categoryLabel?.toLowerCase().includes(q);
    const matchPos = grp?.positions.some((p) => p.code.toLowerCase().includes(q) || (p.name && p.name.toLowerCase().includes(q)));
    return !!(matchCode || matchName || matchCat || matchPos);
  }

  openZoneFromMap(sec: WarehouseMapSectionDef): void {
    const grp = this.getZoneGroupForCode(sec.code);
    if (grp) {
      this.openZone(grp);
    } else {
      this.selectedZoneId.set(`almacen-${sec.code.toLowerCase()}`);
    }
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
          this.bays.set(mapped);
          this.applyPreselection(mapped);
        } else {
          const fallback = this.generateEnterpriseTopology();
          this.bays.set(fallback);
          this.applyPreselection(fallback);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.warn('Error al consultar posiciones vía LayoutService, usando topología determinista:', err);
        const fallback = this.generateEnterpriseTopology();
        this.bays.set(fallback);
        this.applyPreselection(fallback);
        this.loading.set(false);
      },
    });
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
    if (!p.category) {
      if (p.code.includes('-T') || p.code.includes('TMP')) {
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
