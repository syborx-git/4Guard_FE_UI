/**
 * @file users.service.ts
 * @description Servicio de Gestión de Usuarios — 4GUARD WMS.
 *
 * Responsabilidades:
 *  - Centralizar todas las llamadas HTTP al recurso /api/v1/users
 *  - Delegar la autorización al jwtInterceptor (Bearer Token automático)
 *  - Exponer Observables tipados — nunca Promises
 *
 * Permiso requerido para generateTemporaryPassword: USERS_UPDATE
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ResetPasswordTempResponse } from '../models/user.models';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly http = inject(HttpClient);

  /** Base URL del recurso users en el backend */
  private readonly API_URL = 'http://localhost:8080/api/v1/users';

  /**
   * Genera una contraseña temporal para un usuario del sistema.
   *
   * Endpoint: PUT /api/v1/users/{id}/reset-password-temp
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   * Permiso: USERS_UPDATE
   *
   * El endpoint NO requiere body — solo el UUID como path variable.
   *
   * @param userId UUID del usuario al que se le generará la contraseña temporal.
   * @returns Observable<ResetPasswordTempResponse> con la contraseña en data.
   *
   * Errores manejados por el interceptor:
   *   - 401: El interceptor redirige al Login y limpia la sesión.
   *
   * Errores que el componente debe manejar:
   *   - 403: Sin permiso USERS_UPDATE
   *   - 404: Usuario no encontrado
   *   - 500: Error interno del servidor
   *
   * TODO: Registrar evento de auditoría tras respuesta exitosa
   *   POST /api/v1/audit/events  { eventType: 'TEMP_PASSWORD_GENERATED', userId, timestamp }
   */
  generateTemporaryPassword(userId: string): Observable<ResetPasswordTempResponse> {
    return this.http
      .put<ResetPasswordTempResponse>(
        `${this.API_URL}/${userId}/reset-password-temp`,
        null  // No lleva body — el endpoint solo requiere el path variable
      )
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Manejador centralizado de errores HTTP del recurso /users.
   * El interceptor JWT ya maneja el 401 (redirige al Login).
   * Este método propaga el error tipado para que el componente lo presente.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => error);
  }
}
