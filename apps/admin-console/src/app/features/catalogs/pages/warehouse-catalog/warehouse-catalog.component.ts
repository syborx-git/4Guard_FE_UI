/**
 * @file warehouse-catalog.component.ts
 * @description Catálogo de Almacén y Topología de Posiciones en 4GUARD WMS.
 * Jerarquía de Pestañas: 1. Mapa Visual de Topología -> 2. Consulta de Bahías.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogsService } from '../../services/catalogs.service';
import { WarehouseZoneCode, WAREHOUSE_ZONES, BayOccupancyStatus } from '../../models/warehouse-catalog.models';

type WarehouseSubTab = 'topology' | 'bays';

@Component({
  selector: 'fg-warehouse-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './warehouse-catalog.component.html',
  styleUrl: './warehouse-catalog.component.css',
})
export class WarehouseCatalogComponent {
  protected readonly catalogsService = inject(CatalogsService);

  // Jerarquía: Mapa de Topología por defecto
  protected readonly activeTab = signal<WarehouseSubTab>('topology');

  // Filtros
  protected readonly selectedZone = signal<string>('ALL');
  protected readonly occupancyFilter = signal<string>('ALL');
  protected readonly searchBayCode = signal<string>('');

  protected readonly warehouseZones = WAREHOUSE_ZONES;

  protected readonly filteredBays = computed(() => {
    const list = this.catalogsService.bays();
    const zFilter = this.selectedZone();
    const occFilter = this.occupancyFilter();
    const query = this.searchBayCode().toLowerCase().trim();

    return list.filter((b) => {
      const matchZone = zFilter === 'ALL' || b.warehouseZone === zFilter;
      const matchOcc = occFilter === 'ALL' || b.status === occFilter;
      const matchQuery =
        !query ||
        b.bayCode.toLowerCase().includes(query) ||
        b.description.toLowerCase().includes(query) ||
        (b.skuStored && b.skuStored.toLowerCase().includes(query));

      return matchZone && matchOcc && matchQuery;
    });
  });

  protected readonly zoneStats = computed(() => {
    const list = this.filteredBays();
    const total = list.length;
    const empty = list.filter((b) => b.occupiedPallets === 0).length;
    const partial = list.filter((b) => b.status === 'PARCIAL').length;
    const saturated = list.filter((b) => b.status === 'SATURADA').length;
    const occupancyRate = total > 0 ? Math.round(((total - empty) / total) * 100) : 0;

    return { total, empty, partial, saturated, occupancyRate };
  });
}
