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
import { catchError, switchMap, finalize, timeout } from 'rxjs/operators';
import { LoginRequest, LoginResponse, AuthenticatedUser, JwtSession } from '../models/auth.models';
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
   * Genera un token JWT sintético válido con cabecera y claims RFC 7519 para entorno de desarrollo/local.
   */
  private createDevJwtToken(identifier: string, role: string, fullName: string): string {
    const toBase64 = (obj: any) => {
      try {
        const str = JSON.stringify(obj);
        return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch {
        return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
    };
    const header = toBase64({ alg: 'HS256', typ: 'JWT' });
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + 30 * 24 * 3600; // 30 días de vigencia en local
    const payload = toBase64({
      sub: identifier,
      userId: 'f33f0907-9fa5-4bdf-87db-2eb5e7683937',
      email: identifier.includes('@') ? identifier : `${identifier}@4guard.mx`,
      fullName: fullName,
      role: role,
      permissions: ['*'],
      iat: nowSec,
      exp: expSec
    });
    const signature = 'mock-signature-4guard-valid';
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Envía las credenciales al backend para iniciar sesión.
   * Con fallback automático e instantáneo para entorno de desarrollo cuando el backend en localhost:8080 no está encendido.
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      timeout(10000),
      tap(response => {
        if (response.success && response.data) {
          if (!response.data.expiresAt) {
            response.data.expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
          }
          this.handleAuthentication(response.data);
        }
      }),
      catchError((error) => {
        // Fallback resiliente EXCLUSIVAMENTE para desarrollo local standalone cuando useMockData está activo y no hay backend disponible
        if (environment.useMockData && (error?.status === 0 || error?.name === 'TimeoutError')) {
          const identifier = (credentials.identifier || '').trim().toLowerCase();
          const localPart = identifier.split('@')[0] || identifier;
          let role = 'ROLE_ADMIN';
          let fullName = 'Enrique Architect (Director General)';

          if (localPart.includes('enrique') || localPart.includes('norma') || localPart.includes('alejandro') || localPart.includes('admin')) {
            role = 'ROLE_ADMIN';
            fullName = localPart.includes('norma') ? 'Norma (Dirección General)' : 'Enrique Architect (Director General)';
          } else if (localPart.includes('pablo') || localPart.includes('operacion') || localPart.includes('gerente')) {
            role = 'ROLE_OPERATIONS_MANAGER';
            fullName = 'Pablo Gerente (Gerente de Operaciones)';
          } else if (localPart.includes('coord') || localPart.includes('coordinador')) {
            role = 'ROLE_OPERATIONS_COORDINATOR';
            fullName = 'Coordinador de Operaciones';
          } else if (localPart.includes('supervisor')) {
            role = 'ROLE_OPERATIONS_SUPERVISOR';
            fullName = 'Supervisor de Operaciones';
          } else if (localPart.includes('mesa') || localPart.includes('control')) {
            role = 'ROLE_CONTROL_DESK';
            fullName = 'Mesa de Control';
          } else if (localPart.includes('lider') || localPart.includes('turno')) {
            role = 'ROLE_SHIFT_LEADER';
            fullName = 'Líder de Turno';
          } else if (localPart.includes('calidad_ayud') || localPart.includes('ayudante_calidad')) {
            role = 'ROLE_QUALITY_ASSISTANT';
            fullName = 'Ayudante de Calidad';
          } else if (localPart.includes('calidad') || localPart.includes('qm') || localPart.includes('inspector') || localPart.includes('auditor')) {
            role = 'ROLE_QM_INSPECTOR';
            fullName = 'Inspector de Calidad';
          } else if (localPart.includes('seguridad_ayud') || localPart.includes('ayudante_seguridad')) {
            role = 'ROLE_SECURITY_ASSISTANT';
            fullName = 'Ayudante de Seguridad';
          } else if (localPart.includes('guard') || localPart.includes('caseta') || localPart.includes('seguridad') || localPart.includes('vigilan') || localPart.includes('jp')) {
            role = 'ROLE_SECURITY_GUARD';
            fullName = 'Juan Pablo Vigilancia (Caseta)';
          } else if (localPart.includes('mc-') || localPart.includes('montacarga') || localPart.includes('oper')) {
            role = 'ROLE_WAREHOUSE_OPERATOR';
            fullName = 'Alex Gabriel Perez Garduño (Montacargas)';
          }

          const validJwt = this.createDevJwtToken(credentials.identifier, role, fullName);
          const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

          const devSession: JwtSession = {
            accessToken: validJwt,
            refreshToken: validJwt,
            expiresAt: expiresAt,
            user: {
              id: 'f33f0907-9fa5-4bdf-87db-2eb5e7683937',
              username: credentials.identifier,
              fullName: fullName,
              email: credentials.identifier.includes('@') ? credentials.identifier : `${credentials.identifier}@4guard.mx`,
              role: role,
              roleLevel: 1,
              permissions: ['*'],
              changePasswordRequired: false
            }
          };

          this.handleAuthentication(devSession);

          const devResponse: LoginResponse = {
            success: true,
            message: 'Inicio de sesión autorizado (Modo Local Mock)',
            data: devSession,
            timestamp: new Date().toISOString()
          };

          return of(devResponse);
        }

        // Si el backend respondió con un código de error (e.g. 401, 403, 423), propagarlo directamente
        return throwError(() => error);
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
        // Si el refresh falla (401 o 403), el token ya no es válido -> limpiar de inmediato
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

    const token = authResponse.accessToken || authResponse.token;
    const refresh = authResponse.refreshToken || token;
    const expiresAt = authResponse.expiresAt || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    // Nomenclatura del proyecto solicitada en localStorage
    if (token) localStorage.setItem('4g_token', token);
    if (refresh) localStorage.setItem('4g_refresh', refresh);
    if (expiresAt) localStorage.setItem('4g_expires_at', expiresAt);

    // Guardar también en sessionStorage service para compatibilidad del estado
    const sessionObj: JwtSession = {
      accessToken: token,
      refreshToken: refresh,
      expiresAt: expiresAt,
      user: authResponse.user || this.getCurrentUser() || {
        id: 'f33f0907-9fa5-4bdf-87db-2eb5e7683937',
        fullName: 'Enrique Architect (Gerente de Operaciones)',
        username: 'enrique@4guard.com',
        email: 'enrique@4guard.com',
        role: 'ROLE_OPERATIONS_MANAGER',
        roleLevel: 6,
        permissions: ['*'],
        changePasswordRequired: false
      }
    };
    this.sessionStorageService.saveSession(sessionObj);

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

  private isRedirecting = false;

  /**
   * Limpia el almacenamiento de sesión e inicia redirección al login.
   */
  clearSessionAndRedirect(reason?: string): void {
    const browserPath = typeof window !== 'undefined' ? (window.location.pathname || '').toLowerCase() : '';
    const activeUrl = `${browserPath} ${(this.router.url || '').toLowerCase()}`;
    const isDriverPublicPortal =
      activeUrl.includes('/carrier-checkin') ||
      activeUrl.includes('/driver-checkin') ||
      activeUrl.includes('/public/checkin') ||
      activeUrl.includes('/security/check-in');

    // Nunca expulsar ni redirigir a /login si la pestaña está en el portal público QR del chofer
    if (isDriverPublicPortal) {
      return;
    }

    if (!environment.production && reason === 'session_expired') {
      // Proteger la sesión de desarrollo local para evitar expulsiones inesperadas por APIs externas
      return;
    }

    this.refreshSubscription?.unsubscribe();
    
    // Limpieza de claves específicas solicitadas en localStorage
    localStorage.removeItem('4g_token');
    localStorage.removeItem('4g_refresh');
    localStorage.removeItem('4g_expires_at');
    
    this.sessionStorageService.clearSession();
    
    if (this.isRedirecting) return;

    if (!activeUrl.includes('/login') && !activeUrl.includes('/forgot-password')) {
      this.isRedirecting = true;
      const queryParams = reason ? { reason } : {};
      this.router.navigate(['/login'], { queryParams }).finally(() => {
        setTimeout(() => { this.isRedirecting = false; }, 1000);
      });
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
      .post<any>(`${this.API_URL}/logout`, { refreshToken, reason: 'MANUAL' }, { headers })
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

    // 0. Si es un token de desarrollo/mock sintético, es siempre vigente
    if (
      token.startsWith('mock-') ||
      token.startsWith('rf-') ||
      token.startsWith('local-') ||
      token.startsWith('fake-') ||
      !token.includes('.')
    ) {
      return false;
    }

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

    // En entorno no-producción, si existe token no forzar expiración para permitir pruebas fluidas
    if (!environment.production) {
      return false;
    }

    // Seguridad Fail-Closed: Solo en producción estricta si no se puede verificar exp
    return true;
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
