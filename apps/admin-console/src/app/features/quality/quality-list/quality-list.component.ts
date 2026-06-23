/**
 * @file quality-list.component.ts
 * @description Listado de control de calidad (QM) con filtrado por estado y cliente.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Item, InventoryStatus, UnitOfMeasure } from '@4guard/shared-core';

@Component({
  selector: 'fg-quality-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quality-list.component.html',
  styleUrl: './quality-list.component.css'
})
export class QualityListComponent {
  private readonly router = inject(Router);

  protected readonly activeTab = signal<'quarantine' | 'blocked'>('quarantine');
  protected readonly filterText = signal('');
  protected readonly selectedClient = signal('');

  protected readonly items = signal<Item[]>([
    {
      id: 'item-001',
      sku: 'LALA-MILK-1L',
      description: 'Leche Lala Entera 1 Litro',
      clientId: 'cli-01',
      clientName: 'Lala S.A.',
      batchNumber: 'LOT-2026-A12',
      expiryDate: '2026-09-15T00:00:00Z',
      quantity: 120,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-DOCK-02',
      status: InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: 1200,
      volumeM3: 1.5,
      barcode: '7501020304051',
      sscc: '375010203040500018',
      receivedAt: '2026-06-22T10:30:00Z',
      lastStatusChangeAt: '2026-06-22T10:35:00Z',
      notes: 'Pendiente de muestreo microbiológico',
      metadata: null
    },
    {
      id: 'item-002',
      sku: 'NESP-CAPS-10P',
      description: 'Cápsulas Nespresso Ristretto x10',
      clientId: 'cli-02',
      clientName: 'Nestlé México',
      batchNumber: 'LOT-NES-883',
      expiryDate: '2027-06-01T00:00:00Z',
      quantity: 450,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-STG-04',
      status: InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: 90,
      volumeM3: 0.4,
      barcode: '7613036987654',
      sscc: '376130369876500025',
      receivedAt: '2026-06-22T11:15:00Z',
      lastStatusChangeAt: '2026-06-22T11:20:00Z',
      notes: 'Caja externa ligeramente húmeda en andén 4',
      metadata: null
    },
    {
      id: 'item-003',
      sku: 'BIMBO-BREAD-680G',
      description: 'Pan Cero Cero Bimbo 680g',
      clientId: 'cli-03',
      clientName: 'Bimbo de México',
      batchNumber: 'LOT-BIM-902',
      expiryDate: '2026-07-05T00:00:00Z',
      quantity: 80,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-01',
      status: InventoryStatus.QM_BLOCKED,
      branchId: '1',
      weightKg: 54.4,
      volumeM3: 0.8,
      barcode: '7501008003123',
      sscc: '375010080031200032',
      receivedAt: '2026-06-20T08:00:00Z',
      lastStatusChangeAt: '2026-06-20T09:45:00Z',
      notes: 'Bloqueado por presencia de etiquetas incorrectas en el pallet',
      metadata: null
    }
  ]);

  protected readonly clients = computed(() => {
    const list = this.items().map(i => i.clientName);
    return Array.from(new Set(list));
  });

  protected readonly quarantineCount = computed(() => 
    this.items().filter(i => i.status === InventoryStatus.QUARANTINE).length
  );

  protected readonly blockedCount = computed(() => 
    this.items().filter(i => i.status === InventoryStatus.QM_BLOCKED).length
  );

  protected readonly filteredItems = computed(() => {
    const tab = this.activeTab();
    const query = this.filterText().toLowerCase().trim();
    const client = this.selectedClient();

    const expectedStatus = tab === 'quarantine' ? InventoryStatus.QUARANTINE : InventoryStatus.QM_BLOCKED;

    return this.items().filter(i => {
      if (i.status !== expectedStatus) return false;
      if (client && i.clientName !== client) return false;
      if (query) {
        return i.sku.toLowerCase().includes(query) || i.batchNumber.toLowerCase().includes(query) || i.description.toLowerCase().includes(query);
      }
      return true;
    });
  });

  protected setTab(tab: 'quarantine' | 'blocked'): void {
    this.activeTab.set(tab);
  }

  protected onFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.filterText.set(input.value);
    }
  }

  protected onClientChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.selectedClient.set(select.value);
    }
  }

  protected goToInspection(id: string): void {
    this.router.navigate(['/quality', id]);
  }

  protected quickApprove(item: Item): void {
    if (confirm(`¿Aprobar rápidamente el lote ${item.batchNumber} de ${item.description}?`)) {
      this.items.update(list => list.map(i => 
        i.id === item.id ? { ...i, status: InventoryStatus.AVAILABLE, notes: 'Aprobación rápida por supervisor' } : i
      ));
    }
  }

  protected quickBlock(item: Item): void {
    if (confirm(`¿Bloquear por QM el lote ${item.batchNumber}?`)) {
      this.items.update(list => list.map(i => 
        i.id === item.id ? { ...i, status: InventoryStatus.QM_BLOCKED, notes: 'Bloqueo rápido por supervisor' } : i
      ));
    }
  }

  protected releaseItem(item: Item): void {
    if (confirm(`¿Liberar el lote bloqueado ${item.batchNumber}?`)) {
      this.items.update(list => list.map(i => 
        i.id === item.id ? { ...i, status: InventoryStatus.AVAILABLE, notes: 'Liberación de control de calidad' } : i
      ));
    }
  }

  protected scrapItem(item: Item): void {
    if (confirm(`¿Está seguro de dar de BAJA (ajuste destructivo) el lote ${item.batchNumber}? Esta acción no se puede deshacer.`)) {
      this.items.update(list => list.map(i => 
        i.id === item.id ? { ...i, status: InventoryStatus.WRITTEN_OFF, notes: 'Dado de baja por merma' } : i
      ));
    }
  }
}
