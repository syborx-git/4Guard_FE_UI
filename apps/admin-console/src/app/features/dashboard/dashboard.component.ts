/**
 * @file dashboard.component.ts
 * @description Componente de Dashboard para admin-console.
 * Muestra KPIs de inventario en tiempo real usando Angular Signals.
 */

import { Component, inject, OnInit, computed } from '@angular/core';
import { InventoryState, InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  selector: 'fg-admin-dashboard',
  standalone: true,
  imports: [StatusBadgeComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  protected readonly inventoryState = inject(InventoryState);

  protected readonly InventoryStatus = InventoryStatus;

  protected readonly kpiCards = computed(() => [
    {
      label:   'Disponibles',
      value:   this.inventoryState.items().filter(i => i.status === InventoryStatus.AVAILABLE).length,
      status:  InventoryStatus.AVAILABLE,
      icon:    '✅',
    },
    {
      label:   'En Cuarentena',
      value:   this.inventoryState.quarantineCount(),
      status:  InventoryStatus.QUARANTINE,
      icon:    '⚠️',
    },
    {
      label:   'Bloqueados QM',
      value:   this.inventoryState.qmBlockedCount(),
      status:  InventoryStatus.QM_BLOCKED,
      icon:    '🔒',
    },
    {
      label:   'En Picking',
      value:   this.inventoryState.items().filter(i => i.status === InventoryStatus.IN_PICKING).length,
      status:  InventoryStatus.IN_PICKING,
      icon:    '📋',
    },
  ]);

  ngOnInit(): void {
    this.inventoryState.loadItems().subscribe();
  }
}
