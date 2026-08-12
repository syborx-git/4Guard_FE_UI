/**
 * @file receiving-submodule.component.ts
 * @description Submódulo 1: Recepción de Mercancía con 5 pestañas operativas internas.
 * Incluye Carga Rápida con auto-foco ininterrumpido y firma modal de Líder.
 */

import { Component, ElementRef, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import {
  CheckInCasetaData,
  ReceptionHeader,
  ReceptionPalletItem,
  PalletType,
  PALLET_TYPE_LABELS,
} from '../../models/warehouse-movements.models';
import { LeaderAuthModalComponent } from '../../components/leader-auth-modal/leader-auth-modal.component';
import { PrintReceptionLayoutComponent } from '../../components/print-layouts/print-reception-layout.component';
import { PrintCancellationLayoutComponent } from '../../components/print-layouts/print-cancellation-layout.component';

type ReceivingTab =
  | 'captura-caseta'
  | 'alta-recepcion'
  | 'cancelar-recepcion'
  | 'cambio-remision'
  | 'consulta-recepcion';

@Component({
  selector: 'fg-receiving-submodule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LeaderAuthModalComponent,
    PrintReceptionLayoutComponent,
    PrintCancellationLayoutComponent,
  ],
  templateUrl: './receiving-submodule.component.html',
  styleUrl: './receiving-submodule.component.css',
})
export class ReceivingSubmoduleComponent {
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly fb = inject(FormBuilder);

  // Tab activo
  activeTab = signal<ReceivingTab>('captura-caseta');

  // Elemento input para auto-foco en Carga Rápida (CORRECCIÓN 2)
  @ViewChild('uaInput') uaInput!: ElementRef<HTMLInputElement>;

  // Catalogos Reactivos desde Servicio
  palletTypes = Object.entries(PALLET_TYPE_LABELS) as [PalletType, string][];
  carrierLines = this.movementsService.carrierLines;
  clients = this.movementsService.clients;
  ramps = this.movementsService.ramps;
  forkliftOperators = this.movementsService.forkliftOperators;

  // ── PESTAÑA A: Captura de Datos (CAPTURAR DATOS DE FACTURA / F01-PO-CP-7.1.3-03) ──
  checkInForm = this.fb.group({
    carrierLineCode: ['TR-01'],
    carrierLine: ['Transportes Castores', [Validators.required]],
    receptionTime: ['09:15', [Validators.required]],
    docNumber: ['REM-2026-901', [Validators.required]],
    elaborationDate: ['2026-01-15'],
    expirationDate: ['2026-12-30'],
    lotNumber: ['LOT-2026-N1'],
    docDate: ['2026-08-11', [Validators.required]],
    clientCode: ['CLI-001'],
    client: ['Nestlé México', [Validators.required]],
    rampCode: ['R-04'],
    rampNumber: [4, [Validators.required, Validators.min(1), Validators.max(12)]],
    forkliftOperatorCode: ['MC-102'],
    forkliftOperator: ['Pablo Hernández', [Validators.required]],
    driverName: ['Carlos Ruiz', [Validators.required]],
    tractorPlates: ['77-AB-99', [Validators.required]],
    boxPlates: ['55-XX-11', [Validators.required]],
    sealNumber: ['SL-90812'],
  });

  sealList = signal<string[]>(['SL-90812']);
  tempSealInput = signal('');
  generatedFolio = signal<string | null>(null);
  showFolioModal = signal(false);
  copyToastMsg = signal<string | null>(null);

  // Modal de Alta Rápida con Botón [+]
  showQuickAddModal = signal(false);
  quickAddType = signal<'CARRIER' | 'RAMP' | null>(null);
  quickAddCodeInput = signal('');
  quickAddNameInput = signal('');
  quickAddRampNumInput = signal<number>(13);

  // ── PESTAÑA B: Alta de Recepción (Andén) ──
  altaSearchFolio = signal('');
  currentReception = signal<ReceptionHeader | null>(null);

  altaForm = this.fb.group({
    lotNumber: ['LOT-2026-N1', [Validators.required]],
    elaborationDate: ['2026-01-15', [Validators.required]],
    expirationDate: ['2026-12-30', [Validators.required]],
    productId: ['SKU-NES-680', [Validators.required]],
    productName: ['Cereal Nestlé Nesquik 680g', [Validators.required]],
    piecesPerPallet: [480, [Validators.required, Validators.min(1)]],
    selectedPalletType: ['MADERA_ESTANDAR' as PalletType, [Validators.required]],
    observations: [''],
  });

