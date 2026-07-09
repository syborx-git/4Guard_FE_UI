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

  /** Etiqueta legible del rol actual */
  readonly roleLabel = computed(() => {
    const role = this.authService.currentRole();
    if (!role) return '';
    const labels: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'Administrador',
      [UserRole.WAREHOUSE_MANAGER]: 'Gerente de Almacén',
      [UserRole.DOCK_SUPERVISOR]: 'Supervisor de Andén',
      [UserRole.WAREHOUSE_OPERATOR]: 'Operario de Almacén',
      [UserRole.QM_INSPECTOR]: 'Inspector de Calidad',
      [UserRole.AUDITOR]: 'Auditor',
      [UserRole.CLIENT]: 'Cliente 3PL',
    };
    return labels[role] ?? role;
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
    };

    const route = roleRoutes[user.role] ?? '/dashboard';
    this.router.navigate([route]);
  }
}
