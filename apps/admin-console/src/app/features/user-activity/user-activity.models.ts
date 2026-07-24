/**
 * @file user-activity.models.ts
 * @description Modelos de dominio para HU-146 — Reporte de Actividad por Usuario.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 * Los eventos UserActivityEvent son inmutables desde el frontend.
 * El CRUD corresponde únicamente a ActivityReportProfile (perfiles guardados).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE SEGURIDAD — RLS
 * ═══════════════════════════════════════════════════════════════════════════
 * La validación definitiva de RLS, permisos y alcance de datos DEBE ejecutarse
 * en backend y base de datos. El frontend solo simula el filtrado por organización
 * y almacén para propósitos de evaluación de UX.
 */

// ─── Tipos de resultado de una operación ─────────────────────────────────────

export type ActivityResult = 'SUCCESS' | 'WARNING' | 'REJECTED' | 'ERROR';

// ─── Nivel de criticidad de una operación ────────────────────────────────────

export type ActivitySeverity = 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Visibilidad de un perfil de reporte ─────────────────────────────────────

export type ProfileVisibility = 'PRIVATE' | 'SHARED';

// ─── Estado de un perfil de reporte ──────────────────────────────────────────

export type ProfileStatus = 'ACTIVE' | 'INACTIVE';

// ─── Rango de fecha predeterminado ───────────────────────────────────────────

export type DefaultDateRange = 'TODAY' | 'CURRENT_SHIFT' | 'LAST_7_DAYS' | 'CUSTOM';

// ─── Vista predeterminada ─────────────────────────────────────────────────────

export type DefaultView = 'TABLE' | 'TIMELINE';

// ─── Formato de exportación ───────────────────────────────────────────────────

export type ExportFormat = 'XLSX' | 'CSV' | 'PDF';

// ─── Vista activa en la pantalla ─────────────────────────────────────────────

export type ActiveView = 'TABLE' | 'TIMELINE';

// ─── Módulos del WMS reconocidos ─────────────────────────────────────────────

export const WMS_MODULES = [
  'Autenticación',
  'Recepción',
  'Calidad',
  'Inventario',
  'Picking',
  'Embarques',
  'Proveedores',
  'Usuarios',
  'Layout',
  'Reportes',
] as const;

export type WmsModule = (typeof WMS_MODULES)[number];

// ─── Acciones disponibles ─────────────────────────────────────────────────────

export const WMS_ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'CREATE_RECEIPT',
  'MOVE_STOCK',
  'ADJUST_INVENTORY',
  'BLOCK_LOT',
  'UPDATE_SUPPLIER',
  'CONFIRM_PICKING',
  'CANCEL_SHIPMENT',
  'EXPORT_REPORT',
  'AUTHORIZATION_ERROR',
  'CHANGE_LOCATION',
  'CHANGE_ROLE',
  'CRITICAL_ACTION',
] as const;

export type WmsAction = (typeof WMS_ACTIONS)[number];

// ─── Evento de Actividad de Usuario ──────────────────────────────────────────

/**
 * Representa un evento de auditoría generado por una acción de usuario en el WMS.
 * Los eventos son INMUTABLES — solo lectura desde el frontend.
 * La validación definitiva de RLS y permisos se ejecuta en el backend.
 */
export interface UserActivityEvent {
  /** ID único del evento */
  id: string;

  /** Timestamp ISO 8601 del momento en que ocurrió el evento */
  occurredAt: string;

  /** ID del usuario que ejecutó la acción */
  userId: string;

  /** Nombre completo del usuario */
  userName: string;

  /** Correo electrónico del usuario */
  userEmail: string;

  /** Rol del usuario en el sistema */
  userRole: string;

  /** ID de la organización */
  organizationId: string;

  /** ID del almacén */
  warehouseId: string;

  /** Nombre del almacén */
  warehouseName: string;

  /** ID del cliente (si aplica) */
  clientId?: string;

  /** Nombre del cliente (si aplica) */
  clientName?: string;

  /** ID del turno */
  shiftId?: string;

  /** Nombre del turno */
  shiftName?: string;

  /** Módulo del WMS donde ocurrió la acción */
  module: string;

  /** Código de la acción ejecutada */
  action: string;

  /** Tipo de entidad afectada (SKU, Lote, Orden, etc.) */
  entityType: string;

  /** ID de la entidad afectada */
  entityId?: string;

  /** Descripción legible de la acción */
  description: string;

  /** Resultado de la operación */
  result: ActivityResult;

