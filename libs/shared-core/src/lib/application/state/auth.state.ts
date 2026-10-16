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
      'ROLE_ADMIN': 'Director General (Admin)',
      'ADMIN': 'Director General (Admin)',
      'ROLE_OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'ROLE_OPERATIONS_COORDINATOR': 'Coordinador de Operaciones',
      'OPERATIONS_COORDINATOR': 'Coordinador de Operaciones',
      'ROLE_OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones',
      'OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones',
      'ROLE_CONTROL_DESK': 'Mesa de Control',
      'CONTROL_DESK': 'Mesa de Control',
      'ROLE_SHIFT_LEADER': 'Líder de Turno',
      'SHIFT_LEADER': 'Líder de Turno',
      'ROLE_WAREHOUSE_OPERATOR': 'Montacarguista',
      'WAREHOUSE_OPERATOR': 'Montacarguista',
      'ROLE_QM_INSPECTOR': 'Inspector de Calidad',
      'QM_INSPECTOR': 'Inspector de Calidad',
      'ROLE_SECURITY_GUARD': 'Guardia de Seguridad',
      'SECURITY_GUARD': 'Guardia de Seguridad',
      'ROLE_FORKLIFT_OPERATOR': 'Montacarguista',
      'FORKLIFT_OPERATOR': 'Montacarguista',
      'ROLE_AUDITOR': 'Auditor de Inventarios',
      'AUDITOR': 'Auditor de Inventarios',
      'ROLE_CLIENT': 'Cliente 3PL',
      'CLIENT': 'Cliente 3PL',
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

  private redirectAfterLogin(_user: User): void {
    // Redirección estándar inicial siempre al Menú de Operaciones
    this.router.navigate(['/menu']);
  }
}
