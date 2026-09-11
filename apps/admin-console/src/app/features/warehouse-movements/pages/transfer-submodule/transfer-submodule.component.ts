import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { PrintService } from '../../../../core/services/print.service';
import { AuthState } from '../../../../core/auth/auth.state';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import { WarehouseMovementsApiService } from '../../services/warehouse-movements-api.service';
import { ForkliftOperatorAdminService } from '../../../admin/services/forklift-operator.service';
import {
  LocationStockInfo,
  WarehouseTransfer,
  TransferReasonItem,
  TRANSFER_REASONS,
  MovementAuditEntry,
  ReceptionPalletItem,
} from '../../models/warehouse-movements.models';
import { PrintTransferLayoutComponent } from '../../components/print-layouts/print-transfer-layout.component';

export interface ForkliftOperatorOption {
  id: string;
  name: string;
  badge: string;
  jobTitle: string;
  shift: string;
  status: 'ACTIVO' | 'INACTIVO';
}

@Component({
  selector: 'fg-transfer-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, PrintTransferLayoutComponent],
  templateUrl: './transfer-submodule.component.html',
  styleUrl: './transfer-submodule.component.css',
})
export class TransferSubmoduleComponent implements OnInit {
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly movementsApi = inject(WarehouseMovementsApiService);
  private readonly forkliftAdminService = inject(ForkliftOperatorAdminService);
  private readonly toast = inject(ToastService);
  private readonly printService = inject(PrintService);
  public readonly authState = inject(AuthState);

  // -- ESTADO DEL WORKBENCH UNIFICADO (MASTER-DETAIL) --
  formMode = signal<'idle' | 'create' | 'detail'>('idle');
  selectedTransfer = signal<WarehouseTransfer | null>(null);
  searchQuery = signal<string>('');
  statusFilter = signal<string>('ALL');
  auditEntries = signal<MovementAuditEntry[]>([]);
  isLoadingAudit = signal(false);

  // Modal Cancelacion con Autorizacion de Administrador
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
    if (!name) return 'TR';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // -- CATALOGO DE MONTACARGUISTAS (desde BE via ForkliftOperatorAdminService) --
  isLoadingOperators = signal(false);

  // Formateador para limpiar CDMX de los turnos
  formatShift(shift?: string): string {
    if (!shift) return 'No asignado';
    return shift.replace(/\bcdmx\b/gi, '').replace(/\s+/g, ' ').trim() || 'Turno Regular';
  }

  // Formateador para limpiar CDMX de los almacenes
  formatWarehouse(name?: string): string {
    if (!name) return 'CEDIS Central';
    return name.replace(/\bcdmx\b/gi, '').replace(/\s+/g, ' ').trim() || 'CEDIS Central';
  }

  // Computed que toma operadores activos del servicio admin (cargados desde BE)
  forkliftOperators = computed<ForkliftOperatorOption[]>(() => {
    const adminOps = this.forkliftAdminService.activeOperators();
    return adminOps.map((op) => ({
      id: op.id,
      name: op.fullName,
      badge: op.licenseNumberDc3 || op.code,
      jobTitle: op.jobTitle || 'Almacenista Montacargista',
      shift: this.formatShift(op.shift),
      status: op.status,
    }));
  });

  // Catalogo de Motivos de Reubicacion
  transferReasons: TransferReasonItem[] = TRANSFER_REASONS;

  // ── 1. ASIGNACIÓN DE MONTACARGUISTA ──
  selectedOperatorId = signal<string>('');
  operatorSearchQuery = signal<string>('');
  isOperatorDropdownOpen = signal<boolean>(false);

  // Disponibilidad de operador (Verifica si tiene recepciones o traspasos/despachos activos en curso)
  getOperatorAvailability(op: ForkliftOperatorOption): {
    status: 'DISPONIBLE' | 'EN_RECEPCION' | 'EN_DESPACHO' | 'INACTIVO';
    label: string;
    dotClass: string;
    badgeClass: string;
  } {
    if (op.status === 'INACTIVO') {
      return {
        status: 'INACTIVO',
        label: 'Inactivo en Sistema',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300',
      };
    }

    // Verificar si el montacarguista está en recepciones activas (status: REGISTERED)
    const activeReception = this.movementsService.receptions().find(
      (r) =>
        r.status === 'REGISTERED' &&
        (r.checkIn?.forkliftOperator?.toLowerCase().includes(op.name.toLowerCase()) ||
          r.checkIn?.forkliftOperatorCode === op.id ||
          r.checkIn?.forkliftOperatorCode === op.badge)
    );
    if (activeReception) {
      return {
        status: 'EN_RECEPCION',
        label: `En Recepción (#${activeReception.folio})`,
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
      };
    }

    // Verificar si está en despacho / salida activa
    const activeOutbound = this.movementsService.outbounds().find(
      (o) =>
        (o.status as string) !== 'COMPLETED' &&
        (o.status as string) !== 'CANCELLED' &&
        (o.driverName?.toLowerCase().includes(op.name.toLowerCase()) ||
          o.dispatchedBy?.toLowerCase().includes(op.name.toLowerCase()))
    );
    if (activeOutbound) {
      return {
        status: 'EN_DESPACHO',
        label: `En Despacho (#${activeOutbound.folio})`,
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
      };
    }

    return {
      status: 'DISPONIBLE',
      label: 'Disponible para maniobra',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300',
    };
  }