  // Stream de Carga Rápida (Tarimas adicionadas dinámicamente)
  palletStream = signal<ReceptionPalletItem[]>([]);
  uaCodeInput = signal('');
  uaObsInput = signal('');

  // Computados en tiempo real (Signals)
  totalTarimas = computed(() => this.palletStream().length);
  totalProductos = computed(() => {
    const set = new Set(this.palletStream().map((p) => p.productId));
    return set.size;
  });
  totalPiezas = computed(() =>
    this.palletStream().reduce((acc, p) => acc + p.pieces, 0)
  );

  // ── Modales de Autorización e Impresión ──
  showLeaderModal = signal(false);
  leaderModalTitle = signal('');
  leaderAction = signal<'COMPLETE' | 'CANCEL' | null>(null);

  showPrintModal = signal(false);
  printType = signal<'RECEPTION' | 'CANCELLATION' | null>(null);
  selectedPrintReception = signal<ReceptionHeader | null>(null);

  // ── PESTAÑA C: Cancelar Recepción ──
  cancelFolioInput = signal('');
  cancellationJustification = signal('');
  cancelSearchResult = signal<ReceptionHeader | null>(null);

  // ── PESTAÑA D: Cambio de Remisión ──
  oldRemisionInput = signal('');
  newRemisionInput = signal('');
  changeJustification = signal('');
  remisionSuccessMsg = signal<string | null>(null);

  // ── PESTAÑA E: Consulta ──
  searchClient = signal('');
  searchDoc = signal('');
  searchProduct = signal('');
  filteredReceptions = computed(() => {
    const list = this.movementsService.receptions();
    const c = this.searchClient().toLowerCase().trim();
    const d = this.searchDoc().toLowerCase().trim();
    const p = this.searchProduct().toLowerCase().trim();

    return list.filter((r) => {
      const matchClient = !c || r.checkIn.client.toLowerCase().includes(c);
      const matchDoc = !d || r.checkIn.docNumber.toLowerCase().includes(d);
      const matchProd = !p || r.productName.toLowerCase().includes(p) || r.productId.toLowerCase().includes(p);
      return matchClient && matchDoc && matchProd;
    });
  });

  // ── HANDLERS DE CATÁLOGOS REACTIVOS ──
  onCarrierLineSelect(code: string): void {
    const item = this.carrierLines().find((c) => c.code === code);
    if (item) {
      this.checkInForm.patchValue({
        carrierLineCode: item.code,
        carrierLine: item.name,
      });
    }
  }

  onClientSelect(code: string): void {
    const item = this.clients().find((c) => c.code === code);
    if (item) {
      this.checkInForm.patchValue({
        clientCode: item.code,
        client: item.name,
      });
    }
  }

  onRampSelect(code: string): void {
    const item = this.ramps().find((r) => r.code === code);
    if (item) {
      this.checkInForm.patchValue({
        rampCode: item.code,
        rampNumber: item.rampNumber,
      });
    }
  }

  onForkliftOperatorSelect(code: string): void {
    const item = this.forkliftOperators().find((m) => m.code === code);
    if (item) {
      this.checkInForm.patchValue({
        forkliftOperatorCode: item.code,
        forkliftOperator: item.name,
      });
    }
  }

  // ── MODAL DE ALTA RÁPIDA DE ENTIDADES [+] ──
  openQuickAddModal(type: 'CARRIER' | 'RAMP'): void {
    this.quickAddType.set(type);
    if (type === 'CARRIER') {
      const nextNum = this.carrierLines().length + 1;
      this.quickAddCodeInput.set(`TR-0${nextNum}`);
      this.quickAddNameInput.set('');
    } else {
      const nextNum = this.ramps().length + 1;
      this.quickAddCodeInput.set(`R-${nextNum < 10 ? '0' + nextNum : nextNum}`);
      this.quickAddRampNumInput.set(nextNum);
      this.quickAddNameInput.set(`Rampa ${nextNum}`);
    }
    this.showQuickAddModal.set(true);
  }

  saveQuickAddEntity(): void {
    const type = this.quickAddType();
    const code = this.quickAddCodeInput().trim();
    const name = this.quickAddNameInput().trim();

    if (!code || !name) return;

    if (type === 'CARRIER') {
      this.movementsService.addCarrierLine({ code, name });
      this.checkInForm.patchValue({
        carrierLineCode: code,
        carrierLine: name,
      });
    } else if (type === 'RAMP') {
      const rNum = this.quickAddRampNumInput();
      this.movementsService.addRamp({ code, rampNumber: rNum, name });
      this.checkInForm.patchValue({
        rampCode: code,
        rampNumber: rNum,
      });
    }

    this.showQuickAddModal.set(false);
  }

