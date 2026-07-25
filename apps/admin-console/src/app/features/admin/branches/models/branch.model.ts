/**
 * @file branch.model.ts
 * @description Modelo de dominio, interfaces y tipos para la Gestión de Sucursales (Branches) — 4GUARD WMS.
 */

export type BranchStatus = 'ACTIVE' | 'INACTIVE';

export interface Branch {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: BranchStatus;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface BranchResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  organizationId: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
}

export interface UpdateBranchRequest {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  timezone: string;
  addressLine1: string;
  status: string;
}

export interface BranchStatusChangeRequest {
  status: BranchStatus;
  reason?: string;
  notes?: string;
}

// ─── Auditoría ────────────────────────────────────────────────────────────────

export interface BranchAuditDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface BranchAuditEntry {
  id: string;
  logId?: string;
  branchId?: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: BranchAuditDetail[];
  summary?: string;
  timelineIcon?: string;
  timelineColor?: string;
}

// ─── Diccionarios de Etiquetas y Visualización ───────────────────────────────

export const BRANCH_STATUS_LABELS: Record<BranchStatus, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
};

export const AUDIT_ACTION_ICONS: Record<string, string> = {
  BRANCH_CREATED: 'domain_add',
  BRANCH_UPDATED: 'edit_note',
  BRANCH_DELETED: 'domain_disabled',
  STATUS_CHANGE: 'published_with_changes',
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  BRANCH_CREATED: 'create',
  BRANCH_UPDATED: 'update',
  BRANCH_DELETED: 'delete',
  STATUS_CHANGE: 'status',
};
