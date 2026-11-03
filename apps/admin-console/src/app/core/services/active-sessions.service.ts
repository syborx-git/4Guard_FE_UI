/**
 * @file active-sessions.service.ts
 * @description Servicio para consumir los endpoints de sesiones activas y reporte de horas trabajadas.
 * Endpoints:
 *  - GET /api/v1/audit/active-sessions
 *  - GET /api/v1/audit/work-hours (Exclusivo Dirección General)
 *  - DELETE /api/v1/audit/active-sessions/{userId}
 * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
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
  timeOnlineToday?: string;
}

export interface WorkSessionInterval {
  loginAt: string;
  logoutAt: string | null;
  rawDurationMinutes: number;
  deductedMinutes: number;
  netDurationMinutes: number;
  closeReason: 'ACTIVE' | 'LOGOUT' | 'TIMEOUT' | 'REVOKED' | string;
  ipAddress?: string;
}

export interface UserWorkHours {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  roleName: string;
  organizationId: string;
  organizationName: string;
  branchId: string;
  branchName: string;
  businessDate: string;
  status: 'ONLINE' | 'OFFLINE';
  firstLoginAt: string | null;
  lastLogoutAt: string | null;
  totalMinutesActive: number;
  formattedHours: string;
  sessionCount: number;
  timeoutLogoutCount: number;
  isCurrentShiftMet: boolean;
  intervals: WorkSessionInterval[];
}

/** Respuesta envolvente estándar del backend 4GUARD */
export interface ActiveSessionsResponse {
  success: boolean;
  message: string;
  data: ActiveSession[];
  timestamp: string;
}

export interface WorkHoursResponse {
  success: boolean;
  message: string;
  data: UserWorkHours[];
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
  private readonly API_URL = '/api/v1/audit/active-sessions';
  private readonly WORK_HOURS_URL = '/api/v1/audit/work-hours';

  /**
   * Obtiene la lista de sesiones activas del sistema.
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
   * Obtiene el reporte de horas trabajadas efectivas por usuario.
   * Exclusivo para Dirección General (ADMIN / CEO).
   */
  getWorkHours(date?: string, branchId?: string, role?: string): Observable<WorkHoursResponse> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (branchId) params = params.set('branchId', branchId);
    if (role && role !== 'ALL') params = params.set('role', role);

    return this.http
      .get<WorkHoursResponse>(this.WORK_HOURS_URL, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status !== 403) {
            this.toast.error(error.error?.message || 'Error al obtener el reporte de horas trabajadas');
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Revoca la sesión activa de un usuario específico por su userId (UUID).
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
