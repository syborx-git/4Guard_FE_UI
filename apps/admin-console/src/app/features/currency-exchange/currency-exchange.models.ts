/**
 * @file currency-exchange.models.ts
 * @description Modelos, tipos y datos dummy para HU-148 — Gestión de Divisas y Tipos de Cambio.
 * 4GUARD WMS Enterprise — Módulo Financiero
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS BASE
// ═══════════════════════════════════════════════════════════════════

export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';

export type ExchangeRateStatus = 'SCHEDULED' | 'CURRENT' | 'HISTORICAL';

export type ExchangeRateSource =
  | 'MANUAL'
  | 'OFFICIAL_REFERENCE'
  | 'BANK'
  | 'COMMERCIAL_AGREEMENT'
  | 'CLIENT_CONTRACT'
  | 'OTHER';

export type RateFreshnessStatus = 'CURRENT' | 'REVIEW_REQUIRED' | 'OUTDATED';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════

export interface Currency {
  id: string;
  organizationId: string;
  isoCode: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  status: CurrencyStatus;
  currentRate: number;
  freshnessStatus: RateFreshnessStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ExchangeRate {
  id: string;
  organizationId: string;
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: ExchangeRateStatus;
  source: ExchangeRateSource;
  reason: string;
  observations: string;
  createdBy: string;
  createdAt: string;
}

export interface CurrencyAuditEntry {
  id: string;
  organizationId: string;
  entityType: 'CURRENCY' | 'EXCHANGE_RATE';
  entityId: string;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'ACTIVATE'
    | 'DEACTIVATE'
    | 'CHANGE_BASE_CURRENCY'
    | 'CREATE_EXCHANGE_RATE';
  previousValue: unknown;
  newValue: unknown;
  performedBy: string;
  performedAt: string;
}

export interface ConversionPreview {
  amount: number;
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  rate: number;
  convertedAmount: number;
}

export interface CurrencyKpis {
  baseCurrencyCode: string;
  activeCurrencies: number;
  currentRates: number;
  reviewRequired: number;
}

// ═══════════════════════════════════════════════════════════════════
// CATÁLOGOS DE ETIQUETAS
// ═══════════════════════════════════════════════════════════════════

export const EXCHANGE_RATE_SOURCE_LABELS: Record<ExchangeRateSource, string> = {
  MANUAL: 'Captura manual',
  OFFICIAL_REFERENCE: 'Referencia oficial',
  BANK: 'Banco',
  COMMERCIAL_AGREEMENT: 'Acuerdo comercial',
  CLIENT_CONTRACT: 'Contrato con cliente',
  OTHER: 'Otro',
};

export const EXCHANGE_RATE_STATUS_LABELS: Record<ExchangeRateStatus, string> = {
  CURRENT: 'Vigente',
  SCHEDULED: 'Programado',
  HISTORICAL: 'Histórico',
};

export const FRESHNESS_LABELS: Record<RateFreshnessStatus, string> = {
  CURRENT: 'Vigente',
  REVIEW_REQUIRED: 'Revisión requerida',
  OUTDATED: 'Desactualizado',
};

// ═══════════════════════════════════════════════════════════════════
// DATOS DUMMY TIPADOS
// ═══════════════════════════════════════════════════════════════════

const ORG_ID = 'org-4guard-mx-001';

export const DUMMY_CURRENCIES: Currency[] = [
  {
    id: 'cur-001',
    organizationId: ORG_ID,
    isoCode: 'MXN',
    name: 'Peso mexicano',
    symbol: '$',
    decimalPlaces: 2,
    isBaseCurrency: true,
    status: 'ACTIVE',
    currentRate: 1.000000,
    freshnessStatus: 'CURRENT',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2026-07-27T08:00:00Z',
    updatedBy: 'system@4guard.mx',
  },
  {
    id: 'cur-002',
    organizationId: ORG_ID,
    isoCode: 'USD',
    name: 'Dólar estadounidense',
    symbol: 'US$',
    decimalPlaces: 2,
    isBaseCurrency: false,
    status: 'ACTIVE',
    currentRate: 18.754321,
    freshnessStatus: 'CURRENT',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2026-07-27T13:45:00Z',
    updatedBy: 'gerente.operaciones@4guard.mx',
  },
  {
    id: 'cur-003',
    organizationId: ORG_ID,
    isoCode: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimalPlaces: 2,
    isBaseCurrency: false,
    status: 'ACTIVE',
    currentRate: 21.394500,
    freshnessStatus: 'REVIEW_REQUIRED',
    createdAt: '2024-03-10T10:30:00Z',
    updatedAt: '2026-07-10T11:20:00Z',
    updatedBy: 'gerente.operaciones@4guard.mx',
  },
];

export const DUMMY_EXCHANGE_RATES: ExchangeRate[] = [
  // USD → MXN histórico
  {
    id: 'er-001',
    organizationId: ORG_ID,
    sourceCurrencyCode: 'USD',
    targetCurrencyCode: 'MXN',
    rate: 17.820000,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: '2026-03-31T23:59:59Z',
    status: 'HISTORICAL',
    source: 'BANK',
    reason: 'Actualización trimestral Q1 2026.',
    observations: 'Tipo negociado con BBVA Bancomer.',
    createdBy: 'gerente.operaciones@4guard.mx',
    createdAt: '2025-12-28T16:30:00Z',
  },
  {
    id: 'er-002',
    organizationId: ORG_ID,
    sourceCurrencyCode: 'USD',
    targetCurrencyCode: 'MXN',
    rate: 18.620000,
    effectiveFrom: '2026-04-01T00:00:00Z',
    effectiveTo: '2026-07-26T23:59:59Z',
    status: 'HISTORICAL',
    source: 'BANK',
    reason: 'Actualización trimestral Q2 2026.',
    observations: 'Tipo negociado con Santander México.',
    createdBy: 'gerente.operaciones@4guard.mx',
    createdAt: '2026-03-25T10:00:00Z',
  },
  {
    id: 'er-003',
    organizationId: ORG_ID,
    sourceCurrencyCode: 'USD',
    targetCurrencyCode: 'MXN',
    rate: 18.754321,
    effectiveFrom: '2026-07-27T13:45:00Z',
    effectiveTo: null,
    status: 'CURRENT',
    source: 'MANUAL',
    reason: 'Actualización semestral según acuerdo con dirección financiera.',
    observations: 'Aprobado por Gerente de Operaciones. Referencia Banxico del día.',
    createdBy: 'gerente.operaciones@4guard.mx',
    createdAt: '2026-07-27T13:45:00Z',
  },
  // EUR → MXN histórico
  {
    id: 'er-004',
    organizationId: ORG_ID,
    sourceCurrencyCode: 'EUR',
    targetCurrencyCode: 'MXN',
    rate: 20.850000,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveTo: '2026-06-30T23:59:59Z',
    status: 'HISTORICAL',
    source: 'COMMERCIAL_AGREEMENT',
    reason: 'Tipo acordado para contratos de importación H1 2026.',
    observations: 'Validado por área jurídica y financiera.',
    createdBy: 'gerente.operaciones@4guard.mx',
    createdAt: '2025-12-20T09:00:00Z',
  },
  {
    id: 'er-005',
    organizationId: ORG_ID,
    sourceCurrencyCode: 'EUR',
    targetCurrencyCode: 'MXN',
    rate: 21.394500,
    effectiveFrom: '2026-07-01T00:00:00Z',
    effectiveTo: null,
    status: 'CURRENT',
    source: 'COMMERCIAL_AGREEMENT',
    reason: 'Actualización semestral H2 2026. Revisión pendiente de aprobación.',
    observations: 'Requiere validación con proveedor europeo antes del cierre del mes.',
    createdBy: 'gerente.operaciones@4guard.mx',
    createdAt: '2026-06-28T14:00:00Z',
  },
];

export const DUMMY_AUDIT_ENTRIES: CurrencyAuditEntry[] = [
  {
    id: 'aud-001',
    organizationId: ORG_ID,
    entityType: 'EXCHANGE_RATE',
    entityId: 'er-003',
    action: 'CREATE_EXCHANGE_RATE',
    previousValue: { rate: 18.620000, status: 'CURRENT' },
    newValue: { rate: 18.754321, status: 'CURRENT' },
    performedBy: 'gerente.operaciones@4guard.mx',
    performedAt: '2026-07-27T13:45:00Z',
  },
  {
    id: 'aud-002',
    organizationId: ORG_ID,
    entityType: 'EXCHANGE_RATE',
    entityId: 'er-002',
    action: 'UPDATE',
    previousValue: { status: 'CURRENT' },
    newValue: { status: 'HISTORICAL', effectiveTo: '2026-07-26T23:59:59Z' },
    performedBy: 'gerente.operaciones@4guard.mx',
    performedAt: '2026-07-27T13:45:01Z',
  },
  {
    id: 'aud-003',
    organizationId: ORG_ID,
    entityType: 'CURRENCY',
    entityId: 'cur-003',
    action: 'CREATE',
    previousValue: null,
    newValue: { isoCode: 'EUR', name: 'Euro', rate: 20.850000 },
    performedBy: 'admin@4guard.mx',
    performedAt: '2024-03-10T10:30:00Z',
  },
  {
    id: 'aud-004',
    organizationId: ORG_ID,
    entityType: 'EXCHANGE_RATE',
    entityId: 'er-005',
    action: 'CREATE_EXCHANGE_RATE',
    previousValue: { rate: 20.850000, status: 'CURRENT' },
    newValue: { rate: 21.394500, status: 'CURRENT' },
    performedBy: 'gerente.operaciones@4guard.mx',
    performedAt: '2026-06-28T14:00:00Z',
  },
  {
    id: 'aud-005',
    organizationId: ORG_ID,
    entityType: 'CURRENCY',
    entityId: 'cur-001',
    action: 'CREATE',
    previousValue: null,
    newValue: { isoCode: 'MXN', name: 'Peso mexicano', isBaseCurrency: true },
    performedBy: 'admin@4guard.mx',
    performedAt: '2024-01-15T08:00:00Z',
  },
];
