/**
 * @file forklift-operator.models.ts
 * @description Modelos e interfaces para la Gestión de Montacarguistas (HU-142).
 *
 * Homologados con los DTOs del Backend (4guard_be):
 *   - ForkliftOperatorResponse   ← GET /api/v1/forklift-operators
 *   - CreateForkliftOperatorRequest ← POST /api/v1/forklift-operators
 *   - UpdateForkliftOperatorRequest ← PUT /api/v1/forklift-operators/{id}
 *   - UpdateForkliftOperatorStatusRequest ← PATCH /api/v1/forklift-operators/{id}/status
 *   - ForkliftOperatorAuditEntry ← GET /api/v1/forklift-operators/{id}/audit
 */

/** Vigencia de la certificación DC-3. Calculada automáticamente en el Backend. */
export type LicenseStatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA';

/** Estatus operativo del montacarguista en el catálogo. */
export type ForkliftOperatorStatus = 'ACTIVO' | 'INACTIVO';

/**
 * Modelo completo de un Montacarguista.
 * Homologado con {@code ForkliftOperatorResponse} del Backend.
 */
export interface ForkliftOperator {
  id: string;
  organizationId: string;
  organizationName?: string;
  branchId?: string;
  branchName?: string;

  /** Código operativo auto-generado: MC-001, MC-002, etc. */
  code: string;

  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;

  /** Concatenación: firstName + lastNamePaternal + lastNameMaternal. Calculado en el Backend. */
  fullName: string;

  /** Número de certificación ante la STPS (DC-3). */
  licenseNumberDc3: string;

  /** Fecha de vencimiento ISO: YYYY-MM-DD. */
  licenseExpirationDate: string;

  /** Vigencia de la licencia. Calculada automáticamente por el Backend. */
  licenseStatus: LicenseStatus;

  /** UUID del turno asignado del catálogo maestro de turnos. */
  shiftId?: string;

  /** Nombre del turno para visualización rápida. */
  shift: string;    // mantener como `shift` para compatibilidad con la plantilla HTML existente

  status: ForkliftOperatorStatus;

  version?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Request DTOs ──────────────────────────────────────────────────────────────

/**
 * DTO para crear un nuevo Montacarguista.
 * El código (MC-XXX) es generado por el Backend.
 */
export interface CreateForkliftOperatorRequest {
  organizationId: string;
  branchId?: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  licenseNumberDc3: string;
  licenseExpirationDate: string; // YYYY-MM-DD
  shiftId?: string;
}

/** DTO para actualizar datos de un Montacarguista existente. */
export interface UpdateForkliftOperatorRequest {
  id: string;
  organizationId: string;
  branchId?: string;
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal: string;
  licenseNumberDc3: string;
  licenseExpirationDate: string; // YYYY-MM-DD
  shiftId?: string;
  version?: number;
}

/** DTO para cambiar el estatus ACTIVO/INACTIVO. */
export interface UpdateForkliftOperatorStatusRequest {
  status: ForkliftOperatorStatus;
  reason?: string;
  observations?: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface ForkliftOperatorAuditDetail {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ForkliftOperatorAuditEntry {
  logId: string;
  action: string;
  username: string;
  createdAt: string;
  details: ForkliftOperatorAuditDetail[];
}

// ─── Legacy CreateForkliftOperatorDto (kept for template compatibility) ────────
/** @deprecated Use {@link CreateForkliftOperatorRequest} directly. */
export type CreateForkliftOperatorDto = Omit<CreateForkliftOperatorRequest, 'organizationId' | 'branchId'> & {
  shift: string;
};

// ─── Utility (kept for FE-side display fallback only — licenseStatus now comes from BE) ──

/**
 * Client-side fallback to compute license status from a date string.
 * The authoritative value always comes from the Backend.
 */
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
