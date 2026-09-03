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
  | 'FORMAL_ACT';         // Acta o dictamen formal

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
  supportSubject: string;      // Asunto o ID del correo
  supportFileName?: string;    // Archivo de respaldo adjunto
  authorizedByName: string;    // Nombre de quien autoriza
  authorizedByPosition: string;// Puesto del autorizador
  
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
