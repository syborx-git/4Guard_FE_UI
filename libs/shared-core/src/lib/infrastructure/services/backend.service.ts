/**
 * @file backend.service.ts
 * @description Servicio Singleton base simulado (Dummy/Mock) para el WMS 4GUARD.
 *
 * Mantiene una base de datos en localStorage para que todo el flujo del WMS
 * (Mapa 2D, Inventario, Recepción, Despacho, QM) funcione de forma interactiva
 * completamente local y sin necesidad de correr un servidor backend.
 */

import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import { InventoryStatus } from '../../domain/enums/inventory-status.enum';
import { UnitOfMeasure } from '../../domain/models/item.model';
import { LocationType } from '../../domain/models/location.model';
import { TransferOrderType, TransferOrderStatus } from '../../domain/models/transfer-order.model';
import { ReceiptStatus } from '../../domain/models/receipt.model';

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  traceId?: string;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

const DB_KEY = '4guard_backend_db';

const INITIAL_DB = {
  items: [
    { id: "SSCC-0001", sku: "SKU-CAFE-001", description: "Café Molido Premium 500g", batchNumber: "L2024-001", status: InventoryStatus.AVAILABLE, locationId: "LOC-A1-01", clientId: "CLI-NESPRESSO", clientName: "Nespresso", quantity: 48, unitOfMeasure: UnitOfMeasure.BOX, receivedAt: "2024-06-10T08:00:00Z", expiryDate: "2025-06-10T00:00:00Z", branchId: "BR-MTY-01", weightKg: 24, volumeM3: 0.1, barcode: "7501020304051", sscc: "375010203040500018", lastStatusChangeAt: "2024-06-10T08:00:00Z", notes: "Lote recibido sin discrepancias", metadata: null },
    { id: "SSCC-0002", sku: "SKU-CAFE-001", description: "Café Molido Premium 500g", batchNumber: "L2024-002", status: InventoryStatus.AVAILABLE, locationId: "LOC-A1-02", clientId: "CLI-NESPRESSO", clientName: "Nespresso", quantity: 36, unitOfMeasure: UnitOfMeasure.BOX, receivedAt: "2024-06-12T10:30:00Z", expiryDate: "2025-06-12T00:00:00Z", branchId: "BR-MTY-01", weightKg: 18, volumeM3: 0.08, barcode: "7501020304051", sscc: "375010203040500025", lastStatusChangeAt: "2024-06-12T10:30:00Z", notes: "Lote secundario", metadata: null },
    { id: "SSCC-0003", sku: "SKU-AGUA-002", description: "Agua Purificada 19L", batchNumber: "L2024-003", status: InventoryStatus.QUARANTINE, locationId: "LOC-Q-01", clientId: "CLI-BONAFONT", clientName: "Bonafont", quantity: 24, unitOfMeasure: UnitOfMeasure.UNIT, receivedAt: "2024-06-14T09:00:00Z", expiryDate: "2024-12-14T00:00:00Z", branchId: "BR-MTY-01", weightKg: 456, volumeM3: 0.5, barcode: "7501008003123", sscc: "375010080031200032", lastStatusChangeAt: "2024-06-14T09:00:00Z", notes: "Muestreo pendiente", metadata: null },
    { id: "SSCC-0004", sku: "SKU-LECHE-003", description: "Leche Entera UHT 1L", batchNumber: "L2024-004", status: InventoryStatus.QM_BLOCKED, locationId: "LOC-B2-03", clientId: "CLI-LALA", clientName: "Lala", quantity: 120, unitOfMeasure: UnitOfMeasure.UNIT, receivedAt: "2024-06-08T07:00:00Z", expiryDate: "2024-09-08T00:00:00Z", branchId: "BR-MTY-01", weightKg: 120, volumeM3: 0.2, barcode: "7501020304060", sscc: "375010203040600010", lastStatusChangeAt: "2024-06-15T14:00:00Z", notes: "Drenado o re-etiquetado requerido", metadata: null },
    { id: "SSCC-0005", sku: "SKU-LECHE-003", description: "Leche Entera UHT 1L", batchNumber: "L2024-005", status: InventoryStatus.QM_BLOCKED, locationId: "LOC-B2-04", clientId: "CLI-LALA", clientName: "Lala", quantity: 96, unitOfMeasure: UnitOfMeasure.UNIT, receivedAt: "2024-06-09T11:00:00Z", expiryDate: "2024-09-09T00:00:00Z", branchId: "BR-MTY-01", weightKg: 96, volumeM3: 0.18, barcode: "7501020304060", sscc: "375010203040600027", lastStatusChangeAt: "2024-06-15T11:45:00Z", notes: "Bloqueo por calidad", metadata: null },
    { id: "SSCC-0006", sku: "SKU-JUGO-004", description: "Jugo de Naranja 1L", batchNumber: "L2024-006", status: InventoryStatus.RESERVED, locationId: "LOC-C3-01", clientId: "CLI-DEL-VALLE", clientName: "Del Valle", quantity: 72, unitOfMeasure: UnitOfMeasure.BOX, receivedAt: "2024-06-13T14:00:00Z", expiryDate: "2024-11-13T00:00:00Z", branchId: "BR-MTY-01", weightKg: 72, volumeM3: 0.15, barcode: "7501020304077", sscc: "375010203040700019", lastStatusChangeAt: "2024-06-15T10:00:00Z", notes: "Asignado a pedido OUTBOUND", metadata: null },
    { id: "SSCC-0007", sku: "SKU-GALLETA-005", description: "Galleta Surtida 400g", batchNumber: "L2024-007", status: InventoryStatus.IN_PICKING, locationId: "LOC-D1-02", clientId: "CLI-GAMESA", clientName: "Gamesa", quantity: 60, unitOfMeasure: UnitOfMeasure.BOX, receivedAt: "2024-06-11T13:00:00Z", expiryDate: "2024-12-11T00:00:00Z", branchId: "BR-MTY-01", weightKg: 24, volumeM3: 0.1, barcode: "7501020304084", sscc: "375010203040800018", lastStatusChangeAt: "2024-06-15T11:00:00Z", notes: "En picking activo", metadata: null }
  ],
  locations: [
    { id: "LOC-A1-01", code: "A-1-01", type: LocationType.RACK, row: 0, col: 0, capacity: 60, occupied: 48, isBlocked: false },
    { id: "LOC-A1-02", code: "A-1-02", type: LocationType.RACK, row: 0, col: 1, capacity: 60, occupied: 36, isBlocked: false },
    { id: "LOC-A1-03", code: "A-1-03", type: LocationType.RACK, row: 0, col: 2, capacity: 60, occupied: 55, isBlocked: false },
    { id: "LOC-A2-01", code: "A-2-01", type: LocationType.RACK, row: 0, col: 3, capacity: 60, occupied: 48, isBlocked: false },
    { id: "LOC-B2-03", code: "B-2-03", type: LocationType.RACK, row: 1, col: 5, capacity: 80, occupied: 120, isBlocked: true },
    { id: "LOC-B2-04", code: "B-2-04", type: LocationType.RACK, row: 1, col: 6, capacity: 80, occupied: 96, isBlocked: true },
    { id: "LOC-C3-01", code: "C-3-01", type: LocationType.RACK, row: 2, col: 4, capacity: 100, occupied: 72, isBlocked: false },
    { id: "LOC-D1-02", code: "D-1-02", type: LocationType.RACK, row: 3, col: 1, capacity: 120, occupied: 60, isBlocked: false },
    { id: "LOC-Q-01", code: "Q-01", type: LocationType.QUARANTINE_ZONE, row: 6, col: 0, capacity: 50, occupied: 24, isBlocked: false },
    { id: "LOC-ANDEN-01", code: "AND-01", type: LocationType.DOCK_RECEIVING, row: 7, col: 0, capacity: 200, occupied: 144, isBlocked: false }
  ],
  receipts: [
    {
      id: "REC-2024-001",
      asnReference: "ASN-NESPRESSO-240616",
      status: ReceiptStatus.IN_PROGRESS,
      clientId: "CLI-NESPRESSO",
      clientName: "Nespresso",
      dockId: "AND-01",
      truckPlates: "ABC-1234-B",
      driverName: "Juan Pérez García",
      seals: ["SELLO-001", "SELLO-002"],
      expectedLines: 5,
      receivedLines: 3,
      scheduledAt: "2024-06-16T08:00:00Z",
      arrivedAt: "2024-06-16T07:45:00Z",
      lines: []
    }
  ],
  transfer_orders: [
    { id: "TO-2024-001", orderNumber: "ORD-001", type: TransferOrderType.OUTBOUND, status: TransferOrderStatus.PENDING, priority: 1, clientId: "CLI-NESPRESSO", clientName: "Nespresso", branchId: "BR-MTY-01", assignedOperatorId: "u-op1", assignedOperatorName: "Roberto Sánchez", dueDate: "2026-06-25T18:00:00Z", startedAt: null, completedAt: null, clientOrderReference: "REF-NES-990", lines: [], notes: null, createdAt: "2026-06-22T08:00:00Z", updatedAt: "2026-06-22T08:00:00Z" }
  ]
};

