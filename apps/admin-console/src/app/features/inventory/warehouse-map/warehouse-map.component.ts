/**
 * @file warehouse-map.component.ts
 * @description P5 — Inventario 2D (Topología Cromática) [HU-048].
 * Mapa interactivo de bahías dinámicas por Almacén Real (885 posiciones consolidado planta).
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../admin/services/location.service';
import { AuthState } from '../../../core/auth/auth.state';

export interface WarehouseDef {
  id: string;
  code: string;
  name: string;
  nominalCapacity: number;
}

export interface Bay {
  id: string;
  code: string;
  warehouseId: string;
  warehouseCode: string;
  type: 'RACK' | 'QUARANTINE_ZONE' | 'DOCK' | 'STAGING';
  row: number;
  col: number;
  capacity: number;
  occupied: number;
  isBlocked: boolean;
}

export interface SelectedBayInfo extends Bay {
  occupancyPct: number;
  colorClass: string;
}

export type FilterType = 'ALL' | 'RACK' | 'QUARANTINE_ZONE' | 'DOCK' | 'STAGING';
export type SaturationFilterType = 'ALL' | 'HIGH' | 'MID' | 'LOW' | 'BLOCKED';

@Component({
  selector: 'fg-warehouse-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-map.component.html',
  styleUrl: './warehouse-map.component.css',
})
export class WarehouseMapComponent {
  private readonly locationService = inject(LocationService);
  private readonly authState = inject(AuthState);

  // ── Almacenes Reales de la Planta (SSOT) ──────────────────────────────────
  protected readonly officialWarehouses: WarehouseDef[] = [
    { id: 'WH-A', code: 'A', name: 'Almacén A — Secos & PT', nominalCapacity: 170 },
    { id: 'WH-E', code: 'E', name: 'Almacén E — Materia Prima', nominalCapacity: 38 },
    { id: 'WH-F', code: 'F', name: 'Almacén F — Empaque & Vidrio', nominalCapacity: 120 },
    { id: 'WH-G', code: 'G', name: 'Almacén G — General Central', nominalCapacity: 117 },
    { id: 'WH-I', code: 'I', name: 'Almacén I — Insumos Especiales', nominalCapacity: 91 },
    { id: 'WH-J', code: 'J', name: 'Almacén J — Granel & Tambores', nominalCapacity: 56 },
    { id: 'WH-K', code: 'K', name: 'Almacén K — Racks Libres', nominalCapacity: 181 },
    { id: 'WH-L', code: 'L', name: 'Almacén L — Cuarentena & Retenidos', nominalCapacity: 112 },
  ];

  // Total Consolidado Planta: 170+38+120+117+91+56+181+112 = 885 pos
  protected readonly totalPlantCapacity = this.officialWarehouses.reduce(
    (sum, w) => sum + w.nominalCapacity,
    0
  );

  protected readonly selectedWarehouseId = signal<string>('ALL');
  protected readonly filterType = signal<FilterType>('ALL');
  protected readonly satFilter = signal<SaturationFilterType>('ALL');
  protected readonly selectedBay = signal<SelectedBayInfo | null>(null);
  protected readonly searchCode = signal<string>('');

  protected readonly activeBranchId = computed(() => {
    return (this.authState as any).activeBranchId?.() || 'SUC-001';
  });

  // Generador de bahías dinámicas por Almacén Real (885 posiciones totales)
  protected readonly plantBays = computed<Bay[]>(() => {
    const list: Bay[] = [];
    
    this.officialWarehouses.forEach((wh) => {
      const isQuarantineWh = wh.code === 'L';
      const type: Bay['type'] = isQuarantineWh ? 'QUARANTINE_ZONE' : 'RACK';

      for (let i = 1; i <= wh.nominalCapacity; i++) {
        const rackNum = Math.ceil(i / 20);
        const posNum = String((i - 1) % 20 + 1).padStart(2, '0');
        const code = `${wh.code}-${rackNum}-${posNum}`;
        const id = `LOC-${wh.code}-${i}`;
        const row = rackNum - 1;
        const col = (i - 1) % 20;

        // Distribución determinista de saturación acorde a la planta
        let occupied = 0;
        const capacity = 100;
        let isBlocked = false;

        const hash = (wh.code.charCodeAt(0) * 31 + i) % 100;

        if (hash < 12) {
          // 12% Bloqueados por QM
          isBlocked = true;
          occupied = 90;
        } else if (hash < 35) {
          // Alta saturación (>85%)
          occupied = 88 + (hash % 12);
        } else if (hash < 75) {
          // Saturación media (40-85%)
          occupied = 45 + (hash % 38);
        } else {
          // Baja saturación (<40%)
          occupied = 10 + (hash % 25);
        }

        list.push({
          id,
          code,
          warehouseId: wh.id,
          warehouseCode: wh.code,
          type,
          row,
          col,
          capacity,
          occupied,
          isBlocked,
        });
      }
    });

    return list;
  });

  // Consumo Reactivo de Muelles desde LocationService (SSOT Físico)
  protected readonly dockBays = computed<Bay[]>(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];

    const docks = this.locationService.getDocksForBranch(branchId);
    return docks.map((dock, index) => {
      let occupied = 0;
      if (dock.operationalStatus === 'OCCUPIED') occupied = 100;
      else if (dock.operationalStatus === 'RESERVED') occupied = 50;

      const isBlocked =
        dock.operationalStatus === 'MAINTENANCE' ||
        dock.operationalStatus === 'BLOCKED' ||
        dock.operationalStatus === 'OUT_OF_SERVICE';

      return {
        id: dock.id,
        code: dock.code,
        warehouseId: 'WH-DOCKS',
        warehouseCode: 'DOCK',
        type: 'DOCK',
        row: 99,
        col: index,
        capacity: 100,
        occupied,
        isBlocked,
      };
    });
  });

  // Combinación reactiva unificada de todas las bahías de la planta
  protected readonly allBays = computed<Bay[]>(() => {
    return [...this.plantBays(), ...this.dockBays()];
  });

  // Filtrado reactivo por Almacén seleccionado, Tipo, Nivel de Saturación y Búsqueda por Código
  protected readonly displayBays = computed(() => {
    const whId = this.selectedWarehouseId();
    const typeFilter = this.filterType();
    const satFilter = this.satFilter();
    const search = this.searchCode().trim().toLowerCase();

    return this.allBays().filter((bay) => {
      const matchWh = whId === 'ALL' || bay.warehouseId === whId;
      const matchType = typeFilter === 'ALL' || bay.type === typeFilter;
      const matchSearch = !search || bay.code.toLowerCase().includes(search);

      let matchSat = true;
      const pct = bay.capacity > 0 ? bay.occupied / bay.capacity : 0;

      if (satFilter === 'HIGH') {
        matchSat = !bay.isBlocked && pct > 0.85;
      } else if (satFilter === 'MID') {
        matchSat = !bay.isBlocked && pct >= 0.4 && pct <= 0.85;
      } else if (satFilter === 'LOW') {
        matchSat = !bay.isBlocked && pct < 0.4;
      } else if (satFilter === 'BLOCKED') {
        matchSat = bay.isBlocked;
      }

      return matchWh && matchType && matchSearch && matchSat;
    });
  });

  // Métricas dinámicas calculadas según el Almacén Activo
  protected readonly stats = computed(() => {
    const whId = this.selectedWarehouseId();
    const activeBays = this.allBays().filter(
      (b) => whId === 'ALL' || b.warehouseId === whId
    );

    const total = activeBays.length;
    const blocked = activeBays.filter((b) => b.isBlocked).length;
    const highOcc = activeBays.filter(
      (b) => !b.isBlocked && b.occupied / b.capacity > 0.85
    ).length;
    const medOcc = activeBays.filter(
      (b) =>
        !b.isBlocked &&
        b.occupied / b.capacity >= 0.4 &&
        b.occupied / b.capacity <= 0.85
    ).length;
    const lowOcc = activeBays.filter(
      (b) => !b.isBlocked && b.occupied / b.capacity < 0.4
    ).length;

    return { total, blocked, highOcc, medOcc, lowOcc };
  });

  protected selectWarehouse(whId: string): void {
    this.selectedWarehouseId.set(whId);
    this.selectedBay.set(null);
  }

  protected toggleSaturationFilter(filter: SaturationFilterType): void {
    if (this.satFilter() === filter) {
      this.satFilter.set('ALL');
    } else {
      this.satFilter.set(filter);
    }
  }

  protected occupancyPct(bay: Bay): number {
    if (bay.capacity === 0) return 0;
    return Math.round((bay.occupied / bay.capacity) * 100);
  }

  protected bayColorClass(bay: Bay): string {
    if (bay.isBlocked) return 'bay--blocked';
    const pct = this.occupancyPct(bay);
    if (pct > 85) return 'bay--high';
    if (pct >= 40) return 'bay--mid';
    return 'bay--low';
  }

  protected selectBay(bay: Bay): void {
    const pct = this.occupancyPct(bay);
    this.selectedBay.set({
      ...bay,
      occupancyPct: pct,
      colorClass: this.bayColorClass(bay),
    });
  }

  protected closeBayPanel(): void {
    this.selectedBay.set(null);
  }

  protected typeLabel(type: string): string {
    const labels: Record<string, string> = {
      RACK: 'Rack',
      QUARANTINE_ZONE: 'Cuarentena',
      DOCK: 'Muelle',
      STAGING: 'Staging',
    };
    return labels[type] ?? type;
  }

  protected filterOptions: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: 'Todas las Zonas' },
    { value: 'RACK', label: 'Racks' },
    { value: 'QUARANTINE_ZONE', label: 'Cuarentena' },
    { value: 'DOCK', label: 'Muelles' },
    { value: 'STAGING', label: 'Staging' },
  ];
}
