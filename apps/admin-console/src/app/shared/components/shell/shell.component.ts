/**
 * @file shell.component.ts
 * @description Layout Shell de admin-console: Sidebar + Header + Content.
 * Todos los módulos protegidos renderizan dentro de este componente.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthState, SyncState, UserRole } from '@4guard/shared-core';

interface NavItem {
  label:   string;
  route:   string;
  icon:    string;
  module:  string;
  badge?:  () => number;
}

@Component({
  selector: 'fg-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);

  protected isSidebarCollapsed = signal(false);

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard',   route: '/dashboard',  icon: '⬛', module: 'dashboard' },
    { label: 'Inventario',  route: '/inventory',  icon: '📦', module: 'inventory' },
    { label: 'Recepción',   route: '/receiving',  icon: '🚛', module: 'receiving' },
    { label: 'Calidad',     route: '/quality',    icon: '🔍', module: 'quality'   },
    { label: 'Despacho',    route: '/shipping',   icon: '📤', module: 'shipping'  },
    { label: 'Administrar', route: '/admin',      icon: '⚙️', module: 'admin'     },
  ];

  /** Filtra los nav items según el rol del usuario */
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.authState.canAccessModule(item.module)),
  );

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  protected logout(): void {
    this.authState.logout();
  }
}
