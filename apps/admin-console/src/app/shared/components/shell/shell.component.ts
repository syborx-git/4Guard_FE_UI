/**
 * @file shell.component.ts
 * @description Layout Shell de admin-console: Sidebar + Header + Content.
 * Todos los modulos protegidos renderizan dentro de este componente.
 * Rediseno premium: sidebar oscuro, Material Symbols, branch selector.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SyncState, UserRole } from '@4guard/shared-core';
import { AuthState } from '../../../core/auth/auth.state';

interface NavItem {
  label: string;
  route: string;
  icon: string;   // Material Symbols name
  module: string;
  badge?: () => number;
}

import { PasswordCollapseComponent } from '../password-collapse/password-collapse.component';

@Component({
  selector: 'fg-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PasswordCollapseComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  private readonly router = inject(Router);

  protected isSidebarCollapsed = signal(false);

  /** Navega al perfil de usuario */
  goToProfile() {
    this.router.navigate(['/profile']);
  }

  /** Controla la apertura del panel de cambio de contraseña */
  isPasswordDrawerOpen = signal(false);

  /** Conteo de alertas criticas (demo: 2) */
  protected readonly criticalCount = signal(2);

  /** Texto de ultima actualizacion */
  protected readonly lastUpdated = signal('ahora');

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', module: 'dashboard' },
    { label: 'Inventario', route: '/inventory', icon: 'inventory_2', module: 'inventory' },
    { label: 'Recepcion', route: '/receiving', icon: 'move_to_inbox', module: 'receiving' },
    { label: 'Calidad', route: '/quality', icon: 'fact_check', module: 'quality' },
    { label: 'Despacho', route: '/shipping', icon: 'local_shipping', module: 'shipping' },
    { label: 'Administrar', route: '/admin', icon: 'manage_accounts', module: 'admin' },
    { label: 'Sesiones', route: '/sessions', icon: 'group', module: 'sessions' },
  ];

  /** Filtra los nav items segun el rol del usuario */
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.authState.canAccessModule(item.module)),
  );

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  openPasswordDrawer(): void {
    console.log('ShellComponent: Opening password drawer...');
    this.isPasswordDrawerOpen.set(true);
  }

  closePasswordDrawer(): void {
    console.log('ShellComponent: Closing password drawer...');
    this.isPasswordDrawerOpen.set(false);
  }

  protected logout(): void {
    this.authState.logout();
  }
}
