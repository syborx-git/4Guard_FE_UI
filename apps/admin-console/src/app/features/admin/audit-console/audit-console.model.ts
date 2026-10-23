/**
 * @file audit-console.model.ts
 * @description Contratos de la Consola de Auditoría (bitácora real /audit/user-activity).
 */

export interface AuditLogDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AuditLogItem {
  logId: string;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: AuditLogDetail[];
}

export interface AuditConsoleFilters {
  action: string | null;
  entityType: string | null;
  fromDate: string | null;
  toDate: string | null;
  search: string | null;
}

export interface AuditConsoleSummary {
  total: number;
  uniqueUsers: number;
  creates: number;
  updates: number;
  deletes: number;
  errors: number;
}
