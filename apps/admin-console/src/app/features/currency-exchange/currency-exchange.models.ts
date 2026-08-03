/**
 * @file currency-exchange.models.ts
 * @description Modelos y tipos homologados con la API REST Backend de Spring Boot para HU-148 — Módulo Currency Exchange.
 * 4GUARD WMS Enterprise — Módulo Financiero
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS Y ENUMS BACKEND
// ═══════════════════════════════════════════════════════════════════

export type CurrencyStatus = 'ACTIVE' | 'INACTIVE';

export type RateSourceType = 'MANUAL' | 'CENTRAL_BANK' | 'API_AUTO' | 'CUSTOM';

export type ExchangeRateStatus = 'ACTIVE' | 'HISTORICAL' | 'SUPERSEDED';

export type CurrencyAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'SET_BASE'
  | 'RATE_CHANGED'
  | 'STATUS_CHANGED';

// ═══════════════════════════════════════════════════════════════════
// ENTIDADES Y RESPUESTAS BACKEND
// ═══════════════════════════════════════════════════════════════════

export interface Currency {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  status: CurrencyStatus;
  decimalPlaces: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ExchangeRate {
  id: string;
  organizationId: string;
  fromCurrencyId?: string;
  fromCurrencyCode: string;
  toCurrencyId?: string;
  toCurrencyCode: string;
  rate: number;
  inverseRate: number;
  effectiveDate: string; // YYYY-MM-DD
  sourceType: RateSourceType;
  status: ExchangeRateStatus;
  notes?: string | null;
  createdAt?: string;
  createdBy?: string;
}

export interface LatestParityItem {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  inverseRate: number;
  effectiveDate: string;
}

export interface LatestParitiesMatrix {
  organizationId: string;
  baseCurrency: Currency;
  activeRates: LatestParityItem[];
}

export interface ConvertCurrencyRequest {
  organizationId: string;
  fromCode: string;
  toCode: string;
  amount: number;
  date?: string;
}

export interface ConvertCurrencyResult {
  fromCurrencyId?: string;
  fromCode: string;
  toCurrencyId?: string;
  toCode: string;
  originalAmount: number;
  convertedAmount: number;
  rateUsed: number;
  effectiveDate: string;
  conversionPath: string;
}

export interface BanxicoLiveRateData {
  seriesId: string;
  currencyCode: string;
  seriesTitle: string;
  rate: number;
  publicationDate: string;
  sourceType: string;
}

export interface CurrencyAuditEntry {
  id: string;
  organizationId: string;
  entityType: 'CURRENCY' | 'EXCHANGE_RATE';
  entityId: string;
  action: string;
  description: string;
  previousValue: string | null;
  newValue: string | null;
  performedBy: string;
  performedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// REQUEST PAYLOADS (SOLICITUDES A BACKEND)
// ═══════════════════════════════════════════════════════════════════

export interface CreateCurrencyRequest {
  organizationId: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  decimalPlaces: number;
}

export interface UpdateCurrencyRequest {
  name: string;
  symbol: string;
  decimalPlaces: number;
}

export interface UpdateCurrencyStatusRequest {
  status: CurrencyStatus;
}

export interface CreateExchangeRateRequest {
  organizationId: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
  effectiveDate: string;
  sourceType: RateSourceType;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CATÁLOGOS DE ETIQUETAS
// ═══════════════════════════════════════════════════════════════════

export const RATE_SOURCE_LABELS: Record<RateSourceType, string> = {
  MANUAL: 'Captura Manual',
  CENTRAL_BANK: 'Banco Central (DOF/Banxico)',
  API_AUTO: 'Integración API',
  CUSTOM: 'Acuerdo Personalizado',
};

export const EXCHANGE_RATE_STATUS_LABELS: Record<ExchangeRateStatus, string> = {
  ACTIVE: 'Vigente',
  HISTORICAL: 'Histórico',
  SUPERSEDED: 'Reemplazado',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: 'Creación',
  UPDATED: 'Modificación',
  SET_BASE: 'Divisa Base Asignada',
  RATE_CHANGED: 'Tipo de Cambio Actualizado',
  STATUS_CHANGED: 'Estatus Modificado',
};
