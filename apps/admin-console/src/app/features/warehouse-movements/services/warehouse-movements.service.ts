/**
 * @file warehouse-movements.service.ts
 * @description Servicio reactivo basado en Angular Signals para el módulo Movimientos de Almacén.
 * Administra el estado global de Recepciones, Traspasos, Salidas Outbound e Inventario de Bahías.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, map, concatMap, of, catchError } from 'rxjs';
import { ForkliftOperatorAdminService } from '../../admin/services/forklift-operator.service';
import {
  ReceptionHeader,
  CheckInCasetaData,
  ReceptionPalletItem,
  PalletType,
  PALLET_TYPE_LABELS,
  WarehouseTransfer,
  LocationStockInfo,
  InventoryBatch,
  OutboundDispatch,
  CarrierLineItem,
  ClientItem,
  RampItem,
  RampOccupancyStatus,
  STANDARD_WAREHOUSE_RAMPS,
  ForkliftOperatorItem,
  TRANSFER_REASONS,
  WarehouseOutbound,
  OutboundItem,
  OutboundStatus,
  TransportType,
  CLIENT_DESTINATIONS,
  ClientDestination,
  MovementAuditEntry,
  MovementAuditDetail,
} from '../models/warehouse-movements.models';
import { WarehouseMovementsApiService } from './warehouse-movements-api.service';

export const isUuid = (val: any): boolean =>
  typeof val === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val.trim());

@Injectable({
  providedIn: 'root',
})
export class WarehouseMovementsService {
  public readonly movementsApi = inject(WarehouseMovementsApiService);
  private readonly forkliftAdminService = inject(ForkliftOperatorAdminService);
  // Consecutivo base de recepción
  private nextFolioNumber = signal(26510);
  private nextTransferNumber = signal(4081);
  private nextDispatchNumber = signal(8821);
  private nextOutboundNumber = signal(1);  // SAL-2026-000001

  // Mapas de Auditoría por Folio
  private readonly receptionAuditMap = signal<Record<string, MovementAuditEntry[]>>({});
  private readonly transferAuditMap = signal<Record<string, MovementAuditEntry[]>>({});
  private readonly outboundAuditMap = signal<Record<string, MovementAuditEntry[]>>({});

  // Catálogos Reactivos
  private readonly carrierLinesSignal = signal<CarrierLineItem[]>([]);
  private readonly clientsSignal = signal<ClientItem[]>([]);
  private readonly rampsSignal = signal<RampItem[]>(STANDARD_WAREHOUSE_RAMPS);
  private readonly forkliftOperatorsSignal = signal<ForkliftOperatorItem[]>([]);
  private readonly suppliersSignal = signal<{ code: string; name: string }[]>([]);

  readonly carrierLines = this.carrierLinesSignal.asReadonly();
  readonly clients = this.clientsSignal.asReadonly();
  readonly ramps = this.rampsSignal.asReadonly();
  readonly suppliers = this.suppliersSignal.asReadonly();
  readonly forkliftOperators = computed<ForkliftOperatorItem[]>(() => {
    const adminOps = this.forkliftAdminService.dropdownOperators();
    return adminOps.length > 0 ? adminOps : this.forkliftOperatorsSignal();
  });

  addCarrierLine(item: CarrierLineItem): void {
    this.carrierLinesSignal.update((list) => [...list, item]);
  }

  addRamp(item: RampItem): void {
    this.rampsSignal.update((list) => [...list, item]);
  }

  // Almacenamiento Reactivo de datos (Signals) — Inician vacíos
  private readonly receptionsSignal = signal<ReceptionHeader[]>([]);
  private readonly transfersSignal = signal<WarehouseTransfer[]>([]);
  private readonly dispatchesSignal = signal<OutboundDispatch[]>([]);
  readonly outboundsSignal = signal<WarehouseOutbound[]>([]);

  // Bahías y su stock (inicia vacío — poblado exclusivamente por wms.locations y wms.inventory_items)
  private readonly locationsSignal = signal<Record<string, LocationStockInfo>>({});
  private lastFetchedLocations: any[] = [];

  // Lotes de inventario (FIFO/FEFO)
  private readonly inventoryBatchesSignal = signal<InventoryBatch[]>([]);

  // Readonly Computed Public Exposures
  readonly receptions = this.receptionsSignal.asReadonly();
  readonly pendingReceptions = computed(() =>
    this.receptionsSignal().filter((r) => r.status === 'REGISTERED')
  );
  readonly pendingReceptionsCount = computed(() => this.pendingReceptions().length);
  readonly transfers = this.transfersSignal.asReadonly();
  readonly dispatches = this.dispatchesSignal.asReadonly();
  readonly outbounds = this.outboundsSignal.asReadonly();
  readonly locations = this.locationsSignal.asReadonly();
  readonly inventoryBatches = this.inventoryBatchesSignal.asReadonly();

  // KPIs de Salidas de Almacén (Outbound)
  readonly kpiTotalOutbounds = computed(() => this.outboundsSignal().length);
  readonly kpiTotalPalletsDispatched = computed(() =>
    this.outboundsSignal().reduce((acc, o) => acc + o.totalPallets, 0)
  );
  readonly kpiTotalPiecesDispatched = computed(() =>
    this.outboundsSignal().reduce((acc, o) => acc + o.totalPieces, 0)
  );
  readonly kpiDistinctClientsServed = computed(() =>
    new Set(this.outboundsSignal().map((o) => o.clientCode)).size
  );

  // ── MATRIZ DE OCUPACIÓN Y BLOQUEO DE RAMPAS (1 - 12) ──
  readonly rampOccupancyStatus = computed<RampOccupancyStatus[]>(() => {
    const allRamps = this.rampsSignal();
    const activeReceptions = this.receptionsSignal().filter(
      (r) => r.status === 'ASSIGNED' || r.status === 'IN_PROGRESS' || r.status === 'DISCHARGED' || (r.status === 'REGISTERED' && !!r.checkIn?.rampNumber)
    );
    const activeOutbounds = this.outboundsSignal().filter(
      (o) => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS' || o.status === 'LOADED' || (o.status === 'REGISTERED' && !!o.rampNumber)
    );

    return allRamps.map((ramp) => {
      // 1. Verificar si está ocupada por Recepción Inbound en andén
      const recMatch = activeReceptions.find(
        (r) =>
          (r.checkIn?.rampNumber && Number(r.checkIn.rampNumber) === Number(ramp.rampNumber)) ||
          (r.checkIn?.rampCode && (r.checkIn.rampCode === ramp.code || r.checkIn.rampCode === ramp.id))
      );

      if (recMatch) {
        let statusLabel = 'En Descarga Inbound';
        if (recMatch.status === 'ASSIGNED') {
          statusLabel = 'Andén Asignado (Espera Descarga)';
        } else if (recMatch.status === 'IN_PROGRESS') {
          statusLabel = 'En Descarga Inbound';
        } else if (recMatch.status === 'DISCHARGED') {
          statusLabel = 'Descarga Concluida (Por Auditar)';
        } else if (recMatch.status === 'REGISTERED') {
          statusLabel = 'Pre-registro Caseta (Entrada)';
        }

        return {
          rampNumber: ramp.rampNumber,
          code: ramp.code,
          name: ramp.name,
          status: 'OCCUPIED_INBOUND',
          statusLabel: statusLabel,
          operationType: 'INBOUND',
          operationFolio: recMatch.folio,
          docNumber: recMatch.checkIn?.docNumber,
          driverName: recMatch.checkIn?.driverName,
          carrierName: recMatch.checkIn?.carrierLine,
          forkliftOperator: recMatch.checkIn?.forkliftOperator,
          startedAt: recMatch.checkIn?.receptionTime || recMatch.createdAt,
        };
      }

      // 2. Verificar si está ocupada por Carga Outbound en andén
      const outMatch = activeOutbounds.find(
        (o) =>
          (o.rampNumber && Number(o.rampNumber) === Number(ramp.rampNumber)) ||
          (o.rampCode && (o.rampCode === ramp.code || o.rampCode === ramp.id))
      );

      if (outMatch) {
        let statusLabel = 'En Carga Outbound';
        if (outMatch.status === 'ASSIGNED') {
          statusLabel = 'Andén Asignado (Espera Carga)';
        } else if (outMatch.status === 'IN_PROGRESS') {
          statusLabel = 'En Carga Outbound';
        } else if (outMatch.status === 'LOADED') {
          statusLabel = 'Carga Concluida (Por Auditar)';
        } else if (outMatch.status === 'REGISTERED') {
          statusLabel = 'Pre-registro Caseta (Salida)';
        }

        return {
          rampNumber: ramp.rampNumber,
          code: ramp.code,
          name: ramp.name,
          status: 'OCCUPIED_OUTBOUND',
          statusLabel: statusLabel,
          operationType: 'OUTBOUND',
          operationFolio: outMatch.folio,
          docNumber: outMatch.remisionNo,
          driverName: outMatch.driverName,
          carrierName: outMatch.carrierName,
          forkliftOperator: outMatch.forkliftOperator,
          startedAt: outMatch.timestamp,
        };
      }

      // 3. Rampa Disponible
      return {
        rampNumber: ramp.rampNumber,
        code: ramp.code,
        name: ramp.name,
        status: 'AVAILABLE',
        statusLabel: 'Disponible',
      };
    });
  });

  readonly totalBusyRampsCount = computed(() => this.rampOccupancyStatus().filter((r) => r.status !== 'AVAILABLE').length);
  readonly totalFreeRampsCount = computed(() => this.rampOccupancyStatus().filter((r) => r.status === 'AVAILABLE').length);

  // Catálogo de Destinos por Cliente y Global (dinámico de BD + fallback de catálogo)
  readonly clientDestinations = CLIENT_DESTINATIONS;

  readonly allDestinations = computed<ClientDestination[]>(() => {
    const clients = this.clientsSignal();
    const result: ClientDestination[] = [];
    const seenIds = new Set<string>();

    for (const client of clients) {
      if (client.destinations && client.destinations.length > 0) {
        for (const dest of client.destinations) {
          if (dest.status === 'ACTIVO' && !seenIds.has(dest.id)) {
            seenIds.add(dest.id);
            result.push(dest);
          }
        }
      }
    }

    for (const defaultDest of CLIENT_DESTINATIONS) {
      if (defaultDest.status === 'ACTIVO' && !seenIds.has(defaultDest.id)) {
        seenIds.add(defaultDest.id);
        result.push(defaultDest);
      }
    }

    return result;
  });

  getAllDestinations(): ClientDestination[] {
    return this.allDestinations();
  }

  getDestinationsForClient(clientCode: string): ClientDestination[] {
    if (!clientCode) return this.allDestinations();
    const client = this.clientsSignal().find((c) => c.code === clientCode || c.name === clientCode);
    if (client && client.destinations && client.destinations.length > 0) {
      return client.destinations.filter((d) => d.status === 'ACTIVO');
    }
    const filtered = CLIENT_DESTINATIONS.filter(
      (d) => d.clientCode === clientCode && d.status === 'ACTIVO'
    );
    return filtered.length > 0 ? filtered : this.allDestinations();
  }

  // Bahías Ocupadas y Disponibles (Computadas)
  readonly occupiedLocations = computed(() =>
    Object.values(this.locationsSignal()).filter((loc) => loc.totalPallets > 0)
  );

  readonly availableLocations = computed(() =>
    Object.values(this.locationsSignal()).filter((loc) => loc.totalPallets === 0 && !loc.isBlocked)
  );

  readonly transferReasons = TRANSFER_REASONS;

  constructor() {
    this.loadInitialBackendData();
  }

  public loadInitialBackendData(): void {
    // 1. Clientes
    this.movementsApi.getClients().subscribe({
      next: (clients: any) => {
        this.clientsSignal.set(
          (clients || []).map((c: any) => ({
            code: c.id || c.code || 'CLI',
            name: c.name || c.tradeName || 'Cliente',
            destinations: (c.destinations || []).map((d: any) => ({
              id: d.id || `DEST-${d.destinationCode || Math.random()}`,
              clientCode: c.id || c.code,
              name: d.plantName || d.name || 'Planta / Destino',
              address: d.fullAddress || d.address || '',
              city: d.city || '',
              state: d.state || '',
              contactName: d.contactPerson || d.contactName || '',
              contactPhone: d.phone || d.contactPhone || '',
              status: (d.status === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO') as 'ACTIVO' | 'INACTIVO',
            })),
          }))
        );
      },
      error: () => {},
    });

    // 2. Transportistas
    this.reloadCarriers();

    // 3. Proveedores
    this.reloadSuppliers();

    // 3. Montacarguistas
    this.forkliftAdminService.loadOperators().subscribe({
      next: () => {},
      error: () => {},
    });

    this.movementsApi.getForkliftOperators().subscribe({
      next: (ops: any) => {
        if (ops && ops.length > 0) {
          this.forkliftOperatorsSignal.set(
            ops.map((o: any) => ({
              id: o.id,
              code: (o.code && !o.code.includes('-') && o.code.length <= 10) ? o.code : (o.licenseNumberDc3 || 'MC'),
              name: o.fullName || `${o.firstName || ''} ${o.lastNamePaternal || o.lastName || ''} ${o.lastNameMaternal || ''}`.trim() || o.name || 'Montacarguista',
              jobTitle: o.jobTitle || 'Montacarguista',
              shift: o.shift || (o as any).shiftName || 'Turno General',
            }))
          );
        }
      },
      error: () => {},
    });

    // 4. Ubicaciones / Bahías y 5. Lotes de inventario (FIFO/FEFO)
    this.movementsApi.getLocations().subscribe({
      next: (locs: any) => {
        this.lastFetchedLocations = locs || [];
        this.syncLocationsAndInventory(this.lastFetchedLocations, this.inventoryBatchesSignal());
        this.syncRamps(this.lastFetchedLocations);
      },
      error: () => {},
    });

    this.reloadInventoryBatches();

    // 6. Recepciones
    this.reloadReceptions();

    // 7. Traspasos
    this.movementsApi.getTransfers().subscribe({
      next: (transfers: any) => {
        this.transfersSignal.set(
          (transfers || []).map((t: any) => ({
            id: t.id,
            folio: t.folio,
            status: t.status,
            forkliftOperator: t.forkliftOperatorName || '',
            forkliftOperatorId: t.forkliftOperatorId,
            originLocation: t.originLocationCode || '',
            destinationLocation: t.destinationLocationCode || '',
            reasonId: t.reasonCode,
            reasonLabel: t.reasonLabel || t.reasonCode,
            pallets: [],
            totalPallets: t.totalPallets || 0,
            totalPieces: t.totalPieces || 0,
            distinctSkus: t.distinctSkus || 0,
            transferredAt: t.createdAt ? new Date(t.createdAt).toLocaleString('es-MX') : '',
            transferredBy: t.createdBy || '',
          }))
        );
      },
      error: () => {},
    });

    // 8. Salidas
    this.movementsApi.getOutbounds().subscribe({
      next: (outbounds: any) => {
        this.outboundsSignal.set(
          (outbounds || []).map((o: any) => ({
            id: o.id,
            folio: o.folio,
            status: o.status || 'REGISTERED',
            clientCode: o.clientId || '',
            clientName: o.clientName || '',
            destinationId: o.destinationId || '',
            destinationName: o.destinationName || '',
            destinationAddress: o.destinationAddress || '',
            carrierCode: o.carrierId || '',
            carrierName: o.carrierName || '',
            rampId: o.rampId || '',
            rampNumber: o.rampNumber ? Number(o.rampNumber) : (o.rampCode ? parseInt(String(o.rampCode).replace(/\D/g, ''), 10) : undefined),
            rampCode: o.rampCode || (o.rampNumber ? `RAMPA-${o.rampNumber}` : ''),
            forkliftOperator: o.forkliftOperatorName || o.forkliftOperator || '',
            forkliftOperatorId: o.forkliftOperatorId || '',
            driverName: o.driverName || '',
            economicNumber: o.economicNumber || '',
            boxEconomicNumber: o.boxEconomicNumber || '',
            tractorPlates: o.tractorPlates || '',
            boxPlates: o.boxPlates || '',
            transportType: o.transportType || 'TRAILER',
            sealNumber: o.sealNumber || '',
            remisionNo: o.remisionNo || '',
            observations: o.observations || '',
            items: (o.items || []).map((it: any) => ({
              id: it.id || it.itemId,
              palletCode: it.palletCode,
              productId: it.skuCode || it.productId || '',
              description: it.skuDescription || it.description || '',
              lotNumber: it.lotNumber || '',
              expirationDate: it.expirationDate ? String(it.expirationDate) : '',
              pieces: it.pieces || 0,
              palletTypeId: 'ESTANDAR',
              palletTypeLabel: 'Estándar',
              locationCode: it.locationCode || 'N/A',
            })),
            totalPallets: o.totalPallets || 0,
            totalPieces: o.totalPieces || 0,
            distinctSkus: o.distinctSkus || 0,
            completedAt: o.completedAt ? new Date(o.completedAt).toLocaleString('es-MX') : '',
            leaderAuthorizedBy: o.leaderAuthorizedBy || '',
            dispatchedAt: o.createdAt ? new Date(o.createdAt).toLocaleString('es-MX') : '',
            dispatchedBy: o.createdBy || 'Admin',
            timestamp: o.createdAt ? String(o.createdAt).substring(11, 16) : '',
          }))
        );
      },
      error: () => {},
    });
  }

  public reloadCarriers(): void {
    this.movementsApi.getCarriers().subscribe({
      next: (carriers: any) => {
        if (carriers) {
          this.carrierLinesSignal.set(
            carriers.map((c: any) => ({
              code: c.id || c.code || c.taxId || 'TR',
              name: c.tradeName && c.tradeName !== c.name ? `${c.tradeName} (${c.name})` : (c.name || c.tradeName || 'Transportista'),
            }))
          );
        }
      },
      error: () => {},
    });
  }

  public reloadSuppliers(): void {
    this.movementsApi.getSuppliers().subscribe({
      next: (sups: any) => {
        if (sups && sups.length > 0) {
          this.suppliersSignal.set(
            sups.map((s: any) => ({
              id: s.id,
              code: (s.code && !s.code.includes('-') && s.code.length <= 15) ? s.code : (s.supplierCode || 'PROV'),
              name: s.commercialName || s.legalName || s.tradeName || s.name || s.businessName || 'Proveedor',
            }))
          );
        }
      },
      error: () => {},
    });
  }

  public reloadInventoryBatches(clientId?: string): void {
    const options: any = {};
    if (clientId && isUuid(clientId)) {
      options.clientId = clientId;
    }
    this.movementsApi.getInventoryBatches(options).subscribe({
      next: (batches: any) => {
        const receptions = this.receptionsSignal();
        const fetchedBatches = (batches || []).map((b: any) => {
          let rem = b.remisionNo || 'REM-S/N';
          // Buscar si existe una recepción activa que tenga un número de remisión actualizado para este producto/lote/bahía
          const recMatch = receptions.find(
            (r) =>
              r.status !== 'CANCELLED' &&
              ((b.productId && (r.skuCode === b.productId || r.productId === b.productId)) ||
                (b.skuCode && (r.skuCode === b.skuCode || r.productId === b.skuCode)) ||
                (b.productName && r.productName && r.productName.toLowerCase().trim() === b.productName.toLowerCase().trim()) ||
                (b.locationCode && r.storageLocation && r.storageLocation.toUpperCase() === b.locationCode.toUpperCase()))
          );
          if (recMatch && recMatch.checkIn?.docNumber) {
            rem = recMatch.checkIn.docNumber;
          }

          return {
            remisionNo: rem,
            client: b.clientName || 'Cliente WMS',
            productId: b.skuCode || b.productId || '',
            productName: b.productName || 'Producto',
            lotNumber: b.lotNumber || '',
            elaborationDate: b.manufacturingDate || '',
            expirationDate: b.expirationDate || '',
            availablePallets: b.availablePallets || (b.pallets ? b.pallets.length : 0),
            totalPieces: b.totalPieces || 0,
            locationCode: b.locationCode || '',
            isFifoSuggested: !!b.isFifoSuggested,
            pallets: (b.pallets || []).map((p: any) => ({
              id: p.itemId || p.id,
              palletCode: p.palletCode || p.sscc || '',
              description: p.description || b.productName || '',
              productId: p.skuCode || b.skuCode || b.productId || '',
              pieces: p.pieces || 0,
              palletTypeId: p.palletTypeId || 'MADERA_ESTANDAR',
              palletTypeLabel: p.palletTypeLabel || 'Madera Estándar',
              locationCode: p.locationCode || b.locationCode || 'N/A',
              lotNumber: p.lotNumber || b.lotNumber || '',
              expirationDate: p.expirationDate || b.expirationDate || '',
            })),
          };
        });
        this.inventoryBatchesSignal.set(fetchedBatches);
        this.syncLocationsAndInventory(this.lastFetchedLocations, fetchedBatches);
      },
      error: () => {},
    });
  }

  public deductPalletsFromInventory(palletIds: string[]): void {
    if (!palletIds || palletIds.length === 0) return;
    const selectedIds = new Set(palletIds);
    this.inventoryBatchesSignal.update((batches) =>
      batches.map((batch) => {
        const remaining = (batch.pallets || []).filter((p) => !selectedIds.has(p.id));
        if (remaining.length === (batch.pallets || []).length) return batch;
        return {
          ...batch,
          availablePallets: remaining.length,
          totalPieces: remaining.reduce((acc, p) => acc + p.pieces, 0),
          pallets: remaining,
        };
      })
    );
  }

  public reloadReceptions(): void {
    this.movementsApi.getReceptions().subscribe({
      next: (receptions: any) => {
        const mapped = (receptions || []).map((r: any) => this.mapReceptionResponseToHeader(r));
        const unique: ReceptionHeader[] = [];
        const seenDocs = new Set<string>();
        const seenIds = new Set<string>();

        // Priorizar y deduplicar registros para evitar duplicidad de folios en pantalla
        for (const r of mapped) {
          const idKey = (r.id || r.folio || '').trim();
          const docKey = (r.checkIn?.docNumber || r.folio || '').trim().toUpperCase();
          if (idKey && !seenIds.has(idKey) && (!docKey || !seenDocs.has(docKey))) {
            seenIds.add(idKey);
            if (docKey) seenDocs.add(docKey);
            unique.push(r);
          }
        }
        this.receptionsSignal.set(unique);
      },
      error: () => {},
    });
  }

  public removeReception(folioOrId: string): void {
    const key = (folioOrId || '').trim();
    this.receptionsSignal.update((list) =>
      list.filter((r) => r.folio !== key && r.id !== key)
    );
  }

  public deduplicateReceptions(): void {
    const list = this.receptionsSignal();
    const seen = new Set<string>();
    const unique: ReceptionHeader[] = [];
    for (const r of list) {
      const docKey = (r.checkIn?.docNumber || r.folio || '').trim().toUpperCase();
      if (!seen.has(docKey)) {
        seen.add(docKey);
        unique.push(r);
      }
    }
    this.receptionsSignal.set(unique);
  }

  public reloadTransfers(): void {
    this.movementsApi.getTransfers().subscribe({
      next: (transfers: any) => {
        this.transfersSignal.set(
          (transfers || []).map((t: any) => ({
            id: t.id,
            folio: t.folio,
            status: t.status,
            forkliftOperator: t.forkliftOperatorName || '',
            forkliftOperatorId: t.forkliftOperatorId,
            originLocation: t.originLocationCode || '',
            destinationLocation: t.destinationLocationCode || '',
            reasonId: t.reasonCode,
            reasonLabel: t.reasonLabel || t.reasonCode,
            pallets: [],
            totalPallets: t.totalPallets || 0,
            totalPieces: t.totalPieces || 0,
            distinctSkus: t.distinctSkus || 0,
            transferredAt: t.createdAt ? new Date(t.createdAt).toLocaleString('es-MX') : '',
            transferredBy: t.createdBy || '',
          }))
        );
      },
      error: () => {},
    });
  }

  public reloadOutbounds(): void {
    this.movementsApi.getOutbounds().subscribe({
      next: (outbounds: any) => {
        this.outboundsSignal.set(
          (outbounds || []).map((o: any) => ({
            id: o.id,
            folio: o.folio,
            status: o.status || 'REGISTERED',
            clientCode: o.clientId || '',
            clientName: o.clientName || '',
            destinationId: o.destinationId || '',
            destinationName: o.destinationName || '',
            destinationAddress: o.destinationAddress || '',
            carrierCode: o.carrierId || '',
            carrierName: o.carrierName || '',
            rampId: o.rampId || '',
            rampNumber: o.rampNumber ? Number(o.rampNumber) : (o.rampCode ? parseInt(String(o.rampCode).replace(/\D/g, ''), 10) : undefined),
            rampCode: o.rampCode || (o.rampNumber ? `RAMPA-${o.rampNumber}` : ''),
            forkliftOperator: o.forkliftOperatorName || o.forkliftOperator || '',
            forkliftOperatorId: o.forkliftOperatorId,
            transportType: o.transportType || '',
            driverName: o.driverName || '',
            tractorPlates: o.tractorPlates || '',
            boxPlates: o.boxPlates || '',
            economicNumber: o.economicNumber || '',
            boxEconomicNumber: o.boxEconomicNumber || '',
            sealNumber: o.sealNumber || '',
            remisionNo: o.remisionNo || '',
            observations: o.observations || '',
            outboundDate: o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-MX') : '',
            outboundTime: o.createdAt ? new Date(o.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
            authorizedBy: o.createdBy || '',
            items: [],
          }))
        );
      },
      error: () => {},
    });
  }

  private syncLocationsAndInventory(locs: any[], batches: any[]): void {
    const locMap: Record<string, LocationStockInfo> = {};

    // 1. Inicializar todas las ubicaciones reales devueltas por el BE
    if (locs && locs.length > 0) {
      locs.forEach((l: any) => {
        const code = (l.code || l.locationCode || '').toUpperCase().trim();
        if (!code) return;
        locMap[code] = {
          locationCode: code,
          locationId: l.id, // UUID real de la tabla wms.locations
          warehouseName: l.warehouseName || l.branchName || 'Almacén Principal',
          zone: l.zone || l.zoneName || 'General',
          aisle: l.aisle || '',
          rack: l.rack || '',
          level: l.level ? `Nivel ${l.level}` : '',
          capacity: l.capacityUnits || l.capacity || 4,
          occupancy: 0,
          availableCapacity: l.capacityUnits || l.capacity || 4,
          isBlocked: !!l.isBlocked || l.status === 'BLOCKED',
          blockReason: l.blockReason || l.statusReason,
          totalPallets: 0,
          totalPieces: 0,
          pallets: [],
        };
      });
    }

    // 2. Asociar los lotes e items de inventario reales del BE a sus bahías
    if (batches && batches.length > 0) {
      batches.forEach((b: any) => {
        if (!b.pallets || b.pallets.length === 0) return;

        b.pallets.forEach((p: any) => {
          const locCode = (p.locationCode || b.locationCode || '').toUpperCase().trim();
          if (!locCode) return;

          // Si la ubicación no estaba en el mapa, registrarla
          if (!locMap[locCode]) {
            locMap[locCode] = {
              locationCode: locCode,
              locationId: p.locationId,
              warehouseName: 'Almacén Principal',
              zone: 'General',
              capacity: 4,
              occupancy: 0,
              availableCapacity: 4,
              totalPallets: 0,
              totalPieces: 0,
              pallets: [],
            };
          }

          const palletItem: ReceptionPalletItem = {
            id: p.itemId || p.id, // UUID real del item en wms.inventory_items
            palletCode: p.palletCode || p.sscc || `UA-${p.itemId?.substring(0, 8) || '001'}`,
            productId: p.skuCode || b.skuCode || '',
            description: p.description || b.productName || '',
            supplierName: b.clientName || 'Cliente WMS',
            pieces: Number(p.pieces || b.totalPieces || 0),
            palletTypeId: p.palletTypeId || 'MADERA_ESTANDAR',
            palletTypeLabel: p.palletTypeLabel || 'Madera Estándar',
            observations: p.observations || '',
            status: 'SCANNED',
          };

          locMap[locCode].pallets.push(palletItem);
        });
      });
    }

    // 3. Recalcular totalizadores para cada ubicación
    Object.values(locMap).forEach((loc) => {
      loc.totalPallets = loc.pallets.length;
      loc.totalPieces = loc.pallets.reduce((acc, p) => acc + (p.pieces || 0), 0);
      loc.occupancy = loc.totalPallets;
      const cap = loc.capacity || 4;
      loc.availableCapacity = Math.max(0, cap - loc.totalPallets);
    });

    this.locationsSignal.set(locMap);
  }

  public syncRamps(locs: any[]): void {
    const defaultRamps = [...STANDARD_WAREHOUSE_RAMPS];
    if (!locs || locs.length === 0) {
      this.rampsSignal.set(defaultRamps);
      return;
    }

    const rampLocs = locs.filter(
      (l: any) =>
        l.type === 'RAMP' ||
        (l.code && (l.code.startsWith('LOC-RAMP') || l.code.startsWith('R-'))) ||
        l.sectionCode === 'SEC-RAMP'
    );

    const merged = defaultRamps.map((dr) => {
      const match = rampLocs.find(
        (rl: any) =>
          rl.code === `LOC-RAMP-${String(dr.rampNumber).padStart(2, '0')}` ||
          rl.code === dr.code ||
          (rl.name && rl.name.toLowerCase().trim() === dr.name.toLowerCase().trim()) ||
          rl.position === `R${String(dr.rampNumber).padStart(2, '0')}` ||
          rl.position === `R${dr.rampNumber}`
      );
      return {
        ...dr,
        id: match ? match.id : dr.id,
      };
    });

    this.rampsSignal.set(merged);
  }

  // ─── MÉTODOS DE AUDITORÍA ───────────────────────────────────────────────────

  getReceptionAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.receptionAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'RECEPCION_CREADA',
        actionLabel: 'Pre-Recepción Registrada en Caseta',
        username: 'Caseta de Seguridad',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio de Operación', newValue: folio }],
      },
    ];
  }

  setReceptionAuditLogs(folio: string, entries: MovementAuditEntry[]): void {
    this.receptionAuditMap.update((map) => {
      const key = folio.trim();
      return { ...map, [key]: entries };
    });
  }

  addReceptionAudit(folio: string, entry: MovementAuditEntry): void {
    this.receptionAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      const filtered = current.filter((e) => e.id !== entry.id);
      return { ...map, [key]: [entry, ...filtered] };
    });
  }

  getTransferAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.transferAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'TRASPASO_REGISTRADO',
        actionLabel: 'Reubicación de Tarima Registrada',
        username: 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio de Operación', newValue: folio }],
      },
    ];
  }

  setTransferAuditLogs(folio: string, entries: MovementAuditEntry[]): void {
    this.transferAuditMap.update((map) => {
      const key = folio.trim();
      return { ...map, [key]: entries };
    });
  }

  addTransferAudit(folio: string, entry: MovementAuditEntry): void {
    this.transferAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      const filtered = current.filter((e) => e.id !== entry.id);
      return { ...map, [key]: [entry, ...filtered] };
    });
  }

  getOutboundAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.outboundAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'SALIDA_REGISTRADA',
        actionLabel: 'Despacho Outbound Registrado',
        username: 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio de Operación', newValue: folio }],
      },
    ];
  }

  setOutboundAuditLogs(folio: string, entries: MovementAuditEntry[]): void {
    this.outboundAuditMap.update((map) => {
      const key = folio.trim();
      return { ...map, [key]: entries };
    });
  }

  addOutboundAudit(folio: string, entry: MovementAuditEntry): void {
    this.outboundAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      const filtered = current.filter((e) => e.id !== entry.id);
      return { ...map, [key]: [entry, ...filtered] };
    });
  }

  // Traducción y formateo profesional de campos para auditores
  formatFieldLabel(field: string): string {
    if (!field) return 'Dato';
    const clean = field.trim();
    const map: Record<string, string> = {
      docNumber: 'No. de Remisión / Documento',
      doc_number: 'No. de Remisión / Documento',
      remisionNo: 'No. de Remisión / Documento',
      remision: 'No. de Remisión / Documento',
      status: 'Estado Operativo',
      reason: 'Motivo / Justificación',
      cancellationReason: 'Motivo de Cancelación',
      authorizedBy: 'Autorizado Por (Supervisor)',
      authorized_by: 'Autorizado Por (Supervisor)',
      cancelledBy: 'Cancelado Por',
      client: 'Cliente / Propietario',
      clientId: 'Cliente / Propietario',
      clientName: 'Cliente / Propietario',
      supplier: 'Proveedor',
      supplierId: 'Proveedor',
      supplierName: 'Proveedor',
      driver: 'Operador del Transporte',
      driverName: 'Operador del Transporte',
      plates: 'Placas (Tractor / Caja)',
      tractorPlates: 'Placas del Tracto',
      boxPlates: 'Placas de la Caja',
      carrier: 'Línea Transportista',
      carrierId: 'Línea Transportista',
      carrierName: 'Línea Transportista',
      storageLocation: 'Bahía Asignada de Almacenaje',
      storageLocationId: 'Bahía Asignada de Almacenaje',
      locationCode: 'Ubicación de Almacén',
      sourceLocation: 'Ubicación Origen',
      source_location: 'Ubicación Origen',
      origin: 'Ubicación Origen',
      targetLocation: 'Ubicación Destino',
      target_location: 'Ubicación Destino',
      destination: 'Ubicación Destino',
      palletCode: 'Código de Tarima (UA)',
      pallet_code: 'Código de Tarima (UA)',
      lotNumber: 'Número de Lote',
      lot_number: 'Número de Lote',
      lot: 'Número de Lote',
      piecesPerPallet: 'Piezas por Tarima',
      pieces_per_pallet: 'Piezas por Tarima',
      totalPallets: 'Tarimas Totales (UAs)',
      pallets: 'Tarimas Totales (UAs)',
      totalPieces: 'Piezas Totales',
      pieces: 'Piezas Totales',
      leader: 'Líder de Turno Responsable',
      leaderAuthorizedBy: 'Líder de Turno Responsable',
      sku: 'Código SKU / Producto',
      skuId: 'Código SKU / Producto',
      skuCode: 'Código SKU / Producto',
      palletType: 'Tipo de Tarima',
      pallet_type: 'Tipo de Tarima',
      observations: 'Observaciones',
      folio: 'Folio de Operación',
      transferredBy: 'Operador Responsable',
      transferred_by: 'Operador Responsable',
      forkliftOperator: 'Operador de Montacargas',
      operator: 'Operador de Montacargas',
      elaborationDate: 'Fecha de Elaboración',
      expirationDate: 'Fecha de Caducidad',
      sealNumber: 'Número de Sello / Marchamo',
    };
    return map[clean] || clean;
  }

  formatFieldValue(field: string, value: any): string {
    if (value === null || value === undefined || value === '' || value === 'null' || value === 'N/A') {
      return 'Sin especificar';
    }
    const str = String(value).trim();
    const map: Record<string, string> = {
      REGISTERED: 'Registrado en Caseta',
      ASSIGNED: 'Andén Asignado / Notificado a Terminal',
      IN_PROGRESS: 'En Descarga Inbound',
      DISCHARGED: 'Descarga Finalizada (Por Auditar)',
      COMPLETED: 'Descarga Finalizada / En Stock',
      CANCELLED: 'Cancelado',
      DRAFT: 'Borrador Guardado',
      PENDING: 'Pendiente',
      DISPATCHED: 'Despachado / Salida Confirmada',
      MADERA_ESTANDAR: 'Madera Estándar (40x48)',
      PLASTICO: 'Plástico Higiénico',
      CHEP: 'Tarima CHEP Azul',
      EURO: 'Euro-Tarima',
      true: 'Sí / Conforme',
      false: 'No / Sin registro',
    };
    return map[str] || str;
  }

  // Genera un Folio Consecutivo de Recepción (ej. 26510)
  generateNextReceptionFolio(): string {
    const folioStr = this.nextFolioNumber().toString();
    this.nextFolioNumber.update((v) => v + 1);
    return folioStr;
  }

  // Guarda la Pre-Recepción en Backend con sincronización reactiva
  createCheckInBackend(data: CheckInCasetaData): Observable<ReceptionHeader> {
    const session = this.movementsApi.getSessionOrg();
    const orgId = session.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const branchId = session.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

    const clientItem = this.clientsSignal().find((c) => c.code === data.clientCode || c.name === data.client);
    const clientId = (clientItem && isUuid(clientItem.code)) 
      ? clientItem.code 
      : (isUuid(data.clientCode) ? data.clientCode : 'c73f0907-9fa5-4bdf-87db-2eb5e7683938');

    const carrierItem = this.carrierLinesSignal().find((c) => c.code === data.carrierLineCode || c.name === data.carrierLine);
    const carrierId = (carrierItem && isUuid(carrierItem.code))
      ? carrierItem.code
      : (isUuid(data.carrierLineCode) ? data.carrierLineCode : null);

    const opItem = this.forkliftOperators().find((o) => o.id === data.forkliftOperatorCode || o.code === data.forkliftOperatorCode || o.name === data.forkliftOperator);
    const forkliftOperatorId = (opItem && opItem.id && isUuid(opItem.id))
      ? opItem.id
      : (isUuid(data.forkliftOperatorCode) ? data.forkliftOperatorCode : null);

    const rampItem = this.rampsSignal().find(
      (r) =>
        r.code === data.rampCode ||
        r.rampNumber === Number(data.rampNumber) ||
        r.name === `Rampa ${String(data.rampNumber).padStart(2, '0')}` ||
        r.id === data.rampCode
    );
    const matchedRampLoc = (this.lastFetchedLocations || []).find((l: any) =>
      (l.type === 'RAMP' || l.sectionCode === 'SEC-RAMP') && (
        l.code === `LOC-RAMP-${String(data.rampNumber).padStart(2, '0')}` ||
        l.code === data.rampCode ||
        l.position === `R${String(data.rampNumber).padStart(2, '0')}` ||
        l.name === `Rampa ${String(data.rampNumber).padStart(2, '0')}` ||
        l.id === data.rampCode
      )
    );
    const rampId = (rampItem && isUuid(rampItem.id))
      ? rampItem.id
      : (matchedRampLoc && isUuid(matchedRampLoc.id)
          ? matchedRampLoc.id
          : (isUuid(data.rampCode) ? data.rampCode : null));

    // Normalizar hora a formato HH:mm:ss 24h
    let receptionTime = data.receptionTime ? data.receptionTime.trim() : '09:00:00';
    if (receptionTime.includes('p.m.') || receptionTime.includes('p. m.')) {
      const match = receptionTime.match(/(\d+):(\d+)/);
      if (match) {
        let hr = parseInt(match[1], 10);
        if (hr < 12) hr += 12;
        receptionTime = `${String(hr).padStart(2, '0')}:${match[2]}:00`;
      }
    } else if (receptionTime.includes('a.m.') || receptionTime.includes('a. m.')) {
      const match = receptionTime.match(/(\d+):(\d+)/);
      if (match) {
        let hr = parseInt(match[1], 10);
        if (hr === 12) hr = 0;
        receptionTime = `${String(hr).padStart(2, '0')}:${match[2]}:00`;
      }
    }
    if (receptionTime.length === 5) {
      receptionTime = `${receptionTime}:00`;
    }

    const seals: string[] = [];
    const rawSeals: string[] = (data.sealNumbers && data.sealNumbers.length > 0)
      ? data.sealNumbers
      : (data.sealNumber ? [data.sealNumber] : []);

    rawSeals.forEach((s: string) => {
      if (s && s.trim()) {
        s.split(',').map((p) => p.trim().toUpperCase()).filter((p) => p.length > 0).forEach((item) => {
          if (!seals.includes(item)) {
            seals.push(item);
          }
        });
      }
    });

    const payload = {
      organizationId: orgId,
      branchId: branchId,
      clientId: clientId,
      clientCode: data.clientCode,
      clientName: data.client,
      carrierId: carrierId,
      carrierLineCode: data.carrierLineCode,
      carrierLine: data.carrierLine,
      forkliftOperatorId: forkliftOperatorId,
      rampId: rampId,
      rampNumber: data.rampNumber || (rampItem ? rampItem.rampNumber : 1),
      rampCode: data.rampCode || (rampItem ? rampItem.code : 'LOC-RAMP-01'),
      docNumber: data.docNumber,
      docDate: data.docDate || new Date().toISOString().slice(0, 10),
      receptionTime: receptionTime,
      driverName: data.driverName,
      tractorPlates: data.tractorPlates,
      boxPlates: data.boxPlates,
      lotNumber: data.lotNumber || null,
      elaborationDate: data.elaborationDate || null,
      expirationDate: data.expirationDate || null,
      sealNumbers: seals,
      observations: data.observations || '',
    };

    return this.movementsApi.createCheckIn(payload).pipe(
      map((res: any) => {
        const header: ReceptionHeader = {
          id: res.id,
          folio: res.folio || data.docNumber,
          status: (res.status as any) || 'REGISTERED',
          checkIn: {
            ...data,
            carrierLine: res.carrierName || data.carrierLine,
            client: res.clientName || data.client,
          },
          lotNumber: res.lotNumber || data.lotNumber || '',
          elaborationDate: res.elaborationDate || data.elaborationDate || '',
          expirationDate: res.expirationDate || data.expirationDate || '',
          productId: res.skuCode || res.productSku || '',
          productName: res.productDescription || res.productName || '',
          supplierName: res.supplierName || '',
          storageLocation: res.storageLocationCode || res.storageLocationName || res.storageLocation || 'Pasillo A - Rack 01 - Nivel 1',
          storageLocationId: res.storageLocationId || '',
          storageLocationCode: res.storageLocationCode || '',
          piecesPerPallet: res.piecesPerPallet != null ? Number(res.piecesPerPallet) : 0,
          selectedPalletType: (res.palletType as PalletType) || ('' as any),
          observations: res.observations || '',
          pallets: (res.pallets || []).map((p: any) => ({
            id: p.id,
            palletNumber: p.palletNumber,
            palletCode: p.palletCode,
            productId: p.productSku,
            description: p.productDescription,
            pieces: p.pieces,
            palletTypeId: p.palletType,
            status: p.status,
            observations: p.observations,
          })),
          createdAt: res.createdAt ? String(res.createdAt).substring(11, 16) : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          capturedBy: res.createdBy || 'Caseta de Seguridad',
        };

        this.receptionsSignal.update((list) => {
          const filtered = list.filter((r) => r.folio !== header.folio && r.id !== header.id);
          return [header, ...filtered];
        });

        this.addReceptionAudit(header.folio, {
          id: `aud-rec-reg-${Date.now()}`,
          action: 'RECEPCION_CREADA',
          actionLabel: 'Pre-Recepción Registrada en Caseta',
          username: res.createdBy || 'Caseta de Seguridad',
          timestamp: new Date().toLocaleString('es-MX'),
          details: [
            { fieldName: 'Línea Transportadora', newValue: data.carrierLine },
            { fieldName: 'Rampa', newValue: `Rampa ${data.rampNumber}` },
            { fieldName: 'Placas Tracto / Caja', newValue: `${data.tractorPlates} / ${data.boxPlates}` },
          ],
        });

        return header;
      })
    );
  }

  // Guarda la Pre-Salida (Carga / Embarque) en Backend con estatus REGISTERED
  createOutboundCheckInBackend(data: CheckInCasetaData): Observable<WarehouseOutbound> {
    const session = this.movementsApi.getSessionOrg();
    const orgId = session.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';
    const branchId = session.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936';

    const clientItem = this.clientsSignal().find((c) => c.code === data.clientCode || c.name === data.client);
    const clientId = (clientItem && isUuid(clientItem.code)) 
      ? clientItem.code 
      : (isUuid(data.clientCode) ? data.clientCode : 'c73f0907-9fa5-4bdf-87db-2eb5e7683938');

    const carrierItem = this.carrierLinesSignal().find((c) => c.code === data.carrierLineCode || c.name === data.carrierLine);
    const carrierId = (carrierItem && isUuid(carrierItem.code))
      ? carrierItem.code
      : (isUuid(data.carrierLineCode) ? data.carrierLineCode : null);

    const rampItem = this.rampsSignal().find(
      (r) =>
        r.code === data.rampCode ||
        r.rampNumber === Number(data.rampNumber) ||
        r.name === `Rampa ${String(data.rampNumber).padStart(2, '0')}` ||
        r.id === data.rampCode
    );
    const matchedRampLoc = (this.lastFetchedLocations || []).find((l: any) =>
      (l.type === 'RAMP' || l.sectionCode === 'SEC-RAMP') && (
        l.code === `LOC-RAMP-${String(data.rampNumber).padStart(2, '0')}` ||
        l.code === data.rampCode ||
        l.position === `R${String(data.rampNumber).padStart(2, '0')}` ||
        l.name === `Rampa ${String(data.rampNumber).padStart(2, '0')}` ||
        l.id === data.rampCode
      )
    );
    const rampId = (rampItem && isUuid(rampItem.id))
      ? rampItem.id
      : (matchedRampLoc && isUuid(matchedRampLoc.id)
          ? matchedRampLoc.id
          : (isUuid(data.rampCode) ? data.rampCode : null));

    const seals: string[] = [];
    const rawSeals: string[] = (data.sealNumbers && data.sealNumbers.length > 0)
      ? data.sealNumbers
      : (data.sealNumber ? [data.sealNumber] : []);

    rawSeals.forEach((s: string) => {
      if (s && s.trim()) {
        s.split(',').map((p) => p.trim().toUpperCase()).filter((p) => p.length > 0).forEach((item) => {
          if (!seals.includes(item)) {
            seals.push(item);
          }
        });
      }
    });

    const payload = {
      organizationId: orgId,
      branchId: branchId,
      clientId: clientId,
      clientCode: data.clientCode,
      clientName: data.client,
      carrierId: carrierId,
      carrierName: data.carrierLine,
      carrierLineCode: data.carrierLineCode,
      carrierLine: data.carrierLine,
      rampId: rampId,
      rampNumber: data.rampNumber || (rampItem ? rampItem.rampNumber : 1),
      rampCode: data.rampCode || (rampItem ? rampItem.code : 'LOC-RAMP-01'),
      transportType: 'TRAILER',
      driverName: data.driverName,
      tractorPlates: data.tractorPlates,
      boxPlates: data.boxPlates,
      economicNumber: '',
      boxEconomicNumber: '',
      sealNumber: seals.join(', '),
      remisionNo: data.docNumber,
      observations: data.observations || '',
      status: 'REGISTERED',
      selectedItemIds: [],
    };

    return this.movementsApi.createOutbound(payload).pipe(
      map((res: any) => {
        const outbound: WarehouseOutbound = {
          id: res.id,
          folio: res.folio || data.docNumber,
          status: 'REGISTERED',
          clientCode: res.clientId || data.clientCode,
          clientName: res.clientName || data.client,
          destinationId: res.destinationId || '',
          destinationName: res.destinationName || '',
          destinationAddress: res.destinationAddress || '',
          carrierCode: res.carrierId || data.carrierLineCode,
          carrierName: res.carrierName || data.carrierLine,
          rampNumber: data.rampNumber || (rampItem ? rampItem.rampNumber : 1),
          rampCode: data.rampCode || (rampItem ? rampItem.code : 'LOC-RAMP-01'),
          driverName: data.driverName,
          economicNumber: '',
          boxEconomicNumber: '',
          tractorPlates: data.tractorPlates,
          boxPlates: data.boxPlates,
          transportType: (res.transportType || 'TRAILER') as TransportType,
          sealNumber: seals.join(', '),
          remisionNo: res.remisionNo || data.docNumber,
          observations: data.observations || '',
          items: [],
          totalPallets: 0,
          totalPieces: 0,
          distinctSkus: 0,
          dispatchedAt: '',
          dispatchedBy: res.createdBy || 'Caseta de Seguridad',
          timestamp: res.createdAt ? String(res.createdAt).substring(11, 16) : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        };

        this.outboundsSignal.update((list) => {
          const filtered = list.filter((o) => o.folio !== outbound.folio && o.id !== outbound.id);
          return [outbound, ...filtered];
        });

        return outbound;
      })
    );
  }

  // Obtiene el número consecutivo máximo de tarimas registrado entre todas las recepciones cargadas
  getGlobalMaxPalletNumber(): number {
    let maxNum = 0;
    const list = this.receptionsSignal();
    for (const r of list) {
      if (r.pallets && Array.isArray(r.pallets)) {
        for (const p of r.pallets) {
          if (p.palletNumber && Number(p.palletNumber) > maxNum) {
            maxNum = Number(p.palletNumber);
          }
        }
      }
    }
    return maxNum;
  }

  // Mapea un ReceptionResponse o ReceptionSummaryResponse a ReceptionHeader completo
  mapReceptionResponseToHeader(r: any): ReceptionHeader {
    if (!r) return {} as ReceptionHeader;
    const hasSkuOrPallets = !!(r.skuId || r.skuCode || r.productSku || r.productId || (r.pallets && r.pallets.length > 0));
    const pType = hasSkuOrPallets ? ((r.palletType as PalletType) || (r.selectedPalletType as PalletType) || ('' as any)) : ('' as any);
    const pallets = (r.pallets || []).map((p: any) => ({
      id: p.id || p.itemId || `pal-${Date.now()}-${Math.random()}`,
      palletNumber: p.palletNumber,
      palletCode: p.palletCode || p.sscc || '',
      productId: p.skuCode || r.skuCode || r.productId || '',
      description: p.description || p.productDescription || r.productName || '',
      supplierName: p.supplierName || r.supplierName || '',
      pieces: p.pieces != null ? Number(p.pieces) : (r.piecesPerPallet || 0),
      palletTypeId: p.palletTypeId || p.palletType || pType || 'MADERA_ESTANDAR',
      palletTypeLabel: p.palletTypeLabel || (pType ? (PALLET_TYPE_LABELS as Record<string, string>)[pType] : '') || 'Madera Estándar',
      observations: p.observations || '',
      status: p.status || 'SCANNED',
      lotNumber: p.lotNumber || r.lotNumber || '',
      expirationDate: p.expirationDate || r.expirationDate || '',
      docNumber: resolvedDoc || '',
    }));

    const resolvedDoc =
      r.docNumber ||
      r.doc_number ||
      r.checkIn?.docNumber ||
      r.checkIn?.doc_number ||
      r.remisionNo ||
      r.remision_no ||
      r.documentNumber ||
      '';

    let opName = r.forkliftOperatorName || r.forkliftOperator || r.checkIn?.forkliftOperator || '';
    if (opName && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(opName)) {
      const match = (this.forkliftOperatorsSignal() || []).find((o: any) => o.id === opName || o.code === opName);
      if (match) opName = match.name;
    }

    let supName = r.supplierName || '';
    if (supName && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supName)) {
      const match = (this.suppliersSignal() || []).find((s: any) => s.id === supName || s.code === supName);
      if (match) supName = match.name || supName;
    }

    return {
      id: r.id,
      folio: r.folio || '',
      status: r.status || 'REGISTERED',
      checkIn: {
        carrierLine: r.carrierName || r.carrierLine || r.checkIn?.carrierLine || '',
        carrierLineCode: r.carrierId || r.carrierLineCode || r.checkIn?.carrierLineCode || '',
        receptionTime: r.receptionTime ? String(r.receptionTime).substring(0, 5) : (r.checkIn?.receptionTime || ''),
        docNumber: String(resolvedDoc || '').trim(),
        docDate: r.docDate || r.checkIn?.docDate || '',
        client: r.clientName || r.client || r.checkIn?.client || '',
        clientCode: r.clientId || r.clientCode || r.checkIn?.clientCode || '',
        rampNumber: r.rampName ? (parseInt(String(r.rampName).replace(/\D/g, ''), 10) || 1) : (r.rampNumber || r.checkIn?.rampNumber || 1),
        rampCode: r.rampId || r.rampCode || r.checkIn?.rampCode || '',
        forkliftOperator: opName,
        forkliftOperatorCode: r.forkliftOperatorId || r.forkliftOperatorCode || r.checkIn?.forkliftOperatorCode || '',
        driverName: r.driverName || r.checkIn?.driverName || '',
        tractorPlates: r.tractorPlates || r.checkIn?.tractorPlates || '',
        boxPlates: r.boxPlates || r.checkIn?.boxPlates || '',
        sealNumber: (r.sealNumbers && r.sealNumbers.length > 0) ? r.sealNumbers.join(', ') : (r.sealNumber || r.checkIn?.sealNumber || ''),
        sealNumbers: (r.sealNumbers && r.sealNumbers.length > 0) ? r.sealNumbers : (r.sealNumber ? [r.sealNumber] : (r.checkIn?.sealNumbers || [])),
      },
      lotNumber: r.lotNumber || r.checkIn?.lotNumber || '',
      elaborationDate: r.elaborationDate || r.checkIn?.elaborationDate || '',
      expirationDate: r.expirationDate || r.checkIn?.expirationDate || '',
      productId: r.skuCode || r.skuId || r.productId || '',
      skuCode: r.skuCode || '',
      productName: r.productName || '',
      supplierName: supName,
      piecesPerPallet: r.piecesPerPallet != null ? Number(r.piecesPerPallet) : (pallets.length > 0 ? pallets[0].pieces : 0),
      selectedPalletType: pType,
      storageLocation: r.storageLocationCode || r.storageLocationName || r.storageLocation || 'Pasillo A - Rack 01 - Nivel 1',
      storageLocationId: r.storageLocationId || '',
      storageLocationCode: r.storageLocationCode || '',
      observations: (r.observations || '').replace(/\s*\|\s*Cambio (?:de )?Remisión:[^|]*/gi, '').trim(),
      pallets: pallets,
      lots: r.lots || [],
      createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('es-MX') : (r.checkIn?.receptionTime || ''),
      completedAt: r.completedAt ? new Date(r.completedAt).toLocaleString('es-MX') : undefined,
      cancelledAt: r.cancelledAt ? new Date(r.cancelledAt).toLocaleString('es-MX') : undefined,
      capturedBy: r.capturedBy || r.createdBy || 'Caseta de Seguridad',
      leaderAuthorizedBy: r.leaderAuthorizedBy || '',
      cancellationReason: r.cancellationReason || '',
    } as ReceptionHeader;
  }

  // Persiste avances de descarga (parámetros y tarimas) en el Backend (wms.warehouse_reception_pallets)
  saveDraftReceptionBackend(
    receptionId: string,
    formVals: any,
    pallets: ReceptionPalletItem[],
    productsList: any[],
    suppliersList: any[]
  ): Observable<ReceptionHeader> {
    const prodItem = productsList.find(
      (p) =>
        (formVals.productId && (p.code === formVals.productId || p.id === formVals.productId)) ||
        (p.name && formVals.productName && p.name.trim().toLowerCase() === formVals.productName.trim().toLowerCase()) ||
        (p.code && formVals.productName && formVals.productName.includes(p.code))
    );
    const skuId = (prodItem && isUuid(prodItem.id))
      ? prodItem.id
      : (isUuid(formVals.productId) ? formVals.productId : null);

    const supItem = suppliersList.find(
      (s) =>
        s.name === formVals.supplierName ||
        s.commercialName === formVals.supplierName ||
        s.code === formVals.supplierName ||
        s.id === formVals.supplierId
    );
    const supplierId = (supItem && isUuid(supItem.id))
      ? supItem.id
      : (supItem && isUuid(supItem.code)
          ? supItem.code
          : (isUuid(formVals.supplierId) ? formVals.supplierId : null));

    const paramPayload = {
      skuId: skuId,
      supplierId: supplierId,
      lotNumber: formVals.lotNumber,
      elaborationDate: formVals.elaborationDate || null,
      expirationDate: formVals.expirationDate || null,
      piecesPerPallet: formVals.piecesPerPallet != null ? Number(formVals.piecesPerPallet) : 0,
      palletType: formVals.selectedPalletType || null,
      storageLocationId: formVals.storageLocationId || null,
      forkliftOperatorId: formVals.forkliftOperatorId || null,
      forkliftOperatorName: formVals.forkliftOperator || formVals.forkliftOperatorName || null,
      rampId: formVals.rampId || null,
      rampNumber: formVals.rampNumber || null,
      rampCode: formVals.rampCode || null,
      status: formVals.status || null,
      observations: formVals.observations || '',
    };

    return this.movementsApi.updateReceptionParameters(receptionId, paramPayload).pipe(
      concatMap(() => {
        if (pallets && pallets.length > 0) {
          const palletPayload = pallets.map((p) => ({
            palletNumber: p.palletNumber,
            palletCode: p.palletCode,
            pieces: p.pieces,
            palletType: p.palletTypeId,
            observations: p.observations || '',
            lotNumber: p.lotNumber || formVals.lotNumber || null,
            expirationDate: p.expirationDate || formVals.expirationDate || null,
          }));
          return this.movementsApi.addReceptionPallets(receptionId, palletPayload).pipe(
            catchError((_: any) => of([]))
          );
        } else {
          return of([]);
        }
      }),
      concatMap(() => this.movementsApi.getReceptionById(receptionId)),
      map((freshRec: any) => {
        const mapped = this.mapReceptionResponseToHeader(freshRec);
        this.updateReception(receptionId, mapped, true);
        return mapped;
      })
    );
  }

  // Persiste modificaciones de caseta (placas, transportista, chofer, remisión, rampa, sellos) en el Backend (wms.warehouse_receptions)
  updateCasetaCheckInBackend(
    receptionId: string,
    checkIn: CheckInCasetaData
  ): Observable<ReceptionHeader> {
    const list = this.receptionsSignal();
    const cleanKey = (receptionId || '').trim();
    const current = list.find(
      (r) => (r.folio && r.folio.trim() === cleanKey) || (r.id && r.id.trim() === cleanKey)
    );
    const resolvedId = (current?.id && isUuid(current.id)) ? current.id : (isUuid(receptionId) ? receptionId : null);

    const payload = {
      tractorPlates: checkIn.tractorPlates,
      boxPlates: checkIn.boxPlates,
      driverName: checkIn.driverName,
      docNumber: checkIn.docNumber,
      docDate: checkIn.docDate || null,
      receptionTime: checkIn.receptionTime ? `${checkIn.receptionTime}:00`.slice(0, 8) : null,
      carrierId: isUuid(checkIn.carrierLineCode || '') ? checkIn.carrierLineCode : null,
      carrierLineCode: checkIn.carrierLineCode || null,
      carrierLine: checkIn.carrierLine || null,
      clientId: isUuid(checkIn.clientCode || '') ? checkIn.clientCode : null,
      clientCode: checkIn.clientCode || null,
      clientName: checkIn.client || null,
      rampNumber: checkIn.rampNumber || 1,
      rampCode: checkIn.rampCode || `LOC-RAMP-${String(checkIn.rampNumber || 1).padStart(2, '0')}`,
      sealNumbers: checkIn.sealNumbers && checkIn.sealNumbers.length > 0 ? checkIn.sealNumbers : (checkIn.sealNumber ? [checkIn.sealNumber] : []),
      piecesPerPallet: current?.piecesPerPallet != null ? Number(current.piecesPerPallet) : 0,
      observations: checkIn.observations || current?.observations || '',
    };

    if (resolvedId) {
      return this.movementsApi.updateReceptionParameters(resolvedId, payload).pipe(
        map((res: any) => {
          const mapped = this.mapReceptionResponseToHeader(res);
          this.updateReception(resolvedId, mapped, true);
          return mapped;
        }),
        catchError(() => {
          const fallback = this.updateReception(receptionId, { checkIn }, true);
          return of(fallback || current || ({} as ReceptionHeader));
        })
      );
    } else {
      const fallback = this.updateReception(receptionId, { checkIn }, true);
      return of(fallback || current || ({} as ReceptionHeader));
    }
  }

  // Completa y autoriza formalmente la recepción F01 en el Backend
  completeReceptionBackend(
    receptionId: string,
    formVals: any,
    pallets: ReceptionPalletItem[],
    productsList: any[],
    suppliersList: any[],
    leaderName: string,
    leaderUser?: string,
    leaderPass?: string
  ): Observable<ReceptionHeader> {
    return this.saveDraftReceptionBackend(receptionId, formVals, pallets, productsList, suppliersList).pipe(
      concatMap(() => {
        const completePayload = {
          leaderUsername: leaderUser || 'admin',
          leaderPassword: leaderPass || 'admin123',
          observations: `Autorizado por ${leaderName}. ${formVals.observations || ''}`.trim(),
        };
        return this.movementsApi.completeReception(receptionId, completePayload);
      }),
      map((res: any) => {
        const mapped = this.mapReceptionResponseToHeader(res);
        mapped.status = 'COMPLETED';
        mapped.completedAt = mapped.completedAt || new Date().toLocaleString('es-MX');
        mapped.leaderAuthorizedBy = leaderName || mapped.leaderAuthorizedBy;
        this.updateReception(receptionId, mapped, true);
        this.addReceptionAudit(mapped.folio, {
          id: `aud-rec-comp-${Date.now()}`,
          action: 'RECEPCION_COMPLETADA',
          actionLabel: 'Descarga Finalizada y Cerrada en WMS',
          username: leaderName || 'Líder de Almacén',
          timestamp: new Date().toLocaleString('es-MX'),
          details: [
            { fieldName: 'Estatus', oldValue: 'REGISTERED', newValue: 'COMPLETED' },
            { fieldName: 'Total Tarimas', newValue: String(mapped.pallets?.length || 0) },
          ],
        });
        return mapped;
      })
    );
  }

  // Guarda la Pre-Recepción (Caseta - Local)
  saveCheckIn(data: CheckInCasetaData, assignedFolio: string): ReceptionHeader {
    const newHeader: ReceptionHeader = {
      folio: assignedFolio,
      status: 'REGISTERED',
      checkIn: data,
      lotNumber: data.lotNumber || '',
      elaborationDate: data.elaborationDate || '',
      expirationDate: data.expirationDate || '',
      productId: '',
      productName: '',
      supplierName: '',
      piecesPerPallet: 0,
      selectedPalletType: '' as any,
      observations: '',
      pallets: [],
      createdAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      capturedBy: 'Caseta de Seguridad',
    };

    this.receptionsSignal.update((list) => [newHeader, ...list]);

    this.addReceptionAudit(assignedFolio, {
      id: `aud-rec-reg-${Date.now()}`,
      action: 'RECEPCION_CREADA',
      actionLabel: 'Pre-Recepción Registrada en Caseta',
      username: 'Caseta de Seguridad',
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Línea Transportadora', newValue: data.carrierLine },
        { fieldName: 'Rampa', newValue: `Rampa ${data.rampNumber}` },
        { fieldName: 'Placas Tracto / Caja', newValue: `${data.tractorPlates} / ${data.boxPlates}` },
      ],
    });

    return newHeader;
  }

  // Actualiza datos de una recepción en progreso (por folio o id)
  updateReception(folioOrId: string, partial: Partial<ReceptionHeader>, skipAudit = false): ReceptionHeader | null {
    const list = this.receptionsSignal();
    const cleanKey = (folioOrId || '').trim();
    const index = list.findIndex(
      (r) =>
        (r.folio && r.folio.trim() === cleanKey) ||
        (r.id && r.id.trim() === cleanKey)
    );

    if (index === -1) {
      if (partial.folio) {
        this.receptionsSignal.update((arr) => [partial as ReceptionHeader, ...arr]);
      }
      return partial as ReceptionHeader;
    }

    const updated: ReceptionHeader = {
      ...list[index],
      ...partial,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.receptionsSignal.set(newArr);

    if (!skipAudit && partial.storageLocation) {
      this.addReceptionAudit(updated.folio, {
        id: `aud-rec-upd-${Date.now()}`,
        action: 'RECEPCION_ACTUALIZADA',
        actionLabel: 'Actualización de Datos de Recepción',
        username: partial.capturedBy || updated.capturedBy || 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [
          { fieldName: 'Lugar de Almacenaje', newValue: partial.storageLocation || 'Andén / Rampa' },
          { fieldName: 'Total Tarimas', newValue: String(updated.pallets?.length || 0) },
        ],
      });
    }

    return updated;
  }

  // Transición 1 -> 2: Asignación a Montacarguista y Andén (REGISTERED -> ASSIGNED)
  assignReception(
    folioOrId: string,
    formVals: any,
    productsList: any[],
    suppliersList: any[],
    assignedBy: string
  ): Observable<ReceptionHeader> {
    const list = this.receptionsSignal();
    const cleanKey = (folioOrId || '').trim();
    const current = list.find(
      (r) => (r.folio && r.folio.trim() === cleanKey) || (r.id && r.id.trim() === cleanKey)
    );

    const recId = current?.id || folioOrId;
    const enrichedFormVals = {
      ...formVals,
      status: 'ASSIGNED',
    };
    return this.saveDraftReceptionBackend(recId, enrichedFormVals, current?.pallets || [], productsList, suppliersList).pipe(
      map((rec) => {
        const updated = this.updateReception(
          rec.folio,
          {
            ...rec,
            status: 'ASSIGNED',
            lotNumber: formVals.lotNumber || rec.lotNumber,
            elaborationDate: formVals.elaborationDate || rec.elaborationDate,
            expirationDate: formVals.expirationDate || rec.expirationDate,
            productId: formVals.productId || rec.productId,
            productName: formVals.productName || rec.productName,
            supplierName: formVals.supplierName || rec.supplierName,
            piecesPerPallet: formVals.piecesPerPallet || rec.piecesPerPallet,
            selectedPalletType: formVals.selectedPalletType || rec.selectedPalletType,
            observations: formVals.observations || rec.observations,
            checkIn: {
              ...rec.checkIn,
              forkliftOperator: formVals.forkliftOperator || rec.checkIn.forkliftOperator,
              rampNumber: formVals.rampNumber || rec.checkIn.rampNumber,
            },
          },
          true
        );

        this.addReceptionAudit(rec.folio, {
          id: `aud-rec-asg-${Date.now()}`,
          action: 'RECEPCION_ASIGNADA',
          actionLabel: 'Andén y Montacarguista Asignados',
          username: assignedBy || 'Administrador WMS',
          timestamp: new Date().toLocaleString('es-MX'),
          details: [
            { fieldName: 'Estatus', oldValue: 'REGISTERED', newValue: 'ASSIGNED' },
            { fieldName: 'Rampa Asignada', newValue: `Rampa ${formVals.rampNumber || rec.checkIn.rampNumber}` },
            { fieldName: 'Montacarguista', newValue: formVals.forkliftOperator || rec.checkIn.forkliftOperator },
            { fieldName: 'Bahía WMS', newValue: rec.storageLocation || 'Auto-Slotting' },
          ],
        });

        return updated || rec;
      })
    );
  }

  // Transición 2 -> 3: Inicio de Descarga en Terminal Montacarguista (ASSIGNED -> IN_PROGRESS)
  startDischarge(folioOrId: string, operatorName: string): Observable<ReceptionHeader> {
    const list = this.receptionsSignal();
    const cleanKey = (folioOrId || '').trim();
    const current = list.find(
      (r) => (r.folio && r.folio.trim() === cleanKey) || (r.id && r.id.trim() === cleanKey)
    );
    const recId = current?.id || folioOrId;

    const payload = {
      status: 'IN_PROGRESS',
      forkliftOperatorName: operatorName || current?.checkIn?.forkliftOperator || null,
      forkliftOperatorId: current?.checkIn?.forkliftOperatorCode || null,
      rampNumber: current?.checkIn?.rampNumber || null,
      rampCode: current?.checkIn?.rampCode || null,
      lotNumber: current?.lotNumber || null,
      piecesPerPallet: current?.piecesPerPallet || 0,
      palletType: current?.selectedPalletType || null,
      storageLocationId: current?.storageLocationId || null,
    };

    return this.movementsApi.updateReceptionParameters(recId, payload).pipe(
      concatMap(() => this.movementsApi.getReceptionById(recId)),
      map((freshRec: any) => {
        const mapped = this.mapReceptionResponseToHeader(freshRec);
        mapped.status = 'IN_PROGRESS';
        this.updateReception(recId, mapped, true);
        this.addReceptionAudit(mapped.folio, {
          id: `aud-rec-inp-${Date.now()}`,
          action: 'DESCARGA_INICIADA',
          actionLabel: 'Descarga Iniciada en Terminal de Montacargas',
          username: operatorName || mapped.checkIn?.forkliftOperator || 'Montacarguista',
          timestamp: new Date().toLocaleString('es-MX'),
          details: [
            { fieldName: 'Estatus', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS' },
            { fieldName: 'Operador en Andén', newValue: operatorName || mapped.checkIn?.forkliftOperator || 'Montacarguista' },
          ],
        });
        return mapped;
      }),
      catchError(() => {
        const updated = this.updateReception(
          folioOrId,
          {
            status: 'IN_PROGRESS',
          },
          true
        );
        return of(updated || (current as ReceptionHeader));
      })
    );
  }

  // Transición 3 -> 4: Montacarguista Concluye Descarga Física (IN_PROGRESS -> DISCHARGED)
  finishDischarge(
    folioOrId: string,
    pallets: ReceptionPalletItem[],
    operatorName: string,
    formVals?: any,
    productsList: any[] = [],
    suppliersList: any[] = []
  ): Observable<ReceptionHeader> {
    const list = this.receptionsSignal();
    const cleanKey = (folioOrId || '').trim();
    const current = list.find(
      (r) => (r.folio && r.folio.trim() === cleanKey) || (r.id && r.id.trim() === cleanKey)
    );
    const recId = current?.id || folioOrId;

    const enrichedFormVals = {
      ...(formVals || {}),
      status: 'DISCHARGED',
      forkliftOperator: operatorName || current?.checkIn?.forkliftOperator || formVals?.forkliftOperator,
      forkliftOperatorName: operatorName || current?.checkIn?.forkliftOperator || formVals?.forkliftOperator,
      rampNumber: formVals?.rampNumber || current?.checkIn?.rampNumber,
      lotNumber: formVals?.lotNumber || current?.lotNumber,
      productId: formVals?.productId || current?.productId,
      supplierName: formVals?.supplierName || current?.supplierName,
      piecesPerPallet: formVals?.piecesPerPallet || current?.piecesPerPallet,
      selectedPalletType: formVals?.selectedPalletType || current?.selectedPalletType,
    };

    return this.saveDraftReceptionBackend(recId, enrichedFormVals, pallets, productsList, suppliersList).pipe(
      map((mapped) => {
        mapped.status = 'DISCHARGED';
        this.updateReception(recId, mapped, true);
        const totalPieces = (pallets || []).reduce((sum, p) => sum + p.pieces, 0);
        this.addReceptionAudit(mapped.folio, {
          id: `aud-rec-dis-${Date.now()}`,
          action: 'DESCARGA_FINALIZADA',
          actionLabel: 'Descarga Física Concluida (Notificado a Mesa Administrativa)',
          username: operatorName || mapped.checkIn?.forkliftOperator || 'Montacarguista',
          timestamp: new Date().toLocaleString('es-MX'),
          details: [
            { fieldName: 'Estatus', oldValue: 'IN_PROGRESS', newValue: 'DISCHARGED' },
            { fieldName: 'Tarimas Descargadas', newValue: String((pallets || []).length) },
            { fieldName: 'Piezas Totales', newValue: `${totalPieces} PZAS` },
          ],
        });
        return mapped;
      }),
      catchError(() => {
        const updated = this.updateReception(
          folioOrId,
          {
            status: 'DISCHARGED',
            pallets: [...pallets],
          },
          true
        );
        return of(updated || (current as ReceptionHeader));
      })
    );
  }

  // Busca una recepción por Folio
  findReceptionByFolio(folio: string): ReceptionHeader | undefined {
    return this.receptionsSignal().find((r) => r.folio.trim() === folio.trim());
  }

  // Completa la Recepción (Alta de Recepción con Carga Rápida)
  completeReception(
    folio: string,
    lotNumber: string,
    elaborationDate: string,
    expirationDate: string,
    productId: string,
    productName: string,
    piecesPerPallet: number,
    selectedPalletType: PalletType,
    pallets: ReceptionPalletItem[],
    observations: string | undefined,
    capturedBy: string,
    leaderName: string
  ): ReceptionHeader | null {
    const list = this.receptionsSignal();
    const index = list.findIndex((r) => r.folio.trim() === folio.trim());

    if (index === -1) return null;

    const updated: ReceptionHeader = {
      ...list[index],
      status: 'COMPLETED',
      lotNumber,
      elaborationDate,
      expirationDate,
      productId,
      productName,
      piecesPerPallet,
      selectedPalletType,
      pallets: [...pallets],
      observations,
      completedAt: new Date().toLocaleString('es-MX'),
      capturedBy,
      leaderAuthorizedBy: leaderName,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.receptionsSignal.set(newArr);

    const totalPieces = pallets.reduce((sum, p) => sum + p.pieces, 0);

    this.addReceptionAudit(folio, {
      id: `aud-rec-comp-${Date.now()}`,
      action: 'RECEPCION_COMPLETADA',
      actionLabel: 'Descarga y Cierre de Recepción F01',
      username: capturedBy,
      authorizedBy: leaderName,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Lote de Fabricación', newValue: lotNumber },
        { fieldName: 'SKU / Producto', newValue: `${productId} - ${productName}` },
        { fieldName: 'Tarimas Descargadas', newValue: pallets.length.toString() },
        { fieldName: 'Piezas Totales', newValue: totalPieces.toLocaleString() },
      ],
    });

    return updated;
  }

  // Modifica el número de remisión/documento de la recepción con autorización
  changeRemision(
    folio: string,
    newDocNumber: string,
    reason: string,
    adminUser: string
  ): ReceptionHeader | null {
    const rec = this.findReceptionByFolio(folio);
    if (!rec) return null;

    const oldDoc = rec.checkIn?.docNumber || 'N/A';
    const updated = this.updateReception(
      folio,
      {
        checkIn: {
          ...rec.checkIn,
          docNumber: newDocNumber,
        },
      },
      true // skipAudit = true para no duplicar el evento genérico antes de REMISION_MODIFICADA
    );

    // 1. Actualizar lotes de inventario (inventoryBatchesSignal) en memoria de inmediato
    this.inventoryBatchesSignal.update((batches) =>
      batches.map((b) => {
        if (b.remisionNo === oldDoc || (rec.storageLocation && b.locationCode === rec.storageLocation)) {
          return { ...b, remisionNo: newDocNumber };
        }
        return b;
      })
    );

    // 2. Actualizar ubicaciones / bahías (locationsSignal)
    const locs = { ...this.locationsSignal() };
    Object.keys(locs).forEach((locCode) => {
      const loc = locs[locCode];
      let changed = false;
      const updatedPallets = loc.pallets.map((p) => {
        if (p.observations && p.observations.includes(oldDoc)) {
          changed = true;
          return { ...p, observations: p.observations.replace(oldDoc, newDocNumber) };
        }
        return p;
      });
      if (changed) {
        locs[locCode] = { ...loc, pallets: updatedPallets };
      }
    });
    this.locationsSignal.set(locs);

    this.addReceptionAudit(folio, {
      id: `aud-rec-rem-${Date.now()}`,
      action: 'REMISION_MODIFICADA',
      actionLabel: 'Modificación de No. de Remisión',
      username: adminUser,
      authorizedBy: adminUser,
      reason: reason,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'No. de Remisión / Documento', oldValue: oldDoc, newValue: newDocNumber },
      ],
    });

    // 3. Re-consultar el backend para actualizar inventory batches y recepciones frescas
    this.reloadInventoryBatches();
    this.reloadReceptions();

    return updated;
  }

  // Cancela Recepción (Compuerta de Seguridad)
  cancelReception(folio: string, justification: string, leaderName: string): ReceptionHeader | null {
    const list = this.receptionsSignal();
    const index = list.findIndex((r) => r.folio.trim() === folio.trim());

    if (index === -1) return null;

    const updated: ReceptionHeader = {
      ...list[index],
      status: 'CANCELLED',
      cancellationReason: justification,
      cancelledAt: new Date().toLocaleString('es-MX'),
      leaderAuthorizedBy: leaderName,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.receptionsSignal.set(newArr);

    this.addReceptionAudit(folio, {
      id: `aud-rec-canc-${Date.now()}`,
      action: 'RECEPCION_CANCELADA',
      actionLabel: 'Cancelación Extraordinaria con Autorización',
      username: leaderName,
      authorizedBy: leaderName,
      reason: justification,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Estatus', oldValue: 'COMPLETED', newValue: 'CANCELLED' },
        { fieldName: 'Motivo de Cancelación', newValue: justification },
      ],
    });

    return updated;
  }

  // Cancela Traspaso (Cambio de Almacén)
  cancelTransfer(folio: string, justification: string, adminName: string): WarehouseTransfer | null {
    const list = this.transfersSignal();
    const index = list.findIndex((t) => t.folio.trim() === folio.trim());
    if (index === -1) return null;

    const updated: WarehouseTransfer = {
      ...list[index],
      status: 'CANCELLED',
      cancellationReason: justification,
      cancelledAt: new Date().toLocaleString('es-MX'),
      cancelledBy: adminName,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.transfersSignal.set(newArr);

    this.addTransferAudit(folio, {
      id: `aud-tr-canc-${Date.now()}`,
      action: 'TRASPASO_CANCELADO',
      actionLabel: 'Cancelación de Reubicación de Inventario',
      username: adminName,
      authorizedBy: adminName,
      reason: justification,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Estatus', oldValue: 'COMPLETED', newValue: 'CANCELLED' },
        { fieldName: 'Motivo de Cancelación', newValue: justification },
      ],
    });

    return updated;
  }

  // Cancela Salida de Almacén (Outbound)
  cancelOutbound(folio: string, justification: string, adminName: string): WarehouseOutbound | null {
    const list = this.outboundsSignal();
    const index = list.findIndex((o) => o.folio.trim() === folio.trim());
    if (index === -1) return null;

    const target = list[index];
    const updated: WarehouseOutbound = {
      ...target,
      status: 'CANCELLED',
      cancellationReason: justification,
      cancelledAt: new Date().toLocaleString('es-MX'),
      cancelledBy: adminName,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.outboundsSignal.set(newArr);

    // Reintegrar UAs/Tarimas canceladas a stock disponible en memoria
    if (target.items && target.items.length > 0) {
      this.inventoryBatchesSignal.update((batches) => {
        const updatedBatches = [...batches];
        for (const item of target.items) {
          const existingBatch = updatedBatches.find(
            (b) =>
              b.productId === item.productId &&
              (b.lotNumber === item.lotNumber || !item.lotNumber)
          );
          if (existingBatch) {
            if (!existingBatch.pallets.some((p) => p.id === item.id || p.palletCode === item.palletCode)) {
              existingBatch.pallets.push({
                id: item.id,
                palletCode: item.palletCode,
                description: item.description,
                productId: item.productId,
                pieces: item.pieces,
                palletTypeId: (item.palletTypeId as PalletType) || 'MADERA_ESTANDAR',
                palletTypeLabel: item.palletTypeLabel || 'Madera Estándar',
              });
              existingBatch.availablePallets = existingBatch.pallets.length;
              existingBatch.totalPieces = existingBatch.pallets.reduce((s, p) => s + p.pieces, 0);
            }
          } else {
            updatedBatches.push({
              remisionNo: target.remisionNo || 'REM-RESTITUIDA',
              client: target.clientName || 'Cliente',
              productId: item.productId,
              productName: item.description,
              lotNumber: item.lotNumber || 'LOTE-RESTITUIDO',
              elaborationDate: '',
              expirationDate: item.expirationDate || '',
              availablePallets: 1,
              totalPieces: item.pieces,
              locationCode: item.locationCode || 'A-01-N1',
              isFifoSuggested: false,
              pallets: [
                {
                  id: item.id,
                  palletCode: item.palletCode,
                  description: item.description,
                  productId: item.productId,
                  pieces: item.pieces,
                  palletTypeId: (item.palletTypeId as PalletType) || 'MADERA_ESTANDAR',
                  palletTypeLabel: item.palletTypeLabel || 'Madera Estándar',
                },
              ],
            });
          }
        }
        return updatedBatches;
      });
    }

    this.addOutboundAudit(folio, {
      id: `aud-out-canc-${Date.now()}`,
      action: 'SALIDA_CANCELADA',
      actionLabel: 'Cancelación de Despacho Outbound',
      username: adminName,
      authorizedBy: adminName,
      reason: justification,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Estatus', oldValue: 'COMPLETED', newValue: 'CANCELLED' },
        { fieldName: 'Motivo de Cancelación', newValue: justification },
        { fieldName: 'UAs Reintegradas a Stock', newValue: (target.items?.length || 0).toString() },
      ],
    });

    // Sincronizar con el backend
    this.reloadInventoryBatches();

    return updated;
  }

  // Actualiza datos de una salida de almacén (por folio o id)
  updateOutbound(folioOrId: string, partial: Partial<WarehouseOutbound>, skipAudit = false): WarehouseOutbound | null {
    const list = this.outboundsSignal();
    const cleanKey = (folioOrId || '').trim();
    const index = list.findIndex(
      (o) => (o.folio && o.folio.trim() === cleanKey) || (o.id && o.id.trim() === cleanKey)
    );

    if (index === -1) {
      if (partial.folio) {
        this.outboundsSignal.update((arr) => [partial as WarehouseOutbound, ...arr]);
      }
      return partial as WarehouseOutbound;
    }

    const updated: WarehouseOutbound = {
      ...list[index],
      ...partial,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.outboundsSignal.set(newArr);

    if (!skipAudit && partial.status) {
      this.addOutboundAudit(updated.folio, {
        id: `aud-out-upd-${Date.now()}`,
        action: 'SALIDA_ACTUALIZADA',
        actionLabel: 'Actualización de Salida',
        username: partial.dispatchedBy || updated.dispatchedBy || 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [
          { fieldName: 'Estatus', newValue: this.formatFieldValue('status', partial.status) },
          { fieldName: 'Total Tarimas', newValue: String(updated.items?.length || 0) },
        ],
      });
    }

    return updated;
  }

  // Transición 1 -> 2: Asignación a Andén y Montacarguista (REGISTERED -> ASSIGNED)
  assignOutboundRamp(
    folioOrId: string,
    rampNumber: number,
    operatorId: string,
    operatorName: string,
    assignedBy: string,
    observations?: string
  ): WarehouseOutbound | null {
    const updated = this.updateOutbound(
      folioOrId,
      {
        status: 'ASSIGNED',
        rampNumber,
        rampCode: `RAMPA-${rampNumber}`,
        forkliftOperator: operatorName,
        forkliftOperatorId: operatorId,
        observations: observations,
      },
      true
    );

    if (updated) {
      this.addOutboundAudit(updated.folio, {
        id: `aud-out-asg-${Date.now()}`,
        action: 'SALIDA_ASIGNADA',
        actionLabel: 'Andén y Montacarguista Asignados',
        username: assignedBy || 'Administrador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [
          { fieldName: 'Estatus', oldValue: 'REGISTERED', newValue: 'ASSIGNED' },
          { fieldName: 'Rampa Asignada', newValue: `Rampa ${rampNumber}` },
          { fieldName: 'Montacarguista', newValue: operatorName },
        ],
      });
    }

    return updated;
  }

  // Transición 2 -> 3: Inicio de Carga en Terminal Montacarguista (ASSIGNED -> IN_PROGRESS)
  startOutboundLoading(folioOrId: string, operatorName: string): WarehouseOutbound | null {
    const updated = this.updateOutbound(
      folioOrId,
      {
        status: 'IN_PROGRESS',
      },
      true
    );

    if (updated) {
      this.addOutboundAudit(updated.folio, {
        id: `aud-out-inp-${Date.now()}`,
        action: 'CARGA_INICIADA',
        actionLabel: 'Carga Iniciada en Andén',
        username: operatorName || 'Montacarguista',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [
          { fieldName: 'Estatus', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS' },
          { fieldName: 'Operador en Andén', newValue: operatorName },
        ],
      });
    }

    return updated;
  }

  // Transición 3 -> 4: Finalización de Carga Física y Captura de Sellos (IN_PROGRESS -> LOADED)
  finishOutboundLoading(
    folioOrId: string,
    sealNumber: string,
    operatorName: string,
    items?: OutboundItem[]
  ): WarehouseOutbound | null {
    const partial: Partial<WarehouseOutbound> = {
      status: 'LOADED',
      sealNumber: sealNumber || '',
    };
    if (items && items.length > 0) {
      partial.items = items;
      partial.totalPallets = items.length;
      partial.totalPieces = items.reduce((acc, p) => acc + p.pieces, 0);
      partial.distinctSkus = new Set(items.map((p) => p.productId)).size;
    }

    const updated = this.updateOutbound(folioOrId, partial, true);

    if (updated) {
      this.addOutboundAudit(updated.folio, {
        id: `aud-out-load-${Date.now()}`,
        action: 'CARGA_CONCLUIDA',
        actionLabel: 'Carga Concluida en Andén (Por Auditar)',
        username: operatorName || 'Montacarguista',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [
          { fieldName: 'Estatus', oldValue: 'IN_PROGRESS', newValue: 'LOADED' },
          { fieldName: 'Sellos de Seguridad', newValue: sealNumber || 'Sin sello registrado' },
          { fieldName: 'Tarimas Cargadas', newValue: String(updated.totalPallets) },
          { fieldName: 'Piezas Totales', newValue: updated.totalPieces.toLocaleString() },
        ],
      });
    }

    return updated;
  }

  // Transición 4 -> 5: Cierre Administrativo y Despacho Formal F03 (LOADED -> COMPLETED)
  completeOutboundDispatch(folioOrId: string, authorizedBy: string): WarehouseOutbound | null {
    const list = this.outboundsSignal();
    const cleanKey = (folioOrId || '').trim();
    const target = list.find(
      (o) => (o.folio && o.folio.trim() === cleanKey) || (o.id && o.id.trim() === cleanKey)
    );
    if (!target) return null;

    const completedTime = new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const updated: WarehouseOutbound = {
      ...target,
      status: 'COMPLETED',
      completedAt: completedTime,
      leaderAuthorizedBy: authorizedBy,
      dispatchedAt: completedTime,
      dispatchedBy: authorizedBy,
    };

    // Descontar UAs de inventario si no se habían descontado
    if (target.items && target.items.length > 0) {
      const selectedIds = new Set(target.items.map((p) => p.id));
      this.inventoryBatchesSignal.update((batches) =>
        batches.map((batch) => {
          const remaining = batch.pallets.filter((p) => !selectedIds.has(p.id));
          if (remaining.length === batch.pallets.length) return batch;
          return {
            ...batch,
            availablePallets: remaining.length,
            totalPieces: remaining.reduce((acc, p) => acc + p.pieces, 0),
            pallets: remaining,
          };
        })
      );
    }

    const newArr = list.map((o) => (o.folio === target.folio || o.id === target.id ? updated : o));
    this.outboundsSignal.set(newArr);

    this.addOutboundAudit(updated.folio, {
      id: `aud-out-cmp-${Date.now()}`,
      action: 'SALIDA_AUTORIZADA',
      actionLabel: 'Cierre Administrativo y Despacho F03',
      username: authorizedBy,
      authorizedBy: authorizedBy,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Estatus', oldValue: target.status, newValue: 'COMPLETED' },
        { fieldName: 'Autorizado Por', newValue: authorizedBy },
        { fieldName: 'Total Tarimas Despachadas', newValue: String(updated.totalPallets) },
        { fieldName: 'Piezas Totales', newValue: updated.totalPieces.toLocaleString() },
        { fieldName: 'Liberación de Andén', newValue: `Rampa ${target.rampNumber || 'N/A'} liberada` },
      ],
    });

    return updated;
  }

  // Modificación de Remisión / Carta Porte en Salidas (Outbound)
  changeOutboundRemision(
    folioOrId: string,
    newRemision: string,
    reason: string,
    authorizedBy: string
  ): WarehouseOutbound | null {
    const list = this.outboundsSignal();
    const cleanKey = (folioOrId || '').trim();
    const target = list.find(
      (o) => (o.folio && o.folio.trim() === cleanKey) || (o.id && o.id.trim() === cleanKey)
    );
    if (!target) return null;

    const oldRem = target.remisionNo;
    const updated: WarehouseOutbound = {
      ...target,
      remisionNo: newRemision.trim(),
    };

    const newArr = list.map((o) => (o.folio === target.folio || o.id === target.id ? updated : o));
    this.outboundsSignal.set(newArr);

    this.addOutboundAudit(updated.folio, {
      id: `aud-out-rem-${Date.now()}`,
      action: 'REMISION_MODIFICADA',
      actionLabel: 'Modificación de No. Remisión / Carta Porte',
      username: authorizedBy,
      authorizedBy: authorizedBy,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'No. Remisión / Carta Porte', oldValue: oldRem || 'Sin asignar', newValue: newRemision.trim() },
        { fieldName: 'Motivo / Justificación', newValue: reason },
        { fieldName: 'Autorizado Por', newValue: authorizedBy },
      ],
    });

    return updated;
  }

  // Cambio de Remisión en UAs
  updateRemisionNumber(oldRemision: string, newRemision: string, justification: string): number {
    let updatedCount = 0;
    this.receptionsSignal.update((list) =>
      list.map((rec) => {
        if (rec.checkIn.docNumber.toLowerCase().trim() === oldRemision.toLowerCase().trim()) {
          updatedCount++;
          return {
            ...rec,
            checkIn: {
              ...rec.checkIn,
              docNumber: newRemision,
            },
          };
        }
        return rec;
      })
    );

    return updatedCount;
  }

  // Consulta estado de bahía (Ubicación)
  getLocationInfo(locationCode: string): LocationStockInfo {
    const locs = this.locationsSignal();
    const code = locationCode.toUpperCase().trim();
    if (locs[code]) {
      return locs[code];
    }
    return {
      locationCode: code,
      warehouseName: 'Bodega Central',
      zone: 'Zona General',
      aisle: 'Pasillo 01',
      rack: 'Rack 01',
      level: 'Nivel 01',
      capacity: 4,
      occupancy: 0,
      availableCapacity: 4,
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    };
  }

  // Regla de Negocio: Validar que la Bahía Destino esté COMPLETAMENTE EN CEROS
  isLocationEmpty(locationCode: string): boolean {
    const info = this.getLocationInfo(locationCode);
    return info.totalPallets === 0 && info.totalPieces === 0;
  }

  // Genera un Folio Consecutivo de Cambio de Almacén (ej. CAM-2026-000002)
  generateNextTransferFolio(): string {
    const num = this.nextTransferNumber();
    const formatted = `CAM-2026-${num.toString().padStart(6, '0')}`;
    this.nextTransferNumber.update((v) => v + 1);
    return formatted;
  }

  // Procesa el Cambio de Almacén Transaccional Detallado (SDD 5 Pasos)
  executeDetailedTransfer(dto: {
    originLocationCode: string;
    destinationLocationCode: string;
    selectedPalletIds: string[];
    forkliftOperator: string;
    forkliftOperatorId?: string;
    reasonId: string;
    reasonLabel: string;
    observations?: string;
    transferredBy: string;
  }): WarehouseTransfer {
    const origin = dto.originLocationCode.toUpperCase().trim();
    const destination = dto.destinationLocationCode.toUpperCase().trim();
    const originInfo = this.getLocationInfo(origin);
    const destInfo = this.getLocationInfo(destination);

    if (originInfo.totalPallets === 0) {
      throw new Error(`La bahía origen ${origin} no cuenta con inventario para trasladar.`);
    }

    const palletsToMove = originInfo.pallets.filter((p) => dto.selectedPalletIds.includes(p.id));
    if (palletsToMove.length === 0) {
      throw new Error('Debes seleccionar al menos una tarima para realizar el cambio de almacén.');
    }

    if (destInfo.isBlocked) {
      throw new Error(`La bahía destino ${destination} se encuentra bloqueada.`);
    }

    if (destInfo.totalPallets > 0) {
      throw new Error(`La bahía destino ${destination} contiene inventario previo. Por regla WMS debe estar completamente en ceros.`);
    }

    const folio = this.generateNextTransferFolio();
    const remainingOriginPallets = originInfo.pallets.filter((p) => !dto.selectedPalletIds.includes(p.id));
    const distinctSkusSet = new Set(palletsToMove.map((p) => p.productId));
    const totalPiecesMoved = palletsToMove.reduce((acc, p) => acc + p.pieces, 0);

    const newTransfer: WarehouseTransfer = {
      id: 'tr-' + Date.now(),
      folio,
      status: 'COMPLETED',
      forkliftOperator: dto.forkliftOperator,
      forkliftOperatorId: dto.forkliftOperatorId || 'MC-101',
      originLocation: origin,
      destinationLocation: destination,
      reasonId: dto.reasonId,
      reasonLabel: dto.reasonLabel,
      observations: dto.observations || '',
      pallets: palletsToMove,
      totalPallets: palletsToMove.length,
      totalPieces: totalPiecesMoved,
      distinctSkus: distinctSkusSet.size,
      clientName: palletsToMove[0]?.supplierName || 'Nestlé México',
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      transferredAt: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      transferredBy: dto.transferredBy,
    };

    // Actualizar Estado de Bahías en locationsSignal
    const locs = { ...this.locationsSignal() };
    const originCap = originInfo.capacity ?? 4;
    const destCap = destInfo.capacity ?? 4;

    locs[origin] = {
      ...originInfo,
      totalPallets: remainingOriginPallets.length,
      totalPieces: remainingOriginPallets.reduce((acc, p) => acc + p.pieces, 0),
      occupancy: remainingOriginPallets.length,
      availableCapacity: Math.max(0, originCap - remainingOriginPallets.length),
      pallets: remainingOriginPallets,
    };

    locs[destination] = {
      ...destInfo,
      totalPallets: palletsToMove.length,
      totalPieces: totalPiecesMoved,
      occupancy: palletsToMove.length,
      availableCapacity: Math.max(0, destCap - palletsToMove.length),
      pallets: palletsToMove,
    };

    this.locationsSignal.set(locs);
    this.transfersSignal.update((list) => [newTransfer, ...list]);

    this.addTransferAudit(folio, {
      id: `aud-tr-reg-${Date.now()}`,
      action: 'TRASPASO_REGISTRADO',
      actionLabel: 'Reubicación de Inventario Confirmada',
      username: dto.transferredBy,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Ruta de Movimiento', oldValue: origin, newValue: destination },
        { fieldName: 'Montacarguista', newValue: dto.forkliftOperator },
        { fieldName: 'Motivo', newValue: dto.reasonLabel || dto.reasonId || 'Reubicación operativa' },
        { fieldName: 'Tarimas Trasladadas', newValue: palletsToMove.length.toString() },
        { fieldName: 'Piezas Totales', newValue: totalPiecesMoved.toLocaleString() },
      ],
    });

    return newTransfer;
  }

  // Genera Folio Salida de Almacén (SAL-2026-XXXXXX)
  private generateNextOutboundFolio(): string {
    const year = new Date().getFullYear();
    const seq = String(this.nextOutboundNumber()).padStart(6, '0');
    this.nextOutboundNumber.update((v) => v + 1);
    return `SAL-${year}-${seq}`;
  }

  // Ejecuta Salida de Almacén (Outbound MVP1) — Transacción Atómica
  executeOutbound(dto: {
    clientCode: string;
    clientName: string;
    destinationId: string;
    destinationName: string;
    destinationAddress?: string;
    carrierCode: string;
    carrierName: string;
    forkliftOperator?: string;
    forkliftOperatorId?: string;
    driverName: string;
    economicNumber: string;
    boxEconomicNumber?: string;
    tractorPlates: string;
    boxPlates: string;
    transportType: TransportType;
    sealNumber: string;
    remisionNo: string;
    selectedPallets: OutboundItem[];
    dispatchedBy: string;
  }): WarehouseOutbound {
    if (!dto.clientCode) throw new Error('El cliente es obligatorio.');
    if (!dto.destinationId) throw new Error('El destino es obligatorio.');
    if (!dto.carrierCode) throw new Error('El transportista es obligatorio.');
    if (!dto.sealNumber.trim()) throw new Error('El número de sello es obligatorio.');
    if (dto.selectedPallets.length === 0) throw new Error('Selecciona al menos una tarima para registrar la salida.');

    const folio = this.generateNextOutboundFolio();
    const distinctSkus = new Set(dto.selectedPallets.map((p) => p.productId)).size;
    const totalPieces = dto.selectedPallets.reduce((acc, p) => acc + p.pieces, 0);

    const newOutbound: WarehouseOutbound = {
      id: 'out-' + Date.now(),
      folio,
      status: 'COMPLETED',
      clientCode: dto.clientCode,
      clientName: dto.clientName,
      destinationId: dto.destinationId,
      destinationName: dto.destinationName,
      destinationAddress: dto.destinationAddress,
      carrierCode: dto.carrierCode,
      carrierName: dto.carrierName,
      forkliftOperator: dto.forkliftOperator,
      forkliftOperatorId: dto.forkliftOperatorId,
      driverName: dto.driverName,
      economicNumber: dto.economicNumber,
      boxEconomicNumber: dto.boxEconomicNumber,
      tractorPlates: dto.tractorPlates,
      boxPlates: dto.boxPlates,
      transportType: dto.transportType,
      sealNumber: dto.sealNumber,
      remisionNo: dto.remisionNo,
      items: dto.selectedPallets,
      totalPallets: dto.selectedPallets.length,
      totalPieces,
      distinctSkus,
      dispatchedAt: new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      dispatchedBy: dto.dispatchedBy,
      timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    };

    // Descontar UAs seleccionadas del lote/bahía de inventario
    const selectedIds = new Set(dto.selectedPallets.map((p) => p.id));
    this.inventoryBatchesSignal.update((batches) =>
      batches.map((batch) => {
        const remaining = batch.pallets.filter((p) => !selectedIds.has(p.id));
        if (remaining.length === batch.pallets.length) return batch;
        return {
          ...batch,
          availablePallets: remaining.length,
          totalPieces: remaining.reduce((acc, p) => acc + p.pieces, 0),
          pallets: remaining,
        };
      })
    );

    this.outboundsSignal.update((list) => [newOutbound, ...list]);

    this.addOutboundAudit(folio, {
      id: `aud-out-reg-${Date.now()}`,
      action: 'SALIDA_REGISTRADA',
      actionLabel: 'Despacho Outbound Confirmado',
      username: dto.dispatchedBy,
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Cliente / Destino', newValue: `${dto.clientName} — ${dto.destinationName}` },
        { fieldName: 'Transportista', newValue: dto.carrierName },
        { fieldName: 'No. Sello / Cincho', newValue: dto.sealNumber },
        { fieldName: 'Tarimas Despachadas', newValue: dto.selectedPallets.length.toString() },
        { fieldName: 'Piezas Totales', newValue: totalPieces.toLocaleString() },
      ],
    });

    return newOutbound;
  }

  // Procesa el Cambio de Almacén / Traspaso Interno (Legacy simplificado)
  executeTransfer(
    origin: string,
    destination: string,
    forkliftOperator: string,
    transferredBy: string
  ): WarehouseTransfer | null {
    const originInfo = this.getLocationInfo(origin);
    if (originInfo.totalPallets === 0) return null;

    return this.executeDetailedTransfer({
      originLocationCode: origin,
      destinationLocationCode: destination,
      selectedPalletIds: originInfo.pallets.map((p) => p.id),
      forkliftOperator,
      reasonId: 'REUB_OPERATIVA',
      reasonLabel: 'Reubicación operativa',
      observations: 'Traspaso rápido de bahía completa.',
      transferredBy,
    });
  }

  // Procesa Despacho Outbound
  executeDispatch(dispatchData: Omit<OutboundDispatch, 'folio' | 'dispatchedAt'>): OutboundDispatch {
    const dispatchFolio = `DESP-${this.nextDispatchNumber()}`;
    this.nextDispatchNumber.update((v) => v + 1);

    const fullDispatch: OutboundDispatch = {
      ...dispatchData,
      folio: dispatchFolio,
      dispatchedAt: new Date().toLocaleString('es-MX'),
    };

    this.dispatchesSignal.update((list) => [fullDispatch, ...list]);

    // Descontar UAs seleccionadas de lotes de inventario
    this.inventoryBatchesSignal.update((batches) =>
      batches.map((batch) => {
        if (batch.productId === dispatchData.productId) {
          const selectedCodes = new Set(dispatchData.selectedPallets.map((p) => p.palletCode));
          const remainingPallets = batch.pallets.filter((p) => !selectedCodes.has(p.palletCode));
          const remainingPieces = remainingPallets.reduce((acc, p) => acc + p.pieces, 0);

          return {
            ...batch,
            availablePallets: remainingPallets.length,
            totalPieces: remainingPieces,
            pallets: remainingPallets,
          };
        }
        return batch;
      })
    );

    return fullDispatch;
  }

  // ── LIBERACIÓN DE CALIDAD QM A INVENTARIO DISPONIBLE ──
  addReleasedInventoryStock(blockData: {
    sku: string;
    description: string;
    clientName: string;
    batchNumber: string;
    quantity: number;
    locationId?: string;
    destination: string;
  }): void {
    const newBatch: InventoryBatch = {
      remisionNo: `REM-LIB-${Date.now().toString().slice(-4)}`,
      client: blockData.clientName,
      productId: blockData.sku,
      productName: blockData.description,
      lotNumber: blockData.batchNumber,
      elaborationDate: new Date().toISOString().slice(0, 10),
      expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      availablePallets: Math.ceil(blockData.quantity / 45) || 1,
      totalPieces: blockData.quantity,
      locationCode: blockData.locationId || 'LOC-QM-RELEASED',
      pallets: []
    };

    this.inventoryBatchesSignal.update((list) => [newBatch, ...list]);
  }
}

