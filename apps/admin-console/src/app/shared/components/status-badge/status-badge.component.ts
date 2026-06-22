/**
 * @file status-badge.component.ts
 * @description Componente reutilizable para mostrar el estado de inventario
 * con color semántico según la FSM de 8 estados de 4GUARD.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';

@Component({
  selector: 'fg-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css',
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: InventoryStatus;

  /** Etiqueta legible del estado */
  get label(): string {
    return INVENTORY_STATUS_LABELS[this.status] ?? String(this.status);
  }

  /** Clase CSS del estado (usa variables CSS definidas en design-tokens) */
  get statusClass(): string {
    return `status-badge--${this.status}`;
  }
}
