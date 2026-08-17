import { Component, ElementRef, ViewChild, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthState } from '../../../../core/auth/auth.state';
import { ToastService } from '../../../../core/services/toast.service';
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

export type ReceptionDetailSubTab = 'descarga' | 'caseta' | 'trazabilidad';

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
export class ReceivingSubmoduleComponent implements OnInit {
  protected readonly authState = inject(AuthState);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  // Auto-foco en escáner de UAs
  @ViewChild('uaInput') uaInput!: ElementRef<HTMLInputElement>;

  // ── ESTADO DEL WORKBENCH ──
  searchQuery = signal('');
  statusFilter = signal<string>('ALL');
  selectedReception = signal<ReceptionHeader | null>(null);

  // Cola Reactiva de Pre-Recepciones Pendientes (Caseta)
  pendingReceptions = this.movementsService.pendingReceptions;
  pendingReceptionsCount = this.movementsService.pendingReceptionsCount;

  // Banner colapsable / expandible de la cola de notificaciones
  isQueueBannerExpanded = signal(true);

  // Modal Cancelación con Autorización de Administrador
  showCancelModal = signal(false);
  cancelReason = signal('');
  cancelAdminUser = signal('');
  cancelAdminPassword = signal('');
  cancelErrorMessage = signal<string | null>(null);
  showCancelPassword = signal(false);
  isCancelling = signal(false);

  toggleShowCancelPassword(): void {
    this.showCancelPassword.update((v) => !v);
  }

  // Modales del Workbench
  showCheckInModal = signal(false);
  showChangeRemisionModal = signal(false);
  showLeaderModal = signal(false);
  showPrintModal = signal(false);
  showEditPalletModal = signal(false);

  // Catálogos Reactivos desde Servicio
  palletTypes = Object.entries(PALLET_TYPE_LABELS) as [PalletType, string][];
  carrierLines = this.movementsService.carrierLines;
  clients = this.movementsService.clients;
  ramps = this.movementsService.ramps;
  forkliftOperators = this.movementsService.forkliftOperators;

  // ── FORMULARIO: Captura de Caseta (CheckIn F01-PO-CP-7.1.3-03) ──
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

  // Modal Alta Rápida de Entidades [+]
  showQuickAddModal = signal(false);
  quickAddType = signal<'CARRIER' | 'RAMP' | null>(null);
  quickAddCodeInput = signal('');
  quickAddNameInput = signal('');
  quickAddRampNumInput = signal<number>(13);

  // Catálogos del Paso 2 (Andén / Descarga)
  suppliers = signal([
    { code: 'SUP-01', name: 'LE MEXICO S.A DE C.V' },
    { code: 'SUP-02', name: 'NESTLE MEXICO S.A DE C.V PLANTA TOLUCA' },
    { code: 'SUP-03', name: 'DISTRIBUIDORA AUTOMOTRIZ S.A.' },
  ]);

