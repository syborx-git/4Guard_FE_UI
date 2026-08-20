/**
 * @file forklift-catalog.models.ts
 * @description Modelos e interfaces para el Catálogo de Montacarguistas y Scorecard de Rendimiento.
 * Soporta remoción física (Hard Delete) por alta rotación y evaluación de licencias.
 */

export type LicenseStatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA';

export interface ForkliftOperatorScorecard {
  movementsThisMonth: number;
  locationAccuracyPercentage: number; // e.g. 98.5
  safetyRating: number; // 1-5 stars or rating
  shift: string;
}

export interface ForkliftOperator {
  id: string;
  employeeCode: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  fullName: string;
  hireDate: string;
  licenseNumber: string;
  licenseExpirationDate: string;
  licenseStatus: LicenseStatus;
  scorecard: ForkliftOperatorScorecard;
  status: 'ACTIVO' | 'INACTIVO';
}

export interface CreateForkliftOperatorDto {
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  licenseNumber: string;
  licenseExpirationDate: string;
  shift?: string;
}

export function calculateLicenseStatus(expirationDateIso: string): LicenseStatus {
  const exp = new Date(expirationDateIso);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
  
  if (diffDays < 0) return 'VENCIDA';
  if (diffDays <= 30) return 'POR_VENCER';
  return 'VIGENTE';
}
