/**
 * @file alerts-config.models.ts
 * @description Modelos, tipos y datos dummy para HU-134 — Configuración de Alertas y Notificaciones.
 * 4GUARD WMS Enterprise · Torre de Control y Motor de Reglas
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE DOMINIO
// ═══════════════════════════════════════════════════════════════════

export type AlertCategory =
  | 'RECEIVING'
  | 'INVENTORY'
  | 'QUALITY'
  | 'PICKING'
  | 'SHIPPING'
  | 'USERS'
  | 'SYSTEM';

export type AlertEvent =
  | 'WAIT_TIME_EXCEEDED'
  | 'LOW_INVENTORY'
  | 'LOT_EXPIRATION'
  | 'ORDER_DELAYED'
  | 'INVENTORY_DISCREPANCY'
  | 'UNAUTHORIZED_ACCESS'
  | 'SYSTEM_ERROR'
  | 'PENDING_ASN'
  | 'HALTED_PICKING'
  | 'USER_LOCKED'
  | 'INTEGRATION_ERROR'
  | 'SHIPMENT_DELAYED';

export type AlertPriority = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'ACTIVE' | 'INACTIVE';

export type AlertChannel = 'SYSTEM' | 'PUSH' | 'EMAIL' | 'SMS' | 'WEBHOOK';

export type AlertRecipientRole =
  | 'OPERATOR'
  | 'SUPERVISOR'
  | 'MANAGER'
  | 'CONTROL_DESK'
  | 'CLIENT'
  | 'ADMIN';

export type AlertCondition =
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'EQUAL'
  | 'GREATER_OR_EQUAL'
  | 'LESS_OR_EQUAL'
  | 'EQUALS'
  | 'TIME_EXCEEDED';

export type AlertUnit =
  | 'MINUTES'
  | 'HOURS'
  | 'DAYS'
  | 'PERCENTAGE'
  | 'UNITS'
  | 'PIECES'
  | 'PALLETS';

export type AlertRecurrence =
  | 'NEVER'
  | 'EVERY_15_MIN'
  | 'EVERY_30_MIN'
  | 'EVERY_HOUR'
  | 'DAILY';

export type AlertEscalationTime =
  | 'NONE'
  | 'AFTER_15_MIN'
  | 'AFTER_30_MIN'
  | 'AFTER_60_MIN';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES PRINCIPALES & DTOS DEL BE
// ═══════════════════════════════════════════════════════════════════

export interface AlertConfiguration {
  id: string;
  organizationId: string;
  name: string;
  category: AlertCategory;
  event: AlertEvent | string;
  priority: AlertPriority;
  status: AlertStatus;
  channels: AlertChannel[];
  recipients: AlertRecipientRole[];
  condition: AlertCondition;
  value: number;
  unit: AlertUnit;
  recurrence: AlertRecurrence;
  escalation: AlertEscalationTime;
  messageTemplate: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateAlertConfigRequest {
  name: string;
  category: AlertCategory;
  event: AlertEvent | string;
  priority: AlertPriority;
  status: AlertStatus;
  channels: AlertChannel[];
  recipients: AlertRecipientRole[];
  condition: AlertCondition;
  value: number;
  unit: AlertUnit;
  recurrence: AlertRecurrence;
  escalation: AlertEscalationTime;
  messageTemplate: string;
  description?: string;
  updatedBy?: string;
}

export interface UpdateAlertConfigRequest {
  id?: string;
  name?: string;
  category?: AlertCategory;
  event?: AlertEvent | string;
  priority?: AlertPriority;
  status?: AlertStatus;
  channels?: AlertChannel[];
  recipients?: AlertRecipientRole[];
  condition?: AlertCondition;
  value?: number;
  unit?: AlertUnit;
  recurrence?: AlertRecurrence;
  escalation?: AlertEscalationTime;
  messageTemplate?: string;
  description?: string;
}

export interface UpdateAlertConfigStatusRequest {
  status: AlertStatus;
}

export interface AlertConfigAuditDetail {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface AlertConfigAuditResponse {
  logId: string;
  action: string;
  username: string;
  ipAddress?: string;
  createdAt: string;
  changes: AlertConfigAuditDetail[];
}

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  timestamp: string;
  user: string;
  changeSummary: string;
  previousStatus?: AlertStatus;
  newStatus?: AlertStatus;
}

export interface AlertAuditEntry {
  id: string;
  organizationId: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE' | 'DELETE';
  performedBy: string;
  performedAt: string;
  details: string;
}

export interface AlertKpis {
  activeAlerts: number;
  criticalAlerts: number;
  configuredChannels: number;
  escalationsConfigured: number;
}

export interface ToastPreviewData {
  title: string;
  categoryLabel: string;
  message: string;
  priority: AlertPriority;
  iconName: string;
  formattedTimestamp: string;
}

// ═══════════════════════════════════════════════════════════════════
// CATÁLOGOS Y LABELS TIPADOS
// ═══════════════════════════════════════════════════════════════════

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  RECEIVING: 'Recepción',
  INVENTORY: 'Inventario',
  QUALITY: 'Calidad',
  PICKING: 'Picking',
  SHIPPING: 'Despacho',
  USERS: 'Usuarios',
  SYSTEM: 'Sistema',
};

export const ALERT_EVENT_LABELS: Record<AlertEvent, string> = {
  WAIT_TIME_EXCEEDED: 'Tiempo de espera de camión excedido',
  PENDING_ASN: 'Recepción sin ASN / Documento pendiente',
  LOW_INVENTORY: 'Inventario bajo el stock mínimo',
  LOT_EXPIRATION: 'Lote próximo a vencer (FEFO)',
  ORDER_DELAYED: 'Orden / Embarque retrasado',
  INVENTORY_DISCREPANCY: 'Discrepancia en inventario',
  UNAUTHORIZED_ACCESS: 'Intento de acceso no autorizado',
  SYSTEM_ERROR: 'Error crítico del sistema',
  HALTED_PICKING: 'Ola de picking detenida / bloqueada',
  USER_LOCKED: 'Usuario bloqueado por intentos fallidos',
  INTEGRATION_ERROR: 'Error en integración ERP / SAP',
  SHIPMENT_DELAYED: 'Embarque retrasado sobre ventana horaria',
};

export const ALERT_PRIORITY_LABELS: Record<AlertPriority, string> = {
  INFO: 'Información',
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const ALERT_CONDITION_LABELS: Record<AlertCondition, string> = {
  GREATER_THAN: 'Mayor que ( > )',
  LESS_THAN: 'Menor que ( < )',
  EQUAL: 'Igual a ( = )',
  EQUALS: 'Igual a ( = )',
  GREATER_OR_EQUAL: 'Mayor o igual que ( >= )',
  LESS_OR_EQUAL: 'Menor o igual que ( <= )',
  TIME_EXCEEDED: 'Tiempo excedido ( > t )',
};

export const ALERT_UNIT_LABELS: Record<AlertUnit, string> = {
  MINUTES: 'Minutos',
  HOURS: 'Horas',
  DAYS: 'Días',
  PERCENTAGE: 'Porcentaje',
  UNITS: 'Unidades',
  PIECES: 'Piezas',
  PALLETS: 'Pallets',
};

export const ALERT_RECURRENCE_LABELS: Record<AlertRecurrence, string> = {
  NEVER: 'Nunca',
  EVERY_15_MIN: 'Cada 15 minutos',
  EVERY_30_MIN: 'Cada 30 minutos',
  EVERY_HOUR: 'Cada hora',
  DAILY: 'Diariamente',
};

export const ALERT_ESCALATION_LABELS: Record<AlertEscalationTime, string> = {
  NONE: 'Sin escalamiento',
  AFTER_15_MIN: 'Después de 15 minutos',
  AFTER_30_MIN: 'Después de 30 minutos',
  AFTER_60_MIN: 'Después de 60 minutos',
};

export const RECIPIENT_ROLE_LABELS: Record<AlertRecipientRole, string> = {
  OPERATOR: 'Operador de Montacargas / Andén',
  SUPERVISOR: 'Supervisor de Operaciones',
  MANAGER: 'Gerente de Almacén',
  CONTROL_DESK: 'Mesa de Control',
  ADMIN: 'Administrador del Sistema',
  CLIENT: 'Cliente 3PL / Cuenta',
};

// ═══════════════════════════════════════════════════════════════════
// DATOS DUMMY REALISTAS 3PL WMS
// ═══════════════════════════════════════════════════════════════════

const ORG_ID = 'a53f0907-9fa5-4bdf-87db-2eb5e7683935';

export const DUMMY_ALERTS: AlertConfiguration[] = [
  {
    id: 'e13f0907-9fa5-4bdf-87db-2eb5e7683961',
    organizationId: ORG_ID,
    name: 'Unidad con tiempo de espera excedido en patio',
    category: 'RECEIVING',
    event: 'WAIT_TIME_EXCEEDED',
    priority: 'HIGH',
    status: 'ACTIVE',
    channels: ['SYSTEM'],
    recipients: ['SUPERVISOR', 'MANAGER'],
    condition: 'TIME_EXCEEDED',
    value: 30,
    unit: 'MINUTES',
    recurrence: 'EVERY_15_MIN',
    escalation: 'AFTER_30_MIN',
    messageTemplate: 'La unidad transportista {{truck}} en rampa {{ramp}} ha superado los {{value}} minutos de espera.',
    description: 'Notifica al equipo cuando un camión sobrepasa el tiempo límite sin iniciar descarga.',
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-07-27T14:30:00Z',
    updatedBy: 'gerente.operaciones@4guard.mx',
  },
  {
    id: 'e13f0907-9fa5-4bdf-87db-2eb5e7683962',
    organizationId: ORG_ID,
    name: 'Inventario bajo nivel mínimo crítico',
    category: 'INVENTORY',
    event: 'LOW_INVENTORY',
    priority: 'HIGH',
    status: 'ACTIVE',
    channels: ['SYSTEM'],
    recipients: ['SUPERVISOR', 'MANAGER', 'CLIENT'],
    condition: 'LESS_THAN',
    value: 100,
    unit: 'PIECES',
    recurrence: 'EVERY_30_MIN',
    escalation: 'AFTER_60_MIN',
    messageTemplate: 'El SKU {{sku}} en zona {{zone}} alcanzó el stock crítico de {{qty}} pzas.',
    description: 'Dispara reabastecimiento o alerta de quiebre de stock para clientes 3PL.',
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-07-26T16:45:00Z',
    updatedBy: 'gerente.operaciones@4guard.mx',
  },
  {
    id: 'e13f0907-9fa5-4bdf-87db-2eb5e7683963',
    organizationId: ORG_ID,
    name: 'Lote próximo a vencer (Regla FEFO)',
    category: 'QUALITY',
    event: 'LOT_EXPIRATION',
    priority: 'CRITICAL',
    status: 'ACTIVE',
    channels: ['SYSTEM'],
    recipients: ['SUPERVISOR', 'MANAGER', 'ADMIN'],
    condition: 'LESS_THAN',
    value: 15,
    unit: 'HOURS',
    recurrence: 'EVERY_HOUR',
    escalation: 'AFTER_15_MIN',
    messageTemplate: 'Atención: El lote {{lot}} del producto {{sku}} vence el {{date}} y requiere bloqueo FEFO.',
    description: 'Previene la salida de mercancía caducada congelando lotes próximos a vencer.',
    createdAt: '2026-03-12T07:30:00Z',
    updatedAt: '2026-07-25T12:00:00Z',
    updatedBy: 'calidad@4guard.mx',
  },
  {
    id: 'e13f0907-9fa5-4bdf-87db-2eb5e7683964',
    organizationId: ORG_ID,
    name: 'Discrepancia en Conteo Cíclico',
    category: 'INVENTORY',
    event: 'INVENTORY_DISCREPANCY',
    priority: 'HIGH',
    status: 'ACTIVE',
    channels: ['SYSTEM'],
    recipients: ['SUPERVISOR', 'ADMIN'],
    condition: 'GREATER_THAN',
    value: 5,
    unit: 'PERCENTAGE',
    recurrence: 'NEVER',
    escalation: 'AFTER_60_MIN',
    messageTemplate: 'Se detectó una variación del {{value}}% en el conteo del inventario {{location}}.',
    description: 'Discrepancia de inventario físico vs sistema que requiere auditoría.',
    createdAt: '2026-04-05T13:20:00Z',
    updatedAt: '2026-07-22T09:10:00Z',
    updatedBy: 'supervisor.picking@4guard.mx',
  },
  {
    id: 'e13f0907-9fa5-4bdf-87db-2eb5e7683965',
    organizationId: ORG_ID,
    name: 'Retraso en Salida de Embarque',
    category: 'SHIPPING',
    event: 'ORDER_DELAYED',
    priority: 'MEDIUM',
    status: 'INACTIVE',
    channels: ['SYSTEM'],
    recipients: ['SUPERVISOR'],
    condition: 'GREATER_THAN',
    value: 60,
    unit: 'MINUTES',
    recurrence: 'NEVER',
    escalation: 'NONE',
    messageTemplate: 'La orden de embarque {{order}} tiene un retraso de {{value}} minutos sobre la cita.',
    description: 'Monitoreo de tiempos de salida de transportistas.',
    createdAt: '2026-06-20T14:00:00Z',
    updatedAt: '2026-07-24T17:00:00Z',
    updatedBy: 'gerente.operaciones@4guard.mx',
  },
];

export const DUMMY_ALERT_HISTORY: AlertHistoryEntry[] = [
  {
    id: 'his-001',
    alertId: 'alt-001',
    timestamp: '2026-07-27T14:30:00Z',
    user: 'gerente.operaciones@4guard.mx',
    changeSummary: 'Se actualizó el tiempo límite de 20 a 30 minutos y se agregó escalamiento a 30m.',
    previousStatus: 'ACTIVE',
    newStatus: 'ACTIVE',
  },
  {
    id: 'his-002',
    alertId: 'alt-001',
    timestamp: '2026-05-10T11:15:00Z',
    user: 'supervisor.recepcion@4guard.mx',
    changeSummary: 'Creación de la regla de alerta inicial con prioridad ALTA.',
    previousStatus: undefined,
    newStatus: 'ACTIVE',
  },
  {
    id: 'his-003',
    alertId: 'alt-003',
    timestamp: '2026-07-26T16:45:00Z',
    user: 'gerente.operaciones@4guard.mx',
    changeSummary: 'Ajuste de stock mínimo de 50 a 100 piezas por requerimiento del cliente 3PL.',
    previousStatus: 'ACTIVE',
    newStatus: 'ACTIVE',
  },
];

export const DUMMY_ALERT_AUDIT: AlertAuditEntry[] = [
  {
    id: 'aud-001',
    organizationId: ORG_ID,
    entityId: 'alt-001',
    action: 'UPDATE',
    performedBy: 'gerente.operaciones@4guard.mx',
    performedAt: '2026-07-27T14:30:00Z',
    details: 'Modificación de parámetros de condición: value=30, escalation=AFTER_30_MIN.',
  },
  {
    id: 'aud-002',
    organizationId: ORG_ID,
    entityId: 'alt-007',
    action: 'DEACTIVATE',
    performedBy: 'sistemas@4guard.mx',
    performedAt: '2026-07-15T11:30:00Z',
    details: 'Regla inactivada por mantenimiento en servidor de integración SAP.',
  },
  {
    id: 'aud-003',
    organizationId: ORG_ID,
    entityId: 'alt-003',
    action: 'UPDATE',
    performedBy: 'gerente.operaciones@4guard.mx',
    performedAt: '2026-07-26T16:45:00Z',
    details: 'Actualización de valor límite a 100 PIECES.',
  },
];
