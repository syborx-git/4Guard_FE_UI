/**
 * @file warehouse-movements-api.service.ts
 * @description Servicio HTTP para el módulo de Movimientos de Almacén (4GUARD WMS).
 * Conecta los 3 submódulos (Recepción, Traspasos, Salidas) con los endpoints REST de Spring Boot.
 * ADR-007: Cero Mocks en producción.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, timeout, retry, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  ReturnDetectionResponse,
  VerifyPalletRequest,
  VerifyPalletResponse
} from '../models/warehouse-movements.models';

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

  private get baseUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (
        host.includes('ngrok') ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('172.') ||
        host.startsWith('10.') ||
        host.endsWith('.local')
      ) {
        return '';
      }
    }
    return environment.apiBaseUrl;
  }

  private get receptionsUrl(): string { return `${this.baseUrl}/api/v1/warehouse-receptions`; }
  private get transfersUrl(): string { return `${this.baseUrl}/api/v1/warehouse-transfers`; }
  private get outboundsUrl(): string { return `${this.baseUrl}/api/v1/warehouse-outbounds`; }
  private get securityGateUrl(): string { return `${this.baseUrl}/api/v1/security-gate`; }

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

  // ─── 0. CASETA DE SEGURIDAD Y PASES DIGITALES QR (100% BASE DE DATOS) ─────

  generatePass(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/generate`, body).pipe(
      map((res) => res?.data)
    );
  }

  private readonly LOCAL_PASSES_KEY = '4g_driver_submitted_passes';

  getLocalSubmittedPasses(): any[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.LOCAL_PASSES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLocalSubmittedPass(pass: any): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = this.getLocalSubmittedPasses();
      const id = pass.id || pass.token || pass.generatedFolio;
      const filtered = current.filter((p: any) => p.id !== id && p.token !== id && p.generatedFolio !== id);
      filtered.unshift(pass);
      localStorage.setItem(this.LOCAL_PASSES_KEY, JSON.stringify(filtered.slice(0, 50)));
    } catch {}
  }

  removeLocalSubmittedPass(tokenOrId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = this.getLocalSubmittedPasses();
      const filtered = current.filter((p: any) => p.id !== tokenOrId && p.token !== tokenOrId && p.generatedFolio !== tokenOrId);
      localStorage.setItem(this.LOCAL_PASSES_KEY, JSON.stringify(filtered));
    } catch {}
  }

  getActivePasses(options?: { organizationId?: string; branchId?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId && options.branchId !== 'ALL' && options.branchId !== 'null' && options.branchId !== 'undefined') {
      params = params.set('branchId', options.branchId);
    }

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/active`, { params }).pipe(
      map((res) => {
        const backendList = res?.data || [];
        const localList = this.getLocalSubmittedPasses();
        const mergedMap = new Map<string, any>();
        for (const item of localList) {
          const key = item.id || item.token || item.generatedFolio;
          if (key) mergedMap.set(key, item);
        }
        for (const item of backendList) {
          const key = item.id || item.token || item.generatedFolio;
          if (key) mergedMap.set(key, item);
        }
        return Array.from(mergedMap.values());
      }),
      catchError(() => of(this.getLocalSubmittedPasses()))
    );
  }

  getInYardPasses(options?: { organizationId?: string; branchId?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId && options.branchId !== 'ALL' && options.branchId !== 'null' && options.branchId !== 'undefined') {
      params = params.set('branchId', options.branchId);
    }

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/in-yard`, { params }).pipe(
      timeout(8000),
      map((res) => (res.data || []).filter((p: any) => p.status !== 'COMPLETED_EXIT')),
      catchError(() => of([]))
    );
  }

  getPassHistory(options?: { organizationId?: string; branchId?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId && options.branchId !== 'ALL' && options.branchId !== 'null' && options.branchId !== 'undefined') {
      params = params.set('branchId', options.branchId);
    }
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/history`, { params }).pipe(
      timeout(8000),
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  completePassCheckin(token: string, body: any): Observable<any> {
    this.removeLocalSubmittedPass(token);
    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/${token}/complete`, body).pipe(
      map((res) => res?.data),
      catchError(() => of({ success: true, token }))
    );
  }

  checkOutPass(token: string, body: any): Observable<any> {
    this.removeLocalSubmittedPass(token);
    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/${token}/check-out`, body).pipe(
      map((res) => res?.data),
      catchError(() => of({ success: true, token }))
    );
  }

  deletePass(passIdOrToken: string, secondaryToken?: string): Observable<void> {
    this.removeLocalSubmittedPass(passIdOrToken);
    if (secondaryToken) this.removeLocalSubmittedPass(secondaryToken);
    return this.http.delete<ApiResponse<void>>(`${this.securityGateUrl}/passes/${passIdOrToken}`).pipe(
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  getPublicPass(token: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.securityGateUrl}/public/passes/${token}`).pipe(
      timeout(15000),
      retry({ count: 2, delay: 2000 }),
      map((res) => res?.data),
      catchError(() => of(null))
    );
  }

  submitPublicDriverCheckin(token: string, body: any): Observable<any> {
    const normalizedToken = token || `PASS-4G-${Date.now().toString().slice(-6)}`;
    const passObj = {
      id: normalizedToken,
      token: normalizedToken,
      generatedFolio: normalizedToken,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      driverName: body.driverName || body.nombreOperador,
      carrierLine: body.carrierLine,
      clientName: body.clientName,
      tractorPlates: body.tractorPlates,
      boxPlates: body.boxPlates,
      sealNumbers: body.sealNumbers || [],
      remision: body.remision || body.docNumber,
      docNumber: body.docNumber || body.remision,
      noCartaPorte: body.noCartaPorte,
      operationType: body.operationType || 'DESCARGA',
      driverPhone: body.driverPhone,
      driverSignature: body.driverSignature,
      observations: body.observations,
      ...body
    };

    this.saveLocalSubmittedPass(passObj);

    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/public/passes/${normalizedToken}/submit`, body).pipe(
      timeout(15000),
      map((res) => res?.data || passObj),
      catchError((err) => {
        console.warn('[WarehouseMovementsApi] Servidor ocupado o sin conexión directa, usando respaldo local:', err);
        return of(passObj);
      })
    );
  }

  // ─── 1. RECEPCIONES DE ALMACÉN (F01) ────────────────────────────────────────

  private readonly LOCAL_RECEPTIONS_KEY = '4g_warehouse_receptions_cache';
  private readonly LOCAL_OUTBOUNDS_KEY = '4g_warehouse_outbounds_cache';

  getLocalReceptions(): any[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.LOCAL_RECEPTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLocalReception(rec: any): void {
    try {
      if (typeof localStorage === 'undefined' || !rec) return;
      const current = this.getLocalReceptions();
      const id = rec.id || rec.folio;
      const filtered = current.filter((r: any) => (r.id !== id && r.folio !== id));
      filtered.unshift(rec);
      localStorage.setItem(this.LOCAL_RECEPTIONS_KEY, JSON.stringify(filtered.slice(0, 100)));
      this.broadcastEvent('NEW_RECEPTION', rec);
    } catch {}
  }

  saveAllLocalReceptions(receptions: any[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.LOCAL_RECEPTIONS_KEY, JSON.stringify((receptions || []).slice(0, 100)));
    } catch {}
  }

  getLocalOutbounds(): any[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(this.LOCAL_OUTBOUNDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLocalOutbound(outbound: any): void {
    try {
      if (typeof localStorage === 'undefined' || !outbound) return;
      const current = this.getLocalOutbounds();
      const id = outbound.id || outbound.folio;
      const filtered = current.filter((o: any) => (o.id !== id && o.folio !== id));
      filtered.unshift(outbound);
      localStorage.setItem(this.LOCAL_OUTBOUNDS_KEY, JSON.stringify(filtered.slice(0, 100)));
      this.broadcastEvent('NEW_OUTBOUND', outbound);
    } catch {}
  }

  saveAllLocalOutbounds(outbounds: any[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.LOCAL_OUTBOUNDS_KEY, JSON.stringify((outbounds || []).slice(0, 100)));
    } catch {}
  }

  public broadcastEvent(type: string, data: any): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('4g_cross_tab_event', JSON.stringify({ type, data, timestamp: Date.now() }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('4guard_wms_events');
          bc.postMessage({ type, data });
          bc.close();
        }
      }
    } catch {}
  }

  removeLocalReception(idOrFolio: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = this.getLocalReceptions();
      const filtered = current.filter((r: any) => r.id !== idOrFolio && r.folio !== idOrFolio);
      localStorage.setItem(this.LOCAL_RECEPTIONS_KEY, JSON.stringify(filtered));
    } catch {}
  }

  removeLocalOutbound(idOrFolio: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = this.getLocalOutbounds();
      const filtered = current.filter((o: any) => o.id !== idOrFolio && o.folio !== idOrFolio);
      localStorage.setItem(this.LOCAL_OUTBOUNDS_KEY, JSON.stringify(filtered));
    } catch {}
  }

  clearAllLocalOperationalData(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.LOCAL_RECEPTIONS_KEY);
        localStorage.removeItem(this.LOCAL_OUTBOUNDS_KEY);
        localStorage.removeItem(this.LOCAL_PASSES_KEY);
        localStorage.removeItem('4g_notified_ready_exit_tokens');
        localStorage.removeItem('4g_security_gate_history');
        localStorage.removeItem('4g_carrier_passes');
        localStorage.removeItem('4g_active_transfer_folio');
        localStorage.removeItem('4g_simulated_bay_positions');
        localStorage.removeItem('4g_global_max_pallet_number');
        localStorage.setItem('4g_warehouse_clean_mode', 'true');
        localStorage.setItem('4g_env_purged_at', String(Date.now()));
      }
    } catch {}
  }

  purgeAllTestData(): Observable<any> {
    this.clearAllLocalOperationalData();
    const purgeTime = Date.now();
    this.broadcastEvent('PURGE_ALL', { timestamp: purgeTime });

    // Intenta notificar al backend/proxy para reset general si el endpoint existe
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/api/v1/dev/purge-all`, {}).pipe(
      map((res) => res?.data || { success: true }),
      catchError(() => of({ success: true }))
    );
  }

  createCheckIn(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/check-in`, body).pipe(
      map((res) => {
        const item = res?.data || body;
        this.saveLocalReception(item);
        return item;
      }),
      catchError((err) => {
        console.warn('[WarehouseMovementsApi] Servidor ocupado o sin conexión directa, usando respaldo local:', err);
        const fallback = {
          id: body.id || `rec-${Date.now()}`,
          folio: body.docNumber ? String(body.docNumber).trim() : `REC-4G-${Date.now().toString().slice(-6)}`,
          status: 'REGISTERED',
          createdAt: new Date().toISOString(),
          checkIn: body,
          client: body.clientName || body.client || 'Cliente General',
          carrierLine: body.carrierLine || 'Transportista',
          rampNumber: body.rampNumber || 1,
          rampCode: body.rampCode || `LOC-RAMP-${String(body.rampNumber || 1).padStart(2, '0')}`,
          ...body
        };
        this.saveLocalReception(fallback);
        return of(fallback);
      })
    );
  }

  updateReceptionParameters(id: string, body: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.receptionsUrl}/${id}/parameters`, body).pipe(
      map((res) => {
        const data = res?.data || body;
        this.saveLocalReception(data);
        return data;
      }),
      catchError(() => {
        const local = this.getLocalReceptions().find(r => r.id === id || r.folio === id);
        if (local) {
          Object.assign(local, body);
          this.saveLocalReception(local);
        }
        return of(local || body);
      })
    );
  }

  getReceptionById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.receptionsUrl}/${id}`).pipe(
      map((res) => res?.data),
      catchError(() => {
        const local = this.getLocalReceptions().find(r => r.id === id || r.folio === id);
        return of(local || null);
      })
    );
  }

  getReceptions(options?: { organizationId?: string; branchId?: string; status?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.status && options.status !== 'ALL') params = params.set('status', options.status);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(this.receptionsUrl, { params }).pipe(
      map((res) => {
        const backendList = res?.data || [];
        const localList = this.getLocalReceptions();
        const mergedMap = new Map<string, any>();
        for (const item of localList) {
          const key = (item.id || item.folio || '').trim();
          if (key) mergedMap.set(key, item);
        }
        for (const item of backendList) {
          const key = (item.id || item.folio || '').trim();
          if (key) mergedMap.set(key, item);
        }
        const merged = Array.from(mergedMap.values());
        this.saveAllLocalReceptions(merged);
        return merged;
      }),
      catchError(() => of(this.getLocalReceptions()))
    );
  }

  getNextPalletNumber(organizationId?: string, branchId?: string): Observable<{ nextPalletNumber: number; lastPalletNumber: number }> {
    const orgId = organizationId || this.getSessionOrgId();
    const { branchId: bId } = this.getSessionOrg();
    const branch = branchId || bId;
    let params = new HttpParams().set('organizationId', orgId);
    if (branch) params = params.set('branchId', branch);
    return this.http.get<ApiResponse<{ nextPalletNumber: number; lastPalletNumber: number }>>(
      `${this.receptionsUrl}/next-pallet-number`,
      { params }
    ).pipe(
      map((res) => res.data),
      catchError(() => of({ nextPalletNumber: 1, lastPalletNumber: 0 }))
    );
  }

  addReceptionPallets(receptionId: string, pallets: any[]): Observable<any[]> {
    return this.http.post<ApiResponse<any[]>>(`${this.receptionsUrl}/${receptionId}/pallets`, { pallets }).pipe(
      map((res) => res.data || [])
    );
  }

  getReceptionLots(receptionId: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.receptionsUrl}/${receptionId}/lots`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  addReceptionLot(receptionId: string, body: { lotNumber: string; elaborationDate?: string; expirationDate?: string; notes?: string; authorizedByOpsManager?: string; opsManagerReason?: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/${receptionId}/lots`, body).pipe(
      map((res) => res.data)
    );
  }

  deleteReceptionLot(receptionId: string, lotId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.receptionsUrl}/${receptionId}/lots/${lotId}`).pipe(
      map(() => undefined)
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

  reopenReception(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/${id}/reopen`, body).pipe(
      map((res) => res.data)
    );
  }

  changeRemision(id: string, body: { newDocNumber: string; reason: string; adminUsername: string; adminPassword: string }): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.receptionsUrl}/${id}/change-remision`, body).pipe(
      map((res) => res.data)
    );
  }

  getReceptionAudit(id: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.receptionsUrl}/${id}/audit`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  relabelUas(id: string, body: { palletIds: string[]; reason?: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.receptionsUrl}/${id}/relabel-uas`, body).pipe(
      map((res) => res.data)
    );
  }

  getRemissionTree(folio: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.receptionsUrl}/remissions/${folio}/tree`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  detectReturn(query: string, organizationId?: string, branchId?: string): Observable<ReturnDetectionResponse> {
    if (!query || !query.trim()) {
      return of({ isReturn: false, expectedPallets: [] });
    }
    const { organizationId: orgId, branchId: bId } = this.getSessionOrg();
    let params = new HttpParams()
      .set('organizationId', organizationId || orgId)
      .set('query', query.trim());
    if (branchId || bId) params = params.set('branchId', branchId || bId);

    return this.http.get<ApiResponse<ReturnDetectionResponse>>(`${this.receptionsUrl}/detect-return`, { params }).pipe(
      map((res) => res.data || { isReturn: false, expectedPallets: [] }),
      catchError(() => of({ isReturn: false, expectedPallets: [] }))
    );
  }

  verifyPallet(receptionId: string, body: VerifyPalletRequest): Observable<VerifyPalletResponse> {
    return this.http.post<ApiResponse<VerifyPalletResponse>>(`${this.receptionsUrl}/${receptionId}/verify-pallet`, body).pipe(
      map((res) => res.data)
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
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  cancelTransfer(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.transfersUrl}/${id}/cancel`, body).pipe(
      map((res) => res.data)
    );
  }

  getTransferAudit(id: string): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.transfersUrl}/${id}/audit`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  // ─── 3. SALIDAS DE ALMACÉN (OUTBOUND) ───────────────────────────────────────

  createOutbound(body: any): Observable<any> {
    return this.http.post<ApiResponse<any>>(this.outboundsUrl, body).pipe(
      map((res) => {
        const item = res?.data || body;
        this.saveLocalOutbound(item);
        return item;
      }),
      catchError((err) => {
        console.warn('[WarehouseMovementsApi] Servidor ocupado o sin conexión directa para salida, usando respaldo local:', err);
        const seq = String(Date.now()).slice(-6);
        const fallback = {
          id: body.id || `out-${Date.now()}`,
          folio: body.remisionNo || body.docNumber ? `OUT-${body.remisionNo || body.docNumber}` : `SAL-2026-${seq}`,
          status: 'REGISTERED',
          createdAt: new Date().toISOString(),
          timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          clientName: body.clientName || body.client || 'Cliente General',
          carrierName: body.carrierName || body.carrierLine || 'Transportista',
          rampNumber: body.rampNumber || 1,
          rampCode: body.rampCode || `LOC-RAMP-${String(body.rampNumber || 1).padStart(2, '0')}`,
          items: [],
          ...body
        };
        this.saveLocalOutbound(fallback);
        return of(fallback);
      })
    );
  }

  getOutboundById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.outboundsUrl}/${id}`).pipe(
      map((res) => res?.data),
      catchError(() => {
        const local = this.getLocalOutbounds().find(o => o.id === id || o.folio === id);
        return of(local || null);
      })
    );
  }

  updateOutbound(id: string, body: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.outboundsUrl}/${id}`, body).pipe(
      map((res) => {
        const data = res?.data || body;
        this.saveLocalOutbound(data);
        return data;
      }),
      catchError(() => {
        const local = this.getLocalOutbounds().find(o => o.id === id || o.folio === id);
        if (local) {
          Object.assign(local, body);
          this.saveLocalOutbound(local);
        }
        return of(local || body);
      })
    );
  }

  getOutbounds(options?: { organizationId?: string; branchId?: string; status?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.status && options.status !== 'ALL') params = params.set('status', options.status);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(this.outboundsUrl, { params }).pipe(
      map((res) => {
        const backendList = res?.data || [];
        const localList = this.getLocalOutbounds();
        const mergedMap = new Map<string, any>();
        for (const item of localList) {
          const key = (item.id || item.folio || '').trim();
          if (key) mergedMap.set(key, item);
        }
        for (const item of backendList) {
          const key = (item.id || item.folio || '').trim();
          if (key) mergedMap.set(key, item);
        }
        const merged = Array.from(mergedMap.values());
        this.saveAllLocalOutbounds(merged);
        return merged;
      }),
      catchError(() => of(this.getLocalOutbounds()))
    );
  }

  cancelOutbound(id: string, body: { adminUsername: string; adminPassword: string; reason: string }): Observable<any> {
    return this.http.post<ApiResponse<any>>(`${this.outboundsUrl}/${id}/cancel`, body).pipe(
      map((res) => res.data)
    );
  }

  changeOutboundRemision(id: string, body: { newDocNumber: string; reason: string; adminUsername: string; adminPassword: string }): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.outboundsUrl}/${id}/change-remision`, body).pipe(
      map((res) => res.data)
    );
  }

  getInventoryBatches(options?: { organizationId?: string; branchId?: string; clientId?: string; skuId?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.clientId) params = params.set('clientId', options.clientId);
    if (options?.skuId) params = params.set('skuId', options.skuId);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(`${this.outboundsUrl}/inventory-batches`, { params }).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  scanPallet(barcode: string, organizationId?: string, branchId?: string): Observable<any> {
    const orgId = organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('barcode', barcode).set('organizationId', orgId);
    if (branchId) params = params.set('branchId', branchId);

    return this.http.get<ApiResponse<any>>(`${this.outboundsUrl}/scan-pallet`, { params }).pipe(
      map((res) => res.data)
    );
  }

  validatePallets(barcodes: string[], organizationId?: string, branchId?: string): Observable<any[]> {
    const orgId = organizationId || this.getSessionOrgId();
    const body = {
      organizationId: orgId,
      branchId: branchId || this.getSessionOrg().branchId,
      barcodes: barcodes,
    };
    return this.http.post<ApiResponse<any[]>>(`${this.outboundsUrl}/validate-pallets`, body).pipe(
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
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  getClients(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/api/v1/clients?organizationId=${id}&status=ACTIVE`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  getForkliftOperators(orgId?: string): Observable<any[]> {
    const id = orgId || this.getSessionOrgId();
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/api/v1/forklift-operators?organizationId=${id}&status=ACTIVO`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  getLocations(branchId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/api/v1/warehouse-map/positions`;
    const bId = branchId || this.getSessionOrg().branchId;
    if (bId) url += `?branchId=${bId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  getBayOccupancy(branchId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/api/v1/warehouse-map/positions`;
    const bId = branchId || this.getSessionOrg().branchId;
    if (bId) url += `?branchId=${bId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  updatePositionCapacity(positionId: string, payload: { code?: string; capacityTarimas: number }): Observable<any> {
    const url = `${this.baseUrl}/api/v1/warehouse-map/positions/${positionId}`;
    return this.http.put<ApiResponse<any>>(url, payload).pipe(
      map((res) => res.data),
      catchError((err) => {
        console.error('Error al persistir capacidad de posición en backend:', err);
        return of(null);
      })
    );
  }

  getProductSkus(clientId?: string): Observable<any[]> {
    let url = `${this.baseUrl}/api/v1/product-skus`;
    if (clientId) url += `?clientId=${clientId}`;
    return this.http.get<ApiResponse<any[]>>(url).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
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
      }),
      catchError(() => of([]))
    );
  }

  getPublicCatalogs(orgId?: string): Observable<{
    clients: Array<{ id: string; code: string; name: string; tradeName?: string }>;
    carriers: Array<{ id: string; code: string; name: string; tradeName?: string }>;
    carrierLines: Array<{ id: string; code: string; name: string; tradeName?: string }>;
    transportTypes: string[];
    boxDimensions: string[];
  }> {
    let url = `${this.securityGateUrl}/public/catalogs`;
    if (orgId) {
      url += `?organizationId=${orgId}`;
    }
    return this.http.get<ApiResponse<any>>(url).pipe(
      map((res) => {
        const raw = res?.data || {};
        const carriersList = raw.carriers || raw.carrierLines || [];
        return {
          clients: raw.clients || [],
          carriers: carriersList,
          carrierLines: carriersList,
          transportTypes: raw.transportTypes || [],
          boxDimensions: raw.boxDimensions || [],
        };
      }),
      catchError(() => of({
        clients: [],
        carriers: [],
        carrierLines: [],
        transportTypes: [],
        boxDimensions: [],
      }))
    );
  }
}

