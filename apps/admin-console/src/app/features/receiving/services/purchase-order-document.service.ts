/**
 * @file purchase-order-document.service.ts
 * @description Servicio de Gestión Documental de Orden de Compra [HU-029 EVOLUCIÓN V2].
 * Administra expedientes, versionado inalterable, RBAC basado en Capacidades y Auditoría Documental.
 * Desacoplado de localStorage para integración transparente con Backend (Document API + Storage).
 */

import { Injectable, signal, inject } from '@angular/core';
import { AuthState } from '../../../core/auth/auth.state';
import { PurchaseOrderValidationService } from './purchase-order-validation.service';
import {
  PODocumentRecord,
  PODocumentVersion,
  DocumentCapability,
} from '../models/purchase-order.models';

export interface FileUploadPayload {
  fileName: string;
  fileSizeFormatted: string;
  fileType: 'PDF' | 'IMAGE';
  mimeType: string;
  fileUrl?: string;
  source: 'MANUAL_UPLOAD' | 'CAMERA_CAPTURE' | 'ERP_INTEGRATION';
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrderDocumentService {
  private readonly authState = inject(AuthState);
  private readonly poValidationService = inject(PurchaseOrderValidationService);

  // Matriz de Capacidades Documentales (RBAC Desacoplado de Roles Fijos)
  private readonly CAPABILITY_MATRIX: Record<string, DocumentCapability[]> = {
    ADMIN: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY', 'DOCUMENT_DELETE'],
    MANAGER: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY', 'DOCUMENT_DELETE'],
    OPERATIONS_MANAGER: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY'],
    SHIFT_LEADER: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY'],
    OPERATIONS_SUPERVISOR: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY'],
    SUPERVISOR: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD', 'DOCUMENT_DOWNLOAD', 'DOCUMENT_REPLACE', 'DOCUMENT_VERSION_HISTORY'],
    WAREHOUSE_OPERATOR: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'],
    OPERATOR: ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'],
    MANEUVER_OPERATOR: [], // Sin acceso por defecto
  };

  // Semilla in-memory de expedientes documentales (Demostración Enterprise)
  private readonly _documentsMap = signal<Record<string, PODocumentRecord>>({
    'PO-2026-8801': {
      poNumber: 'PO-2026-8801',
      appointmentId: 'APT-0001',
      branchId: 'SUC-001',
      currentVersionNumber: 1,
      activeVersion: {
        id: 'DOCVER-8801-v1',
        versionNumber: 1,
        versionLabel: 'v1',
        fileName: 'PO-2026-8801_Firmada_Nestle.pdf',
        fileSizeFormatted: '2.4 MB',
        fileType: 'PDF',
        mimeType: 'application/pdf',
        uploadedBy: 'Carlos Mendoza (OPERATIONS_SUPERVISOR)',
        userRole: 'OPERATIONS_SUPERVISOR',
        uploadedAt: '2026-07-29T14:15:00.000Z',
        source: 'MANUAL_UPLOAD',
      },
      versionsHistory: [
        {
          id: 'DOCVER-8801-v1',
          versionNumber: 1,
          versionLabel: 'v1',
          fileName: 'PO-2026-8801_Firmada_Nestle.pdf',
          fileSizeFormatted: '2.4 MB',
          fileType: 'PDF',
          mimeType: 'application/pdf',
          uploadedBy: 'Carlos Mendoza (OPERATIONS_SUPERVISOR)',
          userRole: 'OPERATIONS_SUPERVISOR',
          uploadedAt: '2026-07-29T14:15:00.000Z',
          source: 'MANUAL_UPLOAD',
        },
      ],
      createdAt: '2026-07-29T14:15:00.000Z',
      updatedAt: '2026-07-29T14:15:00.000Z',
    },
  });

  readonly documentsMap = this._documentsMap.asReadonly();

  /**
   * Consulta si el rol del usuario cuenta con una capacidad documental específica.
   */
  hasCapability(capability: DocumentCapability, roleOverride?: string): boolean {
    const userRole = (roleOverride || this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const capabilities = this.CAPABILITY_MATRIX[userRole] || ['DOCUMENT_VIEW', 'DOCUMENT_UPLOAD'];
    return capabilities.includes(capability);
  }

  /**
   * Obtiene el expediente documental asociado a una Orden de Compra.
   */
  getDocumentRecord(poNumber: string): PODocumentRecord | undefined {
    if (!poNumber) return undefined;
    return this._documentsMap()[poNumber.trim().toUpperCase()];
  }

  /**
   * Carga y asocia el primer documento de una Orden de Compra (Versión v1).
   */
  uploadInitialDocument(
    poNumber: string,
    appointmentId: string,
    branchId: string,
    payload: FileUploadPayload
  ): PODocumentRecord {
    if (!this.hasCapability('DOCUMENT_UPLOAD')) {
      throw new Error('Acceso Denegado: No cuentas con la capacidad DOCUMENT_UPLOAD para asociar documentos.');
    }

    const sessionUser = this.authState.currentUser();
    const userRole = (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const userName = sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER';

    const now = new Date().toISOString();

    const version1: PODocumentVersion = {
      id: `DOCVER-${Date.now()}-v1`,
      versionNumber: 1,
      versionLabel: 'v1',
      fileName: payload.fileName,
      fileSizeFormatted: payload.fileSizeFormatted,
      fileType: payload.fileType,
      mimeType: payload.mimeType,
      fileUrl: payload.fileUrl,
      uploadedBy: `${userName} (${userRole})`,
      userRole,
      uploadedAt: now,
      source: payload.source,
    };

    const record: PODocumentRecord = {
      poNumber: poNumber.trim().toUpperCase(),
      appointmentId,
      branchId,
      currentVersionNumber: 1,
      activeVersion: version1,
      versionsHistory: [version1],
      createdAt: now,
      updatedAt: now,
    };

    this._documentsMap.update((map) => ({ ...map, [record.poNumber]: record }));

    // Registrar auditoría documental
    this._logDocumentAudit({
      appointmentId,
      poNumber,
      action: 'DOCUMENT_UPLOADED',
      performedBy: userName,
      userRole,
      reason: `Asociación inicial de documento v1 (${payload.fileName}, ${payload.fileSizeFormatted})`,
    });

    return record;
  }

  /**
   * Reemplaza el documento actual generando una nueva versión inalterable (v2, v3...).
   */
  replaceDocumentVersion(
    poNumber: string,
    appointmentId: string,
    changeReason: string,
    payload: FileUploadPayload
  ): PODocumentRecord {
    if (!this.hasCapability('DOCUMENT_REPLACE')) {
      throw new Error('Acceso Denegado: No cuentas con la capacidad DOCUMENT_REPLACE para reemplazar documentos.');
    }

    if (!changeReason || changeReason.trim().length < 10) {
      throw new Error('El motivo del reemplazo de versión es obligatorio (mínimo 10 caracteres).');
    }

    const poKey = poNumber.trim().toUpperCase();
    const existing = this._documentsMap()[poKey];
    if (!existing) {
      throw new Error('No existe un expediente previo para reemplazar. Use la carga inicial.');
    }

    const sessionUser = this.authState.currentUser();
    const userRole = (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const userName = sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER';

    const nextVerNum = existing.currentVersionNumber + 1;
    const now = new Date().toISOString();

    const newVersion: PODocumentVersion = {
      id: `DOCVER-${Date.now()}-v${nextVerNum}`,
      versionNumber: nextVerNum,
      versionLabel: `v${nextVerNum}`,
      fileName: payload.fileName,
      fileSizeFormatted: payload.fileSizeFormatted,
      fileType: payload.fileType,
      mimeType: payload.mimeType,
      fileUrl: payload.fileUrl,
      uploadedBy: `${userName} (${userRole})`,
      userRole,
      uploadedAt: now,
      changeReason: changeReason.trim(),
      source: payload.source,
    };

    const updatedRecord: PODocumentRecord = {
      ...existing,
      currentVersionNumber: nextVerNum,
      activeVersion: newVersion,
      versionsHistory: [newVersion, ...existing.versionsHistory],
      updatedAt: now,
    };

    this._documentsMap.update((map) => ({ ...map, [poKey]: updatedRecord }));

    // Registrar auditoría documental
    this._logDocumentAudit({
      appointmentId,
      poNumber,
      action: 'DOCUMENT_REPLACED',
      performedBy: userName,
      userRole,
      reason: `Nueva versión v${nextVerNum} creada (${payload.fileName}). Motivo: ${changeReason.trim()}`,
    });

    return updatedRecord;
  }

  /**
   * Restaura una versión histórica previa como la versión activa.
   */
  restoreDocumentVersion(poNumber: string, appointmentId: string, versionNumber: number): PODocumentRecord {
    if (!this.hasCapability('DOCUMENT_VERSION_HISTORY')) {
      throw new Error('Acceso Denegado: No cuentas con la capacidad para consultar o restaurar versiones.');
    }

    const poKey = poNumber.trim().toUpperCase();
    const existing = this._documentsMap()[poKey];
    if (!existing) {
      throw new Error('Expediente no encontrado.');
    }

    const targetVersion = existing.versionsHistory.find((v) => v.versionNumber === versionNumber);
    if (!targetVersion) {
      throw new Error(`La versión v${versionNumber} no existe en el historial.`);
    }

    const sessionUser = this.authState.currentUser();
    const userRole = (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const userName = sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER';

    const updatedRecord: PODocumentRecord = {
      ...existing,
      activeVersion: targetVersion,
      updatedAt: new Date().toISOString(),
    };

    this._documentsMap.update((map) => ({ ...map, [poKey]: updatedRecord }));

    this._logDocumentAudit({
      appointmentId,
      poNumber,
      action: 'DOCUMENT_VERSION_RESTORED',
      performedBy: userName,
      userRole,
      reason: `Se restauró la vista previa activa a la versión histórica v${versionNumber}`,
    });

    return updatedRecord;
  }

  /** Registra auditoría cuando se abre o visualiza el documento original */
  logDocumentViewed(poNumber: string, appointmentId: string): void {
    const sessionUser = this.authState.currentUser();
    const userRole = (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const userName = sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER';

    this._logDocumentAudit({
      appointmentId,
      poNumber,
      action: 'DOCUMENT_VIEWED',
      performedBy: userName,
      userRole,
      reason: `Consulta de expediente documental original en visor`,
    });
  }

  /** Registra auditoría cuando se descarga el documento */
  logDocumentDownloaded(poNumber: string, appointmentId: string, fileName: string): void {
    if (!this.hasCapability('DOCUMENT_DOWNLOAD')) {
      throw new Error('Acceso Denegado: No cuentas con la capacidad DOCUMENT_DOWNLOAD para descargar el archivo.');
    }

    const sessionUser = this.authState.currentUser();
    const userRole = (this.authState.role() || 'OPERATIONS_MANAGER').toUpperCase();
    const userName = sessionUser?.fullName || sessionUser?.username || 'OPERATIONS_MANAGER';

    this._logDocumentAudit({
      appointmentId,
      poNumber,
      action: 'DOCUMENT_DOWNLOADED',
      performedBy: userName,
      userRole,
      reason: `Descarga de archivo original (${fileName})`,
    });
  }

  private _logDocumentAudit(params: {
    appointmentId: string;
    poNumber: string;
    action: import('../models/purchase-order.models').POAuditAction;
    performedBy: string;
    userRole: string;
    reason: string;
  }): void {
    const validation = this.poValidationService.validationsMap()[params.appointmentId];

    // Reutiliza el logger del servicio principal para mantener bitácora unificada
    (this.poValidationService as any)._logAudit({
      appointmentId: params.appointmentId,
      poNumber: params.poNumber,
      action: params.action,
      performedBy: params.performedBy,
      userRole: params.userRole,
      previousStatus: validation?.validationStatus || 'PENDING',
      newStatus: validation?.validationStatus || 'PENDING',
      calculatedOutcome: validation?.calculatedOutcome || 'MATCH',
      overallMatchPercent: validation?.overallMatchPercent || 100,
      discrepancies: validation?.discrepancies || [],
      reason: params.reason,
      sourceFingerprint: validation?.sourceFingerprint || `DOC-${Date.now()}`,
    });
  }
}