  /** Nivel de criticidad */
  severity: ActivitySeverity;

  /** Valores anteriores al cambio (para auditoría de cambios) */
  previousValues?: Record<string, unknown>;

  /** Valores nuevos tras el cambio */
  newValues?: Record<string, unknown>;

  /** Motivo de la acción (cuando aplica) */
  reason?: string;

  /** Dirección IP desde donde se ejecutó la acción */
  ipAddress?: string;

  /** Tipo de dispositivo */
  device?: string;

  /** Navegador del usuario */
  browser?: string;

  /** ID de sesión */
  sessionId?: string;

  /** ID de correlación para trazabilidad distribuida */
  correlationId?: string;

  /** Duración de la operación en milisegundos */
  durationMs?: number;

  /**
   * Indica si la acción ocurrió fuera del horario de turno.
   * Criterio: antes de las 06:00 o después de las 22:00.
   */
  outsideShift?: boolean;
}

// ─── Perfil de Reporte Guardado ───────────────────────────────────────────────

/**
 * Configuración guardada de un reporte de actividad.
 *
 * NOTA: En esta primera implementación el CRUD de perfiles es EN MEMORIA.
 * Los cambios NO persisten al refrescar la página ya que no existe endpoint
 * de backend para este recurso en esta etapa. Al conectar el backend, se deberá
 * implementar el servicio HTTP correspondiente.
 *
 * NOTA DE AUDITORÍA: El frontend NO escribe directamente en audit_logs.
 * Las acciones de crear/editar/eliminar perfiles deben ser registradas por el
 * backend dentro de la misma transacción.
 */
export interface ActivityReportProfile {
  /** ID único del perfil */
  id: string;

  /** Código único legible del perfil (ej: RPT-USR-001) */
  code: string;

  /** Nombre del perfil */
  name: string;

  /** Descripción opcional */
  description?: string;

  /** ID del propietario del perfil */
  ownerId: string;

  /** Visibilidad: solo para mí o compartido */
  visibility: ProfileVisibility;

  /** Estado: activo o inactivo */
  status: ProfileStatus;

  /** IDs de almacenes incluidos en el filtro */
  warehouseIds: string[];

  /** Módulos incluidos en el filtro */
  modules: string[];

  /** Acciones incluidas en el filtro */
  actions: string[];

  /** Resultados incluidos en el filtro */
  results: string[];

  /** Niveles de criticidad incluidos en el filtro */
  severities: string[];

  /** Columnas visibles en la tabla */
  visibleColumns: string[];

  /** Rango de fecha predeterminado */
  defaultDateRange: DefaultDateRange;

  /** Vista predeterminada */
  defaultView: DefaultView;

  /** Formato de exportación preferido */
  exportFormat: ExportFormat;

  /** Timestamp de creación */
  createdAt: string;

  /** Timestamp de última actualización */
  updatedAt: string;
}

// ─── Filtros de la pantalla ───────────────────────────────────────────────────

/**
 * Modelo de los filtros aplicables a la tabla de actividad.
 * Corresponde al FormGroup reactivo de la pantalla.
 */
export interface ActivityFilters {
  dateFrom: string | null;
  dateTo: string | null;
  userName: string | null;
  userRole: string | null;
  warehouse: string | null;
  client: string | null;
  module: string | null;
  action: string | null;
  result: ActivityResult | null;
  severity: ActivitySeverity | null;
  searchText: string | null;
  outsideShiftOnly: boolean;
  // Filtros avanzados
  sku?: string | null;
  lot?: string | null;
  location?: string | null;
  order?: string | null;
  shipment?: string | null;
  ipAddress?: string | null;
  deviceType?: string | null;
  sessionId?: string | null;
}

// ─── KPIs calculados ─────────────────────────────────────────────────────────

export interface ActivityKpis {
  /** Número de usuarios únicos con al menos un evento en el rango filtrado */
  activeUsers: number;

  /** Total de eventos en el rango filtrado */
  totalEvents: number;

  /**
   * Operaciones críticas: eventos con severity HIGH o CRITICAL.
   */
  criticalOperations: number;

  /**
   * Errores o rechazos: eventos con result ERROR o REJECTED.
   */
  errorsOrRejections: number;

  /**
   * Actividad fuera de horario: eventos con outsideShift === true.
   */
  outsideShiftCount: number;
}

// ─── Estado de paginación ─────────────────────────────────────────────────────

export interface PaginationState {
  pageIndex: number;  // 0-indexed
  pageSize: number;
  totalItems: number;
}
