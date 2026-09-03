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

  // Computed que toma operadores activos del servicio admin (cargados desde BE)
  forkliftOperators = computed<ForkliftOperatorOption[]>(() => {
    const adminOps = this.forkliftAdminService.activeOperators();
    return adminOps.map((op) => ({
      id: op.id,
      name: op.fullName,
      badge: op.licenseNumberDc3 || op.code,
      shift: op.shift || '',
      status: op.status,
    }));
  });

  // Catalogo de Motivos de Reubicacion
  transferReasons: TransferReasonItem[] = TRANSFER_REASONS;

  // -- PASO 1: MONTACARGUISTA --
  selectedOperatorId = signal('');
  selectedOperator = computed<ForkliftOperatorOption | undefined>(() =>
    this.forkliftOperators().find((op) => op.id === this.selectedOperatorId())
      ?? this.forkliftOperators()[0]
  );

  // -- PASO 2: BAHIA ORIGEN E INVENTARIO --
  selectedOriginCode = signal('');
  selectedPalletIds = signal<string[]>([]);

  originStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedOriginCode())
  );

  // -- PASO 3: BAHIA DESTINO --
  selectedDestinationCode = signal('');

  destStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedDestinationCode())
  );

  // Bahias Ocupadas y Disponibles
  occupiedLocations = this.movementsService.occupiedLocations;
  availableLocations = this.movementsService.availableLocations;

  // -- PASO 4: MOTIVO Y OBSERVACIONES --
  selectedReasonId = signal('OPT_ESPACIO');
  observations = signal('');

  selectedReason = computed(() =>
    this.transferReasons.find((r) => r.id === this.selectedReasonId()) || this.transferReasons[0]
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
    return dest.totalPallets === 0 && !dest.isBlocked;
  });

  canProceedToConfirm = computed(() => {
    return (
      !!this.selectedOperator() &&
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
      next: (ops) => {
        this.isLoadingOperators.set(false);
        // Autoseleccionar el primer operador si no hay ninguno seleccionado
        if (!this.selectedOperatorId() && ops && ops.length > 0) {
          this.selectedOperatorId.set(ops[0].id);
        }
      },
      error: () => {
        this.isLoadingOperators.set(false);
        this.toast.error('No se pudo cargar el catalogo de montacarguistas.');
      },
    });
  }

  // Iniciar Nuevo Traspaso (Modo Captura)
  startNewTransfer(): void {
    this.formMode.set('create');
    this.selectedTransfer.set(null);
    localStorage.removeItem('4g_active_transfer_folio');

    const occupied = this.occupiedLocations();
    const defaultOrigin = occupied.length > 0 ? occupied[0].locationCode : '';
    this.selectedOriginCode.set(defaultOrigin);

    const available = this.availableLocations();
    const defaultDest = available.length > 0 ? available[0].locationCode : '';
    this.selectedDestinationCode.set(defaultDest);

    this.selectedReasonId.set('OPT_ESPACIO');
    this.observations.set('');

    // Seleccionar primer operador disponible si no hay uno seleccionado
    if (!this.selectedOperatorId() && this.forkliftOperators().length > 0) {
      this.selectedOperatorId.set(this.forkliftOperators()[0].id);
    }

    if (defaultOrigin) {
      const stock = this.movementsService.getLocationInfo(defaultOrigin);
      this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
    } else {
      this.selectedPalletIds.set([]);
    }
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
      // Sin ID del BE: usar datos locales en memoria
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
          // Fallback: datos locales si el BE no devuelve registros
          const localLogs = this.movementsService.getTransferAuditLogs(transfer.folio);
          this.auditEntries.set(localLogs || []);
        }
      },
      error: () => {
        this.isLoadingAudit.set(false);
        // Fallback: datos locales si falla la llamada al BE
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
      case 'TRASPASO_REGISTRADO': return 'Reubicacion de Inventario Confirmada';
      case 'TRASPASO_COMPLETADO': return 'Traspaso Concluido en Bahia Destino';
      case 'TRASPASO_CANCELADO':  return 'Cancelacion Extraordinaria de Traspaso';
      default:                    return action;
    }
  }

  // Seleccion de Bahia Origen
  selectOriginLocation(code: string): void {
    this.selectedOriginCode.set(code);
    const stock = this.movementsService.getLocationInfo(code);
    this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
  }

  // Seleccion de Bahia Destino
  selectDestinationLocation(code: string): void {
    this.selectedDestinationCode.set(code);
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

    if (!operator) {
      this.isExecuting.set(false);
      this.toast.error('Selecciona un montacarguista antes de confirmar.');
      return;
    }

    // Resolver UUIDs de las ubicaciones desde el estado local (cargadas del BE via getLocations)
    const originInfo = this.movementsService.getLocationInfo(this.selectedOriginCode());
    const destInfo = this.movementsService.getLocationInfo(this.selectedDestinationCode());

    if (!originInfo.locationId) {
      this.isExecuting.set(false);
      this.toast.error(`La bahía origen ${this.selectedOriginCode()} no tiene un ID de ubicación válido.`);
      return;
    }

    if (!destInfo.locationId) {
      this.isExecuting.set(false);
      this.toast.error(`La bahía destino ${this.selectedDestinationCode()} no tiene un ID de ubicación válido.`);
      return;
    }

    // Filtrar/obtener los UUIDs válidos de los ítems de inventario
    const selectedIds = this.selectedPalletIds();
    if (selectedIds.length === 0) {
      this.isExecuting.set(false);
      this.toast.error('Debes seleccionar al menos una tarima para el cambio de almacén.');
      return;
    }

    const payload = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      forkliftOperatorId: operator.id,
      originLocationId: originInfo.locationId,
      destinationLocationId: destInfo.locationId,
      selectedItemIds: selectedIds,
      reasonCode: reason.id,
      reasonLabel: reason.label,
      observations: this.observations() || '',
    };

    this.movementsApi.createTransfer(payload).subscribe({
      next: (res: any) => {
        this.isExecuting.set(false);
        this.showConfirmModal.set(false);

        // Mapear la respuesta del BE al modelo local
        const transfer: WarehouseTransfer = {
          id: res.id,
          folio: res.folio,
          status: res.status || 'COMPLETED',
          forkliftOperator: res.forkliftOperatorName || operator.name,
          forkliftOperatorId: res.forkliftOperatorId || operator.id,
          originLocation: res.originLocationCode || this.selectedOriginCode(),
          destinationLocation: res.destinationLocationCode || this.selectedDestinationCode(),
          reasonId: res.reasonCode || reason.id,
          reasonLabel: res.reasonLabel || reason.label,
          observations: res.observations || this.observations(),
          pallets: [],
          totalPallets: res.totalPallets || this.selectedPalletIds().length,
          totalPieces: res.totalPieces || this.selectedTotalPieces(),
          distinctSkus: res.distinctSkus || this.selectedDistinctSkus(),
          transferredAt: res.createdAt
            ? new Date(res.createdAt).toLocaleString('es-MX')
            : new Date().toLocaleString('es-MX'),
          transferredBy: res.createdBy || transferredBy,
        };

        // Actualizar estado local de bahias y lista de traspasos
        try {
          this.movementsService.executeDetailedTransfer({
            originLocationCode: this.selectedOriginCode(),
            destinationLocationCode: this.selectedDestinationCode(),
            selectedPalletIds: this.selectedPalletIds(),
            forkliftOperator: operator.name,
            forkliftOperatorId: operator.id,
            reasonId: reason.id,
            reasonLabel: reason.label,
            observations: this.observations(),
            transferredBy,
          });
        } catch (_) {
          // El BE ya confirmo el traspaso; ignorar error de validacion local de bahias
        }

        this.toast.success(`Cambio de Almacen ${transfer.folio} ejecutado exitosamente.`);
        this.selectedTransfer.set(transfer);
        this.formMode.set('detail');
        this.loadAuditLogs(transfer);
        this.selectedPrintTransfer.set(transfer);
        this.showPrintModal.set(true);
      },
      error: (err: any) => {
        this.isExecuting.set(false);
        const msg =
          err?.error?.message ||
          err?.message ||
          'Error al confirmar el cambio de almacen. Intentalo de nuevo.';
        this.toast.error(msg);
      },
    });
  }

  // Vista Previa / Impresion
  openPrintPreview(transfer: WarehouseTransfer): void {
    this.selectedPrintTransfer.set(transfer);
    this.showPrintModal.set(true);
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintTransfer.set(null);
  }

  isGeneratingPdf = signal(false);

  async downloadDirectPdf(): Promise<void> {
    const folio = this.selectedPrintTransfer()?.folio || 'Doc';
    this.isGeneratingPdf.set(true);
    try {
      await this.printService.downloadPdf('fg-print-transfer-layout', String(folio));
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  triggerBrowserPrint(): void {
    const folio = this.selectedPrintTransfer()?.folio || 'Doc';
    this.printService.printElement('fg-print-transfer-layout', String(folio));
  }

  // -- CANCELACION CON AUTORIZACION DE ADMINISTRADOR --
  openCancelModal(): void {
    const user = this.authState.currentUser();
    this.cancelReason.set('');
    this.cancelAdminUser.set(user ? user.username || user.email : 'admin@4guard.com');
    this.cancelAdminPassword.set('');
    this.cancelErrorMessage.set(null);
    this.showCancelPassword.set(false);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.cancelErrorMessage.set(null);
  }

  confirmCancelTransfer(): void {
    const reason = this.cancelReason().trim();
    if (!reason || reason.length < 5) {
      this.cancelErrorMessage.set('Debes ingresar un motivo de cancelacion detallado (minimo 5 caracteres).');
      return;
    }

    const username = this.cancelAdminUser().trim();
    const password = this.cancelAdminPassword().trim();

    if (!username || !password) {
      this.cancelErrorMessage.set('Debes ingresar las credenciales del Administrador.');
      return;
    }

    const current = this.selectedTransfer();
    if (!current) return;

    this.isCancelling.set(true);
    this.cancelErrorMessage.set(null);

    const cancelPayload = {
      adminUsername: username,
      adminPassword: password,
      reason: reason,
    };

    if (current.id) {
      // Cancelacion integrada con el Backend
      this.movementsApi.cancelTransfer(current.id, cancelPayload).subscribe({
        next: (_res: any) => {
          this.isCancelling.set(false);

          // Actualizar estado local del traspaso cancelado
          const updatedLocal = this.movementsService.cancelTransfer(current.folio, reason, username);
          const updated: WarehouseTransfer = updatedLocal
            ? updatedLocal
            : {
                ...current,
                status: 'CANCELLED',
                cancellationReason: reason,
                cancelledAt: new Date().toLocaleString('es-MX'),
                cancelledBy: username,
              };

          this.selectedTransfer.set(updated);
          this.loadAuditLogs(updated);
          this.showCancelModal.set(false);
          this.toast.success(`Cambio de Almacen ${current.folio} ha sido cancelado.`);
        },
        error: (err: any) => {
          this.isCancelling.set(false);
          const msg =
            err?.error?.message ||
            err?.message ||
            'Error de autenticacion o validacion de cancelacion.';
          this.cancelErrorMessage.set(msg);
        },
      });
    } else {
      // Traspaso sin ID del BE -- cancelacion solo local
      try {
        const updated = this.movementsService.cancelTransfer(current.folio, reason, username);
        this.isCancelling.set(false);

        if (updated) {
          this.selectedTransfer.set(updated);
          this.loadAuditLogs(updated);
          this.showCancelModal.set(false);
          this.toast.success(`Cambio de Almacen ${current.folio} ha sido cancelado.`);
        } else {
          this.cancelErrorMessage.set('No se pudo cancelar el traspaso. Folio no encontrado.');
        }
      } catch (err: any) {
        this.isCancelling.set(false);
        this.cancelErrorMessage.set(err.message || 'Error al cancelar el traspaso.');
      }
    }
  }
}
