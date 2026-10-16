/**
 * @file security-gate-api.service.ts
 * @description Servicio API para la comunicación real de la Terminal RF con el backend Spring Boot (/api/v1/security-gate).
 * Reemplaza cualquier mock o buffer en memoria conectando la Caseta directamente con la BD y la Consola Admin.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthState } from '@4guard/shared-core';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface SecurityGatePass {
  id: string;
  token: string;
  organizationId: string;
  branchId: string;
  status: 'PENDING_DRIVER' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED';
  operationType: 'CARGA' | 'DESCARGA' | 'INBOUND' | 'OUTBOUND';
  clientId?: string;
  clientCode?: string;
  clientName?: string;
  carrierId?: string;
  carrierLineCode?: string;
  carrierLine?: string;
  carrierName?: string;
  driverName?: string;
  driverLicense?: string;
  driverPhone?: string;
  transportType?: string;
  noEcoTractor?: string;
  noEcoCaja?: string;
  ecoNumber?: string;
  tractorPlates?: string;
  boxPlates?: string;
  boxDimensions?: string;
  sealNumbers?: string[];
  docNumber?: string;
  docDate?: string;
  receptionTime?: string;
  departureTime?: string;
  checklistData?: any;
  observations?: string;
  driverSignature?: string;
  rampId?: string;
  rampNumber?: number;
  rampCode?: string;
  generatedFolio?: string;
  processedBy?: string;
  processedAt?: string;
  exitObservations?: string;
  exitSealNumbers?: string[];
  guardNotes?: string;
  exitedBy?: string;
  exitedAt?: string;
  warehouseStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isReadyForExit?: boolean;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SecurityGateApiService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthState);

  private readonly baseUrl = '/api/v1/security-gate';

  private static readonly DEFAULT_ORG_ID = 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
  private static readonly DEFAULT_BRANCH_ID = 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

  private getOrgId(): string {
    const user = this.authState.user() as any;
    if (user?.organizationId && user.organizationId.length === 36 && user.organizationId !== '44444444-4444-4444-4444-444444444444') {
      return user.organizationId;
    }
    try {
      const sessionStr = localStorage.getItem('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.organizationId && session.organizationId.length === 36) return session.organizationId;
      }
      const authUserStr = localStorage.getItem('auth_user') || localStorage.getItem('user');
      if (authUserStr) {
        const u = JSON.parse(authUserStr);
        if (u.organizationId && u.organizationId.length === 36) return u.organizationId;
      }
    } catch {}
    return SecurityGateApiService.DEFAULT_ORG_ID;
  }

  private getBranchId(): string | undefined {
    const user = this.authState.user() as any;
    const branch = user?.branchId;
    // Solo enviar si es un UUID válido de 36 caracteres y no un slug como 'BR-MTY-01'
    if (branch && branch.length === 36 && !branch.startsWith('BR-')) {
      return branch;
    }
    return undefined;
  }

  /**
   * Obtiene la lista de pases activos (en espera o con auto-registro enviado por el chofer).
   */
  getActivePasses(): Observable<SecurityGatePass[]> {
    let params = new HttpParams().set('organizationId', this.getOrgId());
    const branch = this.getBranchId();
    if (branch) params = params.set('branchId', branch);

    return this.http.get<ApiResponse<SecurityGatePass[]>>(`${this.baseUrl}/passes/active`, { params }).pipe(
      map(res => res?.data || []),
      catchError(err => {
        console.warn('[SecurityGateApiService] Error obteniendo pases activos:', err);
        return of([]);
      })
    );
  }

  /**
   * Obtiene la lista de vehículos actualmente en patio/andenes desde la Base de Datos.
   */
  getInYardPasses(): Observable<SecurityGatePass[]> {
    let params = new HttpParams().set('organizationId', this.getOrgId());
    const branch = this.getBranchId();
    if (branch) params = params.set('branchId', branch);

    return this.http.get<ApiResponse<SecurityGatePass[]>>(`${this.baseUrl}/passes/in-yard`, { params }).pipe(
      map(res => res?.data || []),
      catchError(err => {
        console.warn('[SecurityGateApiService] Error obteniendo vehículos en patio:', err);
        return of([]);
      })
    );
  }

  /**
   * Obtiene el histórico de salidas para auditoría y reimpresión de F01.
   */
  getHistoryPasses(search?: string): Observable<SecurityGatePass[]> {
    let params = new HttpParams().set('organizationId', this.getOrgId());
    const branch = this.getBranchId();
    if (branch) params = params.set('branchId', branch);
    if (search) params = params.set('search', search);

    return this.http.get<ApiResponse<SecurityGatePass[]>>(`${this.baseUrl}/passes/history`, { params }).pipe(
      map(res => res?.data || []),
      catchError(err => {
        console.warn('[SecurityGateApiService] Error obteniendo historial de caseta:', err);
        return of([]);
      })
    );
  }

  /**
   * Genera un nuevo pase QR oficial en el backend.
   */
  generatePass(payload: {
    operationType: 'CARGA' | 'DESCARGA';
    clientName?: string;
    carrierLine?: string;
    driverName?: string;
    driverPhone?: string;
    tractorPlates?: string;
    docNumber?: string;
  }): Observable<SecurityGatePass> {
    const body = {
      organizationId: this.getOrgId(),
      branchId: this.getBranchId() || '22222222-2222-2222-2222-222222222222',
      ...payload
    };

    return this.http.post<ApiResponse<SecurityGatePass>>(`${this.baseUrl}/passes/generate`, body).pipe(
      map(res => res.data)
    );
  }

  /**
   * Valida y autoriza formalmente la entrada a planta en el WMS (Check-In F01 Oficial).
   */
  completeCheckin(token: string, body: any): Observable<SecurityGatePass> {
    return this.http.post<ApiResponse<SecurityGatePass>>(`${this.baseUrl}/passes/${token}/complete`, body).pipe(
      map(res => res.data)
    );
  }

  /**
   * Registra la salida oficial de la planta y cierre de pase en la BD (Check-Out).
   */
  checkOut(token: string, body: {
    departureTime?: string;
    exitObservations?: string;
    exitSealNumbers?: string[];
    guardNotes?: string;
  }): Observable<SecurityGatePass> {
    return this.http.post<ApiResponse<SecurityGatePass>>(`${this.baseUrl}/passes/${token}/check-out`, body).pipe(
      map(res => res.data)
    );
  }

  /**
   * Descarta o cancela un pase digital no utilizado.
   */
  deletePass(passId: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/passes/${passId}`).pipe(
      map(() => void 0)
    );
  }

  /**
   * Obtiene los catálogos oficiales de caseta desde la Base de Datos (Clientes, Transportistas, Tipos, Medidas).
   */
  getPublicCatalogs(): Observable<{
    clients: string[];
    carrierLines: string[];
    transportTypes: string[];
    boxDimensions: string[];
  }> {
    const orgId = this.getOrgId();
    const params = new HttpParams().set('organizationId', orgId);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/public/catalogs`, { params }).pipe(
      map(res => {
        const raw = res?.data || {};
        const clientsRaw: any[] = raw.clients || [];
        const carriersRaw: any[] = raw.carriers || raw.carrierLines || [];

        const clients = clientsRaw.map(c => typeof c === 'string' ? c : (c.tradeName || c.name || c.code)).filter(Boolean);
        const carrierLines = carriersRaw.map(c => typeof c === 'string' ? c : (c.tradeName || c.name || c.code)).filter(Boolean);

        return {
          clients: clients.length > 0 ? clients : [],
          carrierLines: carrierLines.length > 0 ? carrierLines : [],
          transportTypes: raw.transportTypes || [],
          boxDimensions: raw.boxDimensions || []
        };
      }),
      catchError(err => {
        console.warn('[SecurityGateApiService] Error obteniendo catálogos públicos:', err);
        return of({
          clients: [],
          carrierLines: [],
          transportTypes: [],
          boxDimensions: []
        });
      })
    );
  }
}
