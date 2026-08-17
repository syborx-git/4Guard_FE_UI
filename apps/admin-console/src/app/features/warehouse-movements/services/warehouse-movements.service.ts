/**
 * @file warehouse-movements.service.ts
 * @description Servicio reactivo basado en Angular Signals para el módulo Movimientos de Almacén.
 * Administra el estado global de Recepciones, Traspasos, Salidas Outbound e Inventario de Bahías.
 */

import { Injectable, signal, computed, inject } from '@angular/core';
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
} from '../models/warehouse-movements.models';

@Injectable({
  providedIn: 'root',
})
export class WarehouseMovementsService {
  private readonly forkliftAdminService = inject(ForkliftOperatorAdminService);
  // Consecutivo base de recepción
  private nextFolioNumber = signal(26510);
  private nextTransferNumber = signal(4081);
  private nextDispatchNumber = signal(8821);
  private nextOutboundNumber = signal(1);  // SAL-2026-000001

  // Catálogos Reactivos
  private readonly carrierLinesSignal = signal<CarrierLineItem[]>([
    { code: 'TR-01', name: 'Transportes Castores' },
    { code: 'TR-02', name: 'Fletes Directos de Puebla' },
    { code: 'TR-03', name: 'TMS (Transportes y Maniobras del Sur)' },
    { code: 'TR-04', name: 'Express Tresguerras' },
  ]);

  private readonly clientsSignal = signal<ClientItem[]>([
    { code: 'CLI-001', name: 'Nestlé México' },
    { code: 'CLI-002', name: 'Nestlé Planta Toluca' },
    { code: 'CLI-003', name: 'Nestlé Planta Querétaro' },
    { code: 'CLI-004', name: 'Nestlé Planta Veracruz' },
  ]);

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

  private readonly forkliftOperatorsSignal = signal<ForkliftOperatorItem[]>([
    { code: 'MC-101', name: 'Alan Huerta Pérez' },
    { code: 'MC-102', name: 'Pablo Hernández' },
    { code: 'MC-103', name: 'Alejandro Martínez' },
    { code: 'MC-104', name: 'Gerardo González Carbajal' },
    { code: 'MC-105', name: 'Saul Reyes Trejo' },
    { code: 'MC-106', name: 'Carlos Ruiz' },
    { code: 'MC-107', name: 'Juan Manuel López' },
    { code: 'MC-108', name: 'Héctor Villalvo' },
    { code: 'MC-109', name: 'Roberto Carmona' },
    { code: 'MC-110', name: 'Miguel Ángel Soria' },
  ]);

  readonly carrierLines = this.carrierLinesSignal.asReadonly();
  readonly clients = this.clientsSignal.asReadonly();
  readonly ramps = this.rampsSignal.asReadonly();
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

  // Almacenamiento Reactivo de datos (Signals)
  private readonly receptionsSignal = signal<ReceptionHeader[]>([]);
  private readonly transfersSignal = signal<WarehouseTransfer[]>([]);
  private readonly dispatchesSignal = signal<OutboundDispatch[]>([]);
  private readonly outboundsSignal = signal<WarehouseOutbound[]>([]);

