import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ToastService } from '../../../../core/services/toast.service';
import { PrintService } from '../../../../core/services/print.service';
import { AuthState } from '../../../../core/auth/auth.state';
import { WarehouseMovementsService } from '../../services/warehouse-movements.service';
import { WarehouseMovementsApiService } from '../../services/warehouse-movements-api.service';
import { ForkliftOperatorAdminService } from '../../../admin/services/forklift-operator.service';
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
  ReceptionPalletItem,
  RampOccupancyStatus,
  RampItem,
} from '../../models/warehouse-movements.models';
import { PrintDispatchLayoutComponent } from '../../components/print-layouts/print-dispatch-layout.component';
import { PrintOutboundCancellationLayoutComponent } from '../../components/print-layouts/print-outbound-cancellation-layout.component';

export interface ForkliftOperatorOption {
  id: string;
  name: string;
  badge: string;
  jobTitle: string;
  shift: string;
  status: string;
}

export interface AvailableSkuOption {
  skuCode: string;
  productName: string;
  category?: string;
  clientName?: string;
  clientCode?: string;
  totalAvailablePallets: number;
  totalAvailablePieces: number;
  batchesCount: number;
  nearestExpirationDate: string;
  pabloStatus: 'PABLO_ALERT' | 'OPTIMAL' | 'EXPIRED';
  pabloLabel: string;
  pabloColor: 'amber' | 'emerald' | 'rose';
  daysRemaining: number;
}

export interface OutboundPalletItem {
  id: string;
  palletCode: string;
  palletNumber?: number;
  productId: string;
  description: string;
  clientName?: string;
  lotNumber: string;
  remisionNo: string;
  expirationDate: string;
  pieces: number;
  palletTypeId: string;
  palletTypeLabel: string;
  locationCode: string;
  daysRemaining: number;
  pabloStatus: 'PABLO_ALERT' | 'OPTIMAL' | 'EXPIRED';
  pabloLabel: string;
  pabloColor: 'amber' | 'emerald' | 'rose';
  isSuggestedFefo: boolean;
}

import { StarBorderDirective } from '../../../../shared/directives/star-border.directive';
import { SpecularGlowDirective } from '../../../../shared/directives/specular-glow.directive';

@Component({
  selector: 'fg-outbound-submodule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    StarBorderDirective,
    SpecularGlowDirective,
    PrintDispatchLayoutComponent,
    PrintOutboundCancellationLayoutComponent,
  ],
  templateUrl: './outbound-submodule.component.html',
  styleUrl: './outbound-submodule.component.css',
})
export class OutboundSubmoduleComponent implements OnInit {
  private readonly svc = inject(WarehouseMovementsService);
  private readonly movementsApi = inject(WarehouseMovementsApiService);
  private readonly forkliftAdminService = inject(ForkliftOperatorAdminService);
  private readonly toast = inject(ToastService);
  private readonly printService = inject(PrintService);
  protected readonly authState = inject(AuthState);
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

  // KPIs Homologados
  readonly kpiTotalOutbounds = this.svc.kpiTotalOutbounds;
  readonly kpiTotalPallets = this.svc.kpiTotalPalletsDispatched;
  readonly kpiTotalPieces = this.svc.kpiTotalPiecesDispatched;
  readonly kpiClients = this.svc.kpiDistinctClientsServed;
  readonly kpiCaseta = computed(() => this.svc.outbounds().filter((o) => o.status === 'REGISTERED').length);
  readonly kpiInAnden = computed(() => this.svc.outbounds().filter((o) => ['ASSIGNED', 'IN_PROGRESS', 'LOADED'].includes(o.status)).length);
  readonly kpiCompleted = computed(() => this.svc.outbounds().filter((o) => o.status === 'COMPLETED').length);
  readonly kpiCancelled = computed(() => this.svc.outbounds().filter((o) => o.status === 'CANCELLED').length);

  // Matriz de Ocupación de Rampas 1-12
  readonly ramps = this.svc.ramps;
  rampOccupancyStatus = this.svc.rampOccupancyStatus;
  totalBusyRampsCount = this.svc.totalBusyRampsCount;
  totalFreeRampsCount = this.svc.totalFreeRampsCount;

  // Modal Plano de Andenes Interactivo
  showDockMapModal = signal(false);
  selectedRampNumber = signal<number>(1);
  observations = signal<string>('');

  // Estados de carga / acción en ciclo operativo
  isAssigningRamp = signal(false);
  isStartingLoading = signal(false);
  isFinishingLoading = signal(false);
  isCompletingOutbound = signal(false);
  tempFinishSealNumber = signal('');
  showAuditTimeline = signal(false);

  toggleShowAuditTimeline(): void {
    this.showAuditTimeline.update((v) => !v);
  }

  // Modal de Modificación de Ficha Operativa (Caseta / Transporte)
  showEditCasetaModal = signal(false);
  editCarrierCode = signal('');
  editDriverName = signal('');
  editTractorPlates = signal('');
  editBoxPlates = signal('');
  editSealNumber = signal('');
  editEconomicNumber = signal('');
  editBoxEconomicNumber = signal('');
  editDestinationId = signal('');
  isUpdatingCaseta = signal(false);

  openEditCasetaModal(): void {
    const ob = this.selectedOutbound();
    if (!ob) return;
    this.editCarrierCode.set(ob.carrierCode || '');
    this.editDriverName.set(ob.driverName || '');
    this.editTractorPlates.set(ob.tractorPlates || '');
    this.editBoxPlates.set(ob.boxPlates || '');
    this.editSealNumber.set(ob.sealNumber || '');
    this.editEconomicNumber.set(ob.economicNumber || '');
    this.editBoxEconomicNumber.set(ob.boxEconomicNumber || '');
    this.editDestinationId.set(ob.destinationId || '');
    this.showEditCasetaModal.set(true);
  }

  saveCasetaModifications(): void {
    const ob = this.selectedOutbound();
    if (!ob) return;
    const carrier = this.carriers().find((c) => c.code === this.editCarrierCode());
    const dest = this.allDestinations().find((d) => d.id === this.editDestinationId());

    this.isUpdatingCaseta.set(true);
    const updated: WarehouseOutbound = {
      ...ob,
      carrierCode: this.editCarrierCode() || ob.carrierCode,
      carrierName: carrier ? carrier.name : ob.carrierName,
      driverName: this.editDriverName() || ob.driverName,
      tractorPlates: this.editTractorPlates() || ob.tractorPlates,
      boxPlates: this.editBoxPlates() || ob.boxPlates,
      sealNumber: this.editSealNumber() || ob.sealNumber,
      economicNumber: this.editEconomicNumber() || ob.economicNumber,
      boxEconomicNumber: this.editBoxEconomicNumber() || ob.boxEconomicNumber,
      destinationId: this.editDestinationId() || ob.destinationId,
      destinationName: dest ? dest.name : ob.destinationName,
    };

    if (ob.id && ob.id.includes('-')) {
      this.movementsApi.updateOutbound(ob.id, {
        carrierId: updated.carrierCode,
        carrierName: updated.carrierName,
        driverName: updated.driverName,
        tractorPlates: updated.tractorPlates,
        boxPlates: updated.boxPlates,
        sealNumber: updated.sealNumber,
        economicNumber: updated.economicNumber,
        boxEconomicNumber: updated.boxEconomicNumber,
        destinationId: updated.destinationId,
        destinationName: updated.destinationName,
      }).subscribe({
        next: () => {
          this.isUpdatingCaseta.set(false);
          this.selectedOutbound.set(updated);
          this.svc.outboundsSignal.update((list) => list.map((o) => (o.id === ob.id ? updated : o)));
          this.showEditCasetaModal.set(false);
          this.toast.success('Ficha operativa actualizada exitosamente.');
          this.loadAuditLogs(ob.id);
        },
        error: () => {
          this.isUpdatingCaseta.set(false);
          this.selectedOutbound.set(updated);
          this.svc.outboundsSignal.update((list) => list.map((o) => (o.id === ob.id || o.folio === ob.folio ? updated : o)));
          this.showEditCasetaModal.set(false);
          this.toast.success('Ficha operativa actualizada.');
        },
      });
    } else {
      this.isUpdatingCaseta.set(false);
      this.selectedOutbound.set(updated);
      this.svc.outboundsSignal.update((list) => list.map((o) => (o.folio === ob.folio ? updated : o)));
      this.showEditCasetaModal.set(false);
      this.toast.success('Ficha operativa actualizada localmente.');
    }
  }

  // Índice de fase operativa activa en el Stepper (1 a 5)
  lifecycleStepIndex = computed(() => {
    const st = this.selectedOutbound()?.status;
    switch (st) {
      case 'REGISTERED': return 1;
      case 'ASSIGNED': return 2;
      case 'IN_PROGRESS': return 3;
      case 'LOADED': return 4;
      case 'COMPLETED': return 5;
      case 'CANCELLED': return -1;
      default: return 1;
    }
  });

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

  // ── MODAL CAMBIO DE NO. REMISIÓN / CARTA PORTE ──────────────────────────────
  showChangeRemisionModal = signal(false);
  newRemisionInput = signal('');
  changeRemisionReason = signal('');
  changeRemisionAdminUser = signal('');
  changeRemisionAdminPassword = signal('');
  changeRemisionError = signal<string | null>(null);
  showChangeRemisionPassword = signal(false);
  isChangingRemision = signal(false);

