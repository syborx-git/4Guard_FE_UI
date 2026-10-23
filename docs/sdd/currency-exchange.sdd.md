# SDD — Frontend: Módulo Divisas y Tipos de Cambio (`4Guard_FE_UI`)

> **Módulo:** `currency-exchange`  
> **HU:** HU-148 — Divisas, Tipos de Cambio y Paridades Oficiales Banxico  
> **Repositorio:** `4Guard_FE_UI` · **Ruta:** `apps/admin-console/src/app/features/currency-exchange/`  
> **Framework:** Angular 17+ (Standalone Components, Signals Reactivos, Reactive Forms)  
> **Rol / Permiso:** `WMS_ADMIN`, `FINANCE_MANAGER`, `CURRENCY_MANAGE`  
> **Estado:** 🟢 Golden Standard — Integrado con Banxico SIE REST y Backend Real  

---

## 1. Objetivo y Alcance

Administrar el catálogo de **Monedas Contables (Currencies)** y las **Paridades Cambiarias (Exchange Rates)** requeridas para la valorización de inventarios, facturación de servicios 3PL, cobranza de maniobras y costeo de mercancía extranjera:

1. **Catálogo de Divisas y Moneda Base:** Configuración de monedas operativas (MXN, USD, EUR, CAD) y designación estricta de la divisa base contable de la organización.
2. **Integración en Vivo con Banco Central (Banxico SIE REST):** Consulta directa de cotizaciones oficiales publicadas para el Diario Oficial de la Federación (DOF) con pre-poblado automático de paridades.
3. **Cálculo Automático de Tasa Inversa:** Derivación matemática instantánea de la tasa cruzada inversa (`1 / rate`).
4. **Data Table de Historial Cambiario:** Matriz con fechas de vigencia, tipo de fuente (`CENTRAL_BANK`, `COMMERCIAL`, `MANUAL`) y estado de paridad.
5. **Auditoría Financiera:** Trazabilidad inmutable de cualquier ajuste manual de tasas de cambio.

---

## 2. Estructura de Archivos del Módulo

```
apps/admin-console/src/app/features/currency-exchange/
├── currency-exchange-management/
│   ├── currency-exchange-management.component.ts    ← Componente Standalone reactivo
│   ├── currency-exchange-management.component.html  ← Template Split-View con Banxico Live
│   └── currency-exchange-management.component.css   ← Estilos con tokens Synexia
├── currency-exchange.models.ts                      ← DTOs e interfaces homologadas con BE
├── currency-exchange.routes.ts                      ← Rutas del módulo
├── currency-exchange.service.ts                     ← Servicio HTTP hacia /api/v1/currencies y Banxico
└── currency-exchange.validators.ts                  ← Validadores de tasas numéricas positivas
```

---

## 3. Normativa de Homologación de Componentes (ADR-013)

| Componente | Implementación en este Módulo | Requisitos de Cumplimiento |
|---|---|---|
| **Hero Header** | `#ce-hero-header` | Icono navy 52x52px (`currency_exchange`), botón badge `.btn-back-admin` hacia `/admin`, eyebrow `MÓDULO FINANCIERO · HU-148` en monospace dorado, H1 `Divisas y Tipos de Cambio`. |
| **KPI Cards Grid** | `.carriers-kpi-grid` | Divisa Base Contable (ej. `MXN`), Divisas Activas (verde), Tasas Registradas (ámbar), Paridad Actual USD/MXN (azul). |
| **Directorio Split-View** | `.carriers-directory` (35%) | Lista de divisas con avatar circular mostrando el símbolo de moneda (`$`, `€`), código ISO y badge BASE. |
| **Data Table de Paridades** | `.table-container`, `.ce-rate-table` | Tabla con paridad, tasa inversa, fecha de vigencia, fuente, badge de estatus y celda de acciones. |
| **Banner Banxico Live** | `.banner-banxico-info` | Banner dorado informativo con serie Banxico (ej. `SF57805`), fecha de publicación oficial y tasa recuperada. |
| **Selectores & Dropdowns** | `.form-select` | Selectores de divisa origen/destino y tipo de fuente cambiaria. |
| **Drawer de Auditoría** | `.carriers-timeline-preview` | Panel lateral con timeline cronológico de ajustes manuales con deltas de tasa. |

