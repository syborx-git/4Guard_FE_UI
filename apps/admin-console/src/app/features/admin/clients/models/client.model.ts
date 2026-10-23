/**
 * @file client.model.ts
 * @description Interfaces y tipos para la Gestión de Clientes (Depositantes / Owners 3PL) — 4GUARD WMS.
 * Homologado con los DTOs del Backend: ClientResponse, ClientContactDto, PhysicalDestinationDto,
 * CreateClientRequest y UpdateClientRequest de 4guard_be.
 *
 * Soporta:
 * - Dirección Fiscal / Corporativa principal
 * - Matriz Dinámica de Contactos Corporativos
 * - Múltiples Direcciones Físicas de Destino (Multi-Bodega / Plantas)
 * - Control de Auditoría (GET /api/v1/clients/{id}/audit)
 */

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: 'ACTIVA',
  INACTIVE: 'INACTIVA',
};

// ── Contacto Corporativo ─────────────────────────────────────────────────────
// Homologado con ClientContactDto.java

export interface ClientContact {
  id?: string;
  name: string;             // Nombre del contacto (ej. "Ing. Carlos Fuentes")
  department: string;       // Departamento / Área (ej. "Logística y Abasto")
  phone: string;            // Teléfono directo / móvil
  email: string;            // Correo electrónico corporativo
  isPrimary?: boolean;      // Indica si es el contacto principal
  createdAt?: string;       // ISO 8601 — solo lectura en response
  updatedAt?: string;       // ISO 8601 — solo lectura en response
}

// ── Dirección Física de Destino (Bodega / Planta / Ship-to) ─────────────────
// Homologado con PhysicalDestinationDto.java

export interface PhysicalDestination {
  id?: string;
  destinationCode: string;  // Código de destino (ej. "DEST-TOL-01")
  plantName: string;        // Nombre de la planta o bodega
  fullAddress: string;      // Dirección completa de entrega
  contactPerson: string;    // Responsable en sitio
  phone: string;            // Teléfono directo de la planta
  status: 'ACTIVO' | 'INACTIVO';
  notes?: string;           // Indicaciones especiales de acceso o descarga
  version?: number;         // Control de concurrencia optimista
  createdAt?: string;       // ISO 8601 — solo lectura en response
  updatedAt?: string;       // ISO 8601 — solo lectura en response
}

// ── Entidad Principal de Cliente ─────────────────────────────────────────────
// Homologado con ClientResponse.java (BE) + estado interno del FE

export interface Client {
  id: string;               // UUID único (generado por el BE)
  orgId: string;            // UUID Organización multi-tenant → organizationId en BE
  orgName: string;          // Nombre de la organización → organizationName en BE
  name: string;             // Razón Social
  externalId: string;       // Código ERP / RFC Fiscal (max 50 chars)
  taxId?: string;           // Tax ID / RFC SAT (max 30 chars)
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
  createdBy?: string;
  updatedBy?: string;
}

// ── DTO de Respuesta del Backend ─────────────────────────────────────────────
// Mapea 1:1 con ClientResponse.java del BE

export interface ClientResponse {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  externalId: string | null;
  taxId?: string | null;
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
  createdBy?: string;
  updatedBy?: string;
}

// ── DTOs de Creación ─────────────────────────────────────────────────────────
// Mapea 1:1 con CreateClientRequest.java del BE

export interface CreateClientRequest {
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  taxId?: string;
  address: string;         // Obligatorio en BE (@NotBlank)
  phone: string;           // Obligatorio en BE (@NotBlank)
  email?: string;
  webPortalPassword?: string;
  status?: string;
  version?: number;
  contacts?: ClientContact[];
  destinations?: PhysicalDestination[];
}

// ── DTO de Actualización ─────────────────────────────────────────────────────
// Mapea 1:1 con UpdateClientRequest.java del BE

export interface UpdateClientRequest {
  id: string;
  organizationId: string;
  organizationName?: string;
  name: string;
  externalId?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  webPortalPassword?: string;
  status?: string;
  version?: number;
  contacts?: ClientContact[];
  destinations?: PhysicalDestination[];
}

// ── Auditoría BE (GET /api/v1/clients/{id}/audit) ────────────────────────────

export interface ClientAuditDetail {
  fieldName: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface ClientAuditEntry {
  logId?: string;
  id: string;
  action: 'CLIENT_CREATED' | 'CLIENT_UPDATED' | 'CLIENT_DELETED' | 'CLIENT_STATUS_CHANGED'
        | 'CLIENT_DESTINATION_ADDED' | 'CLIENT_DESTINATION_UPDATED' | 'CLIENT_DESTINATION_DELETED' | string;
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

// ── Helpers de UI para Auditoría ─────────────────────────────────────────────

/** Icono Material Symbol según la acción de auditoría */
export function getClientAuditIcon(action: string): string {
  switch (action) {
    case 'CLIENT_CREATED':              return 'domain_add';
    case 'CLIENT_UPDATED':              return 'edit_note';
    case 'CLIENT_DELETED':              return 'delete_forever';
    case 'CLIENT_STATUS_CHANGED':       return 'toggle_on';
    case 'CLIENT_DESTINATION_ADDED':    return 'add_location_alt';
    case 'CLIENT_DESTINATION_UPDATED':  return 'edit_location';
    case 'CLIENT_DESTINATION_DELETED':  return 'location_off';
    default:                            return 'history';
  }
}

/** Color de la línea de tiempo según la acción de auditoría */
export function getClientAuditColor(action: string): 'create' | 'update' | 'delete' | 'status' {
  switch (action) {
    case 'CLIENT_CREATED':
    case 'CLIENT_DESTINATION_ADDED':    return 'create';
    case 'CLIENT_DELETED':
    case 'CLIENT_DESTINATION_DELETED':  return 'delete';
    case 'CLIENT_STATUS_CHANGED':       return 'status';
    default:                            return 'update';
  }
}

/** Texto resumen según la acción de auditoría */
export function getClientAuditSummary(action: string): string {
  switch (action) {
    case 'CLIENT_CREATED':              return 'Cliente registrado en el sistema';
    case 'CLIENT_UPDATED':              return 'Modificación de atributos del cliente';
    case 'CLIENT_DELETED':              return 'Cliente eliminado del sistema';
    case 'CLIENT_STATUS_CHANGED':       return 'Cambio de estado del cliente';
    case 'CLIENT_DESTINATION_ADDED':    return 'Nuevo destino físico agregado';
    case 'CLIENT_DESTINATION_UPDATED':  return 'Destino físico actualizado';
    case 'CLIENT_DESTINATION_DELETED':  return 'Destino físico eliminado';
    default:                            return 'Evento de auditoría';
  }
}
