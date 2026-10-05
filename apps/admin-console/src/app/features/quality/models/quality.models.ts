/**
 * @file quality.models.ts
 * @description Modelos de dominio y tipos TypeScript para el Módulo de Calidad (QM) de 4GUARD WMS.
 * Comprende:
 * 1. Bloqueo de Producto No Conforme (4 etapas de detección y 3 tipificaciones de defecto).
 * 2. Liberaciones (Dictamen formal por Cliente o Calidad 4GUARD con 3 destinos: Distribución, Destrucción, Devolución).
 * 3. Verificación de Carga Oficial F01-PO-GC-8.6-03 Rev. 03 (Instructivos IT01 e IT02).
 */

import { UnitOfMeasure } from '@4guard/shared-core';

// ─── 1. BLOQUEO DE PRODUCTO NO CONFORME ──────────────────────────

export type DetectionStage = 
  | 'INBOUND_UNLOAD'      // Detección en descarga (Recepción)
  | 'STORAGE'             // Detección en almacenamiento (Rack / Inventario)
  | 'OUTBOUND_LOAD'       // Detección en carga (Despacho / Embarque)
  | 'TEST_MATERIAL';      // Material de prueba (QA / Tratamiento especial)

export const DETECTION_STAGE_LABELS: Record<DetectionStage, string> = {
  INBOUND_UNLOAD: 'Detección en Descarga (Inbound)',
  STORAGE: 'Detección en Almacenamiento',
  OUTBOUND_LOAD: 'Detección en Carga (Outbound)',
  TEST_MATERIAL: 'Material de Prueba / QA',
};

export type DefectCategory = 
  | 'TRANSPORT'           // Defecto de transporte
  | 'DOCUMENTATION'       // Documentación incorrecta
  | 'MATERIAL'            // Defecto de material
  | 'SPECIAL_TREATMENT';  // Tratamiento especial / Prueba QA

export const DEFECT_CATEGORY_LABELS: Record<DefectCategory, string> = {
  TRANSPORT: 'Defecto de Transporte',
  DOCUMENTATION: 'Documentación Incorrecta',
  MATERIAL: 'Defecto de Material',
  SPECIAL_TREATMENT: 'Tratamiento Especial / Prueba',
};

export interface QualityBlockItem {
  id: string;
  folio: string;               // Ej. BLQ-2026-001
  sku: string;
  description: string;
  clientId: string;
  clientName: string;
  batchNumber: string;
  sscc: string;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  locationId: string;
  stage: DetectionStage;
  defectCategory: DefectCategory;
  defectCriteria: string[];     // Criterios específicos marcados (ej. 'Material con humedad', 'Caducó')
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  status: 'BLOCKED' | 'UNDER_INSPECTION' | 'RELEASED';
  reportedBy: string;
  reportedAt: string;
  notes: string;
  evidenceFiles: AttachedEvidence[];
}

export interface AttachedEvidence {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'email';
  url?: string;
  uploadedAt: string;
}

// ─── 2. LIBERACIONES Y DESTINOS ─────────────────────────────────

export type ReleaseAuthorizerType = 
  | 'CLIENT'              // Liberado por el cliente
  | 'QUALITY_4GUARD';     // Liberado por calidad 4GUARD

export type ReleaseSupportType = 
  | 'EMAIL'               // Correo electrónico
  | 'ELECTRONIC_MEDIA'    // Medios de comunicación electrónicos
  | 'FORMAL_ACT'          // Acta o dictamen formal
  | 'OTHER';              // Otro medio o soporte documental especificado

export type ReleaseDestination = 
  | 'DISTRIBUTION'        // Liberado para distribución (Disponible / Picking)
  | 'DESTRUCTION'         // Liberado para su destrucción (Merma / Baja)
  | 'RETURN';             // Liberación para devolución (Retorno a proveedor/cliente)

export const RELEASE_DESTINATION_LABELS: Record<ReleaseDestination, { label: string; desc: string; icon: string; badgeClass: string }> = {
  DISTRIBUTION: {
    label: 'Liberado para Distribución',
    desc: 'Lote apto y liberado formalmente. Retorna a estado Disponible para picking y surtido.',
    icon: 'verified',
    badgeClass: 'badge--success'
  },
  DESTRUCTION: {
    label: 'Liberado para Destrucción',
    desc: 'Producto no conforme sin rescate. Se canaliza a zona de desecho / merma con folio de baja.',
    icon: 'delete_forever',
    badgeClass: 'badge--danger'
  },
  RETURN: {
    label: 'Liberación para Devolución',
    desc: 'Rechazo comercial o logístico. Se prepara documentación de retorno a planta o proveedor.',
    icon: 'assignment_return',
    badgeClass: 'badge--warning'
  }
};

