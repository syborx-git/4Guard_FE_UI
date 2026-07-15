/**
 * @file role.enum.ts
 * @description Definición de los 7 roles del sistema RBAC de 4GUARD WMS.
 * Estos roles controlan el acceso a funcionalidades en ambas aplicaciones.
 */

/**
 * Roles del sistema 4GUARD WMS.
 * Mapeados exactamente a los valores del Backend (Spring Security).
 */
export enum UserRole {
  /** Administrador del sistema: acceso total a admin-console */
  ADMIN = 'ROLE_ADMIN',

  /** Gerente de almacén: gestión operacional completa */
  WAREHOUSE_MANAGER = 'ROLE_WAREHOUSE_MANAGER',

  /** Supervisor de andén: supervisión de recepciones y despachos */
  DOCK_SUPERVISOR = 'ROLE_DOCK_SUPERVISOR',

  /** Operario de almacén: operaciones en rf-terminal (picking, putaway) */
  WAREHOUSE_OPERATOR = 'ROLE_WAREHOUSE_OPERATOR',

  /** Inspector de calidad: acceso a módulo QM y gestión de cuarentenas */
  QM_INSPECTOR = 'ROLE_QM_INSPECTOR',

  /** Auditor: acceso de solo lectura para auditoría e informes */
  AUDITOR = 'ROLE_AUDITOR',

  /** Cliente 3PL: portal de consulta del estado de su inventario */
  CLIENT = 'ROLE_CLIENT',
}

/**
 * Etiquetas legibles para cada rol.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]:               'Administrador',
  [UserRole.WAREHOUSE_MANAGER]:   'Gerente de Almacén',
  [UserRole.DOCK_SUPERVISOR]:     'Supervisor de Andén',
  [UserRole.WAREHOUSE_OPERATOR]:  'Operario de Almacén',
  [UserRole.QM_INSPECTOR]:        'Inspector de Calidad',
  [UserRole.AUDITOR]:             'Auditor',
  [UserRole.CLIENT]:              'Cliente 3PL',
};

/**
 * Permisos agrupados por módulo funcional.
 * Cada entrada define qué roles tienen acceso a ese módulo.
 */
export const MODULE_PERMISSIONS: Record<string, UserRole[]> = {
  'admin':      [UserRole.ADMIN],
  'layout':     [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER],
  'dashboard':  [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.AUDITOR, UserRole.CLIENT],
  'inventory':  [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.DOCK_SUPERVISOR, UserRole.AUDITOR, UserRole.CLIENT],
  'receiving':  [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.DOCK_SUPERVISOR, UserRole.WAREHOUSE_OPERATOR],
  'putaway':    [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_OPERATOR],
  'picking':    [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.DOCK_SUPERVISOR, UserRole.WAREHOUSE_OPERATOR],
  'quality':    [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.QM_INSPECTOR],
  'shipping':   [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.DOCK_SUPERVISOR, UserRole.WAREHOUSE_OPERATOR],
  'counting':   [UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER, UserRole.WAREHOUSE_OPERATOR, UserRole.AUDITOR],
};

/**
 * Verifica si un rol tiene acceso a un módulo específico.
 */
export function hasModuleAccess(role: UserRole, module: string): boolean {
  const allowed = MODULE_PERMISSIONS[module] ?? [];
  return allowed.includes(role);
}
