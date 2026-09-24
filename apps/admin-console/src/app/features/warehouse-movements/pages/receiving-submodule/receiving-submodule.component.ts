import { Component, ElementRef, ViewChild, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthState } from '../../../../core/auth/auth.state';
import { ToastService } from '../../../../core/services/toast.service';
import { PrintService } from '../../../../core/services/print.service';
import { WarehouseMovementsService, isUuid } from '../../services/warehouse-movements.service';
import { WarehouseMovementsApiService } from '../../services/warehouse-movements-api.service';
import {
  CheckInCasetaData,
  ReceptionHeader,
  ReceptionPalletItem,
  PalletType,
  PALLET_TYPE_LABELS,
  MovementAuditEntry,
  PatioUnitMonitor,
  RampOccupancyStatus,
  RampItem,
} from '../../models/warehouse-movements.models';
import { LeaderAuthModalComponent } from '../../components/leader-auth-modal/leader-auth-modal.component';
import { PrintReceptionLayoutComponent } from '../../components/print-layouts/print-reception-layout.component';
import { PrintCancellationLayoutComponent } from '../../components/print-layouts/print-cancellation-layout.component';
import { BayOccupancySelectorComponent, BaySelectionResult } from '../../../../shared/components/bay-occupancy-selector/bay-occupancy-selector.component';

export type ReceptionDetailSubTab = 'descarga' | 'caseta' | 'trazabilidad';

@Component({
  selector: 'fg-receiving-submodule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    LeaderAuthModalComponent,
    PrintReceptionLayoutComponent,
    PrintCancellationLayoutComponent,
    BayOccupancySelectorComponent,
  ],
  templateUrl: './receiving-submodule.component.html',
  styleUrl: './receiving-submodule.component.css',
})
export class ReceivingSubmoduleComponent implements OnInit {
  protected readonly authState = inject(AuthState);
  protected readonly Math      = Math;
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly movementsApi = inject(WarehouseMovementsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly printService = inject(PrintService);
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
  showAuditTimeline = signal(false);

  toggleShowAuditTimeline(): void {
    this.showAuditTimeline.update((v) => !v);
  }

  // Cola Reactiva de Pre-Recepciones Pendientes (Caseta)
  pendingReceptions = this.movementsService.pendingReceptions;
  pendingReceptionsCount = this.movementsService.pendingReceptionsCount;

  // Matriz de Ocupación de Rampas 1-12
  rampOccupancyStatus = this.movementsService.rampOccupancyStatus;
  totalBusyRampsCount = this.movementsService.totalBusyRampsCount;
  totalFreeRampsCount = this.movementsService.totalFreeRampsCount;

  // Modal Plano de Andenes Interactivo
  showDockMapModal = signal(false);

  // Modal Selector Visual de Bahías (22 Pallets)
  showBaySelectorModal = signal(false);

  // Modal Re-etiquetado Selectivo de UAs (SSCC GS1-128)
  showRelabelModal = signal(false);
  selectedPalletIdsForRelabel = signal<Set<string>>(new Set());
  relabelReason = signal<string>('Re-etiquetado selectivo a estándar 4Guard SSCC GS1-128');
  isRelabelling = signal<boolean>(false);

  // Modal Edición de Ficha de Caseta
  showEditCasetaModal = signal(false);
  editCasetaSeals = signal<string[]>([]);
  tempEditSealInput = signal('');

  editCasetaForm = this.fb.group({
    docNumber: ['', [Validators.required]],
    clientCode: [''],
    client: ['', [Validators.required]],
    carrierLineCode: [''],
    carrierLine: ['', [Validators.required]],
    receptionTime: ['', [Validators.required]],
    driverName: ['', [Validators.required]],
    tractorPlates: ['', [Validators.required]],
    boxPlates: ['', [Validators.required]],
    rampNumber: [1, [Validators.required]],
  });

  openEditCasetaModal(): void {
    const rec = this.selectedReception();
    if (!rec) return;

    if (rec.status !== 'REGISTERED') {
      this.toast.warning('La Ficha de Caseta solo puede modificarse en estado inicial (antes de asignar andén/montacarguista o finalizar).');
      return;
    }

    const carrierName = rec.checkIn.carrierLine || '';
    const clientName = rec.checkIn.client || '';
    const matchedCarrier = this.carrierLines().find(
      (c) =>
        c.code === rec.checkIn.carrierLineCode ||
        c.name === carrierName ||
        (carrierName && c.name.toLowerCase().includes(carrierName.toLowerCase())) ||
        (carrierName && carrierName.toLowerCase().includes(c.name.toLowerCase()))
    );
    const matchedClient = this.clients().find(
      (cl) =>
        cl.code === rec.checkIn.clientCode ||
        cl.name === clientName ||
        (clientName && cl.name.toLowerCase().includes(clientName.toLowerCase())) ||
        (clientName && clientName.toLowerCase().includes(cl.name.toLowerCase()))
    );

    this.editCasetaForm.patchValue({
      docNumber: rec.checkIn.docNumber || rec.folio || '',
      clientCode: matchedClient ? matchedClient.code : (rec.checkIn.clientCode || ''),
      client: matchedClient ? matchedClient.name : clientName,
      carrierLineCode: matchedCarrier ? matchedCarrier.code : (rec.checkIn.carrierLineCode || ''),
      carrierLine: matchedCarrier ? matchedCarrier.name : carrierName,
      receptionTime: rec.checkIn.receptionTime || '',
      driverName: rec.checkIn.driverName || '',
      tractorPlates: rec.checkIn.tractorPlates || '',
      boxPlates: rec.checkIn.boxPlates || '',
      rampNumber: rec.checkIn.rampNumber || 1,
    });
    const seals = rec.checkIn.sealNumbers && rec.checkIn.sealNumbers.length > 0
      ? [...rec.checkIn.sealNumbers]
      : (rec.checkIn.sealNumber ? [rec.checkIn.sealNumber] : []);
    this.editCasetaSeals.set(seals);
    this.tempEditSealInput.set('');
    this.showEditCasetaModal.set(true);
  }

  onEditCasetaCarrierChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    const found = this.carrierLines().find((c) => c.name === val || c.code === val);
    if (found) {
      this.editCasetaForm.patchValue({ carrierLineCode: found.code, carrierLine: found.name });
    }
  }

  onEditCasetaClientChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    const found = this.clients().find((c) => c.name === val || c.code === val);
    if (found) {
      this.editCasetaForm.patchValue({ clientCode: found.code, client: found.name });
    }
  }

  addEditSeal(): void {
    const val = this.tempEditSealInput().trim().toUpperCase();
    if (!val) return;
    if (this.editCasetaSeals().includes(val)) {
      this.toast.warning(`El sello ${val} ya está registrado.`);
      return;
    }
    this.editCasetaSeals.update((l) => [...l, val]);
    this.tempEditSealInput.set('');
  }

  removeEditSeal(idx: number): void {
    this.editCasetaSeals.update((l) => l.filter((_, i) => i !== idx));
  }

  saveCasetaModifications(): void {
    if (this.tempEditSealInput().trim()) {
      this.addEditSeal();
    }

    if (this.editCasetaForm.invalid) {
      this.editCasetaForm.markAllAsTouched();
      this.toast.warning('Por favor completa los campos requeridos de la ficha.');
      return;
    }

    if (this.editCasetaSeals().length === 0) {
      this.toast.warning('Debes mantener al menos 1 sello o cincho de seguridad.');
      return;
    }

    const currentRec = this.selectedReception();
    if (!currentRec) return;

    const val = this.editCasetaForm.value;
    const rNum = Number(val.rampNumber) || currentRec.checkIn.rampNumber || 1;
    const updatedDoc = (val.docNumber || currentRec.checkIn.docNumber || '').trim().toUpperCase();

    const updatedCheckIn: CheckInCasetaData = {
      ...currentRec.checkIn,
      docNumber: updatedDoc,
      carrierLineCode: val.carrierLineCode || currentRec.checkIn.carrierLineCode,
      carrierLine: val.carrierLine || currentRec.checkIn.carrierLine,
      receptionTime: val.receptionTime || currentRec.checkIn.receptionTime,
      driverName: val.driverName || currentRec.checkIn.driverName,
      tractorPlates: (val.tractorPlates || currentRec.checkIn.tractorPlates).toUpperCase(),
      boxPlates: (val.boxPlates || currentRec.checkIn.boxPlates).toUpperCase(),
      clientCode: val.clientCode || currentRec.checkIn.clientCode,
      client: val.client || currentRec.checkIn.client,
      rampNumber: rNum,
      rampCode: `LOC-RAMP-${String(rNum).padStart(2, '0')}`,
      sealNumbers: this.editCasetaSeals(),
      sealNumber: this.editCasetaSeals().join(', '),
    };

    const updatedReception: ReceptionHeader = {
      ...currentRec,
      checkIn: updatedCheckIn,
    };

    this.movementsService.updateCasetaCheckInBackend(currentRec.id || currentRec.folio, updatedCheckIn).subscribe({
      next: (persisted) => {
        this.selectedReception.set(persisted);
        this.altaForm.patchValue({ rampNumber: rNum });
        this.showEditCasetaModal.set(false);
        this.toast.success('Ficha operativa actualizada y guardada correctamente en la base de datos.');
        this.loadAuditLogs(persisted.id || persisted.folio);
      },
      error: () => {
        this.selectedReception.set(updatedReception);
        this.altaForm.patchValue({ rampNumber: rNum });
        this.showEditCasetaModal.set(false);
        this.toast.success('Ficha operativa actualizada.');
      }
    });

    this.auditEntries.update((entries) => [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        timestamp: new Date().toLocaleTimeString(),
        action: 'EDICIÓN_CASETA',
        actionLabel: 'Modificación de Ficha de Caseta',
        username: this.authState.userFullName() || this.authState.currentUser()?.email || 'Supervisor',
        reason: `Remisión: ${updatedDoc}, Cliente: ${updatedCheckIn.client}, Chofer: ${updatedCheckIn.driverName}, Placas: ${updatedCheckIn.tractorPlates}/${updatedCheckIn.boxPlates}, Rampa: ${rNum}`,
        observations: `Sellos actualizados: ${updatedCheckIn.sealNumber}`,
        details: [
          { fieldName: 'No. Remisión', newValue: updatedDoc },
          { fieldName: 'Cliente', newValue: updatedCheckIn.client },
          { fieldName: 'Línea Transportista', newValue: updatedCheckIn.carrierLine },
          { fieldName: 'Chofer', newValue: updatedCheckIn.driverName },
          { fieldName: 'Placas Tracto', newValue: updatedCheckIn.tractorPlates },
          { fieldName: 'Placas Caja', newValue: updatedCheckIn.boxPlates },
          { fieldName: 'Rampa Asignada', newValue: `Rampa ${rNum}` },
          { fieldName: 'Sellos', newValue: updatedCheckIn.sealNumber },
        ],
      },
      ...entries,
    ]);
  }

  onRampMatrixClick(ramp: RampOccupancyStatus): void {
    if (ramp.status === 'OCCUPIED_INBOUND' && ramp.operationFolio) {
      this.loadFromNotification(ramp.operationFolio);
      this.showDockMapModal.set(false);
    } else if (ramp.status === 'AVAILABLE') {
      if (this.formMode() === 'create') {
        this.checkInForm.patchValue({ rampNumber: ramp.rampNumber, rampCode: ramp.code });
        this.toast.info(`Rampa ${ramp.rampNumber} seleccionada.`);
      } else if (this.formMode() === 'detail' && this.selectedReception()?.status === 'REGISTERED') {
        this.altaForm.patchValue({ rampNumber: ramp.rampNumber });
        this.toast.info(`Rampa ${ramp.rampNumber} asignada al Folio #${this.selectedReception()?.folio}`);
      }
      this.showDockMapModal.set(false);
    }
  }

  getRampOccupancy(rampNumber: number): RampOccupancyStatus | undefined {
    return this.rampOccupancyStatus().find((r) => r.rampNumber === rampNumber);
  }

  isRampBusy(rampNumber: number, allowedFolio?: string | number): boolean {
    const occ = this.getRampOccupancy(rampNumber);
    if (!occ || occ.status === 'AVAILABLE') return false;
    if (allowedFolio != null && String(occ.operationFolio) === String(allowedFolio)) return false;
    return true;
  }

  getRampDisplayLabel(rm: RampItem, currentFolio?: string | number): string {
    const occ = this.getRampOccupancy(rm.rampNumber);
    if (!occ || occ.status === 'AVAILABLE') {
      return `${rm.name} (Libre)`;
    }
    if (currentFolio != null && String(occ.operationFolio) === String(currentFolio)) {
      return `${rm.name} (Asignada a este Folio)`;
    }
    if (occ.status === 'OCCUPIED_INBOUND') {
      return `${rm.name} (Ocupada - Folio #${occ.operationFolio})`;
    }
    return `${rm.name} (Ocupada - Salida #${occ.operationFolio})`;
  }

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

  // Modal Cambio de Remisión con Autorización de Rango Superior
  showChangeRemisionModal = signal(false);
  newRemisionInput = signal('');
  changeRemisionReason = signal('');
  changeRemisionAdminUser = signal('');
  changeRemisionAdminPassword = signal('');
  changeRemisionError = signal<string | null>(null);
  showChangeRemisionPassword = signal(false);
  isChangingRemision = signal(false);

  toggleShowChangeRemisionPassword(): void {
    this.showChangeRemisionPassword.update((v) => !v);
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

  suppliers = this.movementsService.suppliers;

  products = signal<{ id: string; code: string; name: string; defaultPieces: number }[]>([]);

  // ── AUTOCOMPLETE PREDICTIVO DE PRODUCTO (SKU) ──
  skuSearchQuery = signal<string>('');
  isSkuDropdownOpen = signal<boolean>(false);
  filteredProducts = computed(() => {
    const q = this.skuSearchQuery().toLowerCase().trim();
    const list = this.products();
    if (!q) return list;
    return list.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );
  });

  // ── AUTOCOMPLETE PREDICTIVO DE MONTACARGUISTA ──
  operatorSearchQuery = signal<string>('');
  isOperatorDropdownOpen = signal<boolean>(false);
  filteredForkliftOperators = computed(() => {
    const q = this.operatorSearchQuery().toLowerCase().trim();
    const list = this.forkliftOperators();
    if (!q) return list;
    return list.filter(
      (op) =>
        (op.name && op.name.toLowerCase().includes(q)) ||
        (op.code && op.code.toLowerCase().includes(q))
    );
  });

  // ── AUTOCOMPLETE PREDICTIVO DE PROVEEDOR ──
  supplierSearchQuery = signal<string>('');
  isSupplierDropdownOpen = signal<boolean>(false);
  filteredSuppliers = computed(() => {
    const q = this.supplierSearchQuery().toLowerCase().trim();
    const list = this.suppliers();
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q))
    );
  });

  // ── AUTOCOMPLETE PREDICTIVO DE TIPO DE TARIMA ──
  palletTypeSearchQuery = signal<string>('');
  isPalletTypeDropdownOpen = signal<boolean>(false);
  filteredPalletTypes = computed(() => {
    const q = this.palletTypeSearchQuery().toLowerCase().trim();
    const list = this.palletTypes;
    if (!q) return list;
    return list.filter(
      (pt) =>
        pt[0].toLowerCase().includes(q) ||
        pt[1].toLowerCase().includes(q)
    );
  });

  // ── FORMULARIO: ALTA DE CASETA (Check-in inicial) ──
  checkInForm = this.fb.group({
    carrierLineCode: [''],
    carrierLine: ['', [Validators.required]],
    receptionTime: [new Date().toTimeString().slice(0, 5), [Validators.required]],
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
    economicNumber: [''],
    securityApproved: [true],
  });

  // ── REINGENIERÍA: MONITOR DE UNIDADES EN PATIO Y CANDADO ANTI-DUPLICADOS ──
  activePatioTab = signal<'workbench' | 'patio'>('workbench');
  duplicateUaError = signal<string | null>(null);
  expirationWarningAlert = signal<string | null>(null);

  patioUnits = signal<PatioUnitMonitor[]>([]);

  patioWaitAlertsCount = computed(() => this.patioUnits().filter(u => u.hasWaitAlert).length);
  patioDischargeAlertsCount = computed(() => this.patioUnits().filter(u => u.hasDischargeAlert).length);

  isSubmitting = signal(false);

  // Lista Reactiva de Cinchos/Sellos
  sealList = signal<string[]>([]);
  tempSealInput = signal('');

  // ── GESTIÓN MULTI-LOTE POR RECEPCIÓN Y ASIGNACIÓN A UA ──
  lotsList = signal<Array<{ lotNumber: string; elaborationDate?: string; expirationDate: string }>>([]);
  selectedScanningLot = signal<string>('');
  showAddLotModal = signal(false);
  newLotForm = this.fb.group({
    lotNumber: ['', [Validators.required]],
    elaborationDate: [''],
    expirationDate: ['', [Validators.required]],
  });

  // ── FORMULARIO: ALTA / EDICIÓN DE RECEPCIÓN (Detalle Producto) ──
  altaForm = this.fb.group({
    lotNumber: ['', [Validators.required]],
    elaborationDate: [''],
    expirationDate: ['', [Validators.required]],
    storageLocation: [''],
    storageLocationId: [''],
    forkliftOperator: ['', [Validators.required]],
    rampNumber: [1, [Validators.required]],
    productId: ['', [Validators.required]],
    productName: [''],
    supplierName: ['', [Validators.required]],
    piecesPerPallet: [0, [Validators.required, Validators.min(1)]],
    selectedPalletType: ['' as any, [Validators.required]],
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
    palletTypeId: ['' as any, [Validators.required]],
    pieces: [0, [Validators.required, Validators.min(1)]],
    observations: [''],
    lotNumber: [''],
    expirationDate: [''],
    docNumber: [''],
  });

  // ── ESTADO DE MODAL LÍDER E IMPRESIÓN ──
  leaderModalTitle = signal('');
  leaderAction = signal<'COMPLETE' | 'CANCEL' | null>(null);
  cancellationJustification = signal('');
  printType = signal<'RECEPTION' | 'CANCELLATION' | null>(null);
  selectedPrintReception = signal<ReceptionHeader | null>(null);

  // ── COMPUTADOS DEL WORKBENCH ──
  kpiTotal = computed(() => this.movementsService.receptions().length);
  kpiRegistered = computed(() => this.movementsService.receptions().filter((r) => r.status === 'REGISTERED').length);
  kpiInProcess = computed(() => this.movementsService.receptions().filter((r) => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS' || r.status === 'DISCHARGED').length);
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
    this.movementsService.loadInitialBackendData();
    this.movementsService.reloadSuppliers();

    this.movementsService.movementsApi.getProductSkus().subscribe({
      next: (prods: any) => {
        if (prods && prods.length > 0) {
          const sorted = prods
            .map((p: any) => ({
              id: p.id,
              code: String(p.code || p.id).trim(),
              name: p.name || p.description || p.code,
              defaultPieces: p.piecesPerPallet || (p.weight ? Math.round(Number(p.weight)) : 480),
            }))
            .sort((a: any, b: any) => {
              const numA = parseInt(a.code, 10);
              const numB = parseInt(b.code, 10);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
            });

          this.products.set(sorted);
          const currentRec = this.selectedReception();
          if (currentRec) {
            this.patchAltaFormWithReception(currentRec);
          }
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
    const firstCarrier = this.carrierLines()[0];
    const firstClient = this.clients()[0];
    const firstRamp = this.ramps()[0];
    const firstOp = this.forkliftOperators()[0];
    const now24 = new Date().toTimeString().slice(0, 5);

    this.checkInForm.reset({
      carrierLineCode: firstCarrier ? firstCarrier.code : '',
      carrierLine: firstCarrier ? firstCarrier.name : '',
      receptionTime: now24,
      docNumber: '',
      docDate: new Date().toISOString().slice(0, 10),
      elaborationDate: '',
      expirationDate: '',
      lotNumber: '',
      clientCode: firstClient ? firstClient.code : '',
      client: firstClient ? firstClient.name : '',
      rampCode: firstRamp ? firstRamp.code : 'R-01',
      rampNumber: firstRamp ? firstRamp.rampNumber : 1,
      forkliftOperatorCode: firstOp ? firstOp.code : '',
      forkliftOperator: firstOp ? firstOp.name : '',
      driverName: '',
      tractorPlates: '',
      boxPlates: '',
      sealNumber: '',
    });
    this.sealList.set([]);
  }

  resetAltaForm(): void {
    this.altaForm.reset({
      lotNumber: '',
      elaborationDate: '',
      expirationDate: '',
      storageLocation: '',
      storageLocationId: '',
      forkliftOperator: '',
      rampNumber: 1,
      productId: '',
      productName: '',
      supplierName: '',
      piecesPerPallet: 0,
      selectedPalletType: '' as any,
      observations: '',
    });
    this.skuSearchQuery.set('');
    this.isSkuDropdownOpen.set(false);
    this.operatorSearchQuery.set('');
    this.isOperatorDropdownOpen.set(false);
    this.supplierSearchQuery.set('');
    this.isSupplierDropdownOpen.set(false);
    this.palletTypeSearchQuery.set('');
    this.isPalletTypeDropdownOpen.set(false);
  }

  // Iniciar registro de nuevo arribo en Caseta de Seguridad
  startNewReception(): void {
    this.router.navigate(['/security']);
  }

  // Restablecer a estado inicial (Sin selección)
  resetToIdle(): void {
    this.formMode.set('idle');
    this.selectedReception.set(null);
    localStorage.removeItem('4g_active_reception_folio');
    this.resetAltaForm();
  }

  // ── OPERACIONES DEL WORKBENCH ──

  selectReception(rec: ReceptionHeader): void {
    this.formMode.set('detail');
    this.selectedReception.set(rec);
    localStorage.setItem('4g_active_reception_folio', rec.folio);
    this.palletStream.set(rec.pallets ? [...rec.pallets] : []);
    this.loadAuditLogs(rec.folio);
    this.patchAltaFormWithReception(rec);

    if (rec.id) {
      this.movementsApi.getReceptionById(rec.id).subscribe({
        next: (fullData) => {
          const mapped = this.movementsService.mapReceptionResponseToHeader(fullData);
          if (!mapped.checkIn?.docNumber && rec.checkIn?.docNumber) {
            mapped.checkIn.docNumber = rec.checkIn.docNumber;
          }
          this.selectedReception.set(mapped);
          this.palletStream.set(mapped.pallets ? [...mapped.pallets] : []);
          this.patchAltaFormWithReception(mapped);
          this.movementsService.updateReception(mapped.id || mapped.folio, mapped);
          this.loadAuditLogs(mapped.id || mapped.folio);
        },
        error: () => {},
      });
    }
  }

  patchAltaFormWithReception(rec: ReceptionHeader): void {
    const defaultOperator = rec.checkIn?.forkliftOperator || '';
    const currentProdId = rec.productId || rec.skuCode || '';

    const matchedProduct = (currentProdId || rec.productName)
      ? this.products().find(
          (p) =>
            p.code === currentProdId ||
            p.id === currentProdId ||
            (p.name && rec.productName && p.name.trim().toLowerCase() === rec.productName.trim().toLowerCase()) ||
            (p.code && rec.productName && rec.productName.includes(p.code))
        )
      : null;

    if (matchedProduct) {
      this.skuSearchQuery.set(`${matchedProduct.code} - ${matchedProduct.name}`);
    } else if (currentProdId) {
      this.skuSearchQuery.set(rec.productName ? `${currentProdId} - ${rec.productName}` : currentProdId);
    } else {
      this.skuSearchQuery.set('');
    }
    this.isSkuDropdownOpen.set(false);

    // Sincronizar montacarguista
    this.operatorSearchQuery.set(defaultOperator || '');
    this.isOperatorDropdownOpen.set(false);

    // Sincronizar proveedor
    this.supplierSearchQuery.set(rec.supplierName || '');
    this.isSupplierDropdownOpen.set(false);

    const hasConfiguredProduct = !!(rec.productId || rec.skuCode || (rec.pallets && rec.pallets.length > 0));
    const palletTypeValue = hasConfiguredProduct ? (rec.selectedPalletType || ('' as any)) : ('' as any);

    // Sincronizar tipo de tarima
    const ptLabel = palletTypeValue ? (PALLET_TYPE_LABELS[palletTypeValue as PalletType] || palletTypeValue) : '';
    this.palletTypeSearchQuery.set(ptLabel);
    this.isPalletTypeDropdownOpen.set(false);

    const rawObs = rec.observations || '';
    const isCasetaChecklist = rawObs.includes('[FORMATO F01') || rawObs.includes('Arribo en Caseta');
    const cleanDischargeObs = isCasetaChecklist
      ? ''
      : rawObs.replace(/\s*\|\s*Cambio (?:de )?Remisión:[^|]*/gi, '').trim();

    this.altaForm.patchValue({
      lotNumber: rec.lotNumber || rec.checkIn?.lotNumber || '',
      elaborationDate: rec.elaborationDate || rec.checkIn?.elaborationDate || '',
      expirationDate: rec.expirationDate || rec.checkIn?.expirationDate || '',
      storageLocation: rec.storageLocation || rec.storageLocationCode || 'Pasillo A - Rack 01 - Nivel 1',
      storageLocationId: rec.storageLocationId || '',
      forkliftOperator: defaultOperator,
      rampNumber: rec.checkIn?.rampNumber || 1,
      productId: matchedProduct ? matchedProduct.code : (rec.skuCode || rec.productId || ''),
      productName: rec.productName || (matchedProduct ? matchedProduct.name : ''),
      supplierName: rec.supplierName || '',
      piecesPerPallet: rec.piecesPerPallet != null ? Number(rec.piecesPerPallet) : 0,
      selectedPalletType: palletTypeValue,
      observations: cleanDischargeObs,
    });

    // Sincronizar catálogo de lotes disponibles en la sesión de recepción
    const primaryLot = (rec.lotNumber || rec.checkIn?.lotNumber || '').trim().toUpperCase();
    const primaryExp = rec.expirationDate || rec.checkIn?.expirationDate || '';
    const primaryElab = rec.elaborationDate || rec.checkIn?.elaborationDate || '';

    const initialLots: Array<{ id?: string; lotNumber: string; elaborationDate?: string; expirationDate: string; shelfLifeDaysRemaining?: number }> = [];
    if (primaryLot) {
      initialLots.push({ lotNumber: primaryLot, elaborationDate: primaryElab, expirationDate: primaryExp });
    }

    if ((rec as any).lots && Array.isArray((rec as any).lots)) {
      (rec as any).lots.forEach((lt: any) => {
        if (lt.lotNumber && !initialLots.some((l) => l.lotNumber === lt.lotNumber)) {
          initialLots.push({
            id: lt.id,
            lotNumber: lt.lotNumber,
            expirationDate: lt.expirationDate || '',
            elaborationDate: lt.elaborationDate || '',
            shelfLifeDaysRemaining: lt.shelfLifeDaysRemaining,
          });
        }
      });
    }

    if (rec.pallets && rec.pallets.length > 0) {
      rec.pallets.forEach((p) => {
        if (p.lotNumber && !initialLots.some((l) => l.lotNumber === p.lotNumber)) {
          initialLots.push({
            lotNumber: p.lotNumber,
            expirationDate: p.expirationDate || primaryExp,
            elaborationDate: (p as any).elaborationDate || primaryElab,
          });
        }
      });
    }

    const finalList = initialLots;
    this.lotsList.set(finalList as any);

    if (finalList.length > 0) {
      const activeLotNum = primaryLot || finalList[0].lotNumber;
      this.selectedScanningLot.set(activeLotNum);
      const activeLotObj = finalList.find((l) => l.lotNumber === activeLotNum) || finalList[0];
      this.altaForm.patchValue({
        lotNumber: activeLotObj.lotNumber,
        expirationDate: activeLotObj.expirationDate || '',
        elaborationDate: activeLotObj.elaborationDate || '',
      });
    } else {
      this.selectedScanningLot.set('');
      this.altaForm.patchValue({
        lotNumber: '',
        expirationDate: '',
        elaborationDate: '',
      });
    }
  }

  // ── MÉTODOS DE CONTROL DE LOTES POR UA (CRITERIO 1 & 2) ──
  getActiveLot(): { lotNumber: string; elaborationDate?: string; expirationDate: string } | undefined {
    const selected = this.selectedScanningLot();
    if (selected) {
      const found = this.lotsList().find((l) => l.lotNumber === selected);
      if (found) return found;
    }
    const lotNum = (this.altaForm.value.lotNumber || '').trim().toUpperCase();
    if (lotNum) {
      const found = this.lotsList().find((l) => l.lotNumber === lotNum);
      if (found) return found;
    }
    return this.lotsList().length > 0 ? this.lotsList()[0] : undefined;
  }

  getActiveLotShelfLifeDays(): number | null {
    const lot = this.getActiveLot();
    return this.getLotShelfLifeDays(lot);
  }

  getLotShelfLifeDays(lot?: { lotNumber: string; elaborationDate?: string; expirationDate: string }): number | null {
    const targetLot = lot || this.getActiveLot();
    if (!targetLot || !targetLot.expirationDate) return null;
    const expDate = new Date(targetLot.expirationDate + 'T00:00:00Z');
    if (isNaN(expDate.getTime())) return null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  getPalletsCountForLot(lotNum: string): number {
    if (!lotNum) return 0;
    return this.palletStream().filter((p) => p.lotNumber === lotNum).length;
  }

  isShelfLifeCompliant(days: number | null): boolean {
    return days != null && days >= 365;
  }

  openAddLotModal(): void {
    this.newLotForm.reset({
      lotNumber: '',
      elaborationDate: '',
      expirationDate: '',
    });
    this.showAddLotModal.set(true);
  }

  openEditActiveLotModal(): void {
    const lot = this.getActiveLot();
    this.newLotForm.reset({
      lotNumber: lot?.lotNumber || this.selectedScanningLot() || '',
      elaborationDate: lot?.elaborationDate || '',
      expirationDate: lot?.expirationDate || '',
    });
    this.showAddLotModal.set(true);
  }

  closeAddLotModal(): void {
    this.showAddLotModal.set(false);
  }

  saveNewLot(): void {
    if (this.newLotForm.invalid) {
      this.newLotForm.markAllAsTouched();
      this.toast.warning('Ingresa el número de lote y fecha de caducidad obligatoria.');
      return;
    }

    const vals = this.newLotForm.value;
    const lotNum = (vals.lotNumber || '').trim().toUpperCase();
    const elab = vals.elaborationDate || '';
    const exp = vals.expirationDate || '';

    if (elab && exp) {
      if (exp < elab) {
        this.toast.error('🛑 La fecha de caducidad no puede ser anterior a la de elaboración.');
        return;
      }
      if (exp === elab) {
        const ok = window.confirm('⚠️ La fecha de caducidad es idéntica a la de elaboración. ¿Desea continuar?');
        if (!ok) return;
      }
    }

    // 🔒 CANDADO DE CALIDAD DE VIDA ÚTIL OBLIGATORIO (≥ 1 AÑO / 365 DÍAS)
    if (exp) {
      const expDate = new Date(exp + 'T00:00:00Z');
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 365) {
        this.toast.error(`🛑 Candado de Calidad: El lote cuenta con sólo ${diffDays} días de vida útil restantes (< 1 año / 365 días requeridos). No se permite el registro de lotes que no cumplan la vigencia mínima.`);
        return;
      }
    }

    const existingIndex = this.lotsList().findIndex((l) => l.lotNumber === lotNum);
    if (existingIndex >= 0) {
      this.lotsList.update((list) => {
        const copy = [...list];
        copy[existingIndex] = { ...copy[existingIndex], lotNumber: lotNum, elaborationDate: elab, expirationDate: exp };
        return copy;
      });
      this.toast.success(`Lote ${lotNum} actualizado con éxito.`);
    } else {
      this.lotsList.update((list) => [...list, { lotNumber: lotNum, elaborationDate: elab, expirationDate: exp }]);
      this.toast.success(`Lote ${lotNum} registrado y agregado a la sesión.`);
    }

    // Persistir en Backend si la recepción ya existe
    const recId = this.selectedReception()?.id;
    if (recId && isUuid(recId)) {
      this.movementsApi.addReceptionLot(recId, {
        lotNumber: lotNum,
        elaborationDate: elab || undefined,
        expirationDate: exp || undefined,
      }).subscribe({
        next: (savedLot: any) => {
          if (savedLot && savedLot.id) {
            this.lotsList.update((list) =>
              list.map((l) => (l.lotNumber === lotNum ? { ...l, id: savedLot.id } : l))
            );
          }
        },
        error: (err: any) => {
          console.warn('Sync addReceptionLot:', err);
        },
      });
    }

    this.selectedScanningLot.set(lotNum);
    this.altaForm.patchValue({
      lotNumber: lotNum,
      expirationDate: exp,
      elaborationDate: elab,
    });

    this.closeAddLotModal();
  }

  removeLotFromSession(lotNum: string, event?: Event): void {
    if (event) event.stopPropagation();
    const inUse = this.palletStream().some((p) => p.lotNumber === lotNum);
    if (inUse) {
      this.toast.warning(`El lote ${lotNum} está asignado a una o más tarimas en la descarga.`);
      return;
    }
    const ok = window.confirm(`¿Desea eliminar el lote ${lotNum} de la sesión de recepción?`);
    if (!ok) return;

    const targetLot = this.lotsList().find((l) => l.lotNumber === lotNum);
    const recId = this.selectedReception()?.id;
    if (recId && isUuid(recId) && (targetLot as any)?.id) {
      this.movementsApi.deleteReceptionLot(recId, (targetLot as any).id).subscribe({
        error: (err: any) => console.warn('Sync deleteReceptionLot:', err),
      });
    }

    this.lotsList.update((list) => list.filter((l) => l.lotNumber !== lotNum));
    const remaining = this.lotsList();
    if (this.selectedScanningLot() === lotNum) {
      if (remaining.length > 0) {
        this.selectLotForScanning(remaining[0].lotNumber);
      } else {
        this.selectedScanningLot.set('');
        this.altaForm.patchValue({
          lotNumber: '',
          expirationDate: '',
          elaborationDate: '',
        });
      }
    }
    this.toast.info(`Lote ${lotNum} eliminado de la sesión.`);
  }

  selectLotForScanning(lotNum: string): void {
    this.selectedScanningLot.set(lotNum);
    const matched = this.lotsList().find((l) => l.lotNumber === lotNum);
    if (matched) {
      this.altaForm.patchValue({
        lotNumber: matched.lotNumber,
        expirationDate: matched.expirationDate || '',
        elaborationDate: matched.elaborationDate || '',
      });
    }
  }

  assignLotToPallet(palletId: string, lotNum: string): void {
    const matchedLot = this.lotsList().find((l) => l.lotNumber === lotNum);
    this.palletStream.update((list) =>
      list.map((p) => {
        if (p.id === palletId) {
          return {
            ...p,
            lotNumber: lotNum,
            expirationDate: matchedLot?.expirationDate || p.expirationDate || (this.altaForm.value.expirationDate ?? undefined),
          };
        }
        return p;
      })
    );
    this.toast.success(`Lote ${lotNum} asignado a la UA.`);
  }

  loadAuditLogs(folioOrId: string): void {
    const rec = this.selectedReception() || this.movementsService.findReceptionByFolio(folioOrId);
    const id = (rec?.id && isUuid(rec.id)) ? rec.id : (isUuid(folioOrId) ? folioOrId : null);
    const folio = rec?.folio || folioOrId;

    if (id) {
      this.movementsApi.getReceptionAudit(id).subscribe({
        next: (logs) => {
          if (logs && logs.length > 0) {
            const mapped: MovementAuditEntry[] = logs.map((l: any) => ({
              id: l.id || `aud-${Date.now()}-${Math.random()}`,
              action: l.action,
              actionLabel: l.actionLabel || this.getAuditSummary(l.action),
              username: l.username || 'Usuario',
              timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString('es-MX') : (l.timestamp || new Date().toLocaleString('es-MX')),
              details: (l.details || []).map((d: any) => ({
                fieldName: this.formatFieldLabel(d.fieldName),
                oldValue: this.formatFieldValue(d.fieldName, d.oldValue),
                newValue: this.formatFieldValue(d.fieldName, d.newValue),
              })),
              reason: l.reason || '',
              authorizedBy: l.authorizedBy || '',
            }));
            const sorted = this.sortAuditEntries(mapped);
            this.auditEntries.set(sorted);
            this.movementsService.setReceptionAuditLogs(folio, sorted);
            return;
          }
          const localLogs = this.movementsService.getReceptionAuditLogs(folio);
          this.auditEntries.set(this.sortAuditEntries(localLogs));
        },
        error: () => {
          const localLogs = this.movementsService.getReceptionAuditLogs(folio);
          this.auditEntries.set(this.sortAuditEntries(localLogs));
        },
      });
    } else {
      const logs = this.movementsService.getReceptionAuditLogs(folio);
      this.auditEntries.set(this.sortAuditEntries(logs || []));
    }
  }

  // Ordenamiento cronológico inverso: el evento más reciente arriba (top), el más antiguo abajo
  sortAuditEntries(entries: MovementAuditEntry[]): MovementAuditEntry[] {
    if (!entries || entries.length === 0) return [];
    return [...entries].sort((a, b) => {
      const parseDate = (ts?: string) => {
        if (!ts) return 0;
        const direct = new Date(ts).getTime();
        if (!isNaN(direct) && direct > 0) return direct;
        const match = ts.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);
          const hour = match[4] ? parseInt(match[4], 10) : 0;
          const min = match[5] ? parseInt(match[5], 10) : 0;
          const sec = match[6] ? parseInt(match[6], 10) : 0;
          return new Date(year, month, day, hour, min, sec).getTime();
        }
        return 0;
      };
      return parseDate(b.timestamp) - parseDate(a.timestamp);
    });
  }

  formatFieldLabel(field: string): string {
    return this.movementsService.formatFieldLabel(field);
  }

  formatFieldValue(field: string, value: any): string {
    return this.movementsService.formatFieldValue(field, value);
  }

  getAuditIcon(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'add_circle';
      case 'RECEPCION_COMPLETADA': return 'check_circle';
      case 'TARIMA_EDITADA':       return 'edit_note';
      case 'REMISION_MODIFICADA':  return 'edit_document';
      case 'RECEPCION_ACTUALIZADA':return 'edit';
      case 'RECEPCION_CANCELADA':  return 'cancel';
      default:                     return 'history';
    }
  }

  getAuditColorClass(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'carriers-tl-node--emerald';
      case 'RECEPCION_COMPLETADA': return 'carriers-tl-node--blue';
      case 'REMISION_MODIFICADA':  return 'carriers-tl-node--purple';
      case 'TARIMA_EDITADA':
      case 'RECEPCION_ACTUALIZADA':return 'carriers-tl-node--amber';
      case 'RECEPCION_CANCELADA':  return 'carriers-tl-node--red';
      default:                     return 'carriers-tl-node--indigo';
    }
  }

  getAuditSummary(action: string): string {
    switch (action) {
      case 'RECEPCION_CREADA':     return 'Pre-Recepción Registrada en Caseta';
      case 'RECEPCION_COMPLETADA': return 'Descarga Finalizada y Cierre F01';
      case 'REMISION_MODIFICADA':  return 'Modificación de No. de Remisión';
      case 'TARIMA_EDITADA':       return 'Ajuste de Tarima Individual';
      case 'RECEPCION_ACTUALIZADA':return 'Actualización de Parámetros de Recepción';
      case 'RECEPCION_CANCELADA':  return 'Cancelación Extraordinaria con Autorización';
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

  openNewReceptionModal(): void {
    this.resetCheckInForm();
    this.showCheckInModal.set(true);
  }

  closeNewReceptionModal(): void {
    this.showCheckInModal.set(false);
  }

  submitCheckIn(): void {
    // Asegurar que si los selects no fueron cambiados manualmente, tomen la opción visualmente visible
    if (!this.checkInForm.value.carrierLine && this.carrierLines().length > 0) {
      const c = this.carrierLines()[0];
      this.checkInForm.patchValue({ carrierLineCode: c.code, carrierLine: c.name });
    }
    if (!this.checkInForm.value.client && this.clients().length > 0) {
      const cl = this.clients()[0];
      this.checkInForm.patchValue({ clientCode: cl.code, client: cl.name });
    }
    if (!this.checkInForm.value.forkliftOperator && this.forkliftOperators().length > 0) {
      const op = this.forkliftOperators()[0];
      this.checkInForm.patchValue({ forkliftOperatorCode: op.code, forkliftOperator: op.name });
    }
    if (!this.checkInForm.value.rampNumber && this.ramps().length > 0) {
      const rm = this.ramps()[0];
      this.checkInForm.patchValue({ rampCode: rm.code, rampNumber: rm.rampNumber });
    }

    if (this.tempSealInput().trim()) {
      this.addSeal();
    }

    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      const missing: string[] = [];
      if (this.checkInForm.get('carrierLine')?.invalid) missing.push('Línea Transportadora');
      if (this.checkInForm.get('client')?.invalid) missing.push('Cliente');
      if (this.checkInForm.get('forkliftOperator')?.invalid) missing.push('Montacarguista');
      if (this.checkInForm.get('docNumber')?.invalid) missing.push('No. Documento');
      if (this.checkInForm.get('docDate')?.invalid) missing.push('Fecha del Documento');
      if (this.checkInForm.get('receptionTime')?.invalid) missing.push('Hora de Recepción');
      if (this.checkInForm.get('driverName')?.invalid) missing.push('Operador / Chofer');
      if (this.checkInForm.get('tractorPlates')?.invalid) missing.push('Placas Tracto');
      if (this.checkInForm.get('boxPlates')?.invalid) missing.push('Placas Caja');

      this.toast.warning(`Por favor completa los campos obligatorios: ${missing.join(', ')}.`);
      return;
    }

    const currentSeals = [...this.sealList()];
    const singleSeal = (this.checkInForm.get('sealNumber')?.value || '').trim();
    if (singleSeal && !currentSeals.includes(singleSeal.toUpperCase())) {
      currentSeals.push(singleSeal.toUpperCase());
      this.sealList.set(currentSeals);
    }

    if (currentSeals.length === 0) {
      this.toast.warning('El sello de seguridad es obligatorio. Debe agregar al menos un número de sello o cincho.');
      return;
    }

    this.isSubmitting.set(true);
    const formData = this.checkInForm.value as any;
    formData.sealNumbers = currentSeals;

    this.movementsService.createCheckInBackend(formData).subscribe({
      next: (newRec) => {
        this.isSubmitting.set(false);
        this.showCheckInModal.set(false);
        this.formMode.set('detail');
        this.selectReception(newRec);
        this.toast.success(`Pre-Recepción #${newRec.folio} registrada exitosamente en el servidor.`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errData = err?.error?.data;
        let details = '';
        if (Array.isArray(errData)) {
          details = errData.join(', ');
        } else if (typeof errData === 'string') {
          details = errData;
        }
        const errMsg = details
          ? `${err?.error?.message || 'Error'}: ${details}`
          : (err?.error?.message || err?.message || 'Error al registrar pre-recepción en el servidor');
        console.error('[RECEPCION_CHECKIN_ERROR]', err);
        this.toast.error(errMsg);
      },
    });
  }

  isSavingDraft = signal(false);
  isCompleting = signal(false);

  validateAltaForm(): boolean {
    const pId = this.altaForm.get('productId')?.value;
    if (pId && !this.altaForm.get('productName')?.value) {
      const prod = this.products().find((p) => p.id === pId);
      if (prod) {
        this.altaForm.patchValue({ productName: prod.name });
      }
    }

    if (this.altaForm.invalid) {
      this.altaForm.markAllAsTouched();
      const missing: string[] = [];
      if (this.altaForm.get('lotNumber')?.invalid) missing.push('Lote de Recepción');
      if (this.altaForm.get('expirationDate')?.invalid) missing.push('Fecha de Caducidad');
      if (this.altaForm.get('forkliftOperator')?.invalid) missing.push('Montacarguista');
      if (this.altaForm.get('rampNumber')?.invalid) missing.push('Rampa de Recepción');
      if (this.altaForm.get('productId')?.invalid) missing.push('Producto (SKU)');
      if (this.altaForm.get('piecesPerPallet')?.invalid) missing.push('Piezas por Tarima');
      if (this.altaForm.get('selectedPalletType')?.invalid) missing.push('Tipo de Tarima');
      if (this.altaForm.get('supplierName')?.invalid) missing.push('Proveedor');

      this.toast.warning(`Por favor completa los parámetros obligatorios de la descarga: ${missing.join(', ')}.`);
      return false;
    }

    // ⚠️ VALIDACIÓN RIGUROSA DE FECHAS (CRITERIO 2: ELABORACIÓN VS CADUCIDAD)
    const elab = this.altaForm.get('elaborationDate')?.value;
    const exp = this.altaForm.get('expirationDate')?.value;
    if (elab && exp) {
      if (exp < elab) {
        this.toast.error('🛑 Error de validación: La fecha de caducidad no puede ser anterior a la fecha de elaboración.');
        return false;
      }
      if (exp === elab) {
        const confirmed = window.confirm('⚠️ Advertencia: La fecha de caducidad es la misma que la de elaboración. ¿Está seguro que desea continuar?');
        if (!confirmed) {
          return false;
        }
      }
    }

    // 🔒 CANDADO DE CALIDAD DE VIDA ÚTIL (1 AÑO / 365 DÍAS)
    if (exp) {
      const expDate = new Date(exp + 'T00:00:00Z');
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 365) {
        this.toast.error(`🛑 Candado de Calidad: El lote cuenta con sólo ${diffDays} días restantes (< 1 año / 365 días). No se permite la descarga física.`);
        return false;
      }
    }

    return true;
  }

  // ── TRANSICIONES DEL CICLO DE VIDA DE RECEPCIÓN (5 FASES) ──

  isAssigning = signal(false);

  // Fase 1 -> 2: Asignar a Montacarguista y Bloquear Andén
  assignToForklift(): void {
    const current = this.selectedReception();
    if (!current) return;

    if (!this.validateAltaForm()) return;

    const formVals = this.altaForm.value;
    const receptionId = current.id || current.folio;
    const adminUser = this.authState.userFullName() || this.authState.currentUser()?.email || 'Administrador WMS';

    this.isAssigning.set(true);
    this.movementsService
      .assignReception(receptionId, formVals, this.products(), this.suppliers(), adminUser)
      .subscribe({
        next: (updated) => {
          this.isAssigning.set(false);
          this.selectedReception.set(updated);
          this.patchAltaFormWithReception(updated);
          this.loadAuditLogs(updated.folio);
          this.toast.success(`¡Folio #${updated.folio} asignado a Rampa ${updated.checkIn.rampNumber} y Montacarguista ${updated.checkIn.forkliftOperator}! Notificación enviada a la terminal.`);
        },
        error: (err) => {
          this.isAssigning.set(false);
          const msg = err?.error?.message || err?.message || 'Error al asignar la recepción';
          this.toast.error(msg);
        },
      });
  }

  // Fase 2 -> 3: Inicio de Descarga en Andén
  simulateStartDischarge(): void {
    const current = this.selectedReception();
    if (!current) return;
    const op = current.checkIn.forkliftOperator || 'Montacarguista';
    const recId = current.id || current.folio;
    this.movementsService.startDischarge(recId, op).subscribe({
      next: (updated) => {
        this.selectedReception.set(updated);
        this.loadAuditLogs(updated.folio);
        this.toast.success(`Descarga física iniciada por ${op} en Rampa ${updated.checkIn.rampNumber}. Guardada en base de datos.`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Error al iniciar la descarga';
        this.toast.error(msg);
      },
    });
  }

  // Fase 3 -> 4: Montacarguista Concluye Descarga Física (Envía a Mesa Administrativa)
  simulateFinishDischarge(): void {
    const current = this.selectedReception();
    if (!current) return;

    let stream = [...this.palletStream()];
    if (stream.length === 0) {
      const sku = this.altaForm.value.productId || current.productId || '8500297';
      const desc = this.altaForm.value.productName || current.productName || 'NESCAFE CLASICO 5KG MX';
      const sup = this.altaForm.value.supplierName || current.supplierName || 'OWENS AMERICA';
      const pType = (this.altaForm.value.selectedPalletType as PalletType) || 'TARIMA_CHEP_EXPORTACION';
      const pzas = Number(this.altaForm.value.piecesPerPallet) || 45;
      const baseNum = this.getNextConsecutivePalletNumber();

      stream = [
        {
          id: `pal-${Date.now()}-1`,
          palletNumber: baseNum,
          palletCode: 'SDASDS',
          productId: sku,
          description: desc,
          supplierName: sup,
          palletTypeId: pType,
          palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Tarima CHEP Exportación',
          pieces: pzas,
          status: 'SCANNED',
        },
        {
          id: `pal-${Date.now()}-2`,
          palletNumber: baseNum + 1,
          palletCode: 'QEQEQWQEQ',
          productId: sku,
          description: desc,
          supplierName: sup,
          palletTypeId: pType,
          palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Tarima CHEP Exportación',
          pieces: pzas,
          status: 'SCANNED',
        },
        {
          id: `pal-${Date.now()}-3`,
          palletNumber: baseNum + 2,
          palletCode: 'DSFDSFSFDSFSDFDSFDS',
          productId: sku,
          description: desc,
          supplierName: sup,
          palletTypeId: pType,
          palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Tarima CHEP Exportación',
          pieces: pzas,
          status: 'SCANNED',
        },
      ];
      this.palletStream.set(stream);
    }

    const op = current.checkIn.forkliftOperator || 'Montacarguista';
    const recId = current.id || current.folio;
    const formVals = this.altaForm.value;

    this.movementsService
      .finishDischarge(recId, stream, op, formVals, this.products(), this.suppliers())
      .subscribe({
        next: (updated) => {
          this.selectedReception.set(updated);
          this.palletStream.set(updated.pallets ? [...updated.pallets] : stream);
          this.loadAuditLogs(updated.folio);
          this.toast.success(`Descarga concluida por montacarguista. Avances guardados en la base de datos y enviados a mesa administrativa.`);
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'Error al concluir la descarga';
          this.toast.error(msg);
        },
      });
  }

  // Guardar Cambios Parciales / Avance de Descarga en el Backend (wms.warehouse_reception_pallets)
  saveDraftReception(): void {
    const current = this.selectedReception();
    if (!current) return;

    if (!this.validateAltaForm()) return;

    const formVals = this.altaForm.value;
    const currentStream = [...this.palletStream()];
    const receptionId = current.id || current.folio;

    this.isSavingDraft.set(true);
    this.movementsService
      .saveDraftReceptionBackend(
        receptionId,
        formVals,
        currentStream,
        this.products(),
        this.suppliers()
      )
      .subscribe({
        next: (updated) => {
          this.isSavingDraft.set(false);
          this.selectedReception.set(updated);
          this.palletStream.set(updated.pallets ? [...updated.pallets] : []);
          this.patchAltaFormWithReception(updated);
          this.toast.success(`Avance de Folio #${current.folio} y ${(updated.pallets || []).length} tarima(s) guardados correctamente en la base de datos.`);
        },
        error: (err) => {
          this.isSavingDraft.set(false);
          const msg = err?.error?.message || err?.message || 'Error al guardar avances en el servidor';
          this.toast.error(msg);
        },
      });
  }

  // ── EDICIÓN Y ELIMINACIÓN DE TARIMAS (ROL ADMINISTRADOR) ──
  openEditPalletModal(pallet: ReceptionPalletItem): void {
    const currentRec = this.selectedReception();
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
      lotNumber: pallet.lotNumber || this.selectedScanningLot() || this.altaForm.value.lotNumber || '',
      expirationDate: pallet.expirationDate || this.altaForm.value.expirationDate || '',
      docNumber: (pallet as any).docNumber || currentRec?.checkIn?.docNumber || this.checkInForm.value.docNumber || '',
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
            lotNumber: formVals.lotNumber ? formVals.lotNumber.toUpperCase() : item.lotNumber,
            expirationDate: (formVals.expirationDate || item.expirationDate) ?? undefined,
            docNumber: (formVals.docNumber || item.docNumber) ?? undefined,
          };
        }
        return item;
      })
    );

    this.closeEditPalletModal();
    this.toast.success(`Tarima #${formVals.palletNumber} actualizada.`);
  }

  removePalletFromStream(palletId: string): void {
    const list = this.palletStream().filter((p) => p.id !== palletId);
    this.palletStream.set(list);
    this.toast.info('Tarima removida de la descarga');
  }

  // ── SELECTOR VISUAL DE BAHÍAS (22 PALLETS) ──
  openBaySelector(): void {
    this.showBaySelectorModal.set(true);
  }

  onBaySelected(res: BaySelectionResult): void {
    this.altaForm.patchValue({
      storageLocation: res.locationCode,
      storageLocationId: res.locationId || res.locationCode,
    });
    this.showBaySelectorModal.set(false);
    if (res.isOverride) {
      this.toast.info(`Bahía ${res.locationCode} asignada con Anulación de Administrador.`);
    } else {
      this.toast.success(`Bahía ${res.locationCode} asignada correctamente.`);
    }
  }

  // ── RE-ETIQUETADO SELECTIVO DE UAS (SSCC GS1-128) ──
  openRelabelModal(): void {
    const rec = this.selectedReception();
    if (!rec || !rec.pallets || rec.pallets.length === 0) {
      this.toast.warning('No hay tarimas disponibles en la recepción para re-etiquetar.');
      return;
    }
    const allIds = new Set(rec.pallets.map((p) => p.id));
    this.selectedPalletIdsForRelabel.set(allIds);
    this.relabelReason.set('Re-etiquetado selectivo a estándar 4Guard SSCC GS1-128');
    this.showRelabelModal.set(true);
  }

  closeRelabelModal(): void {
    this.showRelabelModal.set(false);
  }

  togglePalletRelabelSelection(id: string): void {
    this.selectedPalletIdsForRelabel.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAllPalletsForRelabel(): void {
    const rec = this.selectedReception();
    if (!rec || !rec.pallets) return;
    const current = this.selectedPalletIdsForRelabel();
    if (current.size === rec.pallets.length) {
      this.selectedPalletIdsForRelabel.set(new Set());
    } else {
      this.selectedPalletIdsForRelabel.set(new Set(rec.pallets.map((p) => p.id)));
    }
  }

  executeRelabelUas(): void {
    const rec = this.selectedReception();
    if (!rec || !rec.id) return;
    const palletIds = Array.from(this.selectedPalletIdsForRelabel());
    if (palletIds.length === 0) {
      this.toast.warning('Selecciona al menos una tarima para re-etiquetar.');
      return;
    }

    const payload = {
      palletIds,
      reason: this.relabelReason().trim() || 'Re-etiquetado selectivo a estándar 4Guard SSCC GS1-128',
    };

    this.isRelabelling.set(true);
    this.movementsApi.relabelUas(rec.id, payload).subscribe({
      next: (mappings) => {
        this.isRelabelling.set(false);
        this.showRelabelModal.set(false);
        this.toast.success(`Se re-etiquetaron ${mappings?.length || palletIds.length} tarimas exitosamente con SSCC 4Guard.`);
        if (rec.id) {
          this.movementsApi.getReceptionById(rec.id).subscribe({
            next: (fullData) => {
              const mapped = this.movementsService.mapReceptionResponseToHeader(fullData);
              this.selectedReception.set(mapped);
              this.palletStream.set(mapped.pallets ? [...mapped.pallets] : []);
              this.patchAltaFormWithReception(mapped);
              this.movementsService.loadInitialBackendData();
            },
          });
        }
      },
      error: (err) => {
        this.isRelabelling.set(false);
        this.toast.error(err?.error?.message || 'Error al re-etiquetar las tarimas.');
      },
    });
  }

  // ── CANCELACIÓN EXTRAORDINARIA DE RECEPCIÓN ──
  openCancelModal(): void {
    this.cancelReason.set('');
    this.cancelAdminUser.set('');
    this.cancelAdminPassword.set('');
    this.cancelErrorMessage.set(null);
    this.showCancelPassword.set(false);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
  }

  confirmCancelReception(): void {
    this.cancelErrorMessage.set(null);
    const reason = this.cancelReason().trim();
    const user = this.cancelAdminUser().trim();
    const pass = this.cancelAdminPassword().trim();
    const current = this.selectedReception();

    if (!current) return;

    if (!reason) {
      this.cancelErrorMessage.set('El motivo de cancelación es obligatorio.');
      return;
    }
    if (!user || !pass) {
      this.cancelErrorMessage.set('Ingresa usuario y contraseña de Administrador.');
      return;
    }

    this.isCancelling.set(true);

    const adminLabel = user.toLowerCase().includes('admin')
      ? 'Gerencia Operativa (Administrador)'
      : `${user} (Admin Autorizado)`;

    if (current.id && pass) {
      this.movementsApi
        .cancelReception(current.id, {
          adminUsername: user,
          adminPassword: pass,
          reason,
        })
        .subscribe({
          next: () => {
            this.isCancelling.set(false);
            this.showCancelModal.set(false);

            const cancelled = this.movementsService.cancelReception(
              current.folio,
              reason,
              adminLabel
            );

            if (cancelled) {
              this.selectReception(cancelled);
              this.selectedPrintReception.set(cancelled);
              this.printType.set('CANCELLATION');
              this.toast.success(`Recepción #${cancelled.folio} cancelada exitosamente.`);
              this.showPrintModal.set(true);
            }
          },
          error: (err: any) => {
            this.isCancelling.set(false);
            const msg =
              err.error?.message ||
              err.message ||
              'Error al validar credenciales de Administrador o cancelar en el servidor.';
            this.cancelErrorMessage.set(msg);
          },
        });
    } else {
      const cancelled = this.movementsService.cancelReception(
        current.folio,
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
  }

  // ── CAMBIO DE NO. DE REMISIÓN / DOCUMENTO ──
  openChangeRemisionModal(): void {
    this.newRemisionInput.set('');
    this.changeRemisionReason.set('');
    this.changeRemisionAdminUser.set('');
    this.changeRemisionAdminPassword.set('');
    this.changeRemisionError.set(null);
    this.showChangeRemisionPassword.set(false);
    this.showChangeRemisionModal.set(true);
  }

  closeChangeRemisionModal(): void {
    this.showChangeRemisionModal.set(false);
  }

  confirmChangeRemision(): void {
    this.changeRemisionError.set(null);
    const newDoc = this.newRemisionInput().trim();
    const reason = this.changeRemisionReason().trim();
    const user = this.changeRemisionAdminUser().trim();
    const pass = this.changeRemisionAdminPassword().trim();
    const current = this.selectedReception();

    if (!current) return;

    if (!newDoc) {
      this.changeRemisionError.set('El nuevo número de remisión es obligatorio.');
      return;
    }

    if (newDoc.toUpperCase() === (current.checkIn?.docNumber || '').toUpperCase()) {
      this.changeRemisionError.set('El nuevo número de remisión debe ser diferente al actual.');
      return;
    }

    if (!reason) {
      this.changeRemisionError.set('La justificación o motivo del cambio es obligatoria.');
      return;
    }

    if (!user || !pass) {
      this.changeRemisionError.set('Ingresa usuario y contraseña de Supervisor o Administrador.');
      return;
    }

    this.isChangingRemision.set(true);

    const adminLabel = user.toLowerCase().includes('admin')
      ? 'Gerencia Operativa (Administrador)'
      : `${user} (Supervisor Autorizado)`;

    if (current.id && pass) {
      this.movementsApi
        .changeRemision(current.id, {
          newDocNumber: newDoc,
          reason,
          adminUsername: user,
          adminPassword: pass,
        })
        .subscribe({
          next: () => {
            this.isChangingRemision.set(false);
            this.showChangeRemisionModal.set(false);

            const updated = this.movementsService.changeRemision(
              current.folio,
              newDoc,
              reason,
              adminLabel
            );

            if (updated) {
              this.selectedReception.set(updated);
              this.loadAuditLogs(updated.folio);
            }
            this.toast.success(`No. de Remisión modificado exitosamente a: ${newDoc}`);
          },
          error: (err: any) => {
            this.isChangingRemision.set(false);
            const msg =
              err.error?.message ||
              err.message ||
              'Error al validar credenciales o procesar el cambio de remisión en el servidor.';
            this.changeRemisionError.set(msg);
          },
        });
    } else {
      const updated = this.movementsService.changeRemision(
        current.folio,
        newDoc,
        reason,
        adminLabel
      );
      this.isChangingRemision.set(false);
      this.showChangeRemisionModal.set(false);

      if (updated) {
        this.selectedReception.set(updated);
        this.loadAuditLogs(updated.folio);
        this.toast.success(`No. de Remisión modificado exitosamente a: ${newDoc}`);
      } else {
        this.toast.error('No se pudo procesar el cambio de remisión.');
      }
    }
  }

  initiateCompleteReception(): void {
    const rec = this.selectedReception();
    if (!rec) {
      this.toast.warning('No hay ninguna recepción seleccionada.');
      return;
    }
    if (!this.validateAltaForm()) return;

    if (this.palletStream().length === 0) {
      this.toast.warning('Debes ingresar al menos 1 Tarima en la lista de descarga antes de completar la recepción.');
      return;
    }

    const receptionId = rec.id || rec.folio;
    const currentStream = [...this.palletStream()];
    const formVals = this.altaForm.value;
    const leaderName = this.authState.userFullName() || this.authState.currentUser()?.fullName || 'Líder de Almacén';
    const leaderUser = this.authState.currentUser()?.email || this.authState.currentUser()?.fullName || 'enrique@4guard.com';

    this.isCompleting.set(true);
    this.movementsService
      .completeReceptionBackend(
        receptionId,
        formVals,
        currentStream,
        this.products(),
        this.suppliers(),
        leaderName,
        leaderUser,
        'admin123'
      )
      .subscribe({
        next: (updated) => {
          this.isCompleting.set(false);
          const finalRec = updated.folio ? updated : { ...rec, status: 'COMPLETED' as const, pallets: currentStream };
          this.selectedReception.set(finalRec);
          this.selectedPrintReception.set(finalRec);
          this.printType.set('RECEPTION');
          this.showPrintModal.set(true);
          this.movementsService.reloadReceptions();
          this.toast.success(`Recepción #${rec.folio} autorizada y cerrada exitosamente. Guardada en la base de datos.`);
        },
        error: (err) => {
          this.isCompleting.set(false);
          const msg = err?.error?.message || err?.message || 'Error al completar la recepción en el servidor';
          this.toast.error(msg);
        },
      });
  }

  onSkuInput(value: string): void {
    this.skuSearchQuery.set(value);
    this.isSkuDropdownOpen.set(true);

    const val = value.trim();
    if (!val) {
      this.altaForm.patchValue({
        productId: '',
        productName: '',
      });
      return;
    }

    const exact = this.products().find((p) => p.code === val || p.id === val);
    if (exact) {
      this.altaForm.patchValue({
        productId: exact.code || exact.id,
        productName: exact.name,
      });
    }
  }

  selectProductSku(prod: { id: string; code: string; name: string; defaultPieces: number }): void {
    this.altaForm.patchValue({
      productId: prod.code || prod.id,
      productName: prod.name,
    });
    this.skuSearchQuery.set(`${prod.code} - ${prod.name}`);
    this.isSkuDropdownOpen.set(false);
  }

  clearSkuSelection(): void {
    this.altaForm.patchValue({
      productId: '',
      productName: '',
    });
    this.skuSearchQuery.set('');
    this.isSkuDropdownOpen.set(false);
  }

  onProductSelect(productId: string): void {
    if (!productId) {
      this.clearSkuSelection();
      return;
    }
    const prod = this.products().find((p) => p.code === productId || p.id === productId);
    if (prod) {
      this.selectProductSku(prod);
    }
  }

  // ── MANEJADORES DE AUTOCOMPLETE MONTACARGUISTA ──
  onOperatorInput(value: string): void {
    this.operatorSearchQuery.set(value);
    this.isOperatorDropdownOpen.set(true);

    const val = value.trim();
    if (!val) {
      this.altaForm.patchValue({ forkliftOperator: '' });
      return;
    }

    const exact = this.forkliftOperators().find(
      (op) => op.name.toLowerCase() === val.toLowerCase() || op.code.toLowerCase() === val.toLowerCase()
    );
    if (exact) {
      this.altaForm.patchValue({ forkliftOperator: exact.name });
    }
  }

  selectForkliftOperator(op: { code: string; name: string }): void {
    this.altaForm.patchValue({ forkliftOperator: op.name });
    this.operatorSearchQuery.set(op.name);
    this.isOperatorDropdownOpen.set(false);
  }

  clearOperatorSelection(): void {
    this.altaForm.patchValue({ forkliftOperator: '' });
    this.operatorSearchQuery.set('');
    this.isOperatorDropdownOpen.set(false);
  }

  // ── MANEJADORES DE AUTOCOMPLETE PROVEEDOR ──
  onSupplierInput(value: string): void {
    this.supplierSearchQuery.set(value);
    this.isSupplierDropdownOpen.set(true);

    const val = value.trim();
    if (!val) {
      this.altaForm.patchValue({ supplierName: '' });
      return;
    }

    const exact = this.suppliers().find(
      (s) => s.name.toLowerCase() === val.toLowerCase() || s.code.toLowerCase() === val.toLowerCase()
    );
    if (exact) {
      this.altaForm.patchValue({ supplierName: exact.name });
    }
  }

  selectSupplier(sup: { code: string; name: string }): void {
    this.altaForm.patchValue({ supplierName: sup.name });
    this.supplierSearchQuery.set(sup.name);
    this.isSupplierDropdownOpen.set(false);
  }

  clearSupplierSelection(): void {
    this.altaForm.patchValue({ supplierName: '' });
    this.supplierSearchQuery.set('');
    this.isSupplierDropdownOpen.set(false);
  }

  // ── MANEJADORES DE AUTOCOMPLETE TIPO DE TARIMA ──
  onPalletTypeInput(value: string): void {
    this.palletTypeSearchQuery.set(value);
    this.isPalletTypeDropdownOpen.set(true);

    const val = value.trim();
    if (!val) {
      this.altaForm.patchValue({ selectedPalletType: '' as any });
      return;
    }

    const exact = this.palletTypes.find(
      (pt) => pt[0].toLowerCase() === val.toLowerCase() || pt[1].toLowerCase() === val.toLowerCase()
    );
    if (exact) {
      this.altaForm.patchValue({ selectedPalletType: exact[0] });
    }
  }

  selectPalletType(pt: [PalletType, string]): void {
    this.altaForm.patchValue({ selectedPalletType: pt[0] });
    this.palletTypeSearchQuery.set(pt[1]);
    this.isPalletTypeDropdownOpen.set(false);
  }

  clearPalletTypeSelection(): void {
    this.altaForm.patchValue({ selectedPalletType: '' as any });
    this.palletTypeSearchQuery.set('');
    this.isPalletTypeDropdownOpen.set(false);
  }

  // ── ESCÁNER Y CARGA RÁPIDA DE UAs CON CANDADO ANTI-DUPLICADOS & ORDEN DESCENDENTE ──
  onUaEnter(event?: Event): void {
    if (event) event.preventDefault();
    this.duplicateUaError.set(null);
    this.expirationWarningAlert.set(null);

    if (!this.altaForm.value.productId) {
      this.toast.warning('Por favor selecciona un Producto (SKU) antes de escanear tarimas.');
      return;
    }
    if (!this.altaForm.value.selectedPalletType) {
      this.toast.warning('Por favor selecciona un Tipo de Tarima antes de escanear tarimas.');
      return;
    }
    if (!this.altaForm.value.supplierName) {
      this.toast.warning('Por favor selecciona un Proveedor antes de escanear tarimas.');
      return;
    }
    if (!this.altaForm.value.piecesPerPallet || Number(this.altaForm.value.piecesPerPallet) <= 0) {
      this.toast.warning('Por favor especifica las Piezas por Tarima (> 0) antes de escanear tarimas.');
      return;
    }

    let code = this.uaCodeInput().trim();
    if (!code) {
      code = `03761304${Date.now().toString().slice(-10)}`;
    }

    const formattedCode = code.toUpperCase();

    // 🛑 CANDADO ESTRICTO DE ESCANEO DUPLICADO
    const isDuplicateInStream = this.palletStream().some((p) => p.palletCode === formattedCode);
    if (isDuplicateInStream) {
      const errorMsg = `🛑 BLOQUEO DE SEGURIDAD: La UA (${formattedCode}) ya fue escaneada previamente en esta recepción. Registro duplicado cancelado.`;
      this.duplicateUaError.set(errorMsg);
      this.toast.error(errorMsg);
      return;
    }

    // ⚠️ VALIDACIÓN PARAMÉTRICA DE CADUCIDAD & VIDA ÚTIL
    const expDateStr = this.altaForm.value.expirationDate || this.checkInForm.value.expirationDate;
    if (expDateStr) {
      const expDate = new Date(expDateStr).getTime();
      const now = new Date().getTime();
      const diffDays = Math.ceil((expDate - now) / (1000 * 3600 * 24));

      if (diffDays < 30) {
        const warnMsg = `⚠️ ALERTA DE VIDA ÚTIL CORTE: Este lote cuenta con solo ${diffDays} día(s) de vida útil remanente (<30 días). Requiere visto bueno del Líder.`;
        this.expirationWarningAlert.set(warnMsg);
        this.toast.warning(warnMsg);
      }
    }

    const pzas = Number(this.altaForm.value.piecesPerPallet) || 480;
    const pType = (this.altaForm.value.selectedPalletType as PalletType) || 'MADERA_ESTANDAR';
    const prodId = this.altaForm.value.productId || '';
    const prodName = this.altaForm.value.productName || this.altaForm.value.productId || '';
    const suppName = this.altaForm.value.supplierName || '';
    const nextNum = this.getNextConsecutivePalletNumber();

    const activeLotNum = this.selectedScanningLot() || this.altaForm.value.lotNumber || '';
    const matchedLot = this.lotsList().find((l) => l.lotNumber === activeLotNum);
    const activeExpDate = matchedLot?.expirationDate || this.altaForm.value.expirationDate || this.checkInForm.value.expirationDate || '';
    const currentDoc = this.checkInForm.value.docNumber || this.selectedReception()?.checkIn?.docNumber || '';

    const newItem: ReceptionPalletItem = {
      id: `ua-${Date.now()}-${nextNum}`,
      palletNumber: nextNum,
      palletCode: formattedCode,
      description: prodName,
      productId: prodId,
      supplierName: suppName,
      pieces: pzas,
      observations: this.uaObsInput().trim() || undefined,
      palletTypeId: pType,
      palletTypeLabel: PALLET_TYPE_LABELS[pType] || 'Madera Estándar',
      lotNumber: activeLotNum || undefined,
      expirationDate: activeExpDate || undefined,
      docNumber: currentDoc || undefined,
    };

    // ⬇️ VISUALIZACIÓN DESCENDENTE: Los más recientes se agregan AL PRINCIPIO del arreglo (unshift)
    this.palletStream.update((list) => [newItem, ...list]);
    this.uaCodeInput.set('');
    this.uaObsInput.set('');

    setTimeout(() => {
      if (this.uaInput?.nativeElement) {
        this.uaInput.nativeElement.focus();
      }
    }, 10);
  }

  // Obtiene el siguiente consecutivo de tarima global a nivel de almacén/sistema
  getNextConsecutivePalletNumber(): number {
    let maxInStream = 0;
    for (const p of this.palletStream()) {
      if (p.palletNumber && Number(p.palletNumber) > maxInStream) {
        maxInStream = Number(p.palletNumber);
      }
    }
    const maxInAll = this.movementsService.getGlobalMaxPalletNumber();
    return Math.max(maxInStream, maxInAll) + 1;
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
    const s = this.tempSealInput().trim().toUpperCase();
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
      selectedPalletType: rec.selectedPalletType || (formVals.selectedPalletType as PalletType) || 'TARIMA_CHEP_NACIONAL',
      pallets: palletsToPrint,
      observations: rec.observations || formVals.observations || undefined,
    };

    this.selectedPrintReception.set(recToPrint);
    this.printType.set(rec.status === 'CANCELLED' ? 'CANCELLATION' : 'RECEPTION');
    this.showPrintModal.set(true);
  }

  isGeneratingPdf = signal(false);

  async downloadDirectPdf(): Promise<void> {
    const isReception = this.printType() === 'RECEPTION';
    const selector = isReception ? 'fg-print-reception-layout' : 'fg-print-cancellation-layout';
    const recNumber = this.selectedPrintReception()?.folio || this.selectedPrintReception()?.checkIn?.docNumber || '26510';
    const pdfFilename = isReception ? `Recepcion_${recNumber}` : `Cancelacion_${recNumber}`;
    this.isGeneratingPdf.set(true);
    try {
      await this.printService.downloadPdf(selector, pdfFilename);
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  triggerBrowserPrint(): void {
    const isReception = this.printType() === 'RECEPTION';
    const selector = isReception ? 'fg-print-reception-layout' : 'fg-print-cancellation-layout';
    const recNumber = this.selectedPrintReception()?.folio || this.selectedPrintReception()?.checkIn?.docNumber || '26510';
    const printDocTitle = isReception ? `Recepción #${recNumber}` : `Cancelación #${recNumber}`;
    this.printService.printElement(selector, printDocTitle);
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintReception.set(null);
  }
}
