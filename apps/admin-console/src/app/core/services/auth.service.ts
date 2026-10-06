/**
 * @file auth.service.ts
 * @description Servicio principal de Autenticación JWT que interactúa con la API del Backend.
 *
 * Implementa la lógica de renovación de sesión transparente (Refresh Token) y proactivo
 * temporizado 5 minutos antes de que el token expire, con protección ante caídas de red.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, timer, Subscription, of, throwError } from 'rxjs';
import { catchError, switchMap, finalize } from 'rxjs/operators';
import { LoginRequest, LoginResponse, AuthenticatedUser } from '../models/auth.models';
import { SessionStorageService } from './session-storage.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionStorageService = inject(SessionStorageService);
  private readonly router = inject(Router);

  private readonly API_URL = `${environment.apiBaseUrl}/api/v1/auth`;
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
    const usersApiUrl = `${environment.apiBaseUrl}/api/v1/users`;
    return this.http.put(`${usersApiUrl}/change-password`, data);
  }

  /**
   * Decodifica de forma segura la carga útil (payload) del token JWT de acceso.
   */
  getDecodedAccessToken(): any | null {
    const token = this.getAccessToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
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
        // Solo expulsar si el token realmente ya expiró por fecha verificable
        if (this.isTokenExpired()) {
          this.clearSessionAndRedirect('session_expired');
        }
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
    if (token) localStorage.setItem('4g_token', token);
    if (refresh) localStorage.setItem('4g_refresh', refresh);
    if (expiresAt) localStorage.setItem('4g_expires_at', expiresAt);

    // Guardar también en sessionStorage service para compatibilidad del estado
    this.sessionStorageService.saveSession(authResponse);

    // Programar la renovación de token proactiva
    this.scheduleTokenRefresh(expiresAt);
  }

  /**
   * Diseña la lógica del temporizador proactivo.
   * Calcula el tiempo restante y dispara la renovación de forma segura y controlada.
   */
  scheduleTokenRefresh(expiresAtStr?: string): void {
    this.refreshSubscription?.unsubscribe();

    const token = this.getAccessToken();
    if (!token) return;

    let expiresAtMs: number | null = null;
    const decoded = this.getDecodedAccessToken();
    if (decoded && typeof decoded.exp === 'number') {
      expiresAtMs = decoded.exp * 1000;
    } else if (expiresAtStr) {
      const parsed = new Date(expiresAtStr).getTime();
      if (!isNaN(parsed)) {
        expiresAtMs = parsed;
      }
    }

    if (!expiresAtMs) return;

    const now = Date.now();
    const delayMs = expiresAtMs - now;

    // Si ya venció totalmente, no entrar en loop de timers; el interceptor gestionará la petición
    if (delayMs <= 0) {
      return;
    }

    // Programar refresh 5 minutos antes del vencimiento (o a la mitad del tiempo restante si es corto)
    const leadTimeMs = Math.min(5 * 60 * 1000, Math.floor(delayMs / 2));
    const refreshDelay = Math.max(30000, delayMs - leadTimeMs); // Mínimo 30s para evitar saturación

    this.refreshSubscription = timer(refreshDelay)
      .pipe(
        switchMap(() => this.refreshToken()),
        catchError(err => {
          // No cerrar sesión ante un fallo de refresh proactivo de red si el token de acceso sigue vigente
          return of(null);
        })
      )
      .subscribe();
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
    
    if (!this.router.url.includes('/login') && !this.router.url.includes('/carrier-checkin') && !this.router.url.includes('/driver-checkin')) {
      const queryParams = reason ? { reason } : {};
      this.router.navigate(['/login'], { queryParams });
    }
  }

  /**
   * Cierra la sesión activa llamando al endpoint POST /auth/logout del backend.
   */
  logout(): void {
    const refreshToken = this.getRefreshToken();
    const accessToken  = this.getAccessToken();

    if (!refreshToken || !accessToken) {
      this.clearSessionAndRedirect();
      return;
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    this.http
      .post<any>(`${this.API_URL}/logout`, { refreshToken }, { headers })
      .pipe(
        finalize(() => {
          this.clearSessionAndRedirect();
        })
      )
      .subscribe();
  }

  /**
   * Verifica si la sesión es válida (está logueado y el token no ha expirado).
   */
  isAuthenticated(): boolean {
    const hasToken = !!this.getAccessToken();
    const hasSession = this.sessionStorageService.isLogged();
    return (hasToken || hasSession) && !this.isTokenExpired();
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
    const user = this.getUserFromSessionOrJwt();
    return user ? user.permissions : this.sessionStorageService.getPermissions();
  }

  /**
   * Obtiene el rol asignado al usuario.
   */
  getRole(): string | null {
    const user = this.getUserFromSessionOrJwt();
    return user ? user.role : this.sessionStorageService.getRole();
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
   * Verifica si el token ha expirado utilizando la información criptográfica del JWT (exp claim)
   * o fallback seguro al valor guardado de sesión.
   */
  isTokenExpired(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;

    // 1. Verificación primaria: claim 'exp' del JWT (estándar UTC Unix Epoch en segundos)
    const decoded = this.getDecodedAccessToken();
    if (decoded && typeof decoded.exp === 'number') {
      const expMs = decoded.exp * 1000;
      return Date.now() >= expMs;
    }

    // 2. Verificación secundaria: string de expiración en localStorage o SessionStorage
    const expiresAtStr = localStorage.getItem('4g_expires_at') || this.sessionStorageService.getSession()?.expiresAt;
    if (expiresAtStr) {
      try {
        const expiresAt = new Date(expiresAtStr).getTime();
        if (!isNaN(expiresAt)) {
          return Date.now() >= expiresAt;
        }
      } catch {
        // En caso de parseo ambiguo, no forzar expiración inmediata si el token existe
      }
    }

    // Si el token existe y no podemos comprobar que expiró, se mantiene vigente
    return false;
  }

  private getUserFromSessionOrJwt(): AuthenticatedUser | null {
    const sessionUser = this.sessionStorageService.getUser();
    if (sessionUser) return sessionUser;

    const decoded = this.getDecodedAccessToken();
    if (decoded) {
      return {
        id: decoded.userId || '',
        username: decoded.sub || '',
        email: decoded.email || '',
        fullName: decoded.fullName || decoded.sub || '',
        role: decoded.role || '',
        roleLevel: 1,
        permissions: decoded.permissions || [],
        changePasswordRequired: false,
      };
    }
    return null;
  }
}
