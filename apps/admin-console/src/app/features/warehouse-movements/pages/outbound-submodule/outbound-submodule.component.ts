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
  productId: string;
  description: string;
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

@Component({
  selector: 'fg-outbound-submodule',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
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
  tractorPlates = signal('');
  boxPlates = signal('');
  selectedTransportType = signal<TransportType>('TRAILER');
  sealNumber = signal('');

  // Computed: Cliente seleccionado
  selectedClient = computed(() =>
    this.clients().find((c) => c.code === this.selectedClientCode()) || null
  );

  // Computed: Destinos del cliente activo
  destinationsForClient = computed(() => {
    const code = this.selectedClientCode();
    if (!code) return [];
    return this.svc.getDestinationsForClient(code);
  });

  // Computed: Destino seleccionado
  selectedDestination = computed(() =>
    this.destinationsForClient().find((d) => d.id === this.selectedDestinationId()) || null
  );

  // Computed: Transportista seleccionado
  selectedCarrier = computed(() =>
    this.carriers().find((c) => c.code === this.selectedCarrierCode()) || null
  );

  // Validación Paso 1
  isStep1Valid = computed(() =>
    !!this.selectedClientCode() &&
    !!this.selectedDestinationId() &&
    !!this.selectedCarrierCode() &&
    !!this.driverName().trim() &&
    !!this.sealNumber().trim()
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
      { id: '00000000-0000-0000-0005-000000000001', name: 'PABLO HERNANDEZ', badge: 'MC-001', jobTitle: 'Montacarguista Master', shift: 'Matutino', status: 'ACTIVO' },
      { id: '00000000-0000-0000-0005-000000000002', name: 'ALEJANDRO MONTIEL', badge: 'MC-002', jobTitle: 'Montacarguista Reach', shift: 'Vespertino', status: 'ACTIVO' },
      { id: '00000000-0000-0000-0005-000000000003', name: 'JUAN PEREZ GONZALEZ', badge: 'MC-003', jobTitle: 'Operador Andenes', shift: 'Matutino', status: 'ACTIVO' },
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

  // ── PASO 2: BUSCADOR PREDICTIVO DE PRODUCTOS / SKUS ───────────────────────
  skuSearchQuery = signal<string>('');
  isSkuDropdownOpen = signal<boolean>(false);
  selectedSkuCode = signal<string>('');

  // Lotes disponibles para el cliente activo
  availableBatches = computed(() => {
    const batches = this.allBatches().filter((b) => b.availablePallets > 0);
    const client = this.selectedClient();
    if (!client) return batches;
    const cCode = (client.code || '').toLowerCase();
    const cName = (client.name || '').toLowerCase();

    const clientSpecific = batches.filter((b) => {
      const bClient = ((b as any).clientName || b.client || '').toLowerCase();
      return bClient.includes(cName) || cName.includes(bClient) || bClient.includes(cCode);
    });

    return clientSpecific.length > 0 ? clientSpecific : batches;
  });

  // Catálogo completo de productos por cliente (con o sin stock)
  availableSkusForClient = computed<AvailableSkuOption[]>(() => {
    const batches = this.availableBatches();
    const client = this.selectedClient();
    const clientCode = (client?.code || '').toLowerCase();
    const clientName = (client?.name || '').toLowerCase();

    // Catálogo por defecto según cliente para garantizar visualización inmediata
    const DEFAULT_CATALOG: Record<string, { code: string; name: string; category?: string }[]> = {
      'NESTLE': [
        { code: '8500297', name: 'NESCAFE CLASICO 5KG MX', category: 'CAFÉ Y BEBIDAS' },
        { code: '12572733', name: 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1', category: 'CREMADORES' },
        { code: '12448910', name: 'NESCAFE CLASICO FRASCO 12X200G N1', category: 'CAFÉ Y BEBIDAS' },
        { code: '12389412', name: 'NESQUIK CHOCOLATE POLVO 12X357G', category: 'MODIFICADORES' },
        { code: '12984711', name: 'CARNATION CLAVEL EVAPORADA 24X360G', category: 'LÁCTEOS' },
        { code: '12003948', name: 'CHOCOLATE ABUELITA TABLETA 24X540G', category: 'CHOCOLATES' },
      ],
      'LALA': [
        { code: '33019284', name: 'LECHE LALA ENTERA 12X1L TETRAPAK', category: 'LÁCTEOS' },
        { code: '33019285', name: 'LECHE LALA DESLACTOSADA 12X1L TETRAPAK', category: 'LÁCTEOS' },
        { code: '33020011', name: 'YOGURT LALA FRESA 24X220G', category: 'YOGURT' },
        { code: '33020055', name: 'QUESO MANCHEGO LALA 12X400G', category: 'QUESOS' },
      ],
      'BIMBO': [
        { code: '22019481', name: 'PAN BLANCO BIMBO GRANDE 680G', category: 'PANIFICACIÓN' },
        { code: '22019482', name: 'PAN INTEGRAL BIMBO 680G', category: 'PANIFICACIÓN' },
        { code: '22030119', name: 'DONAS BIMBO AZUCARADAS 12X105G', category: 'DULCES' },
        { code: '22030125', name: 'MANTECADAS BIMBO CON NUEZ 12X125G', category: 'PAN DULCE' },
      ],
      'PLASTICOS': [
        { code: '44019201', name: 'ENVASE PET 1L CRISTAL BOCA 28MM', category: 'ENVASES' },
        { code: '44019202', name: 'TAPA PLASTICA SEGURIDAD 28MM ROJA', category: 'TAPAS' },
        { code: '44019203', name: 'BIDON POLIETILENO 20L BLANCO INDUSTRIAL', category: 'INDUSTRIAL' },
      ],
      'ALPURA': [
        { code: '55019301', name: 'LECHE ALPURA CLASICA 12X1L', category: 'LÁCTEOS' },
        { code: '55019302', name: 'CREMA ALPURA ACIDIFICADA 12X450ML', category: 'CREMAS' },
        { code: '55019303', name: 'MANTEQUILLA ALPURA CON SAL 20X90G', category: 'LÁCTEOS' },
      ],
    };

    // 1. Recopilar catálogo de la API o fallback
    const catalogList = this.allCatalogSkus();
    const matchedCatalog: { code: string; name: string; category?: string }[] = [];

    if (catalogList && catalogList.length > 0) {
      for (const item of catalogList) {
        const itemClientId = (item.clientId || item.clientCode || '').toLowerCase();
        const itemClientName = (item.clientName || '').toLowerCase();
        if (
          !client ||
          itemClientId === clientCode ||
          itemClientName === clientName ||
          itemClientName.includes(clientName) ||
          clientName.includes(itemClientName)
        ) {
          matchedCatalog.push({
            code: String(item.code || item.sku || item.id).trim(),
            name: item.name || item.description || item.code,
            category: item.category || 'CATÁLOGO',
          });
        }
      }
    }

    if (matchedCatalog.length === 0) {
      for (const [key, items] of Object.entries(DEFAULT_CATALOG)) {
        if (clientName.toUpperCase().includes(key) || clientCode.toUpperCase().includes(key)) {
          matchedCatalog.push(...items);
          break;
        }
      }
      if (matchedCatalog.length === 0) {
        matchedCatalog.push(...DEFAULT_CATALOG['NESTLE']);
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

  inStockSkusCount = computed(() =>
    this.availableSkusForClient().filter((s) => s.totalAvailablePallets > 0).length
  );

  filteredAvailableSkus = computed(() => {
    const skus = this.availableSkusForClient();
    const q = this.skuSearchQuery().toLowerCase().trim();
    if (!q) return skus;
    return skus.filter(
      (s) =>
        s.skuCode.toLowerCase().includes(q) ||
        s.productName.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  });

  selectedSku = computed<AvailableSkuOption | undefined>(() =>
    this.availableSkusForClient().find((s) => s.skuCode === this.selectedSkuCode())
  );

  onSkuInput(val: string): void {
    this.skuSearchQuery.set(val);
    this.isSkuDropdownOpen.set(true);
    const exact = this.availableSkusForClient().find(
      (s) =>
        s.skuCode.toLowerCase() === val.toLowerCase().trim() ||
        s.productName.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      this.selectSku(exact);
    }
  }

  selectSku(sku: AvailableSkuOption): void {
    this.selectedSkuCode.set(sku.skuCode);
    this.skuSearchQuery.set(`${sku.skuCode} — ${sku.productName}`);
    this.isSkuDropdownOpen.set(false);

    // Iniciar contador en 0; el usuario decide cuántas tarimas requiere
    this.requestedPalletsCount.set(0);
    this.selectedPalletIds.set([]);

    if (sku.totalAvailablePallets === 0) {
      this.toast.info(`El producto ${sku.skuCode} no cuenta con tarimas en stock actualmente.`);
    } else if (sku.pabloStatus === 'PABLO_ALERT') {
      this.toast.info(`⏳ ${sku.productName} está en Alerta Pablo (${sku.daysRemaining}d restantes).`);
    }
  }

  clearSkuSelection(): void {
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.isSkuDropdownOpen.set(false);
    this.selectedPalletIds.set([]);
    this.requestedPalletsCount.set(0);
  }

  // ── PASO 2: TARIMAS / PALLETS CON MOTOR FEFO EN VIVO ─────────────────────
  selectedPalletIds = signal<string[]>([]);
  requestedPalletsCount = signal<number>(0);

  // Lista plana de tarimas disponibles (filtradas por SKU si se seleccionó uno)
  allAvailablePalletsForCurrentView = computed<OutboundPalletItem[]>(() => {
    const batches = this.availableBatches();
    const targetSku = this.selectedSkuCode();

    const filteredBatches = targetSku
      ? batches.filter((b) => b.productId === targetSku)
      : batches;

    const palletsList: OutboundPalletItem[] = [];

    for (const b of filteredBatches) {
      for (const p of b.pallets || []) {
        const expDate = p.expirationDate || b.expirationDate;
        const pablo = this.getPabloStatus(expDate);

        palletsList.push({
          id: p.id,
          palletCode: p.palletCode,
          productId: p.productId || b.productId,
          description: p.description || b.productName,
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

    // Ordenamiento FEFO estricto (menor días restantes primero)
    palletsList.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Marcar como sugeridos FEFO los primeros N que no estén caducos si se solicitó cantidad > 0
    const req = this.requestedPalletsCount();
    let assigned = 0;
    for (const p of palletsList) {
      if (p.pabloStatus !== 'EXPIRED' && req > 0 && assigned < req) {
        p.isSuggestedFefo = true;
        assigned++;
      }
    }

    return palletsList;
  });

  maxAvailablePallets = computed(() => {
    return this.allAvailablePalletsForCurrentView().filter(
      (p) => p.pabloStatus !== 'EXPIRED'
    ).length;
  });

  incrementRequestedCount(): void {
    const max = this.maxAvailablePallets();
    if (this.requestedPalletsCount() < max) {
      const next = this.requestedPalletsCount() + 1;
      this.requestedPalletsCount.set(next);
      this.autoSelectFefo(next, false);
    }
  }

  decrementRequestedCount(): void {
    if (this.requestedPalletsCount() > 0) {
      const next = this.requestedPalletsCount() - 1;
      this.requestedPalletsCount.set(next);
      this.autoSelectFefo(next, false);
    }
  }

  onRequestedCountInput(val: number): void {
    const max = this.maxAvailablePallets();
    const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(val, max));
    this.requestedPalletsCount.set(clamped);
    this.autoSelectFefo(clamped, false);
  }

  // Auto-seleccionar tarimas inteligentes por FEFO (Regla de Pablo)
  autoSelectFefo(count?: number, showToast = true): void {
    const max = this.maxAvailablePallets();
    let n = count !== undefined ? count : this.requestedPalletsCount();
    if (n === 0 && max > 0) {
      n = 1;
      this.requestedPalletsCount.set(1);
    }
    const pallets = this.allAvailablePalletsForCurrentView().filter(
      (p) => p.pabloStatus !== 'EXPIRED'
    );
    const toSelect = pallets.slice(0, n);
    this.selectedPalletIds.set(toSelect.map((p) => p.id));
    if (toSelect.length > 0 && showToast) {
      this.toast.info(
        `⚡ ${toSelect.length} tarima(s) con menor vida útil seleccionadas por FEFO (Regla de Pablo).`
      );
    }
  }

  togglePallet(id: string): void {
    this.selectedPalletIds.update((ids) => {
      const updated = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      this.requestedPalletsCount.set(updated.length);
      return updated;
    });
  }

  toggleAllPallets(): void {
    const available = this.allAvailablePalletsForCurrentView().filter(
      (p) => p.pabloStatus !== 'EXPIRED'
    );
    if (this.selectedPalletIds().length === available.length) {
      this.selectedPalletIds.set([]);
      this.requestedPalletsCount.set(0);
    } else {
      this.selectedPalletIds.set(available.map((p) => p.id));
      this.requestedPalletsCount.set(available.length);
    }
  }

  isPalletSelected(id: string): boolean {
    return this.selectedPalletIds().includes(id);
  }

  areAllPalletsSelected(): boolean {
    const available = this.allAvailablePalletsForCurrentView().filter(
      (p) => p.pabloStatus !== 'EXPIRED'
    );
    if (available.length === 0) return false;
    return this.selectedPalletIds().length === available.length;
  }

  // Convierte los pallets seleccionados a OutboundItems
  selectedPalletItems = computed<OutboundItem[]>(() => {
    const ids = new Set(this.selectedPalletIds());
    const all = this.allAvailablePalletsForCurrentView();
    return all
      .filter((p) => ids.has(p.id))
      .map((p) => ({
        id: p.id,
        palletCode: p.palletCode,
        productId: p.productId,
        description: p.description,
        lotNumber: p.lotNumber,
        expirationDate: p.expirationDate,
        pieces: p.pieces,
        palletTypeId: p.palletTypeId,
        palletTypeLabel: p.palletTypeLabel,
        locationCode: p.locationCode,
      }));
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

  primaryRemisionNo = computed(() => {
    const items = this.selectedPalletItems();
    if (items.length > 0 && (items[0] as any).remisionNo) {
      return (items[0] as any).remisionNo;
    }
    return `REM-${Date.now().toString().slice(-6)}`;
  });

  // Validación de Paso 2
  isStep2Valid = computed(() =>
    !!this.selectedOperator() && this.selectedPalletItems().length > 0
  );

  canConfirm = computed(() =>
    this.isStep1Valid() && this.isStep2Valid()
  );

  // ── KPI SIGNALS ────────────────────────────────────────────────────────────
  readonly kpiTotalOutbounds = this.svc.kpiTotalOutbounds;
  readonly kpiTotalPallets = this.svc.kpiTotalPalletsDispatched;
  readonly kpiTotalPieces = this.svc.kpiTotalPiecesDispatched;
  readonly kpiClients = this.svc.kpiDistinctClientsServed;

  // ── DIRECTORIO (LISTA IZQUIERDA) ──────────────────────────────────────────
  filteredOutbounds = computed(() => {
    const list = this.svc.outbounds();
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.statusFilter();

    return list.filter((o) => {
      const matchStatus = st === 'ALL' || o.status === st;
      if (!matchStatus) return false;
      if (!q) return true;
      return (
        o.folio.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.carrierName.toLowerCase().includes(q) ||
        (o.forkliftOperator && o.forkliftOperator.toLowerCase().includes(q)) ||
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
    this.tractorPlates.set('');
    this.boxPlates.set('');
    this.selectedTransportType.set('TRAILER');
    this.sealNumber.set('');

    // Resetear Paso 2
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
      this.toast.warning('Completa los datos de transporte y destino para continuar.');
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
    const dests = this.svc.getDestinationsForClient(code);
    this.selectedDestinationId.set(dests.length > 0 ? dests[0].id : '');
    // Limpiar selección de productos solo si cambió a un cliente distinto
    this.selectedSkuCode.set('');
    this.skuSearchQuery.set('');
    this.selectedPalletIds.set([]);
    this.requestedPalletsCount.set(0);

    // Cargar SKUs y lotes de inventario reales del cliente desde la BD
    const client = this.selectedClient();
    const clientId = client?.code;
    if (clientId) {
      this.movementsApi.getProductSkus(clientId).subscribe({
        next: (skus) => {
          if (skus && skus.length > 0) {
            this.allCatalogSkus.set(skus);
          }
        },
        error: () => {},
      });
      this.svc.reloadInventoryBatches(clientId);
    }
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
      transportType: this.selectedTransportType(),
      driverName: this.driverName(),
      economicNumber: this.economicNumber() || '',
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
        this.svc.loadInitialBackendData();

        this.selectedOutbound.set(result);
        this.formMode.set('detail');
        this.loadAuditLogs(result.id || result.folio);
        this.selectedPrintOutbound.set(result);
        this.showPrintModal.set(true);
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
            tractorPlates: this.tractorPlates(),
            boxPlates: this.boxPlates(),
            transportType: this.selectedTransportType(),
            sealNumber: this.sealNumber(),
            remisionNo: remisionNo,
            selectedPallets: selectedPallets,
            dispatchedBy: this.authState.userFullName() || 'Admin',
          });

          this.isExecuting.set(false);
          this.showConfirmModal.set(false);
          this.selectedOutbound.set(localResult);
          this.formMode.set('detail');
          this.loadAuditLogs(localResult.folio);
          this.selectedPrintOutbound.set(localResult);
          this.showPrintModal.set(true);
          this.toast.success(`Salida ${localResult.folio} registrada localmente.`);
        } catch (localErr: any) {
          this.isExecuting.set(false);
          const errMsg = err?.error?.message || err?.message || localErr.message || 'Error al registrar la salida de almacén.';
          this.toast.error(errMsg);
        }
      },
    });
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
