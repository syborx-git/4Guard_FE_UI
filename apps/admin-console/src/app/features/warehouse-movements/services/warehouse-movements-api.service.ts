/**
 * @file warehouse-movements-api.service.ts
 * @description Servicio HTTP para el módulo de Movimientos de Almacén (4GUARD WMS).
 * Conecta los 3 submódulos (Recepción, Traspasos, Salidas) con los endpoints REST de Spring Boot.
 * ADR-007: Cero Mocks en producción.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

const DEFAULT_ORG_ID = 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
const DEFAULT_BRANCH_ID = 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

@Injectable({
  providedIn: 'root',
})
export class WarehouseMovementsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly receptionsUrl = `${this.baseUrl}/api/v1/warehouse-receptions`;
  private readonly transfersUrl = `${this.baseUrl}/api/v1/warehouse-transfers`;
  private readonly outboundsUrl = `${this.baseUrl}/api/v1/warehouse-outbounds`;

  // Signals globales de estado de red
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // ─── SESIÓN / ORGANIZACIÓN ──────────────────────────────────────────────────

  getSessionOrg(): { organizationId: string; branchId: string } {
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.user?.organizationId) {
          return {
            organizationId: session.user.organizationId,
            branchId: session.user.branchId || DEFAULT_BRANCH_ID,
          };
        }
      }
    } catch {
      // Fallback
    }
    return { organizationId: DEFAULT_ORG_ID, branchId: DEFAULT_BRANCH_ID };
  }

  getSessionOrgId(): string {
    return this.getSessionOrg().organizationId;
  }

  // ─── 1. RECEPCIONES DE ALMACÉN (F01) ────────────────────────────────────────

  createCheckIn(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/check-in`, body).pipe(
      map((res) => res.data)
    );
  }

  updateReceptionParameters(id: string, body: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.receptionsUrl}/${id}/parameters`, body).pipe(
      map((res) => res.data)
    );
  }

  getReceptionById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.receptionsUrl}/${id}`).pipe(
      map((res) => res.data)
    );
  }

  getReceptions(options?: { organizationId?: string; branchId?: string; status?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.status && options.status !== 'ALL') params = params.set('status', options.status);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(this.receptionsUrl, { params }).pipe(
      map((res) => res.data || [])
    );
  }

  addReceptionPallets(receptionId: string, pallets: any[]): Observable<any[]> {
    return this.http.post<ApiResponse<any[]>>(`${this.receptionsUrl}/${receptionId}/pallets`, { pallets }).pipe(
      map((res) => res.data || [])
    );
  }

  updatePallet(receptionId: string, palletId: string, body: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.receptionsUrl}/${receptionId}/pallets/${palletId}`, body).pipe(
      map((res) => res.data)
    );
  }

  deletePallet(receptionId: string, palletId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.receptionsUrl}/${receptionId}/pallets/${palletId}`).pipe(
      map(() => undefined)
    );
  }

  completeReception(id: string, body: { leaderUsername: string; leaderPassword: string; observations?: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/${id}/complete`, body).pipe(
      map((res) => res.data)
    );
  }

  cancelReception(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/${id}/cancel`, body).pipe(
      map((res) => res.data)
    );
  }

  changeRemision(id: string, body: { newDocNumber: string; reason: string }): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.receptionsUrl}/${id}/change-remision`, body).pipe(
      map((res) => res.data)
    );
  }

  getReceptionAudit(id: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.receptionsUrl}/${id}/audit`).pipe(
      map((res) => res.data || [])
    );
  }

  // ─── 2. CAMBIO DE ALMACÉN (TRAPASOS) ────────────────────────────────────────

  createTransfer(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(this.transfersUrl, body).pipe(
      map((res) => res.data)
    );
  }

  getTransferById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.transfersUrl}/${id}`).pipe(
      map((res) => res.data)
    );
  }

  getTransfers(options?: { organizationId?: string; branchId?: string; status?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.status && options.status !== 'ALL') params = params.set('status', options.status);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(this.transfersUrl, { params }).pipe(
      map((res) => res.data || [])
    );
  }

  cancelTransfer(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.transfersUrl}/${id}/cancel`, body).pipe(
      map((res) => res.data)
    );
  }

  getTransferAudit(id: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.transfersUrl}/${id}/audit`).pipe(
      map((res) => res.data || [])
    );
  }

  // ─── 3. SALIDAS DE ALMACÉN (OUTBOUND) ───────────────────────────────────────

  createOutbound(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(this.outboundsUrl, body).pipe(
      map((res) => res.data)
    );
  }

  getOutboundById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.outboundsUrl}/${id}`).pipe(
      map((res) => res.data)
    );
  }

  getOutbounds(options?: { organizationId?: string; branchId?: string; status?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.status && options.status !== 'ALL') params = params.set('status', options.status);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(this.outboundsUrl, { params }).pipe(
      map((res) => res.data || [])
    );
  }

  cancelOutbound(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.outboundsUrl}/${id}/cancel`, body).pipe(
      map((res) => res.data)
    );
  }

  getInventoryBatches(options?: { organizationId?: string; branchId?: string; clientId?: string; skuId?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.clientId) params = params.set('clientId', options.clientId);
    if (options?.skuId) params = params.set('skuId', options.skuId);

    return this.http.get<ApiResponse<any[]>>(`${this.outboundsUrl}/inventory-batches`, { params }).pipe(
      map((res) => res.data || [])
    );
  }

  getOutboundAudit(id: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.outboundsUrl}/${id}/audit`).pipe(
      map((res) => res.data || [])
    );
  }

  // ─── 4. CATÁLOGOS BASE DE WMS ───────────────────────────────────────────────

  getCarriers(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/api/v1/carriers?organizationId=${id}`).pipe(
      map((res) => res.data || [])
    );
  }

  getClients(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/api/v1/clients?organizationId=${id}&status=ACTIVE`).pipe(
      map((res) => res.data || [])
    );
  }

  getForkliftOperators(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/api/v1/forklift-operators?organizationId=${id}&status=ACTIVO`).pipe(
      map((res) => res.data || [])
    );
  }

  getLocations(branchId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/api/v1/locations`;
    if (branchId) url += `?branchId=${branchId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map((res) => res.data || [])
    );
  }

  getProductSkus(clientId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/api/v1/product-skus`;
    if (clientId) url += `?clientId=${clientId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map((res) => res.data || [])
    );
  }

  getSuppliers(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/api/v1/suppliers?organizationId=${id}&page=0&size=1000&sortBy=updatedAt&sortDir=DESC`).pipe(
      map((res) => {
        if (!res || !res.data) return [];
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.data.content)) return res.data.content;
        return [];
      })
    );
  }
}
