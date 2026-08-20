/**
 * @file warehouse-map.component.ts
 * @description P5 — Inventario 2D (Topología Cromática) [HU-048].
 * Mapa interactivo de bahías con CSS Grid. Consume LocationService como SSOT para Muelles de Descarga.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../admin/services/location.service';
import { AuthState } from '../../../core/auth/auth.state';

interface Bay {
  id: string;
  code: string;
  type: 'RACK' | 'QUARANTINE_ZONE' | 'DOCK' | 'STAGING';
  row: number;
  col: number;
  capacity: number;
  occupied: number;
  isBlocked: boolean;
}

interface SelectedBayInfo extends Bay {
  occupancyPct: number;
  colorClass: string;
}

type FilterType = 'ALL' | 'RACK' | 'QUARANTINE_ZONE' | 'DOCK' | 'STAGING';

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

  protected readonly filterType = signal<FilterType>('ALL');
  protected readonly selectedBay = signal<SelectedBayInfo | null>(null);
  protected readonly searchCode = signal('');

  protected readonly activeBranchId = computed(() => {
    return (this.authState as any).activeBranchId?.() || 'SUC-001';
  });

  // Bahías estáticas de Racks, Cuarentena y Staging
  private readonly staticBays = signal<Bay[]>([
    { id: 'LOC-A1-01', code: 'A-1-01', type: 'RACK', row: 0, col: 0, capacity: 60,  occupied: 48,  isBlocked: false },
    { id: 'LOC-A1-02', code: 'A-1-02', type: 'RACK', row: 0, col: 1, capacity: 60,  occupied: 36,  isBlocked: false },
    { id: 'LOC-A1-03', code: 'A-1-03', type: 'RACK', row: 0, col: 2, capacity: 60,  occupied: 55,  isBlocked: false },
    { id: 'LOC-A2-01', code: 'A-2-01', type: 'RACK', row: 0, col: 3, capacity: 60,  occupied: 48,  isBlocked: false },
    { id: 'LOC-A2-02', code: 'A-2-02', type: 'RACK', row: 0, col: 4, capacity: 60,  occupied: 10,  isBlocked: false },
    { id: 'LOC-A2-03', code: 'A-2-03', type: 'RACK', row: 0, col: 5, capacity: 60,  occupied: 0,   isBlocked: false },
    { id: 'LOC-A3-01', code: 'A-3-01', type: 'RACK', row: 0, col: 6, capacity: 60,  occupied: 52,  isBlocked: false },
    { id: 'LOC-A3-02', code: 'A-3-02', type: 'RACK', row: 0, col: 7, capacity: 60,  occupied: 60,  isBlocked: false },
    { id: 'LOC-B1-01', code: 'B-1-01', type: 'RACK', row: 1, col: 0, capacity: 80,  occupied: 72,  isBlocked: false },
    { id: 'LOC-B1-02', code: 'B-1-02', type: 'RACK', row: 1, col: 1, capacity: 80,  occupied: 80,  isBlocked: false },
    { id: 'LOC-B1-03', code: 'B-1-03', type: 'RACK', row: 1, col: 2, capacity: 80,  occupied: 30,  isBlocked: false },
    { id: 'LOC-B2-01', code: 'B-2-01', type: 'RACK', row: 1, col: 3, capacity: 80,  occupied: 25,  isBlocked: false },
    { id: 'LOC-B2-02', code: 'B-2-02', type: 'RACK', row: 1, col: 4, capacity: 80,  occupied: 0,   isBlocked: false },
    { id: 'LOC-B2-03', code: 'B-2-03', type: 'RACK', row: 1, col: 5, capacity: 80,  occupied: 80,  isBlocked: true  },
    { id: 'LOC-B2-04', code: 'B-2-04', type: 'RACK', row: 1, col: 6, capacity: 80,  occupied: 96,  isBlocked: true  },
    { id: 'LOC-B3-01', code: 'B-3-01', type: 'RACK', row: 1, col: 7, capacity: 80,  occupied: 70,  isBlocked: false },
    { id: 'LOC-C1-01', code: 'C-1-01', type: 'RACK', row: 2, col: 0, capacity: 100, occupied: 95,  isBlocked: false },
    { id: 'LOC-C1-02', code: 'C-1-02', type: 'RACK', row: 2, col: 1, capacity: 100, occupied: 88,  isBlocked: false },
    { id: 'LOC-C2-01', code: 'C-2-01', type: 'RACK', row: 2, col: 2, capacity: 100, occupied: 45,  isBlocked: false },
    { id: 'LOC-C2-02', code: 'C-2-02', type: 'RACK', row: 2, col: 3, capacity: 100, occupied: 20,  isBlocked: false },
    { id: 'LOC-C3-01', code: 'C-3-01', type: 'RACK', row: 2, col: 4, capacity: 100, occupied: 72,  isBlocked: false },
    { id: 'LOC-C3-02', code: 'C-3-02', type: 'RACK', row: 2, col: 5, capacity: 100, occupied: 0,   isBlocked: false },
    { id: 'LOC-C4-01', code: 'C-4-01', type: 'RACK', row: 2, col: 6, capacity: 100, occupied: 60,  isBlocked: false },
    { id: 'LOC-C4-02', code: 'C-4-02', type: 'RACK', row: 2, col: 7, capacity: 100, occupied: 100, isBlocked: false },
    { id: 'LOC-D1-01', code: 'D-1-01', type: 'RACK', row: 3, col: 0, capacity: 120, occupied: 110, isBlocked: false },
    { id: 'LOC-D1-02', code: 'D-1-02', type: 'RACK', row: 3, col: 1, capacity: 120, occupied: 60,  isBlocked: false },
    { id: 'LOC-D2-01', code: 'D-2-01', type: 'RACK', row: 3, col: 2, capacity: 120, occupied: 30,  isBlocked: false },
    { id: 'LOC-D2-02', code: 'D-2-02', type: 'RACK', row: 3, col: 3, capacity: 120, occupied: 5,   isBlocked: false },
    { id: 'LOC-D3-01', code: 'D-3-01', type: 'RACK', row: 3, col: 4, capacity: 120, occupied: 90,  isBlocked: false },
    { id: 'LOC-D3-02', code: 'D-3-02', type: 'RACK', row: 3, col: 5, capacity: 120, occupied: 120, isBlocked: false },
    { id: 'LOC-D4-01', code: 'D-4-01', type: 'RACK', row: 3, col: 6, capacity: 120, occupied: 0,   isBlocked: false },
    { id: 'LOC-D4-02', code: 'D-4-02', type: 'RACK', row: 3, col: 7, capacity: 120, occupied: 42,  isBlocked: false },
    { id: 'LOC-E1-01', code: 'E-1-01', type: 'RACK', row: 4, col: 0, capacity: 80,  occupied: 80,  isBlocked: false },
    { id: 'LOC-E2-01', code: 'E-2-01', type: 'RACK', row: 4, col: 1, capacity: 80,  occupied: 60,  isBlocked: false },
    { id: 'LOC-E3-01', code: 'E-3-01', type: 'RACK', row: 4, col: 2, capacity: 80,  occupied: 35,  isBlocked: false },
    { id: 'LOC-E4-01', code: 'E-4-01', type: 'RACK', row: 4, col: 3, capacity: 80,  occupied: 0,   isBlocked: false },
    { id: 'LOC-Q-01',  code: 'Q-01',   type: 'QUARANTINE_ZONE', row: 5, col: 0, capacity: 50, occupied: 24, isBlocked: false },
    { id: 'LOC-Q-02',  code: 'Q-02',   type: 'QUARANTINE_ZONE', row: 5, col: 1, capacity: 50, occupied: 48, isBlocked: false },
    { id: 'LOC-STG-01',code: 'STG-01', type: 'STAGING', row: 6, col: 2, capacity: 300, occupied: 120, isBlocked: false },
    { id: 'LOC-STG-02',code: 'STG-02', type: 'STAGING', row: 6, col: 3, capacity: 300, occupied: 0,   isBlocked: false },
  ]);

  // Consumo Reactivo de Muelles desde LocationService (SSOT Físico)
  protected readonly dockBays = computed<Bay[]>(() => {
    const branchId = this.activeBranchId();
    if (!branchId) return [];

    const docks = this.locationService.getDocksForBranch(branchId);
    return docks.map((dock, index) => {
      let occupied = 0;
      if (dock.operationalStatus === 'OCCUPIED') occupied = 200;
      else if (dock.operationalStatus === 'RESERVED') occupied = 100;

      const isBlocked = dock.operationalStatus === 'MAINTENANCE' || dock.operationalStatus === 'BLOCKED' || dock.operationalStatus === 'OUT_OF_SERVICE';

      return {
        id: dock.id,
        code: dock.code,
        type: 'DOCK',
        row: 6,
        col: index,
        capacity: 200,
        occupied,
        isBlocked,
      };
    });
  });

  // Combinación reactiva unificada de todas las bahías
  protected readonly allBays = computed<Bay[]>(() => {
    return [...this.staticBays(), ...this.dockBays()];
  });

  protected readonly displayBays = computed(() => {
    const filter = this.filterType();
    const search = this.searchCode().toLowerCase();
    return this.allBays()
      .filter((b) => filter === 'ALL' || b.type === filter)
      .filter((b) => !search || b.code.toLowerCase().includes(search));
  });

  protected readonly stats = computed(() => {
    const bays  = this.allBays();
    const total = bays.length;
    const blocked   = bays.filter(b => b.isBlocked).length;
    const highOcc   = bays.filter(b => !b.isBlocked && (b.occupied / b.capacity) > 0.85).length;
    const medOcc    = bays.filter(b => !b.isBlocked && (b.occupied / b.capacity) >= 0.40 && (b.occupied / b.capacity) <= 0.85).length;
    const lowOcc    = bays.filter(b => !b.isBlocked && (b.occupied / b.capacity) < 0.40).length;
    return { total, blocked, highOcc, medOcc, lowOcc };
  });

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
      RACK: 'Rack', QUARANTINE_ZONE: 'Cuarentena', DOCK: 'Muelle', STAGING: 'Staging',
    };
    return labels[type] ?? type;
  }

  protected filterOptions: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'RACK', label: 'Racks' },
    { value: 'QUARANTINE_ZONE', label: 'Cuarentena' },
    { value: 'DOCK', label: 'Muelles' },
    { value: 'STAGING', label: 'Staging' },
  ];
}