export interface QualityRelease {
  id: string;
  folio: string;               // Ej. LIB-2026-0089
  blockId: string;             // ID del bloqueo origen
  blockFolio: string;
  sku: string;
  description: string;
  batchNumber: string;
  clientName: string;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  
  // Soporte y Autorización (Diagrama 2)
  authorizerType: ReleaseAuthorizerType;
  supportType: ReleaseSupportType;
  supportCustomType?: string;  // Especificación si supportType === 'OTHER'
  supportSubject: string;      // Asunto o ID del correo
  supportFileName?: string;    // Archivo de respaldo adjunto
  authorizedByName: string;    // Nombre de quien autoriza
  authorizedByPosition: string;// Puesto del autorizador
  evidenceFiles?: AttachedEvidence[]; // Evidencia fotográfica / PDF adjunta de la autorización
  
  // Condición de destino final
  destination: ReleaseDestination;
  decisionNotes: string;
  releasedByUserId: string;
  releasedByUserName: string;
  releasedAt: string;
}

// ─── 3. VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03 REV. 03) ───────

export type CriterionValue = 'SI' | 'NO' | 'NA';

export interface VerificationCriterion {
  id: string;
  label: string;
  sublabel?: string;
  value: CriterionValue;
  actionIfNo: string;
  responsible: string;
  instructionCode?: string;    // Ej. IT02-PO-GC-8.6-02 o IT01-PO-GC-8.6-01
  observations: string;
  isCritical?: boolean;
}

export interface VerificationSignature {
  name: string;
  position?: string;
  signedAt?: string;
  isSigned: boolean;
}

export interface LoadVerification {
  id: string;
  folio: string;               // Ej. VER-2026-0042
  controlNumber: string;       // F01-PO-GC-8.6-03
  revisionNumber: string;      // 03
  revisionDate: string;        // 27/03/2026
  processName: string;         // Liberación de carga
  ownerDepartment: string;     // Seguridad e Inocuidad / Calidad
  
  // Encabezado Operativo
  remisionNumber: string;
  productDescription: string;
  clientName: string;
  date: string;                // YYYY-MM-DD
  time: string;                // HH:mm
  ramp: string;                // Rampa 01, Rampa 04, etc.
  
  // Estado del dictamen
  status: 'APROBADO' | 'RECHAZADO' | 'ACONDICIONAMIENTO_PENDIENTE' | 'LIMPIEZA_PENDIENTE' | 'EN_PROCESO';
  
  // Criterios de Producto (8 oficiales + 1 otros)
  productCriteria: VerificationCriterion[];
  
  // Criterios de Transporte (9 oficiales)
  transportCriteria: VerificationCriterion[];
  
  // Firmas Institucionales (Encabezado)
  elaboratedBy: VerificationSignature;
  reviewedBy: VerificationSignature;
  approvedBy: VerificationSignature;
  
  // Firmas de Acción y Liberación (Pie de documento)
  cleaningResponsible: VerificationSignature; // Obligatoria si palletsLimpios = 'NO' (IT01)
  releaseResponsible: VerificationSignature;  // Quien realiza la liberación de la carga
  
  generalObservations: string;
  evidencePhotos: AttachedEvidence[];
  createdAt: string;
  updatedAt: string;
}

// ─── 4. RECLAMOS E INCIDENCIAS DE CALIDAD (F01) ─────────────────

export type ClaimStage = 
  | 'INBOUND_UNLOAD'      // Descarga (Inbound)
  | 'STORAGE'             // Almacenamiento (Racks / Traspasos)
  | 'OUTBOUND_LOAD';      // Carga (Outbound / Despacho)

