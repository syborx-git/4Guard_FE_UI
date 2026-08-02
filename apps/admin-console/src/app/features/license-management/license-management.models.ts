/**
 * @file license-management.models.ts
 * @description Modelos, tipos, labels y datos dummy para HU-139 — Gestión de Licencias del WMS.
 * 4GUARD WMS Enterprise · Control Comercial y Capacidades
 *
 * ─── SEPARACIÓN DE ESTADO ────────────────────────────────────────────────────
 * adminStatus   (almacenado): DRAFT | ACTIVE | SUSPENDED | REVOKED
 * derivedStatus (computado) : DRAFT | SCHEDULED | ACTIVE | EXPIRING_SOON | EXPIRED | SUSPENDED | REVOKED
 *
 * SCHEDULED, EXPIRING_SOON y EXPIRED se calculan desde las fechas.
 * SUSPENDED y REVOKED tienen prioridad sobre el estado derivado.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS DE DOMINIO
// ═══════════════════════════════════════════════════════════════════════════

/** Estado administrativo persistente (lo que se guarda en BD). */
export type LicenseAdminStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

/** Estado visual derivado (calculado en tiempo de ejecución, no persiste). */
export type LicenseDerivedStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED';

export type LicensePlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM';

export type LicensedModule =
  | 'WMS_CORE'
  | 'RECEIVING'
  | 'QUALITY'
  | 'INVENTORY'
  | 'PICKING'
  | 'SHIPPING'
  | 'YARD_MANAGEMENT'
  | 'CONTROL_TOWER'
  | 'ADVANCED_REPORTS'
  | 'API_INTEGRATIONS'
  | 'BILLING';

export type LicenseHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'RENEWED'
  | 'SUSPENDED'
  | 'REACTIVATED'
  | 'REVOKED'
  | 'CAPACITY_CHANGED'
  | 'MODULES_CHANGED'
  | 'KEY_REGENERATED';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES DE NEGOCIO
// ═══════════════════════════════════════════════════════════════════════════

/** Capacidades contratadas (lo que la organización pagó). */
export interface LicenseCapacity {
  maxUsers: number;               // 1–10,000
  maxConcurrentUsers: number;     // 1–10,000, siempre ≤ maxUsers
  maxWarehouses: number;          // 1–1,000
  maxHandheldDevices: number;     // 1–10,000
  maxIntegrations: number;        // 0–100
}

/** Consumo actual (lo que la organización está usando). */
export interface LicenseUsage {
  currentUsers: number;
  concurrentUsersPeak: number;
  currentWarehouses: number;
  registeredHandheldDevices: number;
  activeIntegrations: number;
}

