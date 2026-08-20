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

  // Catálogos Reactivos (inician vacíos hasta cargar del BE)
  private readonly carrierLinesSignal = signal<CarrierLineItem[]>([]);
  private readonly clientsSignal = signal<ClientItem[]>([]);

  private readonly rampsSignal = signal<RampItem[]>([
    { code: 'R-01', rampNumber: 1, name: 'Rampa 01' },
    { code: 'R-02', rampNumber: 2, name: 'Rampa 02' },
    { code: 'R-03', rampNumber: 3, name: 'Rampa 03' },
    { code: 'R-04', rampNumber: 4, name: 'Rampa 04' },
    { code: 'R-05', rampNumber: 5, name: 'Rampa 05' },
    { code: 'R-06', rampNumber: 6, name: 'Rampa 06' },
    { code: 'R-07', rampNumber: 7, name: 'Rampa 07' },
    { code: 'R-08', rampNumber: 8, name: 'Rampa 08' },
    { code: 'R-09', rampNumber: 9, name: 'Rampa 09' },
    { code: 'R-10', rampNumber: 10, name: 'Rampa 10' },
    { code: 'R-11', rampNumber: 11, name: 'Rampa 11' },
    { code: 'R-12', rampNumber: 12, name: 'Rampa 12' },
  ]);

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
  private readonly outboundsSignal = signal<WarehouseOutbound[]>([]);

  // Bahías y su stock
  private readonly locationsSignal = signal<Record<string, LocationStockInfo>>({});

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

  // Catálogo de Destinos por Cliente
  readonly clientDestinations = CLIENT_DESTINATIONS;
  getDestinationsForClient(clientCode: string): ClientDestination[] {
    return CLIENT_DESTINATIONS.filter(
      (d) => d.clientCode === clientCode && d.status === 'ACTIVO'
    );
  }

  // Bahías Ocupadas y Disponibles (Computadas)
  readonly occupiedLocations = computed(() =>
    Object.values(this.locationsSignal()).filter((loc) => loc.totalPallets > 0)
  );

  readonly availableLocations = computed(() =>
    Object.values(this.locationsSignal()).filter((loc) => loc.totalPallets === 0 && !loc.isBlocked)
  );

  readonly transferReasons = TRANSFER_REASONS;

  // Simula la llegada de un nuevo registro desde Caseta de Seguridad
  simulateQuickCasetaArrival(): ReceptionHeader {
    const folio = this.generateNextReceptionFolio();
    const mockClients = ['Nestlé México', 'Nestlé Planta Toluca', 'Unilever México', 'Distribuidora Automotriz'];
    const mockCarriers = ['Transportes Castores', 'Express Tresguerras', 'TMS Maniobras', 'Fletes Directos'];
    const mockDrivers = ['Carlos Ruiz', 'Martín Solís', 'Jorge Valenzuela', 'Raúl Domínguez'];
    const randomClient = mockClients[Math.floor(Math.random() * mockClients.length)];
    const randomCarrier = mockCarriers[Math.floor(Math.random() * mockCarriers.length)];
    const randomDriver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
    const randomRamp = Math.floor(Math.random() * 8) + 1;
    const randomRem = `REM-2026-${Math.floor(Math.random() * 899 + 100)}`;
    const randomTime = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const newHeader: ReceptionHeader = {
      folio,
      status: 'REGISTERED',
      checkIn: {
        carrierLine: randomCarrier,
        receptionTime: randomTime,
        docNumber: randomRem,
        docDate: new Date().toISOString().slice(0, 10),
        client: randomClient,
        rampNumber: randomRamp,
        forkliftOperator: 'Pablo Hernández',
        driverName: randomDriver,
        tractorPlates: `${Math.floor(Math.random() * 89 + 10)}-AB-${Math.floor(Math.random() * 89 + 10)}`,
        boxPlates: `${Math.floor(Math.random() * 89 + 10)}-XX-${Math.floor(Math.random() * 89 + 10)}`,
        sealNumber: `SL-${Math.floor(Math.random() * 89999 + 10000)}`,
      },
      lotNumber: `LOT-2026-${String.fromCharCode(65 + Math.floor(Math.random() * 6))}${Math.floor(Math.random() * 9 + 1)}`,
      elaborationDate: '2026-01-15',
      expirationDate: '2026-12-30',
      productId: '12572733',
      productName: 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: 'LE MEXICO S.A DE C.V',
      piecesPerPallet: 480,
      selectedPalletType: 'MADERA_ESTANDAR',
      observations: `Ingreso registrado en caseta andén ${randomRamp}`,
      pallets: [],
      createdAt: randomTime,
      capturedBy: 'Caseta de Seguridad',
    };

    this.receptionsSignal.update((list) => [newHeader, ...list]);
    return newHeader;
  }

  constructor() {
    this.loadInitialBackendData();
  }

  public loadInitialBackendData(): void {
    // 1. Clientes
    this.movementsApi.getClients().subscribe({
      next: (clients) => {
        this.clientsSignal.set(
          (clients || []).map((c) => ({
            code: c.id || c.code || 'CLI',
            name: c.name || c.tradeName || 'Cliente',
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
    this.movementsApi.getForkliftOperators().subscribe({
      next: (ops) => {
        if (ops && ops.length > 0) {
          this.forkliftOperatorsSignal.set(
            ops.map((o) => ({
              code: o.id || o.code,
              name: o.fullName || `${o.firstName || ''} ${o.lastNamePaternal || o.lastName || ''} ${o.lastNameMaternal || ''}`.trim() || o.name || 'Montacarguista',
            }))
          );
        }
      },
      error: () => {},
    });

    // 4. Ubicaciones / Bahías
    this.movementsApi.getLocations().subscribe({
      next: (locs) => {
        if (locs && locs.length > 0) {
          const locMap: Record<string, LocationStockInfo> = {};
          locs.forEach((l) => {
            const code = l.code || l.locationCode || 'LOC';
            locMap[code] = {
              locationCode: code,
              warehouseName: l.warehouseName || 'Almacén Principal',
              zone: l.zoneName || 'General',
              aisle: l.aisle || '',
              rack: l.rack || '',
              level: l.level || '',
              capacity: l.capacity || 4,
              occupancy: 0,
              availableCapacity: l.capacity || 4,
              totalPallets: 0,
              totalPieces: 0,
              pallets: [],
            };
          });
          this.locationsSignal.set(locMap);
        }
      },
      error: () => {},
    });

    // 5. Lotes de inventario (FIFO/FEFO)
    this.movementsApi.getInventoryBatches().subscribe({
      next: (batches) => {
        this.inventoryBatchesSignal.set(batches || []);
      },
      error: () => {},
    });

    // 6. Recepciones
    this.movementsApi.getReceptions().subscribe({
      next: (receptions) => {
        this.receptionsSignal.set(
          (receptions || []).map((r: any) => ({
            id: r.id,
            folio: r.folio,
            status: r.status,
            checkIn: {
              carrierLine: r.carrierName || '',
              receptionTime: r.receptionTime ? String(r.receptionTime).substring(0, 5) : '',
              docNumber: r.docNumber || '',
              docDate: r.docDate || '',
              client: r.clientName || '',
              rampNumber: 4,
              forkliftOperator: '',
              driverName: r.driverName || '',
              tractorPlates: r.tractorPlates || '',
              boxPlates: r.boxPlates || '',
              sealNumber: '',
            },
            lotNumber: r.lotNumber || '',
            elaborationDate: '',
            expirationDate: '',
            productId: r.skuCode || '',
            productName: r.productName || '',
            supplierName: '',
            piecesPerPallet: r.piecesPerPallet || 0,
            selectedPalletType: 'MADERA_ESTANDAR',
            pallets: [],
            createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('es-MX') : '',
            completedAt: r.completedAt ? new Date(r.completedAt).toLocaleString('es-MX') : undefined,
            cancelledAt: r.cancelledAt ? new Date(r.cancelledAt).toLocaleString('es-MX') : undefined,
            capturedBy: r.capturedBy || '',
          }))
        );
      },
      error: () => {},
    });

    // 7. Traspasos
    this.movementsApi.getTransfers().subscribe({
      next: (transfers) => {
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
      next: (outbounds) => {
        this.outboundsSignal.set(
          (outbounds || []).map((o: any) => ({
            id: o.id,
            folio: o.folio,
            status: o.status,
            clientCode: o.clientId || '',
            clientName: o.clientName || '',
            destinationId: o.destinationId || '',
            destinationName: o.destinationName || '',
            destinationAddress: '',
            carrierCode: o.carrierId || '',
            carrierName: o.carrierName || '',
            driverName: o.driverName || '',
            economicNumber: '',
            tractorPlates: o.tractorPlates || '',
            boxPlates: o.boxPlates || '',
            transportType: o.transportType || 'TRAILER',
            sealNumber: o.sealNumber || '',
            remisionNo: o.remisionNo || '',
            items: [],
            totalPallets: o.totalPallets || 0,
            totalPieces: o.totalPieces || 0,
            distinctSkus: o.distinctSkus || 0,
            dispatchedAt: o.createdAt ? new Date(o.createdAt).toLocaleString('es-MX') : '',
            dispatchedBy: o.createdBy || '',
            timestamp: o.createdAt ? String(o.createdAt).substring(11, 16) : '',
          }))
        );
      },
      error: () => {},
    });
  }

  public reloadCarriers(): void {
    this.movementsApi.getCarriers().subscribe({
      next: (carriers) => {
        if (carriers) {
          this.carrierLinesSignal.set(
            carriers.map((c) => ({
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
      next: (sups) => {
        if (sups && sups.length > 0) {
          this.suppliersSignal.set(
            sups.map((s: any) => ({
              code: s.id || s.code,
              name: s.legalName || s.commercialName || s.tradeName || s.name,
            }))
          );
        }
      },
      error: () => {},
    });
  }

  // ─── MÉTODOS DE AUDITORÍA ───────────────────────────────────────────────────

  getReceptionAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.receptionAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'RECEPCION_CREADA',
        actionLabel: 'Registro de Movimiento en WMS',
        username: 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio', newValue: folio }],
      },
    ];
  }

  addReceptionAudit(folio: string, entry: MovementAuditEntry): void {
    this.receptionAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      return { ...map, [key]: [entry, ...current] };
    });
  }

  getTransferAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.transferAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'TRASPASO_REGISTRADO',
        actionLabel: 'Reubicación Registrada en Catálogo',
        username: 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio', newValue: folio }],
      },
    ];
  }

  addTransferAudit(folio: string, entry: MovementAuditEntry): void {
    this.transferAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      return { ...map, [key]: [entry, ...current] };
    });
  }

  getOutboundAuditLogs(folio: string): MovementAuditEntry[] {
    const map = this.outboundAuditMap();
    return map[folio.trim()] || [
      {
        id: `aud-default-${folio}`,
        action: 'SALIDA_REGISTRADA',
        actionLabel: 'Despacho Registrado en WMS',
        username: 'Operador WMS',
        timestamp: new Date().toLocaleString('es-MX'),
        details: [{ fieldName: 'Folio', newValue: folio }],
      },
    ];
  }

  addOutboundAudit(folio: string, entry: MovementAuditEntry): void {
    this.outboundAuditMap.update((map) => {
      const key = folio.trim();
      const current = map[key] || [];
      return { ...map, [key]: [entry, ...current] };
    });
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
    const clientId = (clientItem && clientItem.code && clientItem.code.includes('-')) 
      ? clientItem.code 
      : (data.clientCode && data.clientCode.includes('-') ? data.clientCode : 'c73f0907-9fa5-4bdf-87db-2eb5e7683938');

    const carrierItem = this.carrierLinesSignal().find((c) => c.code === data.carrierLineCode || c.name === data.carrierLine);
    const carrierId = (carrierItem && carrierItem.code && carrierItem.code.includes('-')) ? carrierItem.code : null;

    const opItem = this.forkliftOperatorsSignal().find((o) => o.code === data.forkliftOperatorCode || o.name === data.forkliftOperator);
    const forkliftOperatorId = (opItem && opItem.code && opItem.code.includes('-')) ? opItem.code : null;

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

    const payload = {
      organizationId: orgId,
      branchId: branchId,
      clientId: clientId,
      carrierId: carrierId,
      forkliftOperatorId: forkliftOperatorId,
      rampId: null,
      docNumber: data.docNumber,
      docDate: data.docDate || new Date().toISOString().slice(0, 10),
      receptionTime: receptionTime,
      driverName: data.driverName,
      tractorPlates: data.tractorPlates,
      boxPlates: data.boxPlates,
      sealNumbers: data.sealNumbers || (data.sealNumber ? [data.sealNumber] : []),
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
          lotNumber: res.lotNumber || data.lotNumber || 'LOT-2026-A1',
          elaborationDate: res.elaborationDate || data.elaborationDate || '2026-01-15',
          expirationDate: res.expirationDate || data.expirationDate || '2026-11-15',
          productId: res.productSku || '12572733',
          productName: res.productDescription || 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
          supplierName: res.supplierName || 'LE MEXICO S.A DE C.V',
          piecesPerPallet: res.piecesPerPallet || 480,
          selectedPalletType: (res.palletType as PalletType) || 'MADERA_ESTANDAR',
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
          username: 'Caseta de Seguridad',
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

  // Persiste avances de descarga (parámetros y tarimas) en el Backend (wms.warehouse_reception_pallets)
  saveDraftReceptionBackend(
    receptionId: string,
    formVals: any,
    pallets: ReceptionPalletItem[],
    productsList: any[],
    suppliersList: any[]
  ): Observable<ReceptionHeader> {
    const prodItem = productsList.find((p) => p.id === formVals.productId || p.name === formVals.productName);
    const skuId = (prodItem && prodItem.id && prodItem.id.includes('-'))
      ? prodItem.id
      : (formVals.productId && formVals.productId.includes('-') ? formVals.productId : null);

    const supItem = suppliersList.find((s) => s.name === formVals.supplierName || s.code === formVals.supplierName);
    const supplierId = (supItem && supItem.code && supItem.code.includes('-'))
      ? supItem.code
      : (formVals.supplierId && formVals.supplierId.includes('-') ? formVals.supplierId : null);

    const paramPayload = {
      skuId: skuId,
      supplierId: supplierId,
      lotNumber: formVals.lotNumber,
      expirationDate: formVals.expirationDate || null,
      piecesPerPallet: Number(formVals.piecesPerPallet) || 480,
      palletType: formVals.selectedPalletType || 'MADERA_ESTANDAR',
      observations: formVals.observations || '',
    };

    return this.movementsApi.updateReceptionParameters(receptionId, paramPayload).pipe(
      concatMap(() => {
        if (pallets && pallets.length > 0) {
          const palletPayload = pallets.map((p) => ({
            palletCode: p.palletCode,
            pieces: p.pieces,
            palletType: p.palletTypeId,
            observations: p.observations || '',
          }));
          return this.movementsApi.addReceptionPallets(receptionId, palletPayload).pipe(
            catchError(() => of([]))
          );
        } else {
          return of([]);
        }
      }),
      map(() => {
        const updated = this.updateReception(receptionId, {
          lotNumber: formVals.lotNumber,
          expirationDate: formVals.expirationDate,
          productId: formVals.productId,
          productName: formVals.productName,
          supplierName: formVals.supplierName,
          piecesPerPallet: formVals.piecesPerPallet,
          selectedPalletType: formVals.selectedPalletType,
          observations: formVals.observations,
          pallets: pallets,
        });
        return updated || ({} as ReceptionHeader);
      })
    );
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
          leaderPassword: leaderPass || 'adminPassword',
          observations: `Autorizado por ${leaderName}. ${formVals.observations || ''}`.trim(),
        };
        return this.movementsApi.completeReception(receptionId, completePayload);
      }),
      map((res: any) => {
        const updated = this.completeReception(
          res.folio || receptionId,
          formVals.lotNumber,
          res.elaborationDate || '2026-01-01',
          formVals.expirationDate,
          formVals.productId,
          formVals.productName,
          formVals.piecesPerPallet,
          formVals.selectedPalletType,
          pallets,
          formVals.observations,
          'Christian Durán',
          leaderName
        );
        return updated || ({} as ReceptionHeader);
      })
    );
  }

  // Guarda la Pre-Recepción (Caseta - Local)
  saveCheckIn(data: CheckInCasetaData, assignedFolio: string): ReceptionHeader {
    const newHeader: ReceptionHeader = {
      folio: assignedFolio,
      status: 'REGISTERED',
      checkIn: data,
      lotNumber: data.lotNumber || 'LOT-2026-A1',
      elaborationDate: data.elaborationDate || '2026-01-15',
      expirationDate: data.expirationDate || '2026-11-15',
      productId: '12572733',
      productName: 'FFEE-MATE ORIGINAL BOTELLA 12X400G N1',
      supplierName: 'LE MEXICO S.A DE C.V',
      piecesPerPallet: 480,
      selectedPalletType: 'MADERA_ESTANDAR',
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

  // Actualiza datos de una recepción en progreso
  updateReception(folio: string, partial: Partial<ReceptionHeader>): ReceptionHeader | null {
    const list = this.receptionsSignal();
    const index = list.findIndex((r) => r.folio.trim() === folio.trim());
    if (index === -1) return null;

    const updated: ReceptionHeader = {
      ...list[index],
      ...partial,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.receptionsSignal.set(newArr);

    this.addReceptionAudit(folio, {
      id: `aud-rec-upd-${Date.now()}`,
      action: 'RECEPCION_ACTUALIZADA',
      actionLabel: 'Actualización de Datos de Recepción',
      username: partial.capturedBy || 'Operador WMS',
      timestamp: new Date().toLocaleString('es-MX'),
      details: [
        { fieldName: 'Lugar de Almacenaje', newValue: partial.storageLocation || '' },
        { fieldName: 'Total Tarimas', newValue: partial.pallets?.length.toString() || '0' },
      ],
    });

    return updated;
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

    const updated: WarehouseOutbound = {
      ...list[index],
      status: 'CANCELLED',
      cancellationReason: justification,
      cancelledAt: new Date().toLocaleString('es-MX'),
      cancelledBy: adminName,
    };

    const newArr = [...list];
    newArr[index] = updated;
    this.outboundsSignal.set(newArr);

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
            observations: (rec.observations || '') + ` | Cambio de Remisión: ${oldRemision} -> ${newRemision} (${justification})`,
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
    driverName: string;
    economicNumber: string;
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
      driverName: dto.driverName,
      economicNumber: dto.economicNumber,
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
}

