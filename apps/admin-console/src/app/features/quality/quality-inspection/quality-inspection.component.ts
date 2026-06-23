/**
 * @file quality-inspection.component.ts
 * @description Formulario detallado de inspección de calidad (QM) para un lote.
 */

import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Item, InventoryStatus, UnitOfMeasure, INVENTORY_STATUS_LABELS, isValidTransition } from '@4guard/shared-core';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

@Component({
  selector: 'fg-quality-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality-inspection.component.html',
  styleUrl: './quality-inspection.component.css'
})
export class QualityInspectionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly item = signal<Item | null>(null);
  protected readonly notes = signal('');

  protected readonly checklist = signal<ChecklistItem[]>([
    { id: 'crit-empaque', label: 'Empaque exterior intacto, sin golpes ni roturas', checked: false },
    { id: 'crit-temperatura', label: 'Temperatura controlada dentro de rango requerido (si aplica)', checked: false },
    { id: 'crit-etiqueta', label: 'Etiquetado del lote y código de barras legible y correcto', checked: false },
    { id: 'crit-caducidad', label: 'Fecha de caducidad coincide con el ASN y cumple vida útil mínima', checked: false }
  ]);

  // Mock database search based on the routing parameter :id
  private readonly mockItems: Item[] = [
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
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const foundItem = this.mockItems.find(i => i.id === id);
      if (foundItem) {
        this.item.set(foundItem);
      }
    }
  }

  protected getStatusLabel(status: InventoryStatus): string {
    return INVENTORY_STATUS_LABELS[status] || String(status);
  }

  protected isChecklistComplete(): boolean {
    return this.checklist().every(c => c.checked);
  }

  protected isNotesValidForRejection(): boolean {
    return this.notes().trim().length >= 5;
  }

  protected decideStatus(newStatus: InventoryStatus): void {
    const currentItem = this.item();
    if (!currentItem) return;

    // Validación FSM utilizando isValidTransition de la librería compartida
    if (!isValidTransition(currentItem.status, newStatus)) {
      alert(`Error FSM: No se puede cambiar el estado de ${this.getStatusLabel(currentItem.status)} a ${this.getStatusLabel(newStatus)}.`);
      return;
    }

    if (newStatus === InventoryStatus.QM_BLOCKED && !this.isNotesValidForRejection()) {
      alert('Las notas de inspección son obligatorias (mínimo 5 caracteres) para bloquear un lote.');
      return;
    }

    const actionText = newStatus === InventoryStatus.AVAILABLE ? 'APROBADO y liberado' : 'RECHAZADO y bloqueado';
    alert(`Lote ${currentItem.batchNumber} ha sido ${actionText} exitosamente.`);
    this.router.navigate(['/quality']);
  }

  protected goBack(): void {
    this.router.navigate(['/quality']);
  }
}