export const CLAIM_STAGE_LABELS: Record<ClaimStage, { label: string; icon: string; short: string }> = {
  INBOUND_UNLOAD: { label: '1. Descarga (Inbound)', icon: 'move_to_inbox', short: 'Descarga' },
  STORAGE: { label: '2. Almacenamiento (Racks)', icon: 'shelves', short: 'Racks' },
  OUTBOUND_LOAD: { label: '3. Carga (Outbound)', icon: 'local_shipping', short: 'Carga' }
};

export type ClaimDefectType = 
  | 'NON_COMPLIANT_SPEC'    // No cumple con especificación
  | 'QUANTITY_DISCREPANCY'   // Discrepancia en cantidad (Faltante / Sobrante)
  | 'BAD_CONDITIONS'         // Malas condiciones (Empaque / Tarima)
  | 'OTHER';                 // Otro (Especificar)

export const CLAIM_DEFECT_TYPE_LABELS: Record<ClaimDefectType, string> = {
  NON_COMPLIANT_SPEC: 'No cumple con especificación',
  QUANTITY_DISCREPANCY: 'Discrepancia en cantidad',
  BAD_CONDITIONS: 'Malas condiciones (Empaque / Tarima)',
  OTHER: 'Otro (Especificar)'
};

export interface QualityClaim {
  id: string;
  folio: string;               // Ej. REC-2026-0012
  date: string;                // YYYY-MM-DD
  time: string;                // HH:mm
  stage: ClaimStage;           // Descarga, Almacenamiento, Carga
  sku: string;
  productDescription: string;
  clientName: string;
  batchNumber: string;         // Lote (Campo independiente)
  remisionNumber: string;      // Remisión (Campo independiente)
  defectType: ClaimDefectType;
  defectCustomType?: string;   // Texto condicional cuando defectType === 'OTHER'
  
  // Métricas de Impacto Físico y Financiero
  damagedQty: number;          // Material Dañado (unidades / cajas)
  lostQty: number;             // Material Perdido / Merma
  associatedCost: number;      // Costo Total Asociado en MXN ($)
  currency: 'MXN' | 'USD';
  
  // Soporte y Autorización
  authorizedByName: string;
  authorizedByPosition: string;
  observations: string;
  evidenceFiles: AttachedEvidence[];
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'SETTLED';
  createdAt: string;
  updatedAt: string;
}

export interface QualityDashboardKpis {
  totalActiveBlocks: number;
  totalBlocked: number;
  totalUnderInspection: number;
  totalReleases: number;
  distributionReleases: number;
  destructionReleases: number;
  returnReleases: number;
  totalVerifications: number;
  approvedVerifications: number;
  pendingVerifications: number;
  totalClaims: number;
  totalDamagedQty: number;
  totalLostQty: number;
  totalClaimsCost: number;
}

// ─── 5. DESVIACIONES NATIVAS Y TABLERO MENSUAL DE 10 KPIS ─────────

export type QualityMaterialType = 
  | 'PRODUCTO_TERMINADO'
  | 'EMBALAJES'
  | 'CAFE_VERDE'
  | 'OTRO';

export const QUALITY_MATERIAL_TYPE_LABELS: Record<QualityMaterialType, string> = {
  PRODUCTO_TERMINADO: 'Producto Terminado (PT)',
  EMBALAJES: 'Embalajes / Empaque',
  CAFE_VERDE: 'Café Verde',
  OTRO: 'Otro Material'
};

export type QualityConditionDeviation = 
  | 'PALLET_DANADO'
  | 'INESTABLE'
  | 'PLAGA'
  | 'FRASCO_ROTO'
  | 'HUMEDAD'
  | 'TARIMA_MAL_ESTADO'
  | 'OTRO';

export const QUALITY_CONDITION_LABELS: Record<QualityConditionDeviation, string> = {
  PALLET_DANADO: 'Pallet con daños (producto expuesto / escurrimiento)',
  INESTABLE: 'Pallet visualmente inestable',
  PLAGA: 'Producto con plaga evidente',
  FRASCO_ROTO: 'Frasco roto (culinarios / envases)',
  HUMEDAD: 'Humedad / Producto mojado',
  TARIMA_MAL_ESTADO: 'Tarima en mal estado',
  OTRO: 'Otra desviación de condición'
};

export type QualityRootCause = 
  | 'MANEJO_INADECUADO'
  | 'INFRAESTRUCTURA'
  | 'PLAGAS'
  | 'LIMPIEZA'
  | 'TRANSPORTE_INTERNO'
  | 'EMPAQUE_ORIGINAL'
  | 'OTRO';

