import { Component, ElementRef, ViewChild, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthState } from '../../../../core/auth/auth.state';
import { ToastService } from '../../../../core/services/toast.service';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import {
  CheckInCasetaData,
  ReceptionHeader,
  ReceptionPalletItem,
  PalletType,
  PALLET_TYPE_LABELS,
  MovementAuditEntry,
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
  private readonly router = inject(Router);

  goToManageCarriers(): void {
    this.router.navigate(['/admin/carriers']);
  }

  // Auto-foco en escáner de UAs
  @ViewChild('uaInput') uaInput!: ElementRef<HTMLInputElement>;
  // ── ESTADO DEL WORKBENCH ──
  formMode = signal<'idle' | 'create' | 'detail'>('idle');
  searchQuery = signal('');
  statusFilter = signal<string>('ALL');
  selectedReception = signal<ReceptionHeader | null>(null);
  auditEntries = signal<MovementAuditEntry[]>([]);

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

  getInitials(name?: string): string {
    if (!name) return 'RC';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Modales del Workbench
  showCheckInModal = signal(false);
  showChangeRemisionModal = signal(false);
  showEditPalletModal = signal(false);
  showQuickAddModal = signal(false);
  showPrintModal = signal(false);
  showLeaderModal = signal(false);

  quickAddType = signal<'CARRIER' | 'RAMP'>('CARRIER');
  quickAddCodeInput = signal('');
  quickAddNameInput = signal('');
  quickAddRampNumInput = signal<number>(13);

  // ── ESTADO DE EDICIÓN DE TARIMA INDIVIDUAL (ADMIN) ──
  editingPallet = signal<ReceptionPalletItem | null>(null);
  palletTypes = Object.entries(PALLET_TYPE_LABELS) as [PalletType, string][];

  // ── STREAM REACTIVO DE TARIMAS (UA) ──
  palletStream = signal<ReceptionPalletItem[]>([]);
  uaCodeInput = signal('');
  uaObsInput = signal('');
  generatedFolio = signal('');

  // ── CATÁLOGOS BASE REACTIVOS ──
  carrierLines = this.movementsService.carrierLines;
  clients = this.movementsService.clients;
  ramps = this.movementsService.ramps;
  forkliftOperators = this.movementsService.forkliftOperators;

  suppliers = signal<{ code: string; name: string }[]>([]);
  products = signal<{ id: string; name: string; defaultPieces: number }[]>([]);

  // ── FORMULARIO: ALTA DE CASETA (Check-in inicial) ──
  checkInForm = this.fb.group({
    carrierLineCode: [''],
    carrierLine: ['', [Validators.required]],
    receptionTime: [new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), [Validators.required]],
    docNumber: ['', [Validators.required]],
    docDate: [new Date().toISOString().slice(0, 10), [Validators.required]],
    elaborationDate: [''],
    expirationDate: [''],
    lotNumber: [''],
    clientCode: [''],
    client: ['', [Validators.required]],
    rampCode: ['R-01'],
    rampNumber: [1, [Validators.required]],
    forkliftOperatorCode: [''],
    forkliftOperator: ['', [Validators.required]],
    driverName: ['', [Validators.required]],
    tractorPlates: ['', [Validators.required]],
    boxPlates: ['', [Validators.required]],
    sealNumber: [''],
  });

  // Lista Reactiva de Cinchos/Sellos
  sealList = signal<string[]>([]);
  tempSealInput = signal('');

  // ── FORMULARIO: ALTA / EDICIÓN DE RECEPCIÓN (Detalle Producto) ──
  altaForm = this.fb.group({
    lotNumber: ['', [Validators.required]],
    expirationDate: ['', [Validators.required]],
    forkliftOperator: ['', [Validators.required]],
    rampNumber: [1, [Validators.required]],
    productId: ['', [Validators.required]],
    productName: ['', [Validators.required]],
    supplierName: ['', [Validators.required]],
    piecesPerPallet: [0, [Validators.required, Validators.min(1)]],
    selectedPalletType: ['MADERA_ESTANDAR' as PalletType, [Validators.required]],
    observations: [''],
  });

  // ── FORMULARIO: EDICIÓN DE TARIMA INDIVIDUAL (ADMIN) ──
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
    // Estado inicial: Siempre iniciar en Sin selección (Empty State WMS)
    this.formMode.set('idle');
    this.selectedReception.set(null);
  }

  ngOnInit(): void {
    this.movementsService.movementsApi.getSuppliers().subscribe({
      next: (sups) => {
        if (sups && sups.length > 0) {
          this.suppliers.set(sups.map((s) => ({ code: s.id || s.code, name: s.commercialName || s.tradeName || s.name })));
        }
      },
      error: () => {},
    });

    this.movementsService.movementsApi.getProductSkus().subscribe({
      next: (prods) => {
        if (prods && prods.length > 0) {
          this.products.set(prods.map((p) => ({ id: p.id || p.code, name: p.name || p.description, defaultPieces: p.piecesPerPallet || 480 })));
        }
      },
      error: () => {},
    });

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

  resetCheckInForm(): void {
    this.checkInForm.reset({
      carrierLineCode: '',
      carrierLine: '',
      receptionTime: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      docNumber: '',
      docDate: new Date().toISOString().slice(0, 10),
      elaborationDate: '',
      expirationDate: '',
      lotNumber: '',
      clientCode: '',
      client: '',
      rampCode: 'R-01',
      rampNumber: 1,
      forkliftOperatorCode: '',
      forkliftOperator: '',
      driverName: '',
      tractorPlates: '',
      boxPlates: '',
      sealNumber: '',
    });
    this.sealList.set([]);
  }

  // Iniciar registro de nueva pre-recepción en el panel (sin modal)
  startNewReception(): void {
    this.formMode.set('create');
    this.selectedReception.set(null);
    localStorage.removeItem('4g_active_reception_folio');
    this.resetCheckInForm();
  }

  // Restablecer a estado inicial (Sin selección)
  resetToIdle(): void {
    this.formMode.set('idle');
    this.selectedReception.set(null);
    localStorage.removeItem('4g_active_reception_folio');
  }

  // ── OPERACIONES DEL WORKBENCH ──

  selectReception(rec: ReceptionHeader): void {
    this.formMode.set('detail');
    this.selectedReception.set(rec);
    localStorage.setItem('4g_active_reception_folio', rec.folio);
    this.palletStream.set(rec.pallets ? [...rec.pallets] : []);
    this.loadAuditLogs(rec.folio);
    this.altaForm.patchValue({
      lotNumber: rec.lotNumber || rec.checkIn.lotNumber || '',
      expirationDate: rec.expirationDate || rec.checkIn.expirationDate || '',
      forkliftOperator: rec.checkIn.forkliftOperator || '',
      rampNumber: rec.checkIn.rampNumber || 1,
      productId: rec.productId || '',
      productName: rec.productName || '',
      supplierName: rec.supplierName || '',
      piecesPerPallet: rec.piecesPerPallet || 0,
      selectedPalletType: rec.selectedPalletType || 'MADERA_ESTANDAR',
      observations: rec.observations || '',
    });
  }

  loadAuditLogs(folio: string): void {
    const logs = this.movementsService.getReceptionAuditLogs(folio);
    this.auditEntries.set(logs || []);
  }

  getAuditIcon(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'add_circle';
      case 'RECEPCION_COMPLETADA': return 'check_circle';
      case 'TARIMA_EDITADA':       return 'edit_note';
      case 'RECEPCION_ACTUALIZADA':return 'edit';
      case 'RECEPCION_CANCELADA':  return 'cancel';
      default:                     return 'history';
    }
  }

  getAuditColorClass(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'carriers-tl-node--emerald';
      case 'RECEPCION_COMPLETADA': return 'carriers-tl-node--blue';
      case 'TARIMA_EDITADA':
      case 'RECEPCION_ACTUALIZADA':return 'carriers-tl-node--amber';
      case 'RECEPCION_CANCELADA':  return 'carriers-tl-node--red';
      default:                     return 'carriers-tl-node--indigo';
    }
  }

  getAuditSummary(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'Pre-Recepción Registrada en Caseta';
      case 'RECEPCION_COMPLETADA': return 'Descarga Finalizada y Cerrada en WMS';
      case 'TARIMA_EDITADA':       return 'Modificación Manual de Tarima/UA';
      case 'RECEPCION_ACTUALIZADA':return 'Actualización de Datos de Recepción';
      case 'RECEPCION_CANCELADA':  return 'Cancelación Extraordinaria de Recepción';
      default:                     return action;
    }
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
      this.checkInForm.patchValue({ carrierLine: code });
    } else if (type === 'RAMP') {
      const rNum = this.quickAddRampNumInput();
      this.movementsService.addRamp({ code, rampNumber: rNum, name });
      this.checkInForm.patchValue({ rampNumber: rNum });
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