@Injectable({ providedIn: 'root' })
export class BackendService {
  constructor() {
    this.initDb();
  }

  private initDb(): void {
    if (!localStorage.getItem(DB_KEY)) {
      localStorage.setItem(DB_KEY, JSON.stringify(INITIAL_DB));
    }
  }

  private getDb() {
    this.initDb();
    return JSON.parse(localStorage.getItem(DB_KEY) || '{}');
  }

  private saveDb(db: any): void {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  // ─── Métodos CRUD Simulados ────────────────────────────────────────────────

  get<T>(path: string, params?: QueryParams): Observable<T> {
    const db = this.getDb();
    let result: any = null;

    if (path.includes('/api/inventory/items')) {
      const status = params?.['status'];
      let itemsList = db.items as any[];
      if (status !== undefined && status !== null && status !== '') {
        itemsList = itemsList.filter(item => item.status === Number(status));
      }
      result = {
        content: itemsList,
        totalElements: itemsList.length,
        totalPages: 1,
        page: 0,
        size: 20
      };
    } else if (path.includes('/api/locations')) {
      result = db.locations;
    } else if (path.includes('/api/receipts')) {
      result = db.receipts;
    } else if (path.includes('/api/transfer-orders')) {
      result = db.transfer_orders;
    } else {
      // Fallback genérico para otros recursos
      result = [];
    }

    return of(result as T).pipe(delay(200));
  }

  post<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    const db = this.getDb();
    let responseObj: any = body;

    if (path.includes('/api/inventory/items')) {
      const newItem = { ...(body as any), id: `SSCC-${Date.now()}` };
      db.items.push(newItem);
      this.saveDb(db);
      responseObj = newItem;
    } else if (path.includes('/api/transfer-orders')) {
      const newOrder = { ...(body as any), id: `TO-${Date.now()}` };
      db.transfer_orders.push(newOrder);
      this.saveDb(db);
      responseObj = newOrder;
    }

    return of(responseObj as TResponse).pipe(delay(200));
  }