  openChangeRemisionModal(): void {
    const ob = this.selectedOutbound();
    this.newRemisionInput.set(ob?.remisionNo || '');
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

  toggleShowChangeRemisionPassword(): void {
    this.showChangeRemisionPassword.update((v) => !v);
  }

  confirmChangeRemision(): void {
    this.changeRemisionError.set(null);
    const newDoc = this.newRemisionInput().trim();
    const reason = this.changeRemisionReason().trim();
    const user = this.changeRemisionAdminUser().trim();
    const pass = this.changeRemisionAdminPassword().trim();
    const current = this.selectedOutbound();

    if (!current) return;

    if (!newDoc) {
      this.changeRemisionError.set('El nuevo número de remisión / carta porte es obligatorio.');
      return;
    }

    if (newDoc.toUpperCase() === (current.remisionNo || '').toUpperCase()) {
      this.changeRemisionError.set('El nuevo número de documento debe ser diferente al actual.');
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

    if (current.id && current.id.includes('-')) {
      this.movementsApi
        .changeOutboundRemision(current.id, {
          newDocNumber: newDoc,
          reason,
          adminUsername: user,
          adminPassword: pass,
        })
        .subscribe({
          next: () => {
            this.isChangingRemision.set(false);
            this.showChangeRemisionModal.set(false);

            const updated = this.svc.changeOutboundRemision(
              current.folio,
              newDoc,
              reason,
              adminLabel
            );
            if (updated) {
              this.selectedOutbound.set(updated);
            }
            this.loadAuditLogs(current.id || current.folio);
            this.toast.success(
              `Remisión / Carta Porte actualizada a '${newDoc}' y auditada en el sistema.`
            );
          },
          error: (err) => {
            this.isChangingRemision.set(false);
            const msg =
              err?.error?.message ||
              err?.message ||
              'Error al modificar remisión en el servidor. Verifica credenciales.';
            this.changeRemisionError.set(msg);
          },
        });
    } else {
      this.isChangingRemision.set(false);
      this.showChangeRemisionModal.set(false);
      const updated = this.svc.changeOutboundRemision(
        current.folio,
        newDoc,
        reason,
        adminLabel
      );
      if (updated) {
        this.selectedOutbound.set(updated);
      }
      this.toast.success(
        `Remisión / Carta Porte actualizada a '${newDoc}' localmente.`
      );
    }
  }

  // ── MODAL AUTORIZACIÓN DE DESPACHO (CIERRE FORMAL LOADED -> COMPLETED) ──────
  showAuthorizeModal = signal(false);
  authLeaderUser = signal('');
  authLeaderPassword = signal('');
  authLeaderError = signal<string | null>(null);
  showAuthLeaderPassword = signal(false);
  isAuthorizingDispatch = signal(false);

  openAuthorizeModal(): void {
    this.authLeaderUser.set('');
    this.authLeaderPassword.set('');
    this.authLeaderError.set(null);
    this.showAuthLeaderPassword.set(false);
    this.showAuthorizeModal.set(true);
  }

  closeAuthorizeModal(): void {
    this.showAuthorizeModal.set(false);
  }

  toggleShowAuthLeaderPassword(): void {
    this.showAuthLeaderPassword.update((v) => !v);
  }

  confirmAuthorizeDispatch(): void {
    const cur = this.selectedOutbound();
    if (!cur) return;

    const user = this.authLeaderUser().trim();
    const pass = this.authLeaderPassword().trim();

    if (!user || !pass) {
      this.authLeaderError.set('Ingresa usuario y contraseña de Líder / Supervisor de Almacén.');
      return;
    }

    this.isAuthorizingDispatch.set(true);
    this.authLeaderError.set(null);

    const adminUser = user.toLowerCase().includes('admin')
      ? 'Gerencia Operativa (Administrador)'
      : `${user} (Líder / Supervisor Autorizado)`;

    if (cur.id && cur.id.includes('-')) {
      this.movementsApi.updateOutbound(cur.id, {
        status: 'COMPLETED',
        observations: cur.observations || '',
      }).subscribe({
        next: () => {
          this.isAuthorizingDispatch.set(false);
          this.showAuthorizeModal.set(false);
          const updated = this.svc.completeOutboundDispatch(cur.id || cur.folio, adminUser);
          if (updated) {
            this.selectedOutbound.set(updated);
            this.lastCompletedOutbound.set(updated);
            this.loadAuditLogs(updated.id || updated.folio);
            this.showPrintPromptModal.set(true);
            this.toast.success(`Salida #${updated.folio} autorizada y cerrada exitosamente.`);
          }
        },
        error: (err) => {
          this.isAuthorizingDispatch.set(false);
          const msg = err?.error?.message || err?.message || 'Error al autorizar salida en el servidor.';
          this.authLeaderError.set(msg);
        }
      });
    } else {
      this.isAuthorizingDispatch.set(false);
      this.showAuthorizeModal.set(false);
      const updated = this.svc.completeOutboundDispatch(cur.id || cur.folio, adminUser);
      if (updated) {
        this.selectedOutbound.set(updated);
        this.lastCompletedOutbound.set(updated);
        this.loadAuditLogs(updated.id || updated.folio);
        this.showPrintPromptModal.set(true);
        this.toast.success(`Salida #${updated.folio} completada y autorizada formalmente.`);
      }
    }
  }

  getInitials(name?: string): string {
    if (!name) return 'OP';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  formatShift(shift?: string): string {
    if (!shift) return '--';
    const s = shift.toUpperCase();
    if (s.includes('MATUTINO') || s === 'FIRST' || s === '1') return 'Matutino (06:00 - 14:00)';
    if (s.includes('VESPERTINO') || s === 'SECOND' || s === '2') return 'Vespertino (14:00 - 22:00)';
    if (s.includes('NOCTURNO') || s === 'THIRD' || s === '3') return 'Nocturno (22:00 - 06:00)';
    if (s.includes('MIXTO')) return 'Mixto';
    return shift;
  }

  onRampMatrixClick(ramp: RampOccupancyStatus): void {
    if (ramp.status === 'OCCUPIED_OUTBOUND' && ramp.operationFolio) {
      const match = this.svc.outbounds().find((o) => o.folio === ramp.operationFolio || o.id === ramp.operationFolio);
      if (match) {
        this.selectOutboundItem(match);
      }
      this.showDockMapModal.set(false);
    } else if (ramp.status === 'AVAILABLE') {
      this.selectedRampNumber.set(ramp.rampNumber);
      this.toast.info(`Rampa ${ramp.rampNumber} seleccionada.`);
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
    if (occ.status === 'OCCUPIED_OUTBOUND') {
      return `${rm.name} (Ocupada - Salida #${occ.operationFolio})`;
    }
    return `${rm.name} (Ocupada - Folio #${occ.operationFolio})`;
  }

  // ── PASO 1: TRANSPORTE / DESTINO / SELLO ──────────────────────────────────
  currentStep = signal<1 | 2>(1);

  // Catálogos
  readonly carriers = this.svc.carrierLines;
  readonly clients = this.svc.clients;
  readonly transportTypes = TRANSPORT_TYPES;
  readonly allBatches = this.svc.inventoryBatches;

  // Catálogo completo de SKUs del servidor
  allCatalogSkus = signal<any[]>([]);

  // Selecciones Paso 1
  selectedClientCode = signal('');
  selectedDestinationId = signal('');
  selectedCarrierCode = signal('');
  driverName = signal('');
  economicNumber = signal('');
  boxEconomicNumber = signal('');
  tractorPlates = signal('');
  boxPlates = signal('');
  selectedTransportType = signal<TransportType | ''>('');
  sealNumber = signal('');

  // Filtro por Bahía de Origen (Paso 2)
  selectedOriginBayFilter = signal<string>('ALL');

  // Diálogo interactivo post-éxito: ¿Desea imprimir documento? (Sí/No)
  showPrintPromptModal = signal(false);
  lastCompletedOutbound = signal<WarehouseOutbound | null>(null);

  // Computed: Cliente seleccionado
  selectedClient = computed(() =>
    this.clients().find((c) => c.code === this.selectedClientCode()) || null
  );

  // Catálogo completo de destinos (desacoplado y reactivo)
  readonly allDestinations = this.svc.allDestinations;

  // Computed: Destinos disponibles (catálogo completo de plantas y centros de entrega)
  destinationsForClient = computed(() => this.allDestinations());

  // Computed: Destino seleccionado (resuelve tanto de la lista global como de específicos)
  selectedDestination = computed(() =>
    this.allDestinations().find((d) => d.id === this.selectedDestinationId()) || null
  );

  // Computed: Transportista seleccionado
  selectedCarrier = computed(() =>
    this.carriers().find((c) => c.code === this.selectedCarrierCode()) || null
  );

  // Validación Paso 1
  isStep1Valid = computed(() =>
    Boolean(
      this.selectedClientCode() &&
      this.selectedDestinationId() &&
      this.selectedCarrierCode() &&
      this.driverName()?.trim() &&
      this.selectedTransportType() &&
      this.tractorPlates()?.trim() &&
      this.boxPlates()?.trim()
    )
  );

  // ── PASO 2: ASIGNACIÓN DE MONTACARGUISTA ──────────────────────────────────
  isLoadingOperators = signal(false);
  selectedOperatorId = signal<string>('');
  operatorSearchQuery = signal<string>('');
  isOperatorDropdownOpen = signal<boolean>(false);

  forkliftOperators = computed<ForkliftOperatorOption[]>(() => {
    const adminOps = this.forkliftAdminService.activeOperators();
    if (adminOps && adminOps.length > 0) {
      return adminOps.map((op) => ({
        id: op.id,
        name: op.fullName,
        badge: op.code,
        jobTitle: op.jobTitle || 'Almacenista Montacargista',
        shift: op.shift || (op as any).shiftName || 'Matutino',
        status: op.status,
      }));
    }
    // Fallback inicial
    return [
      { id: '852584b7-37c7-4a5f-b4dc-c7b6097a9c51', name: 'Hector Villalva Ayala', badge: 'MC-001', jobTitle: 'Líder de Turno', shift: 'Turno Matutino CDMX', status: 'ACTIVO' },
      { id: 'b51345cb-bc76-4b3c-8386-d7595c14a83a', name: 'Alex Gabriel Perez Garduño', badge: 'MC-002', jobTitle: 'Líder de Turno', shift: 'Turno Matutino CDMX', status: 'ACTIVO' },
      { id: '401954d5-dcc8-48bb-8a17-48a68d31580b', name: 'Alfredo Ramirez Gonzalez', badge: 'MC-003', jobTitle: 'Líder de Turno', shift: 'Turno Matutino CDMX', status: 'ACTIVO' },
    ];
  });

  filteredForkliftOperators = computed(() => {
    const ops = this.forkliftOperators();
    const q = this.operatorSearchQuery().toLowerCase().trim();
    if (!q) return ops;
    return ops.filter(
      (op) =>
        op.name.toLowerCase().includes(q) ||
        op.badge.toLowerCase().includes(q) ||
        op.jobTitle.toLowerCase().includes(q)
    );
  });

  selectedOperator = computed<ForkliftOperatorOption | undefined>(() =>
    this.forkliftOperators().find((op) => op.id === this.selectedOperatorId())
  );

  getOperatorAvailability(op: ForkliftOperatorOption): {
    status: 'DISPONIBLE' | 'EN_OPERACION';
    label: string;
    dotClass: string;
    badgeClass: string;
  } {
    return {
      status: 'DISPONIBLE',
      label: 'Disponible',
      dotClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    };
  }

  onOperatorInput(val: string): void {
    this.operatorSearchQuery.set(val);
    this.isOperatorDropdownOpen.set(true);
    const exact = this.forkliftOperators().find(
      (o) => o.name.toLowerCase() === val.toLowerCase().trim()
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

  // ── PASO 2: MOTOR DE REGLA DE PABLO (FEFO) ────────────────────────────────
  calculateDaysRemaining(expirationDateStr?: string): number {
    if (!expirationDateStr) return 999;
    const exp = new Date(expirationDateStr);
    if (isNaN(exp.getTime())) return 999;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getPabloStatus(expirationDateStr?: string): {
    status: 'PABLO_ALERT' | 'OPTIMAL' | 'EXPIRED';
    label: string;
    color: 'amber' | 'emerald' | 'rose';
    isCritical: boolean;
    daysRemaining: number;
  } {
    const days = this.calculateDaysRemaining(expirationDateStr);
    if (days <= 0) {
      return {
        status: 'EXPIRED',
        label: 'Caduco / Bloqueado',
        color: 'rose',
        isCritical: true,
        daysRemaining: days,
      };
    }
    if (days <= 30) {
      return {
        status: 'PABLO_ALERT',
        label: `Alerta Pablo (${days}d)`,
        color: 'amber',
        isCritical: true,
        daysRemaining: days,
      };
    }
    return {
      status: 'OPTIMAL',
      label: `Óptimo (${days}d)`,
      color: 'emerald',
      isCritical: false,
      daysRemaining: days,
    };
  }

  // ── PASO 2: BUSCADOR PREDICTIVO DE PRODUCTOS / SKUS Y ESCÁNER DE UAS ───
  skuSearchQuery = signal<string>('');
  isSkuDropdownOpen = signal<boolean>(false);
  selectedSkuCode = signal<string>('');

  // Lotes disponibles en todo el almacén (sin restricción de cliente para búsqueda libre)
  availableBatches = computed(() => {
    return this.allBatches().filter((b) => b.availablePallets > 0);
  });

  // Catálogo completo consolidado de todos los clientes y stock activo
  availableCatalogSkus = computed<AvailableSkuOption[]>(() => {
    const batches = this.availableBatches();

    // Catálogo maestro multicliente
    const DEFAULT_CATALOG: Record<string, { code: string; name: string; category?: string; clientName: string }[]> = {
      'NESTLE': [
        { code: '8500297', name: 'NESCAFE CLASICO 5KG MX', category: 'CAFÉ Y BEBIDAS', clientName: 'Nestlé México' },
        { code: '12572733', name: 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1', category: 'CREMADORES', clientName: 'Nestlé México' },
        { code: '12448910', name: 'NESCAFE CLASICO FRASCO 12X200G N1', category: 'CAFÉ Y BEBIDAS', clientName: 'Nestlé México' },
        { code: '12389412', name: 'NESQUIK CHOCOLATE POLVO 12X357G', category: 'MODIFICADORES', clientName: 'Nestlé México' },
        { code: '12984711', name: 'CARNATION CLAVEL EVAPORADA 24X360G', category: 'LÁCTEOS', clientName: 'Nestlé México' },
        { code: '12003948', name: 'CHOCOLATE ABUELITA TABLETA 24X540G', category: 'CHOCOLATES', clientName: 'Nestlé México' },
      ],
      'LALA': [
        { code: '33019284', name: 'LECHE LALA ENTERA 12X1L TETRAPAK', category: 'LÁCTEOS', clientName: 'Grupo Lala' },
        { code: '33019285', name: 'LECHE LALA DESLACTOSADA 12X1L TETRAPAK', category: 'LÁCTEOS', clientName: 'Grupo Lala' },
        { code: '33020011', name: 'YOGURT LALA FRESA 24X220G', category: 'YOGURT', clientName: 'Grupo Lala' },
        { code: '33020055', name: 'QUESO MANCHEGO LALA 12X400G', category: 'QUESOS', clientName: 'Grupo Lala' },
      ],
      'BIMBO': [
        { code: '22019481', name: 'PAN BLANCO BIMBO GRANDE 680G', category: 'PANIFICACIÓN', clientName: 'Grupo Bimbo' },
        { code: '22019482', name: 'PAN INTEGRAL BIMBO 680G', category: 'PANIFICACIÓN', clientName: 'Grupo Bimbo' },
        { code: '22030119', name: 'DONAS BIMBO AZUCARADAS 12X105G', category: 'DULCES', clientName: 'Grupo Bimbo' },
        { code: '22030125', name: 'MANTECADAS BIMBO CON NUEZ 12X125G', category: 'PAN DULCE', clientName: 'Grupo Bimbo' },
      ],
      'PLASTICOS': [
        { code: '44019201', name: 'ENVASE PET 1L CRISTAL BOCA 28MM', category: 'ENVASES', clientName: 'Plásticos y Envases' },
        { code: '44019202', name: 'TAPA PLASTICA SEGURIDAD 28MM ROJA', category: 'TAPAS', clientName: 'Plásticos y Envases' },
        { code: '44019203', name: 'BIDON POLIETILENO 20L BLANCO INDUSTRIAL', category: 'INDUSTRIAL', clientName: 'Plásticos y Envases' },
      ],
      'ALPURA': [
        { code: '55019301', name: 'LECHE ALPURA CLASICA 12X1L', category: 'LÁCTEOS', clientName: 'Comercializadora Alpura' },
        { code: '55019302', name: 'CREMA ALPURA ACIDIFICADA 12X450ML', category: 'CREMAS', clientName: 'Comercializadora Alpura' },
        { code: '55019303', name: 'MANTEQUILLA ALPURA CON SAL 20X90G', category: 'LÁCTEOS', clientName: 'Comercializadora Alpura' },
      ],
    };

    // 1. Recopilar catálogo de la API o fallback
    const catalogList = this.allCatalogSkus();
    const matchedCatalog: { code: string; name: string; category?: string; clientName?: string }[] = [];

    if (catalogList && catalogList.length > 0) {
      for (const item of catalogList) {
        matchedCatalog.push({
          code: String(item.code || item.sku || item.id).trim(),
          name: item.name || item.description || item.code,
          category: item.category || 'CATÁLOGO',
          clientName: item.clientName || 'Catálogo General',
        });
      }
    }

    // Agregar todos los productos por defecto de todos los clientes
    for (const items of Object.values(DEFAULT_CATALOG)) {
      for (const it of items) {
        if (!matchedCatalog.some((c) => c.code === it.code)) {
          matchedCatalog.push(it);
        }
      }
    }

    // 2. Mapear inventario activo por SKU code
    const inventoryMap = new Map<string, { pallets: number; pieces: number; nearestExp: string; daysRemaining: number; pablo: any }>();
    for (const b of batches) {
      const code = String(b.productId || 'SKU-GENERIC').trim();
      const pablo = this.getPabloStatus(b.expirationDate);
      const existing = inventoryMap.get(code);
      if (!existing) {
        inventoryMap.set(code, {
          pallets: b.availablePallets,
          pieces: b.totalPieces,
          nearestExp: b.expirationDate,
          daysRemaining: pablo.daysRemaining,
          pablo: pablo,
        });
      } else {
        existing.pallets += b.availablePallets;
        existing.pieces += b.totalPieces;
        if (pablo.daysRemaining < existing.daysRemaining) {
          existing.nearestExp = b.expirationDate;
          existing.daysRemaining = pablo.daysRemaining;
          existing.pablo = pablo;
        }
      }
    }

    // 3. Consolidar todos los productos del catálogo
    const resultSkus: AvailableSkuOption[] = [];
    const processedCodes = new Set<string>();

    for (const cat of matchedCatalog) {
      const code = cat.code;
      if (processedCodes.has(code)) continue;
      processedCodes.add(code);

      const inv = inventoryMap.get(code);
      if (inv && inv.pallets > 0) {
        resultSkus.push({
          skuCode: code,
          productName: cat.name,
          category: cat.category || 'GENERAL',
          clientName: cat.clientName || 'General',
          totalAvailablePallets: inv.pallets,
          totalAvailablePieces: inv.pieces,
          batchesCount: 1,
          nearestExpirationDate: inv.nearestExp,
          pabloStatus: inv.pablo.status,
          pabloLabel: inv.pablo.label,
          pabloColor: inv.pablo.color,
          daysRemaining: inv.daysRemaining,
        });
      } else {
        // Producto sin stock
        resultSkus.push({
          skuCode: code,
          productName: cat.name,
          category: cat.category || 'GENERAL',
          clientName: cat.clientName || 'General',
          totalAvailablePallets: 0,
          totalAvailablePieces: 0,
          batchesCount: 0,
          nearestExpirationDate: '',
          pabloStatus: 'OPTIMAL',
          pabloLabel: '0 tarimas',
          pabloColor: 'emerald',
          daysRemaining: 999,
        });
      }
    }

    // 4. Agregar cualquier batch en inventario cuyo SKU no estuviera explícitamente en el catálogo
    for (const b of batches) {
      const code = String(b.productId || 'SKU-GENERIC').trim();
      if (!processedCodes.has(code)) {
        processedCodes.add(code);
        const pablo = this.getPabloStatus(b.expirationDate);
        resultSkus.push({
          skuCode: code,
          productName: b.productName || 'Producto General',
          category: (b as any).category || 'GENERAL',
          clientName: (b as any).clientName || b.client || 'General',
          totalAvailablePallets: b.availablePallets,
          totalAvailablePieces: b.totalPieces,
          batchesCount: 1,
          nearestExpirationDate: b.expirationDate,
          pabloStatus: pablo.status,
          pabloLabel: pablo.label,
          pabloColor: pablo.color,
          daysRemaining: pablo.daysRemaining,
        });
      }
    }

    // Ordenar: Productos con stock primero (ordenados por FEFO / menor daysRemaining), y luego productos sin stock por nombre
    return resultSkus.sort((a, b) => {
      if (a.totalAvailablePallets > 0 && b.totalAvailablePallets === 0) return -1;
      if (a.totalAvailablePallets === 0 && b.totalAvailablePallets > 0) return 1;
      if (a.totalAvailablePallets > 0 && b.totalAvailablePallets > 0) {
        return a.daysRemaining - b.daysRemaining;
      }
      return a.productName.localeCompare(b.productName);
    });
  });

  // Alias para mantener compatibilidad con la vista
  availableSkusForClient = computed<AvailableSkuOption[]>(() => this.availableCatalogSkus());

  inStockSkusCount = computed(() =>
    this.availableCatalogSkus().filter((s) => s.totalAvailablePallets > 0).length
  );

  // Lista plana de todas las tarimas físicas (UAs) en inventario para escaneo instantáneo
  allFlatPalletsInWarehouse = computed<OutboundPalletItem[]>(() => {
    const batches = this.availableBatches();
    const list: OutboundPalletItem[] = [];
    for (const b of batches) {
      let pos = 1;
      for (const p of b.pallets || []) {
        const expDate = p.expirationDate || b.expirationDate;
        const pablo = this.getPabloStatus(expDate);
        list.push({
          id: p.id,
          palletCode: p.palletCode,
          palletNumber: pos++,
          productId: p.productId || b.productId,
          description: p.description || b.productName,
          clientName: (b as any).clientName || b.client || 'General',
          lotNumber: p.lotNumber || b.lotNumber,
          remisionNo: b.remisionNo,
          expirationDate: expDate,
          pieces: p.pieces,
          palletTypeId: p.palletTypeId || 'MADERA_ESTANDAR',
          palletTypeLabel: p.palletTypeLabel || 'Madera Estándar',
          locationCode: p.locationCode || b.locationCode || 'A-01-N1',
          daysRemaining: pablo.daysRemaining,
          pabloStatus: pablo.status,
          pabloLabel: pablo.label,
          pabloColor: pablo.color,
          isSuggestedFefo: false,
        });
      }
    }
    return list;
  });

  // Tarimas coincidentes por código de UA / SSCC o Lote para la búsqueda predictiva
  matchingPalletUas = computed<OutboundPalletItem[]>(() => {
    const q = this.skuSearchQuery().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return this.allFlatPalletsInWarehouse().filter(
      (p) =>
        p.palletCode.toLowerCase().includes(q) ||
        p.lotNumber.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  filteredAvailableSkus = computed(() => {
    const skus = this.availableCatalogSkus();
    const q = this.skuSearchQuery().toLowerCase().trim();
    if (!q) return skus;

    // Si el texto del buscador coincide exactamente con el producto actualmente seleccionado, mostrar todo el catálogo
    const current = this.selectedSku();
    if (current && `${current.skuCode} — ${current.productName}`.toLowerCase() === q) {
      return skus;
    }

    return skus.filter(
      (s) =>
        s.skuCode.toLowerCase().includes(q) ||
        s.productName.toLowerCase().includes(q) ||
        (s.clientName && s.clientName.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        `${s.skuCode} — ${s.productName}`.toLowerCase().includes(q)
    );
  });

  selectedSku = computed<AvailableSkuOption | undefined>(() =>
    this.availableCatalogSkus().find((s) => s.skuCode === this.selectedSkuCode())
  );

  onSkuInput(val: string): void {
    this.skuSearchQuery.set(val);
    this.isSkuDropdownOpen.set(true);

    // Si el usuario borró todo el texto manualmente, resetear solo el foco del SKU activo (no el manifiesto)
    if (!val.trim()) {
      this.selectedSkuCode.set('');
      this.requestedPalletsCount.set(0);
      return;
    }

    const exact = this.availableCatalogSkus().find(
      (s) =>
        s.skuCode.toLowerCase() === val.toLowerCase().trim() ||
        s.productName.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectedSkuCode.set(exact.skuCode);
      this.requestedPalletsCount.set(this.selectedPalletsCountForCurrentSku());
    }
  }

  onSkuInputFocus(): void {
    this.isSkuDropdownOpen.set(true);
  }

  // Manejo de lectura con pistola de código de barras / tablet / teclado
  handleScannerOrSearchSubmit(): void {
    const rawVal = this.skuSearchQuery().trim();
    if (!rawVal) return;

    const val = rawVal.toLowerCase();

    // 1. Buscar si coincide exactamente con una UA / Código de tarima física
    const matchingPallet = this.allFlatPalletsInWarehouse().find(
      (p) => p.palletCode.toLowerCase() === val || p.palletCode.toLowerCase().endsWith(val)
    );

    if (matchingPallet) {
      this.selectPalletByUa(matchingPallet);
      return;
    }

    // 2. Buscar coincidencia exacta por SKU Code
    const matchingSku = this.availableCatalogSkus().find(
      (s) =>
        s.skuCode.toLowerCase() === val ||
        s.productName.toLowerCase() === val
    );

    if (matchingSku) {
      this.selectSku(matchingSku);
      return;
    }

    // 3. Si hay un solo resultado de producto filtrado, seleccionarlo
    const filtered = this.filteredAvailableSkus();
    if (filtered.length === 1) {
      this.selectSku(filtered[0]);
      return;
    }

    // Si hay una sola UA coincidente, seleccionarla
    const uas = this.matchingPalletUas();
    if (uas.length === 1) {
      this.selectPalletByUa(uas[0]);
      return;
    }

    // Abrir dropdown si hay opciones
    this.isSkuDropdownOpen.set(true);
  }

  selectPalletByUa(pallet: OutboundPalletItem): void {
    // Añadir la tarima directamente al carro acumulado del manifiesto sin forzar el banner de producto ni tabla de inventario
    if (!this.selectedPalletIds().includes(pallet.id)) {
      this.selectedPalletIds.update((ids) => [...ids, pallet.id]);
      this.toast.success(
        `⚡ Tarima [UA: ${pallet.palletCode}] agregada directamente al manifiesto (${pallet.description || pallet.productId} · ${pallet.pieces} pz).`
      );
    } else {
      this.toast.info(`La tarima [UA: ${pallet.palletCode}] ya está en el manifiesto.`);
    }

    // Limpiar el campo de escáner y resetear SKU enfocado para que no abra el banner ni la tabla
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.isSkuDropdownOpen.set(false);
  }

  selectSku(sku: AvailableSkuOption): void {
    this.selectedSkuCode.set(sku.skuCode);
    this.skuSearchQuery.set(`${sku.skuCode} — ${sku.productName}`);
    this.isSkuDropdownOpen.set(false);
    this.fefoQuantityInput.set(1);
  }

  clearSkuSelection(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.requestedPalletsCount.set(0);
    this.isSkuDropdownOpen.set(true);
  }

  // ── PASO 2: TARIMAS / PALLETS CON MOTOR FEFO Y BUSCADOR RÁPIDO POR UA ──
  selectedPalletIds = signal<string[]>([]);
  fefoQuantityInput = signal<number>(1);
  requestedPalletsCount = signal<number>(0);
  palletTableSearchQuery = signal<string>('');

  onPalletTableSearchInput(val: string): void {
    this.palletTableSearchQuery.set(val);
  }

  clearPalletTableSearch(): void {
    this.palletTableSearchQuery.set('');
  }

  // Cantidad de tarimas seleccionadas para el SKU que está enfocado actualmente
  selectedPalletsCountForCurrentSku = computed(() => {
    const sku = this.selectedSkuCode();
    if (!sku) return this.selectedPalletIds().length;
    const selectedSet = new Set(this.selectedPalletIds());
    return this.allFlatPalletsInWarehouse().filter(
      (p) => p.productId === sku && selectedSet.has(p.id)
    ).length;
  });

  availablePalletsCountForCurrentSku = computed(() => {
    const sku = this.selectedSkuCode();
    if (!sku) return this.allFlatPalletsInWarehouse().length;
    return this.allFlatPalletsInWarehouse().filter((p) => p.productId === sku).length;
  });

  maxAvailablePalletsForCurrentSku = computed(() => {
    const sku = this.selectedSkuCode();
    const all = this.allFlatPalletsInWarehouse();
    const selectedSet = new Set(this.selectedPalletIds());
    if (sku) {
      return all.filter((p) => p.productId === sku && p.pabloStatus !== 'EXPIRED' && !selectedSet.has(p.id)).length;
    }
    return all.filter((p) => p.pabloStatus !== 'EXPIRED' && !selectedSet.has(p.id)).length;
  });

  incrementFefoQuantity(): void {
    const max = this.maxAvailablePalletsForCurrentSku();
    const cur = this.fefoQuantityInput();
    if (cur < max) {
      this.fefoQuantityInput.set(cur + 1);
    }
  }

  decrementFefoQuantity(): void {
    const cur = this.fefoQuantityInput();
    if (cur > 1) {
      this.fefoQuantityInput.set(cur - 1);
    }
  }

  onFefoQuantityInput(val: number): void {
    const max = this.maxAvailablePalletsForCurrentSku();
    const clamped = isNaN(val) ? 1 : Math.max(1, Math.min(val, Math.max(1, max)));
    this.fefoQuantityInput.set(clamped);
  }

  allAvailablePalletsForCurrentView = computed<OutboundPalletItem[]>(() => {
    const batches = this.availableBatches();
    const targetSku = this.selectedSkuCode();
    const tableSearch = this.palletTableSearchQuery().toLowerCase().trim();
    const selectedSet = new Set(this.selectedPalletIds());

    const filteredBatches = targetSku
      ? batches.filter((b) => b.productId === targetSku)
      : batches;

    const palletsList: OutboundPalletItem[] = [];

    for (const b of filteredBatches) {
      let pos = 1;
      for (const p of b.pallets || []) {
        // Excluir tarimas que ya están en el manifiesto de salida
        if (selectedSet.has(p.id)) {
          pos++;
          continue;
        }

        const expDate = p.expirationDate || b.expirationDate;
        const pablo = this.getPabloStatus(expDate);
        const loc = p.locationCode || b.locationCode || 'A-01-N1';
        const palletCode = p.palletCode || '';
        const lotNumber = p.lotNumber || b.lotNumber || '';
        const desc = p.description || b.productName || '';
        const rem = b.remisionNo || '';

        const matchesSearch =
          !tableSearch ||
          palletCode.toLowerCase().includes(tableSearch) ||
          lotNumber.toLowerCase().includes(tableSearch) ||
          rem.toLowerCase().includes(tableSearch) ||
          desc.toLowerCase().includes(tableSearch) ||
          loc.toLowerCase().includes(tableSearch) ||
          String(pos).includes(tableSearch);

        if (matchesSearch) {
          palletsList.push({
            id: p.id,
            palletCode: palletCode,
            palletNumber: pos,
            productId: p.productId || b.productId,
            description: desc,
            clientName: (b as any).clientName || b.client || 'General',
            lotNumber: lotNumber,
            remisionNo: rem,
            expirationDate: expDate,
            pieces: p.pieces,
            palletTypeId: p.palletTypeId || 'MADERA_ESTANDAR',
            palletTypeLabel: p.palletTypeLabel || 'Madera Estándar',
            locationCode: loc,
            daysRemaining: pablo.daysRemaining,
            pabloStatus: pablo.status,
            pabloLabel: pablo.label,
            pabloColor: pablo.color,
            isSuggestedFefo: false,
          });
        }
        pos++;
      }
    }

    // Ordenamiento FEFO estricto (menor días restantes primero)
    palletsList.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Marcar como sugeridos FEFO los primeros que no estén caducos
    let fefoCount = 0;
    for (const p of palletsList) {
      if (p.pabloStatus !== 'EXPIRED' && fefoCount < 5) {
        p.isSuggestedFefo = true;
        fefoCount++;
      }
    }

    return palletsList;
  });

  maxAvailablePallets = computed(() => {
    return this.allAvailablePalletsForCurrentView().filter(
      (p) => p.pabloStatus !== 'EXPIRED'
    ).length;
  });

  // Agregar tarimas estrictamente del producto seleccionado por FEFO acumulando en el carro
  addFefoPalletsForCurrentSku(count?: number): void {
    const sku = this.selectedSkuCode();
    const all = this.allFlatPalletsInWarehouse();
    const selectedSet = new Set(this.selectedPalletIds());

    const pool = all.filter((p) => {
      const matchSku = !sku || p.productId === sku;
      const notExpired = p.pabloStatus !== 'EXPIRED';
      const notSelected = !selectedSet.has(p.id);
      return matchSku && notExpired && notSelected;
    });

    pool.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const qty = count !== undefined ? count : this.fefoQuantityInput();
    const clamped = Math.max(1, Math.min(qty, pool.length));

    if (pool.length === 0) {
      this.toast.info('No hay tarimas disponibles pendientes de agregar para este producto.');
      return;
    }

    const toAdd = pool.slice(0, clamped);
    const toAddIds = toAdd.map((p) => p.id);

    this.selectedPalletIds.update((ids) => [...ids, ...toAddIds]);

    const skuLabel = this.selectedSku()?.productName || sku || 'Producto';
    this.toast.success(
      `⚡ ${toAdd.length} tarima(s) de [${skuLabel}] agregadas al manifiesto por FEFO.`
    );
    const remaining = pool.length - toAdd.length;
    this.fefoQuantityInput.set(Math.min(this.fefoQuantityInput(), Math.max(1, remaining)));
  }

  addAllPalletsForCurrentSku(): void {
    const unselected = this.allAvailablePalletsForCurrentView();
    if (unselected.length === 0) {
      this.toast.info('Todas las tarimas disponibles ya están en el manifiesto.');
      return;
    }
    const toAddIds = unselected.map((p) => p.id);
    this.selectedPalletIds.update((ids) => Array.from(new Set([...ids, ...toAddIds])));
    this.toast.success(`Se agregaron ${toAddIds.length} tarima(s) al manifiesto de salida.`);
    this.fefoQuantityInput.set(1);
  }

  addFefoSuggestedPallets(): void {
    this.addFefoPalletsForCurrentSku();
  }

  // Agrega o quita una tarima individual del manifiesto
  addPalletToManifest(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const pallet = this.allFlatPalletsInWarehouse().find((p) => p.id === id);
    if (!this.selectedPalletIds().includes(id)) {
      this.selectedPalletIds.update((ids) => [...ids, id]);
      if (pallet) {
        this.toast.success(`Tarima [UA: ${pallet.palletCode}] agregada al manifiesto.`);
      }
    } else {
      this.selectedPalletIds.update((ids) => ids.filter((x) => x !== id));
      if (pallet) {
        this.toast.info(`Tarima [UA: ${pallet.palletCode}] removida del manifiesto.`);
      }
    }
  }

  togglePallet(id: string): void {
    this.selectedPalletIds.update((ids) => {
      const exists = ids.includes(id);
      const updated = exists ? ids.filter((x) => x !== id) : [...ids, id];
      return updated;
    });
    this.requestedPalletsCount.set(this.selectedPalletsCountForCurrentSku());
  }

  toggleAllPallets(): void {
    const viewPallets = this.allAvailablePalletsForCurrentView();
    const viewIds = viewPallets.map((p) => p.id);
    const selectedSet = new Set(this.selectedPalletIds());
    const allViewSelected = viewIds.length > 0 && viewIds.every((id) => selectedSet.has(id));

    this.selectedPalletIds.update((ids) => {
      if (allViewSelected) {
        const viewIdsSet = new Set(viewIds);
        return ids.filter((id) => !viewIdsSet.has(id));
      } else {
        const combined = new Set([...ids, ...viewIds]);
        return Array.from(combined);
      }
    });
    this.requestedPalletsCount.set(this.selectedPalletsCountForCurrentSku());
  }

  isPalletSelected(id: string): boolean {
    return this.selectedPalletIds().includes(id);
  }

  areAllPalletsSelected(): boolean {
    const viewPallets = this.allAvailablePalletsForCurrentView();
    if (viewPallets.length === 0) return false;
    const selectedSet = new Set(this.selectedPalletIds());
    return viewPallets.every((p) => selectedSet.has(p.id));
  }

  // Remueve una tarima individual del manifiesto acumulado
  removePalletFromManifest(id: string): void {
    const pallet = this.allFlatPalletsInWarehouse().find((p) => p.id === id);
    this.selectedPalletIds.update((ids) => ids.filter((x) => x !== id));
    this.requestedPalletsCount.set(this.selectedPalletsCountForCurrentSku());
    if (pallet) {
      this.toast.info(`Tarima [UA: ${pallet.palletCode}] removida del manifiesto.`);
    }
  }

  // Remueve todas las tarimas de un SKU del manifiesto
  removeSkuFromManifest(skuCode: string): void {
    const skuPalletIds = new Set(
      this.allFlatPalletsInWarehouse()
        .filter((p) => p.productId === skuCode)
        .map((p) => p.id)
    );
    this.selectedPalletIds.update((ids) => ids.filter((id) => !skuPalletIds.has(id)));
    this.requestedPalletsCount.set(this.selectedPalletsCountForCurrentSku());
    this.toast.info(`Todas las tarimas del SKU ${skuCode} han sido removidas del manifiesto.`);
  }

  // Vacía todo el manifiesto consolidado
  clearAllManifest(): void {
    this.selectedPalletIds.set([]);
    this.requestedPalletsCount.set(0);
    this.toast.info('Manifiesto de salida vaciado.');
  }

  // Convierte los pallets seleccionados de todo el almacén a OutboundItems
  selectedPalletItems = computed<OutboundItem[]>(() => {
    const ids = new Set(this.selectedPalletIds());
    const all = this.allFlatPalletsInWarehouse();
    return all
      .filter((p) => ids.has(p.id))
      .map((p) => ({
        id: p.id,
        palletCode: p.palletCode,
        productId: p.productId,
        description: p.description,
        clientName: p.clientName,
        inboundRemisionNo: p.remisionNo,
        lotNumber: p.lotNumber,
        expirationDate: p.expirationDate,
        pieces: p.pieces,
        palletTypeId: p.palletTypeId,
        palletTypeLabel: p.palletTypeLabel,
        locationCode: p.locationCode,
        palletNumber: p.palletNumber,
        pabloStatus: p.pabloStatus,
      }));
  });

  // Manifiesto agrupado por producto / SKU con subtotales
  manifestGroupedBySku = computed(() => {
    const items = this.selectedPalletItems();
    const map = new Map<string, {
      skuCode: string;
      productName: string;
      clientName?: string;
      totalPallets: number;
      totalPieces: number;
      items: OutboundItem[];
    }>();

    for (const it of items) {
      const key = it.productId;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          skuCode: it.productId,
          productName: it.description,
          clientName: it.clientName,
          totalPallets: 1,
          totalPieces: it.pieces,
          items: [it],
        });
      } else {
        existing.totalPallets += 1;
        existing.totalPieces += it.pieces;
        existing.items.push(it);
      }
    }

    return Array.from(map.values());
  });

  totalSelectedPallets = computed(() => this.selectedPalletItems().length);
  totalSelectedPieces = computed(() =>
    this.selectedPalletItems().reduce((acc, p) => acc + p.pieces, 0)
  );
  distinctSkusCount = computed(() => {
    const items = this.selectedPalletItems();
    return new Set(items.map((i) => i.productId)).size;
  });
  readonly totalSelectedSkus = this.distinctSkusCount;
  totalLotesInManifest = computed(() => {
    const items = this.selectedPalletItems();
    return new Set(items.map((i) => i.lotNumber)).size;
  });

  allInboundRemisionesInManifest = computed<string[]>(() => {
    const items = this.selectedPalletItems();
    const rems = new Set<string>();
    for (const it of items) {
      if (it.inboundRemisionNo && it.inboundRemisionNo.trim()) {
        rems.add(it.inboundRemisionNo.trim());
      }
    }
    return Array.from(rems);
  });

  primaryRemisionNo = computed(() => {
    const rems = this.allInboundRemisionesInManifest();
    if (rems.length === 1) return rems[0];
    if (rems.length > 1) return `${rems.length} remisiones (${rems.slice(0, 2).join(', ')}${rems.length > 2 ? '...' : ''})`;
    return '--';
  });

  // Validación de Paso 2
  isStep2Valid = computed(() =>
    !!this.selectedOperator() && this.selectedPalletItems().length > 0
  );

  canConfirm = computed(() =>
    this.isStep1Valid() && this.isStep2Valid()
  );



  // Guardar Pre-Salida en Caseta (Fase 1: REGISTERED)
  saveCasetaPreRegistration(): void {
    if (!this.selectedClientCode() || !this.selectedDestinationId() || !this.selectedCarrierCode() || !this.driverName()?.trim() || !this.tractorPlates()?.trim() || !this.boxPlates()?.trim()) {
      this.toast.warning('Por favor completa los datos del transporte y chofer.');
      return;
    }

    const carrier = this.selectedCarrier();
    const client = this.selectedClient();
    const dest = this.selectedDestination();
    const session = this.movementsApi.getSessionOrg();
    const folio = `SAL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const remisionNo = `REM-${folio}`;

    const clientId = (client && client.code && client.code.includes('-')) 
      ? client.code 
      : 'c73f0907-9fa5-4bdf-87db-2eb5e7683938';

    const destinationId = (dest && dest.id && dest.id.includes('-')) ? dest.id : null;
    const carrierId = (carrier && carrier.code && carrier.code.includes('-')) ? carrier.code : null;

    const payload: any = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      clientId: clientId,
      destinationId: destinationId,
      destinationName: dest ? dest.name : '',
      destinationAddress: dest ? (dest.address ? `${dest.address}, ${dest.city || ''} ${dest.state || ''}`.trim() : '') : '',
      carrierId: carrierId,
      carrierName: carrier ? carrier.name : '',
      transportType: (this.selectedTransportType() || 'TRAILER') as TransportType,
      driverName: this.driverName(),
      economicNumber: this.economicNumber() || '',
      boxEconomicNumber: this.boxEconomicNumber() || '',
      tractorPlates: this.tractorPlates(),
      boxPlates: this.boxPlates(),
      sealNumber: this.sealNumber() || '',
      remisionNo: remisionNo,
      status: 'REGISTERED',
      rampNumber: this.selectedRampNumber(),
      observations: this.observations() || '',
      selectedItemIds: [],
    };

    this.isExecuting.set(true);
    this.movementsApi.createOutbound(payload).subscribe({
      next: (res: any) => {
        this.isExecuting.set(false);
        const result: WarehouseOutbound = {
          id: res.id,
          folio: res.folio || folio,
          status: 'REGISTERED',
          clientCode: res.clientId || this.selectedClientCode(),
          clientName: res.clientName || client?.name || '',
          destinationId: res.destinationId || this.selectedDestinationId(),
          destinationName: res.destinationName || dest?.name || '',
          destinationAddress: res.destinationAddress || (dest ? `${dest.address}, ${dest.city}, ${dest.state}` : ''),
          carrierCode: res.carrierId || this.selectedCarrierCode(),
          carrierName: res.carrierName || carrier?.name || '',
          rampNumber: this.selectedRampNumber(),
          rampCode: `RAMPA-${this.selectedRampNumber()}`,
          driverName: this.driverName(),
          economicNumber: this.economicNumber() || '',
          boxEconomicNumber: this.boxEconomicNumber() || '',
          tractorPlates: this.tractorPlates(),
          boxPlates: this.boxPlates(),
          transportType: (res.transportType || this.selectedTransportType()) as TransportType,
          sealNumber: this.sealNumber() || '',
          remisionNo: res.remisionNo || remisionNo,
          observations: this.observations() || '',
          items: [],
          totalPallets: 0,
          totalPieces: 0,
          distinctSkus: 0,
          dispatchedAt: '',
          dispatchedBy: this.authState.userFullName() || 'Caseta de Seguridad',
          timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };

        this.svc.outboundsSignal.update((list) => [result, ...list]);
        this.selectedOutbound.set(result);
        this.formMode.set('detail');
        this.loadAuditLogs(result.id || result.folio);
        this.toast.success(`Pre-registro de salida #${result.folio} registrado exitosamente.`);
      },
      error: () => {
        this.isExecuting.set(false);
        // Local fallback
        const result: WarehouseOutbound = {
          id: 'out-' + Date.now(),
          folio,
          status: 'REGISTERED',
          clientCode: this.selectedClientCode(),
          clientName: client?.name || 'Cliente',
          destinationId: this.selectedDestinationId(),
          destinationName: dest?.name || 'Destino',
          destinationAddress: dest ? `${dest.address}, ${dest.city}, ${dest.state}` : '',
          carrierCode: this.selectedCarrierCode(),
          carrierName: carrier?.name || 'Transportista',
          rampNumber: this.selectedRampNumber(),
          rampCode: `RAMPA-${this.selectedRampNumber()}`,
          driverName: this.driverName(),
          economicNumber: this.economicNumber(),
          boxEconomicNumber: this.boxEconomicNumber(),
          tractorPlates: this.tractorPlates(),
          boxPlates: this.boxPlates(),
          transportType: (this.selectedTransportType() || 'TRAILER') as TransportType,
          sealNumber: this.sealNumber() || '',
          remisionNo: remisionNo,
          observations: this.observations(),
          items: [],
          totalPallets: 0,
          totalPieces: 0,
          distinctSkus: 0,
          dispatchedAt: '',
          dispatchedBy: this.authState.userFullName() || 'Caseta de Seguridad',
          timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };
        this.svc.outboundsSignal.update((list) => [result, ...list]);
        this.selectedOutbound.set(result);
        this.formMode.set('detail');
        this.loadAuditLogs(result.folio);
        this.toast.success(`Pre-registro de salida #${result.folio} registrado.`);
      }
    });
  }

  // Transición 1 -> 2: Asignar Rampa y Montacarguista (REGISTERED -> ASSIGNED)
  assignRampAndOperatorAction(): void {
    const cur = this.selectedOutbound();
    if (!cur) return;
    const operator = this.selectedOperator();
    const opName = operator?.name || this.operatorSearchQuery() || 'Montacarguista';
    const opId = operator?.id || '';
    const rampNum = this.selectedRampNumber() || cur.rampNumber || 1;
    const user = this.authState.userFullName() || 'Administrador WMS';

    const updated = this.svc.assignOutboundRamp(cur.id || cur.folio, rampNum, opId, opName, user, this.observations());
    if (updated) {
      this.selectedOutbound.set(updated);
      this.loadAuditLogs(updated.id || updated.folio);
      this.toast.success(`Salida #${updated.folio} asignada a Rampa ${rampNum} y despachada a terminal de ${opName}.`);
    }
  }

  // Transición 2 -> 3: Iniciar Carga (ASSIGNED -> IN_PROGRESS)
  startOutboundLoadingAction(): void {
    const cur = this.selectedOutbound();
    if (!cur) return;
    const opName = cur.forkliftOperator || this.authState.userFullName() || 'Montacarguista';

    const updated = this.svc.startOutboundLoading(cur.id || cur.folio, opName);
    if (updated) {
      this.selectedOutbound.set(updated);
      this.loadAuditLogs(updated.id || updated.folio);
      this.toast.success(`Carga iniciada en andén para salida #${updated.folio}.`);
    }
  }

  // Transición 3 -> 4: Finalizar Carga Física (IN_PROGRESS -> LOADED)
  finishOutboundLoadingAction(): void {
    const cur = this.selectedOutbound();
    if (!cur) return;
    const seals = this.sealNumber() || cur.sealNumber;
    if (!seals || !seals.trim()) {
      this.toast.warning('Debes capturar el número de sello o precinto colocado en las puertas de la caja.');
      return;
    }

    const items = this.selectedPalletItems().length > 0 ? this.selectedPalletItems() : cur.items;
    if (!items || items.length === 0) {
      this.toast.warning('Debes escanear o seleccionar al menos 1 tarima cargada.');
      return;
    }

    const opName = cur.forkliftOperator || this.authState.userFullName() || 'Montacarguista';
    const updated = this.svc.finishOutboundLoading(cur.id || cur.folio, seals, opName, items);
    if (updated) {
      this.selectedOutbound.set(updated);
      this.loadAuditLogs(updated.id || updated.folio);
      this.toast.success(`Carga física finalizada y sellos registrados para #${updated.folio}. Listo para auditoría.`);
    }
  }

  // Transición 4 -> 5: Cierre Administrativo y Despacho Formal F03 (LOADED -> COMPLETED)
  completeOutboundAction(): void {
    const cur = this.selectedOutbound();
    if (!cur) return;
    const adminUser = this.authState.userFullName() || 'Supervisor / Administrador';

    const updated = this.svc.completeOutboundDispatch(cur.id || cur.folio, adminUser);
    if (updated) {
      this.selectedOutbound.set(updated);
      this.lastCompletedOutbound.set(updated);
      this.loadAuditLogs(updated.id || updated.folio);
      this.showPrintPromptModal.set(true);
      this.toast.success(`Salida #${updated.folio} completada y autorizada formalmente.`);
    }
  }

  // Filtros Multi-Estado Píldoras
  activeStatusFilters = signal<string[]>([]);

  toggleStatusFilter(status: string): void {
    if (status === 'ALL') {
      this.activeStatusFilters.set([]);
      this.statusFilter.set('ALL');
      return;
    }
    const current = this.activeStatusFilters();
    if (current.includes(status)) {
      const updated = current.filter(s => s !== status);
      this.activeStatusFilters.set(updated);
      this.statusFilter.set(updated.length === 1 ? updated[0] : (updated.length === 0 ? 'ALL' : 'MULTI'));
    } else {
      const updated = [...current, status];
      this.activeStatusFilters.set(updated);
      this.statusFilter.set(updated.length === 1 ? updated[0] : 'MULTI');
    }
  }

  isStatusFilterActive(status: string): boolean {
    if (status === 'ALL') return this.activeStatusFilters().length === 0;
    return this.activeStatusFilters().includes(status);
  }

  getOutboundPhaseInfo(status: string): {
    phaseNumber: number;
    phaseLabel: string;
    percentage: number;
    colorClass: string;
    progressWidth: string;
  } {
    switch (status) {
      case 'REGISTERED':
        return { phaseNumber: 1, phaseLabel: '1. Caseta · Pre-registro', percentage: 20, colorClass: 'fill--amber', progressWidth: '20%' };
      case 'ASSIGNED':
        return { phaseNumber: 2, phaseLabel: '2. Asignación Rampa & MC', percentage: 40, colorClass: 'fill--blue', progressWidth: '40%' };
      case 'IN_PROGRESS':
        return { phaseNumber: 3, phaseLabel: '3. En Carga RF Andén', percentage: 60, colorClass: 'fill--cyan', progressWidth: '60%' };
      case 'LOADED':
        return { phaseNumber: 4, phaseLabel: '4. Por Auditar · Carga Lista', percentage: 80, colorClass: 'fill--purple', progressWidth: '80%' };
      case 'COMPLETED':
        return { phaseNumber: 5, phaseLabel: '5. Despachada / Cerrada', percentage: 100, colorClass: 'fill--emerald', progressWidth: '100%' };
      case 'CANCELLED':
        return { phaseNumber: 0, phaseLabel: 'Cancelada / Revocada', percentage: 100, colorClass: 'fill--rose', progressWidth: '100%' };
      default:
        return { phaseNumber: 1, phaseLabel: '1. Caseta · Pre-registro', percentage: 20, colorClass: 'fill--amber', progressWidth: '20%' };
    }
  }

  formatDateDisplay(dateStr?: string): string {
    let d = (dateStr || '').replace(/,+$/, '').trim();
    if (d.includes('T')) d = d.slice(0, 10);
    if (!d) d = '25/9/2026';
    return d;
  }

  closeOutboundDetail(): void {
    this.selectedOutbound.set(null);
    this.formMode.set('idle');
  }

  // ── DIRECTORIO GENERAL DE SALIDAS ──────────────────────────────────────────
  filteredOutbounds = computed(() => {
    const list = this.svc.outbounds();
    const q = this.searchQuery().trim().toLowerCase();
    const multi = this.activeStatusFilters();
    const st = this.statusFilter();

    return list.filter((o) => {
      let matchStatus = true;
      if (multi.length > 0) {
        matchStatus = multi.some((m) => {
          if (m === 'IN_PROGRESS') return o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS' || o.status === 'LOADED';
          return o.status === m;
        });
      } else if (st !== 'ALL') {
        if (st === 'IN_PROGRESS') {
          matchStatus = o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS' || o.status === 'LOADED';
        } else {
          matchStatus = o.status === st;
        }
      }
      if (!matchStatus) return false;

      if (!q) return true;
      return (
        o.folio.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        (o.carrierName && o.carrierName.toLowerCase().includes(q)) ||
        (o.forkliftOperator && o.forkliftOperator.toLowerCase().includes(q)) ||
        o.sealNumber.toLowerCase().includes(q) ||
        o.destinationName.toLowerCase().includes(q) ||
        (o.driverName && o.driverName.toLowerCase().includes(q))
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
    this._loadForkliftOperators();
    this._loadCatalogSkus();
    this.formMode.set('idle');
    this.selectedOutbound.set(null);
  }

  private _loadCatalogSkus(): void {
    this.movementsApi.getProductSkus().subscribe({
      next: (skus: any) => {
        if (skus && skus.length > 0) {
          this.allCatalogSkus.set(skus);
        }
      },
      error: () => {},
    });
  }

  private _loadForkliftOperators(): void {
    this.isLoadingOperators.set(true);
    this.forkliftAdminService.loadOperators(undefined, { status: 'ACTIVO' }).subscribe({
      next: () => this.isLoadingOperators.set(false),
      error: () => this.isLoadingOperators.set(false),
    });
  }

  // ── NAVEGACIÓN ────────────────────────────────────────────────────────────
  startNewOutbound(): void {
    this.svc.loadInitialBackendData();
    this.svc.reloadCarriers();
    this.svc.reloadInventoryBatches();
    this._loadForkliftOperators();
    this._loadCatalogSkus();
    this.formMode.set('create');
    this.selectedOutbound.set(null);
    this.currentStep.set(1);
    localStorage.removeItem('4guard_active_outbound_folio');

    // Inicializar selecciones sin forzar primera opción para mostrar "-- Selecciona el ... --"
    this.selectedClientCode.set('');
    this.selectedDestinationId.set('');
    this.selectedCarrierCode.set('');
    this.driverName.set('');
    this.economicNumber.set('');
    this.boxEconomicNumber.set('');
    this.tractorPlates.set('');
    this.boxPlates.set('');
    this.selectedTransportType.set('');
    this.sealNumber.set('');

    // Resetear Paso 2
    this.selectedOriginBayFilter.set('ALL');
    this.selectedOperatorId.set('');
    this.operatorSearchQuery.set('');
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.selectedPalletIds.set([]);
    this.requestedPalletsCount.set(0);
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
    this.loadAuditLogs(outbound.id || outbound.folio);

    if (outbound.id && outbound.id.includes('-')) {
      this.movementsApi.getOutboundById(outbound.id).subscribe({
        next: (full: any) => {
          if (full) {
            const mappedItems: OutboundItem[] = (full.items || []).map((it: any) => ({
              id: it.id || it.itemId || `item-${Math.random()}`,
              palletCode: it.palletCode || '--',
              productId: it.skuCode || it.productId || '--',
              description: it.skuDescription || it.description || 'Producto Despachado',
              lotNumber: it.lotNumber || '--',
              expirationDate: it.expirationDate ? String(it.expirationDate) : '--',
              pieces: it.pieces || 0,
              palletTypeId: 'ESTANDAR',
              palletTypeLabel: 'Estándar',
              locationCode: it.locationCode || 'N/A',
            }));

            const currentLoggedIn =
              this.authState.userFullName() ||
              this.authState.currentUser()?.fullName ||
              this.authState.currentUser()?.username ||
              'Admin';

            const updated: WarehouseOutbound = {
              ...outbound,
              economicNumber: full.economicNumber || outbound.economicNumber || '',
              boxEconomicNumber: full.boxEconomicNumber || outbound.boxEconomicNumber || '',
              destinationAddress: full.destinationAddress || outbound.destinationAddress || '',
              dispatchedBy: full.createdBy || outbound.dispatchedBy || currentLoggedIn,
              items: mappedItems.length > 0 ? mappedItems : outbound.items,
              totalPallets: full.totalPallets || outbound.totalPallets,
              totalPieces: full.totalPieces || outbound.totalPieces,
              distinctSkus: full.distinctSkus || outbound.distinctSkus,
            };

            this.selectedOutbound.set(updated);
          }
        },
        error: () => {},
      });
    }
  }

  loadAuditLogs(idOrFolio: string): void {
    const target = this.selectedOutbound();
    const targetId = (target && target.id && target.id.includes('-')) ? target.id : (idOrFolio.includes('-') ? idOrFolio : null);
    const folio = target?.folio || idOrFolio;

    if (targetId) {
      this.movementsApi.getOutboundAudit(targetId).subscribe({
        next: (logs: any[]) => {
          if (logs && logs.length > 0) {
            const mapped: MovementAuditEntry[] = logs.map((l: any) => ({
              id: l.id || `aud-${Date.now()}-${Math.random()}`,
              action: l.action,
              actionLabel: this.getAuditSummary(l.action),
              username: l.username || l.authorizedBy || 'Operador WMS',
              timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString('es-MX') : '',
              details: (l.details || []).map((d: any) => ({
                fieldName: this.formatFieldLabel(d.fieldName),
                oldValue: this.formatFieldValue(d.fieldName, d.oldValue),
                newValue: this.formatFieldValue(d.fieldName, d.newValue),
              })),
              reason: l.reason || '',
              authorizedBy: l.authorizedBy || '',
              observations: l.observations || '',
            }));
            const sorted = this.sortAuditEntries(mapped);
            this.auditEntries.set(sorted);
            this.svc.setOutboundAuditLogs(folio, sorted);
            return;
          }
          const fallback = this.svc.getOutboundAuditLogs(idOrFolio);
          this.auditEntries.set(this.sortAuditEntries(fallback || []));
        },
        error: () => {
          const fallback = this.svc.getOutboundAuditLogs(idOrFolio);
          this.auditEntries.set(this.sortAuditEntries(fallback || []));
        },
      });
    } else {
      const fallback = this.svc.getOutboundAuditLogs(idOrFolio);
      this.auditEntries.set(this.sortAuditEntries(fallback || []));
    }
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
    return this.svc.formatFieldLabel(field);
  }

  formatFieldValue(field: string, value: any): string {
    return this.svc.formatFieldValue(field, value);
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
      case 'SALIDA_CANCELADA':  return 'Cancelación Extraordinaria con Autorización';
      default:                  return action;
    }
  }

  // ── PASO 1 → PASO 2 ───────────────────────────────────────────────────────
  goToStep2(): void {
    if (!this.isStep1Valid()) {
      const missing: string[] = [];
      if (!this.selectedClientCode()) missing.push('Cliente Propietario');
      if (!this.selectedDestinationId()) missing.push('Planta / Destino');
      if (!this.selectedCarrierCode()) missing.push('Línea Transportista');
      if (!this.driverName()?.trim()) missing.push('Nombre del Operador (Chofer)');
      if (!this.selectedTransportType()) missing.push('Tipo de Camión');
      if (!this.tractorPlates()?.trim()) missing.push('Placas de Tracto');
      if (!this.boxPlates()?.trim()) missing.push('Placas Caja');
      if (!this.sealNumber()?.trim()) missing.push('Número de Sello o Cincho');

      this.toast.warning(
        `Debes completar los siguientes campos obligatorios: ${missing.join(', ')}.`
      );
      return;
    }
    this.currentStep.set(2);

    // Sugerencia FEFO como notificación si existen productos en Alerta Pablo para este cliente
    const pabloAlerts = this.availableSkusForClient().filter(
      (s) => s.pabloStatus === 'PABLO_ALERT' && s.totalAvailablePallets > 0
    );
    if (pabloAlerts.length > 0 && !this.selectedSkuCode()) {
      this.toast.info(
        `💡 Sugerencia FEFO: Hay ${pabloAlerts.length} producto(s) en Alerta Pablo (<30 días) para este cliente.`
      );
    }
    // No se fuerza la selección de productos ni tarimas: el usuario busca y selecciona libremente
  }

  goBackToStep1(): void {
    this.currentStep.set(1);
    // Preserva intactos todos los datos ingresados en Paso 1 y Paso 2
  }

  // ── CLIENTE / DESTINO / CARRIER ────────────────────────────────────────────
  onClientChange(code: string): void {
    if (code === this.selectedClientCode()) return;
    this.selectedClientCode.set(code);

    // Limpiar selección de productos solo si cambió el cliente principal
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.selectedPalletIds.set([]);
    this.requestedPalletsCount.set(0);

    // Mantener siempre el catálogo general completo de todos los clientes y todo el inventario activo de almacén
    this._loadCatalogSkus();
    this.svc.reloadInventoryBatches();
  }

  onCarrierChange(code: string): void {
    this.selectedCarrierCode.set(code);
  }

  // ── CONFIRMACIÓN Y EJECUCIÓN ──────────────────────────────────────────────
  openConfirmModal(): void {
    if (!this.canConfirm()) {
      if (!this.selectedOperator()) {
        this.toast.warning('Debes asignar un montacarguista certificado para el despacho.');
        return;
      }
      if (this.selectedPalletIds().length === 0) {
        this.toast.warning('Selecciona al menos una tarima para despachar.');
        return;
      }
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

    const carrier = this.selectedCarrier();
    const client = this.selectedClient();
    const dest = this.selectedDestination();
    const operator = this.selectedOperator();
    const session = this.movementsApi.getSessionOrg();

    const selectedPallets = this.selectedPalletItems();
    const selectedItemIds = selectedPallets.map((p) => p.id);

    if (selectedItemIds.length === 0) {
      this.isExecuting.set(false);
      this.toast.error('Debes seleccionar al menos una tarima para registrar el despacho.');
      return;
    }

    const clientId = (client && client.code && client.code.includes('-')) 
      ? client.code 
      : 'c73f0907-9fa5-4bdf-87db-2eb5e7683938';

    const destinationId = (dest && dest.id && dest.id.includes('-')) ? dest.id : null;
    const carrierId = (carrier && carrier.code && carrier.code.includes('-')) ? carrier.code : null;
    const operatorId = (operator && operator.id && operator.id.includes('-')) ? operator.id : null;

    const firstLot = selectedPallets[0]?.lotNumber || 'LOTE-GENERAL';
    const remisionNo = `REM-${Date.now().toString().slice(-6)}`;

    const payload = {
      organizationId: session.organizationId,
      branchId: session.branchId,
      clientId: clientId,
      destinationId: destinationId,
      destinationName: dest ? dest.name : '',
      destinationAddress: dest ? (dest.address ? `${dest.address}, ${dest.city || ''} ${dest.state || ''}`.trim() : '') : '',
      carrierId: carrierId,
      carrierName: carrier ? carrier.name : '',
      forkliftOperatorId: operatorId,
      forkliftOperatorName: operator ? operator.name : '',
      transportType: (this.selectedTransportType() || 'TRAILER') as TransportType,
      driverName: this.driverName(),
      economicNumber: this.economicNumber() || '',
      boxEconomicNumber: this.boxEconomicNumber() || '',
      tractorPlates: this.tractorPlates(),
      boxPlates: this.boxPlates(),
      sealNumber: this.sealNumber(),
      remisionNo: remisionNo,
      selectedItemIds: selectedItemIds,
    };

    this.movementsApi.createOutbound(payload).subscribe({
      next: (res: any) => {
        this.isExecuting.set(false);
        this.showConfirmModal.set(false);
        const currentLoggedInUser =
          this.authState.userFullName() ||
          this.authState.currentUser()?.fullName ||
          this.authState.currentUser()?.username ||
          'Admin';

        const mappedItems: OutboundItem[] = (res.items && res.items.length > 0)
          ? res.items.map((it: any) => ({
              id: it.id || it.itemId || `item-${Math.random()}`,
              palletCode: it.palletCode || '--',
              productId: it.skuCode || it.productId || '--',
              description: it.skuDescription || it.description || 'Producto Despachado',
              lotNumber: it.lotNumber || '--',
              expirationDate: it.expirationDate ? String(it.expirationDate) : '--',
              pieces: it.pieces || 0,
              palletTypeId: 'ESTANDAR',
              palletTypeLabel: 'Estándar',
              locationCode: it.locationCode || 'N/A',
            }))
          : selectedPallets;

        const result: WarehouseOutbound = {
          id: res.id,
          folio: res.folio,
          status: res.status || 'COMPLETED',
          clientCode: res.clientId || this.selectedClientCode(),
          clientName: res.clientName || client?.name || '',
          destinationId: res.destinationId || this.selectedDestinationId(),
          destinationName: res.destinationName || dest?.name || '',
          destinationAddress: res.destinationAddress || (dest ? `${dest.address}, ${dest.city}, ${dest.state}` : ''),
          carrierCode: res.carrierId || this.selectedCarrierCode(),
          carrierName: res.carrierName || carrier?.name || '',
          forkliftOperator: res.forkliftOperatorName || operator?.name || '',
          forkliftOperatorId: res.forkliftOperatorId || operator?.id || '',
          driverName: res.driverName || this.driverName(),
          economicNumber: res.economicNumber || this.economicNumber() || '',
          boxEconomicNumber: res.boxEconomicNumber || this.boxEconomicNumber() || '',
          tractorPlates: res.tractorPlates || this.tractorPlates(),
          boxPlates: res.boxPlates || this.boxPlates(),
          transportType: (res.transportType || this.selectedTransportType()) as TransportType,
          sealNumber: res.sealNumber || this.sealNumber(),
          remisionNo: res.remisionNo || remisionNo,
          items: mappedItems,
          totalPallets: res.totalPallets || mappedItems.length,
          totalPieces: res.totalPieces || this.totalSelectedPieces(),
          distinctSkus: res.distinctSkus || this.distinctSkusCount(),
          dispatchedAt: res.createdAt ? new Date(res.createdAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
          dispatchedBy: res.createdBy || currentLoggedInUser,
          timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };

        this.svc.outboundsSignal.update((list) => [result, ...list]);
        this.svc.deductPalletsFromInventory(selectedItemIds);
        this.selectedPalletIds.set([]);
        this.requestedPalletsCount.set(0);
        this.svc.loadInitialBackendData();
        this.svc.reloadInventoryBatches();

        this.selectedOutbound.set(result);
        this.lastCompletedOutbound.set(result);
        this.formMode.set('detail');
        this.loadAuditLogs(result.id || result.folio);
        this.showPrintPromptModal.set(true);
        this.toast.success(`Salida ${result.folio} registrada exitosamente en el servidor.`);
      },
      error: (err: any) => {
        // Fallback local en caso de desconexión
        try {
          const localResult = this.svc.executeOutbound({
            clientCode: this.selectedClientCode(),
            clientName: client?.name || 'Cliente',
            destinationId: this.selectedDestinationId(),
            destinationName: dest?.name || 'Destino',
            destinationAddress: dest ? `${dest.address}, ${dest.city}, ${dest.state}` : '',
            carrierCode: this.selectedCarrierCode(),
            carrierName: carrier?.name || 'Transportista',
            forkliftOperator: operator?.name,
            forkliftOperatorId: operator?.id,
            driverName: this.driverName(),
            economicNumber: this.economicNumber(),
            boxEconomicNumber: this.boxEconomicNumber(),
            tractorPlates: this.tractorPlates(),
            boxPlates: this.boxPlates(),
            transportType: (this.selectedTransportType() || 'TRAILER') as TransportType,
            sealNumber: this.sealNumber(),
            remisionNo: remisionNo,
            selectedPallets: selectedPallets,
            dispatchedBy: this.authState.userFullName() || 'Admin',
          });

          this.selectedPalletIds.set([]);
          this.requestedPalletsCount.set(0);
          this.svc.reloadInventoryBatches();

          this.isExecuting.set(false);
          this.showConfirmModal.set(false);
          this.selectedOutbound.set(localResult);
          this.lastCompletedOutbound.set(localResult);
          this.formMode.set('detail');
          this.loadAuditLogs(localResult.folio);
          this.showPrintPromptModal.set(true);
          this.toast.success(`Salida ${localResult.folio} registrada localmente.`);
        } catch (localErr: any) {
          this.isExecuting.set(false);
          const errMsg = err?.error?.message || err?.message || localErr.message || 'Error al registrar la salida de almacén.';
          this.toast.error(errMsg);
        }
      },
    });
  }

  // Manejo del diálogo interactivo: ¿Desea imprimir documento? (Sí/No)
  onConfirmPrintPrompt(printNow: boolean): void {
    const outbound = this.lastCompletedOutbound();
    this.showPrintPromptModal.set(false);
    if (!outbound) return;
    if (printNow) {
      this.openPrintPreview(outbound);
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

  isGeneratingPdf = signal(false);

  async downloadDirectPdf(): Promise<void> {
    const outbound = this.selectedPrintOutbound();
    if (!outbound) return;

    const folio = outbound.folio || 'Doc';
    const isCancelled = outbound.status === 'CANCELLED';
    const selector = isCancelled ? 'fg-print-outbound-cancellation-layout' : 'fg-print-dispatch-layout';
    const filename = isCancelled ? `Cancelacion_Salida_${folio}` : `Comprobante_Salida_${folio}`;

    this.isGeneratingPdf.set(true);
    try {
      await this.printService.downloadPdf(selector, filename);
      this.toast.success(`PDF descargado exitosamente: ${filename}.pdf`);
    } catch (err: any) {
      console.error('Error al generar PDF de salida:', err);
      this.toast.error('No se pudo generar el PDF automáticamente. Utiliza el botón Imprimir.');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  triggerBrowserPrint(): void {
    const outbound = this.selectedPrintOutbound();
    if (!outbound) return;
    const folio = outbound.folio || 'Doc';
    const isCancelled = outbound.status === 'CANCELLED';
    const selector = isCancelled ? 'fg-print-outbound-cancellation-layout' : 'fg-print-dispatch-layout';
    const printDocTitle = isCancelled ? `Cancelación Salida #${folio}` : `Salida de Almacén #${folio}`;
    this.printService.printElement(selector, printDocTitle);
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  getTransportLabel(type: TransportType): string {
    return TRANSPORT_TYPES.find((t) => t.id === type)?.label || type;
  }

  // ── CANCELACIÓN CON AUTORIZACIÓN DE ADMINISTRADOR ──
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

    if (current.id && current.id.includes('-')) {
      this.movementsApi.cancelOutbound(current.id, { adminUsername: username, adminPassword: password, reason }).subscribe({
        next: (res: any) => {
          this.isCancelling.set(false);
          const updated: WarehouseOutbound = {
            ...current,
            status: 'CANCELLED',
            cancellationReason: reason,
            cancelledAt: res.cancelledAt ? new Date(res.cancelledAt).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'),
            cancelledBy: res.cancelledBy || username,
          };

          this.selectedOutbound.set(updated);
          this.svc.outboundsSignal.update((list) =>
            list.map((o) => (o.id === current.id || o.folio === current.folio ? updated : o))
          );
          this.svc.loadInitialBackendData();
          this.loadAuditLogs(updated.id || updated.folio);
          this.showCancelModal.set(false);
          this.toast.success(`Salida de Almacén #${current.folio} ha sido cancelada.`);

          // Despliegue automático de la vista previa de impresión homologada para cancelación
          this.selectedPrintOutbound.set(updated);
          this.showPrintModal.set(true);
        },
        error: (err: any) => {
          this.isCancelling.set(false);
          const errMsg = err?.error?.message || err?.message || 'Error al cancelar la salida en el servidor.';
          this.cancelErrorMessage.set(errMsg);
        },
      });
    } else {
      try {
        const updated = this.svc.cancelOutbound(current.folio, reason, username);
        this.isCancelling.set(false);

        if (updated) {
          this.selectedOutbound.set(updated);
          this.loadAuditLogs(updated.folio);
          this.showCancelModal.set(false);
          this.toast.success(`Salida de Almacén #${current.folio} ha sido cancelada.`);

          // Despliegue automático de la vista previa de impresión homologada para cancelación
          this.selectedPrintOutbound.set(updated);
          this.showPrintModal.set(true);
        } else {
          this.cancelErrorMessage.set('No se pudo cancelar la salida. Folio no encontrado.');
        }
      } catch (err: any) {
        this.isCancelling.set(false);
        this.cancelErrorMessage.set(err.message || 'Error de autenticación o validación de cancelación.');
      }
    }
  }
}
