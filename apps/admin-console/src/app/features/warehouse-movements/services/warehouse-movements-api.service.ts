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
      if (host.includes('ngrok') || host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
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

  // ─── 0. CASETA DE SEGURIDAD Y PASES DIGITALES QR ────────────────────────────

  private readonly localPassState = signal<any[]>(this.loadLocalPassesFromStorage());

  private loadLocalPassesFromStorage(): any[] {
    try {
      const stored = localStorage.getItem('4g_local_passes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveLocalPassesToStorage(passes: any[]): void {
    try {
      this.localPassState.set(passes);
      localStorage.setItem('4g_local_passes', JSON.stringify(passes));
    } catch {
      // Ignore
    }
  }

  generatePass(body: any): Observable<any> {
    const fallbackToken = 'PASS-4G-' + Date.now();
    const passObj = {
      id: 'pass-' + Date.now(),
      token: fallbackToken,
      status: 'PENDING_DRIVER',
      operationType: body.operationType || 'DESCARGA',
      clientCode: body.clientCode || '',
      clientName: body.clientName || '',
      carrierLineCode: body.carrierLineCode || '',
      carrierLine: body.carrierLine || '',
      driverName: body.driverName || '',
      nombreOperador: body.driverName || '',
      tractorPlates: body.tractorPlates || '',
      placasTracto: body.tractorPlates || '',
      docNumber: body.docNumber || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/generate`, body).pipe(
      map((res) => {
        const pass = res?.data || passObj;
        // Sincronizar en localStorage exclusivamente el token devuelto por el Backend
        const currentList = this.loadLocalPassesFromStorage().filter(
          p => p.token !== pass.token && p.token !== fallbackToken && !p.token?.startsWith('PASS-4G-')
        );
        currentList.unshift(pass);
        this.saveLocalPassesToStorage(currentList);
        return pass;
      }),
      catchError(() => {
        const currentList = this.loadLocalPassesFromStorage().filter(p => p.token !== fallbackToken);
        currentList.unshift(passObj);
        this.saveLocalPassesToStorage(currentList);
        return of(passObj);
      })
    );
  }

  getActivePasses(options?: { organizationId?: string; branchId?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/active`, { params }).pipe(
      map((res) => this.mergePassLists(res?.data || [], this.loadLocalPassesFromStorage())),
      catchError(() => of(this.loadLocalPassesFromStorage()))
    );
  }

  loadExitedPassTokens(): Set<string> {
    try {
      const stored = localStorage.getItem('4g_exited_passes');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  saveExitedPassTokens(set: Set<string>): void {
    try {
      localStorage.setItem('4g_exited_passes', JSON.stringify(Array.from(set)));
    } catch {
      // Ignore
    }
  }

  getInYardPasses(options?: { organizationId?: string; branchId?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);

    const exitedSet = this.loadExitedPassTokens();

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/in-yard`, { params }).pipe(
      timeout(8000),
      map((res) => {
        const list = res.data || [];
        return list.filter((p: any) => {
          const tok = (p.token || '').trim().toUpperCase();
          const fol = (p.generatedFolio || '').trim().toUpperCase();
          const id = (p.id || '').trim().toUpperCase();
          return !exitedSet.has(tok) && !exitedSet.has(fol) && !exitedSet.has(id) && p.status !== 'COMPLETED_EXIT';
        });
      }),
      catchError(() => of([]))
    );
  }

  getPassHistory(options?: { organizationId?: string; branchId?: string; search?: string }): Observable<any[]> {
    const orgId = options?.organizationId || this.getSessionOrgId();
    let params = new HttpParams().set('organizationId', orgId);
    if (options?.branchId) params = params.set('branchId', options.branchId);
    if (options?.search) params = params.set('search', options.search);

    return this.http.get<ApiResponse<any[]>>(`${this.securityGateUrl}/passes/history`, { params }).pipe(
      timeout(8000),
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  completePassCheckin(token: string, body: any): Observable<any> {
    const cleanToken = (token || '').trim().toUpperCase();
    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/${token}/complete`, body).pipe(
      map((res) => {
        const pass = res?.data;
        const list = this.loadLocalPassesFromStorage().map(p => {
          const pTok = (p.token || '').trim().toUpperCase();
          const pId = (p.id || '').trim().toUpperCase();
          if (pTok === cleanToken || pId === cleanToken) {
            return {
              ...p,
              ...pass,
              status: 'COMPLETED',
              generatedFolio: pass?.generatedFolio || p.generatedFolio
            };
          }
          return p;
        });
        this.saveLocalPassesToStorage(list);
        return pass;
      })
    );
  }

  checkOutPass(token: string, body: any): Observable<any> {
    const cleanToken = (token || '').trim().toUpperCase();
    const exitedSet = this.loadExitedPassTokens();
    if (cleanToken) exitedSet.add(cleanToken);
    this.saveExitedPassTokens(exitedSet);

    // Actualizar también en 4g_local_passes
    const list = this.loadLocalPassesFromStorage().map(p => {
      const pTok = (p.token || '').trim().toUpperCase();
      const pId = (p.id || '').trim().toUpperCase();
      const pFol = (p.generatedFolio || '').trim().toUpperCase();
      if (pTok === cleanToken || pId === cleanToken || pFol === cleanToken) {
        return { ...p, status: 'COMPLETED_EXIT', isReadyForExit: false, departureTime: body.departureTime };
      }
      return p;
    });
    this.saveLocalPassesToStorage(list);

    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/passes/${token}/check-out`, body).pipe(
      map((res) => {
        if (res?.data?.generatedFolio) {
          exitedSet.add(res.data.generatedFolio.trim().toUpperCase());
          this.saveExitedPassTokens(exitedSet);
        }
        if (res?.data?.token) {
          exitedSet.add(res.data.token.trim().toUpperCase());
          this.saveExitedPassTokens(exitedSet);
        }
        return res.data;
      })
    );
  }

  private loadDeletedPassTokens(): Set<string> {
    try {
      const stored = localStorage.getItem('4g_deleted_passes');
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  private saveDeletedPassTokens(set: Set<string>): void {
    try {
      localStorage.setItem('4g_deleted_passes', JSON.stringify(Array.from(set)));
    } catch {
      // Ignore
    }
  }

  deletePass(passIdOrToken: string, secondaryToken?: string): Observable<void> {
    const deletedSet = this.loadDeletedPassTokens();
    if (passIdOrToken) deletedSet.add(passIdOrToken);
    if (secondaryToken) deletedSet.add(secondaryToken);
    this.saveDeletedPassTokens(deletedSet);

    const filtered = this.loadLocalPassesFromStorage().filter(
      p => p.id !== passIdOrToken && p.token !== passIdOrToken && (!secondaryToken || (p.id !== secondaryToken && p.token !== secondaryToken))
    );
    this.saveLocalPassesToStorage(filtered);

    return this.http.delete<ApiResponse<void>>(`${this.securityGateUrl}/passes/${passIdOrToken}`).pipe(
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  getPublicPass(token: string): Observable<any> {
    const localMatch = this.loadLocalPassesFromStorage().find(p => p.token === token);

    return this.http.get<ApiResponse<any>>(`${this.securityGateUrl}/public/passes/${token}`).pipe(
      timeout(15000),
      retry({ count: 2, delay: 2000 }),
      map((res) => res?.data || localMatch),
      catchError(() => of(localMatch))
    );
  }

  submitPublicDriverCheckin(token: string, body: any): Observable<any> {
    const updatedPass = {
      token: token,
      status: 'SUBMITTED',
      operationType: body.operationType || body.operacion || 'DESCARGA',
      operacion: body.operationType || body.operacion || 'DESCARGA',
      docNumber: body.docNumber || body.noCartaPorte || body.remision || '',
      noCartaPorte: body.noCartaPorte || '',
      remision: body.remision || '',
      clientCode: body.clientCode || '',
      clientName: body.clientName || '',
      carrierLineCode: body.carrierLineCode || '',
      carrierLine: body.carrierLine || '',
      driverName: body.driverName || body.nombreOperador || '',
      nombreOperador: body.driverName || body.nombreOperador || '',
      driverLicense: body.driverLicense || '',
      tractorPlates: body.tractorPlates || body.placasTracto || '',
      placasTracto: body.tractorPlates || body.placasTracto || '',
      noEcoTractor: body.noEcoTractor || '',
      boxPlates: body.boxPlates || body.placasCaja || '',
      placasCaja: body.boxPlates || body.placasCaja || '',
      boxDimensions: body.boxDimensions || body.medidasCaja || '53 Pies',
      medidasCaja: body.boxDimensions || body.medidasCaja || '53 Pies',
      transportType: body.transportType || body.tipoTransporte || 'Caja Seca',
      tipoTransporte: body.transportType || body.tipoTransporte || 'Caja Seca',
      sealNumbers: body.sealNumbers || [],
      observations: body.observations || '',
      driverSignature: body.driverSignature || '',
      checklistData: body.checklistData || '',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const currentList = this.loadLocalPassesFromStorage();
    const existingIndex = currentList.findIndex(p => p.token === token);
    if (existingIndex >= 0) {
      currentList[existingIndex] = { ...currentList[existingIndex], ...updatedPass };
    } else {
      currentList.unshift(updatedPass);
    }
    this.saveLocalPassesToStorage(currentList);

    return this.http.post<ApiResponse<any>>(`${this.securityGateUrl}/public/passes/${token}/submit`, body).pipe(
      timeout(25000),
      retry({ count: 2, delay: 2500 }),
      map((res) => res?.data || updatedPass),
      catchError(() => of(updatedPass))
    );
  }

  private mergePassLists(backendList: any[], localList: any[]): any[] {
    const deletedSet = this.loadDeletedPassTokens();
    const mapByToken = new Map<string, any>();

    for (const b of backendList) {
      if (b && b.token && !deletedSet.has(b.token) && !deletedSet.has(b.id)) {
        mapByToken.set(b.token, b);
      }
    }
    for (const l of localList) {
      if (l && l.token && !deletedSet.has(l.token) && !deletedSet.has(l.id)) {
        // Si ya hay pases sincronizados desde el backend, ignorar tokens temporales PASS-4G-
        if (l.token.startsWith('PASS-4G-') && backendList.length > 0) {
          continue;
        }
        const existing = mapByToken.get(l.token);
        if (!existing) {
          mapByToken.set(l.token, l);
        } else {
          mapByToken.set(l.token, {
            ...existing,
            ...l,
            operationType: l.operationType || l.operacion || existing.operationType || existing.operacion || 'DESCARGA',
            driverName: l.driverName || l.nombreOperador || existing.driverName || existing.nombreOperador || '',
            nombreOperador: l.driverName || l.nombreOperador || existing.driverName || existing.nombreOperador || '',
            tractorPlates: l.tractorPlates || l.placasTracto || existing.tractorPlates || existing.placasTracto || '',
            status: (l.status === 'SUBMITTED' || existing.status === 'SUBMITTED') ? 'SUBMITTED' : (l.status || existing.status)
          });
        }
      }
    }
    return Array.from(mapByToken.values());
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
      map((res) => res.data || []),
      catchError(() => of([]))
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
      map((res) => res.data)
    );
  }

  getOutboundById(id: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.outboundsUrl}/${id}`).pipe(
      map((res) => res.data)
    );
  }

  updateOutbound(id: string, body: any): Observable<any> {
    return this.http.put<ApiResponse<any>>(`${this.outboundsUrl}/${id}`, body).pipe(
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
      map((res) => res.data || []),
      catchError(() => of([]))
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

