/**
 * @file active-shift.model.ts
 * @description Contrato del turno operativo vigente resuelto por el backend con horario de comida y pausa.
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
  mealStartTime?: string | null;
  mealEndTime?: string | null;
  mealEarlyPauseMinutes?: number | null;
  hasMealBreak?: boolean | null;
  isMealActive?: boolean | null;
  canPauseForMeal?: boolean | null;
  businessDate: string;
  branchId: string;
  branchName: string;
  timezone: string;
  configured: boolean;
  source: 'AUTO' | 'FALLBACK';
  resolvedAt: string;
}