  // ── ACCIONES PESTAÑA A (Captura de Datos) ──
  addSeal(): void {
    const s = this.tempSealInput().trim();
    if (s && !this.sealList().includes(s)) {
      this.sealList.update((list) => [...list, s]);
      this.tempSealInput.set('');
    }
  }

  removeSeal(index: number): void {
    this.sealList.update((list) => list.filter((_, i) => i !== index));
  }

  submitCheckIn(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }
    const folio = this.movementsService.generateNextReceptionFolio();
    this.generatedFolio.set(folio);

    const formData = this.checkInForm.value as any;
    formData.sealNumbers = [...this.sealList()];
    if (formData.sealNumber && !formData.sealNumbers.includes(formData.sealNumber)) {
      formData.sealNumbers.push(formData.sealNumber);
    }

    const header = this.movementsService.saveCheckIn(formData, folio);
    this.currentReception.set(header);
    this.altaSearchFolio.set(folio);

    // Desplegar Modal Elegante y Minimalista
    this.showFolioModal.set(true);
  }

  /**
   * CORRECCIÓN 4: Al presionar "CONTINUAR A ALTA DE RECEPCIÓN (ANDÉN)"
   * Pasa automáticamente a Pestaña 2 y PRECARGA el Folio generado detonando el autocompletado.
   */
  proceedToAltaRecepcion(): void {
    const folio = this.generatedFolio();
    this.showFolioModal.set(false);
    this.activeTab.set('alta-recepcion');

    if (folio) {
      this.altaSearchFolio.set(folio);
      this.searchReceptionFolio();
    }
  }

  copyFolioToClipboard(): void {
    const folio = this.generatedFolio();
    if (folio) {
      navigator.clipboard.writeText(folio);
      this.copyToastMsg.set(`Folio #${folio} copiado al portapapeles`);
      setTimeout(() => this.copyToastMsg.set(null), 3000);
    }
  }

  resetCheckInForm(): void {
    this.checkInForm.reset({
      carrierLineCode: 'TR-01',
      carrierLine: 'Transportes Castores',
      receptionTime: '09:15',
      docNumber: 'REM-2026-901',
      elaborationDate: '2026-01-15',
      expirationDate: '2026-12-30',
      lotNumber: 'LOT-2026-N1',
      docDate: '2026-08-11',
      clientCode: 'CLI-004',
      client: 'Nestlé México',
      rampCode: 'R-04',
      rampNumber: 4,
      forkliftOperatorCode: 'MC-102',
      forkliftOperator: 'Pablo Hernández',
      driverName: 'Carlos Ruiz',
      tractorPlates: '77-AB-99',
      boxPlates: '55-XX-11',
      sealNumber: 'SL-90812',
    });
    this.sealList.set(['SL-90812']);
  }

  // ── ACCIONES PESTAÑA B ──
  searchReceptionFolio(): void {
    const f = this.altaSearchFolio().trim();
    if (!f) return;
    const r = this.movementsService.findReceptionByFolio(f);
    if (r) {
      this.currentReception.set(r);
      if (r.pallets && r.pallets.length > 0) {
        this.palletStream.set([...r.pallets]);
      }
    } else {
      alert(`No se encontró la recepción con Folio #${f}`);
    }
  }

  /**
   * CORRECCIÓN 2: Stream de Carga Rápida con Auto-Foco Ininterrumpido
   * Al dar Enter sobre N. Tarima, agrega la fila a la Signal y re-enfoca automáticamente.
   */
  onUaEnter(event: Event): void {
    event.preventDefault();
    const code = this.uaCodeInput().trim();
    if (!code) return;

    const pzas = this.altaForm.value.piecesPerPallet || 480;
    const pType = (this.altaForm.value.selectedPalletType as PalletType) || 'MADERA_ESTANDAR';
    const prodId = this.altaForm.value.productId || 'SKU-NES-680';
    const prodName = this.altaForm.value.productName || 'Producto General';

    const newItem: ReceptionPalletItem = {
      id: `ua-${Date.now()}`,
      palletCode: code.toUpperCase(),
      description: prodName,
      productId: prodId,
      pieces: pzas,
      observations: this.uaObsInput().trim() || undefined,
      palletTypeId: pType,
      palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Madera',
    };

    // Agregar a la lista reactiva
    this.palletStream.update((list) => [...list, newItem]);

    // Limpiar campos de escaneo
    this.uaCodeInput.set('');
    this.uaObsInput.set('');

    // AUTO-FOCO ININTERRUMPIDO INMEDIATO
    setTimeout(() => {
      if (this.uaInput?.nativeElement) {
        this.uaInput.nativeElement.focus();
      }
    }, 10);
  }

  removePalletFromStream(id: string): void {
    this.palletStream.update((list) => list.filter((item) => item.id !== id));
  }

  initiateCompleteReception(): void {
    if (this.palletStream().length === 0) {
      alert('Debes ingresar al menos 1 Tarima/UA en la lista de descarga.');
      return;
    }
    this.leaderModalTitle.set('Autorizar Cierre de Recepción');
    this.leaderAction.set('COMPLETE');
    this.showLeaderModal.set(true);
  }

  // ── ACCIONES PESTAÑA C ──
  searchCancelFolio(): void {
    const f = this.cancelFolioInput().trim();
    if (!f) return;
    const r = this.movementsService.findReceptionByFolio(f);
    if (r) {
      this.cancelSearchResult.set(r);
    } else {
      alert(`No se encontró la recepción #${f}`);
    }
  }

  initiateCancelReception(): void {
    if (!this.cancelSearchResult()) return;
    if (!this.cancellationJustification().trim()) {
      alert('La justificación de cancelación es obligatoria.');
      return;
    }
    this.leaderModalTitle.set('Autorizar Cancelación de Recepción');
    this.leaderAction.set('CANCEL');
    this.showLeaderModal.set(true);
  }

  // ── CALLBACK DE VALIDACIÓN DEL MODAL DE LÍDER ──
  onLeaderValidated(event: { leaderName: string }): void {
    this.showLeaderModal.set(false);
    const action = this.leaderAction();

    if (action === 'COMPLETE') {
      const rec = this.currentReception();
      if (!rec) return;

      const updated = this.movementsService.completeReception(
        rec.folio,
        this.altaForm.value.lotNumber || 'LOT-DESCONOCIDO',
        this.altaForm.value.elaborationDate || '2026-01-01',
        this.altaForm.value.expirationDate || '2026-12-31',
        this.altaForm.value.productId || 'SKU-GEN',
        this.altaForm.value.productName || 'Producto General',
        this.altaForm.value.piecesPerPallet || 480,
        (this.altaForm.value.selectedPalletType as PalletType) || 'MADERA',
        this.palletStream(),
        this.altaForm.value.observations || undefined,
        'Christian Durán',
        event.leaderName
      );

      if (updated) {
        this.selectedPrintReception.set(updated);
        this.printType.set('RECEPTION');
        this.showPrintModal.set(true);
      }
    } else if (action === 'CANCEL') {
      const rec = this.cancelSearchResult();
      if (!rec) return;

      const cancelled = this.movementsService.cancelReception(
        rec.folio,
        this.cancellationJustification(),
        event.leaderName
      );

      if (cancelled) {
        this.selectedPrintReception.set(cancelled);
        this.printType.set('CANCELLATION');
        this.showPrintModal.set(true);
      }
    }

    this.leaderAction.set(null);
  }

  // ── ACCIONES PESTAÑA D ──
  submitChangeRemision(): void {
    if (!this.oldRemisionInput().trim() || !this.newRemisionInput().trim() || !this.changeJustification().trim()) {
      alert('Todos los campos son obligatorios para cambiar la remisión.');
      return;
    }

    const count = this.movementsService.updateRemisionNumber(
      this.oldRemisionInput(),
      this.newRemisionInput(),
      this.changeJustification()
    );

    if (count > 0) {
      this.remisionSuccessMsg.set(
        `Se actualizó la Remisión "${this.oldRemisionInput()}" a "${this.newRemisionInput()}" en ${count} registro(s).`
      );
      this.oldRemisionInput.set('');
      this.newRemisionInput.set('');
      this.changeJustification.set('');
      setTimeout(() => this.remisionSuccessMsg.set(null), 5000);
    } else {
      alert(`No se encontraron registros con la remisión "${this.oldRemisionInput()}".`);
    }
  }

  // ── IMPRESIÓN Y REIMPRESIÓN ──
  openPrintPreview(rec: ReceptionHeader): void {
    this.selectedPrintReception.set(rec);
    this.printType.set(rec.status === 'CANCELLED' ? 'CANCELLATION' : 'RECEPTION');
    this.showPrintModal.set(true);
  }

  triggerBrowserPrint(): void {
    window.print();
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintReception.set(null);
  }
}
