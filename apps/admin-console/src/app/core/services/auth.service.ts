/**
 * @file auth.service.ts
 * @description Servicio principal de Autenticación JWT que interactúa con la API del Backend.
 *
 * Implementa la lógica de renovación de sesión transparente (Refresh Token) y proactivo
 * temporizado 5 minutos antes de que el token expire.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, timer, Subscription, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, AuthenticatedUser } from '../models/auth.models';
import { SessionStorageService } from './session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionStorageService = inject(SessionStorageService);
  private readonly router = inject(Router);

  private readonly API_URL = 'http://localhost:8080/api/v1/auth';
  private refreshSubscription?: Subscription;

  /**
   * Envía las credenciales al backend para iniciar sesión.
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthentication(response.data);
        }
      })
    );
  }

  /**
   * Cambia la contraseña del usuario actual.
   * Endpoint: PUT /api/v1/users/change-password
   */
  changePassword(data: any): Observable<any> {
    const usersApiUrl = 'http://localhost:8080/api/v1/users';
    return this.http.put(`${usersApiUrl}/change-password`, data);
  }

  /**
   * Refresca el token JWT de la sesión activa enviando el refresh token guardado.
   */
  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('4g_refresh') || this.getRefreshToken();
    if (!refreshToken) {
      this.clearSessionAndRedirect('session_expired');
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<any>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.handleAuthentication(response.data);
        }
      }),
      catchError(error => {
        this.clearSessionAndRedirect('session_expired');
        return throwError(() => error);
      })
    );
  }

  /**
   * Maneja el almacenamiento de los tokens de forma consistente en el localStorage y sessionStorage.
   * Programa la siguiente renovación proactiva.
   */
  handleAuthentication(authResponse: any): void {
    if (!authResponse) return;

    const token = authResponse.accessToken;
    const refresh = authResponse.refreshToken;
    const expiresAt = authResponse.expiresAt;

    // Nomenclatura del proyecto solicitada en localStorage
    localStorage.setItem('4g_token', token);
    localStorage.setItem('4g_refresh', refresh);
    localStorage.setItem('4g_expires_at', expiresAt);

    // Guardar también en sessionStorage service para compatibilidad del estado
    this.sessionStorageService.saveSession(authResponse);

    // Programar la renovación de token proactiva
    this.scheduleTokenRefresh(expiresAt);
  }

  /**
   * Diseña la lógica del temporizador proactivo.
   * Calcula el tiempo restante y dispara la renovación 5 minutos antes de expirar.
   */
  scheduleTokenRefresh(expiresAtStr: string): void {
    this.refreshSubscription?.unsubscribe();

    if (!expiresAtStr) return;

    const expiresAt = new Date(expiresAtStr).getTime();
    const now = Date.now();
    const delayMs = expiresAt - now;

    // Si faltan menos de 5 minutos o ya expiró, hacer refresh inmediato.
    // De lo contrario, programar para 5 minutos antes del vencimiento.
    const leadTimeMs = 5 * 60 * 1000; // 5 minutos de antelación
    let refreshDelay = delayMs - leadTimeMs;

    if (refreshDelay <= 0) {
      refreshDelay = 1000; // Mínimo delay de 1s para evitar bucles infinitos inmediatos
    }

    this.refreshSubscription = timer(refreshDelay)
      .pipe(
        switchMap(() => this.refreshToken())
      )
      .subscribe({
        error: () => {
          this.clearSessionAndRedirect('session_expired');
        }
      });
  }

  /**
   * Limpia el almacenamiento de sesión e inicia redirección al login.
   */
  clearSessionAndRedirect(reason?: string): void {
    this.refreshSubscription?.unsubscribe();
    
    // Limpieza de claves específicas solicitadas en localStorage
    localStorage.removeItem('4g_token');
    localStorage.removeItem('4g_refresh');
    localStorage.removeItem('4g_expires_at');
    
    this.sessionStorageService.clearSession();
    
    const queryParams = reason ? { reason } : {};
    this.router.navigate(['/login'], { queryParams });
  }

  /**
   * Cierra la sesión activa en el cliente y cancela la suscripción activa.
   */
  logout(): void {
    this.clearSessionAndRedirect();
  }

  /**
   * Verifica si la sesión es válida (está logueado y el token no ha expirado).
   */
  isAuthenticated(): boolean {
    return this.sessionStorageService.isLogged() && !this.isTokenExpired();
  }

  /**
   * Retorna los datos del usuario actual.
   */
  getCurrentUser(): AuthenticatedUser | null {
    return this.sessionStorageService.getUser();
  }

  /**
   * Obtiene el accessToken actual.
   */
  getAccessToken(): string | null {
    return localStorage.getItem('4g_token') || this.sessionStorageService.getAccessToken();
  }

  /**
   * Obtiene el refreshToken actual.
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('4g_refresh') || this.sessionStorageService.getRefreshToken();
  }

  /**
   * Obtiene los permisos asignados al usuario.
   */
  getPermissions(): string[] {
    return this.sessionStorageService.getPermissions();
  }

  /**
   * Obtiene el rol asignado al usuario.
   */
  getRole(): string | null {
    return this.sessionStorageService.getRole();
  }

  /**
   * Obtiene el nivel del rol del usuario.
   */
  getRoleLevel(): number {
    return this.sessionStorageService.getRoleLevel();
  }

  /**
   * Verifica si el usuario tiene un permiso específico.
   */
  hasPermission(permission: string): boolean {
    return this.getPermissions().includes(permission);
  }

  /**
   * Verifica si el usuario tiene al menos uno de los permisos provistos.
   */
  hasAnyPermission(permissions: string[]): boolean {
    const userPermissions = this.getPermissions();
    return permissions.some(p => userPermissions.includes(p));
  }

  /**
   * Verifica si el usuario tiene el rol provisto.
   */
  hasRole(role: string): boolean {
    const userRole = this.getRole();
    return userRole === role;
  }

  /**
   * Verifica si el token ha expirado.
   */
  isTokenExpired(): boolean {
    const expiresAtStr = localStorage.getItem('4g_expires_at');
    if (expiresAtStr) {
      try {
        const expiresAt = new Date(expiresAtStr);
        return expiresAt.getTime() < Date.now();
      } catch {
        return true;
      }
    }
    return this.sessionStorageService.isLogged() && this.authServiceExpiredCheck();
  }

  private authServiceExpiredCheck(): boolean {
    const session = this.sessionStorageService.getSession();
    if (!session || !session.expiresAt) return true;

    try {
      const expiresAt = new Date(session.expiresAt);
      return expiresAt.getTime() < Date.now();
    } catch {
      return true;
    }
  }
}
