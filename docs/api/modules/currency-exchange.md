# Contrato API — Módulo: Divisas y Tipos de Cambio (Currency Exchange)

> **Base URL:** `/api/v1`  
> **Formato de Comunicación:** `application/json`  
> **Autenticación:** `Bearer <JWT_TOKEN>` en Header `Authorization`  
> **Controladores BE:** `CurrencyController.java`, `ExchangeRateController.java`, `CurrencyExchangeAuditController.java`  
> **Modulo RBAC (FE):** `currency-exchange`  

---

## 📌 1. Estructura Unificada de Respuesta (`ApiResponse<T>`)

### Respuesta Exitosa (200 OK)
```json
{
  "success": true,
  "message": "Mensaje descriptivo del resultado",
  "data": { ... },
  "timestamp": "2026-08-02T10:30:00"
}
```

### Respuesta de Error (400, 404, 409, 500)
```json
{
  "success": false,
  "message": "Descripción clara del motivo del fallo o regla violada",
  "timestamp": "2026-08-02T10:30:00"
}
```

---

## 📋 2. Tabla Resumen de Endpoints

| Método | Endpoint | Controller | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/currencies` | `CurrencyController` | Listar divisas (opcional `?organizationId=`) |
| `GET` | `/api/v1/currencies/{id}` | `CurrencyController` | Obtener detalle de divisa por UUID |
| `POST` | `/api/v1/currencies` | `CurrencyController` | Crear nueva divisa por organización |
| `PUT` | `/api/v1/currencies/{id}` | `CurrencyController` | Modificar metadatos (nombre, símbolo, decimales) |
| `PATCH` | `/api/v1/currencies/{id}/status` | `CurrencyController` | Activar o inactivar divisa |
| `POST` | `/api/v1/currencies/{id}/set-base` | `CurrencyController` | Asignar como Divisa Base Principal de la Organización |
| `GET` | `/api/v1/exchange-rates` | `ExchangeRateController` | Listar tipos de cambio con filtros (`organizationId`, `fromCode`, `toCode`, `date`) |
| `GET` | `/api/v1/exchange-rates/latest` | `ExchangeRateController` | Matriz de paridades vigentes vs divisa base |
| `POST` | `/api/v1/exchange-rates` | `ExchangeRateController` | Registrar / actualizar tasa de cambio (calcula inversa) |
| `POST` | `/api/v1/exchange-rates/convert` | `ExchangeRateController` | Calculadora de conversión en tiempo real |
| `GET` | `/api/v1/exchange-rates/banxico/live/{seriesId}` | `ExchangeRateController` | Consulta de cotización oficial en vivo desde Banxico SIE REST |
| `GET` | `/api/v1/currency-exchange/audit` | `CurrencyExchangeAuditController` | Obtener bitácora de cambios del módulo |

---

## 🎨 3. Catálogo de Enums (TypeScript Interfaces)

```typescript
export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';

export type RateSourceType = 'MANUAL' | 'CENTRAL_BANK' | 'API_AUTO' | 'CUSTOM';

export type ExchangeRateStatus = 'ACTIVE' | 'HISTORICAL' | 'SUPERSEDED';

export type CurrencyAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SET_BASE'
  | 'RATE_CHANGED'
  | 'STATUS_CHANGED';
```

---

## ⚙️ 4. Especificación Detallada de Contratos de Entrada y Salida

### A. Divisas (`/api/v1/currencies`)

#### 1. Listar Divisas (`GET /api/v1/currencies?organizationId={uuid}`)
* **Query Params:** `organizationId` (UUID, opcional)
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Lista de divisas obtenida con éxito",
  "data": [
    {
      "id": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "code": "USD",
      "name": "Dólar Estadounidense",
      "symbol": "$",
      "isBase": true,
      "status": "ACTIVE",
      "decimalPlaces": 2,
      "createdAt": "2026-08-02T10:00:00Z",
      "createdBy": "SYSTEM"
    },
    {
      "id": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "code": "MXN",
      "name": "Peso Mexicano",
      "symbol": "$",
      "isBase": false,
      "status": "ACTIVE",
      "decimalPlaces": 2,
      "createdAt": "2026-08-02T10:00:00Z",
      "createdBy": "SYSTEM"
    }
  ],
  "timestamp": "2026-08-02T10:30:00"
}
```

