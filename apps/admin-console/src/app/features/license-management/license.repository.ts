/**
 * @file license.repository.ts
 * @description Contrato de repositorio (Port) para Gestión de Licencias WMS (HU-139).
 * Estándar SDOP — SyborX.
 */

import { Observable } from 'rxjs';
import {
  WmsLicense,
  LicenseRenewalPayload,
  ServiceResult,
} from './license-management.models';

export interface ILicenseRepository {
  /** Retorna todas las licencias */
  getLicenses(): Observable<ServiceResult<WmsLicense[]>>;

  /** Retorna una licencia por ID */
  getLicenseById(id: string): Observable<ServiceResult<WmsLicense>>;

  /** Crea una nueva licencia */
  createLicense(
    payload: Omit<WmsLicense, 'id' | 'createdAt' | 'updatedAt' | 'licenseKey' | 'maskedLicenseKey'>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>>;

  /** Actualiza datos generales de una licencia */
  updateLicense(
    id: string,
    payload: Partial<WmsLicense>,
    changedFields: Record<string, { previous: unknown; current: unknown }>,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>>;

  /** Renueva la vigencia de una licencia */
  renewLicense(
    id: string,
    payload: LicenseRenewalPayload,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>>;

  /** Suspende una licencia */
  suspendLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>>;

  /** Reactiva una licencia */
  reactivateLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>>;

  /** Revoca una licencia */
  revokeLicense(id: string, reason: string, performedBy: string): Observable<ServiceResult<WmsLicense>>;

  /** Regenera la clave de licencia */
  regenerateLicenseKey(
    id: string,
    reason: string,
    performedBy: string
  ): Observable<ServiceResult<WmsLicense>>;

  /** Obtiene la bitácora de auditoría */
  getLicenseAudit(id: string): Observable<unknown>;
}
