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
  private readonly authState = inject(AuthState);

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

  // Bahias Ocupadas y Disponibles
  occupiedLocations = this.movementsService.occupiedLocations;
  availableLocations = this.movementsService.availableLocations;

  // Obtiene los números de remisión asociados a las tarimas de una bahía
  getLocationRemisiones(locationCode: string): string[] {
    const cleanCode = (locationCode || '').toUpperCase().trim();
    if (!cleanCode) return [];

    const remisiones = new Set<string>();

    // 1. Buscar en inventoryBatches por locationCode
    const batches = this.movementsService.inventoryBatches();
    batches.forEach((b) => {
      if (b.locationCode && b.locationCode.toUpperCase().trim() === cleanCode && b.remisionNo) {
        remisiones.add(b.remisionNo);
      }
    });

    // 2. Buscar en recepciones por storageLocation
    const receptions = this.movementsService.receptions();
    receptions.forEach((r) => {
      if (r.storageLocation && r.storageLocation.toUpperCase().trim() === cleanCode && r.checkIn?.docNumber) {
        remisiones.add(r.checkIn.docNumber);
      }
    });

    // 3. Revisar los pallets de la ubicación
    const locInfo = this.movementsService.getLocationInfo(cleanCode);
    if (locInfo && locInfo.pallets) {
      locInfo.pallets.forEach((p) => {
        if (p.observations && p.observations.includes('REM-')) {
          const match = p.observations.match(/REM-[\w-]+/);
          if (match) remisiones.add(match[0]);
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
      const matchCode = loc.locationCode.toLowerCase().includes(q);
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
      (l) => l.locationCode.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectOriginLocation(exact.locationCode);
    }
  }

  selectOriginLocation(code: string): void {
    this.selectedOriginCode.set(code);
    this.originSearchQuery.set(code);
    this.isOriginDropdownOpen.set(false);
    const stock = this.movementsService.getLocationInfo(code);
    this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
  }

  clearOriginSelection(): void {
    this.selectedOriginCode.set('');
    this.originSearchQuery.set('');
    this.selectedPalletIds.set([]);
    this.isOriginDropdownOpen.set(false);
  }

  // ── 3. BUSCADOR & AUTOCOMPLETE DE BAHÍA DESTINO (MÁQUINA DE ESTADOS) ──
  destSearchQuery = signal<string>('');
  isDestDropdownOpen = signal<boolean>(false);
  selectedDestinationCode = signal('');

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

  selectDestinationLocation(code: string): void {
    this.selectedDestinationCode.set(code);
    this.destSearchQuery.set(code);
    this.isDestDropdownOpen.set(false);
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

  canProceedToConfirm = computed(() => {
    return (
      !!this.selectedOperator() &&
      !!this.selectedOriginCode() &&
      !!this.selectedDestinationCode() &&
      !!this.selectedReasonId() &&
      this.selectedPalletIds().length > 0 &&
      this.isDestinationEmpty() &&
      this.selectedOriginCode() !== this.selectedDestinationCode()
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

  // Modales
  showConfirmModal = signal(false);
  isExecuting = signal(false);

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
  }

  // Carga logs de auditoria desde el Backend usando el ID del traspaso
  loadAuditLogs(transfer: WarehouseTransfer): void {
    if (!transfer.id) {
      const logs = this.movementsService.getTransferAuditLogs(transfer.folio);
      this.auditEntries.set(logs || []);
      return;
    }

    this.isLoadingAudit.set(true);
    this.movementsApi.getTransferAudit(transfer.id).subscribe({
      next: (logs: any[]) => {
        this.isLoadingAudit.set(false);
        if (logs && logs.length > 0) {
          const mapped: MovementAuditEntry[] = logs.map((log: any) => ({
            id: log.id || log.auditId,
            action: log.action || log.eventType || 'TRASPASO_REGISTRADO',
            actionLabel: log.actionLabel || log.description || log.action,
            username: log.username || log.performedBy || log.createdBy || 'Sistema',
            timestamp: log.timestamp
              ? new Date(log.timestamp).toLocaleString('es-MX')
              : (log.createdAt ? new Date(log.createdAt).toLocaleString('es-MX') : ''),
            details: log.details || log.changes || [],
            reason: log.reason || log.cancellationReason,
            authorizedBy: log.authorizedBy,
          }));
          this.auditEntries.set(mapped);
        } else {
          const localLogs = this.movementsService.getTransferAuditLogs(transfer.folio);
          this.auditEntries.set(localLogs || []);
        }
      },
      error: () => {
        this.isLoadingAudit.set(false);
        const localLogs = this.movementsService.getTransferAuditLogs(transfer.folio);
        this.auditEntries.set(localLogs || []);
      },
    });
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
      case 'TRASPASO_REGISTRADO': return 'Reubicación de Inventario Confirmada';
      case 'TRASPASO_COMPLETADO': return 'Traspaso Concluido en Bahía Destino';
      case 'TRASPASO_CANCELADO':  return 'Cancelación Extraordinaria de Traspaso';
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

  // Ejecutar el Cambio de Almacen -- integrado con el Backend
  executeTransferAction(): void {
    if (!this.canProceedToConfirm()) return;
    this.isExecuting.set(true);

    const operator = this.selectedOperator();
    const reason = this.selectedReason();
    const session = this.movementsApi.getSessionOrg();
    const user = this.authState.currentUser();
    const transferredBy = user?.username || user?.email || 'admin@4guard.com';

    const origin = this.selectedOriginCode();
    const destination = this.selectedDestinationCode();
    const obs = this.observations();

    // Payload para Backend WMS
    const bePayload = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      originLocationCode: origin,
      destinationLocationCode: destination,
      palletIds: this.selectedPalletIds(),
      forkliftOperatorId: operator?.id,
      forkliftOperatorName: operator?.name || 'Operador',
      reasonCode: reason.id,
      reasonDescription: reason.label,
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
          }
          this.selectTransferItem(executedTransfer);
          this.toast.success(`Cambio de Almacén #${executedTransfer.folio} ejecutado con éxito.`);
          this.openPrintPreview(executedTransfer);
        } else {
          this.toast.success('Reubicación completada exitosamente.');
          this.resetToIdle();
        }
      },
      error: () => {
        // Fallback local garantizado si el backend se encuentra offline
        this.isExecuting.set(false);
        this.showConfirmModal.set(false);

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
          this.selectTransferItem(executedTransfer);
          this.toast.success(`Cambio de Almacén #${executedTransfer.folio} ejecutado localmente.`);
          this.openPrintPreview(executedTransfer);
        } else {
          this.toast.error('Ocurrió un error al procesar la reubicación.');
        }
      },
    });
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
    window.print();
  }

  isGeneratingPdf = signal(false);

  downloadDirectPdf(): void {
    const transfer = this.selectedPrintTransfer();
    if (!transfer) return;

    this.isGeneratingPdf.set(true);
    const filename = `Comprobante_Traspaso_${transfer.folio}.pdf`;

    this.printService.downloadPdf('#print-transfer-document', filename)
      .then(() => {
        this.isGeneratingPdf.set(false);
        this.toast.success(`PDF descargado exitosamente: ${filename}`);
      })
      .catch((err: any) => {
        this.isGeneratingPdf.set(false);
        console.error('Error al generar PDF de traspaso:', err);
        this.toast.error('No se pudo generar el PDF automáticamente. Utiliza el botón Imprimir.');
      });
  }

  // ── MODAL CANCELACIÓN / REVOCACIÓN ──
  openCancelModal(): void {
    const currUser = this.authState.currentUser();
    this.cancelReason.set('');
    this.cancelAdminUser.set(currUser?.email || currUser?.username || 'admin@4guard.com');
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
        next: (updatedBe) => {
          this.isCancelling.set(false);
          this.showCancelModal.set(false);
          const cancelled = this.movementsService.cancelTransfer(curr.folio, reason, cancelPayload.cancelledBy);
          if (cancelled) {
            this.selectTransferItem({ ...cancelled, ...updatedBe });
            this.toast.success(`Traspaso #${curr.folio} cancelado exitosamente.`);
          }
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