  products = signal([
    { id: '12572733', name: 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1', defaultPieces: 480 },
    { id: 'SKU-NES-680', name: 'Cereal Nestlé Nesquik 680g', defaultPieces: 480 },
    { id: '90811224', name: 'NESCAFE CLASICO 200G FRASCO', defaultPieces: 48 },
    { id: '77012399', name: 'CARNATION CLAVEL 360G LATA', defaultPieces: 24 },
    { id: '55409811', name: 'NESQUIK CHOCOLATE 500G', defaultPieces: 36 },
  ]);

  // ── FORMULARIO: Parámetros de Recepción y Producto (Paso 2 / Andén) ──
  altaForm = this.fb.group({
    lotNumber: ['LOT-2026-A1', [Validators.required]],
    expirationDate: ['2026-11-15', [Validators.required]],
    forkliftOperator: ['Pablo Hernández', [Validators.required]],
    rampNumber: [4, [Validators.required]],
    productId: ['12572733', [Validators.required]],
    productName: ['FFEE-MATE ORIGINAL BOTELLA 12X400G N1', [Validators.required]],
    supplierName: ['LE MEXICO S.A DE C.V', [Validators.required]],
    piecesPerPallet: [480, [Validators.required, Validators.min(1)]],
    selectedPalletType: ['MADERA_ESTANDAR' as PalletType, [Validators.required]],
    observations: ['Ingreso directo andén 4 sin incidentes.'],
  });

  // Stream de Escaneo Carga Rápida (UAs)
  palletStream = signal<ReceptionPalletItem[]>([]);
  uaCodeInput = signal('');
  uaObsInput = signal('');

  // ── FORMULARIO: Edición de Tarima Individual (Rol Administrador) ──
  editPalletForm = this.fb.group({
    id: [''],
    palletNumber: [1],
    palletCode: ['', [Validators.required]],
    productId: ['', [Validators.required]],
    description: ['', [Validators.required]],
    supplierName: [''],
    palletTypeId: ['MADERA_ESTANDAR' as PalletType, [Validators.required]],
    pieces: [480, [Validators.required, Validators.min(1)]],
    observations: [''],
  });

  // ── FORMULARIO: Cambio de Remisión ──
  newRemisionInput = signal('');
  changeJustification = signal('');

  // ── ESTADO DE MODAL LÍDER E IMPRESIÓN ──
  leaderModalTitle = signal('');
  leaderAction = signal<'COMPLETE' | 'CANCEL' | null>(null);
  cancellationJustification = signal('');
  printType = signal<'RECEPTION' | 'CANCELLATION' | null>(null);
  selectedPrintReception = signal<ReceptionHeader | null>(null);

  // ── COMPUTADOS DEL WORKBENCH ──
  kpiTotal = computed(() => this.movementsService.receptions().length);
  kpiRegistered = computed(() => this.movementsService.receptions().filter((r) => r.status === 'REGISTERED').length);
  kpiCompleted = computed(() => this.movementsService.receptions().filter((r) => r.status === 'COMPLETED').length);
  kpiCancelled = computed(() => this.movementsService.receptions().filter((r) => r.status === 'CANCELLED').length);

  filteredReceptions = computed(() => {
    const list = this.movementsService.receptions();
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.statusFilter();

    return list.filter((r) => {
      const matchStatus = st === 'ALL' || r.status === st;
      const matchQuery =
        !q ||
        r.folio.toLowerCase().includes(q) ||
        r.checkIn.docNumber.toLowerCase().includes(q) ||
        r.checkIn.client.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.productId.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  });

  totalTarimas = computed(() => this.palletStream().length);
  totalProductos = computed(() => {
    const set = new Set(this.palletStream().map((p) => p.productId));
    return set.size;
  });
  totalPiezas = computed(() => this.palletStream().reduce((acc, p) => acc + p.pieces, 0));

  constructor() {
    // Restaurar folio activo previo o seleccionar el primero
    const savedFolio = localStorage.getItem('4g_active_reception_folio');
    const list = this.movementsService.receptions();
    if (savedFolio) {
      const rec = this.movementsService.findReceptionByFolio(savedFolio);
      if (rec) {
        this.selectReception(rec);
        return;
      }
    }
    if (list.length > 0) {
      this.selectReception(list[0]);
    }
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const folio = params['folio'];
      if (folio) {
        this.searchQuery.set(folio);
        const rec = this.movementsService.findReceptionByFolio(folio);
        if (rec) {
          this.selectReception(rec);
        }
      }
    });
  }

  // ── OPERACIONES DEL WORKBENCH ──

  selectReception(rec: ReceptionHeader): void {
    this.selectedReception.set(rec);
    localStorage.setItem('4g_active_reception_folio', rec.folio);
    this.palletStream.set(rec.pallets ? [...rec.pallets] : []);
    this.altaForm.patchValue({
      lotNumber: rec.lotNumber || rec.checkIn.lotNumber || 'LOT-2026-A1',
      expirationDate: rec.expirationDate || rec.checkIn.expirationDate || '2026-11-15',
      forkliftOperator: rec.checkIn.forkliftOperator || 'Pablo Hernández',
      rampNumber: rec.checkIn.rampNumber || 4,
      productId: rec.productId || '12572733',
      productName: rec.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: rec.supplierName || 'LE MEXICO S.A DE C.V',
      piecesPerPallet: rec.piecesPerPallet || 480,
      selectedPalletType: rec.selectedPalletType || 'MADERA_ESTANDAR',
      observations: rec.observations || 'Ingreso directo andén 4 sin incidentes.',
    });
  }

  // Notificación Simulada & Navegación Directa por Folio
  loadFromNotification(folio: string): void {
    this.searchQuery.set(folio);
    const rec = this.movementsService.findReceptionByFolio(folio);
    if (rec) {
      this.selectReception(rec);
      this.toast.info(`Cargando información completa del Folio #${folio}`);
    }
  }

  toggleQueueBanner(): void {
    this.isQueueBannerExpanded.update((v) => !v);
  }

  // Botón de prueba rápida para simular múltiples llegadas desde Caseta
  simulateQuickArrival(): void {
    const newRec = this.movementsService.simulateQuickCasetaArrival();
    this.toast.success(`⚡ Nueva Pre-Recepción Folio #${newRec.folio} en espera de atención`);
  }

  openNewReceptionModal(): void {
    this.resetCheckInForm();
    this.showCheckInModal.set(true);
  }

  closeNewReceptionModal(): void {
    this.showCheckInModal.set(false);
  }

  submitCheckIn(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      this.toast.warning('Por favor completa los datos obligatorios de caseta.');
      return;
    }

    const folio = this.movementsService.generateNextReceptionFolio();
    this.generatedFolio.set(folio);

    const formData = this.checkInForm.value as any;
    formData.sealNumbers = [...this.sealList()];
    if (formData.sealNumber && !formData.sealNumbers.includes(formData.sealNumber)) {
      formData.sealNumbers.push(formData.sealNumber);
    }

    const newRec = this.movementsService.saveCheckIn(formData, folio);
    this.showCheckInModal.set(false);
    this.selectReception(newRec);

    this.toast.success(`Pre-Recepción #${folio} registrada exitosamente.`);
  }

