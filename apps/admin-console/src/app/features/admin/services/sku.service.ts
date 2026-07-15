import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, forkJoin, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { ClientService } from './client.service';

export interface ProductSku {
  id: string;
  clientId: string;
  clientName: string;
  code: string; // unique SKU code (max 50 chars)
  name: string; // commercial name (max 200 chars)
  description: string;
  weight: number; // decimal (e.g., 12.500 kg)
  unit: string; // Unit of measure (max 20 chars, e.g., PZA, CAJA, TARIMA)
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSkuResponse {
  id: string;
  clientId: string;
  clientName: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  unit: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductSkuRequest {
  clientId: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  unit: string;
}

export interface UpdateProductSkuRequest {
  id: string;
  clientId: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  unit: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class SkuService {
  private readonly http = inject(HttpClient);
  private readonly clientService = inject(ClientService);
  private readonly items = signal<ProductSku[]>([]);

  readonly skus = this.items.asReadonly();

  getAll(): ProductSku[] {
    return this.items();
  }

  /**
   * Carga los SKUs de los clientes pertenecientes a la organización del usuario firmado.
   */
  loadSkus(): Observable<ProductSku[]> {
    const orgClients = this.clientService.clients();

    if (orgClients.length === 0) {
      // Fallback: cargar todos los SKUs del sistema si no hay clientes locales cargados
      return this.http.get<ApiResponse<ProductSkuResponse[]>>(
        `${environment.apiBaseUrl}/api/v1/product-skus`
      ).pipe(
        map(response => (response.success && response.data) ? response.data.map(dto => this.mapDtoToItem(dto)) : []),
        tap(allSkus => this.items.set(allSkus)),
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
    }

    // Cargar en paralelo los SKUs de cada cliente de la organización
    const requests = orgClients.map(c => this.loadSkusForClient(c.id));
    return forkJoin(requests).pipe(
      map(results => results.reduce((acc, val) => acc.concat(val), [])),
      tap(allSkus => {
        this.items.set(allSkus);
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private loadSkusForClient(clientId: string): Observable<ProductSku[]> {
    return this.http.get<ApiResponse<ProductSkuResponse[]>>(
      `${environment.apiBaseUrl}/api/v1/product-skus?clientId=${clientId}`
    ).pipe(
      map(response => (response.success && response.data) ? response.data.map(dto => this.mapDtoToItem(dto)) : []),
      catchError(() => of([])) // Prevenir que falle todo si un cliente falla
    );
  }

  /**
   * Crea un SKU en el Backend.
   */
  create(sku: Omit<ProductSku, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'clientName'>): Observable<ApiResponse<ProductSkuResponse>> {
    const payload: CreateProductSkuRequest = {
      clientId: sku.clientId,
      code: sku.code,
      name: sku.name,
      description: sku.description,
      weight: sku.weight,
      unit: sku.unit
    };

    return this.http.post<ApiResponse<ProductSkuResponse>>(
      `${environment.apiBaseUrl}/api/v1/product-skus`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const newSku = this.mapDtoToItem(response.data);
          this.items.update(list => [...list, newSku]);
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Modifica un SKU en el Backend.
   */
  update(id: string, sku: Partial<ProductSku>): Observable<ApiResponse<ProductSkuResponse>> {
    const existing = this.items().find(s => s.id === id);
    if (!existing) {
      return throwError(() => new Error('SKU no encontrado localmente.'));
    }

    const payload: UpdateProductSkuRequest = {
      id: id,
      clientId: sku.clientId || existing.clientId,
      code: sku.code || existing.code,
      name: sku.name || existing.name,
      description: sku.description !== undefined ? sku.description : existing.description,
      weight: sku.weight !== undefined ? sku.weight : existing.weight,
      unit: sku.unit || existing.unit
    };

    return this.http.put<ApiResponse<ProductSkuResponse>>(
      `${environment.apiBaseUrl}/api/v1/product-skus`,
      payload
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          const updatedSku = this.mapDtoToItem(response.data);
          this.items.update(list => list.map(item => item.id === id ? updatedSku : item));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  /**
   * Elimina un SKU del Backend.
   */
  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(
      `${environment.apiBaseUrl}/api/v1/product-skus/${id}`
    ).pipe(
      tap(response => {
        if (response.success) {
          this.items.update(list => list.filter(item => item.id !== id));
        }
      }),
      catchError((error: HttpErrorResponse) => this.handleError(error))
    );
  }

  private mapDtoToItem(dto: ProductSkuResponse): ProductSku {
    return {
      id: dto.id,
      clientId: dto.clientId,
      clientName: dto.clientName,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      weight: dto.weight,
      unit: dto.unit,
      version: dto.version,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
