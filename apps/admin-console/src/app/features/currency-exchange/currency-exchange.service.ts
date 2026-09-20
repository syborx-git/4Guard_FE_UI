import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Currency,
  ExchangeRate,
  LatestParitiesMatrix,
  ConvertCurrencyRequest,
  ConvertCurrencyResult,
  CurrencyAuditEntry,
  CreateCurrencyRequest,
  UpdateCurrencyRequest,
  UpdateCurrencyStatusRequest,
  CreateExchangeRateRequest,
  CurrencyStatus,
  BanxicoLiveRateData,
} from './currency-exchange.models';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  error?: {
    code: string;
    details?: string[];
  };
}

export interface ServiceResult<T> {
  data: T;
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CurrencyExchangeService {
  private readonly http = inject(HttpClient);

  private readonly currenciesUrl = `${environment.apiBaseUrl}/api/v1/currencies`;
  private readonly exchangeRatesUrl = `${environment.apiBaseUrl}/api/v1/exchange-rates`;
  private readonly auditUrl = `${environment.apiBaseUrl}/api/v1/currency-exchange/audit`;

  // ─── Estado interno (Signals reactivos conectados a base de datos) ────────
  private readonly _currencies = signal<Currency[]>([]);
  private readonly _exchangeRates = signal<ExchangeRate[]>([]);
  private readonly _latestMatrix = signal<LatestParitiesMatrix | null>(null);
  private readonly _auditEntries = signal<CurrencyAuditEntry[]>([]);

  // ─── Señales Públicas (solo lectura) ──────────────────────────────────────
  readonly currencies = this._currencies.asReadonly();
  readonly exchangeRates = this._exchangeRates.asReadonly();
  readonly latestMatrix = this._latestMatrix.asReadonly();
  readonly auditEntries = this._auditEntries.asReadonly();

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS REST HTTP — DIVISAS (/api/v1/currencies)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna todas las divisas persistidas en la BD (GET /api/v1/currencies). */
  getCurrencies(organizationId?: string): Observable<ServiceResult<Currency[]>> {
    let params = new HttpParams();
    if (organizationId) {
      params = params.set('organizationId', organizationId);
    }

    return this.http.get<ApiResponse<Currency[]>>(this.currenciesUrl, { params }).pipe(
      tap((res) => {
        if (res.success && Array.isArray(res.data)) {
          this._currencies.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data ?? [],
        message: res.message || 'Divisas cargadas con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Retorna el detalle de una divisa por ID desde la BD (GET /api/v1/currencies/{id}). */
  getCurrencyById(id: string): Observable<ServiceResult<Currency>> {
    return this.http.get<ApiResponse<Currency>>(`${this.currenciesUrl}/${id}`).pipe(
      map((res) => ({
        data: res.data,
        message: res.message || 'Detalle de divisa obtenido con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Crea y persiste una nueva divisa en PostgreSQL (POST /api/v1/currencies). */
  createCurrency(payload: CreateCurrencyRequest): Observable<ServiceResult<Currency>> {
    return this.http.post<ApiResponse<Currency>>(this.currenciesUrl, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._currencies.update((list) => [...list, res.data]);
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Divisa creada con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Actualiza metadatos de una divisa en la BD (PUT /api/v1/currencies/{id}). */
  updateCurrency(id: string, payload: UpdateCurrencyRequest): Observable<ServiceResult<Currency>> {
    return this.http.put<ApiResponse<Currency>>(`${this.currenciesUrl}/${id}`, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._currencies.update((list) => list.map((c) => (c.id === id ? res.data : c)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Divisa actualizada con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Cambia el estatus de una divisa en la BD (PATCH /api/v1/currencies/{id}/status). */
  updateCurrencyStatus(id: string, status: CurrencyStatus): Observable<ServiceResult<Currency>> {
    const body: UpdateCurrencyStatusRequest = { status };
    return this.http.patch<ApiResponse<Currency>>(`${this.currenciesUrl}/${id}/status`, body).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._currencies.update((list) => list.map((c) => (c.id === id ? res.data : c)));
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Estatus de divisa actualizado con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Asigna una divisa como Base Principal de la Organización en la BD (POST /api/v1/currencies/{id}/set-base). */
  setBaseCurrency(id: string): Observable<ServiceResult<Currency>> {
    return this.http.post<ApiResponse<Currency>>(`${this.currenciesUrl}/${id}/set-base`, {}).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._currencies.update((list) =>
            list.map((c) => ({
              ...c,
              isBase: c.id === id,
              updatedAt: c.id === id ? res.data.updatedAt : c.updatedAt,
            }))
          );
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Divisa base establecida con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS REST HTTP — TIPOS DE CAMBIO (/api/v1/exchange-rates)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Listar tipos de cambio históricos y vigentes desde la BD (GET /api/v1/exchange-rates). */
  getExchangeRates(filters?: {
    organizationId?: string;
    fromCode?: string;
    toCode?: string;
    date?: string;
  }): Observable<ServiceResult<ExchangeRate[]>> {
    let params = new HttpParams();
    if (filters?.organizationId) params = params.set('organizationId', filters.organizationId);
    if (filters?.fromCode) params = params.set('fromCode', filters.fromCode);
    if (filters?.toCode) params = params.set('toCode', filters.toCode);
    if (filters?.date) params = params.set('date', filters.date);

    return this.http.get<ApiResponse<ExchangeRate[]>>(this.exchangeRatesUrl, { params }).pipe(
      tap((res) => {
        if (res.success && Array.isArray(res.data)) {
          this._exchangeRates.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data ?? [],
        message: res.message || 'Lista de tipos de cambio recuperada con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Matriz de paridades vigentes vs divisa base (GET /api/v1/exchange-rates/latest). */
  getLatestParities(organizationId?: string): Observable<ServiceResult<LatestParitiesMatrix>> {
    let params = new HttpParams();
    if (organizationId) params = params.set('organizationId', organizationId);

    return this.http.get<ApiResponse<LatestParitiesMatrix>>(`${this.exchangeRatesUrl}/latest`, { params }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._latestMatrix.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Matriz de paridades obtenida con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Consulta la cotización oficial en tiempo real desde la API de Banxico SIE (GET /api/v1/exchange-rates/banxico/live/{seriesId}). */
  getBanxicoLiveRate(seriesId: string): Observable<ServiceResult<BanxicoLiveRateData>> {
    return this.http.get<ApiResponse<BanxicoLiveRateData>>(`${this.exchangeRatesUrl}/banxico/live/${seriesId}`).pipe(
      map((res) => ({
        data: res.data,
        message: res.message || 'Cotización oficial recuperada en tiempo real con éxito',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Forzar sincronización automática de paridades oficiales con Banxico SIE (POST /api/v1/exchange-rates/sync/banxico). */
  syncBanxicoRates(organizationId?: string): Observable<ServiceResult<ExchangeRate[]>> {
    let params = new HttpParams();
    if (organizationId) params = params.set('organizationId', organizationId);

    return this.http.post<ApiResponse<ExchangeRate[]>>(`${this.exchangeRatesUrl}/sync/banxico`, {}, { params }).pipe(
      tap((res) => {
        if (res.success && Array.isArray(res.data)) {
          this._exchangeRates.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data ?? [],
        message: res.message || 'Sincronización con Banxico completada con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Registrar o actualizar tipo de cambio y paridad inversa en BD (POST /api/v1/exchange-rates). */
  createExchangeRate(payload: CreateExchangeRateRequest): Observable<ServiceResult<ExchangeRate>> {
    return this.http.post<ApiResponse<ExchangeRate>>(this.exchangeRatesUrl, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._exchangeRates.update((list) => [res.data, ...list]);
        }
      }),
      map((res) => ({
        data: res.data,
        message: res.message || 'Tipo de cambio registrado con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  /** Calculadora de conversión en tiempo real procesada por el motor financiero del Backend (POST /api/v1/exchange-rates/convert). */
  convertCurrency(payload: ConvertCurrencyRequest): Observable<ServiceResult<ConvertCurrencyResult>> {
    return this.http.post<ApiResponse<ConvertCurrencyResult>>(`${this.exchangeRatesUrl}/convert`, payload).pipe(
      map((res) => ({
        data: res.data,
        message: res.message || 'Conversión calculada con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS REST HTTP — BITÁCORA DE AUDITORÍA (/api/v1/currency-exchange/audit)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Consultar bitácora forense de auditoría inmutable desde PostgreSQL (GET /api/v1/currency-exchange/audit). */
  getAuditLog(filters?: {
    organizationId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<ServiceResult<CurrencyAuditEntry[]>> {
    let params = new HttpParams();
    if (filters?.organizationId) params = params.set('organizationId', filters.organizationId);
    if (filters?.entityType) params = params.set('entityType', filters.entityType);
    if (filters?.entityId) params = params.set('entityId', filters.entityId);
    if (filters?.action) params = params.set('action', filters.action);
    if (filters?.startDate) params = params.set('startDate', filters.startDate);
    if (filters?.endDate) params = params.set('endDate', filters.endDate);

    return this.http.get<ApiResponse<CurrencyAuditEntry[]>>(this.auditUrl, { params }).pipe(
      tap((res) => {
        if (res.success && Array.isArray(res.data)) {
          this._auditEntries.set(res.data);
        }
      }),
      map((res) => ({
        data: res.data ?? [],
        message: res.message || 'Bitácora de auditoría obtenida con éxito.',
        success: res.success ?? true,
      })),
      catchError((err: any) => {
        return throwError(() => err);
      })
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS Y UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna la divisa base actual del signal local. */
  getBaseCurrency(): Currency | undefined {
    return this._currencies().find((c) => c.isBase);
  }

  /** Verifica si existe un código duplicado. */
  isDuplicateCode(code: string, excludeId?: string): boolean {
    return this._currencies().some(
      (c) => c.code.toUpperCase() === code.toUpperCase() && c.id !== excludeId
    );
  }
}