  // Guardar Cambios Parciales / Avance de Descarga
  saveDraftReception(): void {
    const current = this.selectedReception();
    if (!current) return;

    const formVals = this.altaForm.value;
    const currentStream = [...this.palletStream()];

    const updated = this.movementsService.updateReception(current.folio, {
      lotNumber: formVals.lotNumber || 'LOT-2026-A1',
      expirationDate: formVals.expirationDate || '2026-11-15',
      productId: formVals.productId || '12572733',
      productName: formVals.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: formVals.supplierName || 'LE MEXICO S.A DE C.V',
      piecesPerPallet: formVals.piecesPerPallet || 480,
      selectedPalletType: (formVals.selectedPalletType as PalletType) || 'MADERA_ESTANDAR',
      observations: formVals.observations || '',
      pallets: currentStream,
    });

    if (updated) {
      this.selectedReception.set(updated);
      this.toast.success(`Avance de Folio #${current.folio} guardado correctamente.`);
    }
  }

  // ── EDICIÓN Y ELIMINACIÓN DE TARIMAS (ROL ADMINISTRADOR) ──
  openEditPalletModal(pallet: ReceptionPalletItem): void {
    this.editPalletForm.setValue({
      id: pallet.id,
      palletNumber: pallet.palletNumber || 1,
      palletCode: pallet.palletCode,
      productId: pallet.productId,
      description: pallet.description,
      supplierName: pallet.supplierName || this.altaForm.value.supplierName || 'LE MEXICO S.A DE C.V',
      palletTypeId: pallet.palletTypeId,
      pieces: pallet.pieces,
      observations: pallet.observations || '',
    });
    this.showEditPalletModal.set(true);
  }

  closeEditPalletModal(): void {
    this.showEditPalletModal.set(false);
  }

