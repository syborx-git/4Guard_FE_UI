import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  QualityRepository,
  CreateBlockPayload,
  ReleaseBlockPayload
} from './quality.repository';
import {
  QualityBlockItem,
  QualityRelease,
  LoadVerification,
  QualityClaim,
  QualityDashboardKpis,
  VerificationCriterion,
  AttachedEvidence
} from '../models/quality.models';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class HttpQualityAdapter implements QualityRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl || (environment as any).apiUrl || ''}/api/v1/quality`;

  // ══════════════════════════════════════════════════════════════════════════
  // 1. BLOQUEOS Y PRODUCTO NO CONFORME (PNC)
  // ══════════════════════════════════════════════════════════════════════════

  getBlocks(stage?: string, status?: string): Observable<QualityBlockItem[]> {
    let params = new HttpParams();
    if (stage && stage !== 'ALL') params = params.set('stage', stage);
    if (status && status !== 'ALL') params = params.set('status', status);

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/blocks`, { params }).pipe(
      map(res => this.unwrap(res)),
      map(list => (list || []).map(b => this.mapToBlockItem(b))),
      catchError(err => this.handleError(err))
    );
  }

  getBlockById(id: string): Observable<QualityBlockItem> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/blocks/${id}`).pipe(
      map(res => this.unwrap(res)),
      map(b => this.mapToBlockItem(b)),
      catchError(err => this.handleError(err))
    );
  }

  createBlock(payload: CreateBlockPayload): Observable<QualityBlockItem> {
    const body = {
      itemId: payload.itemId && !payload.itemId.startsWith('blk-') ? payload.itemId : undefined,
      sscc: payload.sscc,
      stage: payload.stage,
      defectCategory: payload.defectCategory,
      defectCriteria: payload.defectCriteria || [],
      severity: payload.severity,
      quantity: payload.quantity,
      notes: payload.notes,
      targetLocationId: payload.targetLocationId,
      evidenceFiles: payload.evidenceFiles || []
    };

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/blocks`, body).pipe(
      map(res => this.unwrap(res)),
      map(b => this.mapToBlockItem(b)),
      catchError(err => this.handleError(err))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DICTAMEN DE LIBERACIONES Y DESTINOS
  // ══════════════════════════════════════════════════════════════════════════

  getReleases(destination?: string): Observable<QualityRelease[]> {
    let params = new HttpParams();
    if (destination && destination !== 'ALL') params = params.set('destination', destination);

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/releases`, { params }).pipe(
      map(res => this.unwrap(res)),
      map(list => (list || []).map(r => this.mapToRelease(r))),
      catchError(err => this.handleError(err))
    );
  }

  getReleaseById(id: string): Observable<QualityRelease> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/releases/${id}`).pipe(
      map(res => this.unwrap(res)),
      map(r => this.mapToRelease(r)),
      catchError(err => this.handleError(err))
    );
  }

  releaseBlock(payload: ReleaseBlockPayload): Observable<QualityRelease> {
    const body = {
      blockId: payload.blockId,
      authorizerType: payload.authorizerType,
      supportType: payload.supportType,
      supportCustomType: payload.supportCustomType,
      supportSubject: payload.supportSubject,
      supportFileName: payload.supportFileName,
      authorizedByName: payload.authorizedByName,
      authorizedByPosition: payload.authorizedByPosition,
      destination: payload.destination,
      decisionNotes: payload.decisionNotes,
      evidenceFiles: payload.evidenceFiles || []
    };

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/releases`, body).pipe(
      map(res => this.unwrap(res)),
      map(r => this.mapToRelease(r)),
      catchError(err => this.handleError(err))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. VERIFICACIÓN DE CARGA F01-PO-GC-8.6-03
  // ══════════════════════════════════════════════════════════════════════════

  getVerifications(status?: string, date?: string): Observable<LoadVerification[]> {
    let params = new HttpParams();
    if (status && status !== 'ALL') params = params.set('status', status);
    if (date) params = params.set('date', date);

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/load-verifications`, { params }).pipe(
      map(res => this.unwrap(res)),
      map(list => (list || []).map(v => this.mapToVerification(v))),
      catchError(err => this.handleError(err))
    );
  }

  getVerificationById(id: string): Observable<LoadVerification> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/load-verifications/${id}`).pipe(
      map(res => this.unwrap(res)),
      map(v => this.mapToVerification(v)),
      catchError(err => this.handleError(err))
    );
  }

  saveVerification(verification: LoadVerification): Observable<LoadVerification> {
    const formattedTime = verification.time
      ? (verification.time.length === 5 ? `${verification.time}:00` : verification.time)
      : undefined;

    const body = {
      id: verification.id && !verification.id.startsWith('ver-') ? verification.id : undefined,
      folio: verification.folio,
      controlNumber: verification.controlNumber || 'F01-PO-GC-8.6-03',
      revisionNumber: verification.revisionNumber || '03',
      remisionNumber: verification.remisionNumber,
      productDescription: verification.productDescription,
      clientName: verification.clientName,
      date: verification.date,
      time: formattedTime,
      ramp: verification.ramp,
      status: verification.status,
      productCriteria: verification.productCriteria || [],
      transportCriteria: verification.transportCriteria || [],
      signatures: {
        elaboratedBy: verification.elaboratedBy,
        reviewedBy: verification.reviewedBy,
        approvedBy: verification.approvedBy,
        cleaningResponsible: verification.cleaningResponsible,
        releaseResponsible: verification.releaseResponsible
      },
      generalObservations: verification.generalObservations || '',
      evidencePhotos: verification.evidencePhotos || []
    };

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/load-verifications`, body).pipe(
      map(res => this.unwrap(res)),
      map(v => this.mapToVerification(v)),
      catchError(err => this.handleError(err))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. RECLAMOS Y DASHBOARD KPIS
  // ══════════════════════════════════════════════════════════════════════════

  getClaims(stage?: string): Observable<QualityClaim[]> {
    let params = new HttpParams();
    if (stage && stage !== 'ALL') params = params.set('stage', stage);

    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/claims`, { params }).pipe(
      map(res => this.unwrap(res)),
      map(list => (list || []).map(c => this.mapToClaim(c))),
      catchError(err => this.handleError(err))
    );
  }

  createClaim(claim: Partial<QualityClaim>): Observable<QualityClaim> {
    const formattedTime = claim.time
      ? (claim.time.length === 5 ? `${claim.time}:00` : claim.time)
      : '00:00:00';

    const body = {
      date: claim.date || new Date().toISOString().substring(0, 10),
      time: formattedTime,
      stage: claim.stage || 'STORAGE',
      sku: claim.sku || '',
      productDescription: claim.productDescription || '',
      clientName: claim.clientName || '',
      batchNumber: claim.batchNumber || '',
      remisionNumber: claim.remisionNumber || '',
      defectType: claim.defectType || 'OTHER',
      defectCustomType: claim.defectCustomType || '',
      damagedQty: claim.damagedQty || 0,
      lostQty: claim.lostQty || 0,
      associatedCost: claim.associatedCost || 0,
      currency: claim.currency || 'MXN',
      authorizedByName: claim.authorizedByName || '',
      authorizedByPosition: claim.authorizedByPosition || '',
      observations: claim.observations || '',
      evidenceFiles: claim.evidenceFiles || []
    };

    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/claims`, body).pipe(
      map(res => this.unwrap(res)),
      map(c => this.mapToClaim(c)),
      catchError(err => this.handleError(err))
    );
  }

  getDashboardKpis(): Observable<QualityDashboardKpis> {
    return this.http.get<ApiResponse<QualityDashboardKpis>>(`${this.baseUrl}/dashboard/kpis`).pipe(
      map(res => this.unwrap(res)),
      map(kpis => ({
        totalActiveBlocks: Number(kpis.totalActiveBlocks || 0),
        totalBlocked: Number(kpis.totalBlocked || 0),
        totalUnderInspection: Number(kpis.totalUnderInspection || 0),
        totalReleases: Number(kpis.totalReleases || 0),
        distributionReleases: Number(kpis.distributionReleases || 0),
        destructionReleases: Number(kpis.destructionReleases || 0),
        returnReleases: Number(kpis.returnReleases || 0),
        totalVerifications: Number(kpis.totalVerifications || 0),
        approvedVerifications: Number(kpis.approvedVerifications || 0),
        pendingVerifications: Number(kpis.pendingVerifications || 0),
        totalClaims: Number(kpis.totalClaims || 0),
        totalDamagedQty: Number(kpis.totalDamagedQty || 0),
        totalLostQty: Number(kpis.totalLostQty || 0),
        totalClaimsCost: Number(kpis.totalClaimsCost || 0)
      })),
      catchError(err => this.handleError(err))
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPER MAPPERS & UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  private unwrap<T>(res: ApiResponse<T> | T): T {
    if (res && typeof res === 'object' && 'data' in res) {
      return (res as ApiResponse<T>).data;
    }
    return res as T;
  }

  private mapToBlockItem(b: any): QualityBlockItem {
    return {
      id: String(b.id || ''),
      folio: b.folio || '',
      sku: b.sku || '',
      description: b.skuDescription || b.description || '',
      clientId: b.clientId || '',
      clientName: b.clientName || '',
      batchNumber: b.batchNumber || '',
      sscc: b.sscc || '',
      quantity: Number(b.quantity || 0),
      unitOfMeasure: b.unitOfMeasure || 'BOX',
      locationId: b.locationCode || b.locationId || '',
      stage: b.stage || 'STORAGE',
      defectCategory: b.defectCategory || 'MATERIAL',
      defectCriteria: Array.isArray(b.defectCriteria) ? b.defectCriteria : [],
      severity: b.severity || 'INFO',
      status: b.status || 'BLOCKED',
      reportedBy: b.reportedByName || b.reportedBy || '',
      reportedAt: b.reportedAt ? String(b.reportedAt) : new Date().toISOString(),
      notes: b.notes || '',
      evidenceFiles: Array.isArray(b.evidenceFiles) ? b.evidenceFiles : []
    };
  }

  private mapToRelease(r: any): QualityRelease {
    return {
      id: String(r.id || ''),
      folio: r.folio || '',
      blockId: String(r.blockId || ''),
      blockFolio: r.blockFolio || '',
      sku: r.sku || '',
      description: r.description || '',
      batchNumber: r.batchNumber || '',
      clientName: r.clientName || '',
      quantity: Number(r.quantity || 0),
      unitOfMeasure: r.unitOfMeasure || 'BOX',
      authorizerType: r.authorizerType || 'QUALITY_4GUARD',
      supportType: r.supportType || 'FORMAL_ACT',
      supportCustomType: r.supportCustomType,
      supportSubject: r.supportSubject || '',
      supportFileName: r.supportFileName,
      authorizedByName: r.authorizedByName || '',
      authorizedByPosition: r.authorizedByPosition || '',
      destination: r.destination || 'DISTRIBUTION',
      decisionNotes: r.decisionNotes || '',
      releasedByUserId: r.releasedByUserId || '',
      releasedByUserName: r.releasedByUserName || '',
      releasedAt: r.releasedAt ? String(r.releasedAt) : new Date().toISOString(),
      evidenceFiles: Array.isArray(r.evidenceFiles) ? r.evidenceFiles : []
    };
  }

  private mapToVerification(v: any): LoadVerification {
    return {
      id: String(v.id || ''),
      folio: v.folio || '',
      controlNumber: v.controlNumber || 'F01-PO-GC-8.6-03',
      revisionNumber: v.revisionNumber || '03',
      revisionDate: '27/03/2026',
      processName: v.processName || 'Liberación de carga',
      ownerDepartment: v.ownerDepartment || 'Seguridad e Inocuidad / Calidad',
      remisionNumber: v.remisionNumber || '',
      productDescription: v.productDescription || '',
      clientName: v.clientName || '',
      date: typeof v.date === 'string' ? v.date : (v.date ? String(v.date) : new Date().toISOString().substring(0, 10)),
      time: typeof v.time === 'string' ? v.time.substring(0, 5) : '00:00',
      ramp: v.ramp || '',
      status: v.status || 'EN_PROCESO',
      productCriteria: Array.isArray(v.productCriteria) ? v.productCriteria : [],
      transportCriteria: Array.isArray(v.transportCriteria) ? v.transportCriteria : [],
      elaboratedBy: v.signatures?.elaboratedBy || v.elaboratedBy || { name: '', isSigned: false },
      reviewedBy: v.signatures?.reviewedBy || v.reviewedBy || { name: '', isSigned: false },
      approvedBy: v.signatures?.approvedBy || v.approvedBy || { name: '', isSigned: false },
      cleaningResponsible: v.signatures?.cleaningResponsible || v.cleaningResponsible || { name: 'N/A', isSigned: true },
      releaseResponsible: v.signatures?.releaseResponsible || v.releaseResponsible || { name: '', isSigned: false },
      generalObservations: v.generalObservations || '',
      evidencePhotos: Array.isArray(v.evidencePhotos) ? v.evidencePhotos : [],
      createdAt: v.createdAt ? String(v.createdAt) : new Date().toISOString(),
      updatedAt: v.updatedAt ? String(v.updatedAt) : new Date().toISOString()
    };
  }

  private mapToClaim(c: any): QualityClaim {
    return {
      id: String(c.id || ''),
      folio: c.folio || '',
      date: typeof c.date === 'string' ? c.date : (c.date ? String(c.date) : new Date().toISOString().substring(0, 10)),
      time: typeof c.time === 'string' ? c.time.substring(0, 5) : '00:00',
      stage: c.stage || 'STORAGE',
      sku: c.sku || '',
      productDescription: c.productDescription || '',
      clientName: c.clientName || '',
      batchNumber: c.batchNumber || '',
      remisionNumber: c.remisionNumber || '',
      defectType: c.defectType || 'OTHER',
      defectCustomType: c.defectCustomType,
      damagedQty: Number(c.damagedQty || 0),
      lostQty: Number(c.lostQty || 0),
      associatedCost: Number(c.associatedCost || 0),
      currency: c.currency || 'MXN',
      authorizedByName: c.authorizedByName || '',
      authorizedByPosition: c.authorizedByPosition || '',
      observations: c.observations || '',
      evidenceFiles: Array.isArray(c.evidenceFiles) ? c.evidenceFiles : [],
      status: c.status || 'OPEN',
      createdAt: c.createdAt ? String(c.createdAt) : new Date().toISOString(),
      updatedAt: c.updatedAt ? String(c.updatedAt) : new Date().toISOString()
    };
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'Ocurrió un error en el servicio de Calidad';
    if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.status === 403) {
      errorMessage = 'No tiene permisos suficientes para ejecutar esta acción de calidad (RBAC)';
    } else if (error?.status === 422) {
      errorMessage = 'Error de validación o transición inválida de estado en inventario';
    } else if (error?.message) {
      errorMessage = error.message;
    }
    console.error('[HttpQualityAdapter Error]:', error);
    return throwError(() => new Error(errorMessage));
  }
}
