/**
 * @file performance-kpi.model.ts
 * @description Interfaces y tipos del dominio KPIs de Rendimiento (HU-138) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE — HU-138: Administrador de KPIs Operativos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Consola administrativa para definir indicadores, metas, umbrales y alertas.
 * Los KPIs definidos aquí serán consumidos por dashboards del sistema.
 *
 * ── Módulos consumidores futuros ──────────────────────────────────────────
 *  • Dashboard de KPIs con gráficas y tendencias
 *  • Comparativos y rendimiento histórico
 *  • Indicadores por turno / operador / cliente
 *  • Indicadores del monitor de patio
 *  • Torre de Control
 *
 * ── Lo que NO incluye esta HU ─────────────────────────────────────────────
 *  NO incluye: captura manual de productividad, dashboards de visualización,
 *  gráficas de tendencia, reportes, ni cálculos automáticos.
 *  Esas funciones pertenecen a módulos posteriores y consumirán este catálogo.
 */

// ─── Enums / tipos discriminados ─────────────────────────────────────────────

/** Estado operativo del KPI calculado con base en currentValue + umbrales + evaluationType. */
export type KpiStatus = 'OPTIMAL' | 'WARNING' | 'CRITICAL' | 'NO_DATA';

/**
 * Módulo del WMS al que pertenece el indicador.
 * Corresponde a los módulos funcionales del sistema 4GUARD.
 */
export type KpiModule =
  | 'RECEIVING'        // Recepción
  | 'QUALITY'          // Calidad
  | 'INVENTORY'        // Inventario
  | 'PICKING'          // Picking
  | 'SHIPPING'         // Embarques
  | 'YARD'             // Patio
  | 'CARRIERS';        // Transportistas

/** Unidad de medida del indicador. */
export type KpiUnit =
  | 'MINUTES'          // Minutos
  | 'HOURS'            // Horas
  | 'PERCENTAGE'       // %
  | 'PIECES'           // Piezas
  | 'CASES'            // Cajas
  | 'PALLETS'          // Tarimas
  | 'UNITS_PER_HOUR'   // Unidades/Hora
  | 'ORDERS_PER_HOUR'; // Órdenes/Hora

/**
 * Tipo de evaluación que determina cómo se interpretan los umbrales.
 *
 * - HIGHER_IS_BETTER:  Ej: Exactitud de inventario → 99% es mejor que 95%
 * - LOWER_IS_BETTER:   Ej: Tiempo de descarga → 30min es mejor que 60min
 * - RANGE:             Ej: Ocupación del almacén → ideal entre 60% y 85%
 */
export type EvaluationType =
  | 'HIGHER_IS_BETTER'
  | 'LOWER_IS_BETTER'
  | 'RANGE';

/** Unidad de tiempo para la frecuencia de actualización. */
export type FrequencyUnit =
  | 'MINUTES'
  | 'HOURS'
  | 'DAYS';

// ─── Modelos de soporte ──────────────────────────────────────────────────────

/**
 * Configuración de umbrales del KPI.
 *
 * Para HIGHER_IS_BETTER: objetivo > advertencia > crítico
 *   Ej: Exactitud → objetivo: 99, advertencia: 95, crítico: 90
 *
 * Para LOWER_IS_BETTER: objetivo < advertencia < crítico
 *   Ej: Tiempo descarga → objetivo: 45, advertencia: 60, crítico: 90
 *
 * Para RANGE: se usan rangeLow y rangeHigh para definir el rango ideal.
 *   - Dentro del rango [rangeLow, rangeHigh] → OPTIMAL
 *   - Fuera del rango pero dentro de advertencia/crítico → WARNING / CRITICAL
 *   Ej: Ocupación → rangeLow: 60, rangeHigh: 85, advertencia: 10, crítico: 20
 *       (10% y 20% representan la distancia fuera del rango ideal)
 */
export interface KpiThresholds {
  /** Valor objetivo (para HIGHER/LOWER). */
  target: number;
  /** Valor de advertencia (para HIGHER/LOWER). */
  warning: number;
  /** Valor crítico (para HIGHER/LOWER). */
  critical: number;

  /** Límite inferior del rango ideal (solo para RANGE). */
  rangeLow?: number;
  /** Límite superior del rango ideal (solo para RANGE). */
  rangeHigh?: number;
}

/**
 * Configuración del origen del indicador.
 * Permite que el backend calcule automáticamente el KPI.
 */
export interface KpiSourceConfig {
  /** Proceso origen del indicador. */
  sourceProcess: string;
  /** Evento que marca el inicio de la medición. */
  startEvent: string;
  /** Evento que marca el fin de la medición. */
  endEvent: string;
  /** Valor numérico de la frecuencia de actualización. */
  frequencyValue: number;
  /** Unidad de la frecuencia de actualización. */
  frequencyUnit: FrequencyUnit;
  /** Indica si el indicador está activo para cálculo automático. */
  active: boolean;
}

