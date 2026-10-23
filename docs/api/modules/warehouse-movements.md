# 4GUARD WMS — Especificación de API: Movimientos de Almacén

> **Módulo:** `warehouse-movements`  
> **Ruta Frontend:** `/warehouse-movements`  
> **Base Path Backend:** `/api/v1/warehouse-movements` (y `/api/v1/receipts`, `/api/v1/transfers`, `/api/v1/dispatches`)  
> **Estado:** 🔧 En Especificación / Desarrollo SDD

---

## 1. Visión General

El módulo de **Movimientos de Almacén** administra las tres operaciones logísticas fundamentales en piso de almacén:
1. **Recepción de Mercancía (Inbound / F01):** Registro de caseta/andén, descarga de tarimas (UAs), control de lotes/caducidades, firmas de líder y cambio de remisión.
2. **Cambio de Almacén (Traspasos Internos):** Movimiento de inventario entre bahías/ubicaciones con regla estricta de validación de bahía destino en ceros.
3. **Salidas de Almacén (Outbound / Despacho):** Selección de inventario bajo algoritmo sugerido FIFO/FEFO, asignación de transporte, cincho/sello de seguridad y pase de salida.

---

## 2. Entidades de Dominio

### 2.1 Recepción (`Receipt`)
```typescript
export interface Receipt {
  id: string;                      // UUID
  folio: string;                   // Ej: REC-26510
  clientId: string;                // UUID del Cliente
  clientName: string;              // Nombre comercial
  docNumber: string;               // Remisión / Factura
  docDate: string;                 // ISO Date
  carrierLine: string;             // Transportista
  driverName: string;              // Chofer
  tractorPlates: string;           // Placas
  boxPlates: string;               // Placas caja
  rampNumber: number;              // Rampa/Andén (1-12)
  forkliftOperator: string;        // Montacarguista asignado
  status: ReceiptStatus;           // PLANNED | REGISTERED | IN_PROGRESS | COMPLETED | CANCELLED
  lotNumber: string;               // Lote de producción
  elaborationDate?: string;        // Fecha elaboración
  expirationDate?: string;         // Fecha caducidad
  productId: string;               // SKU
  productName: string;             // Descripción
  piecesPerPallet: number;         // Piezas por tarima
  palletType: string;              // Tipo de tarima (Madera, CHEP, Plástico)
  sealNumbers: string[];           // Lista de sellos/cinchos
  pallets: ReceiptPallet[];        // Detalle de UAs descargadas
  cancellationReason?: string;    // Justificación de cancelación
  leaderAuthorizedBy?: string;     // Nombre de líder que autorizó
  capturedBy: string;              // Usuario creador
  createdAt: string;               // ISO OffsetDateTime
  completedAt?: string;
}
```

### 2.2 Orden de Transferencia (`TransferOrder`)
```typescript
export interface TransferOrder {
  id: string;                      // UUID
  folio: string;                   // Ej: TR-4081
  forkliftOperator: string;        // Montacarguista
  originLocation: string;          // Ej: A-14
  destinationLocation: string;     // Ej: M-98
  totalPallets: number;            // Cantidad de tarimas
  totalPieces: number;             // Cantidad total de piezas
  pallets: ReceiptPallet[];        // UAs transferidas
  transferredBy: string;           // Usuario que ejecutó
  transferredAt: string;           // ISO OffsetDateTime
}
```

### 2.3 Despacho Outbound (`OutboundDispatch`)
```typescript
export interface OutboundDispatch {
  id: string;                      // UUID
  folio: string;                   // Ej: DESP-8821
  clientId: string;
  clientName: string;
  destinationPlant: string;       // Planta / CEDIS destino
  sealNumber: string;              // Sello obligatorio de salida
  carrierName: string;             // Transportista
  driverName: string;
  economicNumber: string;
  tractorPlates: string;
  boxPlates: string;
  transportType: string;          // Camioneta | Torton | Tráiler
  forkliftOperator: string;
  productId: string;
  productName: string;
  selectedPallets: ReceiptPallet[];
  totalPallets: number;
  totalPieces: number;
  dispatchedBy: string;
  dispatchedAt: string;
}
```

---

## 3. Endpoints REST Backend Contract

### 3.1 Recepciones (`/api/v1/receipts`)

| Método | Endpoint | Descripción | Body / Query | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/receipts` | Lista recepciones con filtros | `?query=...&status=...&fromDate=...` | `ApiResponse<Receipt[]>` |
| `GET` | `/api/v1/receipts/{id}` | Obtener detalle por ID o Folio | — | `ApiResponse<Receipt>` |
| `POST` | `/api/v1/receipts/check-in` | Registrar captura inicial de caseta | `CheckInDto` | `ApiResponse<Receipt>` |
| `PUT` | `/api/v1/receipts/{id}/complete` | Completar y cerrar recepción | `CompleteReceiptDto` | `ApiResponse<Receipt>` |
| `POST` | `/api/v1/receipts/{id}/cancel` | Cancelar recepción con firma | `{ reason: string, leaderPin: string }` | `ApiResponse<Receipt>` |
| `PATCH` | `/api/v1/receipts/change-remision` | Cambiar número de remisión | `{ oldRemision, newRemision, justification }` | `ApiResponse<{ updatedCount: number }>` |

### 3.2 Traspasos (`/api/v1/transfers`)

| Método | Endpoint | Descripción | Body / Query | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/transfers` | Lista traspasos realizados | `?query=...&origin=...&destination=...` | `ApiResponse<TransferOrder[]>` |
| `POST` | `/api/v1/transfers` | Registrar movimiento de almacén | `CreateTransferDto` | `ApiResponse<TransferOrder>` |
| `GET` | `/api/v1/transfers/locations/{code}` | Consulta estado y ceros de bahía | — | `ApiResponse<LocationStockInfo>` |

### 3.3 Salidas (`/api/v1/dispatches`)

| Método | Endpoint | Descripción | Body / Query | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/dispatches` | Lista despachos ejecutados | `?query=...&client=...` | `ApiResponse<OutboundDispatch[]>` |
| `GET` | `/api/v1/dispatches/inventory-batches` | Consulta lotes sugeridos FIFO/FEFO | `?productId=...` | `ApiResponse<InventoryBatch[]>` |
| `POST` | `/api/v1/dispatches` | Autorizar y ejecutar salida Outbound | `CreateDispatchDto` | `ApiResponse<OutboundDispatch>` |

---

## 4. Reglas de Negocio Estrictas

1. **Bahía Destino en Ceros:** Al realizar un Cambio de Almacén (`TransferOrder`), la ubicación destino DEBE tener exactamente `totalPallets === 0` y `totalPieces === 0`. Si contiene algún ítem, el sistema cancelará la operación y notificará error.
2. **Autorización de Líder:** La cancelación de una recepción o el cierre con discrepancias de descarga requiere la validación del PIN/Firma del Líder de Almacén a través de `LeaderAuthModalComponent`.
3. **Cinchos / Sellos Obligatorios:** Las salidas Outbound exigen el registro del número de sello de seguridad antes de autorizar el despacho.
4. **Algoritmo FIFO/FEFO:** El motor de salidas prioriza automáticamente los lotes de producción con fecha de caducidad más próxima o fecha de elaboración más antigua (`isFifoSuggested = true`).
5. **RBAC:** Requiere permiso en el módulo `warehouse-movements`.