  saveEditedPallet(): void {
    if (this.editPalletForm.invalid) {
      this.editPalletForm.markAllAsTouched();
      this.toast.warning('Completa los campos obligatorios de la tarima.');
      return;
    }

    const formVals = this.editPalletForm.value;
    const pType = (formVals.palletTypeId as PalletType) || 'MADERA_ESTANDAR';

    this.palletStream.update((list) =>
      list.map((item) => {
        if (item.id === formVals.id) {
          return {
            ...item,
            palletCode: (formVals.palletCode || item.palletCode).toUpperCase(),
            productId: formVals.productId || item.productId,
            description: formVals.description || item.description,
            supplierName: formVals.supplierName || item.supplierName,
            palletTypeId: pType,
            palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Madera Estándar',
            pieces: Number(formVals.pieces) || item.pieces,
            observations: formVals.observations || undefined,
          };
        }
        return item;
      })
    );

    this.showEditPalletModal.set(false);
    this.toast.success(`Tarima ${formVals.palletCode} actualizada correctamente`);
  }

  removePalletFromStream(id: string): void {
    this.palletStream.update((list) => {
      const filtered = list.filter((item) => item.id !== id);
      return filtered.map((item, idx) => ({ ...item, palletNumber: idx + 1 }));
    });
    this.toast.info('Tarima eliminada de la lista de descarga');
  }

  openChangeRemisionModal(): void {
    const current = this.selectedReception();
    if (!current) return;
    this.newRemisionInput.set(current.checkIn.docNumber);
    this.changeJustification.set('');
    this.showChangeRemisionModal.set(true);
  }

  closeChangeRemisionModal(): void {
    this.showChangeRemisionModal.set(false);
  }

  submitChangeRemision(): void {
    const current = this.selectedReception();
    if (!current) return;
    const oldRem = current.checkIn.docNumber;
    const newRem = this.newRemisionInput().trim();
    const just = this.changeJustification().trim();

    if (!newRem || !just) {
      this.toast.warning('La nueva remisión y la justificación son obligatorias.');
      return;
    }

    const count = this.movementsService.updateRemisionNumber(oldRem, newRem, just);
    if (count > 0) {
      this.toast.success(`Remisión actualizada de "${oldRem}" a "${newRem}"`);
      this.showChangeRemisionModal.set(false);
      // Re-seleccionar la recepción actualizada
      const updated = this.movementsService.findReceptionByFolio(current.folio);
      if (updated) this.selectReception(updated);
    } else {
      this.toast.error('No se pudo actualizar la remisión.');
    }
  }

  openCancelModal(): void {
    const rec = this.selectedReception();
    if (!rec) return;
    this.cancelReason.set('');
    this.cancelAdminUser.set(this.authState.currentUser()?.email || this.authState.userFullName() || 'admin@4guard.com');
    this.cancelAdminPassword.set('');
    this.cancelErrorMessage.set(null);
    this.showCancelPassword.set(false);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.cancelErrorMessage.set(null);
  }

  confirmCancelReception(): void {
    const rec = this.selectedReception();
    if (!rec) return;

    const reason = this.cancelReason().trim();
    const user = this.cancelAdminUser().trim();
    const password = this.cancelAdminPassword().trim();

    if (!reason || reason.length < 5) {
      this.cancelErrorMessage.set('Por favor ingresa un motivo detallado de cancelación (mínimo 5 caracteres).');
      return;
    }

    if (!user) {
      this.cancelErrorMessage.set('Por favor ingresa el usuario administrador.');
      return;
    }

    if (!password) {
      this.cancelErrorMessage.set('Por favor ingresa tu contraseña de administrador para autorizar la revocación.');
      return;
    }

    this.isCancelling.set(true);
    this.cancelErrorMessage.set(null);

    const adminLabel = this.authState.userFullName() ? `${this.authState.userFullName()} (${user})` : user;
    const cancelled = this.movementsService.cancelReception(
      rec.folio,
      reason,
      adminLabel
    );

    this.isCancelling.set(false);
    this.showCancelModal.set(false);

    if (cancelled) {
      this.selectReception(cancelled);
      this.selectedPrintReception.set(cancelled);
      this.printType.set('CANCELLATION');
      this.toast.success(`Recepción #${cancelled.folio} cancelada exitosamente.`);
      this.showPrintModal.set(true);
    } else {
      this.toast.error('No se pudo procesar la cancelación de la recepción.');
    }
  }

