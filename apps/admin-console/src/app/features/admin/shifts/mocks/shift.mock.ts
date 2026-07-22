/**
 * @file shift.mock.ts
 * @description Datos mock temporales aislados para la Gestión de Turnos y Horarios (HU-140).
 *
 * ⚠️ IMPLEMENTACIÓN TEMPORAL DE DESARROLLO ⚠️
 * Este archivo provee datos representativos mientras el controlador Spring Boot (/api/shifts)
 * y las migraciones de base de datos en 4guard_be se integran.
 *
 * REGLA DE ARQUITECTURA: Ningún componente UI debe importar directamente este archivo.
 * Toda interacción debe pasar exclusivamente a través de ShiftService.
 */

import { Shift } from '../models/shift.model';

export const INITIAL_MOCK_SHIFTS: Shift[] = [
  {
    id: 'shf-001-matutino',
    code: 'TRN-MAT-01',
    name: 'Turno Matutino Principal',
    description: 'Jornada matutina para recepción de mercancía y operaciones de picking general.',
    startTime: '06:00',
    endTime: '14:00',
    operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    status: 'ACTIVE',
    restBreakMinutes: 30,
    toleranceMinutes: 10,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-06-10T14:30:00Z',
    updatedBy: 'Enrique Archundia (Gerente Ops)',
  },
  {
    id: 'shf-002-vespertino',
    code: 'TRN-VES-02',
    name: 'Turno Vespertino Operativo',
    description: 'Operaciones de despacho, consolidación de pedidos y surtido de andenes.',
    startTime: '14:00',
    endTime: '22:00',
    operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    status: 'ACTIVE',
    restBreakMinutes: 30,
    toleranceMinutes: 10,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-01-15T08:30:00Z',
    updatedAt: '2026-06-12T16:15:00Z',
    updatedBy: 'Carlos Mendoza (Supervisor)',
  },
  {
    id: 'shf-003-nocturno',
    code: 'TRN-NOC-03',
    name: 'Turno Nocturno Bahías',
    description: 'Reabastecimiento de ubicaciones de picking y conteos cíclicos nocturnos. Cruza medianoche.',
    startTime: '22:00',
    endTime: '06:00',
    operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    status: 'ACTIVE',
    restBreakMinutes: 45,
    toleranceMinutes: 15,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-07-01T09:00:00Z',
    updatedBy: 'Enrique Archundia (Gerente Ops)',
  },
  {
    id: 'shf-004-fds',
    code: 'TRN-FDS-04',
    name: 'Turno Fin de Semana Intensivo',
    description: 'Jornada especial de fin de semana para recepciones extraordinarias y mantenimientos.',
    startTime: '07:00',
    endTime: '19:00',
    operatingDays: ['SATURDAY', 'SUNDAY'],
    status: 'INACTIVE',
    restBreakMinutes: 60,
    toleranceMinutes: 15,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-05-20T18:00:00Z',
    updatedBy: 'Mariana López (Supervisor Ops)',
  },
  {
    id: 'shf-005-mixto',
    code: 'TRN-MIX-05',
    name: 'Turno Mixto Logística 3PL',
    description: 'Horario extendido de soporte logístico y atención a transportistas externos.',
    startTime: '08:00',
    endTime: '17:00',
    operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    status: 'ACTIVE',
    restBreakMinutes: 60,
    toleranceMinutes: 5,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-04-05T09:15:00Z',
    updatedAt: '2026-07-15T11:45:00Z',
    updatedBy: 'Carlos Mendoza (Supervisor)',
  },

  {
    id: 'shf-006-conflict',
    code: 'TRN-CON-06',
    name: 'Turno Conflictivo',
    description: 'Turno que solapa con el Matutino para pruebas de conflicto.',
    startTime: '07:00',
    endTime: '15:00',
    operatingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    status: 'ACTIVE',
    restBreakMinutes: 30,
    toleranceMinutes: 10,
    branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
    branchName: 'CENTRO DE DISTRIBUCION CDMX',
    createdAt: '2026-08-01T08:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
    updatedBy: 'Test User',
  }
];
