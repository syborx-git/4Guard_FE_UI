/**
 * @file active-sessions.service.ts
 * @description Servicio para consumir el endpoint de sesiones activas (HU-011).
 * Endpoint: GET /api/v1/audit/active-sessions
 * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ToastService } from './toast.service';

export interface ActiveSession {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  lastLoginAt: string;
  ipAddress: string;
  userAgent: string;
  role?: string;
}

/** Respuesta envolvente estándar del backend 4GUARD */
export interface ActiveSessionsResponse {
  success: boolean;
  message: string;
  data: ActiveSession[];
  timestamp: string;
}

export interface RevokeSessionResponse {
  success: boolean;
  message: string;
  data: null;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActiveSessionsService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly API_URL = 'http://localhost:8080/api/v1/audit/active-sessions';

  /**
   * Obtiene la lista de sesiones activas del sistema.
   * El token Bearer es inyectado automáticamente por el jwtInterceptor.
   */
  getActiveSessions(): Observable<ActiveSessionsResponse> {
    return this.http
      .get<ActiveSessionsResponse>(this.API_URL)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.toast.error(error.error?.message || 'Error al obtener las sesiones activas');
          return throwError(() => error);
        })
      );
  }

  /**
   * Revoca la sesión activa de un usuario específico por su userId (UUID).
   * DELETE /api/v1/audit/active-sessions/{userId}
   */
  revokeSession(userId: string): Observable<RevokeSessionResponse> {
    return this.http
      .delete<RevokeSessionResponse>(`${this.API_URL}/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          this.toast.error(error.error?.message || 'Error al revocar la sesión');
          return throwError(() => error);
        })
      );
  }
}