export const QUALITY_ROOT_CAUSE_LABELS: Record<QualityRootCause, string> = {
  MANEJO_INADECUADO: 'Manejo inadecuado (Mala maniobra montacargas/patín)',
  INFRAESTRUCTURA: 'Condiciones de infraestructura (Desnivel / Gotera)',
  PLAGAS: 'Plagas o fauna nociva',
  LIMPIEZA: 'Limpieza y mantenimiento insuficientes',
  TRANSPORTE_INTERNO: 'Transporte interno defectuoso (Patín/Montacargas)',
  EMPAQUE_ORIGINAL: 'Problemas en el empaque original del proveedor',
  OTRO: 'Otro motivo de causa raíz'
};

export type QualityActionTaken = 
  | 'RECHAZO_PRODUCTO'
  | 'BLOQUEO_CALIDAD'
  | 'ACONDICIONAMIENTO'
  | 'DEVOLUCION_PROVEEDOR'
  | 'DESTRUCCION'
  | 'OTRO';

export const QUALITY_ACTION_LABELS: Record<QualityActionTaken, string> = {
  RECHAZO_PRODUCTO: 'Rechazo de producto (No ingreso)',
  BLOQUEO_CALIDAD: 'Bloqueo preventivo (Cuarentena QM)',
  ACONDICIONAMIENTO: 'Acondicionamiento / Reempacado',
  DEVOLUCION_PROVEEDOR: 'Devolución formal al proveedor',
  DESTRUCCION: 'Destrucción / Merma final',
  OTRO: 'Otra acción correctiva'
};

export interface QualityDeviation {
  id: string;
  folio: string;
  remisionNumber: string;
  skuId: string;
  skuDescription?: string;
  uaCode: string;
  materialType: QualityMaterialType;
  deviationDate: string; // YYYY-MM-DD
  deviationTime: string; // HH:mm
  detectedById?: string;
  detectedByName?: string;
  responsibleCollaborator?: string;
  bayLocationCode?: string;
  damagedUnits: number;
  materialCost: number;
  currency: string;
  conditionDeviation: QualityConditionDeviation;
  rootCauseMotive: QualityRootCause;
  originArea: string;
  evidencePhotoUrls: string[];
  actionTaken: QualityActionTaken;
  observations?: string;
  isResolved: boolean;
  createdAt: string;
}

export interface CreateQualityDeviationPayload {
  remisionNumber: string;
  skuId: string;
  skuDescription?: string;
  uaCode: string;
  materialType: QualityMaterialType;
  deviationDate: string;
  deviationTime?: string;
  responsibleCollaborator?: string;
  bayLocationCode?: string;
  damagedUnits: number;
  materialCost: number;
  currency?: string;
  conditionDeviation: QualityConditionDeviation;
  rootCauseMotive: QualityRootCause;
  originArea: string;
  actionTaken: QualityActionTaken;
  observations?: string;
  evidencePhotoUrls?: string[];
}

export interface MonthlyKpiCard {
  kpiNumber: number;
  id: string;
  title: string;
  category: string;
  value: string;
  numericValue: number;
  unit: string;
  target: string;
  targetValue?: number;
  compliancePercentage?: number;
  status: 'SUCCESS' | 'WARNING' | 'DANGER' | 'INFO';
  previousMonthDiff?: number;
  trend?: 'UP' | 'DOWN' | 'STABLE';
  sublabel: string;
  sparklineData?: number[];
}

export interface QualityMonthlyBoard {
  year: number;
  month: number;
  monthName: string;
  branchName: string;
  kpiCards: MonthlyKpiCard[];
  releasesByCollaborator: Record<string, number>;
  rootCauseDistribution: Record<string, number>;
  storageDeviationsByType: Record<string, number>;
  inboundDeviationsByType: Record<string, number>;
  clientClaimsByOrigin: Record<string, number>;
  actionsTakenDistribution: Record<string, number>;
  totalInspectedLots: number;
  totalDeviations: number;
  totalDamagedPieces: number;
  ptDamagedPieces: number;
  packagingDamagedPieces: number;
  greenCoffeeDamagedPieces: number;
  totalNonQualityCost: number;
  deviations: QualityDeviation[];
}