---

## 4. Estado Reactivo del Componente (`Signals`)

| Signal | Tipo | Descripción |
|---|---|---|
| `currencies` | `WritableSignal<Currency[]>` | Lista de monedas registradas en el catálogo |
| `selectedCurrency` | `WritableSignal<Currency \| null>` | Divisa actualmente seleccionada en el editor |
| `rates` | `WritableSignal<ExchangeRate[]>` | Historial de paridades de la divisa seleccionada |
| `panelView` | `WritableSignal<'CURRENCY_FORM' \| 'RATE_FORM'>` | Conmutador de vista del panel derecho |
| `banxicoLiveInfo` | `WritableSignal<BanxicoLiveRateData \| null>` | Última cotización recuperada de la API de Banxico |
| `isFetchingBanxico` | `WritableSignal<boolean>` | Indicador de consulta HTTP al servicio de Banco Central |
| `kpis` | `ComputedSignal<CurrencyKpis>` | Cálculo reactivo de métricas principales |

---

## 5. Modelos de Datos TypeScript (`currency-exchange.models.ts`)

```typescript
export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';
export type RateSourceType = 'CENTRAL_BANK' | 'COMMERCIAL' | 'MANUAL';

export interface Currency {
  id: string;                      // UUID v4
  organizationId: string;
  code: string;                    // 'USD', 'MXN', 'EUR'
  name: string;                    // 'Dólar Estadounidense'
  symbol: string;                  // '$'
  decimalPlaces: number;           // 2
  isBase: boolean;                 // true si es la moneda contable
  status: CurrencyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRate {
  id: string;
  organizationId: string;
  baseCurrencyId: string;
  targetCurrencyId: string;
  targetCurrencyCode: string;
  rate: number;                    // 18.5240
  inverseRate: number;             // 0.05398
  effectiveDate: string;           // '2026-09-12'
  sourceType: RateSourceType;
  sourceSeriesId?: string;         // 'SF57805'
  notes?: string;
  status: 'ACTIVE' | 'HISTORICAL';
}

export interface BanxicoLiveRateData {
  seriesId: string;
  currencyCode: string;
  rate: number;
  publicationDate: string;
  sourceType: string;
}
```

---

## 6. Contrato HTTP REST (`CurrencyExchangeService`)

| Método | Verbo | Endpoint | Descripción |
|---|---|---|---|
| `getCurrencies()` | `GET` | `/api/v1/currencies` | Lista de divisas registradas |
| `createCurrency(dto)` | `POST` | `/api/v1/currencies` | Alta de divisa con validación de código ISO |
| `updateCurrency(id, dto)`| `PUT` | `/api/v1/currencies/{id}` | Actualización de nombre y símbolo |
| `setBaseCurrency(id)` | `POST` | `/api/v1/currencies/{id}/set-base` | Transfiere la designación de divisa base |
| `getExchangeRates(curId)`| `GET` | `/api/v1/exchange-rates?currencyId={id}` | Historial de paridades de la divisa |
| `createExchangeRate(dto)`| `POST` | `/api/v1/exchange-rates` | Registra nueva paridad con cálculo inverso |
| `getBanxicoLiveRate(sId)`| `GET` | `/api/v1/exchange-rates/banxico/live/{sId}` | Consulta en tiempo real a Banxico SIE |
| `getAudit(id)` | `GET` | `/api/v1/currencies/{id}/audit` | Trazabilidad de cambios en paridades |

---

## 7. Validaciones y Notificaciones

1. **Validación de Código ISO 4217:** 3 caracteres mayúsculos alfabéticos (`^[A-Z]{3}$`).
2. **Tasa Numérica Positiva:** Validador reactivo exigiendo `rate > 0` con hasta 6 decimales de precisión.
3. **Notificaciones:** Todo disparo de Banxico o persistencia emite un mensaje a través de `ToastService`.
