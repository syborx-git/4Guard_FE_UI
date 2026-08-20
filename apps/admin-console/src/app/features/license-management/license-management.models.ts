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
  /** Clave interna real (opcional, solo entregada en regeneración). */
  licenseKey?: string;
  /** Versión enmascarada para visualización en listados y formularios. */
  maskedLicenseKey: string;
  plan: LicensePlan;
  description?: string;
  validFrom: string;              // ISO 8601
  validUntil: string;             // ISO 8601
  gracePeriodDays?: number;        // 0–90
  autoRenewal?: boolean;
  /** Estado administrativo persistente. */
  adminStatus: LicenseAdminStatus;
  capacities?: LicenseCapacity;
  maxUsers?: number;
  maxConcurrentUsers?: number;
  maxWarehouses?: number;
  maxHandheldDevices?: number;
  maxIntegrations?: number;
  usage?: LicenseUsage;
  currentUsers?: number;
  concurrentUsersPeak?: number;
  currentWarehouses?: number;
  registeredHandheldDevices?: number;
  activeIntegrations?: number;
  enabledModules: LicensedModule[];
  /** Motivo del último cambio de estado/capacidad/módulos. */
  administrativeReason?: string;
  observations?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
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

/** Request DTO: Emitir Nueva Licencia WMS */
export interface CreateLicenseRequest {
  organizationId: string;
  licenseName: string;
  plan: LicensePlan;
  description?: string;
  validFrom: string;
  validUntil: string;
  gracePeriodDays?: number;
  autoRenewal?: boolean;
  maxUsers: number;
  maxConcurrentUsers: number;
  maxWarehouses: number;
  maxHandheldDevices: number;
  maxIntegrations: number;
  enabledModules: LicensedModule[];
  observations?: string;
}

/** Request DTO: Modificar Licencia WMS */
export interface UpdateLicenseRequest {
  licenseName?: string;
  plan?: LicensePlan;
  maxUsers?: number;
  maxConcurrentUsers?: number;
  enabledModules?: LicensedModule[];
  administrativeReason?: string;
  observations?: string;
}

/** Request DTO: Renovar Licencia WMS */
export interface RenewLicenseRequest {
  newValidUntil: string;
  newPlan?: LicensePlan;
  autoRenewal?: boolean;
  reason: string;
}

/** Request DTO: Suspender Licencia WMS */
export interface SuspendLicenseRequest {
  reason: string;
}

/** Response DTO: Detalle de Licencia y Consumo Real */
export interface LicenseDetailResponse {
  license: WmsLicense;
  usage: LicenseUsage;
}

/** Response DTO: Regeneración de Clave Secreta */
export interface RegenerateKeyResponse {
  licenseId: string;
  rawLicenseKey: string;
  maskedLicenseKey: string;
  message: string;
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