  put<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    return of(body as unknown as TResponse).pipe(delay(200));
  }

  patch<TBody, TResponse>(path: string, body: TBody): Observable<TResponse> {
    const db = this.getDb();
    let responseObj: any = body;

    // Detectar si estamos actualizando un ítem específico del inventario
    const itemMatch = path.match(/\/api\/inventory\/items\/([A-Za-z0-9-]+)/);
    if (itemMatch) {
      const itemId = itemMatch[1];
      db.items = db.items.map((i: any) => {
        if (i.id === itemId) {
          const updated = { ...i, ...(body as any), lastStatusChangeAt: new Date().toISOString() };
          responseObj = updated;
          return updated;
        }
        return i;
      });
      this.saveDb(db);
    }

    return of(responseObj as TResponse).pipe(delay(200));
  }

  delete<TResponse>(path: string): Observable<TResponse> {
    const db = this.getDb();

    // Eliminar ítem
    const itemMatch = path.match(/\/api\/inventory\/items\/([A-Za-z0-9-]+)/);
    if (itemMatch) {
      const itemId = itemMatch[1];
      db.items = db.items.filter((i: any) => i.id !== itemId);
      this.saveDb(db);
    }

    return of({ success: true } as unknown as TResponse).pipe(delay(200));
  }
}
