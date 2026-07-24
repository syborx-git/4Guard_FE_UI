/**
 * @file business-rules.models.ts
 * @description Modelos y tipos de dominio para HU-131 — Motor de Reglas de Negocio Enterprise.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE Y SEGURIDAD RLS (3PL Enterprise)
 * ═══════════════════════════════════════════════════════════════════════════
 * - GLOBAL: Aplica a toda la plataforma WMS
 * - ORGANIZATION: Aplica a toda la organización corporativa
 * - WAREHOUSE: Específico de una sucursal/almacén físico
 * - CLIENT: Específico de un cliente 3PL
 * - CLIENT_WAREHOUSE: Combinación específica de Cliente 3PL + Almacén
 */

export type RuleScope =
  | 'GLOBAL'
  | 'ORGANIZATION'
  | 'WAREHOUSE'
  | 'CLIENT'
  | 'CLIENT_WAREHOUSE';

export type RuleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'DEPRECATED';

export type RuleSeverity = 'INFO' | 'MEDIUM' | 'WARNING' | 'HIGH' | 'CRITICAL';

export type RuleModule =
  | 'RECEIVING'
  | 'INVENTORY'
  | 'SHIPPING'
  | 'QUALITY'
  | 'LAYOUT'
  | 'SYSTEM'
  | 'SECURITY';

export type RuleCategory =
  | 'STRATEGY'
  | 'TOLERANCE'
  | 'ALERT'
  | 'AUTOMATION'
  | 'RESTRICTION'
  | 'TIMING';

export type RuleDataType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'PERCENTAGE'
  | 'ENUM'
  | 'DURATION_MINUTES'
  | 'DAYS';

export type RuleFunctionalType =
  | 'DETERMINISTIC'
  | 'THRESHOLD'
  | 'POLICY'
  | 'VALIDATION';

export interface BusinessRule {
  id: string;
  code: string;
  name: string;
  description: string;
  module: RuleModule;
  category: RuleCategory;
  functionalType: RuleFunctionalType;
  dataType: RuleDataType;
  value: string | number | boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  options?: string[]; // Opciones válidas para tipo ENUM
  scope: RuleScope;
  scopeEntityName?: string; // Nombre legible del almacén o cliente si no es GLOBAL
  status: RuleStatus;
  severity: RuleSeverity;
  effectiveDate: string; // YYYY-MM-DD
  lastModifiedAt: string; // ISO Datetime
  lastModifiedBy: string; // Nombre o email del usuario
  changeReason: string;
  isSystem: boolean; // Si es una regla protegida de sistema
}

export interface BusinessRuleFilters {
  searchTerm: string;
  module: string;
  category: string;
  dataType: string;
  scope: string;
  status: string;
}

export interface BusinessRuleKpis {
  totalConfigured: number;
  totalActive: number;
  totalInactive: number;
  totalCritical: number;
  recentlyModified: number;
}

export const WMS_RULE_MODULES: { id: RuleModule; label: string }[] = [
  { id: 'RECEIVING', label: 'Recepción' },
  { id: 'INVENTORY', label: 'Inventario' },
  { id: 'SHIPPING', label: 'Despacho' },
  { id: 'QUALITY', label: 'Calidad' },
  { id: 'LAYOUT', label: 'Layout & Ubicaciones' },
  { id: 'SYSTEM', label: 'Sistema Base' },
  { id: 'SECURITY', label: 'Seguridad y Accesos' },
];

export const WMS_RULE_CATEGORIES: { id: RuleCategory; label: string }[] = [
  { id: 'STRATEGY', label: 'Estrategia Operativa' },
  { id: 'TOLERANCE', label: 'Tolerancia de Operación' },
  { id: 'ALERT', label: 'Alerta Preventiva' },
  { id: 'AUTOMATION', label: 'Automatización' },
  { id: 'RESTRICTION', label: 'Restricción de Seguridad' },
  { id: 'TIMING', label: 'Tiempos y Límites' },
];

export const WMS_RULE_SCOPES: { id: RuleScope; label: string; desc: string }[] = [
  { id: 'GLOBAL', label: 'Global WMS', desc: 'Aplica a todo el sistema 4GUARD' },
  { id: 'ORGANIZATION', label: 'Organización', desc: 'Toda la empresa corporativa' },
  { id: 'WAREHOUSE', label: 'Almacén / Sucursal', desc: 'Específico por centro de distribución' },
  { id: 'CLIENT', label: 'Cliente 3PL', desc: 'Exclusivo para una cuenta cliente' },
  { id: 'CLIENT_WAREHOUSE', label: 'Cliente × Almacén', desc: 'Regla combinada Cliente en Almacén' },
];
