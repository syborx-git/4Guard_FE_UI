/**
 * @file inventory.state.ts
 * @description Store reactivo de inventario usando Angular Signals.
 *
 * Gestiona el estado global del inventario: lista paginada de ítems,
 * filtros activos, ítem seleccionado, y estado de carga/error.
 *
 * Patrón: providedIn: 'root' → Singleton. Los componentes consumen
 * las signals de solo lectura para evitar mutaciones directas.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap, catchError, EMPTY, finalize } from 'rxjs';
import { BackendService } from '../../infrastructure/services/backend.service';
import { Item, ItemFilter, PagedItemResponse } from '../../domain/models/item.model';
import { InventoryStatus } from '../../domain/enums/inventory-status.enum';

/** Estado interno del store de inventario */
interface InventoryStateShape {
  items:         Item[];
  selectedItem:  Item | null;
  filters:       ItemFilter;
  totalElements: number;
  totalPages:    number;
  currentPage:   number;
  pageSize:      number;
  isLoading:     boolean;
  error:         string | null;
}

const INITIAL_STATE: InventoryStateShape = {
  items:         [],
  selectedItem:  null,
  filters:       { page: 0, size: 20, sortBy: 'lastStatusChangeAt', sortDir: 'desc' },
  totalElements: 0,
  totalPages:    0,
  currentPage:   0,
  pageSize:      20,
  isLoading:     false,
  error:         null,
};

@Injectable({ providedIn: 'root' })
export class InventoryState {
  private readonly backend = inject(BackendService);

  // ─── Estado privado ───────────────────────────────────────────────────────
  private readonly _state = signal<InventoryStateShape>(INITIAL_STATE);

  // ─── Señales de solo lectura (Selectors) ──────────────────────────────────
  readonly items         = computed(() => this._state().items);
  readonly selectedItem  = computed(() => this._state().selectedItem);
  readonly filters       = computed(() => this._state().filters);
  readonly totalElements = computed(() => this._state().totalElements);
  readonly totalPages    = computed(() => this._state().totalPages);
  readonly currentPage   = computed(() => this._state().currentPage);
  readonly pageSize      = computed(() => this._state().pageSize);
  readonly isLoading     = computed(() => this._state().isLoading);
  readonly error         = computed(() => this._state().error);

  /** Ítems filtrados por estado (derivado) */
  readonly itemsByStatus = (status: InventoryStatus) =>
    computed(() => this._state().items.filter((item) => item.status === status));

  /** Total de ítems en cuarentena (para badge de alerta) */
  readonly quarantineCount = computed(
    () => this._state().items.filter((i) => i.status === InventoryStatus.QUARANTINE).length,
  );

  /** Total de ítems bloqueados por QM */
  readonly qmBlockedCount = computed(
    () => this._state().items.filter((i) => i.status === InventoryStatus.QM_BLOCKED).length,
  );

  // ─── Acciones ─────────────────────────────────────────────────────────────

  /**
   * Carga la lista de ítems con los filtros actuales.
   */
  loadItems(): Observable<PagedItemResponse> {
    this.patchState({ isLoading: true, error: null });

    const filters = this._state().filters;

    return this.backend.get<PagedItemResponse>('/api/inventory/items', filters as Record<string, string>).pipe(
      tap((response) => {
        this.patchState({
          items:         response.content,
          totalElements: response.totalElements,
          totalPages:    response.totalPages,
          currentPage:   response.page,
          pageSize:      response.size,
        });
      }),
      catchError((error) => {
        this.patchState({ error: error.message ?? 'Error al cargar inventario' });
        return EMPTY;
      }),
      finalize(() => this.patchState({ isLoading: false })),
    );
  }

  /**
   * Selecciona un ítem para vista de detalle.
   */
  selectItem(item: Item | null): void {
    this.patchState({ selectedItem: item });
  }

  /**
   * Actualiza los filtros y recarga los ítems.
   */
  setFilters(filters: Partial<ItemFilter>): void {
    this.patchState({
      filters: { ...this._state().filters, ...filters, page: 0 },
      currentPage: 0,
    });
    this.loadItems().subscribe();
  }

  /**
   * Navega a una página específica.
   */
  goToPage(page: number): void {
    this.patchState({
      filters: { ...this._state().filters, page },
    });
    this.loadItems().subscribe();
  }

  /**
   * Actualiza un ítem en el estado local (optimistic update).
   */
  updateItemLocally(updatedItem: Item): void {
    const items = this._state().items.map((item) =>
      item.id === updatedItem.id ? updatedItem : item,
    );
    this.patchState({ items });

    if (this._state().selectedItem?.id === updatedItem.id) {
      this.patchState({ selectedItem: updatedItem });
    }
  }

  /**
   * Limpia el estado de error.
   */
  clearError(): void {
    this.patchState({ error: null });
  }

  /**
   * Restablece el estado al valor inicial.
   */
  reset(): void {
    this._state.set(INITIAL_STATE);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private patchState(partial: Partial<InventoryStateShape>): void {
    this._state.update((current) => ({ ...current, ...partial }));
  }
}
