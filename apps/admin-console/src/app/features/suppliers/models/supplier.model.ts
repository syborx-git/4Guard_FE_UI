/**
 * @file supplier.model.ts
 * @description Interfaces y tipos del dominio Gestión de Proveedores (HU-125) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE — HU-125: Catálogo Maestro de Proveedores (3PL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Catálogo maestro oficial de empresas proveedoras de bienes (material de empaque,
 * tarimas, refacciones, etc.) y servicios (mantenimiento, limpieza, seguridad,
 * plagas, tecnología, transporte comercial).
 *
 * ── Módulos consumidores futuros ──────────────────────────────────────────
 *  • Recepción    • Calidad       • Inventario    • Compras
 *  • Mantenimiento• Incidencias   • Reportes      • Evaluación de Proveedores
 *
 * ── Reglas RLS y Alcance 3PL ──────────────────────────────────────────────
 *  El alcance (`scopeType`) determina la visibilidad dentro de la arquitectura 3PL:
 *   - GLOBAL:    Disponible para todos los clientes y almacenes de la organización.
 *   - CLIENT:    Asociado exclusivamente a un cliente propietario de mercancía (`clientId`).
 *   - WAREHOUSE: Asociado a una sede/almacén físico en particular (`warehouseId`).
 */

// ─── Enums / Tipos Discriminados ─────────────────────────────────────────────

/**
 * Estado operativo del proveedor.
 *
 * - ACTIVE:   Operativo y disponible para órdenes, compras y recepciones.
 * - INACTIVE: Inactivo permanente o deshabilitado por falta de uso.
 * - BLOCKED:  Bloqueo temporal por incumplimiento, auditoría o revisión de calidad.
 */
export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

/**
 * Clasificación de la categoría del proveedor.
 *
 * NOTA SOBRE 'TRANSPORT':
 * Representa al proveedor comercial/facturador de servicios de flete.
 * NO sustituye al catálogo operativo de transportistas (HU-128 / carriers)
 * que gestiona chóferes, unidades y check-in en patio.
 */
export type SupplierType =
  | 'GOODS'             // Bienes y mercancías generales
  | 'RAW_MATERIAL'      // Materias primas
  | 'PACKAGING'         // Material de empaque y embalaje
  | 'PALLETS'           // Tarimas y estibas
  | 'SPARE_PARTS'       // Refacciones y consumibles de maquinaria
  | 'TRANSPORT'         // Proveedor comercial de servicio de transporte
  | 'MAINTENANCE'       // Mantenimiento de instalaciones y equipos
  | 'CLEANING'          // Servicios de limpieza industrial
  | 'SECURITY'          // Servicios de seguridad y vigilancia
  | 'PEST_CONTROL'      // Control de plagas / Fumigación
  | 'TECHNOLOGY'        // Tecnología, software y hardware
  | 'GENERAL_SERVICES'  // Servicios generales
  | 'OTHER';            // Otros suministros o servicios

/** Alcance 3PL dentro de la organización. */
export type SupplierScope = 'GLOBAL' | 'CLIENT' | 'WAREHOUSE';

/** Moneda comercial para condiciones operativas. */
export type CurrencyCode = 'MXN' | 'USD' | 'EUR';

// ─── Sub-estructuras ──────────────────────────────────────────────────────────

/** Información de contacto principal del proveedor. */
export interface SupplierContact {
  fullName: string;
  jobTitle?: string;
  email: string;
  phone: string;
  altPhone?: string;
}

/** Dirección física o fiscal del proveedor. */
export interface SupplierAddress {
  country: string;
  state: string;
  municipality?: string;
  city: string;
  postalCode?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
}

/**
 * Condiciones comerciales y operativas.
 *
 * - leadTimeDays: "Tiempo de entrega" para bienes / "Tiempo de respuesta" para servicios.
 * - minimumOrderAmount: Monto mínimo de pedido en la moneda especificada.
 */
export interface SupplierCommercialTerms {
  leadTimeDays: number;         // >= 0
  minimumOrderAmount: number;   // >= 0 (Monto mínimo de pedido)
  creditDays: number;           // >= 0
  currency: CurrencyCode;
  qualityInspectionRequired: boolean;
}

