/**
 * @file carrier.model.ts
 * @description Interfaces y enums del dominio Transportistas (HU-128) — 4GUARD WMS.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ALCANCE — HU-128: Catálogo Maestro de Transportistas
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este catálogo centraliza la información general, fiscal, de contacto y
 * operativa de las empresas transportistas registradas en 4GUARD WMS.
 *
 * ── Módulos que CONSUMIRÁN este catálogo en historias posteriores ──────────
 *  • Programación de Ventanas de Recepción y Embarque
 *  • Recepción (asignación de cita a transportista)
 *  • Embarques (asignación de transportista al pedido)
 *  • Smart Gate (verificación de acceso por transportista)
 *  • Control de Patio (check-in de unidades por empresa)
 *  • Torre de Control (monitoreo de SLAs por transportista)
 *
 * ── Lo que NO incluye esta HU ─────────────────────────────────────────────
 *  NO incluye: operadores/choferes individuales, unidades vehiculares
 *  específicas, placas, NIV, asignación de rampas, geolocalización,
 *  alertas de llegada, reconocimiento de placas, notificaciones SMS/WhatsApp.
 *  Esas funciones pertenecen a módulos posteriores y consumirán este catálogo.
 */

// ─── Enums / tipos discriminados ─────────────────────────────────────────────

/** Estado operativo del transportista. No se utiliza eliminación física. */
export type CarrierStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

/** Clasificación del tipo de empresa transportista. */
export type CarrierType =
  | 'EXTERNAL'           // Transportista externo independiente
  | 'CLIENT_TRANSPORT'   // Transporte propiedad del cliente
  | 'OWN_TRANSPORT'      // Transporte propio del almacén/empresa
  | 'THIRD_PARTY_3PL'    // Proveedor logístico 3PL
  | 'PARCEL';            // Paquetería (DHL, FedEx-style, etc.)

/** Tipo de servicio de transporte ofrecido. */
export type ServiceType =
  | 'FTL'                // Full Truck Load — carga completa
  | 'LTL'                // Less than Truck Load — carga parcial
  | 'PARCEL'             // Paquetería / piezas sueltas
  | 'INTERMODAL'         // Multimodal (tierra + ferrocarril, etc.)
  | 'LAST_MILE'          // Última milla / entrega local
  | 'DEDICATED';         // Servicio dedicado exclusivo

/**
 * Capacidades generales de tipos de unidades que el transportista puede manejar.
 *
 * IMPORTANTE: Estos valores representan las CAPACIDADES GENERALES declaradas
 * por la empresa transportista, NO unidades vehiculares individuales registradas.
 * El catálogo de unidades específicas (placas, NIV, remolques, etc.) pertenece
 * al módulo de Control de Patio y Check-in de Unidades en historias posteriores.
 */
export type VehicleCapabilityType =
  | 'DRY_BOX'            // Caja seca
  | 'REFRIGERATED_BOX'   // Caja refrigerada / frigorífico
  | 'FLATBED'            // Plataforma
  | 'TORTON'             // Tortón (camión 3 ejes sin remolque)
  | 'RABON'              // Rabón (camión mediano)
  | 'TRACTOR_TRAILER'    // Tractocamión con remolque
  | 'VAN'                // Camioneta de reparto
  | 'MOTORCYCLE';        // Motocicleta (mensajería/última milla)

// ─── Modelo principal ─────────────────────────────────────────────────────────

/**
 * Entidad completa de un transportista tal como se trabaja en el frontend.
 *
 * Futuras historias de usuario podrán extender este modelo con:
 *  - Relación 1:N con unidades vehiculares registradas
 *  - Relación 1:N con operadores/choferes
 *  - KPIs de desempeño (puntualidad, incidencias, SLA)
 */
export interface Carrier {
  id: string;

  // Sección 1 — Información General
  businessName: string;          // Razón social (legal)
  tradeName: string;             // Nombre comercial (marca)
  rfc: string;                   // RFC o Tax ID fiscal
  carrierType: CarrierType;
  status: CarrierStatus;

  // Sección 2 — Contacto Principal
  contactName: string;           // Nombre del contacto principal
  phone: string;                 // Teléfono con formato validado
  email: string;                 // Correo electrónico del contacto

  // Sección 3 — Información Operativa
  serviceType: ServiceType;

  /**
   * Descripción textual de la cobertura geográfica del transportista.
   * Complementa `coverageRegions` cuando se requiere texto libre.
   */
  coverage: string;

  /**
   * Regiones o estados/entidades federativas cubiertos por el transportista.
   * Preparado para integración con un catálogo geográfico en el futuro.
   * Ejemplo: ['NL', 'CDMX', 'QRO', 'GTO']
   */
  coverageRegions?: string[];

  /** Capacidades generales de tipos de unidades que el transportista puede manejar. */
  supportedVehicleTypes: VehicleCapabilityType[];

  /**
   * Número de permiso SCT u otro registro oficial, si aplica.
   * Futuro: vincular con tabla de permisos y vigencias.
   */
  permitNumber?: string;

