/**
 * @file quality-list.component.ts
 * @description Listado de control de calidad (QM) con filtrado por estado, cliente y Modal Interactivo de Inspección.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Item, InventoryStatus, UnitOfMeasure, INVENTORY_STATUS_LABELS } from '@4guard/shared-core';
import { QualityInspectionModalComponent } from '../components/quality-inspection-modal/quality-inspection-modal.component';
import { SpecularGlowDirective } from '../../../shared/directives/specular-glow.directive';

@Component({
  selector: 'fg-quality-list',
  standalone: true,
  imports: [CommonModule, QualityInspectionModalComponent, SpecularGlowDirective],
  templateUrl: './quality-list.component.html',
  styleUrl: './quality-list.component.css'
})
export class QualityListComponent {
  private readonly router = inject(Router);

  protected readonly activeTab = signal<'quarantine' | 'blocked' | 'approved'>('quarantine');
  protected readonly filterText = signal('');
  protected readonly selectedClient = signal('');

  // Estado del Modal Interactivo de Inspección QM
  protected readonly isModalOpen = signal(false);
  protected readonly selectedItemForModal = signal<Item | null>(null);

  // Lotes Dummy Enriquecidos con datos corporativos de Lala, Nestlé, Bimbo
  protected readonly items = signal<Item[]>([
    {
      id: 'item-001',
      sku: 'LALA-MILK-1L',
      description: 'Leche Lala Entera UHT 1 Litro (Caja 12 pzas)',
      clientId: 'cli-01',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-901',
      expiryDate: '2026-11-20T00:00:00Z',
      quantity: 120,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-DOCK-02',
      status: InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: 1440,
      volumeM3: 1.8,
      barcode: '7501020304051',
      sscc: '375010203040500018',
      receivedAt: '2026-08-30T10:30:00Z',
      lastStatusChangeAt: '2026-08-30T10:35:00Z',
      notes: 'Requiere verificación de temperatura de andén (cadena de frío 4°C)',
      metadata: null
    },
    {
      id: 'item-002',
      sku: 'NESP-CAPS-10P',
      description: 'Cápsulas Nespresso Ristretto Intenso x10 (Caja Master 50U)',
      clientId: 'cli-02',
      clientName: 'Nestlé México S.A.',
      batchNumber: 'LOT-NES-2026-883',
      expiryDate: '2027-08-15T00:00:00Z',
      quantity: 450,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-STG-04',
      status: InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: 225,
      volumeM3: 0.6,
      barcode: '7613036987654',
      sscc: '376130369876500025',
      receivedAt: '2026-08-30T11:15:00Z',
      lastStatusChangeAt: '2026-08-30T11:20:00Z',
      notes: 'Tarima secundaria con leve raspadura en empaque exterior',
      metadata: null
    },
    {
      id: 'item-003',
      sku: 'BIMBO-BREAD-680G',
      description: 'Pan Cero Cero Bimbo 680g (Tarima 80 Cajas)',
      clientId: 'cli-03',
      clientName: 'Bimbo de México S.A.',
      batchNumber: 'LOT-BIM-2026-902',
      expiryDate: '2026-09-12T00:00:00Z',
      quantity: 80,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-ISO-01',
      status: InventoryStatus.QM_BLOCKED,
      branchId: '1',
      weightKg: 54.4,
      volumeM3: 0.8,
      barcode: '7501008003123',
      sscc: '375010080031200032',
      receivedAt: '2026-08-29T08:00:00Z',
      lastStatusChangeAt: '2026-08-29T09:45:00Z',
      notes: 'Bloqueado por inconformidad en código EAN impreso en caja externa',
      metadata: null
    },
    {
      id: 'item-004',
      sku: 'LALA-YOG-250G',
      description: 'Yogurt Griego Lala Fresa 250g (Sixpack x 8)',
      clientId: 'cli-01',
      clientName: 'Lala S.A. de C.V.',
      batchNumber: 'LOT-2026-LALA-905',
      expiryDate: '2026-10-05T00:00:00Z',
      quantity: 320,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-QM-COLD-01',
      status: InventoryStatus.QUARANTINE,
      branchId: '1',
      weightKg: 640,
      volumeM3: 0.9,
      barcode: '7501020304999',
      sscc: '375010203040500099',
      receivedAt: '2026-08-30T14:20:00Z',
      lastStatusChangeAt: '2026-08-30T14:25:00Z',
      notes: 'Verificación microbiológica de laboratorio en curso',
      metadata: null
    },
    {
      id: 'item-005',
      sku: 'NESP-MILK-POWDER',
      description: 'Leche en Polvo Nido Entera 800g (Caja 12 Latas)',
      clientId: 'cli-02',
      clientName: 'Nestlé México S.A.',
      batchNumber: 'LOT-NES-2026-441',
      expiryDate: '2028-01-30T00:00:00Z',
      quantity: 210,
      unitOfMeasure: UnitOfMeasure.BOX,
      locationId: 'LOC-STORAGE-A12',
      status: InventoryStatus.AVAILABLE,
      branchId: '1',
      weightKg: 2016,
      volumeM3: 2.1,
      barcode: '7613036123456',
      sscc: '376130369876500077',
      receivedAt: '2026-08-28T09:10:00Z',
      lastStatusChangeAt: '2026-08-28T16:00:00Z',
      notes: 'Aprobado y liberado sin observaciones',
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

  protected readonly approvedCount = computed(() =>
    this.items().filter(i => i.status === InventoryStatus.AVAILABLE).length
  );

  protected readonly filteredItems = computed(() => {
    const tab = this.activeTab();
    const query = this.filterText().toLowerCase().trim();
    const client = this.selectedClient();

    const expectedStatus =
      tab === 'quarantine' ? InventoryStatus.QUARANTINE :
      tab === 'blocked'    ? InventoryStatus.QM_BLOCKED :
                             InventoryStatus.AVAILABLE;

    return this.items().filter(i => {
      if (i.status !== expectedStatus) return false;
      if (client && i.clientName !== client) return false;
      if (query) {
        return i.sku.toLowerCase().includes(query) ||
               i.batchNumber.toLowerCase().includes(query) ||
               i.description.toLowerCase().includes(query) ||
               i.clientName.toLowerCase().includes(query);
      }
      return true;
    });
  });

  protected setTab(tab: 'quarantine' | 'blocked' | 'approved'): void {
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

  // Abre el Modal Interactivo en lugar de cambiar de página inmediatamente
  protected openInspectionModal(item: Item): void {
    this.selectedItemForModal.set(item);
    this.isModalOpen.set(true);
  }

  protected closeInspectionModal(): void {
    this.isModalOpen.set(false);
    this.selectedItemForModal.set(null);
  }

  // Actualiza el estado del lote en tiempo real tras dictamen en el modal
  protected handleStatusUpdate(event: { itemId: string; newStatus: InventoryStatus; notes: string }): void {
    this.items.update(list =>
      list.map(i => {
        if (i.id === event.itemId) {
          return {
            ...i,
            status: event.newStatus,
            notes: event.notes,
            lastStatusChangeAt: new Date().toISOString()
          };
        }
        return i;
      })
    );

    const actionText = event.newStatus === InventoryStatus.AVAILABLE ? 'APROBADO Y LIBERADO' : 'BLOQUEADO POR QM';
    console.log(`Lote ${event.itemId} actualizado a status ${event.newStatus} (${actionText})`);
  }

  protected quickApprove(item: Item): void {
    if (confirm(`¿Aprobar rápidamente el lote ${item.batchNumber} de ${item.clientName}?`)) {
      this.items.update(list => list.map(i =>
        i.id === item.id ? { ...i, status: InventoryStatus.AVAILABLE, notes: 'Aprobación rápida por supervisor QM' } : i
      ));
    }
  }

  protected quickBlock(item: Item): void {
    if (confirm(`¿Bloquear por QM el lote ${item.batchNumber}?`)) {
      this.items.update(list => list.map(i =>
        i.id === item.id ? { ...i, status: InventoryStatus.QM_BLOCKED, notes: 'Bloqueo rápido por inspección' } : i
      ));
    }
  }

  protected releaseItem(item: Item): void {
    if (confirm(`¿Liberar lote bloqueado ${item.batchNumber}?`)) {
      this.items.update(list => list.map(i =>
        i.id === item.id ? { ...i, status: InventoryStatus.AVAILABLE, notes: 'Liberado tras corrección de no conformidad' } : i
      ));
    }
  }

  protected getStatusLabel(status: InventoryStatus): string {
    return INVENTORY_STATUS_LABELS[status] || String(status);
  }
}
