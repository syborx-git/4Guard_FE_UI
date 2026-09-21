/**
 * @file http-inventory.adapter.ts
 * @description Adaptador HTTP para IInventoryRepository conectado a Spring Boot.
 * Estándar SDOP — SyborX.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IInventoryRepository } from '../../domain/ports/inventory.repository';
import { Item, ItemFilter, PagedItemResponse } from '../../domain/models/item.model';
import { InventoryStatus } from '../../domain/enums/inventory-status.enum';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HttpInventoryAdapter implements IInventoryRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/v1/inventory`;

  getItems(filters?: ItemFilter): Observable<PagedItemResponse> {
    let params = new HttpParams();
    if (filters) {
      if (filters.status !== undefined) params = params.set('status', String(filters.status));
      if (filters.sku) params = params.set('sku', filters.sku);
      if (filters.page !== undefined) params = params.set('page', String(filters.page));
      if (filters.size !== undefined) params = params.set('size', String(filters.size));
    }

    return this.http.get<{ success: boolean; data: PagedItemResponse }>(`${this.apiUrl}/items`, { params }).pipe(
      map((res) => res.data || { content: [], totalElements: 0, totalPages: 0, page: 0, size: 20 })
    );
  }

  getItemById(id: string): Observable<Item | null> {
    return this.http.get<{ success: boolean; data: Item }>(`${this.apiUrl}/items/${id}`).pipe(
      map((res) => res.data || null)
    );
  }

  updateStatus(id: string, status: InventoryStatus, notes?: string): Observable<Item> {
    return this.http.patch<{ success: boolean; data: Item }>(`${this.apiUrl}/items/${id}/status`, { status, notes }).pipe(
      map((res) => res.data)
    );
  }
}
