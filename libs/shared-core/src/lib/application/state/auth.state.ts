/**
 * @file auth.state.ts
 * @description Store reactivo de sesión/autenticación usando Angular Signals.
 *
 * Thin wrapper sobre AuthService que expone el estado de autenticación
 * como signals derivadas para consumo en componentes.
 *
 * Patrón: providedIn: 'root' → Singleton.
 */

import { Injectable, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from '../../infrastructure/services/auth.service';
import { LoginRequest, User } from '../../domain/models/user.model';
import { UserRole } from '../../domain/enums/role.enum';
import { hasModuleAccess } from '../../domain/enums/role.enum';

@Injectable({ providedIn: 'root' })
export class AuthState {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ─── Señales derivadas del AuthService ────────────────────────────────────

  /** Usuario autenticado actual */
  readonly user = this.authService.currentUser;

  /** ¿Hay sesión activa? */
  readonly isAuthenticated = this.authService.isAuthenticated;

  /** Rol del usuario actual */
  readonly role = this.authService.currentRole;

  /** ID de la sucursal activa */
  readonly branchId = this.authService.branchId;

  /** Estado de carga durante auth */
  readonly isLoading = this.authService.isLoading;

  /** Nombre completo del usuario (para UI) */
  readonly userFullName = computed(() => this.authService.currentUser()?.fullName ?? '');

  /** Iniciales del usuario (para avatar) */
  readonly userInitials = computed(() => {
    const name = this.authService.currentUser()?.fullName ?? '';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  });

  /** Etiqueta legible del rol actual en español limpio */
  readonly roleLabel = computed(() => {
    const rawRole = this.authService.currentRole() || this.authService.currentUser()?.role || '';
    if (!rawRole) return 'Operario de Almacén';

    const normalized = String(rawRole).trim().toUpperCase();
    const labels: Record<string, string> = {
      'ROLE_ADMIN': 'Administrador',
      'ADMIN': 'Administrador',
      'ROLE_WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'ROLE_DOCK_SUPERVISOR': 'Supervisor de Andén',
      'DOCK_SUPERVISOR': 'Supervisor de Andén',
      'ROLE_WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'ROLE_QM_INSPECTOR': 'Inspector de Calidad',
      'QM_INSPECTOR': 'Inspector de Calidad',
      'ROLE_AUDITOR': 'Auditor de Inventarios',
      'AUDITOR': 'Auditor de Inventarios',
      'ROLE_CLIENT': 'Cliente 3PL',
      'CLIENT': 'Cliente 3PL',
      'ROLE_SECURITY_GUARD': 'Guardia de Seguridad',
      'SECURITY_GUARD': 'Guardia de Seguridad',
      'ROLE_FORKLIFT_OPERATOR': 'Montacarguista',
      'FORKLIFT_OPERATOR': 'Montacarguista',
    };

    return labels[normalized] ?? 'Operario de Almacén';
  });

  // ─── Acciones ─────────────────────────────────────────────────────────────

  /**
   * Ejecuta el login y redirige a la ruta correspondiente al rol.
   */
  login(credentials: LoginRequest): Observable<User> {
    return this.authService.login(credentials).pipe(
      tap((user) => this.redirectAfterLogin(user)),
    );
  }

  /**
   * Completa el proceso de inicio de sesión guardando la sesión activa con la sucursal
   * seleccionada y redirigiendo al dashboard o módulo inicial correspondiente al rol.
   */
  completeLogin(user: User, accessToken: string, refreshToken: string): void {
    this.authService.saveSession({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user
    });
    this.redirectAfterLogin(user);
  }

  /**
   * Cierra la sesión del usuario actual.
   * @param reason Razón opcional del cierre de sesión.
   */
  logout(reason?: string): void {
    this.authService.logout(reason);
  }

  /**
   * Verifica si el usuario actual tiene acceso a un módulo específico.
   */
  canAccessModule(module: string): boolean {
    const role = this.role();
    if (!role) return false;
    return hasModuleAccess(role, module);
  }

  /**
   * Verifica si el usuario tiene uno o más roles permitidos.
   */
  hasRole(...roles: UserRole[]): boolean {
    return this.authService.hasRole(...roles);
  }

  /**
   * Cambia el rol del usuario activo para pruebas rápidas de interfaz (RBAC demo switcher).
   */
  switchRoleForTesting(role: UserRole, customName?: string): void {
    this.authService.switchRoleForTesting(role, customName);
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private redirectAfterLogin(user: User): void {
    const roleRoutes: Partial<Record<UserRole, string>> = {
      [UserRole.ADMIN]: '/dashboard',
      [UserRole.WAREHOUSE_MANAGER]: '/dashboard',
      [UserRole.DOCK_SUPERVISOR]: '/receiving',
      [UserRole.WAREHOUSE_OPERATOR]: '/picking',
      [UserRole.QM_INSPECTOR]: '/quality',
      [UserRole.AUDITOR]: '/dashboard',
      [UserRole.CLIENT]: '/dashboard',
      [UserRole.SECURITY_GUARD]: '/security',
    };

    const route = roleRoutes[user.role] ?? '/dashboard';
    this.router.navigate([route]);
  }
}
