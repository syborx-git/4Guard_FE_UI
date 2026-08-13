/**
 * @file warehouse-movements-shell.component.ts
 * @description Shell contenedor del módulo Movimientos de Almacén.
 * Controla la barra de navegación superior y el botón para retornar al Hub Dashboard.
 */

import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

interface MovementTabItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'fg-warehouse-movements-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './warehouse-movements-shell.component.html',
  styleUrl: './warehouse-movements-shell.component.css',
})
export class WarehouseMovementsShellComponent {
  private readonly router = inject(Router);

  // Escuchar ruta activa
  private readonly currentUrlSignal = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  // Es vista de Hub Dashboard (si la ruta es exactamente /warehouse-movements)
  protected readonly isHubView = computed(() => {
    const url = this.currentUrlSignal() || '';
    return url === '/warehouse-movements' || url === '/warehouse-movements/';
  });

  protected readonly tabs: MovementTabItem[] = [
    {
      label: 'Recepción de Mercancía',
      route: '/warehouse-movements/receiving',
      icon: 'move_to_inbox',
    },
    {
      label: 'Cambio de Almacén',
      route: '/warehouse-movements/transfers',
      icon: 'compare_arrows',
    },
    {
      label: 'Salidas de Almacén',
      route: '/warehouse-movements/outbound',
      icon: 'local_shipping',
    },
  ];
}
