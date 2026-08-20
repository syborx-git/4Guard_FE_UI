import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { AuthState } from '../../../../core/auth/auth.state';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import {
  WarehouseOutbound,
  OutboundItem,
  TransportType,
  TRANSPORT_TYPES,
  CarrierLineItem,
  ClientItem,
  ClientDestination,
  InventoryBatch,
  MovementAuditEntry,
} from '../../models/warehouse-movements.models';
import { PrintDispatchLayoutComponent } from '../../components/print-layouts/print-dispatch-layout.component';

@Component({
  selector: 'fg-outbound-submodule',
  standalone: true,
  imports: [CommonModule, FormsModule, PrintDispatchLayoutComponent],
  templateUrl: './outbound-submodule.component.html',
  styleUrl: './outbound-submodule.component.css',
})
export class OutboundSubmoduleComponent implements OnInit {
  private readonly svc = inject(WarehouseMovementsService);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);

  goToManageCarriers(): void {
    this.router.navigate(['/admin/carriers']);
  }

  // ── MODO DEL WORKBENCH ─────────────────────────────────────────────────────
  formMode = signal<'idle' | 'create' | 'detail'>('idle');
  selectedOutbound = signal<WarehouseOutbound | null>(null);
  searchQuery = signal('');
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
    if (!name) return 'SAL';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // ── PASO 1: TRANSPORTE / DESTINO / SELLO ──────────────────────────────────
  currentStep = signal<1 | 2>(1);

  // Catálogos
  readonly carriers = this.svc.carrierLines;
  readonly clients = this.svc.clients;
  readonly transportTypes = TRANSPORT_TYPES;
  readonly allBatches = this.svc.inventoryBatches;

  // Selecciones Paso 1
  selectedClientCode = signal('');
  selectedDestinationId = signal('');
  selectedCarrierCode = signal('');
  driverName = signal('');
  economicNumber = signal('');
  tractorPlates = signal('');
  boxPlates = signal('');
  selectedTransportType = signal<TransportType>('TRAILER');
  sealNumber = signal('');

  // Computed: Cliente seleccionado
  selectedClient = computed(() =>
    this.clients().find((c) => c.code === this.selectedClientCode()) || this.clients()[0]
  );

  // Computed: Destinos del cliente activo
  destinationsForClient = computed(() =>
    this.svc.getDestinationsForClient(this.selectedClientCode())
  );

  // Computed: Destino seleccionado
  selectedDestination = computed(() =>
    this.destinationsForClient().find((d) => d.id === this.selectedDestinationId()) ||
    this.destinationsForClient()[0]
  );

  // Computed: Transportista seleccionado
  selectedCarrier = computed(() =>
    this.carriers().find((c) => c.code === this.selectedCarrierCode()) || this.carriers()[0]
  );

  // Validación Paso 1
  isStep1Valid = computed(() =>
    !!this.selectedClientCode() &&
    !!this.selectedDestinationId() &&
    !!this.selectedCarrierCode() &&
    !!this.driverName().trim() &&
    !!this.sealNumber().trim()
  );

  // ── PASO 2: SELECCIÓN DE MERCANCÍA ────────────────────────────────────────

  // Lotes disponibles para el cliente seleccionado (simulado: todos los disponibles)
  availableBatches = computed(() => {
    const client = this.selectedClient();
    return this.allBatches().filter((b) => b.availablePallets > 0);
  });

  selectedBatch = signal<InventoryBatch | null>(null);
  selectedPalletIds = signal<string[]>([]);

  // Convierte los pallets del batch seleccionado a OutboundItems
  selectedPalletItems = computed<OutboundItem[]>(() => {
    const batch = this.selectedBatch();
    if (!batch) return [];
    const ids = this.selectedPalletIds();
    return batch.pallets
      .filter((p) => ids.includes(p.id))
      .map((p) => ({
        id: p.id,
        palletCode: p.palletCode,
        productId: p.productId,
        description: p.description,
        lotNumber: batch.lotNumber,
        expirationDate: batch.expirationDate,
        pieces: p.pieces,
        palletTypeId: p.palletTypeId,
        palletTypeLabel: p.palletTypeLabel,
        locationCode: batch.locationCode,
      }));
  });

  totalSelectedPallets = computed(() => this.selectedPalletItems().length);
  totalSelectedPieces = computed(() =>
    this.selectedPalletItems().reduce((acc, p) => acc + p.pieces, 0)
  );
  totalSelectedSkus = computed(() =>
    new Set(this.selectedPalletItems().map((p) => p.productId)).size
  );

  isStep2Valid = computed(() => this.selectedPalletItems().length > 0);

  canConfirm = computed(() => this.isStep1Valid() && this.isStep2Valid());

  // ── KPI SIGNALS ────────────────────────────────────────────────────────────
  kpiTotalOutbounds = this.svc.kpiTotalOutbounds;
  kpiTotalPallets = this.svc.kpiTotalPalletsDispatched;
  kpiTotalPieces = this.svc.kpiTotalPiecesDispatched;
  kpiClients = this.svc.kpiDistinctClientsServed;

  // ── DIRECTORIO (LISTA IZQUIERDA) ──────────────────────────────────────────
  outboundsList = this.svc.outbounds;
  filteredOutbounds = computed(() => {
    const list = this.outboundsList();
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();

    return list.filter((o) => {
      const matchStatus = status === 'ALL' || o.status === status;
      if (!matchStatus) return false;

      if (!q) return true;
      return (
        o.folio.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.carrierName.toLowerCase().includes(q) ||
        o.sealNumber.toLowerCase().includes(q) ||
        o.destinationName.toLowerCase().includes(q)
      );
    });
  });

  // ── MODALES ────────────────────────────────────────────────────────────────
  showConfirmModal = signal(false);
  isExecuting = signal(false);
  showPrintModal = signal(false);
  selectedPrintOutbound = signal<WarehouseOutbound | null>(null);

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.loadInitialBackendData();
    this.formMode.set('idle');
    this.selectedOutbound.set(null);
  }

  // ── NAVEGACIÓN ────────────────────────────────────────────────────────────
  startNewOutbound(): void {
    this.svc.reloadCarriers();
    this.formMode.set('create');
    this.selectedOutbound.set(null);
    this.currentStep.set(1);
    localStorage.removeItem('4guard_active_outbound_folio');

    // Inicializar selecciones dinámicas
    const firstClient = this.clients()[0];
    const firstCarrier = this.carriers()[0];
    this.selectedClientCode.set(firstClient ? firstClient.code : '');
    this.selectedDestinationId.set('');
    this.selectedCarrierCode.set(firstCarrier ? firstCarrier.code : '');
    this.driverName.set('');
    this.economicNumber.set('');
    this.tractorPlates.set('');
    this.boxPlates.set('');
    this.selectedTransportType.set('TRAILER');
    this.sealNumber.set('');
    this.selectedPalletIds.set([]);

    const batches = this.availableBatches();
    if (batches.length > 0) {
      this.pickBatch(batches[0]);
    } else {
      this.selectedBatch.set(null);
    }
  }

  resetToIdle(): void {
    this.formMode.set('idle');
    this.selectedOutbound.set(null);
    localStorage.removeItem('4guard_active_outbound_folio');
    this.currentStep.set(1);
  }

  selectOutboundItem(outbound: WarehouseOutbound): void {
    this.formMode.set('detail');
    this.selectedOutbound.set(outbound);
    localStorage.setItem('4guard_active_outbound_folio', outbound.folio);
    this.loadAuditLogs(outbound.folio);
  }

  loadAuditLogs(folio: string): void {
    const logs = this.svc.getOutboundAuditLogs(folio);
    this.auditEntries.set(logs || []);
  }

  getAuditIcon(action: string): string {
    switch (action) {
      case 'SALIDA_REGISTRADA': return 'local_shipping';
      case 'SALIDA_DESPACHADA': return 'check_circle';
      case 'SALIDA_CANCELADA':  return 'cancel';
      default:                  return 'history';
    }
  }

  getAuditColorClass(action: string): string {
    switch (action) {
      case 'SALIDA_REGISTRADA': return 'carriers-tl-node--emerald';
      case 'SALIDA_DESPACHADA': return 'carriers-tl-node--blue';
      case 'SALIDA_CANCELADA':  return 'carriers-tl-node--red';
      default:                  return 'carriers-tl-node--indigo';
    }
  }

  getAuditSummary(action: string): string {
    switch (action) {
      case 'SALIDA_REGISTRADA': return 'Despacho Outbound Confirmado';
      case 'SALIDA_DESPACHADA': return 'Salida Física y Tránsito Confirmado';
      case 'SALIDA_CANCELADA':  return 'Cancelación Extraordinaria de Despacho';
      default:                  return action;
    }
  }

  // ── PASO 1 → PASO 2 ───────────────────────────────────────────────────────
  goToStep2(): void {
    if (!this.isStep1Valid()) {
      this.toast.warning('Completa los datos de transporte y destino para continuar.');
      return;
    }
    this.currentStep.set(2);
  }

  goBackToStep1(): void {
    this.currentStep.set(1);
  }

  // ── CLIENTE / DESTINO / CARRIER ────────────────────────────────────────────
  onClientChange(code: string): void {
    this.selectedClientCode.set(code);
    // Auto-seleccionar primer destino del nuevo cliente
    const dests = this.svc.getDestinationsForClient(code);
    if (dests.length > 0) {
      this.selectedDestinationId.set(dests[0].id);
    } else {
      this.selectedDestinationId.set('');
    }
  }

  onCarrierChange(code: string): void {
    this.selectedCarrierCode.set(code);
    // Precargar nombre del transportista (snapshot)
  }

  // ── SELECCIÓN DE BATCH Y TARIMAS ─────────────────────────────────────────
  pickBatch(batch: InventoryBatch): void {
    this.selectedBatch.set(batch);
    // Pre-seleccionar todas las tarimas disponibles
    this.selectedPalletIds.set(batch.pallets.map((p) => p.id));
  }

  togglePallet(id: string): void {
    this.selectedPalletIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  toggleAllPallets(): void {
    const batch = this.selectedBatch();
    if (!batch) return;
    if (this.selectedPalletIds().length === batch.pallets.length) {
      this.selectedPalletIds.set([]);
    } else {
      this.selectedPalletIds.set(batch.pallets.map((p) => p.id));
    }
  }

  isPalletSelected(id: string): boolean {
    return this.selectedPalletIds().includes(id);
  }

  areAllPalletsSelected(): boolean {
    const batch = this.selectedBatch();
    if (!batch || batch.pallets.length === 0) return false;
    return this.selectedPalletIds().length === batch.pallets.length;
  }

  // ── CONFIRMACIÓN Y EJECUCIÓN ──────────────────────────────────────────────
  openConfirmModal(): void {
    if (!this.canConfirm()) {
      this.toast.warning('Completa todos los campos obligatorios antes de confirmar.');
      return;
    }
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  executeOutboundAction(): void {
    if (!this.canConfirm()) return;
    this.isExecuting.set(true);

    try {
      const batch = this.selectedBatch();
      const carrier = this.selectedCarrier();
      const client = this.selectedClient();
      const dest = this.selectedDestination();

      const result = this.svc.executeOutbound({
        clientCode: this.selectedClientCode(),
        clientName: client?.name || '',
        destinationId: this.selectedDestinationId(),
        destinationName: dest?.name || '',
        destinationAddress: dest ? `${dest.address}, ${dest.city}, ${dest.state}` : '',
        carrierCode: this.selectedCarrierCode(),
        carrierName: carrier?.name || '',
        driverName: this.driverName(),
        economicNumber: this.economicNumber(),
        tractorPlates: this.tractorPlates(),
        boxPlates: this.boxPlates(),
        transportType: this.selectedTransportType(),
        sealNumber: this.sealNumber(),
        remisionNo: batch?.remisionNo || 'REM-SIN-ASIGNAR',
        selectedPallets: this.selectedPalletItems(),
        dispatchedBy: 'Christian Durán (Admin)',
      });

      this.isExecuting.set(false);
      this.showConfirmModal.set(false);
      this.toast.success(`Salida ${result.folio} registrada y lista para despacho.`);

      // Abrir en modo detalle + mostrar comprobante
      this.selectedOutbound.set(result);
      this.formMode.set('detail');
      this.loadAuditLogs(result.folio);
      this.selectedPrintOutbound.set(result);
      this.showPrintModal.set(true);
    } catch (err: any) {
      this.isExecuting.set(false);
      this.toast.error(err.message || 'Error al registrar la salida de almacén.');
    }
  }

  // ── IMPRESIÓN ─────────────────────────────────────────────────────────────
  openPrintPreview(outbound: WarehouseOutbound): void {
    this.selectedPrintOutbound.set(outbound);
    this.showPrintModal.set(true);
  }

  closePrintModal(): void {
    this.showPrintModal.set(false);
    this.selectedPrintOutbound.set(null);
  }

  triggerBrowserPrint(): void {
    window.print();
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  getTransportLabel(type: TransportType): string {
    return TRANSPORT_TYPES.find((t) => t.id === type)?.label || type;
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

  confirmCancelOutbound(): void {
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

    const current = this.selectedOutbound();
    if (!current) return;

    this.isCancelling.set(true);
    this.cancelErrorMessage.set(null);

    try {
      const updated = this.svc.cancelOutbound(
        current.folio,
        reason,
        username
      );

      this.isCancelling.set(false);

      if (updated) {
        this.selectedOutbound.set(updated);
        this.loadAuditLogs(updated.folio);
        this.showCancelModal.set(false);
        this.toast.success(`Salida de Almacén #${current.folio} ha sido cancelada.`);
      } else {
        this.cancelErrorMessage.set('No se pudo cancelar la salida. Folio no encontrado.');
      }
    } catch (err: any) {
      this.isCancelling.set(false);
      this.cancelErrorMessage.set(err.message || 'Error de autenticación o validación de cancelación.');
    }
  }
}