  /**
   * Clientes del WMS con los que este transportista trabaja de forma preferente.
   * Será consumido por el módulo de Programación de Ventanas para sugerir
   * transportistas disponibles al programar citas de un cliente específico.
   * Formato: array de nombres de cliente (legible); las relaciones reales
   * serán gestionadas por los módulos consumidores.
   */
  preferredClients?: string[];

  notes?: string;               // Observaciones operativas adicionales

  // ── Campos futuros para documentación del transportista ──────────────────
  // Los siguientes campos están preparados para ser implementados en historias
  // posteriores cuando el backend soporte el módulo de gestión documental.
  // Se incluyen comentados para facilitar la extensión del modelo:
  //
  // insurancePolicyNumber?: string;   // Número de póliza de seguro de carga
  // insuranceExpiryDate?: string;     // Fecha de vencimiento del seguro (ISO 8601)
  // insuranceCompany?: string;        // Aseguradora
  // permitExpiryDate?: string;        // Fecha de vencimiento del permiso SCT (ISO 8601)
  // certifications?: string[];        // Certificaciones (ISO, CTPAT, OEA, etc.)
  // documentUrls?: string[];          // URLs de documentos digitalizados

  // Sección 4 — Control (solo lectura)
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  createdBy: string;            // Username del creador
  updatedBy: string;            // Username del último modificador

  // Campos de auditoría de estado (cuando aplica)
  statusChangedAt?: string;     // ISO 8601 — fecha del último cambio de estado
  statusChangedBy?: string;     // Username quien realizó el cambio de estado
  statusChangeReason?: string;  // Motivo del cambio (obligatorio en suspensión/desactivación)
}

// ─── DTOs de escritura ────────────────────────────────────────────────────────

/**
 * Payload para crear un nuevo transportista.
 * POST /api/v1/carriers
 * La auditoría es generada por el backend en la misma transacción.
 */
export interface CreateCarrierRequest {
  businessName: string;
  tradeName: string;
  rfc: string;
  carrierType: CarrierType;
  status: CarrierStatus;
  contactName: string;
  phone: string;
  email: string;
  serviceType: ServiceType;
  coverage: string;
  coverageRegions?: string[];
  supportedVehicleTypes: VehicleCapabilityType[];
  permitNumber?: string;
  preferredClients?: string[];
  notes?: string;
}

/**
 * Payload para actualizar un transportista existente.
 * PUT /api/v1/carriers/{id}
 * La auditoría es generada por el backend en la misma transacción.
 */
export interface UpdateCarrierRequest extends CreateCarrierRequest {
  // El id va como path param, no en el body.
  // Incluir version si el backend implementa optimistic locking:
  // version?: number;
}

/**
 * Payload para cambiar el estado de un transportista.
 * PATCH /api/v1/carriers/{id}/status
 *
 * NOTA DE INTEGRACIÓN: El motivo es obligatorio para SUSPENDED e INACTIVE.
 * El backend valida esto y genera el registro de auditoría en la misma transacción.
 */
export interface CarrierStatusChangeRequest {
  status: CarrierStatus;
  reason: string;               // Motivo obligatorio para suspensión/desactivación
  notes?: string;               // Observaciones adicionales opcionales
}

// ─── Paginación y Ordenamiento ────────────────────────────────────────────────

/**
 * Parámetros de paginación del lado del servidor.
 * Preparado para cuando el backend exponga paginación en GET /api/v1/carriers.
 */
export interface CarrierPaginationParams {
  /** Número de página (0-indexed o 1-indexed según el backend). Ajustar al integrar. */
  page: number;
  /** Número de registros por página. */
  size: number;
}

/**
 * Parámetros de ordenamiento del lado del servidor.
 * Preparado para cuando el backend soporte ordenamiento dinámico.
 * TODO: Verificar los nombres exactos de campo aceptados por el backend en Swagger.
 */
export interface CarrierSortParams {
  field: 'tradeName' | 'businessName' | 'rfc' | 'status' | 'carrierType' | 'updatedAt' | 'createdAt';
  direction: 'ASC' | 'DESC';
}

/**
 * Parámetros completos para listar transportistas.
 * Combina filtros, paginación y ordenamiento.
 * GET /api/v1/carriers?search=...&status=...&page=...&size=...&sortBy=...&sortDir=...
 *
 * TODO: Ajustar los nombres de query params según el contrato real del Swagger.
 */
export interface CarrierListParams {
  // Filtros de búsqueda
  search?: string;              // Razón social, nombre comercial, RFC, contacto, teléfono o correo
  status?: CarrierStatus | '';
  carrierType?: CarrierType | '';
  // Paginación (servidor)
  pagination?: CarrierPaginationParams;
  // Ordenamiento (servidor)
  sort?: CarrierSortParams;
}

/**
 * Respuesta paginada del backend.
 * Preparado para cuando el backend retorne metadatos de paginación.
 * TODO: Verificar la estructura real de la respuesta en Swagger.
 */
export interface CarrierPagedResponse {
  items: Carrier[];
  totalCount: number;
  page: number;
  size: number;
  totalPages: number;
}

