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
  { code: 'ROLE_ADMIN', label: 'Director General (Admin)', description: 'Acceso total y configuración global' },
  { code: 'OPERATIONS_MANAGER', label: 'Gerente de Operaciones', description: 'Dirección operativa global de la planta y almacenes' },
  { code: 'OPERATIONS_COORDINATOR', label: 'Coordinador de Operaciones', description: 'Coordinación de logística, capacidad y tráfico' },
  { code: 'OPERATIONS_SUPERVISOR', label: 'Supervisor de Operaciones', description: 'Supervisión en piso de movimientos y andenes' },
  { code: 'CONTROL_DESK', label: 'Mesa de Control', description: 'Validación documental, entradas y salidas' },
  { code: 'SHIFT_LEADER', label: 'Líder de Turno', description: 'Liderazgo operativo de cuadrilla por turno' },
  { code: 'QM_INSPECTOR', label: 'Inspector de Calidad', description: 'Auditoría de calidad, bloqueos PNC y muestreo' },
  { code: 'QUALITY_ASSISTANT', label: 'Ayudante de Calidad', description: 'Evidencias fotográficas, temperatura y checklist preliminar' },
  { code: 'SECURITY_GUARD', label: 'Guardia de Seguridad (Caseta)', description: 'Control de acceso, pases QR y formato F01' },
  { code: 'SECURITY_ASSISTANT', label: 'Ayudante de Seguridad', description: 'Apoyo en carril exterior, placas y checklist' },
  { code: 'FORKLIFT_OPERATOR', label: 'Almacenista Montacargista', description: 'Operación de montacargas, carga, descarga y reubicaciones' },
];