  filteredForkliftOperators = computed(() => {
    const ops = this.forkliftOperators();
    const q = this.operatorSearchQuery().toLowerCase().trim();
    if (!q) return ops;
    return ops.filter((op) => {
      const matchName = op.name.toLowerCase().includes(q);
      const matchBadge = op.badge.toLowerCase().includes(q);
      const matchJob = op.jobTitle.toLowerCase().includes(q);
      const matchShift = op.shift.toLowerCase().includes(q);
      const avail = this.getOperatorAvailability(op);
      const matchStatus = avail.label.toLowerCase().includes(q) || avail.status.toLowerCase().includes(q);
      return matchName || matchBadge || matchJob || matchShift || matchStatus;
    });
  });

  selectedOperator = computed<ForkliftOperatorOption | undefined>(() =>
    this.forkliftOperators().find((op) => op.id === this.selectedOperatorId())
  );

  onOperatorSelect(id: string): void {
    this.selectedOperatorId.set(id);
    const op = this.forkliftOperators().find((o) => o.id === id);
    if (op) {
      this.operatorSearchQuery.set(op.name);
    } else {
      this.operatorSearchQuery.set('');
    }
  }

  onOperatorInput(val: string): void {
    this.operatorSearchQuery.set(val);
    this.isOperatorDropdownOpen.set(true);
    const exact = this.forkliftOperators().find(
      (op) => op.name.toLowerCase() === val.toLowerCase().trim() || op.badge.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectedOperatorId.set(exact.id);
    }
  }

  selectOperator(op: ForkliftOperatorOption): void {
    this.selectedOperatorId.set(op.id);
    this.operatorSearchQuery.set(op.name);
    this.isOperatorDropdownOpen.set(false);
  }

  clearOperatorSelection(): void {
    this.selectedOperatorId.set('');
    this.operatorSearchQuery.set('');
    this.isOperatorDropdownOpen.set(false);
  }

  // ── 2. BUSCADOR & AUTOCOMPLETE DE BAHÍA ORIGEN (CON STOCK Y REMISIÓN) ──
  originSearchQuery = signal<string>('');
  isOriginDropdownOpen = signal<boolean>(false);
  selectedOriginCode = signal('');
  selectedPalletIds = signal<string[]>([]);
  quantityToMoveInput = signal<number>(1);

  // Bahias Ocupadas y Disponibles
  occupiedLocations = this.movementsService.occupiedLocations;
  availableLocations = this.movementsService.availableLocations;

  // Formato legible para código de bahía (elimina "N/A" mostrando nombre de bahía/rack real)
  getLocationDisplayCode(locOrCode: LocationStockInfo | string | undefined | null): string {
    if (!locOrCode) return '--';
    if (typeof locOrCode === 'string') {
      const trimmed = locOrCode.trim();
      if (!trimmed || trimmed.toUpperCase() === 'N/A') {
        const loc = this.movementsService.getLocationInfo(trimmed);
        if (loc && loc.zone && loc.zone !== 'General') return `Bahía ${loc.zone}`;
        if (loc && loc.rack && loc.level) return `${loc.rack} - ${loc.level}`;
        return 'Bahía de Entrada';
      }
      return trimmed;
    }
    const code = (locOrCode.locationCode || '').trim();
    if (!code || code.toUpperCase() === 'N/A') {
      if (locOrCode.rack && locOrCode.level) return `${locOrCode.rack} - ${locOrCode.level}`;
      if (locOrCode.zone && locOrCode.zone !== 'General') return `Bahía ${locOrCode.zone}`;
      return 'Bahía de Entrada';
    }
    return code;
  }

