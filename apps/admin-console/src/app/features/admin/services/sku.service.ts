/**
 * @file sku.service.ts
 * @description Servicio de gestión del Catálogo de Productos / SKUs.
 * Integrado con el Backend mediante HTTP siguiendo el patrón estándar de 4GUARD WMS.
 *
 * Endpoints REST:
 *   GET    /api/v1/product-skus                            — Listar SKUs (excluye isDeleted: true)
 *   GET    /api/v1/product-skus?clientId={id}              — Listar SKUs por cliente depositante
 *   GET    /api/v1/product-skus/{id}                       — Obtener SKU por ID
 *   POST   /api/v1/product-skus                            — Crear SKU
 *   PUT    /api/v1/product-skus                            — Actualizar SKU
 *   PATCH  /api/v1/product-skus/{id}/status?status=INACTIVE — Cambiar estatus (ACTIVE/INACTIVE)
 *   PATCH  /api/v1/product-skus/{id}/soft-delete           — Borrado lógico (isDeleted = true)
 *   DELETE /api/v1/product-skus/{id}                       — Eliminar SKU
 *   GET    /api/v1/product-skus/{id}/audit                 — Bitácora de auditoría BE
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ClientService } from './client.service';
import {
  ProductSku,
  ProductSkuStatus,
  ProductSkuResponse,
  CreateProductSkuRequest,
  UpdateProductSkuRequest,
  ProductSkuAuditLog,
  ApiResponse,
  getSkuAuditIcon,
  getSkuAuditColor,
  getSkuAuditSummary,
} from '../skus/models/sku.model';

export type {
  ProductSku,
  ProductSkuStatus,
  ProductSkuResponse,
  CreateProductSkuRequest,
  UpdateProductSkuRequest,
  ProductSkuAuditLog,
  ApiResponse,
};

@Injectable({
  providedIn: 'root'
})
export class SkuService {
  private readonly http = inject(HttpClient);
  private readonly clientService = inject(ClientService);
  private readonly items = signal<ProductSku[]>([]);

  // ─── Signals Reactivos de Estado ─────────────────────────────────────────────

  readonly skus      = this.items.asReadonly();
  readonly loading   = signal<boolean>(false);
  readonly saving    = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  // ─── Computed KPIs ──────────────────────────────────────────────────────────

  readonly totalCount         = computed(() => this.items().length);
  readonly activeCount        = computed(() => this.items().filter(s => (s.status || 'ACTIVE') === 'ACTIVE').length);
  readonly inactiveCount      = computed(() => this.items().filter(s => s.status === 'INACTIVE').length);
  readonly uniqueClientsCount = computed(() => new Set(this.items().map(s => s.clientId).filter(Boolean)).size);

  getAll(): ProductSku[] {
    return this.items();
  }

  /**
   * Carga los SKUs desde el Backend (excluye únicamente los eliminados lógicamente con isDeleted = true).
   * Si se provee `clientId`, filtra por ese cliente específico.
   */
  loadSkus(clientId?: string): Observable<ApiResponse<ProductSkuResponse[]>> {
    this.loading.set(true);
    this.loadError.set(null);

    const url = clientId
      ? `${environment.apiBaseUrl}/api/v1/product-skus?clientId=${clientId}`
      : `${environment.apiBaseUrl}/api/v1/product-skus`;

    return this.http.get<ApiResponse<ProductSkuResponse[]>>(url).pipe(
      tap(response => {
        this.loading.set(false);
        const dataList = response.data || (Array.isArray(response) ? response : []);
        const mapped = dataList
          .map(dto => this.mapDtoToItem(dto))
          .filter(item => item.isDeleted !== true); // Excluir estrictamente los eliminados lógicamente
        this.items.set(mapped);
      }),
      catchError((error: HttpErrorResponse) => {
        this.loading.set(false);
        const msg = error?.error?.message || error?.message || 'Error al cargar los SKUs del servidor.';
        this.loadError.set(msg);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obtiene un SKU por su ID.
   */
  getById(id: string): Observable<ApiResponse<ProductSkuResponse>> {
    return this.http.get<ApiResponse<ProductSkuResponse>>(`${environment.apiBaseUrl}/api/v1/product-skus/${id}`);
  }

  /**
   * Crea un nuevo SKU en el Backend.
   */
  create(sku: Omit<ProductSku, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'clientName'>): Observable<ApiResponse<ProductSkuResponse>> {
    this.saving.set(true);

    const payload: CreateProductSkuRequest = {
      clientId: sku.clientId,
      code: sku.code,
      name: sku.name,
      description: sku.description || '',
      weight: sku.weight ?? 0,
      unit: sku.unit || 'BOX',
      status: sku.status || 'ACTIVE'
    };

    return this.http.post<ApiResponse<ProductSkuResponse>>(`${environment.apiBaseUrl}/api/v1/product-skus`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData && resData.id) {
          const newSku = this.mapDtoToItem(resData);
          this.items.update(list => [newSku, ...list]);
        } else {
          this.loadSkus().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Actualiza un SKU existente en el Backend.
   */
  update(id: string, updatedFields: Partial<ProductSku>): Observable<ApiResponse<ProductSkuResponse>> {
    this.saving.set(true);
    const existing = this.items().find(s => s.id === id);

    const payload: UpdateProductSkuRequest = {
      id: id,
      clientId: updatedFields.clientId || existing?.clientId || '',
      code: updatedFields.code || existing?.code || '',
      name: updatedFields.name || existing?.name || '',
      description: updatedFields.description !== undefined ? updatedFields.description : (existing?.description || ''),
      weight: updatedFields.weight !== undefined ? updatedFields.weight : (existing?.weight ?? 0),
      unit: updatedFields.unit || existing?.unit || 'BOX',
      status: updatedFields.status || existing?.status || 'ACTIVE'
    };

    return this.http.put<ApiResponse<ProductSkuResponse>>(`${environment.apiBaseUrl}/api/v1/product-skus`, payload).pipe(
      tap(response => {
        this.saving.set(false);
        const resData = response.data || (response as any);
        if (resData && resData.id) {
          const updatedSku = this.mapDtoToItem(resData);
          this.items.update(list => list.map(item => item.id === id ? updatedSku : item));
        } else {
          this.loadSkus().subscribe();
        }
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Cambia el estatus operativo del SKU (ACTIVE / INACTIVE).
   * Endpoint: PATCH /api/v1/product-skus/{id}/status?status=INACTIVE
   */
  updateStatus(id: string, status: ProductSkuStatus): Observable<ApiResponse<ProductSkuResponse>> {
    this.saving.set(true);
    const targetStatus = status.toUpperCase() as ProductSkuStatus;
    const url = `${environment.apiBaseUrl}/api/v1/product-skus/${id}/status?status=${targetStatus}`;

    return this.http.patch<ApiResponse<ProductSkuResponse>>(url, {}).pipe(
      tap(response => {
        this.saving.set(false);
        this.items.update(list => list.map(item => {
          if (item.id === id) {
            return {
              ...item,
              status: targetStatus,
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        }));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Realiza un borrado lógico del SKU (isDeleted = true, status = 'INACTIVE').
   * Endpoint: PATCH /api/v1/product-skus/{id}/soft-delete
   */
  softDelete(id: string): Observable<ApiResponse<null>> {
    this.saving.set(true);
    const url = `${environment.apiBaseUrl}/api/v1/product-skus/${id}/soft-delete`;

    return this.http.patch<ApiResponse<null>>(url, {}).pipe(
      tap(() => {
        this.saving.set(false);
        this.items.update(list => list.filter(item => item.id !== id));
      }),
      catchError((error: HttpErrorResponse) => {
        this.saving.set(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Elimina un SKU.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.softDelete(id);
  }

  /**
   * Obtiene la bitácora de auditoría de un SKU desde la API Backend.
   * Endpoint: GET /api/v1/product-skus/{id}/audit
   */
  getSkuAudit(id: string): Observable<ApiResponse<ProductSkuAuditLog[]>> {
    const url = `${environment.apiBaseUrl}/api/v1/product-skus/${id}/audit`;
    return this.http.get<ApiResponse<ProductSkuAuditLog[]>>(url).pipe(
      map(res => {
        const rawList = res.data || (Array.isArray(res) ? res : []);
        const formattedData: ProductSkuAuditLog[] = rawList.map((item: any) => {
          const actionStr = item.action || 'PRODUCT_SKU_UPDATED';
          return {
            id: item.logId || item.id || String(Math.random()),
            action: actionStr,
            performedBy: item.username || item.performedBy || 'enrique',
            performedAt: item.createdAt || item.performedAt || new Date().toISOString(),
            summary: getSkuAuditSummary(actionStr),
            timelineIcon: getSkuAuditIcon(actionStr),
            timelineColor: getSkuAuditColor(actionStr),
            details: item.details || []
          };
        });
        return {
          status: res.status || 200,
          message: res.message || 'Auditoría recuperada',
          data: formattedData
        };
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error al recuperar historial de auditoría del SKU:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Mapea el DTO del Backend al modelo del Frontend garantizando tipos estrictos.
   */
  private mapDtoToItem(dto: ProductSkuResponse): ProductSku {
    const isDeleted = dto.isDeleted === true || (dto.isDeleted as any) === 'true';
    const rawStatus = dto.status ? String(dto.status).toUpperCase() : 'ACTIVE';
    const status: ProductSkuStatus = rawStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return {
      id: dto.id,
      clientId: dto.clientId,
      clientName: dto.clientName || 'Cliente Depositante',
      code: dto.code,
      name: dto.name,
      description: dto.description || '',
      weight: dto.weight ?? 0,
      unit: dto.unit || 'BOX',
      status: status,
      isDeleted: isDeleted,
      version: dto.version || 1,
      createdAt: dto.createdAt || new Date().toISOString(),
      updatedAt: dto.updatedAt || new Date().toISOString()
    };
  }
}