#### 2. Obtener Detalle (`GET /api/v1/currencies/{id}`)
* **Path Variable:** `id` (UUID)
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Detalle de divisa obtenido con éxito",
  "data": {
    "id": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "code": "USD",
    "name": "Dólar Estadounidense",
    "symbol": "$",
    "isBase": true,
    "status": "ACTIVE",
    "decimalPlaces": 2,
    "createdAt": "2026-08-02T10:00:00Z",
    "createdBy": "SYSTEM"
  },
  "timestamp": "2026-08-02T10:30:00"
}
```

#### 3. Crear Divisa (`POST /api/v1/currencies`)
* **Request Body (`CreateCurrencyRequest`):**
```json
{
  "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
  "code": "EUR",
  "name": "Euro",
  "symbol": "€",
  "isBase": false,
  "decimalPlaces": 2
}
```
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Divisa creada con éxito",
  "data": {
    "id": "d98f0907-9fa5-4bdf-87db-2eb5e7683999",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "code": "EUR",
    "name": "Euro",
    "symbol": "€",
    "isBase": false,
    "status": "ACTIVE",
    "decimalPlaces": 2,
    "createdAt": "2026-08-02T10:30:00Z",
    "createdBy": "admin"
  },
  "timestamp": "2026-08-02T10:30:00"
}
```

#### 4. Modificar Divisa (`PUT /api/v1/currencies/{id}`)
* **Request Body (`UpdateCurrencyRequest`):**
```json
{
  "name": "Euro Unión Europea",
  "symbol": "€",
  "decimalPlaces": 2
}
```
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Divisa actualizada con éxito",
  "data": {
    "id": "d98f0907-9fa5-4bdf-87db-2eb5e7683999",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "code": "EUR",
    "name": "Euro Unión Europea",
    "symbol": "€",
    "isBase": false,
    "status": "ACTIVE",
    "decimalPlaces": 2,
    "updatedAt": "2026-08-02T10:32:00Z",
    "updatedBy": "admin"
  },
  "timestamp": "2026-08-02T10:32:00"
}
```

#### 5. Cambiar Estatus (`PATCH /api/v1/currencies/{id}/status`)
* **Request Body (`UpdateCurrencyStatusRequest`):**
```json
{
  "status": "INACTIVE"
}
```
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Estatus de divisa actualizado con éxito",
  "data": {
    "id": "d98f0907-9fa5-4bdf-87db-2eb5e7683999",
    "code": "EUR",
    "status": "INACTIVE"
  },
  "timestamp": "2026-08-02T10:33:00"
}
```

#### 6. Asignar Divisa Base Principal (`POST /api/v1/currencies/{id}/set-base`)
* **Path Variable:** `id` (UUID de la nueva divisa base)
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Divisa base establecida con éxito",
  "data": {
    "id": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "code": "MXN",
    "name": "Peso Mexicano",
    "symbol": "$",
    "isBase": true,
    "status": "ACTIVE",
    "updatedAt": "2026-08-02T10:34:00Z"
  },
  "timestamp": "2026-08-02T10:34:00"
}
```

---

### B. Tipos de Cambio y Calculadora (`/api/v1/exchange-rates`)

#### 7. Listar Tipos de Cambio (`GET /api/v1/exchange-rates`)
* **Query Params:** `organizationId` (obligatorio), `fromCode`, `toCode`, `date`
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Lista de tipos de cambio recuperada con éxito",
  "data": [
    {
      "id": "e13f0907-9fa5-4bdf-87db-2eb5e7683901",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "fromCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
      "fromCurrencyCode": "USD",
      "toCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
      "toCurrencyCode": "MXN",
      "rate": 18.450000,
      "inverseRate": 0.054201,
      "effectiveDate": "2026-08-02",
      "sourceType": "MANUAL",
      "status": "ACTIVE",
      "notes": "Tipo de cambio diario oficial"
    }
  ],
  "timestamp": "2026-08-02T10:35:00"
}
```

#### 8. Matriz de Paridades Vigentes (`GET /api/v1/exchange-rates/latest`)
* **Query Params:** `organizationId` (obligatorio)
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Matriz de paridades devuelta con éxito",
  "data": {
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "baseCurrency": {
      "id": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
      "code": "USD",
      "name": "Dólar Estadounidense",
      "symbol": "$",
      "isBase": true
    },
    "activeRates": [
      {
        "fromCurrencyCode": "USD",
        "toCurrencyCode": "MXN",
        "rate": 18.450000,
        "inverseRate": 0.054201,
        "effectiveDate": "2026-08-02"
      },
      {
        "fromCurrencyCode": "USD",
        "toCurrencyCode": "EUR",
        "rate": 0.920000,
        "inverseRate": 1.086957,
        "effectiveDate": "2026-08-02"
      }
    ]
  },
  "timestamp": "2026-08-02T10:35:00"
}
```

#### 9. Registrar / Actualizar Tasa (`POST /api/v1/exchange-rates`)
* **Request Body (`CreateExchangeRateRequest`):**
```json
{
  "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
  "fromCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
  "toCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
  "rate": 18.450000,
  "effectiveDate": "2026-08-02",
  "sourceType": "MANUAL",
  "notes": "Actualización matutina tipo de cambio"
}
```
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Tipo de cambio registrado con éxito",
  "data": {
    "id": "e99f0907-9fa5-4bdf-87db-2eb5e7683999",
    "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
    "fromCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
    "fromCurrencyCode": "USD",
    "toCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
    "toCurrencyCode": "MXN",
    "rate": 18.450000,
    "inverseRate": 0.054201,
    "effectiveDate": "2026-08-02",
    "sourceType": "MANUAL",
    "status": "ACTIVE",
    "notes": "Actualización matutina tipo de cambio"
  },
  "timestamp": "2026-08-02T10:36:00"
}
```

