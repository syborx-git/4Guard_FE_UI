/**
 * @file remission-history.model.ts
 * @description Contratos del historial multi-entidad de remisiones (ADR-022).
 */

export type RemissionEntityType = 'RECEPTION' | 'OUTBOUND' | 'TRANSFER';

export interface RemissionHistoryItem {
  id: string;
  entityType: RemissionEntityType;
  folio: string;
  remisionNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  branchId: string | null;
  branchName: string | null;
  status: string;
  shiftSessionId: string | null;
  shiftName: string | null;
  operator: string | null;
  pallets: number | null;
  pieces: number | null;
  createdAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}

export interface RemissionHistoryClientCount {
  clientId: string;
  clientName: string | null;
  count: number;
}

export interface RemissionHistoryShiftCount {
  shiftSessionId: string;
  shiftName: string | null;
  count: number;
}

export interface RemissionHistorySummary {
  total: number;
  completed: number;
  cancelled: number;
  pending: number;
  byClient: RemissionHistoryClientCount[];
  byShift: RemissionHistoryShiftCount[];
}

export interface RemissionHistoryPage {
  items: RemissionHistoryItem[];
  summary: RemissionHistorySummary;
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
}

export type RemissionDatePreset = 'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM';

export interface RemissionHistoryFilters {
  from: string | null;
  to: string | null;
  clientId: string | null;
  status: string | null;
  entityType: RemissionEntityType | null;
  shiftSessionId: string | null;
  search: string | null;
  page: number;
  size: number;
}
