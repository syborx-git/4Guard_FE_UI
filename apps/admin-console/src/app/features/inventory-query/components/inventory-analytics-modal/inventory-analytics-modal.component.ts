/**
 * @file inventory-analytics-modal.component.ts
 * @description Modal de Analítica Histórica de Ingresos por Año para 4GUARD WMS.
 * Muestra la tendencia de distribución de palets y piezas según el ID consecutivo del palet.
 */

import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryQueryService } from '../../services/inventory-query.service';

@Component({
  selector: 'fg-inventory-analytics-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-analytics-modal.component.html',
  styleUrl: './inventory-analytics-modal.component.css'
})
export class InventoryAnalyticsModalComponent {
  protected readonly inventoryService = inject(InventoryQueryService);

  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  protected onClose(): void {
    this.closeModal.emit();
  }
}