#### 10. Calculadora de Conversión (`POST /api/v1/exchange-rates/convert`)
* **Request Body (`ConvertCurrencyRequest`):**
```json
{
  "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
  "fromCode": "USD",
  "toCode": "MXN",
  "amount": 1500.00,
  "date": "2026-08-02"
}
```
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Conversión calculada con éxito",
  "data": {
    "fromCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683901",
    "fromCode": "USD",
    "toCurrencyId": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
    "toCode": "MXN",
    "originalAmount": 1500.00,
    "convertedAmount": 27675.00,
    "rateUsed": 18.450000,
    "effectiveDate": "2026-08-02",
    "conversionPath": "DIRECT (USD -> MXN)"
  },
  "timestamp": "2026-08-02T10:37:00"
}
```

---

### C. Bitácora de Auditoría (`/api/v1/currency-exchange`)

#### 11. Consultar Auditoría (`GET /api/v1/currency-exchange/audit`)
* **Query Params:** `organizationId` (obligatorio), `entityType`, `entityId`, `action`, `startDate`, `endDate`
* **Respuesta Exitosa (200 OK):**
```json
{
  "success": true,
  "message": "Bitácora de auditoría obtenida con éxito",
  "data": [
    {
      "id": "a13f0907-9fa5-4bdf-87db-2eb5e7683901",
      "organizationId": "a53f0907-9fa5-4bdf-87db-2eb5e7683935",
      "entityType": "CURRENCY",
      "entityId": "c13f0907-9fa5-4bdf-87db-2eb5e7683902",
      "action": "SET_BASE",
      "description": "Establecida como divisa base principal de la organización: MXN",
      "previousValue": "{\"code\":\"MXN\",\"isBase\":false}",
      "newValue": "{\"code\":\"MXN\",\"isBase\":true}",
      "performedBy": "enrique",
      "performedAt": "2026-08-02T10:34:00Z"
    }
  ],
  "timestamp": "2026-08-02T10:38:00"
}
```

---

## 🎨 5. Guias de Diseño UI (Homologación con Transportistas y Licencias WMS)

1. **Header Principal:**
   - Título: `Divisas y Tipos de Cambio`
   - Subtítulo: `Gestión de monedas contables, paridades cambiarias, conversión de montos y bitácora de auditoría.`
   - Botón Primario de Acción: `+ Nueva Divisa` y `+ Registrar Tipo de Cambio`.

2. **KPI Cards Superiores:**
   - **Divisa Base Contable:** Muestra el código ISO, nombre y símbolo de la divisa `isBase = true`. Ícono `account_balance` (Azul primario).
   - **Divisas Activas:** Conteo total de divisas en estatus `ACTIVE`. Ícono `monetization_on` (Verde success).
   - **Última Actualización Paridad:** Fecha más reciente registrada en `exchange_rates`. Ícono `sync` (Cian info).
   - **Paridad Principal (ej. USD / MXN):** Tasa activa actual. Ícono `trending_up` (Ámbar warning).

3. **Pestañas / Navigation Tabs:**
   - **Tab 1: Divisas** (Tabla de catálogo de monedas, botón Set Base, cambio de estatus ACTIVE/INACTIVE).
   - **Tab 2: Tipos de Cambio** (Matriz de paridades vigentes vs divisa base, tabla con historial de tasas).
   - **Tab 3: Calculadora de Conversión** (Herramienta interactiva para calcular conversiones con simulación gráfica).
   - **Tab 4: Bitácora de Auditoría** (Historial forense con timeline de cambios).

4. **Estilo & Componentes UI:**
   - Tablas con paginación, filtros por texto/estatus y badges de colores (`ACTIVE` verde, `INACTIVE` gris/rojo).
   - Modales limpios para creación/edición con validación reactiva de formularios (`FormGroup`, `Validators`).
   - Toasts y Confirmations dialogs para acciones destructivas/sensibles (ej. cambiar Divisa Base).