  // Obtiene los números de remisión actualizados asociados a las tarimas de una bahía
  getLocationRemisiones(locationCode: string): string[] {
    const cleanCode = (locationCode || '').toUpperCase().trim();
    if (!cleanCode) return [];

    const remisiones = new Set<string>();
    const receptions = this.movementsService.receptions();
    const locInfo = this.movementsService.getLocationInfo(cleanCode);

    // 1. Prioridad: Buscar recepciones activas que coincidan con los pallets o productos en esta bahía
    if (locInfo && locInfo.pallets && locInfo.pallets.length > 0) {
      locInfo.pallets.forEach((p) => {
        // Coincidencia por código de tarima / SSCC
        const matchByPallet = receptions.find(
          (r) =>
            r.status !== 'CANCELLED' &&
            r.pallets?.some((rp) => rp.palletCode === p.palletCode || rp.id === p.id)
        );
        if (matchByPallet && matchByPallet.checkIn?.docNumber) {
          remisiones.add(matchByPallet.checkIn.docNumber);
          return;
        }

        // Coincidencia por SKU o Descripción de producto
        const matchByProduct = receptions.find(
          (r) =>
            r.status !== 'CANCELLED' &&
            ((r.skuCode && p.productId && r.skuCode.toUpperCase().trim() === p.productId.toUpperCase().trim()) ||
              (r.productId && p.productId && r.productId.toUpperCase().trim() === p.productId.toUpperCase().trim()) ||
              (r.productName && p.description && r.productName.toUpperCase().trim() === p.description.toUpperCase().trim()))
        );
        if (matchByProduct && matchByProduct.checkIn?.docNumber) {
          remisiones.add(matchByProduct.checkIn.docNumber);
        }
      });
    }

    // 2. Buscar en recepciones por storageLocation (ignorar canceladas)
    if (remisiones.size === 0) {
      receptions.forEach((r) => {
        if (
          r.status !== 'CANCELLED' &&
          r.storageLocation &&
          r.storageLocation.toUpperCase().trim() === cleanCode &&
          r.checkIn?.docNumber
        ) {
          remisiones.add(r.checkIn.docNumber);
        }
      });
    }

    // 3. Fallback secundario en inventoryBatches
    if (remisiones.size === 0) {
      const batches = this.movementsService.inventoryBatches();
      batches.forEach((b) => {
        const matchBatchLoc = b.locationCode && b.locationCode.toUpperCase().trim() === cleanCode;
        const matchPalletLoc = b.pallets?.some(
          (p: any) => p.locationCode && p.locationCode.toUpperCase().trim() === cleanCode
        );
        if (matchBatchLoc || matchPalletLoc) {
          // Verificar si el batch tiene una recepción actualizada
          const recForBatch = receptions.find(
            (r) =>
              r.status !== 'CANCELLED' &&
              ((b.productId && (r.skuCode === b.productId || r.productId === b.productId)) ||
                (b.productName && r.productName && r.productName.toUpperCase().trim() === b.productName.toUpperCase().trim()))
          );
          if (recForBatch && recForBatch.checkIn?.docNumber) {
            remisiones.add(recForBatch.checkIn.docNumber);
          } else if (b.remisionNo && b.remisionNo !== 'N/A') {
            remisiones.add(b.remisionNo);
          }
        }
      });
    }

    return Array.from(remisiones);
  }

