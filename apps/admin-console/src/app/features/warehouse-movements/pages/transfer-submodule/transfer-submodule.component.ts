import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthState } from '../../../../core/auth/auth.state';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
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
  imports: [CommonModule, FormsModule, PrintTransferLayoutComponent],
  templateUrl: './transfer-submodule.component.html',
  styleUrl: './transfer-submodule.component.css',
})
export class TransferSubmoduleComponent implements OnInit {
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);

  // ── ESTADO DEL WORKBENCH UNIFICADO (MASTER-DETAIL) ──
  formMode = signal<'idle' | 'create' | 'detail'>('idle');
  selectedTransfer = signal<WarehouseTransfer | null>(null);
  searchQuery = signal<string>('');
  statusFilter = signal<string>('ALL');
  auditEntries = signal<MovementAuditEntry[]>([]);

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
    if (!name) return 'TR';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Catálogo de Montacarguistas Certificados
  forkliftOperators: ForkliftOperatorOption[] = [
    { id: 'MC-101', name: 'Pablo Hernández', badge: 'Certificado Senior', shift: 'Matutino (06:00 - 14:00)', status: 'ACTIVO' },
    { id: 'MC-102', name: 'Roberto Gómez', badge: 'Montacarguista Racks', shift: 'Vespertino (14:00 - 22:00)', status: 'ACTIVO' },
    { id: 'MC-103', name: 'José Luis Morales', badge: 'Operador Andén A', shift: 'Matutino (06:00 - 14:00)', status: 'ACTIVO' },
    { id: 'MC-104', name: 'Miguel Ángel Torres', badge: 'Montacarguista Traspasos', shift: 'Nocturno (22:00 - 06:00)', status: 'ACTIVO' },
  ];

  // Catálogo de Motivos de Reubicación
  transferReasons: TransferReasonItem[] = TRANSFER_REASONS;

  // ── PASO 1: MONTACARGUISTA ──
  selectedOperatorId = signal('');
  selectedOperator = computed(() =>
    this.forkliftOperators.find((op) => op.id === this.selectedOperatorId()) || this.forkliftOperators[0]
  );

  // ── PASO 2: BAHÍA ORIGEN E INVENTARIO ──
  selectedOriginCode = signal('');
  selectedPalletIds = signal<string[]>([]);

  originStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedOriginCode())
  );

  // ── PASO 3: BAHÍA DESTINO ──
  selectedDestinationCode = signal('');

  destStock = computed<LocationStockInfo>(() =>
    this.movementsService.getLocationInfo(this.selectedDestinationCode())
  );

  // Bahías Ocupadas y Disponibles
  occupiedLocations = this.movementsService.occupiedLocations;
  availableLocations = this.movementsService.availableLocations;

  // ── PASO 4: MOTIVO Y OBSERVACIONES ──
  selectedReasonId = signal('OPT_ESPACIO');
  observations = signal('');

  selectedReason = computed(() =>
    this.transferReasons.find((r) => r.id === this.selectedReasonId()) || this.transferReasons[0]
  );

  // ── TOTALIZADORES REACTIVOS DE LA SELECCIÓN ──
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

  // ── KPIS SUPERIORES (ESTILO HOMOLOGADO CON RECEPCIÓN) ──
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
    // Estado inicial: Sin selección (Empty State)
    this.formMode.set('idle');
  }

  // Iniciar Nuevo Traspaso (Modo Captura)
  startNewTransfer(): void {
    this.formMode.set('create');
    this.selectedTransfer.set(null);
    localStorage.removeItem('4g_active_transfer_folio');

    const occupied = this.occupiedLocations();
    const defaultOrigin = occupied.length > 0 ? occupied[0].locationCode : 'A-01-N1';
    this.selectedOriginCode.set(defaultOrigin);

    const available = this.availableLocations();
    const defaultDest = available.length > 0 ? available[0].locationCode : 'E-01-N1';
    this.selectedDestinationCode.set(defaultDest);

    this.selectedReasonId.set('OPT_ESPACIO');
    this.observations.set('');

    const stock = this.movementsService.getLocationInfo(defaultOrigin);
    this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
  }

  // Volver a estado inicial (Sin selección)
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
    this.loadAuditLogs(transfer.folio);
  }

  loadAuditLogs(folio: string): void {
    const logs = this.movementsService.getTransferAuditLogs(folio);
    this.auditEntries.set(logs || []);
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

  // Selección de Bahía Origen
  selectOriginLocation(code: string): void {
    this.selectedOriginCode.set(code);
    const stock = this.movementsService.getLocationInfo(code);
    this.selectedPalletIds.set(stock.pallets.map((p) => p.id));
  }

  // Selección de Bahía Destino
  selectDestinationLocation(code: string): void {
    this.selectedDestinationCode.set(code);
  }

  // Toggle de selección de tarima individual
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

  // Abrir Modal de Confirmación
  openConfirmModal(): void {
    if (!this.canProceedToConfirm()) return;
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  // Ejecutar el Cambio de Almacén Transaccional
  executeTransferAction(): void {
    if (!this.canProceedToConfirm()) return;
    this.isExecuting.set(true);

    try {
      const operator = this.selectedOperator();
      const reason = this.selectedReason();

      const transfer = this.movementsService.executeDetailedTransfer({
        originLocationCode: this.selectedOriginCode(),
        destinationLocationCode: this.selectedDestinationCode(),
        selectedPalletIds: this.selectedPalletIds(),
        forkliftOperator: operator.name,
        forkliftOperatorId: operator.id,
        reasonId: reason.id,
        reasonLabel: reason.label,
        observations: this.observations(),
        transferredBy: 'Christian Durán (Admin)',
      });

      this.isExecuting.set(false);
      this.showConfirmModal.set(false);
      this.toast.success(`Cambio de Almacén #${transfer.folio} ejecutado exitosamente.`);

      // Seleccionar el traspaso recién creado en modo detalle y abrir vista de impresión
      this.selectedTransfer.set(transfer);
      this.formMode.set('detail');
      this.loadAuditLogs(transfer.folio);
      this.selectedPrintTransfer.set(transfer);
      this.showPrintModal.set(true);
    } catch (err: any) {
      this.isExecuting.set(false);
      this.toast.error(err.message || 'Error al ejecutar el traspaso transaccional.');
    }
  }

  // Vista Previa / Impresión
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

  // ── CANCELACIÓN CON AUTORIZACIÓN DE ADMINISTRADOR ──
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
      this.cancelErrorMessage.set('Debes ingresar un motivo de cancelación detallado (mínimo 5 caracteres).');
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

    try {
      const updated = this.movementsService.cancelTransfer(
        current.folio,
        reason,
        username
      );

      this.isCancelling.set(false);

      if (updated) {
        this.selectedTransfer.set(updated);
        this.loadAuditLogs(updated.folio);
        this.showCancelModal.set(false);
        this.toast.success(`Cambio de Almacén #${current.folio} ha sido cancelado.`);
      } else {
        this.cancelErrorMessage.set('No se pudo cancelar el traspaso. Folio no encontrado.');
      }
    } catch (err: any) {
      this.isCancelling.set(false);
      this.cancelErrorMessage.set(err.message || 'Error de autenticación o validación de cancelación.');
    }
  }
}
