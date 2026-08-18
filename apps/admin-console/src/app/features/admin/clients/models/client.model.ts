/**
 * @file client.model.ts
 * @description Interfaces y tipos para la Gestión de Clientes (Depositantes / Owners 3PL) — 4GUARD WMS.
 * Soporta Matriz de Contactos Corporativos y Múltiples Direcciones de Destino Físico (Multi-Bodega / Plantas).
 */

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'ACTIVA',
  INACTIVE: 'INACTIVA',
};

export interface ClientContact {
  id?: string;
  clientId?: string;
  name: string;             // Nombre del contacto (ej. "Ing. Carlos Fuentes")
  department: string;       // Departamento / Área (ej. "Logística y Abasto")
  phone: string;            // Teléfono directo / móvil
  email: string;            // Correo electrónico corporativo
  isPrimary?: boolean;      // Indica si es el contacto principal
}

export interface PhysicalDestination {
  id?: string;
  clientId?: string;
  destinationCode: string;  // Código de destino (ej. "DEST-TOL-01")
  plantName: string;        // Nombre de la planta o bodega (ej. "Planta Toluca (Café y Cacao)")
  fullAddress: string;      // Dirección completa de entrega
  contactPerson: string;    // Responsable o contacto en sitio (ej. "Ing. Fernando Ruiz")
  phone: string;            // Teléfono directo de la planta (ej. "722 279 1000")
  status: 'ACTIVO' | 'INACTIVO';
  notes?: string;           // Indicaciones especiales de acceso o descarga
}

export interface Client {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  externalId: string;       // Código ERP/SAP/RFC (max 50 chars)
  address: string;          // Dirección Fiscal / Corporativa principal
  phone: string;            // Teléfono corporativo principal
  email?: string;           // Correo general
  webPortalPassword?: string; // Contraseña Portal Autoservicio
  status: ClientStatus;
  contacts: ClientContact[];
  destinations: PhysicalDestination[];
  version: number;
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}

export interface ClientResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  externalId: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  webPortalPassword?: string | null;
  status: string;
  contacts?: ClientContact[];
  destinations?: PhysicalDestination[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  address?: string;
  phone?: string;
  email?: string;
  webPortalPassword?: string;
  status?: string;
  contacts?: ClientContact[];
  destinations?: PhysicalDestination[];
  version?: number;
}

export interface UpdateClientRequest {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  address?: string;
  phone?: string;
  email?: string;
  webPortalPassword?: string;
  status?: string;
  contacts?: ClientContact[];
  destinations?: PhysicalDestination[];
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
