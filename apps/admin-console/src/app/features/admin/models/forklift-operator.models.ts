/**
 * @file forklift-operator.models.ts
 * @description Modelos e interfaces para la Administración de Montacarguistas (Administrar -> Montacarguistas).
 * Maneja datos generales: Nombres, Apellidos, Licencia DC-3, Vencimiento, Turno Asignado y Estatus.
 */

export type LicenseStatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA';

export interface ForkliftOperator {
  id: string;
  code: string; // e.g. MC-101
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  fullName: string;
  licenseNumberDc3: string;
  licenseExpirationDate: string; // YYYY-MM-DD
  licenseStatus: LicenseStatus;
  shift: string; // e.g. Turno 1 - Matutino (06:00 - 14:00)
  status: 'ACTIVO' | 'INACTIVO';
  createdAt: string;
}

export interface CreateForkliftOperatorDto {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  licenseNumberDc3: string;
  licenseExpirationDate: string;
  shift: string;
}

export function calculateLicenseStatus(expirationDateIso: string): LicenseStatus {
  if (!expirationDateIso) return 'VIGENTE';
  const exp = new Date(expirationDateIso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

  if (diffDays < 0) return 'VENCIDA';
  if (diffDays <= 30) return 'POR_VENCER';
  return 'VIGENTE';
}
