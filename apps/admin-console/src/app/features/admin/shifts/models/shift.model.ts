/**
 * @file shift.model.ts
 * @description Modelos de dominio e interfaces DTO para la Gestión de Turnos y Horarios (HU-140).
 * Soporta configuración operativa de jornadas, selección de días de la semana,
 * tolerancia de puntualidad y cálculo de cruce de medianoche.
 */

export type OperatingDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type ShiftStatus = 'ACTIVE' | 'INACTIVE';

export interface OperatingDayConfig {
  value: OperatingDay;
  shortLabel: string;
  fullLabel: string;
}

export const OPERATING_DAYS_CONFIG: OperatingDayConfig[] = [
  { value: 'MONDAY', shortLabel: 'L', fullLabel: 'Lunes' },
  { value: 'TUESDAY', shortLabel: 'M', fullLabel: 'Martes' },
  { value: 'WEDNESDAY', shortLabel: 'X', fullLabel: 'Miércoles' },
  { value: 'THURSDAY', shortLabel: 'J', fullLabel: 'Jueves' },
  { value: 'FRIDAY', shortLabel: 'V', fullLabel: 'Viernes' },
  { value: 'SATURDAY', shortLabel: 'S', fullLabel: 'Sábado' },
  { value: 'SUNDAY', shortLabel: 'D', fullLabel: 'Domingo' },
];

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

export interface Shift {
  id: string;
  code: string;
  name: string;
  description?: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  operatingDays: OperatingDay[];
  status: ShiftStatus;
  restBreakMinutes?: number;
  toleranceMinutes?: number;
  branchId?: string;
  branchName?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  scopeType?: 'GLOBAL' | 'WAREHOUSE';
  warehouseId?: string;
}

export interface CreateShiftRequest {
  code: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  operatingDays: OperatingDay[];
  status: ShiftStatus;
  restBreakMinutes?: number;
  toleranceMinutes?: number;
  branchId?: string;
  // New optional fields
  scopeType?: 'GLOBAL' | 'WAREHOUSE';
  warehouseId?: string;
}

export interface UpdateShiftRequest {
  code: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  operatingDays: OperatingDay[];
  status: ShiftStatus;
  restBreakMinutes?: number;
  toleranceMinutes?: number;
  branchId?: string;
  // New optional fields
  scopeType?: 'GLOBAL' | 'WAREHOUSE';
  warehouseId?: string;
}

export interface ShiftFilters {
  searchTerm?: string;
  status?: ShiftStatus | 'ALL';
  day?: OperatingDay | 'ALL';
}

export interface ShiftDurationCalculation {
  hours: number;
  isOvernight: boolean;
  formattedDuration: string;
}

/**
 * Calcula la duración neta en horas de un turno manejando el cruce de medianoche (ej: 22:00 a 06:00 -> 8h).
 */
export function calculateShiftDuration(
  startTime: string,
  endTime: string,
  restBreakMinutes: number = 0
): ShiftDurationCalculation {
  if (!startTime || !endTime) {
    return { hours: 0, isOvernight: false, formattedDuration: '0 h' };
  }

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return { hours: 0, isOvernight: false, formattedDuration: '0 h' };
  }

  let startTotalMins = startH * 60 + startM;
  let endTotalMins = endH * 60 + endM;
  let isOvernight = false;

  if (endTotalMins <= startTotalMins) {
    // Si hora fin es menor o igual a inicio (y no son 00:00 exactos), cruza medianoche
    endTotalMins += 24 * 60;
    isOvernight = true;
  }

  const diffMins = endTotalMins - startTotalMins - (restBreakMinutes || 0);
  const netMins = Math.max(0, diffMins);
  const hours = parseFloat((netMins / 60).toFixed(1));

  return {
    hours,
    isOvernight,
    formattedDuration: `${hours} h`,
  };
}