// ─── Modelo principal ─────────────────────────────────────────────────────────

/**
 * Entidad completa de un KPI de rendimiento tal como se trabaja en el frontend.
 */
export interface PerformanceKpi {
  id: string;

  // Información general
  name: string;                    // Nombre del KPI
  description: string;             // Descripción detallada
  module: KpiModule;               // Módulo del WMS
  unit: KpiUnit;                   // Unidad de medida
  evaluationType: EvaluationType;  // Tipo de evaluación

  // Umbrales
  thresholds: KpiThresholds;

  // Valor actual y estado
  /** Último valor medido del indicador. null si aún no hay datos. */
  currentValue: number | null;
  /** Timestamp ISO 8601 de la última medición. null si aún no hay datos. */
  lastMeasuredAt: string | null;
  /**
   * Estado calculado del KPI con base en currentValue, evaluationType y thresholds.
   * Se calcula en el servicio, no se persiste directamente.
   */
  status: KpiStatus;

  // Origen del indicador
  sourceConfig: KpiSourceConfig;

  // Estado lógico
  /** false = eliminación lógica (desactivado). */
  isEnabled: boolean;

  // Control (solo lectura)
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
  createdBy: string;
  updatedBy: string;
}

// ─── DTOs de escritura ────────────────────────────────────────────────────────

/**
 * Payload para crear un nuevo KPI.
 * POST /api/performance-kpis
 */
export interface CreateKpiRequest {
  name: string;
  description: string;
  module: KpiModule;
  unit: KpiUnit;
  evaluationType: EvaluationType;
  thresholds: KpiThresholds;
  sourceConfig: KpiSourceConfig;
}

/**
 * Payload para actualizar un KPI existente.
 * PUT /api/performance-kpis/{id}
 */
export interface UpdateKpiRequest extends CreateKpiRequest {}

// ─── Paginación y consulta ────────────────────────────────────────────────────

export interface KpiListParams {
  search?: string;
  module?: KpiModule | '';
  status?: KpiStatus | '';
  includeDisabled?: boolean;
}

// ─── Respuesta genérica del backend ──────────────────────────────────────────

/**
 * Envoltorio estándar de respuesta del API de 4GUARD.
 * Alineado con el patrón CarrierApiResponse<T>.
 */
export interface KpiApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

// ─── Etiquetas de visualización ──────────────────────────────────────────────

/** Mapeo de KpiModule a etiqueta legible en español. */
export const KPI_MODULE_LABELS: Record<KpiModule, string> = {
  RECEIVING:  'Recepción',
  QUALITY:    'Calidad',
  INVENTORY:  'Inventario',
  PICKING:    'Picking',
  SHIPPING:   'Embarques',
  YARD:       'Patio',
  CARRIERS:   'Transportistas',
};

/** Mapeo de KpiUnit a etiqueta legible en español. */
export const KPI_UNIT_LABELS: Record<KpiUnit, string> = {
  MINUTES:         'Minutos',
  HOURS:           'Horas',
  PERCENTAGE:      '%',
  PIECES:          'Piezas',
  CASES:           'Cajas',
  PALLETS:         'Tarimas',
  UNITS_PER_HOUR:  'Unidades/Hora',
  ORDERS_PER_HOUR: 'Órdenes/Hora',
};

/** Mapeo de EvaluationType a etiqueta legible en español. */
export const EVALUATION_TYPE_LABELS: Record<EvaluationType, string> = {
  HIGHER_IS_BETTER: 'Mayor es mejor',
  LOWER_IS_BETTER:  'Menor es mejor',
  RANGE:            'Valor dentro de un rango',
};

/** Mapeo de KpiStatus a etiqueta legible en español. */
export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  OPTIMAL:  'Óptimo',
  WARNING:  'Atención',
  CRITICAL: 'Crítico',
  NO_DATA:  'Sin datos',
};

/** Mapeo de FrequencyUnit a etiqueta legible en español. */
export const FREQUENCY_UNIT_LABELS: Record<FrequencyUnit, string> = {
  MINUTES: 'Minutos',
  HOURS:   'Horas',
  DAYS:    'Días',
};

// ─── Modelos de Analítica y Rendimiento (HU-9 / HU-141 / HU-159) ─────────────

export interface ExecutiveKpiData {
  branchId?: string;
  branchName: string;
  warehouseOccupancyPercentage: number;
  inventoryAccuracyPercentage: number;
  onTimeDeliveryPercentage: number;
  avgDockToStockHours: number;
  avgOrderCycleHours: number;
  totalReceptionsToday: number;
  totalOutboundsToday: number;
  totalMovementsToday: number;
  activeIncidencesCount: number;
  lastCalculatedAt: string;
}