  // Bahías y su stock inicial simulado
  private readonly locationsSignal = signal<Record<string, LocationStockInfo>>({
    'A-14': {
      locationCode: 'A-14',
      warehouseName: 'Bodega Principal A',
      zone: 'Zona A - Alimentos Secos',
      aisle: 'Pasillo 01',
      rack: 'Rack 04',
      level: 'Nivel 01 (Piso)',
      capacity: 4,
      occupancy: 4,
      availableCapacity: 0,
      totalPallets: 4,
      totalPieces: 1920,
      pallets: [
        {
          id: 'ua-101',
          palletCode: 'UA-90821',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
          observations: 'Buen estado',
        },
        {
          id: 'ua-102',
          palletCode: 'UA-90822',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
        {
          id: 'ua-103',
          palletCode: 'UA-90823',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
        {
          id: 'ua-104',
          palletCode: 'UA-90824',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
      ],
    },
    'M-98': {
      locationCode: 'M-98',
      warehouseName: 'Bodega M 98 - Pulmón',
      zone: 'Zona M - Racks Altura',
      aisle: 'Pasillo 09',
      rack: 'Rack 08',
      level: 'Nivel 02',
      capacity: 4,
      occupancy: 0,
      availableCapacity: 4,
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    },
    'B-02': {
      locationCode: 'B-02',
      warehouseName: 'Bodega Principal B',
      zone: 'Zona B - Bebidas y Café',
      aisle: 'Pasillo 02',
      rack: 'Rack 01',
      level: 'Nivel 02',
      capacity: 4,
      occupancy: 2,
      availableCapacity: 2,
      totalPallets: 2,
      totalPieces: 960,
      pallets: [
        {
          id: 'ua-201',
          palletCode: 'UA-77101',
          description: 'Café Nescafé Clásico 200g',
          productId: 'SKU-NESCAF-200',
          pieces: 480,
          palletTypeId: 'TARIMA_CHEP',
          palletTypeLabel: 'Tarima CHEP',
        },
        {
          id: 'ua-202',
          palletCode: 'UA-77102',
          description: 'Café Nescafé Clásico 200g',
          productId: 'SKU-NESCAF-200',
          pieces: 480,
          palletTypeId: 'TARIMA_CHEP',
          palletTypeLabel: 'Tarima CHEP',
        },
      ],
    },
    'A-15': {
      locationCode: 'A-15',
      warehouseName: 'Bodega Principal A',
      zone: 'Zona A - Alimentos Secos',
      aisle: 'Pasillo 01',
      rack: 'Rack 04',
      level: 'Nivel 02',
      capacity: 4,
      occupancy: 0,
      availableCapacity: 4,
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    },
    'C-08': {
      locationCode: 'C-08',
      warehouseName: 'Bodega C - Lácteos',
      zone: 'Zona C - Lácteos Secos',
      aisle: 'Pasillo 03',
      rack: 'Rack 02',
      level: 'Nivel 01',
      capacity: 3,
      occupancy: 3,
      availableCapacity: 0,
      totalPallets: 3,
      totalPieces: 1440,
      pallets: [
        {
          id: 'ua-301',
          palletCode: 'UA-88301',
          description: 'Coffee-Mate Original 400g',
          productId: '12572733',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
        {
          id: 'ua-302',
          palletCode: 'UA-88302',
          description: 'Coffee-Mate Original 400g',
          productId: '12572733',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
        {
          id: 'ua-303',
          palletCode: 'UA-88303',
          description: 'Coffee-Mate Original 400g',
          productId: '12572733',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
      ],
    },
    'D-01': {
      locationCode: 'D-01',
      warehouseName: 'Bodega D - Consolidación',
      zone: 'Zona D - Alta Rotación',
      aisle: 'Pasillo 04',
      rack: 'Rack 01',
      level: 'Nivel 01 (Piso)',
      capacity: 4,
      occupancy: 0,
      availableCapacity: 4,
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    },
  });

  // Lotes disponibles para salidas FIFO/FEFO
  private readonly inventoryBatchesSignal = signal<InventoryBatch[]>([
    {
      remisionNo: 'REM-88102',
      client: 'Nestlé México',
      productId: 'SKU-NES-680',
      productName: 'Cereal Nestlé Nesquik 680g',
      lotNumber: 'LOT-2026-A1',
      elaborationDate: '2026-01-10',
      expirationDate: '2026-11-15',
      availablePallets: 5,
      totalPieces: 2400,
      locationCode: 'A-14',
      isFifoSuggested: true, // El más antiguo (sugerido FEFO)
      pallets: Array.from({ length: 5 }, (_, i) => ({
        id: `ua-fifo-${i + 1}`,
        palletCode: `UA-8810-${i + 1}`,
        description: 'Cereal Nestlé Nesquik 680g',
        productId: 'SKU-NES-680',
        pieces: 480,
        palletTypeId: 'MADERA_ESTANDAR',
        palletTypeLabel: 'Madera Estándar',
        observations: 'Lote prioritario FIFO',
      })),
    },
    {
      remisionNo: 'REM-99420',
      client: 'Nestlé México',
      productId: 'SKU-NES-680',
      productName: 'Cereal Nestlé Nesquik 680g',
      lotNumber: 'LOT-2026-B4',
      elaborationDate: '2026-03-01',
      expirationDate: '2027-04-20',
      availablePallets: 8,
      totalPieces: 3840,
      locationCode: 'A-18',
      isFifoSuggested: false,
      pallets: Array.from({ length: 8 }, (_, i) => ({
        id: `ua-fifo2-${i + 1}`,
        palletCode: `UA-9942-${i + 1}`,
        description: 'Cereal Nestlé Nesquik 680g',
        productId: 'SKU-NES-680',
        pieces: 480,
        palletTypeId: 'PLASTICO',
        palletTypeLabel: 'Plástico',
      })),
    },
    {
      remisionNo: 'REM-44120',
      client: 'Unilever México',
      productId: 'SKU-KNORR-1K',
      productName: 'Caldo Knorr Polvo 1Kg',
      lotNumber: 'LOT-UNI-009',
      elaborationDate: '2026-02-14',
      expirationDate: '2027-01-30',
      availablePallets: 6,
      totalPieces: 2880,
      locationCode: 'B-04',
      isFifoSuggested: true,
      pallets: Array.from({ length: 6 }, (_, i) => ({
        id: `ua-knorr-${i + 1}`,
        palletCode: `UA-4412-${i + 1}`,
        description: 'Caldo Knorr Polvo 1Kg',
        productId: 'SKU-KNORR-1K',
        pieces: 480,
        palletTypeId: 'TARIMA_CHEP',
        palletTypeLabel: 'Tarima CHEP',
      })),
    },
  ]);

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
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const demoCheckIn: CheckInCasetaData = {
      carrierLine: 'Transportes Castores',
      receptionTime: '08:30',
      docNumber: 'REM-88102',
      docDate: '2026-08-10',
      client: 'Nestlé México',
      rampNumber: 4,
      forkliftOperator: 'Pablo Hernández',
      driverName: 'Carlos Ruiz',
      tractorPlates: '77-AB-99',
      boxPlates: '55-XX-11',
      sealNumber: 'SL-99412',
    };

    const demoReception: ReceptionHeader = {
      folio: '26509',
      status: 'COMPLETED',
      checkIn: demoCheckIn,
      lotNumber: 'LOT-2026-A1',
      elaborationDate: '2026-01-10',
      expirationDate: '2026-11-15',
      productId: 'SKU-NES-680',
      productName: 'Cereal Nestlé Nesquik 680g',
      piecesPerPallet: 480,
      selectedPalletType: 'MADERA_ESTANDAR',
      observations: 'Ingreso directo andén 4 sin incidentes.',
      pallets: [
        {
          id: 'p1',
          palletCode: 'UA-90821',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
        {
          id: 'p2',
          palletCode: 'UA-90822',
          description: 'Cereal Nestlé Nesquik 680g',
          productId: 'SKU-NES-680',
          pieces: 480,
          palletTypeId: 'MADERA_ESTANDAR',
          palletTypeLabel: 'Madera Estándar',
        },
      ],
      createdAt: '2026-08-10 09:15',
      completedAt: '2026-08-10 10:00',
      capturedBy: 'Christian Durán',
      leaderAuthorizedBy: 'Pablo Hernández',
    };

    this.receptionsSignal.set([demoReception]);

    // Traspaso inicial simulado
    this.transfersSignal.set([
      {
        id: 'tr-init-1',
        folio: 'CAM-2026-000001',
        status: 'COMPLETED',
        forkliftOperator: 'Pablo Hernández',
        forkliftOperatorId: 'MC-101',
        originLocation: 'RAMPA-04',
        destinationLocation: 'A-14',
        reasonId: 'REUB_OPERATIVA',
        reasonLabel: 'Reubicación operativa',
        observations: 'Acomodo inicial desde andén de descarga a rack principal.',
        pallets: demoReception.pallets,
        totalPallets: 2,
        totalPieces: 960,
        distinctSkus: 1,
        clientName: 'Nestlé México',
        timestamp: '11:30',
        transferredAt: '2026-08-10 11:30',
        transferredBy: 'Christian Durán',
      },
    ]);

    // Salida inicial simulada (legado)
    this.dispatchesSignal.set([
      {
        folio: 'DESP-8820',
        client: 'Nestlé México',
        destinationPlant: 'Nestlé Planta Toluca',
        sealNumber: 'SL-88401',
        carrierName: 'Transportes Castores',
        driverName: 'Juan Pérez',
        economicNumber: 'ECO-901',
        tractorPlates: '12-AA-34',
        boxPlates: '78-BB-90',
        transportType: 'Tráiler',
        forkliftOperator: 'Pablo Hernández',
        productId: 'SKU-NES-680',
        productName: 'Cereal Nestlé Nesquik 680g',
        selectedPallets: [demoReception.pallets[0]],
        totalPallets: 1,
        totalPieces: 480,
        dispatchedAt: '2026-08-10 14:20',
        dispatchedBy: 'Christian Durán',
      },
    ]);

    // Salidas Outbound MVP1 con folio SAL-2026-XXXXXX (seed data)
    const seedOutboundItems: OutboundItem[] = [
      { id: 'oi-s1-1', palletCode: 'UA-8810-1', productId: 'SKU-NES-680', description: 'Cereal Nestlé Nesquik 680g', lotNumber: 'LOT-2026-A1', expirationDate: '2026-11-15', pieces: 480, palletTypeId: 'MADERA_ESTANDAR', palletTypeLabel: 'Madera Estándar', locationCode: 'A-14' },
      { id: 'oi-s1-2', palletCode: 'UA-8810-2', productId: 'SKU-NES-680', description: 'Cereal Nestlé Nesquik 680g', lotNumber: 'LOT-2026-A1', expirationDate: '2026-11-15', pieces: 480, palletTypeId: 'MADERA_ESTANDAR', palletTypeLabel: 'Madera Estándar', locationCode: 'A-14' },
      { id: 'oi-s1-3', palletCode: 'UA-8810-3', productId: 'SKU-NES-680', description: 'Cereal Nestlé Nesquik 680g', lotNumber: 'LOT-2026-A1', expirationDate: '2026-11-15', pieces: 480, palletTypeId: 'MADERA_ESTANDAR', palletTypeLabel: 'Madera Estándar', locationCode: 'A-14' },
    ];
    const seedOutbound: WarehouseOutbound = {
      id: 'out-seed-1',
      folio: 'SAL-2026-000001',
      status: 'COMPLETED',
      clientCode: 'CLI-001',
      clientName: 'Nestlé México',
      destinationId: 'DEST-CLI001-TOLUCA',
      destinationName: 'CEDIS Toluca',
      destinationAddress: 'Blvd. Aeropuerto 2112, Toluca, Edo. de México',
      carrierCode: 'TR-01',
      carrierName: 'Transportes Castores',
      driverName: 'Juan Pérez',
      economicNumber: 'ECO-901',
      tractorPlates: '12-AA-34',
      boxPlates: '78-BB-90',
      transportType: 'TRAILER',
      sealNumber: 'SL-88401',
      remisionNo: 'REM-88102',
      items: seedOutboundItems,
      totalPallets: 3,
      totalPieces: 1440,
      distinctSkus: 1,
      dispatchedAt: '2026-08-10 14:20',
      dispatchedBy: 'Christian Durán',
      timestamp: '14:20',
    };
    this.outboundsSignal.set([seedOutbound]);
    this.nextOutboundNumber.set(2);
  }

  // Genera un Folio Consecutivo de Recepción (ej. 26510)
  generateNextReceptionFolio(): string {
    const folioStr = this.nextFolioNumber().toString();
    this.nextFolioNumber.update((v) => v + 1);
    return folioStr;
  }

  // Guarda la Pre-Recepción (Caseta)
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
    return updated;
  }
}
