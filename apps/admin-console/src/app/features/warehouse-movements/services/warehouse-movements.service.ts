/**
 * @file warehouse-movements.service.ts
 * @description Servicio reactivo basado en Angular Signals para el módulo Movimientos de Almacén.
 * Administra el estado global de Recepciones, Traspasos, Salidas Outbound e Inventario de Bahías.
 */

import { Injectable, signal, computed } from '@angular/core';
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
} from '../models/warehouse-movements.models';

@Injectable({
  providedIn: 'root',
})
export class WarehouseMovementsService {
  // Consecutivo base de recepción
  private nextFolioNumber = signal(26510);
  private nextTransferNumber = signal(4081);
  private nextDispatchNumber = signal(8821);

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
  readonly forkliftOperators = this.forkliftOperatorsSignal.asReadonly();

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

  // Bahías y su stock inicial simulado
  private readonly locationsSignal = signal<Record<string, LocationStockInfo>>({
    'A-14': {
      locationCode: 'A-14',
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
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    },
    'B-02': {
      locationCode: 'B-02',
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
    'C-10': {
      locationCode: 'C-10',
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
  readonly transfers = this.transfersSignal.asReadonly();
  readonly dispatches = this.dispatchesSignal.asReadonly();
  readonly locations = this.locationsSignal.asReadonly();
  readonly inventoryBatches = this.inventoryBatchesSignal.asReadonly();

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
        folio: 'TR-4080',
        forkliftOperator: 'Roberto Gómez',
        originLocation: 'B-01',
        destinationLocation: 'A-14',
        pallets: demoReception.pallets,
        totalPallets: 2,
        totalPieces: 960,
        transferredAt: '2026-08-10 11:30',
        transferredBy: 'Christian Durán',
      },
    ]);

    // Salida inicial simulada
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
      lotNumber: '',
      elaborationDate: '',
      expirationDate: '',
      productId: '',
      productName: '',
      piecesPerPallet: 480,
      selectedPalletType: 'MADERA',
      pallets: [],
      createdAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      capturedBy: 'Usuario Activo',
    };

    this.receptionsSignal.update((list) => [newHeader, ...list]);
    return newHeader;
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

  // Procesa el Cambio de Almacén / Traspaso Interno
  executeTransfer(
    origin: string,
    destination: string,
    forkliftOperator: string,
    transferredBy: string
  ): WarehouseTransfer | null {
    const originInfo = this.getLocationInfo(origin);
    if (originInfo.totalPallets === 0) return null;

    if (!this.isLocationEmpty(destination)) {
      throw new Error(`La bahía destino ${destination} no está completamente en ceros.`);
    }

    const transferFolio = `TR-${this.nextTransferNumber()}`;
    this.nextTransferNumber.update((v) => v + 1);

    const newTransfer: WarehouseTransfer = {
      folio: transferFolio,
      forkliftOperator,
      originLocation: origin.toUpperCase(),
      destinationLocation: destination.toUpperCase(),
      pallets: [...originInfo.pallets],
      totalPallets: originInfo.totalPallets,
      totalPieces: originInfo.totalPieces,
      transferredAt: new Date().toLocaleString('es-MX'),
      transferredBy,
    };

    // Actualizar Estado de Bahías
    const locs = { ...this.locationsSignal() };
    locs[origin.toUpperCase()] = {
      locationCode: origin.toUpperCase(),
      totalPallets: 0,
      totalPieces: 0,
      pallets: [],
    };
    locs[destination.toUpperCase()] = {
      locationCode: destination.toUpperCase(),
      totalPallets: newTransfer.totalPallets,
      totalPieces: newTransfer.totalPieces,
      pallets: newTransfer.pallets,
    };

    this.locationsSignal.set(locs);
    this.transfersSignal.update((list) => [newTransfer, ...list]);

    return newTransfer;
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
