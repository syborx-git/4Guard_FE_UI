/**
 * @file users.service.ts
 * @description Servicio de Gestión de Usuarios — 4GUARD WMS.
 *
 * Responsabilidades:
 *  - Centralizar todas las llamadas HTTP al recurso /api/v1/users
 *  - Delegar la autorización al jwtInterceptor (Bearer Token automático)
 *  - Exponer Observables tipados — nunca Promises
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ResetPasswordTempResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  UserProfileResponse,
  ApiResponse,
  UserProfileDto,
  CreateUserRequest,
  UserAuditLogDto,
} from '../models/user.models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly http = inject(HttpClient);

  /** Base URL del recurso users en el backend */
  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/users`;

  /**
   * Solicita una contraseña temporal para el usuario indicado.
   *
   * Endpoint: PUT /api/v1/users/reset-password-temp?usernameOrEmail={valor}
   * Autorización: Ninguna — endpoint público (no requiere sesión activa).
   *
   * El interceptor JWT no fallará si no hay token: getAccessToken() retorna null
   * y simplemente no agrega el header Authorization.
   *
   * La contraseña temporal generada por el backend se devuelve en response.data.
   *
   * Errores que el componente debe manejar:
   *   - 404: No se encontró ningún usuario con el nombre de usuario o correo electrónico
   *   - 500: Error interno del servidor
   *
   * @param usernameOrEmail Usuario o correo electrónico del sistema.
   * @returns Observable<ResetPasswordTempResponse> con la contraseña temporal en data.
   */
  requestPasswordReset(usernameOrEmail: string): Observable<ResetPasswordTempResponse> {
    const params = { usernameOrEmail };
    return this.http
      .put<ResetPasswordTempResponse>(
        `${this.API_URL}/reset-password-temp`,
        null,  // No lleva body — el valor va como query param
        { params }
      )
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Cambia la contraseña del usuario autenticado por una contraseña definitiva.
   *
   * Endpoint: PUT /api/v1/users/change-password
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * Este endpoint se llama tras el login con contraseña temporal (changePasswordRequired === true).
   * El usuario ya tiene un accessToken válido en su sesión.
   *
   * Errores que el componente debe manejar:
   *   - 400: Validación fallida (contraseña muy corta, etc.)
   *   - 401: El interceptor redirige al Login y limpia la sesión.
   *
   * @param newPassword La nueva contraseña permanente (mínimo 8 caracteres).
   * @returns Observable<ChangePasswordResponse> con mensaje de confirmación.
   */
  changePassword(newPassword: string): Observable<ChangePasswordResponse> {
    const body: ChangePasswordRequest = { newPassword };
    return this.http
      .put<ChangePasswordResponse>(
        `${this.API_URL}/change-password`,
        body
      )
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Genera una contraseña temporal para un usuario específico del sistema.
   * USO: Panel de Administración — un admin genera la clave para OTRO usuario.
   *
   * Endpoint: PUT /api/v1/users/{id}/reset-password-temp
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   * Permiso: USERS_UPDATE
   *
   * @param userId UUID del usuario al que se le generará la contraseña temporal.
   * @returns Observable<ResetPasswordTempResponse> con la contraseña en data.
   */
  generateTemporaryPassword(userId: string): Observable<ResetPasswordTempResponse> {
    return this.http
      .put<ResetPasswordTempResponse>(
        `${this.API_URL}/${userId}/reset-password-temp`,
        null
      )
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Obtiene la información detallada de perfil para el usuario especificado.
   *
   * Endpoint: GET /api/v1/users/{userId}
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @param userId UUID del usuario autenticado.
   * @returns Observable<UserProfileResponse>
   */
  getUserProfile(userId: string): Observable<UserProfileResponse> {
    return this.http
      .get<UserProfileResponse>(`${this.API_URL}/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Obtiene la lista completa de usuarios de la base de datos del backend.
   *
   * Endpoint: GET /api/v1/users
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @returns Observable<ApiResponse<UserProfileDto[]>>
   */
  getUsers(): Observable<ApiResponse<UserProfileDto[]>> {
    return this.http
      .get<ApiResponse<UserProfileDto[]>>(this.API_URL)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Modifica los datos de un usuario existente en la base de datos del backend.
   *
   * Endpoint: PUT /api/v1/users
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @param user El DTO del usuario con los campos actualizados.
   * @returns Observable<ApiResponse<UserProfileDto>>
   */
  updateUser(user: UserProfileDto): Observable<ApiResponse<UserProfileDto>> {
    return this.http
      .put<ApiResponse<UserProfileDto>>(this.API_URL, user)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Actualiza campos de perfil del usuario autenticado (email, teléfono, etc.)
   * Envuelve `updateUser` aceptando un subconjunto de campos para uso desde
   * componentes de perfil que no manejan el DTO completo.
   *
   * Endpoint: PUT /api/v1/users
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @param fields Campos de perfil a actualizar (ej. { email, phone }).
   * @returns Observable<ApiResponse<UserProfileDto>>
   */
  updateUserProfile(fields: { email?: string; phone?: string; [key: string]: unknown }): Observable<ApiResponse<UserProfileDto>> {
    const partial: UserProfileDto = fields as unknown as UserProfileDto;
    return this.http
      .put<ApiResponse<UserProfileDto>>(this.API_URL, partial)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }


  /**
   * Crea un nuevo usuario en la base de datos del backend.
   *
   * Endpoint: POST /api/v1/users
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @param user Datos de creación del usuario.
   * @returns Observable<ApiResponse<UserProfileDto>>
   */
  createUser(user: CreateUserRequest): Observable<ApiResponse<UserProfileDto>> {
    return this.http
      .post<ApiResponse<UserProfileDto>>(this.API_URL, user)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Elimina un usuario por su ID en la base de datos del backend.
   *
   * Endpoint: DELETE /api/v1/users/{id}
   * Autorización: Bearer Token (inyectado automáticamente por jwtInterceptor)
   *
   * @param userId UUID del usuario a eliminar.
   * @returns Observable<ApiResponse<void>>
   */
  deleteUser(userId: string): Observable<ApiResponse<void>> {
    return this.http
      .delete<ApiResponse<void>>(`${this.API_URL}/${userId}`)
      .pipe(
        catchError((error: HttpErrorResponse) => this.handleError(error))
      );
  }

  /**
   * Obtiene el historial de auditoría de un usuario específico.
   *
   * Endpoint: GET /api/v1/users/{userId}/audit
   * Autorización: Bearer Token
   *
   * @param userId UUID del usuario
   * @returns Observable<ApiResponse<UserAuditLogDto[]>>
   */
  getUserAuditHistory(userId: string): Observable<ApiResponse<UserAuditLogDto[]>> {
    return this.http
      .get<ApiResponse<UserAuditLogDto[]>>(`${this.API_URL}/${userId}/audit`)
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
