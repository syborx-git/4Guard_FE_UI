/**
 * @file active-shift.model.ts
 * @description Contrato del turno operativo vigente resuelto por el backend.
 * Fase 2: sessionId es null (resolución de solo lectura).
 */

export interface ActiveShiftResponse {
  sessionId: string | null;
  shiftId: string | null;
  shiftCode: string | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  isOvernight: boolean | null;
  toleranceMinutes: number | null;
  businessDate: string;
  branchId: string;
  branchName: string;
  timezone: string;
  configured: boolean;
  source: 'AUTO' | 'FALLBACK';
  resolvedAt: string;
}