// ─── Modelo Principal ─────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  code: string;                 // Código único formato PRV-0001

  legalName: string;            // Razón social fiscal
  commercialName?: string;      // Nombre comercial / Marca
  taxId: string;                // RFC (México) o Tax ID fiscal

  type: SupplierType;
  status: SupplierStatus;

  /** Motivo obligatorio cuando el estado es BLOCKED o INACTIVE. */
  statusReason?: string;
  statusChangedAt?: string;     // ISO 8601
  statusChangedBy?: string;     // Username del operador que cambió el estado

  preferred: boolean;           // Proveedor preferente

  contact: SupplierContact;
  address?: SupplierAddress;
  commercialTerms: SupplierCommercialTerms;

  scopeType: SupplierScope;
  clientId?: string;            // Requerido si scopeType === 'CLIENT'
  clientName?: string;          // Nombre legible para UI
  warehouseId?: string;         // Requerido si scopeType === 'WAREHOUSE'
  warehouseName?: string;       // Nombre legible para UI

  notes?: string;

  /** Indicadores de estado lógico (nunca se borra físicamente). */
  active: boolean;
  deleted: boolean;

  // Auditoría (solo lectura desde backend o mock, no modificables en el formulario)
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  createdBy?: string;
  updatedBy?: string;
  lastAction?: string;          // Descripción de la última acción registrada
}

// ─── DTOs de Escritura ────────────────────────────────────────────────────────

export interface CreateSupplierRequest {
  code?: string;
  legalName: string;
  commercialName?: string;
  taxId: string;
  type: SupplierType;
  status: SupplierStatus;
  statusReason?: string;
  preferred: boolean;
  contact: SupplierContact;
  address?: SupplierAddress;
  commercialTerms: SupplierCommercialTerms;
  scopeType: SupplierScope;
  clientId?: string;
  clientName?: string;
  warehouseId?: string;
  warehouseName?: string;
  notes?: string;
}

export interface UpdateSupplierRequest extends CreateSupplierRequest {}

export interface SupplierStatusChangeRequest {
  status: SupplierStatus;
  reason: string;
}

// ─── Parámetros de Lista y Filtros ───────────────────────────────────────────

export interface SupplierListParams {
  search?: string;
  status?: SupplierStatus | '';
  type?: SupplierType | '';
  scopeType?: SupplierScope | '';
  clientId?: string | '';
  warehouseId?: string | '';
  preferredOnly?: boolean;
}

// ─── Envoltorio de Respuesta ─────────────────────────────────────────────────

export interface SupplierApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

// ─── Mapas de Etiquetas ───────────────────────────────────────────────────────

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  GOODS:            'Bienes y mercancías',
  RAW_MATERIAL:     'Materia prima',
  PACKAGING:        'Material de empaque',
  PALLETS:          'Tarimas y estibas',
  SPARE_PARTS:      'Refacciones',
  TRANSPORT:        'Servicios de transporte (comercial)',
  MAINTENANCE:      'Mantenimiento',
  CLEANING:         'Limpieza industrial',
  SECURITY:         'Seguridad y vigilancia',
  PEST_CONTROL:     'Control de plagas / Fumigación',
  TECHNOLOGY:       'Tecnología y sistemas',
  GENERAL_SERVICES: 'Servicios generales',
  OTHER:            'Otros suministros',
};

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE:   'Activo',
  INACTIVE: 'Inactivo',
  BLOCKED:  'Bloqueado',
};

export const SUPPLIER_SCOPE_LABELS: Record<SupplierScope, string> = {
  GLOBAL:    'Global (Toda la org)',
  CLIENT:    'Específico de Cliente',
  WAREHOUSE: 'Específico de Almacén',
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  MXN: 'Pesos Mexicanos (MXN)',
  USD: 'Dólares US (USD)',
  EUR: 'Euros (EUR)',
};

// ─── Helpers de Clasificación ────────────────────────────────────────────────

/** Determina si una categoría de proveedor corresponde a un servicio. */
export function isServiceSupplier(type: SupplierType): boolean {
  const serviceTypes: SupplierType[] = [
    'TRANSPORT',
    'MAINTENANCE',
    'CLEANING',
    'SECURITY',
    'PEST_CONTROL',
    'TECHNOLOGY',
    'GENERAL_SERVICES',
  ];
  return serviceTypes.includes(type);
}

/** Retorna la etiqueta adecuada para `leadTimeDays` según la categoría. */
export function getLeadTimeLabel(type: SupplierType): string {
  return isServiceSupplier(type) ? 'Tiempo de respuesta (días)' : 'Tiempo de entrega (días)';
}

/** Normaliza un código o RFC removiendo espacios, guiones y convirtiendo a mayúsculas. */
export function normalizeCodeOrTaxId(value: string): string {
  if (!value) return '';
  return value.trim().replace(/[\s\-]/g, '').toUpperCase();
}