export interface RampUsageMetric {
  rampId: string;
  rampCode: string;
  operationsCount: number;
  avgStayMinutes: number;
  status: string;
}

export interface InboundProcessTimesData {
  branchId?: string;
  totalReceptions: number;
  totalPiecesReceived: number;
  avgUnloadMinutes: number;
  minUnloadMinutes: number;
  maxUnloadMinutes: number;
  rampMetrics: RampUsageMetric[];
}

export interface OperatorProductivityData {
  operatorId: string;
  operatorCode: string;
  fullName: string;
  jobTitle: string;
  licenseNumberDc3: string;
  licenseStatus: string;
  shiftId?: string;
  shiftName: string;
  receptionsHandled: number;
  transfersCompleted: number;
  outboundsDispatched: number;
  totalMovements: number;
  shiftEffectiveHours: number;
  movementsPerHour: number;
  targetMovements?: number;
  shiftCompliancePercentage?: number;
  performanceBadge: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

export interface ShiftProductivityData {
  shiftId: string;
  shiftName: string;
  timeRange: string;
  activeOperatorsCount: number;
  totalMovements: number;
  avgMovementsPerHour: number;
  targetPph: number;
  compliancePercentage: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

export interface ProcessFlowTimesData {
  processName: string;
  initialMilestone: string;
  finalMilestone: string;
  averageDurationMinutes: number;
  targetStandardMinutes: number;
  compliancePercentage: number;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

// ─── Requerimientos de Pablo (Circuito Delicado, Trazabilidad & Candados) ─────

export interface DriverPerformanceDetail {
  driverId: string;
  driverName: string;
  driverLicense: string;
  assignedVehiclePlates: string;
  totalTripsMonth: number;
  totalPalletsMoved: number;
  totalPiecesMoved: number;
  avgTurnaroundHours: number;
  boxRotationCount: number;
  status: 'ACTIVO' | 'EN_RUTA' | 'DISPONIBLE' | 'INACTIVO';
}

export interface VehiclePerformanceDetail {
  vehicleId: string;
  economicNumber: string;
  tractorPlates: string;
  transportType: string;
  assignedDriverName: string;
  tripsCount: number;
  boxesTowedCount: number;
  totalPieces: number;
  operatingHours: number;
  status: 'EN_RUTA' | 'EN_PATIO' | 'EN_MANTENIMIENTO';
}

export interface CircuitoDelicadoSummary {
  totalTripsMonth: number;
  activeUnitsCount: number;
  activeDriversCount: number;
  avgTurnaroundHours: number;
  totalPalletsMoved: number;
  totalPiecesMoved: number;
  drivers: DriverPerformanceDetail[];
  vehicles: VehiclePerformanceDetail[];
}

export interface QualityLocksStatus {
  f01ChecklistApprovedCount: number;
  f01PendingCount: number;
  weightValidationPassedCount: number;
  weightValidationFailedCount: number;
  allLocksEnforced: boolean;
}

export interface GateToGateCycleData {
  gateQrPreCheckinAvgMinutes: number;
  gateToDockAvgMinutes: number;
  dockOperationAvgMinutes: number;
  dockToExitAvgMinutes: number;
  totalGateToGateAvgMinutes: number;
  targetGateToGateMinutes: number;
  compliancePercentage: number;
  qualityLocks: QualityLocksStatus;
}

export interface MovementAuditTimelineItem {
  eventId: string;
  timestamp: string;
  operatorId?: string;
  operatorName: string;
  operatorCode: string;
  operationType: string;
  folio: string;
  sscc: string;
  sourceLocation: string;
  targetLocation: string;
  durationSeconds: number;
  qualityLockStatus: string;
  status: string;
  details: string;
}

export interface ExportJobResponse {
  jobId: string;
  reportType: string;
  status: string;
  downloadUrl: string;
  createdAt: string;
  message: string;
}

export interface OperationalUserTargets {
  targetOccupancyPercentage: number;   // default 85%
  targetIraPercentage: number;         // default 99.5%
  targetOtifPercentage: number;        // default 98.0%
  targetDockToStockHours: number;      // default 2.0 hrs
  targetOrderCycleHours: number;       // default 4.0 hrs
  targetForkliftPph: number;           // default 6.0 PPH
  targetInboundUnloadMinutes: number;  // default 45 min
  targetGateToGateMinutes: number;     // default 120 min
}

export const DEFAULT_OPERATIONAL_TARGETS: OperationalUserTargets = {
  targetOccupancyPercentage: 85.0,
  targetIraPercentage: 99.5,
  targetOtifPercentage: 98.0,
  targetDockToStockHours: 2.0,
  targetOrderCycleHours: 4.0,
  targetForkliftPph: 6.0,
  targetInboundUnloadMinutes: 45.0,
  targetGateToGateMinutes: 120.0,
};


