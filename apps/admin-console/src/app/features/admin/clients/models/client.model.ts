/**
 * @file client.model.ts
 * @description Interfaces y tipos para la Gestión de Clientes (Depositantes / Owners 3PL) — 4GUARD WMS.
 */

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'ACTIVA',
  INACTIVE: 'INACTIVA',
};

export interface Client {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  externalId: string; // Código ERP/SAP/RFC (max 50 chars)
  status: ClientStatus;
  version: number;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

export interface ClientResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  externalId: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  status?: string;
  version?: number;
}

export interface UpdateClientRequest {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  status?: string;
  version?: number;
}

// ─── Auditoría BE (GET /api/v1/clients/{id}/audit) ──────────────────────────

export interface ClientAuditDetail {
  fieldName: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface ClientAuditEntry {
  logId?: string;
  id: string;
  action: 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'CLIENT_DELETED' | string;
  username?: string;
  performedBy: string;
  createdAt?: string;
  performedAt: string;
  summary?: string;
  timelineIcon?: string;
  timelineColor?: 'create' | 'update' | 'delete' | 'status';
  details?: ClientAuditDetail[];
}

export interface ApiResponse<T> {
  success?: boolean;
  status?: number;
  message?: string;
  data?: T;
  timestamp?: string;
}

/** Icono según la acción de auditoría */
export function getClientAuditIcon(action: string): string {
  switch (action) {
    case 'CLIENT_CREATED':
      return 'domain_add';
    case 'CLIENT_UPDATED':
      return 'edit_note';
    case 'CLIENT_DELETED':
      return 'delete_forever';
    default:
      return 'history';
  }
}

/** Color según la acción de auditoría */
export function getClientAuditColor(action: string): 'create' | 'update' | 'delete' | 'status' {
  switch (action) {
    case 'CLIENT_CREATED':
      return 'create';
    case 'CLIENT_UPDATED':
      return 'update';
    case 'CLIENT_DELETED':
      return 'delete';
    default:
      return 'status';
  }
}

/** Resumen según la acción de auditoría */
export function getClientAuditSummary(action: string): string {
  switch (action) {
    case 'CLIENT_CREATED':
      return 'Cliente registrado en el sistema';
    case 'CLIENT_UPDATED':
      return 'Modificación de atributos del cliente';
    case 'CLIENT_DELETED':
      return 'Cliente eliminado';
    default:
      return 'Evento de auditoría';
  }
}