/** Entidad principal de licencia. */
export interface WmsLicense {
  id: string;
  organizationId: string;
  organizationName: string;
  licenseName: string;
  /** Clave interna real (nunca exponer en UI directamente). */
  licenseKey: string;
  /** Versión enmascarada para visualización en listados y formularios. */
  maskedLicenseKey: string;
  plan: LicensePlan;
  description: string;
  validFrom: string;              // ISO 8601
  validUntil: string;             // ISO 8601
  gracePeriodDays: number;        // 0–90
  autoRenewal: boolean;
  /** Estado administrativo persistente. */
  adminStatus: LicenseAdminStatus;
  capacities: LicenseCapacity;
  usage: LicenseUsage;
  enabledModules: LicensedModule[];
  /** Motivo del último cambio de estado/capacidad/módulos. */
  administrativeReason: string;
  observations: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/** Entrada del historial de cambios de una licencia. */
export interface LicenseHistoryEntry {
  id: string;
  licenseId: string;
  action: LicenseHistoryAction;
  description: string;
  previousValue: unknown;
  newValue: unknown;
  performedBy: string;
  performedAt: string;
}

/** Entrada del registro de auditoría inmutable. */
export interface LicenseAuditEntry {
  id: string;
  organizationId: string;
  licenseId: string;
  action: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  performedBy: string;
  performedAt: string;
  transactionStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL';
}

/** Payload para renovación de licencia. */
export interface LicenseRenewalPayload {
  newValidUntil: string;
  newPlan?: LicensePlan;
  newCapacities?: Partial<LicenseCapacity>;
  reason: string;
}

/** Resultado estándar de operaciones del servicio. */
export interface ServiceResult<T> {
  data: T;
  message: string;
  success: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES PARA ORGANIZACIÓN DUMMY
// ═══════════════════════════════════════════════════════════════════════════

export interface DummyOrganization {
  id: string;
  name: string;
  rfc: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DICCIONARIOS DE LABELS PARA UI
// ═══════════════════════════════════════════════════════════════════════════

export const LICENSE_PLAN_LABELS: Record<LicensePlan, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
  CUSTOM: 'Personalizado',
};

export const LICENSE_DERIVED_STATUS_LABELS: Record<LicenseDerivedStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  ACTIVE: 'Activa',
  EXPIRING_SOON: 'Por vencer',
  EXPIRED: 'Vencida',
  SUSPENDED: 'Suspendida',
  REVOKED: 'Revocada',
};

export const LICENSE_HISTORY_ACTION_LABELS: Record<LicenseHistoryAction, string> = {
  CREATED: 'Licencia creada',
  UPDATED: 'Licencia actualizada',
  RENEWED: 'Licencia renovada',
  SUSPENDED: 'Licencia suspendida',
  REACTIVATED: 'Licencia reactivada',
  REVOKED: 'Licencia revocada',
  CAPACITY_CHANGED: 'Capacidad modificada',
  MODULES_CHANGED: 'Módulos actualizados',
  KEY_REGENERATED: 'Clave regenerada',
};

export interface ModuleDefinition {
  key: LicensedModule;
  label: string;
  description: string;
  icon: string;
  badge: 'BASE' | 'PREMIUM' | 'INTEGRACIÓN' | 'PRÓXIMAMENTE';
  required: boolean;
  comingSoon: boolean;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: 'WMS_CORE',
    label: 'WMS Core',
    description: 'Funcionalidades base del sistema de gestión de almacén.',
    icon: 'warehouse',
    badge: 'BASE',
    required: true,
    comingSoon: false,
  },
  {
    key: 'RECEIVING',
    label: 'Recepción',
    description: 'Gestión de entradas, ASN y despacho de andén.',
    icon: 'move_to_inbox',
    badge: 'BASE',
    required: false,
    comingSoon: false,
  },
  {
    key: 'QUALITY',
    label: 'Calidad',
    description: 'Inspección, muestreo y control de calidad en recepción.',
    icon: 'fact_check',
    badge: 'BASE',
    required: false,
    comingSoon: false,
  },
  {
    key: 'INVENTORY',
    label: 'Inventario',
    description: 'Gestión de existencias, lotes, series y ciclos de conteo.',
    icon: 'inventory_2',
    badge: 'BASE',
    required: false,
    comingSoon: false,
  },
  {
    key: 'PICKING',
    label: 'Picking',
    description: 'Oleadas, estrategias de picking y confirmación de líneas.',
    icon: 'shopping_cart',
    badge: 'BASE',
    required: false,
    comingSoon: false,
  },
  {
    key: 'SHIPPING',
    label: 'Despacho',
    description: 'Embarques, manifiesto de salida y confirmación de envíos.',
    icon: 'local_shipping',
    badge: 'BASE',
    required: false,
    comingSoon: false,
  },
  {
    key: 'YARD_MANAGEMENT',
    label: 'Yard Management',
    description: 'Control de patio, gestión de rampas y unidades de transporte.',
    icon: 'agriculture',
    badge: 'PREMIUM',
    required: false,
    comingSoon: false,
  },
  {
    key: 'CONTROL_TOWER',
    label: 'Torre de Control',
    description: 'Monitoreo en tiempo real, KPIs y visibilidad de operación.',
    icon: 'cell_tower',
    badge: 'PREMIUM',
    required: false,
    comingSoon: false,
  },
  {
    key: 'ADVANCED_REPORTS',
    label: 'Reportes Avanzados',
    description: 'Dashboards, exportaciones y análisis histórico de datos.',
    icon: 'insert_chart',
    badge: 'PREMIUM',
    required: false,
    comingSoon: false,
  },
  {
    key: 'API_INTEGRATIONS',
    label: 'API e Integraciones',
    description: 'Webhooks, conectores ERP y API REST externa.',
    icon: 'api',
    badge: 'INTEGRACIÓN',
    required: false,
    comingSoon: false,
  },
  {
    key: 'BILLING',
    label: 'Facturación',
    description: 'Módulo de facturación y gestión de cobros logísticos.',
    icon: 'receipt_long',
    badge: 'PRÓXIMAMENTE',
    required: false,
    comingSoon: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZACIONES DUMMY
// (preparado para futura integración con catálogo real de organizaciones)
// ═══════════════════════════════════════════════════════════════════════════

export const DUMMY_ORGANIZATIONS: DummyOrganization[] = [
  { id: 'org-001', name: '4GUARD México', rfc: '4GM200101AAA' },
  { id: 'org-002', name: 'Operador Logístico Norte', rfc: 'OLN190301BBB' },
  { id: 'org-003', name: 'Distribuciones Centro', rfc: 'DCE210601CCC' },
  { id: 'org-004', name: 'Cliente Piloto', rfc: 'CPL230101DDD' },
];

// ═══════════════════════════════════════════════════════════════════════════
// DATOS DUMMY — LICENCIAS
// ═══════════════════════════════════════════════════════════════════════════

const now = new Date();

/** Genera fecha ISO relativa a hoy. */
function relativeDate(daysOffset: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

export const DUMMY_LICENSES: WmsLicense[] = [
  // ── Licencia 1: 4GUARD México — Enterprise, ACTIVE ──────────────────────
  {
    id: 'lic-001',
    organizationId: 'org-001',
    organizationName: '4GUARD México',
    licenseName: 'Enterprise 3PL — Operación México',
    licenseKey: '4GD-ENT-2026-MXOP-9X21',
    maskedLicenseKey: '4GD-ENT-••••-••••-9X21',
    plan: 'ENTERPRISE',
    description:
      'Licencia Enterprise para operación 3PL completa en territorio nacional. Incluye todos los módulos operativos y capacidades de integración.',
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    gracePeriodDays: 15,
    autoRenewal: true,
    adminStatus: 'ACTIVE',
    capacities: {
      maxUsers: 100,
      maxConcurrentUsers: 50,
      maxWarehouses: 5,
      maxHandheldDevices: 30,
      maxIntegrations: 5,
    },
    usage: {
      currentUsers: 87,
      concurrentUsersPeak: 34,
      currentWarehouses: 3,
      registeredHandheldDevices: 22,
      activeIntegrations: 3,
    },
    enabledModules: [
      'WMS_CORE',
      'RECEIVING',
      'QUALITY',
      'INVENTORY',
      'PICKING',
      'SHIPPING',
      'YARD_MANAGEMENT',
      'CONTROL_TOWER',
      'ADVANCED_REPORTS',
      'API_INTEGRATIONS',
    ],
    administrativeReason: 'Alta inicial de licencia Enterprise para operación nacional.',
    observations: 'Cliente estratégico. Renovación automática habilitada.',
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-07-27T18:30:00Z',
    updatedBy: 'ops.manager@4guard.mx',
  },

  // ── Licencia 2: Operador Logístico Norte — Professional, EXPIRING_SOON ──
  {
    id: 'lic-002',
    organizationId: 'org-002',
    organizationName: 'Operador Logístico Norte',
    licenseName: 'Professional — Operaciones Norte',
    licenseKey: '4GD-PRO-2026-NRTE-7B04',
    maskedLicenseKey: '4GD-PRO-••••-••••-7B04',
    plan: 'PROFESSIONAL',
    description:
      'Licencia Professional para operaciones regionales en el norte del país.',
    validFrom: '2026-01-15T00:00:00Z',
    validUntil: relativeDate(18), // Vence en 18 días → EXPIRING_SOON
    gracePeriodDays: 7,
    autoRenewal: false,
    adminStatus: 'ACTIVE',
    capacities: {
      maxUsers: 20,
      maxConcurrentUsers: 10,
      maxWarehouses: 2,
      maxHandheldDevices: 10,
      maxIntegrations: 2,
    },
    usage: {
      currentUsers: 18,
      concurrentUsersPeak: 9,
      currentWarehouses: 1,
      registeredHandheldDevices: 8,
      activeIntegrations: 1,
    },
    enabledModules: [
      'WMS_CORE',
      'RECEIVING',
      'INVENTORY',
      'PICKING',
      'SHIPPING',
    ],
    administrativeReason: 'Alta inicial de licencia Professional.',
    observations: 'Contactar para renovación antes del vencimiento.',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-07-10T10:00:00Z',
    updatedBy: 'ops.manager@4guard.mx',
  },

  // ── Licencia 3: Distribuciones Centro — Starter, SUSPENDED ──────────────
  {
    id: 'lic-003',
    organizationId: 'org-003',
    organizationName: 'Distribuciones Centro',
    licenseName: 'Starter — Operación Central',
    licenseKey: '4GD-STR-2026-CNTR-3F99',
    maskedLicenseKey: '4GD-STR-••••-••••-3F99',
    plan: 'STARTER',
    description: 'Licencia Starter para distribuidora regional con un almacén.',
    validFrom: '2026-03-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    gracePeriodDays: 0,
    autoRenewal: false,
    adminStatus: 'SUSPENDED',
    capacities: {
      maxUsers: 10,
      maxConcurrentUsers: 5,
      maxWarehouses: 1,
      maxHandheldDevices: 5,
      maxIntegrations: 1,
    },
    usage: {
      currentUsers: 10,
      concurrentUsersPeak: 5,
      currentWarehouses: 1,
      registeredHandheldDevices: 4,
      activeIntegrations: 0,
    },
    enabledModules: ['WMS_CORE', 'RECEIVING', 'INVENTORY'],
    administrativeReason: 'Suspensión por falta de pago de renovación anual.',
    observations: 'En espera de confirmación de pago para reactivación.',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-07-01T14:00:00Z',
    updatedBy: 'ops.manager@4guard.mx',
  },

  // ── Licencia 4: Cliente Piloto — Custom, DRAFT → SCHEDULED ──────────────
  {
    id: 'lic-004',
    organizationId: 'org-004',
    organizationName: 'Cliente Piloto',
    licenseName: 'Personalizado — Proyecto Piloto Q3',
    licenseKey: '4GD-CST-2026-PLOT-1A55',
    maskedLicenseKey: '4GD-CST-••••-••••-1A55',
    plan: 'CUSTOM',
    description:
      'Licencia personalizada para proyecto piloto con módulos específicos acordados en contrato.',
    validFrom: relativeDate(15),  // Inicia en 15 días → SCHEDULED
    validUntil: relativeDate(380),
    gracePeriodDays: 30,
    autoRenewal: false,
    adminStatus: 'ACTIVE', // adminStatus=ACTIVE pero derivedStatus=SCHEDULED por fecha
    capacities: {
      maxUsers: 15,
      maxConcurrentUsers: 8,
      maxWarehouses: 1,
      maxHandheldDevices: 6,
      maxIntegrations: 1,
    },
    usage: {
      currentUsers: 0,
      concurrentUsersPeak: 0,
      currentWarehouses: 0,
      registeredHandheldDevices: 0,
      activeIntegrations: 0,
    },
    enabledModules: ['WMS_CORE', 'RECEIVING', 'QUALITY', 'INVENTORY'],
    administrativeReason: 'Licencia creada para proyecto piloto personalizado.',
    observations: 'Módulos adicionales se evaluarán a 90 días de operación.',
    createdAt: '2026-07-20T09:00:00Z',
    updatedAt: '2026-07-20T09:00:00Z',
    updatedBy: 'ops.manager@4guard.mx',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DATOS DUMMY — HISTORIAL
// ═══════════════════════════════════════════════════════════════════════════

export const DUMMY_LICENSE_HISTORY: LicenseHistoryEntry[] = [
  {
    id: 'hist-001',
    licenseId: 'lic-001',
    action: 'CREATED',
    description: 'Licencia Enterprise creada. Inicio de vigencia contractual.',
    previousValue: null,
    newValue: { plan: 'ENTERPRISE', status: 'ACTIVE' },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'hist-002',
    licenseId: 'lic-001',
    action: 'CAPACITY_CHANGED',
    description: 'Usuarios máximos cambiados de 75 a 100 por expansión operativa.',
    previousValue: { maxUsers: 75 },
    newValue: { maxUsers: 100 },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-07-27T18:30:00Z',
  },
  {
    id: 'hist-003',
    licenseId: 'lic-002',
    action: 'CREATED',
    description: 'Licencia Professional creada para operaciones regionales norte.',
    previousValue: null,
    newValue: { plan: 'PROFESSIONAL', status: 'ACTIVE' },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'hist-004',
    licenseId: 'lic-003',
    action: 'CREATED',
    description: 'Licencia Starter creada para distribuidora regional.',
    previousValue: null,
    newValue: { plan: 'STARTER', status: 'ACTIVE' },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-03-01T08:00:00Z',
  },
  {
    id: 'hist-005',
    licenseId: 'lic-003',
    action: 'SUSPENDED',
    description: 'Licencia suspendida por falta de pago de renovación anual.',
    previousValue: { adminStatus: 'ACTIVE' },
    newValue: { adminStatus: 'SUSPENDED' },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-07-01T14:00:00Z',
  },
  {
    id: 'hist-006',
    licenseId: 'lic-004',
    action: 'CREATED',
    description: 'Licencia personalizada creada para proyecto piloto Q3.',
    previousValue: null,
    newValue: { plan: 'CUSTOM', adminStatus: 'ACTIVE' },
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-07-20T09:00:00Z',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DATOS DUMMY — AUDITORÍA
// ═══════════════════════════════════════════════════════════════════════════

export const DUMMY_LICENSE_AUDIT: LicenseAuditEntry[] = [
  {
    id: 'aud-001',
    organizationId: 'org-001',
    licenseId: 'lic-001',
    action: 'CREATED',
    previousValue: null,
    newValue: { plan: 'ENTERPRISE', adminStatus: 'ACTIVE', maxUsers: 75 },
    reason: 'Alta inicial de licencia Enterprise para operación nacional.',
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-01-01T08:00:00Z',
    transactionStatus: 'SUCCESS',
  },
  {
    id: 'aud-002',
    organizationId: 'org-001',
    licenseId: 'lic-001',
    action: 'CAPACITY_CHANGED',
    previousValue: { maxUsers: 75, maxHandheldDevices: 20 },
    newValue: { maxUsers: 100, maxHandheldDevices: 30 },
    reason: 'Expansión operativa Q3 2026.',
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-07-27T18:30:00Z',
    transactionStatus: 'SUCCESS',
  },
  {
    id: 'aud-003',
    organizationId: 'org-003',
    licenseId: 'lic-003',
    action: 'SUSPENDED',
    previousValue: { adminStatus: 'ACTIVE' },
    newValue: { adminStatus: 'SUSPENDED' },
    reason: 'Suspensión por falta de pago de renovación anual.',
    performedBy: 'ops.manager@4guard.mx',
    performedAt: '2026-07-01T14:00:00Z',
    transactionStatus: 'SUCCESS',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN AUXILIAR — CALCULAR ESTADO DERIVADO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula el estado visual derivado a partir del estado administrativo y las fechas.
 * SUSPENDED y REVOKED tienen prioridad sobre cualquier estado temporal.
 */
export function computeDerivedStatus(license: WmsLicense): LicenseDerivedStatus {
  if (license.adminStatus === 'SUSPENDED') return 'SUSPENDED';
  if (license.adminStatus === 'REVOKED') return 'REVOKED';
  if (license.adminStatus === 'DRAFT') return 'DRAFT';

  const now = new Date();
  const from = new Date(license.validFrom);
  const until = new Date(license.validUntil);
  const msPerDay = 86_400_000;
  const daysRemaining = Math.ceil((until.getTime() - now.getTime()) / msPerDay);

  if (now < from) return 'SCHEDULED';
  if (daysRemaining < 0) return 'EXPIRED';
  if (daysRemaining <= 30) return 'EXPIRING_SOON';
  return 'ACTIVE';
}
