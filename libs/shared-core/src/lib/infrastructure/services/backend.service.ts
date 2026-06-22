/**
 * @file backend.service.ts
 * @description Servicio Singleton base para comunicación HTTP con el Backend 4GUARD.
 *
 * Responsabilidades:
 * - CRUD genérico con tipado fuerte
 * - Construcción de URLs con parámetros de query
 * - Manejo centralizado de errores HTTP
 * - Paginación consistente
 *
 * Los interceptores (jwt, branch) se aplican automáticamente vía la cadena
 * de HttpClient. Este servicio NO gestiona autenticación directamente.
 *
 * Patrón: providedIn: 'root' → Singleton global.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Estructura estándar de error retornada por el backend Spring Boot.
 */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  traceId?: string;
}

/**
 * Opciones de query para peticiones GET.
 */
export type QueryParams = Record<string, string | number | boolean | undefined | null>;

@Injectable({ providedIn: 'root' })
export class BackendService {
  private readonly http      = inject(HttpClient);
  private readonly BASE_URL  = environment.apiBaseUrl;

  // ─── Métodos CRUD genéricos ───────────────────────────────────────────────

  /**
   * GET con soporte de query params opcionales.
   */
  get<T>(path: string, params?: QueryParams): Observable<T> {
    const httpParams = this.buildParams(params);
    return this.http
      .get<T>(`${this.BASE_URL}${path}`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  /**
   * POST — crear un nuevo recurso.
   */
  post<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .post<TResponse>(`${this.BASE_URL}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * PUT — reemplazar un recurso completo.
   */
  put<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .put<TResponse>(`${this.BASE_URL}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * PATCH — actualización parcial de un recurso.
   */
  patch<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    return this.http
      .patch<TResponse>(`${this.BASE_URL}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  /**
   * DELETE — eliminar un recurso.
   */
  delete<TResponse>(path: string): Observable<TResponse> {
    return this.http
      .delete<TResponse>(`${this.BASE_URL}${path}`)
      .pipe(catchError(this.handleError));
  }

  // ─── Utilidades ───────────────────────────────────────────────────────────

  /**
   * Construye HttpParams desde un objeto plano, ignorando valores null/undefined.
   */
  private buildParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }

  /**
   * Manejador centralizado de errores HTTP.
   * Normaliza errores de red y del backend a un formato consistente.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiError;

    if (error.error instanceof ErrorEvent) {
      // Error de red (sin conexión)
      apiError = {
        timestamp: new Date().toISOString(),
        status: 0,
        error: 'Network Error',
        message: 'No se pudo conectar con el servidor. Verifique su conexión.',
        path: error.url ?? '',
      };
    } else {
      // Error del backend
      apiError = error.error as ApiError ?? {
        timestamp: new Date().toISOString(),
        status: error.status,
        error: error.statusText,
        message: `Error ${error.status}: ${error.statusText}`,
        path: error.url ?? '',
      };
    }

    return throwError(() => apiError);
  }
}
