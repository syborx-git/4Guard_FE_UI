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
}
