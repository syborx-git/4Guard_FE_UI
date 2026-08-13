/**
 * @file users-catalog.models.ts
 * @description Modelos e interfaces para el Catálogo de Usuarios en 4GUARD WMS.
 */

export interface CatalogUser {
  id: string;
  username: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  fullName: string;
  role: string;
  roleLabel: string;
  status: 'ACTIVO' | 'INACTIVO';
  lastAccess: string;
  createdAt: string;
  avatarUrl?: string;
  auditLogs: UserAuditLogItem[];
}

export interface UserAuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  details: string;
}

export interface CreateUserDto {
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  username: string;
  role: string;
  password?: string;
}

export interface UserRoleOption {
  code: string;
  label: string;
  description: string;
}

export const USER_ROLES: UserRoleOption[] = [
  { code: 'ROLE_ADMIN', label: 'Administrador del Sistema', description: 'Acceso total a la consola de administración' },
  { code: 'OPERATIONS_MANAGER', label: 'Gerente de Operaciones', description: 'Gestión operativa global de almacenes' },
  { code: 'WAREHOUSE_SUPERVISOR', label: 'Supervisor de Almacén', description: 'Supervisión de turnos y movimientos' },
  { code: 'QUALITY_INSPECTOR', label: 'Inspector de Calidad', description: 'Auditoría y liberaciones de producto' },
  { code: 'FORKLIFT_DRIVER', label: 'Montacarguista / Operador', description: 'Operación en andén y traspasos' },
];
