/**
 * @file inventory.repository.ts
 * @description Contrato de repositorio (Port) para Inventario WMS.
 * Estándar SDOP — SyborX.
 */

import { Observable } from 'rxjs';
import { Item, ItemFilter, PagedItemResponse } from '../models/item.model';
import { InventoryStatus } from '../enums/inventory-status.enum';

export interface IInventoryRepository {
  /** Carga la lista paginada y filtrada de inventario */
  getItems(filters?: ItemFilter): Observable<PagedItemResponse>;

  /** Obtiene un ítem por su ID o SSCC */
  getItemById(id: string): Observable<Item | null>;

  /** Actualiza el estado de un ítem (ej. Disponible, Cuarentena, Bloqueado QM) */
  updateStatus(id: string, status: InventoryStatus, notes?: string): Observable<Item>;
}
