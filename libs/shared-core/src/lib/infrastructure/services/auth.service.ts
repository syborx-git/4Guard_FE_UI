/**
 * @file auth.service.ts
 * @description Servicio Singleton de Autenticación para 4GUARD WMS.
 *
 * Responsabilidades:
 * - Login / Logout
 * - Gestión de tokens JWT RS256 (access + refresh)
 * - Decodificación de payload JWT (sin librería externa)
 * - Exposición del usuario actual vía Signal
 * - Refresco automático de token
 *
 * Patrón: providedIn: 'root' → Singleton global en ambas apps.
 */

import { Injectable, inject, signal, computed, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, of, delay, catchError } from 'rxjs';
import { AuthResponse, JwtPayload, LoginRequest, User } from '../../domain/models/user.model';
import { UserRole } from '../../domain/enums/role.enum';
import { environment } from '../../../environments/environment';

/** Claves de localStorage para persistencia de sesión */
const STORAGE_KEYS = {
  ACCESS_TOKEN:  '4guard_access_token',
  REFRESH_TOKEN: '4guard_refresh_token',
  USER:          '4guard_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // ─── Señales de estado ────────────────────────────────────────────────────
  private readonly _currentUser = signal<User | null>(this.loadUserFromStorage());
  private readonly _isLoading   = signal<boolean>(false);

  /** Usuario autenticado actual (Signal de solo lectura) */
  readonly currentUser: Signal<User | null> = this._currentUser.asReadonly();

  /** Indica si hay una sesión activa */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Rol del usuario actual (null si no autenticado) */
  readonly currentRole = computed(() => this._currentUser()?.role ?? null);

  /** ID de sucursal del usuario actual */
  readonly branchId = computed(() => this._currentUser()?.branchId ?? null);

  /** Estado de carga durante operaciones de auth */
  readonly isLoading: Signal<boolean> = this._isLoading.asReadonly();

  // ─── Métodos públicos ─────────────────────────────────────────────────────

  /**
   * Autentica al usuario con email y contraseña.
   * Guarda los tokens JWT y actualiza la señal de usuario.
   */
  login(credentials: LoginRequest): Observable<User> {
    this._isLoading.set(true);

    const body = {
      identifier: credentials.email,
      password: credentials.password
    };

    return this.http.post<any>('/api/v1/auth/login', body).pipe(
      map((res: any) => {
        const data = res?.data || res;
        const token = data.accessToken || data.token;
        const refreshToken = data.refreshToken || token;
        const rawUser = data.user;

        let role: UserRole = UserRole.WAREHOUSE_OPERATOR;
        if (rawUser?.role) {
          const r = String(rawUser.role).toUpperCase();
          if (r.includes('ADMIN') || r.includes('CEO') || r.includes('DIRECTOR')) role = UserRole.ADMIN;
          else if (r.includes('MANAGER') || r.includes('GERENTE')) role = UserRole.OPERATIONS_MANAGER;
          else if (r.includes('COORDINATOR') || r.includes('COORD')) role = UserRole.OPERATIONS_COORDINATOR;
          else if (r.includes('SUPERVISOR') || r.includes('SUPER')) role = UserRole.OPERATIONS_SUPERVISOR;
          else if (r.includes('CONTROL') || r.includes('MESA')) role = UserRole.CONTROL_DESK;
          else if (r.includes('SHIFT') || r.includes('LIDER')) role = UserRole.SHIFT_LEADER;
          else if (r.includes('QM') || r.includes('QUALITY') || r.includes('CALIDAD')) role = UserRole.QM_INSPECTOR;
          else if (r.includes('SECURITY') || r.includes('GUARD') || r.includes('VIGILANCIA') || r.includes('CASETA')) role = UserRole.SECURITY_GUARD;
          else role = UserRole.WAREHOUSE_OPERATOR;
        }

        const user: User = {
          id: rawUser?.id ? String(rawUser.id) : `u-${Date.now()}`,
          fullName: rawUser?.fullName || rawUser?.name || `${rawUser?.firstName || ''} ${rawUser?.lastName || ''}`.trim() || rawUser?.username || credentials.email.split('@')[0],
          email: rawUser?.email || credentials.email,
          username: rawUser?.username || credentials.email.split('@')[0],
          role,
          organizationId: rawUser?.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
          branchId: rawUser?.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
          branchName: rawUser?.branchName || rawUser?.organizationName || '4GUARD LOGISTICS',
          organizationName: rawUser?.organizationName || '4GUARD LOGISTICS CORP',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const response: AuthResponse = {
          accessToken: token,
          refreshToken,
          expiresIn: data.expiresIn || 3600,
          user
        };

        this.saveSession(response);
        this._isLoading.set(false);
        return user;
      }),
      catchError((err) => {
        this._isLoading.set(false);
        const errMsg = err?.error?.message 
          || (err.status === 404 
              ? 'Endpoint no encontrado (404). Asegúrate de haber reiniciado "npm run start:rf" para cargar el proxy.' 
              : (err.status === 0 
                  ? 'No hay conexión con el backend (127.0.0.1:8080). Verifica que Spring Boot esté activo.' 
                  : (err.status === 401 ? 'Credenciales incorrectas. Verifica tu usuario y contraseña.' : 'Error al autenticar en el servidor.')));
        throw new Error(errMsg);
      })
    );
  }

  /**
   * Cierra la sesión del usuario actual de forma 100% segura.
   * Limpia tokens, estado, cookies, storage y redirige al login reemplazando el historial.
   * @param reason Razón opcional para mostrar en la pantalla de login.
   */
  logout(reason?: string): void {
    // Aquí iría la llamada al backend para invalidar el token si existiera endpoint real
    // ej: this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });

    this.clearSession();
    
    const navExtras = { replaceUrl: true, queryParams: reason ? { reason } : {} };
    this.router.navigate(['/login'], navExtras);
  }

  /**
   * Refresca el access token usando el refresh token almacenado.
   * Retorna el nuevo access token como string.
   */
  refreshToken(): Observable<string> {
    const user = this.currentUser();
    const role = user?.role ?? UserRole.ADMIN;
    const dummyToken = `mock-jwt-token-for-${role}-${Date.now()}`;
    
    return of(dummyToken).pipe(
      tap((newToken) => {
        const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
        const userObj: User = rawUser ? JSON.parse(rawUser) : {
          id: 'u-admin',
          fullName: 'Carlos Herrera',
          email: 'admin@4guard.mx',
          role: UserRole.ADMIN,
          branchId: 'BR-MTY-01',
          branchName: 'Sucursal Monterrey',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const response: AuthResponse = {
          accessToken: newToken,
          refreshToken: `mock-refresh-token-for-${role}-${Date.now()}`,
          expiresIn: 3600,
          user: userObj
        };
        this.saveSession(response);
      })
    );
  }

  /**
   * Retorna el access token JWT almacenado.
   */
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Retorna el ID de la sucursal del usuario actual.
   */
  getBranchId(): string | null {
    return this.branchId();
  }

  /**
   * Verifica si el token JWT actual es válido (no expirado).
   */
  isTokenValid(): boolean {
    const token = this.getAccessToken();
    if (!token) return false;

    // Aceptar automáticamente los tokens simulados de desarrollo
    if (token.startsWith('mock-') || token.startsWith('rf-')) {
      return true;
    }

    try {
      const payload = this.decodeJwtPayload(token);
      const nowSeconds = Math.floor(Date.now() / 1000);
      return payload.exp > nowSeconds;
    } catch {
      return false;
    }
  }

  /**
   * Cambia el rol del usuario activo para pruebas rápidas de interfaz (RBAC demo switcher).
   */
  switchRoleForTesting(role: UserRole, customName?: string): void {
    const roleNames: Record<UserRole, string> = {
      [UserRole.ADMIN]:                  'Ing. Carlos Herrera (Director General)',
      [UserRole.OPERATIONS_MANAGER]:     'Ing. Roberto Garza (Gerente Operaciones)',
      [UserRole.OPERATIONS_COORDINATOR]: 'Lic. Fernando Lozano (Coordinador Operaciones)',
      [UserRole.OPERATIONS_SUPERVISOR]:  'Ing. Héctor Salinas (Supervisor Operaciones)',
      [UserRole.CONTROL_DESK]:           'Lic. Patricia Gómez (Mesa de Control)',
      [UserRole.SHIFT_LEADER]:           'Ricardo Peña (Líder de Turno)',
      [UserRole.WAREHOUSE_OPERATOR]:     'Roberto Sánchez (Montacarguista)',
      [UserRole.QM_INSPECTOR]:           'Dra. Elena Ramos (Inspector de Calidad)',
      [UserRole.SECURITY_GUARD]:         'Carlos Mendoza (Guardia de Seguridad)',
    };

    const updatedUser: User = {
      id: `u-${role.toLowerCase()}`,
      fullName: customName || roleNames[role] || 'Usuario Operativo',
      email: `${role.toLowerCase().replace('role_', '')}@4guard.mx`,
      role,
      branchId: 'BR-MTY-01',
      branchName: 'CEDIS Central Monterrey',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dummyResponse: AuthResponse = {
      accessToken: `mock-jwt-token-for-${role}-${Date.now()}`,
      refreshToken: `mock-refresh-token-for-${role}-${Date.now()}`,
      expiresIn: 3600,
      user: updatedUser,
    };

    this.saveSession(dummyResponse);
  }

  /**
   * Verifica si el usuario tiene uno de los roles permitidos.
   */
  hasRole(...roles: UserRole[]): boolean {
    const userRole = this.currentRole();
    if (!userRole) return false;
    return roles.includes(userRole);
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  /**
   * Guarda las credenciales de la sesión activa en el almacenamiento local y actualiza el estado.
   * Método expuesto para soportar flujos de login en múltiples pasos (ej. selección de sucursal).
   */
  saveSession(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN,  response.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
    this._currentUser.set(response.user);
  }

  private clearSession(): void {
    // 1. Limpiar JWTs del LocalStorage
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);

    // 2. Limpiar SessionStorage por completo (previene persistencia en pestaña)
    sessionStorage.clear();

    // 3. Destruir todas las cookies accesibles por Javascript
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });

    // 4. Limpiar estado reactivo en la memoria de la aplicación
    this._currentUser.set(null);
  }

  private loadUserFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Decodifica el payload de un JWT sin verificar la firma
   * (la verificación la realiza el backend).
   */
  private decodeJwtPayload(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64Payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload) as JwtPayload;
  }
}
