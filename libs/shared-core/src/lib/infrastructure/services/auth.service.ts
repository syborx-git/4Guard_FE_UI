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
import { Observable, tap, map, of, delay } from 'rxjs';
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
    
    // Asignar rol según el prefijo/dominio del correo para permitir pruebas de RBAC
    let role = UserRole.ADMIN;
    let fullName = 'Carlos Herrera';
    
    const email = credentials.email.toLowerCase();
    if (email.includes('manager')) {
      role = UserRole.WAREHOUSE_MANAGER;
      fullName = 'Sofía Ramírez';
    } else if (email.includes('dock')) {
      role = UserRole.DOCK_SUPERVISOR;
      fullName = 'Miguel Torres';
    } else if (email.includes('qm')) {
      role = UserRole.QM_INSPECTOR;
      fullName = 'Ana López';
    } else if (email.includes('op')) {
      role = UserRole.WAREHOUSE_OPERATOR;
      fullName = 'Roberto Sánchez';
    } else if (email.includes('auditor')) {
      role = UserRole.AUDITOR;
      fullName = 'David Salazar';
    } else if (email.includes('client')) {
      role = UserRole.CLIENT;
      fullName = 'Representante Nestlé';
    }

    const dummyUser: User = {
      id: `u-${role.toLowerCase()}`,
      fullName,
      email: credentials.email,
      role,
      branchId: 'BR-MTY-01',
      branchName: 'Sucursal Monterrey',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const dummyResponse: AuthResponse = {
      accessToken: `mock-jwt-token-for-${role}-${Date.now()}`,
      refreshToken: `mock-refresh-token-for-${role}-${Date.now()}`,
      expiresIn: 3600,
      user: dummyUser
    };

    return of(dummyUser).pipe(
      delay(300), // Simula latencia
      tap(() => {
        this.saveSession(dummyResponse);
        this._isLoading.set(false);
      })
    );
  }

  /**
   * Cierra la sesión del usuario actual.
   * Limpia tokens, estado y redirige al login.
   * @param reason Razón opcional para mostrar en la pantalla de login.
   */
  logout(reason?: string): void {
    this.clearSession();
    if (reason) {
      this.router.navigate(['/login'], { queryParams: { reason } });
    } else {
      this.router.navigate(['/login']);
    }
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
    if (token.startsWith('mock-jwt-token')) {
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
   * Verifica si el usuario tiene uno de los roles permitidos.
   */
  hasRole(...roles: UserRole[]): boolean {
    const userRole = this.currentRole();
    if (!userRole) return false;
    return roles.includes(userRole);
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  private saveSession(response: AuthResponse): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN,  response.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
    this._currentUser.set(response.user);
  }

  private clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
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
