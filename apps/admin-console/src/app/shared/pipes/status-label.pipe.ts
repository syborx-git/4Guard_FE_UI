/**
 * @file status-label.pipe.ts
 * @description Pipe para convertir el código numérico de estado FSM
 * en su etiqueta legible en español.
 *
 * Uso en templates: {{ item.status | statusLabel }}
 */

import { Pipe, PipeTransform } from '@angular/core';
import { InventoryStatus, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';

@Pipe({
  name: 'statusLabel',
  standalone: true,
  pure: true,
})
export class StatusLabelPipe implements PipeTransform {
  transform(value: InventoryStatus | number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return INVENTORY_STATUS_LABELS[value as InventoryStatus] ?? `Estado ${value}`;
  }
}
