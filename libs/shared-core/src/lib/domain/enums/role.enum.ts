/**
 * @file role.enum.ts
 * @description Definición canónica de roles del sistema RBAC de 4GUARD WMS
 * homologada con el Organigrama Oficial:
 * - DG: Director General (ADMIN / CEO)
 * - GO: Gerente de Operaciones (OPERATIONS_MANAGER)
 * - CO: Coordinador de Operaciones (OPERATIONS_COORDINATOR)
 * - SO: Supervisor de Operaciones (OPERATIONS_SUPERVISOR)
 * - MC: Mesa de Control (CONTROL_DESK)
 * - LT: Líder de Turno (SHIFT_LEADER)
 * - M:  Montacarguista (WAREHOUSE_OPERATOR)
 * - Roles Transversales: Inspector de Calidad (QM_INSPECTOR) y Guardia de Seguridad (SECURITY_GUARD)
 */

export enum UserRole {
  /** DG: Director General / Administrador General del sistema: acceso total */
  ADMIN = 'ROLE_ADMIN',

  /** GO: Gerente de Operaciones: gestión estratégica y operativa */
  OPERATIONS_MANAGER = 'ROLE_OPERATIONS_MANAGER',

  /** CO: Coordinador de Operaciones: enlace táctico entre gerencia y supervisión */
  OPERATIONS_COORDINATOR = 'ROLE_OPERATIONS_COORDINATOR',

  /** SO: Supervisor de Operaciones: supervisión en piso, andenes y patio */
  OPERATIONS_SUPERVISOR = 'ROLE_OPERATIONS_SUPERVISOR',

  /** MC: Mesa de Control: planeación y autorización de recepciones/despachos/lotes */
  CONTROL_DESK = 'ROLE_CONTROL_DESK',

  /** LT: Líder de Turno: supervisión táctica de cuadrillas de montacargas */
  SHIFT_LEADER = 'ROLE_SHIFT_LEADER',

  /** M: Montacarguista: ejecución física en rf-terminal (cockpit, putaway, picking) */
  WAREHOUSE_OPERATOR = 'ROLE_WAREHOUSE_OPERATOR',

  /** QM: Inspector de Calidad: acceso a módulo QM, dictámenes y cuarentenas */
  QM_INSPECTOR = 'ROLE_QM_INSPECTOR',

  /** SEC: Guardia de Seguridad / Vigilancia: acceso a Caseta de Vigilancia y checklist F01 */
  SECURITY_GUARD = 'ROLE_SECURITY_GUARD',
}

/**
 * Etiquetas legibles para cada rol oficial del sistema.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]:                  'Director General (Admin)',
  [UserRole.OPERATIONS_MANAGER]:     'Gerente de Operaciones',
  [UserRole.OPERATIONS_COORDINATOR]: 'Coordinador de Operaciones',
  [UserRole.OPERATIONS_SUPERVISOR]:  'Supervisor de Operaciones',
  [UserRole.CONTROL_DESK]:           'Mesa de Control',
  [UserRole.SHIFT_LEADER]:           'Líder de Turno',
  [UserRole.WAREHOUSE_OPERATOR]:     'Montacarguista',
  [UserRole.QM_INSPECTOR]:           'Inspector de Calidad',
  [UserRole.SECURITY_GUARD]:         'Guardia de Seguridad (Caseta)',
};

/**
 * Permisos agrupados por módulo funcional.
 * Cada entrada define qué roles oficiales tienen acceso a ese módulo.
 */
export const MODULE_PERMISSIONS: Record<string, UserRole[]> = {
  'admin':      [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER],
  'layout':     [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.CONTROL_DESK],
  'dashboard':  [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK],
  'inventory':  [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER],
  'receiving':  [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'putaway':    [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'picking':    [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'quality':    [UserRole.ADMIN, UserRole.OPERATIONS_COORDINATOR, UserRole.QM_INSPECTOR],
  'shipping':   [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'counting':   [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR, UserRole.QM_INSPECTOR],
  'security':   [UserRole.ADMIN, UserRole.OPERATIONS_SUPERVISOR, UserRole.SECURITY_GUARD],
};

/**
 * Verifica si un rol tiene acceso a un módulo específico.
 */
export function hasModuleAccess(role: UserRole, module: string): boolean {
  const allowed = MODULE_PERMISSIONS[module] ?? [];
  return allowed.includes(role);
}
