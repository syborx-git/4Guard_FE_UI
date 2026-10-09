/**
 * @file inventory-query-grid.component.ts
 * @description DataGrid principal e interactivo con KPIs de resumen, selección múltiple, buscador predictivo y exportación a Excel.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryQueryService } from '../../services/inventory-query.service';
import { InventoryExcelExportService } from '../../services/inventory-excel-export.service';
import {
  InventoryRecord,
  SearchSuggestionItem,
  ExpirationBadgeStatus
} from '../../models/inventory-query.models';
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

  // Búsqueda rápida local y sugerencias predictivas
  protected searchTerm = signal('');
  protected isSuggestionsOpen = signal(false);

  // ── MÚLTIPLE SELECCIÓN REACTIVA (SDOP) ──────────────────────────────────────
  protected readonly selectedIds = signal<Set<number>>(new Set());

  // Paginación local
  protected currentPage = signal(1);
  protected pageSize = signal(10);

  /**
   * Filtrado adicional en vivo por término de búsqueda rápida y tokens múltiples
   */
  protected readonly displayedRecords = computed(() => {
    const list = this.inventoryService.filteredInventory();
    const rawTerm = this.searchTerm().toLowerCase().trim();

    if (!rawTerm) return list;

    // Búsqueda multi-token por palabras (ej. "frasco nescafé")
    const tokens = rawTerm.split(/\s+/).filter((t) => t.length > 0);

    return list.filter((r) => {
      const searchStr = `${r.id} ${r.sku} ${r.productDescription} ${r.remision} ${r.location} ${r.warehouse} ${r.supplier} ${r.client}`.toLowerCase();
      return tokens.every((token) => searchStr.includes(token));
    });
  });

  /**
   * Sugerencias predictivas inteligentes agrupadas por tipo ("Comienza con" / Keywords)
   */
  protected readonly searchSuggestions = computed<SearchSuggestionItem[]>(() => {
    const q = this.searchTerm().toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const suggestions: SearchSuggestionItem[] = [];
    const raw = this.inventoryService.rawInventory();

    // 1. SKUs coincidentes
    const skus = this.inventoryService.distinctSkus();
    for (const s of skus) {
      if (s.sku.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) {
        suggestions.push({
          type: 'SKU',
          label: s.sku,
          subLabel: s.description,
          value: s.sku,
          count: s.count,
          icon: 'qr_code'
        });
      }
    }

    // 2. Palabras Clave y Productos
    const keywords = this.inventoryService.distinctKeywords();
    for (const k of keywords) {
      if (k.word.toLowerCase().startsWith(q) || k.word.toLowerCase().includes(q)) {
        if (!suggestions.some((s) => s.value.toLowerCase() === k.word.toLowerCase())) {
          suggestions.push({
            type: 'KEYWORD',
            label: k.word,
            subLabel: `Buscar productos que contengan "${k.word}"`,
            value: k.word,
            count: k.count,
            icon: 'search'
          });
        }
      }
    }

    // 3. Bodegas / Almacenes
    const warehouses = this.inventoryService.distinctWarehouses();
    for (const w of warehouses) {
      if (w.warehouse.toLowerCase().includes(q)) {
        suggestions.push({
          type: 'WAREHOUSE',
          label: w.warehouse,
          subLabel: 'Filtrar por almacén/bodega',
          value: w.warehouse,
          count: w.count,
          icon: 'warehouse'
        });
      }
    }

    // 4. Remisiones
    const remSet = new Map<string, number>();
    for (const r of raw) {
      if (r.remision.toLowerCase().includes(q)) {
        remSet.set(r.remision, (remSet.get(r.remision) || 0) + 1);
      }
    }
    for (const [rem, count] of remSet.entries()) {
      suggestions.push({
        type: 'REVISION',
        label: rem,
        subLabel: 'Filtrar por factura / remisión',
        value: rem,
        count,
        icon: 'description'
      });
    }

    return suggestions.slice(0, 10);
  });

  /**
   * Registros seleccionados activos
   */
  protected readonly selectedRecords = computed(() => {
    const ids = this.selectedIds();
    return this.inventoryService.rawInventory().filter((r) => ids.has(r.id));
  });

  /**
   * Resumen Métrico de los Elementos Seleccionados
   */
  protected readonly selectedKpiSummary = computed(() => {
    const list = this.selectedRecords();
    const totalPallets = list.reduce((sum, r) => sum + r.palletsCount, 0);
    const totalPieces = list.reduce((sum, r) => sum + r.measuredQuantity, 0);
    const distinctSkus = new Set(list.map((r) => r.sku)).size;
    return {
      totalCount: list.length,
      totalPallets: Math.round(totalPallets * 100) / 100,
      totalPieces,
      distinctSkus
    };
  });

  /**
   * Indica si todos los registros mostrados están seleccionados
   */
  protected readonly isAllDisplayedSelected = computed(() => {
    const displayed = this.displayedRecords();
    if (displayed.length === 0) return false;
    const ids = this.selectedIds();
    return displayed.every((r) => ids.has(r.id));
  });

  /**
   * Indica selección parcial para checkbox maestro
   */
  protected readonly isPartiallySelected = computed(() => {
    const displayed = this.displayedRecords();
    if (displayed.length === 0) return false;
    const ids = this.selectedIds();
    const some = displayed.some((r) => ids.has(r.id));
    const all = displayed.every((r) => ids.has(r.id));
    return some && !all;
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

  // ── MÉTODOS DE SELECCIÓN MÚLTIPLE ───────────────────────────────────────────
  protected isRecordSelected(id: number): boolean {
    return this.selectedIds().has(id);
  }

  protected toggleSelectRecord(id: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleSelectAllDisplayed(): void {
    const displayed = this.displayedRecords();
    const ids = this.selectedIds();
    const allSelected = displayed.every((r) => ids.has(r.id));

    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (allSelected) {
        displayed.forEach((r) => next.delete(r.id));
      } else {
        displayed.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  protected selectAllFiltered(): void {
    const displayed = this.displayedRecords();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      displayed.forEach((r) => next.add(r.id));
      return next;
    });
  }

  protected clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  protected invertSelection(): void {
    const displayed = this.displayedRecords();
    this.selectedIds.update((set) => {
      const next = new Set(set);
      displayed.forEach((r) => {
        if (next.has(r.id)) {
          next.delete(r.id);
        } else {
          next.add(r.id);
        }
      });
      return next;
    });
  }

  protected selectBySku(sku: string): void {
    const matching = this.inventoryService.rawInventory().filter((r) => r.sku === sku);
    this.selectedIds.update((set) => {
      const next = new Set(set);
      matching.forEach((r) => next.add(r.id));
      return next;
    });
  }

  // ── BÚSQUEDA Y AUTOCOMPLETADO ───────────────────────────────────────────────
  protected selectSuggestion(item: SearchSuggestionItem): void {
    this.searchTerm.set(item.value);
    this.isSuggestionsOpen.set(false);
  }

  protected onSearchInput(val: string): void {
    this.searchTerm.set(val);
    this.isSuggestionsOpen.set(val.trim().length >= 2);
    this.currentPage.set(1);
  }

  protected clearSearch(): void {
    this.searchTerm.set('');
    this.isSuggestionsOpen.set(false);
    this.currentPage.set(1);
  }

  // ── GESTIÓN DE CHIPS DE FILTRO RÁPIDO ───────────────────────────────────────
  protected removeSkuFilter(sku: string): void {
    const current = this.inventoryService.activeFilters();
    const updated = (current.selectedSkus || []).filter((s) => s !== sku);
    this.inventoryService.setFilters({ ...current, selectedSkus: updated });
  }

  protected removeWarehouseFilter(wh: string): void {
    const current = this.inventoryService.activeFilters();
    const updated = (current.selectedWarehouses || []).filter((w) => w !== wh);
    this.inventoryService.setFilters({ ...current, selectedWarehouses: updated });
  }

  protected removeExpirationStatusFilter(st: ExpirationBadgeStatus): void {
    const current = this.inventoryService.activeFilters();
    const updated = (current.selectedExpirationStatuses || []).filter((s) => s !== st);
    this.inventoryService.setFilters({ ...current, selectedExpirationStatuses: updated });
  }

  protected resetAllFilters(): void {
    this.inventoryService.clearFilters();
    this.clearSearch();
    this.clearSelection();
  }

  // ── EXPORTACIÓN Y ANALÍTICA ────────────────────────────────────────────────
  protected onExportExcel(): void {
    const selected = this.selectedRecords();
    const data = selected.length > 0 ? selected : this.displayedRecords();
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

  protected setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }
}