  initiateCompleteReception(): void {
    const rec = this.selectedReception();
    if (!rec) {
      this.toast.warning('No hay ninguna recepción seleccionada.');
      return;
    }
    if (this.palletStream().length === 0) {
      this.toast.warning('Debes ingresar al menos 1 Tarima en la lista de descarga antes de generar la impresión.');
      return;
    }

    const currentStream = [...this.palletStream()];
    const formVals = this.altaForm.value;

    const updated = this.movementsService.completeReception(
      rec.folio,
      formVals.lotNumber || '01.07.2026',
      rec.elaborationDate || '2026-01-01',
      formVals.expirationDate || '2028-07-31',
      formVals.productId || '12572733',
      formVals.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      formVals.piecesPerPallet || 480,
      (formVals.selectedPalletType as PalletType) || 'MADERA_ESTANDAR',
      currentStream,
      formVals.observations || undefined,
      'Christian Durán',
      'Gerente Operativo'
    );

    const recToPrint: ReceptionHeader = updated || {
      ...rec,
      status: 'COMPLETED',
      lotNumber: formVals.lotNumber || '01.07.2026',
      expirationDate: formVals.expirationDate || '2028-07-31',
      productId: formVals.productId || '12572733',
      productName: formVals.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: formVals.supplierName || 'LE MEXICO S.A DE C.V',
      piecesPerPallet: formVals.piecesPerPallet || 40,
      selectedPalletType: (formVals.selectedPalletType as PalletType) || 'TARIMA_CHEP',
      pallets: currentStream,
      observations: formVals.observations || undefined,
    };

    if (updated) {
      this.selectedReception.set(updated);
    } else {
      this.selectedReception.set(recToPrint);
    }

    this.selectedPrintReception.set(recToPrint);
    this.printType.set('RECEPTION');
    this.showPrintModal.set(true);
    this.toast.success(`Recepción #${rec.folio} completada. Formato oficial generado con ${currentStream.length} tarimas.`);
  }

  onLeaderValidated(event: { leaderName: string }): void {
    this.showLeaderModal.set(false);
    const action = this.leaderAction();
    const rec = this.selectedReception();
    if (!rec) return;

    if (action === 'COMPLETE') {
      const updated = this.movementsService.completeReception(
        rec.folio,
        this.altaForm.value.lotNumber || '01.07.2026',
        rec.elaborationDate || '2026-01-01',
        this.altaForm.value.expirationDate || '2028-07-31',
        this.altaForm.value.productId || '12572733',
        this.altaForm.value.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
        this.altaForm.value.piecesPerPallet || 40,
        (this.altaForm.value.selectedPalletType as PalletType) || 'TARIMA_CHEP',
        this.palletStream(),
        this.altaForm.value.observations || undefined,
        'Christian Durán',
        event.leaderName
      );

      if (updated) {
        this.selectReception(updated);
        this.selectedPrintReception.set(updated);
        this.printType.set('RECEPTION');
        this.showPrintModal.set(true);
        this.toast.success(`Recepción #${updated.folio} cerrada exitosamente`);
      }
    } else if (action === 'CANCEL') {
      const cancelled = this.movementsService.cancelReception(
        rec.folio,
        this.cancellationJustification() || 'Cancelado por el operador en andén',
        event.leaderName
      );

      if (cancelled) {
        this.selectReception(cancelled);
        this.selectedPrintReception.set(cancelled);
        this.printType.set('CANCELLATION');
        this.showPrintModal.set(true);
        this.toast.info(`Recepción #${cancelled.folio} cancelada`);
      }
    }

    this.leaderAction.set(null);
  }

  onProductSelect(productId: string): void {
    const prod = this.products().find((p) => p.id === productId);
    if (prod) {
      this.altaForm.patchValue({
        productId: prod.id,
        productName: prod.name,
        piecesPerPallet: prod.defaultPieces,
      });
    }
  }

