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
