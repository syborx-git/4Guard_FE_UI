/**
 * @file transfer-submodule.component.ts
 * @description Submódulo 2: Cambio de Almacén (Traspasos Internos).
 * Incluye validación de Bahía Destino COMPLETAMENTE EN CEROS y Buscador prioritario por Folio.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import { LocationStockInfo, WarehouseTransfer } from '../../models/warehouse-movements.models';
import { PrintTransferLayoutComponent } from '../../components/print-layouts/print-transfer-layout.component';

type TransferTab = 'alta-cambio' | 'consulta-cambios';

@Component({
  selector: 'fg-transfer-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, PrintTransferLayoutComponent],
  templateUrl: './transfer-submodule.component.html',
  styleUrl: './transfer-submodule.component.css',
})
export class TransferSubmoduleComponent {
  private readonly movementsService = inject(WarehouseMovementsService);

  activeTab = signal<TransferTab>('alta-cambio');

  // Formulario Alta de Traspaso
  selectedForkliftOperator = signal('Roberto Gómez');
  originLocationCode = signal('A-14');
  destinationLocationCode = signal('M-98');

  // Información Reactiva de Ubicaciones (Signals)
  originStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.originLocationCode())
  );

  destinationStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.destinationLocationCode())
  );

  /**
   * CORRECCIÓN 5: Validación Reactiva de Bahía Destino COMPLETAMENTE EN CEROS
   * Retorna true SOLO si totalPallets === 0 y totalPieces === 0.
   */
  isDestinationEmpty = computed(() => {
    const dest = this.destinationStock();
    return dest.totalPallets === 0 && dest.totalPieces === 0;
  });

  canExecuteTransfer = computed(() => {
    const orig = this.originStock();
    return orig.totalPallets > 0 && this.isDestinationEmpty() && !!this.selectedForkliftOperator();
  });

  // Modal Impresión
  showPrintModal = signal(false);
  selectedPrintTransfer = signal<WarehouseTransfer | null>(null);

  // ── PESTAÑA CONSULTA ──
  /**
   * CORRECCIÓN 4: Buscador prioritario por Folio de Traspaso
   */
  searchFolio = signal('');
  searchClient = signal('');
  searchProduct = signal('');
  searchOrigin = signal('');
  searchDestination = signal('');

  filteredTransfers = computed(() => {
    const list = this.movementsService.transfers();
    const folioQuery = this.searchFolio().toLowerCase().trim();
    const origQuery = this.searchOrigin().toLowerCase().trim();
    const destQuery = this.searchDestination().toLowerCase().trim();

    return list.filter((t) => {
      // Prioridad alta a coincidencia por Folio
      const matchFolio = !folioQuery || t.folio.toLowerCase().includes(folioQuery);
      const matchOrigin = !origQuery || t.originLocation.toLowerCase().includes(origQuery);
      const matchDest = !destQuery || t.destinationLocation.toLowerCase().includes(destQuery);
      return matchFolio && matchOrigin && matchDest;
    });
  });

  confirmTransfer(): void {
    if (!this.canExecuteTransfer()) return;

    try {
      const transfer = this.movementsService.executeTransfer(
        this.originLocationCode(),
        this.destinationLocationCode(),
        this.selectedForkliftOperator(),
        'Christian Durán'
      );

      if (transfer) {
        this.selectedPrintTransfer.set(transfer);
        this.showPrintModal.set(true);
      }
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al ejecutar el traspaso.');
    }
  }

  openPrintPreview(transfer: WarehouseTransfer): void {
    this.selectedPrintTransfer.set(transfer);
    this.showPrintModal.set(true);
  }

  triggerBrowserPrint(): void {
    window.print();
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintTransfer.set(null);
  }
}
