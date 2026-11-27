/**
 * @file auth.state.ts
 * @description Estado global de autenticación gestionado con Angular Signals para reactividad de alto rendimiento.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStorageService } from '../services/session-storage.service';
import { AuthService } from '../services/auth.service';
import { AuthenticatedUser, JwtSession, ShiftType } from '../models/auth.models';

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
  private readonly _currentShift = signal<ShiftType>(this._currentUser()?.shift || 'TURNO 1');

  // ─── Señales Públicas Read-Only ───────────────────────────────────────────
  readonly currentUser = this._currentUser.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();
  readonly refreshToken = this._refreshToken.asReadonly();
  readonly currentShift = this._currentShift.asReadonly();

  // ─── Señales Computadas Derivadas ──────────────────────────────────────────
  readonly userShiftBadge = computed(() => this._currentShift() || 'TURNO 1');

  // ─── Señales Computadas Derivadas ──────────────────────────────────────────
  readonly isAuthenticated = computed(() => {
    return this._currentUser() !== null && !this.authService.isTokenExpired();
  });

  readonly role = computed(() => this._currentUser()?.role ?? null);
  readonly roleLevel = computed(() => this._currentUser()?.roleLevel ?? 0);
  readonly permissions = computed(() => this._currentUser()?.permissions ?? []);

  private static readonly EXECUTIVE_DIRECTOR_ROLES = new Set([
    'ADMIN',
    'CEO',
    'DIRECTOR',
    'SUPER_ADMIN',
  ]);

  /**
   * Indica si el usuario pertenece estrictamente a Dirección Ejecutiva
   * (ADMIN, CEO, DIRECTOR, SUPER_ADMIN), sin bypass para gerencias operativas.
   */
  readonly isExecutiveDirector = computed<boolean>(() => {
    const rawRole = this.role();
    if (!rawRole) return false;
    const normalized = String(rawRole).trim().toUpperCase().replace(/^ROLE_/, '');
    return AuthState.EXECUTIVE_DIRECTOR_ROLES.has(normalized);
  });

  /** Indica si el usuario actual es exclusivo de chat (CHAT_ONLY) conforme a ADR-022 */
  readonly isChatOnlyUser = computed(() => {
    const user = this._currentUser();
    if (!user) return false;

    const normRole = (user.role || '').trim().toUpperCase();
    if (normRole === 'CHAT_ONLY' || normRole === 'ROLE_CHAT_ONLY') {
      return true;
    }

    const perms = (user.permissions ?? []).map((p) => String(p).trim().toUpperCase());
    if (perms.length === 0) {
      return false;
    }

    const chatPerms = new Set(['CHAT_ONLY', 'CHAT_ACCESS']);
    return perms.some((p) => chatPerms.has(p)) && perms.every((p) => chatPerms.has(p));
  });

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
      'ADMIN': 'Director General',
      'ROLE_ADMIN': 'Director General',
      'CEO': 'Director General',
      'ROLE_CEO': 'Director General',
      'OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'ROLE_OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'OPERATIONS_COORDINATOR': 'Coordinador de Operaciones',
      'ROLE_OPERATIONS_COORDINATOR': 'Coordinador de Operaciones',
      'OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones',
      'ROLE_OPERATIONS_SUPERVISOR': 'Supervisor de Operaciones',
      'CONTROL_DESK': 'Mesa de Control',
      'ROLE_CONTROL_DESK': 'Mesa de Control',
      'SHIFT_LEADER': 'Líder de Turno',
      'ROLE_SHIFT_LEADER': 'Líder de Turno',
      'QM_INSPECTOR': 'Inspector de Calidad',
      'ROLE_QM_INSPECTOR': 'Inspector de Calidad',
      'WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'ROLE_WAREHOUSE_OPERATOR': 'Operario de Almacén',
      'SECURITY_GUARD': 'Guardia de Seguridad',
      'ROLE_SECURITY_GUARD': 'Guardia de Seguridad',
      'WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'ROLE_WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'DOCK_SUPERVISOR': 'Supervisor de Andén',
      'ROLE_DOCK_SUPERVISOR': 'Supervisor de Andén',
      'AUDITOR': 'Auditor',
      'ROLE_AUDITOR': 'Auditor',
      'CLIENT': 'Cliente 3PL',
      'ROLE_CLIENT': 'Cliente 3PL',
      'CHAT_ONLY': 'Comunicación Interna (Solo Chat)',
      'ROLE_CHAT_ONLY': 'Comunicación Interna (Solo Chat)',
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
   * Actualiza parcialmente el usuario de la sesión actual en memoria y LocalStorage.
   */
  updateCurrentUser(userUpdate: Partial<AuthenticatedUser>): void {
    const current = this._currentUser();
    if (current) {
      const updated = { ...current, ...userUpdate };
      this._currentUser.set(updated);
      this.sessionStorageService.updateUser(updated);
    }
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
      return;
    }

    if (this.isChatOnlyUser()) {
      localStorage.removeItem('4g_return_url');
      localStorage.removeItem('4g_pending_process_name');
      this.router.navigate(['/chat']);
      return;
    }

    const normLoginRole = (session.user.role || '').toUpperCase();
    if (
      normLoginRole === 'SECURITY_GUARD' ||
      normLoginRole === 'ROLE_SECURITY_GUARD' ||
      normLoginRole === 'VIGILANCIA' ||
      normLoginRole === 'ROLE_VIGILANCIA' ||
      normLoginRole === 'GUARD' ||
      normLoginRole === 'ROLE_GUARD' ||
      normLoginRole.includes('GUARD') ||
      normLoginRole.includes('VIGILAN') ||
      normLoginRole.includes('CASETA')
    ) {
      localStorage.removeItem('4g_return_url');
      localStorage.removeItem('4g_pending_process_name');
      this.router.navigate(['/security']);
      return;
    }

    const returnUrl = localStorage.getItem('4g_return_url');
    const pendingProcess = localStorage.getItem('4g_pending_process_name');

    if (returnUrl && returnUrl !== '/dashboard') {
      if (pendingProcess) {
        localStorage.setItem('4g_resumed_process_name', pendingProcess);
      }
      localStorage.removeItem('4g_return_url');
      localStorage.removeItem('4g_pending_process_name');
      this.router.navigateByUrl(returnUrl);
    } else {
      localStorage.removeItem('4g_return_url');
      localStorage.removeItem('4g_pending_process_name');
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
   * Bloquea la estación de trabajo preservando la ruta y el formulario activo en memoria.
   */
  lockWorkstation(): void {
    const currentUrl = this.router.url;
    if (currentUrl && currentUrl !== '/login') {
      localStorage.setItem('4g_return_url', currentUrl);
      localStorage.setItem('4g_pending_process_name', 'Proceso de Trabajo Activo en Andén');
    }
    this.logout('inactivity');
  }

  /**
   * Conmuta atómicamente la señal del usuario/operador activo mediante PIN de 4 dígitos.
   */
  switchOperator(newOperator: AuthenticatedUser, pin: string): boolean {
    const expectedPin = newOperator.pinCode;
    if (!expectedPin) return false;
    if (pin.trim() !== expectedPin) {
      return false;
    }

    const updatedUser: AuthenticatedUser = {
      ...newOperator,
      shift: newOperator.shift || 'TURNO 1'
    };

    const session = this.sessionStorageService.getSession();
    if (session) {
      session.user = updatedUser;
      this.sessionStorageService.saveSession(session);
    } else {
      return false; // Requiere sesion autenticada previa
    }

    this._currentUser.set(updatedUser);
    this._currentShift.set(updatedUser.shift || 'TURNO 1');

    if (this.canAccessModule('security') && !this.canAccessModule('dashboard')) {
      const currentUrl = this.router.url;
      if (!currentUrl.startsWith('/security')) {
        this.router.navigate(['/security']);
      }
    } else if (this.canAccessModule('quality') && !this.canAccessModule('dashboard')) {
      const currentUrl = this.router.url;
      if (!currentUrl.startsWith('/quality')) {
        this.router.navigate(['/quality']);
      }
    }

    return true;
  }

  /**
   * Verifica si el usuario actual tiene acceso a un módulo específico (Compatibilidad y SoD).
   */
  canAccessModule(module: string): boolean {
    if (this.isChatOnlyUser()) {
      return module === 'chat';
    }

    const rawRole = this.role();
    if (!rawRole) return false;

    const normRole = String(rawRole).trim().toUpperCase();

    // 0. Director General / Administradores / Gerente de Operaciones y Almacén: Acceso total e irrestricto a todos los módulos (incluyendo Calidad)
    if (
      normRole === 'SUPER_ADMIN' ||
      normRole === 'ROLE_SUPER_ADMIN' ||
      normRole === 'ROLE_ADMIN' ||
      normRole === 'ADMIN' ||
      normRole === 'CEO' ||
      normRole === 'ROLE_CEO' ||
      normRole === 'OPERATIONS_MANAGER' ||
      normRole === 'ROLE_OPERATIONS_MANAGER' ||
      normRole === 'WAREHOUSE_MANAGER' ||
      normRole === 'ROLE_WAREHOUSE_MANAGER'
    ) {
      return true;
    }

    // 2. Coordinador de Operaciones: Enlace táctico entre gerencia y supervisión
    // Módulos: Dashboard, Recepción (movimientos), Rendimiento, Almacén/Topología, Consulta Inventario
    if (
      normRole === 'OPERATIONS_COORDINATOR' ||
      normRole === 'ROLE_OPERATIONS_COORDINATOR'
    ) {
      return (
        module === 'dashboard' ||
        module === 'warehouse-movements' ||
        module === 'receiving' ||
        module === 'shipping' ||
        module === 'transfers' ||
        module === 'performance' ||
        module === 'catalogs' ||
        module === 'layout' ||
        module === 'inventory' ||
        module === 'inventory-query'
      );
    }

    // 3. Supervisor de Operaciones: Supervisión en piso, andenes, patio e inventarios
    if (
      normRole === 'OPERATIONS_SUPERVISOR' ||
      normRole === 'ROLE_OPERATIONS_SUPERVISOR' ||
      normRole === 'WAREHOUSE_SUPERVISOR' ||
      normRole === 'ROLE_WAREHOUSE_SUPERVISOR'
    ) {
      return (
        module === 'dashboard' ||
        module === 'warehouse-movements' ||
        module === 'receiving' ||
        module === 'shipping' ||
        module === 'transfers' ||
        module === 'catalogs' ||
        module === 'layout' ||
        module === 'inventory' ||
        module === 'inventory-query' ||
        module === 'security'
      );
    }

    // 4. Mesa de Control: Planeación y validación F01, balanceo y stock
    if (
      normRole === 'CONTROL_DESK' ||
      normRole === 'ROLE_CONTROL_DESK' ||
      normRole.includes('CONTROL_DESK') ||
      normRole.includes('MESA')
    ) {
      return (
        module === 'dashboard' ||
        module === 'warehouse-movements' ||
        module === 'receiving' ||
        module === 'shipping' ||
        module === 'transfers' ||
        module === 'catalogs' ||
        module === 'layout' ||
        module === 'inventory' ||
        module === 'inventory-query'
      );
    }

    // 5. Líder de Turno: Cuadrillas de montacargas, supervisión de descarga y stock
    if (
      normRole === 'SHIFT_LEADER' ||
      normRole === 'ROLE_SHIFT_LEADER' ||
      normRole.includes('LIDER')
    ) {
      return (
        module === 'dashboard' ||
        module === 'warehouse-movements' ||
        module === 'receiving' ||
        module === 'shipping' ||
        module === 'transfers' ||
        module === 'catalogs' ||
        module === 'layout' ||
        module === 'inventory' ||
        module === 'inventory-query'
      );
    }

    // 6. Guardia de Seguridad y Ayudante de Seguridad: Acceso exclusivo a Caseta (security)
    if (
      normRole === 'SECURITY_GUARD' ||
      normRole === 'ROLE_SECURITY_GUARD' ||
      normRole === 'SECURITY_ASSISTANT' ||
      normRole === 'ROLE_SECURITY_ASSISTANT' ||
      normRole === 'GUARD' ||
      normRole === 'ROLE_GUARD' ||
      normRole.includes('VIGILAN') ||
      normRole.includes('GUARD') ||
      normRole.includes('CASETA')
    ) {
      return module === 'security';
    }

    // 7. Inspector de Calidad y Ayudante de Calidad: Acceso exclusivo a Calidad (quality)
    if (
      normRole === 'QM_INSPECTOR' ||
      normRole === 'ROLE_QM_INSPECTOR' ||
      normRole === 'QUALITY_ASSISTANT' ||
      normRole === 'ROLE_QUALITY_ASSISTANT' ||
      normRole === 'QUALITY_AUDITOR' ||
      normRole === 'ROLE_QUALITY_AUDITOR' ||
      normRole.includes('QUALITY') ||
      normRole.includes('CALIDAD') ||
      normRole.includes('INSPECT')
    ) {
      return module === 'quality';
    }

    // 8. Montacarguista / Operador de Almacén: (Operan en RF Terminal)
    if (
      normRole === 'WAREHOUSE_OPERATOR' ||
      normRole === 'ROLE_WAREHOUSE_OPERATOR' ||
      normRole === 'FORKLIFT_OPERATOR' ||
      normRole === 'ROLE_FORKLIFT_OPERATOR' ||
      normRole.includes('MONTACARGA')
    ) {
      return (
        module === 'dashboard' ||
        module === 'warehouse-movements' ||
        module === 'receiving' ||
        module === 'inventory' ||
        module === 'inventory-query'
      );
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
        return permissions.includes('CARRIERS_READ') || permissions.includes('CARRIERS_CREATE');
      case 'suppliers':
        return permissions.includes('SUPPLIERS_READ') || permissions.includes('SUPPLIERS_CREATE');
      case 'warehouse-movements':
        return true;
      case 'catalogs':
        return true;
      case 'inventory-query':
        return true;
      case 'performance':
        return permissions.includes('PERFORMANCE_READ') || permissions.includes('REPORTS_READ');
      case 'shifts':
        return permissions.includes('SHIFTS_READ') || permissions.includes('SHIFTS_WRITE');
      case 'business-rules':
        return permissions.includes('BUSINESS_RULES_READ') || permissions.includes('BUSINESS_RULES_WRITE');
      case 'alerts-config':
        return permissions.includes('ALERTS_READ') || permissions.includes('ALERTS_WRITE');
      case 'security':
        return true; // Acceso total al nuevo módulo autónomo de Seguridad (Caseta)
      case 'user-activity':
        // HU-146: Solo OPERATIONS_SUPERVISOR, SHIFT_LEADER y OPERATIONS_MANAGER.
        // NOTA: La validación definitiva de RLS y permisos se ejecuta en el backend.
        // El frontend solo controla la visibilidad de la opción de menú y la ruta.
        return (
          normRole === 'OPERATIONS_SUPERVISOR' ||
          normRole === 'OPERATIONS_MANAGER' ||
          normRole === 'SHIFT_LEADER' ||
          normRole === 'ROLE_ADMIN' ||
          normRole === 'ADMIN' ||
          normRole === 'ROLE_WAREHOUSE_MANAGER' ||
          normRole === 'WAREHOUSE_MANAGER'
        );
      case 'chat-governance':
        return this.isExecutiveDirector();
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