// ─── Filtros de búsqueda (alias para compatibilidad) ─────────────────────────

/** @deprecated Usar CarrierListParams en su lugar. Mantenido para compatibilidad. */
export interface CarrierFilters {
  search?: string;
  status?: CarrierStatus | '';
  carrierType?: CarrierType | '';
}

// ─── Auditoría — Línea de Tiempo ──────────────────────────────────────────────

/**
 * Acción de auditoría registrada por el backend.
 * Diseñada para renderizarse como una línea de tiempo visual (timeline).
 *
 * NOTA: El frontend NUNCA genera ni simula registros de auditoría.
 * Solo los consume para visualización.
 * El backend es el único responsable de crear estos registros dentro
 * de sus transacciones de escritura.
 */
export interface CarrierAuditEntry {
  id: string;
  carrierId: string;

  /** Tipo de acción realizada sobre el transportista. */
  action: 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'VIEW';

  /** Username de quien realizó la acción. */
  performedBy: string;

  /** Nombre completo del usuario (para visualización en la línea de tiempo). */
  performedByFullName?: string;

  /** Timestamp ISO 8601 de cuándo se realizó la acción. */
  performedAt: string;

  /** Valores antes del cambio (solo para UPDATE). */
  previousValues?: Partial<Carrier>;

  /** Valores después del cambio. */
  newValues?: Partial<Carrier>;

  /** Notas adicionales del registro de auditoría. */
  notes?: string;

  // ── Campos para la línea de tiempo visual ──────────────────────────────
  /**
   * Resumen legible de qué cambió.
   * Generado por el backend o calculado en el frontend al renderizar.
   * Ejemplo: "Cambió el estado de ACTIVE a SUSPENDED"
   */
  summary?: string;

  /**
   * Icono de Material Symbols para el nodo de la línea de tiempo.
   * El frontend asigna el ícono según el tipo de acción si el backend no lo provee.
   * CREATE → 'add_circle' | UPDATE → 'edit' | STATUS_CHANGE → 'swap_horiz' | VIEW → 'visibility'
   */
  timelineIcon?: string;

  /**
   * Color semántico del nodo en la línea de tiempo.
   * El frontend asigna el color según la acción si el backend no lo provee.
   */
  timelineColor?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

// ─── Respuesta genérica del backend ──────────────────────────────────────────

/**
 * Envoltorio estándar de respuesta del API de 4GUARD.
 * Alineado con el patrón ApiResponse<T> existente en user.models.ts y client.service.ts.
 */
export interface CarrierApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

// ─── Etiquetas de visualización (helpers para el template) ───────────────────

/** Mapeo de CarrierType a etiqueta legible en español. */
export const CARRIER_TYPE_LABELS: Record<CarrierType, string> = {
  EXTERNAL:        'Transportista externo',
  CLIENT_TRANSPORT:'Transporte del cliente',
  OWN_TRANSPORT:   'Transporte propio',
  THIRD_PARTY_3PL: 'Proveedor logístico 3PL',
  PARCEL:          'Paquetería',
};

/** Mapeo de ServiceType a etiqueta legible en español. */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  FTL:       'Carga completa (FTL)',
  LTL:       'Carga parcial (LTL)',
  PARCEL:    'Paquetería',
  INTERMODAL:'Multimodal',
  LAST_MILE: 'Última milla',
  DEDICATED: 'Servicio dedicado',
};

/** Mapeo de VehicleCapabilityType a etiqueta legible en español. */
export const VEHICLE_CAPABILITY_LABELS: Record<VehicleCapabilityType, string> = {
  DRY_BOX:         'Caja seca',
  REFRIGERATED_BOX:'Caja refrigerada',
  FLATBED:         'Plataforma',
  TORTON:          'Tortón',
  RABON:           'Rabón',
  TRACTOR_TRAILER: 'Tractocamión',
  VAN:             'Camioneta',
  MOTORCYCLE:      'Motocicleta',
};

/** Mapeo de CarrierStatus a etiqueta legible en español. */
export const CARRIER_STATUS_LABELS: Record<CarrierStatus, string> = {
  ACTIVE:    'Activo',
  SUSPENDED: 'Suspendido',
  INACTIVE:  'Inactivo',
};

/**
 * Mapeo de acción de auditoría al ícono de Material Symbols para la línea de tiempo.
 * Usado por el frontend cuando el backend no envía `timelineIcon`.
 */
export const AUDIT_ACTION_ICONS: Record<CarrierAuditEntry['action'], string> = {
  CREATE:        'add_circle',
  UPDATE:        'edit',
  STATUS_CHANGE: 'swap_horiz',
  VIEW:          'visibility',
};

/**
 * Mapeo de acción de auditoría al color semántico del nodo en la línea de tiempo.
 * Usado por el frontend cuando el backend no envía `timelineColor`.
 */
export const AUDIT_ACTION_COLORS: Record<CarrierAuditEntry['action'], CarrierAuditEntry['timelineColor']> = {
  CREATE:        'success',
  UPDATE:        'info',
  STATUS_CHANGE: 'warning',
  VIEW:          'neutral',
};
