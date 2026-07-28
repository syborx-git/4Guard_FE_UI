/**
 * @file auth.state.ts
 * @description Estado global de autenticación gestionado con Angular Signals para reactividad de alto rendimiento.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStorageService } from '../services/session-storage.service';
import { AuthService } from '../services/auth.service';
import { AuthenticatedUser, JwtSession } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthState {
  private readonly authService = inject(AuthService);
  private readonly sessionStorageService = inject(SessionStorageService);
  private readonly router = inject(Router);

  // ─── Señales de Estado Privadas ───────────────────────────────────────────
  private readonly _currentUser = signal<AuthenticatedUser | null>(this.sessionStorageService.getUser());
  private readonly _accessToken = signal<string | null>(this.sessionStorageService.getAccessToken());
  private readonly _refreshToken = signal<string | null>(this.sessionStorageService.getRefreshToken());

  // ─── Señales Públicas Read-Only ───────────────────────────────────────────
  readonly currentUser = this._currentUser.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();

  // ─── Señales Computadas Derivadas ──────────────────────────────────────────
  readonly isAuthenticated = computed(() => {
    return this._currentUser() !== null && !this.authService.isTokenExpired();
  });

  readonly role = computed(() => this._currentUser()?.role ?? null);
  readonly roleLevel = computed(() => this._currentUser()?.roleLevel ?? 0);
  readonly permissions = computed(() => this._currentUser()?.permissions ?? []);

  /** Nombre completo del usuario para visualización en UI */
  readonly userFullName = computed(() => this._currentUser()?.fullName ?? '');

  /** Iniciales del usuario para avatares */
  readonly userInitials = computed(() => {
    const name = this.userFullName();
    if (!name) return '';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  });

  /** Traducción o formateo del rol actual para etiquetas legibles */
  readonly roleLabel = computed(() => {
    const role = this.role();
    if (!role) return '';

    const labels: Record<string, string> = {
      'ADMIN': 'Administrador',
      'ROLE_ADMIN': 'Administrador',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'ROLE_WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'ROLE_OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'DOCK_SUPERVISOR': 'Supervisor de Andén',
      'ROLE_DOCK_SUPERVISOR': 'Supervisor de Andén',
      'WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'ROLE_WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'QM_INSPECTOR': 'Inspector de Calidad',
      'ROLE_QM_INSPECTOR': 'Inspector de Calidad',
      'AUDITOR': 'Auditor',
      'ROLE_AUDITOR': 'Auditor',
      'CLIENT': 'Cliente 3PL',
      'ROLE_CLIENT': 'Cliente 3PL',
    };

    return labels[role] ?? role.replace('ROLE_', '').replace(/_/g, ' ');
  });

  // ─── Acciones de Estado ───────────────────────────────────────────────────

  /**
   * Guarda y establece una nueva sesión activa actualizando LocalStorage y las señales.
   */
  setSession(session: JwtSession): void {
    this.sessionStorageService.saveSession(session);
    this._currentUser.set(session.user);
    this._accessToken.set(session.accessToken);
    this._refreshToken.set(session.refreshToken);
  }

  /**
   * Borra la sesión activa de LocalStorage y resetea las señales.
   */
  clearSession(): void {
    this.sessionStorageService.clearSession();
    this._currentUser.set(null);
    this._accessToken.set(null);
    this._refreshToken.set(null);
  }

  /**
   * Realiza el login exitoso, actualiza el estado y navega según el estado de la cuenta.
   *
   * Si el usuario debe cambiar su contraseña (changePasswordRequired === true),
   * navega a /change-password en lugar del dashboard.
   */
  login(session: JwtSession): void {
    this.setSession(session);
    if (session.user.changePasswordRequired) {
      this.router.navigate(['/change-password']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Cierra sesión llamando al BE (POST /auth/logout) y luego redirige al login.
   * La limpieza de la sesión local la realiza AuthService.clearSessionAndRedirect().
   * @param reason Razón opcional (ej: 'inactivity')
   */
  logout(reason?: string): void {
    // Si hay una razón especial (ej: inactividad), la sesion ya fue limpiada
    // por InactivityService. Solo limpiamos localmente y redirigimos.
    if (reason) {
      this.clearSession();
      this.router.navigate(['/login'], { queryParams: { reason } });
      return;
    }
    // Logout normal: llamada al BE + limpieza local
    this.authService.logout();
  }

  /**
   * Verifica si el usuario actual tiene acceso a un módulo específico (Compatibilidad).
   */
  canAccessModule(module: string): boolean {
    const role = this.role();
    if (!role) return false;

    // Los Administradores y Gerentes de Operaciones tienen acceso completo
    if (
      role === 'ROLE_ADMIN' ||
      role === 'ADMIN' ||
      role === 'OPERATIONS_MANAGER' ||
      role === 'ROLE_OPERATIONS_MANAGER'
    ) {
      return true;
    }

    const permissions = this.permissions();

    switch (module) {
      case 'dashboard':
        return true;
      case 'sessions':
        return true; // Visible para todos; el backend filtra por rol
      case 'inventory':
        return permissions.includes('INVENTORY_READ') || permissions.includes('INVENTORY_CREATE');
      case 'layout':
        return permissions.includes('LAYOUT_READ') || permissions.includes('LAYOUT_CREATE');
      case 'admin':
        return permissions.includes('USERS_READ') || permissions.includes('USERS_CREATE');
      case 'receiving':
        return permissions.includes('RECEIVING_READ') || permissions.includes('RECEIVING_CREATE');
      case 'quality':
        return permissions.includes('QUALITY_READ') || permissions.includes('QUALITY_CREATE');
      case 'shipping':
        return permissions.includes('SHIPPING_READ') || permissions.includes('SHIPPING_CREATE');
      case 'carriers':
        return true; // Acceso total habilitado para desarrollo y testing
      case 'suppliers':
        return true; // Acceso total habilitado para desarrollo y testing
      case 'performance':
        return true; // Acceso total habilitado para desarrollo y testing
      case 'shifts':
        return true; // Acceso total habilitado para desarrollo y testing (HU-140)
      case 'business-rules':
        return true; // Acceso total habilitado para evaluación (HU-131)
      case 'currency-exchange':
        return true; // Acceso total habilitado para evaluación (HU-148)
      case 'user-activity':
        // HU-146: Solo OPERATIONS_SUPERVISOR, SHIFT_LEADER y OPERATIONS_MANAGER.
        // NOTA: La validación definitiva de RLS y permisos se ejecuta en el backend.
        // El frontend solo controla la visibilidad de la opción de menú y la ruta.
        return (
          role === 'OPERATIONS_SUPERVISOR' ||
          role === 'OPERATIONS_MANAGER' ||
          role === 'SHIFT_LEADER' ||
          role === 'ROLE_ADMIN' ||
          role === 'ADMIN' ||
          role === 'ROLE_WAREHOUSE_MANAGER' ||
          role === 'WAREHOUSE_MANAGER'
        );
      default:
        return false;
    }

  }

  /**
   * Valida si el rol del usuario está entre una lista de roles permitidos.
   */
  hasRole(...roles: string[]): boolean {
    const currentRole = this.role();
    return currentRole ? roles.includes(currentRole) : false;
  }
}
