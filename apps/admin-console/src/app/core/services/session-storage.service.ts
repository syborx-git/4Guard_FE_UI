/**
 * @file session-storage.service.ts
 * @description Servicio encargado únicamente del almacenamiento y recuperación de la sesión en LocalStorage.
 */

import { Injectable } from '@angular/core';
import { JwtSession, AuthenticatedUser } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService {
  private readonly SESSION_KEY = 'session';

  /**
   * Guarda únicamente el objeto data de la respuesta (JwtSession) en LocalStorage.
   */
  saveSession(session: JwtSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  /**
   * Obtiene la sesión actual almacenada en LocalStorage.
   */
  getSession(): JwtSession | null {
    const sessionStr = localStorage.getItem(this.SESSION_KEY);
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr) as JwtSession;
    } catch {
      return null;
    }
  }

  /**
   * Limpia por completo la sesión almacenada.
   */
  clearSession(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Obtiene el accessToken de la sesión activa.
   */
  getAccessToken(): string | null {
    const session = this.getSession();
    return session ? session.accessToken : null;
  }

  /**
   * Obtiene el refreshToken de la sesión activa.
   */
  getRefreshToken(): string | null {
    const session = this.getSession();
    return session ? session.refreshToken : null;
  }

  /**
   * Obtiene la información del usuario de la sesión activa.
   */
  getUser(): AuthenticatedUser | null {
    const session = this.getSession();
    return session ? session.user : null;
  }

  /**
   * Obtiene los permisos del usuario actual.
   */
  getPermissions(): string[] {
    const user = this.getUser();
    return user ? user.permissions : [];
  }

  /**
   * Obtiene el rol del usuario actual.
   */
  getRole(): string | null {
    const user = this.getUser();
    return user ? user.role : null;
  }

  /**
   * Obtiene el nivel del rol del usuario actual.
   */
  getRoleLevel(): number {
    const user = this.getUser();
    return user ? user.roleLevel : 0;
  }

  /**
   * Indica si hay una sesión activa guardada.
   */
  isLogged(): boolean {
    return this.getSession() !== null;
  }

  // ─── Gestión de Bloqueos e Intentos Fallidos (HU-010) ───────────────────
  private readonly LOCKOUT_KEY = '4guard_auth_lockout';
  private readonly FAILED_ATTEMPTS_KEY = '4guard_failed_attempts';

  normalizeIdentifier(identifier: string): string {
    return (identifier || '').trim().toLowerCase();
  }

  saveFailedAttempts(identifier: string, attempts: number): void {
    const key = this.normalizeIdentifier(identifier);
    if (!key) return;
    try {
      const currentMapStr = localStorage.getItem(this.FAILED_ATTEMPTS_KEY);
      const map: Record<string, number> = currentMapStr ? JSON.parse(currentMapStr) : {};
      map[key] = attempts;
      localStorage.setItem(this.FAILED_ATTEMPTS_KEY, JSON.stringify(map));
    } catch {
      localStorage.removeItem(this.FAILED_ATTEMPTS_KEY);
    }
  }

  getFailedAttempts(identifier: string): number {
    const key = this.normalizeIdentifier(identifier);
    if (!key) return 0;
    try {
      const currentMapStr = localStorage.getItem(this.FAILED_ATTEMPTS_KEY);
      if (!currentMapStr) return 0;
      const map: Record<string, number> = JSON.parse(currentMapStr);
      return typeof map[key] === 'number' ? map[key] : 0;
    } catch {
      localStorage.removeItem(this.FAILED_ATTEMPTS_KEY);
      return 0;
    }
  }

  clearFailedAttempts(identifier: string): void {
    const key = this.normalizeIdentifier(identifier);
    if (!key) return;
    try {
      const currentMapStr = localStorage.getItem(this.FAILED_ATTEMPTS_KEY);
      if (!currentMapStr) return;
      const map: Record<string, number> = JSON.parse(currentMapStr);
      delete map[key];
      localStorage.setItem(this.FAILED_ATTEMPTS_KEY, JSON.stringify(map));
    } catch {
      localStorage.removeItem(this.FAILED_ATTEMPTS_KEY);
    }
  }

  setAuthLockout(state: { identifier: string; failedAttempts: number; lockedUntil: number }): void {
    try {
      const normalizedState = {
        ...state,
        identifier: this.normalizeIdentifier(state.identifier),
      };
      localStorage.setItem(this.LOCKOUT_KEY, JSON.stringify(normalizedState));
    } catch {
      localStorage.removeItem(this.LOCKOUT_KEY);
    }
  }

  getAuthLockout(): { identifier: string; failedAttempts: number; lockedUntil: number } | null {
    const lockoutStr = localStorage.getItem(this.LOCKOUT_KEY);
    if (!lockoutStr) return null;
    try {
      const state = JSON.parse(lockoutStr);
      if (
        state &&
        typeof state.identifier === 'string' &&
        typeof state.lockedUntil === 'number' &&
        typeof state.failedAttempts === 'number'
      ) {
        return state;
      }
      this.clearAuthLockout();
      return null;
    } catch {
      this.clearAuthLockout();
      return null;
    }
  }

  clearAuthLockout(): void {
    localStorage.removeItem(this.LOCKOUT_KEY);
  }
}
