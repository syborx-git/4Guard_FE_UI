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
import { Observable, tap, map } from 'rxjs';
import { AuthResponse, JwtPayload, LoginRequest, User } from '../../domain/models/user.model';
import { UserRole } from '../../domain/enums/role.enum';

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
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      tap((response) => {
        this.saveSession(response);
        this._isLoading.set(false);
      }),
      map((response) => response.user),
    );
  }

  /**
   * Cierra la sesión del usuario actual.
   * Limpia tokens, estado y redirige al login.
   */
  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Refresca el access token usando el refresh token almacenado.
   * Retorna el nuevo access token como string.
   */
  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    return this.http
      .post<AuthResponse>('/api/auth/refresh', { refreshToken })
      .pipe(
        tap((response) => this.saveSession(response)),
        map((response) => response.accessToken),
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