  // ── ESCÁNER Y CARGA RÁPIDA DE UAs (PASO 2) ──
  onUaEnter(event?: Event): void {
    if (event) event.preventDefault();
    let code = this.uaCodeInput().trim();
    if (!code) {
      // Auto-generar código si el usuario presiona [+]
      code = `03761304${Date.now().toString().slice(-10)}`;
    }

    const pzas = this.altaForm.value.piecesPerPallet || 480;
    const pType = (this.altaForm.value.selectedPalletType as PalletType) || 'MADERA_ESTANDAR';
    const prodId = this.altaForm.value.productId || '12572733';
    const prodName = this.altaForm.value.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1';
    const suppName = this.altaForm.value.supplierName || 'LE MEXICO S.A DE C.V';
    const nextNum = this.palletStream().length + 1;

    const newItem: ReceptionPalletItem = {
      id: `ua-${Date.now()}-${nextNum}`,
      palletNumber: nextNum,
      palletCode: code.toUpperCase(),
      description: prodName,
      productId: prodId,
      supplierName: suppName,
      pieces: pzas,
      observations: this.uaObsInput().trim() || undefined,
      palletTypeId: pType,
      palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Madera Estándar',
    };

    this.palletStream.update((list) => [...list, newItem]);
    this.uaCodeInput.set('');
    this.uaObsInput.set('');

    setTimeout(() => {
      if (this.uaInput?.nativeElement) {
        this.uaInput.nativeElement.focus();
      }
    }, 10);
  }

  // ── AUXILIARES Y CATÁLOGOS ──
  onCarrierLineSelect(code: string): void {
    const item = this.carrierLines().find((c) => c.code === code);
    if (item) {
      this.checkInForm.patchValue({ carrierLineCode: item.code, carrierLine: item.name });
    }
  }

  onClientSelect(code: string): void {
    const item = this.clients().find((c) => c.code === code);
    if (item) {
      this.checkInForm.patchValue({ clientCode: item.code, client: item.name });
    }
  }

  onRampSelect(code: string): void {
    const item = this.ramps().find((r) => r.code === code);
    if (item) {
      this.checkInForm.patchValue({ rampCode: item.code, rampNumber: item.rampNumber });
    }
  }

  onForkliftOperatorSelect(code: string): void {
    const item = this.forkliftOperators().find((m) => m.code === code);
    if (item) {
      this.checkInForm.patchValue({ forkliftOperatorCode: item.code, forkliftOperator: item.name });
    }
  }

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
      this.checkInForm.patchValue({ carrierLineCode: code, carrierLine: name });
    } else if (type === 'RAMP') {
      const rNum = this.quickAddRampNumInput();
      this.movementsService.addRamp({ code, rampNumber: rNum, name });
      this.checkInForm.patchValue({ rampCode: code, rampNumber: rNum });
    }

    this.showQuickAddModal.set(false);
  }

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
      clientCode: 'CLI-001',
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

  openPrintPreview(rec: ReceptionHeader): void {
    const palletsToPrint = rec.pallets && rec.pallets.length > 0 ? rec.pallets : [...this.palletStream()];
    const formVals = this.altaForm.value;

    const recToPrint: ReceptionHeader = {
      ...rec,
      lotNumber: rec.lotNumber || formVals.lotNumber || '01.07.2026',
      expirationDate: rec.expirationDate || formVals.expirationDate || '2028-07-31',
      productId: rec.productId || formVals.productId || '12572733',
      productName: rec.productName || formVals.productName || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: rec.supplierName || formVals.supplierName || 'LE MEXICO S.A DE C.V',
      piecesPerPallet: rec.piecesPerPallet || formVals.piecesPerPallet || 40,
      selectedPalletType: rec.selectedPalletType || (formVals.selectedPalletType as PalletType) || 'TARIMA_CHEP',
      pallets: palletsToPrint,
      observations: rec.observations || formVals.observations || undefined,
    };

    this.selectedPrintReception.set(recToPrint);
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