  filteredOccupiedLocations = computed(() => {
    const list = this.occupiedLocations();
    const q = this.originSearchQuery().toLowerCase().trim();
    if (!q) return list;
    return list.filter((loc) => {
      const displayCode = this.getLocationDisplayCode(loc).toLowerCase();
      const matchCode = loc.locationCode.toLowerCase().includes(q) || displayCode.includes(q);
      const matchZone = loc.zone ? loc.zone.toLowerCase().includes(q) : false;
      const matchRack = loc.rack ? loc.rack.toLowerCase().includes(q) : false;
      const remisiones = this.getLocationRemisiones(loc.locationCode);
      const matchRemision = remisiones.some((rem) => rem.toLowerCase().includes(q));
      const matchPallet = loc.pallets?.some(
        (p) =>
          p.palletCode.toLowerCase().includes(q) ||
          p.productId.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q))
      ) ?? false;
      return matchCode || matchZone || matchRack || matchRemision || matchPallet;
    });
  });

  originStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedOriginCode())
  );

  onOriginInput(val: string): void {
    this.originSearchQuery.set(val);
    this.isOriginDropdownOpen.set(true);
    const exact = this.occupiedLocations().find(
      (l) =>
        l.locationCode.toLowerCase() === val.toLowerCase().trim() ||
        this.getLocationDisplayCode(l).toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectOriginLocation(exact.locationCode);
    }
  }

  selectOriginLocation(code: string): void {
    this.selectedOriginCode.set(code);
    const loc = this.movementsService.getLocationInfo(code);
    this.originSearchQuery.set(this.getLocationDisplayCode(loc || code));
    this.isOriginDropdownOpen.set(false);
    const stock = this.movementsService.getLocationInfo(code);
    this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
    this.quantityToMoveInput.set(stock.pallets.length > 0 ? stock.pallets.length : 1);
  }

  clearOriginSelection(): void {
    this.selectedOriginCode.set('');
    this.originSearchQuery.set('');
    this.selectedPalletIds.set([]);
    this.quantityToMoveInput.set(1);
    this.isOriginDropdownOpen.set(false);
  }

  // Selección rápida de cantidad numérica de tarimas (UAs)
  setQuantityToMove(count: number): void {
    const stock = this.originStock();
    const max = stock.pallets.length;
    const safeCount = Math.max(1, Math.min(count, max));
    this.quantityToMoveInput.set(safeCount);
    const selected = stock.pallets.slice(0, safeCount).map((p) => p.id);
    this.selectedPalletIds.set(selected);
  }

  onQuantityInputChange(val: any): void {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      this.setQuantityToMove(num);
    }
  }

  // ── 3. BUSCADOR & AUTOCOMPLETE DE BAHÍA DESTINO (MÁQUINA DE ESTADOS) ──
  destSearchQuery = signal<string>('');
  isDestDropdownOpen = signal<boolean>(false);
  selectedDestinationCode = signal('');

  selectDestinationLocation(code: string): void {
    this.selectedDestinationCode.set(code);
    const loc = this.movementsService.getLocationInfo(code);
    this.destSearchQuery.set(this.getLocationDisplayCode(loc || code));
    this.isDestDropdownOpen.set(false);
  }

  allWarehouseLocations = computed(() => Object.values(this.movementsService.locations()));

  // Evaluación de estado según la máquina de estados WMS
  getLocationState(loc: LocationStockInfo): {
    state: 'DISPONIBLE' | 'CON_STOCK' | 'BLOQUEADA';
    label: string;
    badgeClass: string;
    dotClass: string;
    description: string;
    isSelectableForDest: boolean;
  } {
    if (loc.isBlocked) {
      return {
        state: 'BLOQUEADA',
        label: 'Bloqueada',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300',
        dotClass: 'bg-rose-500',
        description: loc.blockReason || 'Bloqueada por Calidad / Mantenimiento',
        isSelectableForDest: false,
      };
    }
    if (loc.totalPallets > 0) {
      return {
        state: 'CON_STOCK',
        label: `Con Stock (${loc.totalPallets} UAs)`,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300',
        dotClass: 'bg-amber-500',
        description: `Ocupada (${loc.totalPallets} de ${loc.capacity} UAs)`,
        isSelectableForDest: false,
      };
    }
    return {
      state: 'DISPONIBLE',
      label: 'Disponible (En Ceros)',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300',
      dotClass: 'bg-emerald-500',
      description: '0 UAs · Lista para Putaway / Reubicación',
      isSelectableForDest: true,
    };
  }

  filteredDestLocations = computed(() => {
    const list = this.allWarehouseLocations();
    const q = this.destSearchQuery().toLowerCase().trim();
    if (!q) return list;
    return list.filter((loc) => {
      const matchCode = loc.locationCode.toLowerCase().includes(q);
      const matchZone = loc.zone ? loc.zone.toLowerCase().includes(q) : false;
      const matchWarehouse = loc.warehouseName ? loc.warehouseName.toLowerCase().includes(q) : false;
      const st = this.getLocationState(loc);
      const matchState = st.label.toLowerCase().includes(q) || st.state.toLowerCase().includes(q);
      return matchCode || matchZone || matchWarehouse || matchState;
    });
  });

  destStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedDestinationCode())
  );

  onDestInput(val: string): void {
    this.destSearchQuery.set(val);
    this.isDestDropdownOpen.set(true);
    const exact = this.allWarehouseLocations().find(
      (l) => l.locationCode.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectDestinationLocation(exact.locationCode);
    }
  }


  clearDestSelection(): void {
    this.selectedDestinationCode.set('');
    this.destSearchQuery.set('');
    this.isDestDropdownOpen.set(false);
  }

  // -- PASO 4: MOTIVO Y OBSERVACIONES --
  selectedReasonId = signal('');
  observations = signal('');

  selectedReason = computed(() =>
    this.transferReasons.find((r) => r.id === this.selectedReasonId()) || {
      id: '',
      label: '-- Selecciona Motivo de Reubicación --',
      description: 'Selecciona el motivo que justifica el movimiento interno de inventario.',
    }
  );

  // -- TOTALIZADORES REACTIVOS DE LA SELECCION --
  selectedPalletsList = computed(() => {
    const stock = this.originStock();
    const ids = this.selectedPalletIds();
    return stock.pallets.filter((p) => ids.includes(p.id));
  });

  selectedTotalPallets = computed(() => this.selectedPalletsList().length);
  selectedTotalPieces = computed(() =>
    this.selectedPalletsList().reduce((acc, p) => acc + p.pieces, 0)
  );
  selectedDistinctSkus = computed(
    () => new Set(this.selectedPalletsList().map((p) => p.productId)).size
  );

  // -- KPIS SUPERIORES (ESTILO HOMOLOGADO CON RECEPCION) --
  kpiTotalTransfers = computed(() => this.movementsService.transfers().length);
  kpiOccupiedLocations = computed(() => this.occupiedLocations().length);
  kpiAvailableLocations = computed(() => this.availableLocations().length);
  kpiTotalPalletsMoved = computed(() =>
    this.movementsService.transfers().reduce((acc, t) => acc + t.totalPallets, 0)
  );

  // Validaciones
  isDestinationEmpty = computed(() => {
    const dest = this.destStock();
    return !!this.selectedDestinationCode() && dest.totalPallets === 0 && !dest.isBlocked;
  });

  // Checklist reactivo (Revise que la operación sea correcta)
  isOperatorStepValid = computed(() => !!this.selectedOperator());
  isOriginStepValid = computed(() => !!this.selectedOriginCode() && this.originStock().pallets.length > 0);
  isQuantityStepValid = computed(() => this.selectedPalletIds().length > 0);
  isDestStepValid = computed(() => !!this.selectedDestinationCode() && this.isDestinationEmpty() && this.selectedOriginCode() !== this.selectedDestinationCode());
  isReasonStepValid = computed(() => !!this.selectedReasonId());

  canProceedToConfirm = computed(() => {
    return (
      this.isOperatorStepValid() &&
      this.isOriginStepValid() &&
      this.isQuantityStepValid() &&
      this.isDestStepValid() &&
      this.isReasonStepValid()
    );
  });

  // Lista Filtrada del Directorio de Traspasos
  transfersList = this.movementsService.transfers;
  filteredTransfers = computed(() => {
    const list = this.transfersList();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();

    return list.filter((t) => {
      const matchStatus = status === 'ALL' || t.status === status;
      if (!matchStatus) return false;

      if (!query) return true;
      const matchFolio = t.folio.toLowerCase().includes(query);
      const matchOrigin = t.originLocation.toLowerCase().includes(query);
      const matchDest = t.destinationLocation.toLowerCase().includes(query);
      const matchOperator = t.forkliftOperator.toLowerCase().includes(query);
      const matchReason = t.reasonLabel ? t.reasonLabel.toLowerCase().includes(query) : false;
      return matchFolio || matchOrigin || matchDest || matchOperator || matchReason;
    });
  });

  // Modales y Diálogos
  showConfirmModal = signal(false);
  isExecuting = signal(false);

  showPrintPromptModal = signal(false);
  lastCompletedTransfer = signal<WarehouseTransfer | null>(null);

  showPrintModal = signal(false);
  selectedPrintTransfer = signal<WarehouseTransfer | null>(null);

  ngOnInit(): void {
    // Cargar catalogo de montacarguistas desde el BE
    this._loadForkliftOperators();

    this.movementsService.loadInitialBackendData();
    const savedFolio = localStorage.getItem('4g_active_transfer_folio');
    if (savedFolio) {
      const list = this.movementsService.transfers();
      const found = list.find((t) => t.folio === savedFolio);
      if (found) {
        this.selectTransferItem(found);
        return;
      }
    }
    // Estado inicial: Sin seleccion (Empty State)
    this.formMode.set('idle');
  }

  private _loadForkliftOperators(): void {
    this.isLoadingOperators.set(true);
    this.forkliftAdminService.loadOperators(undefined, { status: 'ACTIVO' }).subscribe({
      next: () => {
        this.isLoadingOperators.set(false);
        // Mantener deseleccionado inicialmente para mostrar el placeholder de selección
      },
      error: () => {
        this.isLoadingOperators.set(false);
        this.toast.error('No se pudo cargar el catálogo de montacarguistas.');
      },
    });
  }

  // Iniciar Nuevo Traspaso (Modo Captura)
  startNewTransfer(): void {
    this.formMode.set('create');
    this.selectedTransfer.set(null);
    localStorage.removeItem('4g_active_transfer_folio');

    this.selectedOriginCode.set('');
    this.originSearchQuery.set('');

    this.selectedDestinationCode.set('');
    this.destSearchQuery.set('');

    this.selectedOperatorId.set('');
    this.operatorSearchQuery.set('');

    this.selectedReasonId.set('');
    this.observations.set('');
    this.selectedPalletIds.set([]);
  }

  // Volver a estado inicial (Sin seleccion)
  resetToIdle(): void {
    this.formMode.set('idle');
    this.selectedTransfer.set(null);
    localStorage.removeItem('4g_active_transfer_folio');
  }

  // Seleccionar un Traspaso del Directorio (Modo Detalle/Solo Lectura)
  selectTransferItem(transfer: WarehouseTransfer): void {
    this.formMode.set('detail');
    this.selectedTransfer.set(transfer);
    localStorage.setItem('4g_active_transfer_folio', transfer.folio);
    this.loadAuditLogs(transfer);

    if (transfer.id) {
      this.movementsApi.getTransferById(transfer.id).subscribe({
        next: (fullTransfer: any) => {
          if (fullTransfer) {
            const mappedPallets: ReceptionPalletItem[] = (fullTransfer.items || []).map((it: any, idx: number) => ({
              id: it.itemId || it.id || `plt-${idx}`,
              palletNumber: idx + 1,
              palletCode: it.palletCode || `UA-${idx + 1}`,
              description: it.skuDescription || 'ALIMENTO BALANCEADO PURINA',
              productId: it.skuCode || '12572733',
              supplierName: 'PURINA PETCARE MEXICO',
              pieces: it.pieces != null ? Number(it.pieces) : 45,
              palletTypeId: 'STD',
              palletTypeLabel: 'Estándar (Tarima Completa)',
            }));

            const merged: WarehouseTransfer = {
              ...transfer,
              id: fullTransfer.id || transfer.id,
              folio: fullTransfer.folio || transfer.folio,
              status: fullTransfer.status || transfer.status,
              forkliftOperator: fullTransfer.forkliftOperatorName || transfer.forkliftOperator,
              forkliftOperatorId: fullTransfer.forkliftOperatorId || transfer.forkliftOperatorId,
              originLocation: fullTransfer.originLocationCode || transfer.originLocation,
              destinationLocation: fullTransfer.destinationLocationCode || transfer.destinationLocation,
              reasonId: fullTransfer.reasonCode || transfer.reasonId,
              reasonLabel: fullTransfer.reasonLabel || transfer.reasonLabel,
              observations: fullTransfer.observations || transfer.observations,
              totalPallets: fullTransfer.totalPallets || (mappedPallets.length > 0 ? mappedPallets.length : transfer.totalPallets),
              totalPieces: fullTransfer.totalPieces != null ? Number(fullTransfer.totalPieces) : transfer.totalPieces,
              distinctSkus: fullTransfer.distinctSkus || transfer.distinctSkus,
              transferredAt: fullTransfer.createdAt ? new Date(fullTransfer.createdAt).toLocaleString('es-MX') : transfer.transferredAt,
              transferredBy: fullTransfer.createdBy || transfer.transferredBy || this.authState.userFullName() || this.authState.currentUser()?.fullName || this.authState.currentUser()?.username || 'Usuario en Sesión',
              cancellationReason: fullTransfer.cancellationReason || transfer.cancellationReason,
              cancelledAt: fullTransfer.cancelledAt ? new Date(fullTransfer.cancelledAt).toLocaleString('es-MX') : transfer.cancelledAt,
              cancelledBy: fullTransfer.cancelledBy || transfer.cancelledBy,
              pallets: mappedPallets.length > 0 ? mappedPallets : (transfer.pallets && transfer.pallets.length > 0 ? transfer.pallets : []),
            };

            this.selectedTransfer.set(merged);
          }
        },
        error: () => {},
      });
    }
  }

  // Carga logs de auditoria desde el Backend usando el ID del traspaso
  loadAuditLogs(transfer: WarehouseTransfer): void {
    if (!transfer.id) {
      const logs = this.movementsService.getTransferAuditLogs(transfer.folio);
      this.auditEntries.set(this.sortAuditEntries(logs || []));
      return;
    }

    this.isLoadingAudit.set(true);
    this.movementsApi.getTransferAudit(transfer.id).subscribe({
      next: (logs: any[]) => {
        this.isLoadingAudit.set(false);
        if (logs && logs.length > 0) {
          const mapped: MovementAuditEntry[] = logs.map((log: any) => ({
            id: log.id || log.auditId || `aud-${Date.now()}-${Math.random()}`,
            action: log.action || log.eventType || 'TRASPASO_REGISTRADO',
            actionLabel: log.actionLabel || log.description || this.getAuditSummary(log.action),
            username: log.username || log.performedBy || log.createdBy || 'Sistema',
            timestamp: log.timestamp
              ? new Date(log.timestamp).toLocaleString('es-MX')
              : (log.createdAt ? new Date(log.createdAt).toLocaleString('es-MX') : ''),
            details: (log.details || log.changes || []).map((d: any) => ({
              fieldName: this.formatFieldLabel(d.fieldName),
              oldValue: this.formatFieldValue(d.fieldName, d.oldValue),
              newValue: this.formatFieldValue(d.fieldName, d.newValue),
            })),
            reason: log.reason || log.cancellationReason,
            authorizedBy: log.authorizedBy,
          }));
          const sorted = this.sortAuditEntries(mapped);
          this.auditEntries.set(sorted);
          this.movementsService.setTransferAuditLogs(transfer.folio, sorted);
        } else {
          const localLogs = this.movementsService.getTransferAuditLogs(transfer.folio);
          this.auditEntries.set(this.sortAuditEntries(localLogs || []));
        }
      },
      error: () => {
        this.isLoadingAudit.set(false);
        const localLogs = this.movementsService.getTransferAuditLogs(transfer.folio);
        this.auditEntries.set(this.sortAuditEntries(localLogs || []));
      },
    });
  }

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
      case 'TRASPASO_REGISTRADO': return 'compare_arrows';
      case 'TRASPASO_COMPLETADO': return 'check_circle';
      case 'TRASPASO_CANCELADO':  return 'cancel';
      default:                    return 'history';
    }
  }

  getAuditColorClass(action: string): string {
    switch (action) {
      case 'TRASPASO_REGISTRADO': return 'carriers-tl-node--emerald';
      case 'TRASPASO_COMPLETADO': return 'carriers-tl-node--blue';
      case 'TRASPASO_CANCELADO':  return 'carriers-tl-node--red';
      default:                    return 'carriers-tl-node--indigo';
    }
  }

  getAuditSummary(action: string): string {
    switch (action) {
      case 'TRASPASO_REGISTRADO': return 'Reubicación de Tarima (Traspaso / Putaway)';
      case 'TRASPASO_COMPLETADO': return 'Traspaso Concluido en Bahía Destino';
      case 'TRASPASO_CANCELADO':  return 'Cancelación Extraordinaria con Autorización';
      default:                    return action;
    }
  }

  // Toggle de seleccion de tarima individual
  togglePalletSelection(palletId: string): void {
    this.selectedPalletIds.update((ids) => {
      if (ids.includes(palletId)) {
        return ids.filter((id) => id !== palletId);
      } else {
        return [...ids, palletId];
      }
    });
  }

  // Seleccionar todas o deseleccionar todas
  toggleSelectAllPallets(): void {
    const stock = this.originStock();
    if (this.selectedPalletIds().length === stock.pallets.length) {
      this.selectedPalletIds.set([]);
    } else {
      this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
    }
  }

  // Abrir Modal de Confirmacion
  openConfirmModal(): void {
    if (!this.canProceedToConfirm()) return;
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  // Resuelve determinísticamente el UUID de una bahía para la API del Backend
  resolveLocationUuid(locCode: string, isDest = false): string {
    const clean = (locCode || '').toUpperCase().trim();
    const loc = this.movementsService.getLocationInfo(clean);
    if (loc?.locationId && /^[0-9a-fA-F-]{36}$/.test(loc.locationId)) {
      return loc.locationId;
    }
    const all: LocationStockInfo[] = Object.values(this.movementsService.locations() || {});
    const found = all.find(
      (l: LocationStockInfo) =>
        (l.locationCode && l.locationCode.toUpperCase().trim() === clean) ||
        (l.locationId && /^[0-9a-fA-F-]{36}$/.test(l.locationId))
    );
    if (found?.locationId && /^[0-9a-fA-F-]{36}$/.test(found.locationId)) {
      return found.locationId;
    }
    // Fallbacks deterministas válidos a los UUIDs sembrados en wms.locations
    return isDest
      ? '00000000-0000-0000-0006-000000000005'
      : '00000000-0000-0000-0006-000000000001';
  }

  // Ejecutar el Cambio de Almacen -- integrado con el Backend
  executeTransferAction(): void {
    if (!this.canProceedToConfirm()) return;
    this.isExecuting.set(true);

    const operator = this.selectedOperator();
    const reason = this.selectedReason();
    const session = this.movementsApi.getSessionOrg();
    const transferredBy = this.authState.userFullName() || this.authState.currentUser()?.fullName || this.authState.currentUser()?.username || 'Usuario en Sesión';

    const origin = this.selectedOriginCode();
    const destination = this.selectedDestinationCode();
    const obs = this.observations();

    const originStock = this.originStock();
    const locOriginId = this.resolveLocationUuid(origin, false);
    const locDestId = this.resolveLocationUuid(destination, true);
    const selectedPallets = originStock.pallets.filter((p) =>
      this.selectedPalletIds().includes(p.id)
    );

    // Payload para Backend WMS conforme al contrato de CreateTransferRequest
    const bePayload = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      originLocationId: locOriginId,
      originLocationCode: origin,
      destinationLocationId: locDestId,
      destinationLocationCode: destination,
      selectedItemIds: this.selectedPalletIds().filter((id) => /^[0-9a-fA-F-]{36}$/.test(id)),
      palletCodes: selectedPallets.map((p) => p.palletCode),
      palletIds: this.selectedPalletIds(),
      forkliftOperatorId: operator?.id && /^[0-9a-fA-F-]{36}$/.test(operator.id) ? operator.id : undefined,
      forkliftOperatorName: operator?.name || 'Operador',
      reasonCode: reason.id,
      reasonLabel: reason.label,
      observations: obs,
      transferredBy,
      totalPallets: this.selectedTotalPallets(),
      totalPieces: this.selectedTotalPieces(),
    };

    this.movementsApi.createTransfer(bePayload).subscribe({
      next: (res: any) => {
        this.isExecuting.set(false);
        this.showConfirmModal.set(false);

        // Actualizar el estado reactivo en memoria local
        const executedTransfer = this.movementsService.executeDetailedTransfer({
          originLocationCode: origin,
          destinationLocationCode: destination,
          selectedPalletIds: this.selectedPalletIds(),
          forkliftOperator: operator?.name || 'Operador',
          forkliftOperatorId: operator?.id,
          reasonId: reason.id,
          reasonLabel: reason.label,
          observations: obs,
          transferredBy,
        });

        if (executedTransfer) {
          if (res?.folio) {
            executedTransfer.folio = res.folio;
            executedTransfer.id = res.id;
            executedTransfer.transferredBy = res.createdBy || transferredBy;
          }
          localStorage.setItem('4g_active_transfer_folio', executedTransfer.folio);
          this.lastCompletedTransfer.set(executedTransfer);
          this.toast.success(`Cambio de Almacén #${executedTransfer.folio} registrado y guardado con éxito en el servidor.`);
          // Diálogo interactivo: ¿Desea imprimir documento? (Sí/No)
          this.showPrintPromptModal.set(true);
        } else {
          this.toast.success('Reubicación completada exitosamente.');
          this.resetToIdle();
        }

        // Sincronizar datos frescos del Backend (ADR-007)
        this.movementsService.reloadTransfers();
        this.movementsService.reloadInventoryBatches();
      },
      error: (err: any) => {
        this.isExecuting.set(false);
        this.showConfirmModal.set(false);
        const msg =
          err.error?.message ||
          err.message ||
          'Error al procesar y guardar el cambio de almacén en el servidor.';
        this.toast.error(msg);
      },
    });
  }

  // Manejo del diálogo ¿Desea imprimir documento? (Sí/No)
  onConfirmPrintPrompt(printNow: boolean): void {
    const transfer = this.lastCompletedTransfer();
    this.showPrintPromptModal.set(false);
    if (!transfer) return;
    if (printNow) {
      this.selectTransferItem(transfer);
      this.openPrintPreview(transfer);
    } else {
      this.selectTransferItem(transfer);
    }
  }

  // ── IMPRESIÓN Y DESCARGA DIRECTA DE COMPROBANTE ──
  openPrintPreview(transfer: WarehouseTransfer): void {
    this.selectedPrintTransfer.set(transfer);
    this.showPrintModal.set(true);
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintTransfer.set(null);
  }

  triggerBrowserPrint(): void {
    const transfer = this.selectedPrintTransfer();
    if (!transfer) return;
    const folio = transfer.folio || 'Doc';
    const isCancelled = transfer.status === 'CANCELLED';
    const printDocTitle = isCancelled ? `Cancelación Traspaso #${folio}` : `Traspaso #${folio}`;
    this.printService.printElement('fg-print-transfer-layout', printDocTitle);
  }

  isGeneratingPdf = signal(false);

  async downloadDirectPdf(): Promise<void> {
    const transfer = this.selectedPrintTransfer();
    if (!transfer) return;

    const folio = transfer.folio || 'Doc';
    const isCancelled = transfer.status === 'CANCELLED';
    const filename = isCancelled ? `Cancelacion_Traspaso_${folio}` : `Comprobante_Traspaso_${folio}`;

    this.isGeneratingPdf.set(true);
    try {
      await this.printService.downloadPdf('fg-print-transfer-layout', filename);
      this.toast.success(`PDF descargado exitosamente: ${filename}.pdf`);
    } catch (err: any) {
      console.error('Error al generar PDF de traspaso:', err);
      this.toast.error('No se pudo generar el PDF automáticamente. Utiliza el botón Imprimir.');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  // ── MODAL CANCELACIÓN / REVOCACIÓN ──
  openCancelModal(): void {
    this.cancelReason.set('');
    this.cancelAdminUser.set('');
    this.cancelAdminPassword.set('');
    this.cancelErrorMessage.set(null);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.cancelErrorMessage.set(null);
  }

  confirmCancelTransfer(): void {
    const curr = this.selectedTransfer();
    if (!curr) return;

    const reason = this.cancelReason().trim();
    const user = this.cancelAdminUser().trim();
    const pass = this.cancelAdminPassword().trim();

    if (!reason) {
      this.cancelErrorMessage.set('Debes ingresar un motivo o justificación obligatoria para la cancelación.');
      return;
    }
    if (!user || !pass) {
      this.cancelErrorMessage.set('Debes ingresar las credenciales del Administrador para autorizar.');
      return;
    }

    this.isCancelling.set(true);
    this.cancelErrorMessage.set(null);

    const session = this.movementsApi.getSessionOrg();
    const cancelPayload = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      reason,
      adminUsername: user,
      adminPassword: pass,
      cancelledBy: this.authState.userFullName() || user,
    };

    // Si tiene ID del BE, llamar al endpoint de cancelación
    if (curr.id) {
      this.movementsApi.cancelTransfer(curr.id, cancelPayload).subscribe({
        next: (updatedBe: any) => {
          this.isCancelling.set(false);
          this.showCancelModal.set(false);
          const cancelled = this.movementsService.cancelTransfer(curr.folio, reason, cancelPayload.cancelledBy);

          // Sincronizar de inmediato datos frescos del Backend (ADR-007)
          this.movementsService.reloadTransfers();
          this.movementsService.reloadInventoryBatches();

          const merged: WarehouseTransfer = {
            ...(cancelled || curr),
            status: 'CANCELLED',
            cancelledAt: updatedBe?.cancelledAt ? new Date(updatedBe.cancelledAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
            cancelledBy: updatedBe?.cancelledBy || cancelPayload.cancelledBy,
            cancellationReason: reason,
          };
          this.selectedTransfer.set(merged);
          this.toast.success(`Traspaso #${curr.folio} cancelado exitosamente.`);
          this.loadAuditLogs(merged);
        },
        error: (err: any) => {
          this.isCancelling.set(false);
          const msg = err.error?.message || err.message || 'Error al validar credenciales o cancelar en el servidor.';
          this.cancelErrorMessage.set(msg);
        },
      });
    } else {
      // Fallback local
      this.isCancelling.set(false);
      this.showCancelModal.set(false);
      const cancelled = this.movementsService.cancelTransfer(curr.folio, reason, cancelPayload.cancelledBy);
      if (cancelled) {
        this.selectTransferItem(cancelled);
        this.toast.success(`Traspaso #${curr.folio} cancelado exitosamente.`);
      }
    }
  }
}
