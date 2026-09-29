import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  QualityBlockItem,
  QualityRelease,
  LoadVerification,
  QualityClaim,
  QualityDashboardKpis
} from '../models/quality.models';

export interface CreateBlockPayload {
  itemId?: string;
  sscc?: string;
  stage: string;
  defectCategory: string;
  defectCriteria: string[];
  severity: string;
  quantity?: number;
  notes?: string;
  targetLocationId?: string;
  evidenceFiles?: any[];
}

export interface ReleaseBlockPayload {
  blockId: string;
  authorizerType: string;
  supportType: string;
  supportCustomType?: string;
  supportSubject: string;
  supportFileName?: string;
  authorizedByName: string;
  authorizedByPosition: string;
  destination: string;
  decisionNotes: string;
  evidenceFiles?: any[];
}

export interface QualityRepository {
  // Bloqueos
  getBlocks(stage?: string, status?: string): Observable<QualityBlockItem[]>;
  getBlockById(id: string): Observable<QualityBlockItem>;
  createBlock(payload: CreateBlockPayload): Observable<QualityBlockItem>;

  // Liberaciones
  getReleases(destination?: string): Observable<QualityRelease[]>;
  getReleaseById(id: string): Observable<QualityRelease>;
  releaseBlock(payload: ReleaseBlockPayload): Observable<QualityRelease>;

  // Verificaciones F01
  getVerifications(status?: string, date?: string): Observable<LoadVerification[]>;
  getVerificationById(id: string): Observable<LoadVerification>;
  saveVerification(verification: LoadVerification): Observable<LoadVerification>;

  // Reclamos y KPIs
  getClaims(stage?: string): Observable<QualityClaim[]>;
  createClaim(claim: Partial<QualityClaim>): Observable<QualityClaim>;
  getDashboardKpis(): Observable<QualityDashboardKpis>;
}

export const QUALITY_REPOSITORY_TOKEN = new InjectionToken<QualityRepository>('QUALITY_REPOSITORY_TOKEN');
