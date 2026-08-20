/**
 * @file catalogs-shell.component.ts
 * @description Shell contenedor del módulo de Catálogos Maestros.
 * Controla la barra de navegación superior y el botón para retornar al Hub Dashboard.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { CatalogsService } from '../../services/catalogs.service';

interface CatalogTabItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'fg-catalogs-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './catalogs-shell.component.html',
  styleUrl: './catalogs-shell.component.css',
})
export class CatalogsShellComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly router = inject(Router);

  // Escuchar ruta activa
  private readonly currentUrlSignal = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  // Es vista de Hub Dashboard (si la ruta es exactamente /catalogs)
  protected readonly isHubView = computed(() => {
    const url = this.currentUrlSignal() || '';
    return url === '/catalogs' || url === '/catalogs/';
  });

  protected readonly tabs: CatalogTabItem[] = [
    {
      label: 'Almacén / Topología',
      route: '/catalogs/warehouse',
      icon: 'warehouse',
      description: 'Layout y 6 bodegas reales',
    },
  ];
}
