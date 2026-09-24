import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseMovementsApiService } from '../../../features/warehouse-movements/services/warehouse-movements-api.service';

export interface BayOccupancyItem {
  id: string;
  code: string;
  name: string;
  zone?: string;
  sectionName?: string;
  capacityPallets: number;
  currentStoredPallets: number;
  occupancyPercentage: number;
  status: string;
  isBlocked: boolean;
  trafficLight: 'GREEN' | 'AMBER' | 'RED';
  isRecommended: boolean;
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
})
export class BayOccupancySelectorComponent implements OnInit {
  private readonly apiService = inject(WarehouseMovementsApiService);

  @Input() branchId?: string;
  @Input() selectedLocationId?: string;
  @Input() selectedLocationCode?: string;
  @Input() allowAdminOverride: boolean = true;
  @Input() dialogTitle: string = 'Selector Visual de Ocupación de Bahías (Estándar 22 Pallets)';

  @Output() locationSelected = new EventEmitter<BaySelectionResult>();
  @Output() closed = new EventEmitter<void>();

  loading = signal<boolean>(false);
  bays = signal<BayOccupancyItem[]>([]);
  searchQuery = signal<string>('');
  selectedBay = signal<BayOccupancyItem | null>(null);
  overrideReason = signal<string>('');
  showOverrideForm = signal<boolean>(false);

  filteredBays = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.bays();
    if (!q) return list;
    return list.filter(
      (b) =>
        b.code.toLowerCase().includes(q) ||
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.sectionName && b.sectionName.toLowerCase().includes(q)) ||
        (b.zone && b.zone.toLowerCase().includes(q))
    );
  });

  recommendedBay = computed(() => {
    return this.bays().find((b) => b.isRecommended) || null;
  });

  ngOnInit(): void {
    this.loadBays();
  }

  loadBays(): void {
    this.loading.set(true);
    this.apiService.getBayOccupancy(this.branchId).subscribe({
      next: (data) => {
        const mapped: BayOccupancyItem[] = (data || []).map((d: any) => ({
          id: d.id,
          code: d.code,
          name: d.name || d.code,
          zone: d.zone || 'Almacén',
          sectionName: d.sectionName || 'Nave Principal',
          capacityPallets: d.capacityPallets || 22,
          currentStoredPallets: d.currentStoredPallets || 0,
          occupancyPercentage: d.occupancyPercentage || 0,
          status: d.status || 'ACTIVE',
          isBlocked: !!d.isBlocked,
          trafficLight: d.trafficLight || 'GREEN',
          isRecommended: !!d.isRecommended,
        }));
        this.bays.set(mapped);
        this.loading.set(false);

        // Pre-select current
        if (this.selectedLocationId) {
          const match = mapped.find((b) => b.id === this.selectedLocationId);
          if (match) this.selectedBay.set(match);
        } else if (this.selectedLocationCode) {
          const match = mapped.find((b) => b.code === this.selectedLocationCode);
          if (match) this.selectedBay.set(match);
        }
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  selectBay(bay: BayOccupancyItem): void {
    if (bay.isBlocked || bay.status !== 'ACTIVE') return;
    this.selectedBay.set(bay);

    const rec = this.recommendedBay();
    const isOverriding = rec ? rec.id !== bay.id : false;
    this.showOverrideForm.set(isOverriding);
  }

  confirmSelection(): void {
    const bay = this.selectedBay();
    if (!bay) return;

    const rec = this.recommendedBay();
    const isOverride = rec ? rec.id !== bay.id : false;

    this.locationSelected.emit({
      locationId: bay.id,
      locationCode: bay.code,
      isOverride: isOverride,
      overrideReason: isOverride ? this.overrideReason().trim() : undefined,
    });
  }

  closeModal(): void {
    this.closed.emit();
  }
}
