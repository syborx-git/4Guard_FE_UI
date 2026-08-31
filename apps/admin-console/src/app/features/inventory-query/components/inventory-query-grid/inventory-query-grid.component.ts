/**
 * @file inventory-query-grid.component.ts
 * @description DataGrid principal e interactivo con KPIs de resumen y acciones de exportación a Excel y analítica.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryQueryService } from '../../services/inventory-query.service';
import { InventoryExcelExportService } from '../../services/inventory-excel-export.service';
import { InventoryRecord } from '../../models/inventory-query.models';
import { InventoryQueryFilterModalComponent } from '../inventory-query-filter-modal/inventory-query-filter-modal.component';
import { InventoryAnalyticsModalComponent } from '../inventory-analytics-modal/inventory-analytics-modal.component';

@Component({
  selector: 'fg-inventory-query-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InventoryQueryFilterModalComponent,
    InventoryAnalyticsModalComponent
  ],
  templateUrl: './inventory-query-grid.component.html',
  styleUrl: './inventory-query-grid.component.css'
})
export class InventoryQueryGridComponent {
  protected readonly inventoryService = inject(InventoryQueryService);
  protected readonly excelExportService = inject(InventoryExcelExportService);

  // Modales
  protected isFilterModalOpen = signal(false);
  protected isAnalyticsModalOpen = signal(false);
  protected analyticsInitialView = signal<'table' | 'chart'>('table');

  // Búsqueda rápida local en la tabla
  protected searchTerm = signal('');

  // Paginación local
  protected currentPage = signal(1);
  protected pageSize = signal(10);

  /**
   * Filtrado adicional en vivo por término de búsqueda rápida
   */
  protected readonly displayedRecords = computed(() => {
    const list = this.inventoryService.filteredInventory();
    const term = this.searchTerm().toLowerCase().trim();

    if (!term) return list;

    return list.filter(
      (r) =>
        r.id.toString().includes(term) ||
        r.sku.toLowerCase().includes(term) ||
        r.productDescription.toLowerCase().includes(term) ||
        r.remision.toLowerCase().includes(term) ||
        r.location.toLowerCase().includes(term) ||
        r.supplier.toLowerCase().includes(term) ||
        r.client.toLowerCase().includes(term)
    );
  });

  /**
   * Registros paginados para la vista de tabla
   */
  protected readonly paginatedRecords = computed(() => {
    const list = this.displayedRecords();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  /** Total de páginas */
  protected readonly totalPages = computed(() =>
    Math.ceil(this.displayedRecords().length / this.pageSize()) || 1
  );

  protected onExportExcel(): void {
    const data = this.displayedRecords();
    this.excelExportService.exportToExcel(data);
  }

  protected openFilters(): void {
    this.isFilterModalOpen.set(true);
  }

  protected closeFilters(): void {
    this.isFilterModalOpen.set(false);
  }

  protected openAnalytics(view: 'table' | 'chart' = 'table'): void {
    this.analyticsInitialView.set(view);
    this.isAnalyticsModalOpen.set(true);
  }

  protected closeAnalytics(): void {
    this.isAnalyticsModalOpen.set(false);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
  }

  protected setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
