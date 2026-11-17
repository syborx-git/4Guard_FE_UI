/**
 * @file role.enum.ts
 * @description Definición canónica de roles del sistema RBAC de 4GUARD WMS
 * homologada con el Organigrama Oficial de Operaciones (Nestlé/4GUARD):
 * - DG: Director General (ADMIN / CEO)
 * - GO: Gerente de Operaciones (OPERATIONS_MANAGER)
 * - CO: Coordinador de Operaciones (OPERATIONS_COORDINATOR)
 * - SO: Supervisor de Operaciones (OPERATIONS_SUPERVISOR)
 * - MC: Mesa de Control (CONTROL_DESK)
 * - LT: Líder de Turno (SHIFT_LEADER)
 * - M:  Montacarguista (WAREHOUSE_OPERATOR)
 * - Roles Transversales:
 *   - Calidad: Inspector Titular (QM_INSPECTOR) y Ayudante de Calidad (QUALITY_ASSISTANT)
 *   - Seguridad: Guardia Titular (SECURITY_GUARD) y Ayudante de Seguridad (SECURITY_ASSISTANT)
 */

export enum UserRole {
  /** DG: Director General / Administrador General del sistema: acceso total */
  ADMIN = 'ROLE_ADMIN',

  /** GO: Gerente de Operaciones: gestión estratégica y operativa (con módulo admin) */
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

  /** AY-QM: Ayudante de Calidad: captura de evidencias fotográficas, temperatura y checklist preliminar */
  QUALITY_ASSISTANT = 'ROLE_QUALITY_ASSISTANT',

  /** SEC: Guardia de Seguridad / Vigilancia: acceso a Caseta de Vigilancia y formato F01 */
  SECURITY_GUARD = 'ROLE_SECURITY_GUARD',

  /** AY-SEC: Ayudante de Seguridad: apoyo en carril exterior, lectura de QR de chofer y toma de placas */
  SECURITY_ASSISTANT = 'ROLE_SECURITY_ASSISTANT',
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
  [UserRole.QUALITY_ASSISTANT]:      'Ayudante de Calidad',
  [UserRole.SECURITY_GUARD]:         'Guardia de Seguridad (Caseta)',
  [UserRole.SECURITY_ASSISTANT]:     'Ayudante de Seguridad',
};

/**
 * Permisos agrupados por módulo funcional.
 * Cada entrada define qué roles oficiales tienen acceso a ese módulo.
 */
export const MODULE_PERMISSIONS: Record<string, UserRole[]> = {
  'admin':                [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER],
  'dashboard':            [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER],
  'security':             [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_SUPERVISOR, UserRole.SECURITY_GUARD, UserRole.SECURITY_ASSISTANT],
  'warehouse-movements':  [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'receiving':            [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'quality':              [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.QM_INSPECTOR, UserRole.QUALITY_ASSISTANT], // Acceso total para Dirección y Gerencia de Operaciones
  'performance':          [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR],
  'catalogs':             [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER],
  'layout':               [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.CONTROL_DESK],
  'inventory-query':      [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER],
  'inventory':            [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER],
  'putaway':              [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'picking':              [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'shipping':             [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.OPERATIONS_SUPERVISOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR],
  'counting':             [UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.OPERATIONS_COORDINATOR, UserRole.CONTROL_DESK, UserRole.SHIFT_LEADER, UserRole.WAREHOUSE_OPERATOR, UserRole.QM_INSPECTOR],
};

/**
 * Verifica si un rol tiene acceso a un módulo específico.
 */
export function hasModuleAccess(role: UserRole, module: string): boolean {
  const allowed = MODULE_PERMISSIONS[module] ?? [];
  return allowed.includes(role);
}
