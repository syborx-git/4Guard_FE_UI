/**
 * @file role-permission.model.ts
 * @description Interfaces y tipos para el módulo de Roles y Matriz de Permisos (RBAC) — 4GUARD WMS.
 */

export interface Permission {
  id: string;
  name: string;        // ej. "INVENTORY_READ", "USERS_CREATE"
  description: string;
  createdAt?: string;
  moduleGroup?: string; // Grupo de módulo derivado para la UI (ej. "Inventario")
}

export interface Role {
  id: string;
  name: string;        // ej. "OPERATIONS_MANAGER"
  level: number;       // Nivel jerárquico (1=máximo, 7=mínimo)
  isSystem: boolean;   // true si es un rol de sistema protegido
  permissions: Permission[];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateRoleRequest {
  name: string;
  level: number;
  permissionIds?: string[];
}

export interface UpdateRoleRequest {
  id: string;
  name: string;
  level: number;
  permissionIds?: string[];
}

// ─── Auditoría BE ─────────────────────────────────────────────────────────────

export interface AuditDetail {
  fieldName: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

export interface RoleAuditLog {
  logId?: string;
  id: string;
  action: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_PERMISSIONS_ASSIGNED' | 'ROLE_DELETED' | string;
  username?: string;
  performedBy: string;
  createdAt?: string;
  performedAt: string;
  summary?: string;
  timelineIcon?: string;
  timelineColor?: 'create' | 'update' | 'delete' | 'status';
  details?: AuditDetail[];
}

export interface PermissionAuditLog {
  logId?: string;
  id: string;
  action: 'PERMISSION_CREATED' | 'PERMISSION_DELETED' | string;
  username?: string;
  performedBy: string;
  createdAt?: string;
  performedAt: string;
  details?: AuditDetail[];
}

export interface ApiResponse<T> {
  status?: number;
  message?: string;
  data: T;
  timestamp?: string;
  success?: boolean;
}

/**
 * Agrupa los permisos por módulo WMS según el prefijo del código.
 */
export function getPermissionModuleGroup(permName: string): string {
  const upper = permName.toUpperCase();
  if (upper.startsWith('INVENTORY_')) return 'Inventario y Almacén';
  if (upper.startsWith('USERS_'))     return 'Control de Usuarios';
  if (upper.startsWith('ROLES_') || upper.startsWith('PERMISSIONS_')) return 'Seguridad y Matriz RBAC';
  if (upper.startsWith('QUALITY_'))   return 'Control de Calidad';
  if (upper.startsWith('SHIPPING_'))  return 'Embarques y Expedición';
  if (upper.startsWith('RECEIVING_')) return 'Recibo y Mercancías';
  if (upper.startsWith('CLIENTS_'))   return 'Clientes Depositantes';
  if (upper.startsWith('RAMPS_'))     return 'Andenes y Rampas';
  if (upper.startsWith('PACKING_'))   return 'Empaque y Embalaje';
  if (upper.startsWith('PICKING_'))   return 'Picking y Surtido';
  if (upper.startsWith('AUDIT_'))     return 'Consola de Auditoría';
  if (upper.startsWith('REPORTS_'))   return 'Reportes y Analítica';
  return 'Operaciones Generales';
}

/** Icono según la acción de auditoría de roles */
export function getRoleAuditIcon(action: string): string {
  switch (action) {
    case 'ROLE_CREATED':
      return 'shield';
    case 'ROLE_UPDATED':
      return 'edit_note';
    case 'ROLE_PERMISSIONS_ASSIGNED':
      return 'vpn_key';
    case 'ROLE_DELETED':
      return 'delete_forever';
    default:
      return 'history';
  }
}

/** Color según la acción de auditoría */
export function getRoleAuditColor(action: string): 'create' | 'update' | 'delete' | 'status' {
  switch (action) {
    case 'ROLE_CREATED':
      return 'create';
    case 'ROLE_UPDATED':
      return 'update';
    case 'ROLE_PERMISSIONS_ASSIGNED':
      return 'status';
    case 'ROLE_DELETED':
      return 'delete';
    default:
      return 'update';
  }
}

/** Resumen según la acción de auditoría */
export function getRoleAuditSummary(action: string): string {
  switch (action) {
    case 'ROLE_CREATED':
      return 'Nuevo rol registrado en la matriz RBAC';
    case 'ROLE_UPDATED':
      return 'Modificación de atributos de rol (Nombre/Nivel)';
    case 'ROLE_PERMISSIONS_ASSIGNED':
      return 'Reasignación de permisos en la matriz RBAC';
    case 'ROLE_DELETED':
      return 'Rol eliminado de la matriz de permisos';
    default:
      return 'Evento de auditoría de rol';
  }
}
