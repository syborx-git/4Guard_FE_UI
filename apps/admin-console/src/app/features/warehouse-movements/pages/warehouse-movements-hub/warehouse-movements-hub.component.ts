/**
 * @file warehouse-movements-hub.component.ts
 * @description Hub principal de Movimientos de Almacén WMS.
 * Replica la interfaz de la Consola de Administración (Captura 1) con cuadrícula de tarjetas Liquid Glass.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';

interface MovementHubCard {
  id: string;
  index: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  actionText: string;
}

@Component({
  selector: 'fg-warehouse-movements-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './warehouse-movements-hub.component.html',
  styleUrl: './warehouse-movements-hub.component.css',
})
export class WarehouseMovementsHubComponent {
  protected readonly movementsService = inject(WarehouseMovementsService);
  private readonly router = inject(Router);

  protected readonly movementCards: MovementHubCard[] = [
    {
      id: 'receiving',
      index: '01',
      title: 'RECEPCIÓN DE MERCANCÍA',
      description: 'Pre-recepción caseta (F01), alta en andén, cancelación de recepciones, cambio de remisión y consulta de folios.',
      icon: 'move_to_inbox',
      route: '/warehouse-movements/receiving',
      actionText: 'GESTIONAR RECEPCIÓN',
    },
    {
      id: 'transfers',
      index: '02',
      title: 'CAMBIO DE ALMACÉN (TRASPASOS)',
      description: 'Traspaso entre las 6 bodegas (A, APC, AT, B, BPC, BT), cambio de estatus y validación de ceros.',
      icon: 'compare_arrows',
      route: '/warehouse-movements/transfers',
      actionText: 'GESTIONAR TRASPASO',
    },
    {
      id: 'outbound',
      index: '03',
      title: 'SALIDAS DE ALMACÉN (DESPACHO)',
      description: 'Orden de surtido FIFO/FEFO, asignación de rampas de embarque, generación de remisión y cierre de despacho.',
      icon: 'local_shipping',
      route: '/warehouse-movements/outbound',
      actionText: 'GESTIONAR DESPACHO',
    },
  ];

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
