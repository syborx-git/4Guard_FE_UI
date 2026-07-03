/**
 * @file auth.service.ts
 * @description Servicio principal de Autenticación JWT que interactúa con la API del Backend.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, AuthenticatedUser } from '../models/auth.models';
import { SessionStorageService } from './session-storage.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionStorageService = inject(SessionStorageService);

  private readonly API_URL = 'http://localhost:8080/api/v1/auth';

  /**
   * Envía las credenciales al backend para iniciar sesión.
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials);
  }

  /**
   * Refresca el token JWT de la sesión activa.
   */
  refreshToken(): Observable<LoginResponse> {
    const refreshToken = this.getRefreshToken();
    return this.http.post<LoginResponse>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.sessionStorageService.saveSession(response.data);
        }
      })
    );
  }

  /**
   * Cierra la sesión activa en el cliente.
   */
  logout(): void {
    this.sessionStorageService.clearSession();
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
    return this.sessionStorageService.getAccessToken();
  }

  /**
   * Obtiene el refreshToken actual.
   */
  getRefreshToken(): string | null {
    return this.sessionStorageService.getRefreshToken();
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
