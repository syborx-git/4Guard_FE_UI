/**
 * @file quality-inspection.component.ts
 * @description Formulario detallado de inspección de calidad (QM) para la vista independiente de ruta (/quality/:id).
 */

import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Item, InventoryStatus, UnitOfMeasure, INVENTORY_STATUS_LABELS, isValidTransition } from '@4guard/shared-core';

export interface InspectionCheckItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  critical: boolean;
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

  protected readonly checklist = signal<InspectionCheckItem[]>([
    {
      id: 'crit-empaque',
      label: 'Empaque Secundario y Tarima Intactos',
      description: 'Sin rasgaduras, abolladuras, parches húmedos ni tarimas rotas.',
      checked: true,
      critical: true
    },
    {
      id: 'crit-caducidad',
      label: 'Vida Útil Mínima y Caducidad Vigente',
      description: 'Cumple con margen mínimo de vida anaquel (> 90 días).',
      checked: true,
      critical: true
    },
    {
      id: 'crit-temperatura',
      label: 'Control de Cadena de Frío (2°C - 6°C)',
      description: 'Termómetro de recepción dentro de parámetros normativos.',
      checked: false,
      critical: true
    },
    {
      id: 'crit-etiquetado',
      label: 'Etiquetado NOM / Código SSCC Legible',
      description: 'Código de barras escaneable sin errores de formateo.',
      checked: true,
      critical: false
    },
    {
      id: 'crit-certificado',
      label: 'Certificado de Calidad de Origen Adjunto',
      description: 'Muestreo de laboratorio y ficha técnica validados.',
      checked: false,
      critical: false
    }
  ]);

  protected readonly completedCount = computed(() =>
    this.checklist().filter(c => c.checked).length
  );

  protected readonly totalCount = computed(() =>
    this.checklist().length
  );

  protected readonly completionPercentage = computed(() =>
    Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  private readonly mockItems: Item[] = [
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

  protected toggleCheck(id: string): void {
    this.checklist.update(items =>
      items.map(item =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
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

    if (!isValidTransition(currentItem.status, newStatus)) {
      alert(`No se puede cambiar el estado de ${this.getStatusLabel(currentItem.status)} a ${this.getStatusLabel(newStatus)}.`);
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
