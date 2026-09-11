/**
 * @file catalogs-hub.component.ts
 * @description Hub principal de Catálogos Maestros WMS.
 * Replica la interfaz de la Consola de Administración (Captura 1) con cuadrícula de tarjetas Liquid Glass.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CatalogsService } from '../../services/catalogs.service';

interface CatalogHubCard {
  id: string;
  index: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  badge?: string;
  actionText: string;
}

@Component({
  selector: 'fg-catalogs-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './catalogs-hub.component.html',
  styleUrl: './catalogs-hub.component.css',
})
export class CatalogsHubComponent {
  protected readonly catalogsService = inject(CatalogsService);
  private readonly router = inject(Router);

  protected readonly catalogCards: CatalogHubCard[] = [
    {
      id: 'users',
      index: '01',
      title: 'USUARIOS',
      description: 'Registro de personal, asignación de roles RBAC, consulta de accesos y bitácora de auditoría.',
      icon: 'manage_accounts',
      route: '/catalogs/users',
      actionText: 'CONFIGURAR',
    },
    {
      id: 'clients',
      index: '02',
      title: 'CLIENTES / OWNERS',
      description: 'Registro de Razón Social, RFC, contraseñas de portal web, matriz de contactos y Destinos Físicos de Entrega.',
      icon: 'business',
      route: '/catalogs/clients',
      actionText: 'CONFIGURAR',
    },
    {
      id: 'products',
      index: '03',
      title: 'PRODUCTOS',
      description: 'Maestro de artículos, selector de 20 proveedores oficiales, unidades de medida y trazabilidad NOM-251.',
      icon: 'inventory_2',
      route: '/catalogs/products',
      actionText: 'CONFIGURAR',
    },
    {
      id: 'warehouse',
      index: '04',
      title: 'TOPOLOGÍA DE ALMACÉN',
      description: 'Visualización y consulta de disponibilidad en tiempo real para las 6 bodegas reales (A, APC, AT, B, BPC, BT).',
      icon: 'warehouse',
      route: '/catalogs/warehouse',
      actionText: 'VER TOPOLOGÍA',
    },
    {
      id: 'forklift',
      index: '05',
      title: 'MONTACARGUISTAS & SCORECARD',
      description: 'Métricas de desempeño en andén, efectividad en ubicaciones, vigencia de licencias DC-3 y gestión de rotación.',
      icon: 'engineering',
      route: '/catalogs/forklift-operators',
      actionText: 'VER SCORECARD',
    },
  ];

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
