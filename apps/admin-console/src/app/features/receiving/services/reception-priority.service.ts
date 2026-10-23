/**
 * @file reception-priority.service.ts
 * @description Servicio de Dominio Puro para Motor de Priorización Operativa y Reglas de Negocio [HU-026].
 * No mantiene estado propio en localStorage. Todo el estado reside en ReceptionAppointmentService.
 */

import { Injectable } from '@angular/core';
import {
  ReceptionAppointment,
  PriorityLevel,
  AppointmentStatus,
} from '../models/reception-appointment.models';
import {
  PrioritySuggestion,
  PriorityFactorResult,
  PrioritySource,
  PriorityReasonCode,
  OperationalAvailability,
  ReceptionPriorityDecision,
} from '../models/reception-priority.models';

@Injectable({ providedIn: 'root' })
export class ReceptionPriorityService {
  /**
   * Calcula la disponibilidad operativa dinámica de la cita.
   * Depende de los estados reales (status, poValidationStatus, arrivalClearanceStatus) sin persistirse.
   */
  calculateOperationalAvailability(appointment: ReceptionAppointment): OperationalAvailability {
    if (appointment.status === 'IN_RECEIVING') {
      return 'IN_RECEIVING';
    }

    // Evaluar bloqueos estrictos de OC o Check-In
    const isPOBlocked = appointment.poValidationStatus === 'REJECTED';
    const isCheckInBlocked = appointment.arrivalClearanceStatus === 'BLOCKED' || appointment.arrivalClearanceStatus === 'REJECTED_AT_GATE';

    if (isPOBlocked || isCheckInBlocked) {
      return 'BLOCKED';
    }

    // Evaluar necesidades de revisión o incidencias
    const isPODiff = appointment.poValidationStatus === 'EXCEPTED';
    const isCheckInReview = appointment.arrivalClearanceStatus === 'REVIEW_REQUIRED' || appointment.arrivalClearanceStatus === 'WARNING_CLEARED';
    const hasIncidents = (appointment.openArrivalIncidentsCount ?? 0) > 0;

    if (isPODiff || isCheckInReview || hasIncidents) {
      return 'REVIEW_REQUIRED';
    }

    // Evaluar estados del flujo de arribo y caseta
    if (appointment.status === 'ARRIVED') {
      // Si ya arribó a patio, verificar si su OC ya fue validada/aprobada o no requerida
      const isPOValid =
        appointment.poValidationStatus === 'VALIDATED' ||
        appointment.poValidationStatus === 'NOT_REQUIRED' ||
        appointment.poValidationStatus === 'EXCEPTED';

      const isCheckInCleared =
        appointment.arrivalClearanceStatus === 'CLEARED' ||
        appointment.arrivalClearanceStatus === 'WARNING_CLEARED';

      if (isPOValid && isCheckInCleared) {
        return 'READY';
      }
      if (!isPOValid) {
        return 'WAITING_DOCUMENTS';
      }
      return 'WAITING_CHECKIN';
    }

    // Para citas aún no arribadas (SCHEDULED, CONFIRMED, DRAFT)
    if (appointment.poValidationStatus === 'PENDING') {
      return 'WAITING_DOCUMENTS';
    }

    if (!appointment.arrivalClearanceStatus) {
      return 'WAITING_CHECKIN';
    }

    return 'READY';
  }

  /**
   * Motor Explicable de Sugerencia Automática.
   * Calcula el puntaje basándose en información real disponible en la cita.
   */
  calculateSuggestedPriority(appointment: ReceptionAppointment): PrioritySuggestion {
    const factors: PriorityFactorResult[] = [];
    let totalScore = 0;

    // 1. Prioridad Declarada Inicial
    let declaredPoints = 0;
    if (appointment.priority === 'HIGH') {
      declaredPoints = 20;
    } else if (appointment.priority === 'URGENT') {
      declaredPoints = 40;
    }
    if (declaredPoints > 0) {
      factors.push({
        code: 'INITIAL_DECLARED_PRIORITY',
        points: declaredPoints,
        valueText: appointment.priority,
      });
      totalScore += declaredPoints;
    }

    // 2. Retraso sobre Hora Programada
    const now = new Date();
    const scheduledDateTime = this._parseScheduledDateTime(appointment.scheduledDate, appointment.scheduledTime);
    if (scheduledDateTime && now > scheduledDateTime && appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED') {
      const delayMinutes = Math.floor((now.getTime() - scheduledDateTime.getTime()) / (1000 * 60));
      if (delayMinutes > 15) {
        // 0.5 puntos por cada minuto de retraso sobre 15 min (máx 40 pts)
        const delayPoints = Math.min(40, Math.floor(delayMinutes * 0.5));
        factors.push({
          code: 'APPOINTMENT_SCHEDULE_DELAY',
          points: delayPoints,
          valueNumeric: delayMinutes,
        });
        totalScore += delayPoints;
      }
    }

    // 3. Tiempo de Espera en Sitio (si ya registró arribo)
    if (appointment.arrivalData?.arrivedAt) {
      const arrivedDate = new Date(appointment.arrivalData.arrivedAt);
      if (!isNaN(arrivedDate.getTime()) && appointment.status === 'ARRIVED') {
        const waitMinutes = Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60));
        if (waitMinutes > 15) {
          const waitPoints = Math.min(30, Math.floor(waitMinutes * 0.5));
          factors.push({
            code: 'PATIO_WAITING_TIME',
            points: waitPoints,
            valueNumeric: waitMinutes,
          });
          totalScore += waitPoints;
        }
      }
    }

    // 4. Peso por Tipo de Recepción
    if (appointment.receptionType === 'IMPORT') {
      factors.push({
        code: 'RECEPTION_TYPE_WEIGHT',
        points: 10,
        valueText: 'Importación',
      });
      totalScore += 10;
    }

    // Mapeo de puntaje a nivel de prioridad sugerida
    let suggestedLevel: PriorityLevel = 'NORMAL';
    if (totalScore >= 60) {
      suggestedLevel = 'URGENT';
    } else if (totalScore >= 30) {
      suggestedLevel = 'HIGH';
    }

    return {
      priority: suggestedLevel,
      score: totalScore,
      factors,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Evalúa dinámicamente si una decisión de override manual sigue vigente.
   */
  isPriorityOverrideActive(
    decision?: ReceptionPriorityDecision,
    now: Date = new Date(),
    appointment?: ReceptionAppointment
  ): boolean {
    if (!decision || decision.source !== 'MANUAL') {
      return false;
    }

    // Si ya fue revertida explícitamente
    if (decision.revertedAt) {
      return false;
    }

    // Si la recepción ya inició o terminó, la vigencia 'UNTIL_RECEIVING_START' o la vigencia general termina
    if (appointment && (appointment.status === 'IN_RECEIVING' || appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED')) {
      return false;
    }

    // Evaluar política de expiración por fecha/hora
    if (decision.expirationPolicy === 'SPECIFIC_TIME' && decision.expiresAt) {
      const expirationDate = new Date(decision.expiresAt);
      if (!isNaN(expirationDate.getTime()) && now >= expirationDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Valida si un cambio manual de prioridad cumple con las políticas de negocio y RBAC.
   */
  validatePriorityChange(
    currentStatus: AppointmentStatus,
    newPriority: PriorityLevel,
    source: PrioritySource,
    reasonCode?: PriorityReasonCode,
    reason?: string,
    userRole?: string
  ): { valid: boolean; error?: string } {
    // 1. Validar estado FSM de la cita
    const allowedStatuses: AppointmentStatus[] = ['DRAFT', 'SCHEDULED', 'CONFIRMED', 'ARRIVED'];
    if (!allowedStatuses.includes(currentStatus)) {
      return {
        valid: false,
        error: `No es posible modificar la prioridad en estado ${currentStatus}. La cita debe estar en estado DRAFT, SCHEDULED, CONFIRMED o ARRIVED.`,
      };
    }

    // 2. Validar cambios manuales (intervención del supervisor)
    if (source === 'MANUAL') {
      const authorizedRoles = ['OPERATIONS_SUPERVISOR', 'SHIFT_LEADER', 'OPERATIONS_MANAGER'];
      if (userRole && !authorizedRoles.includes(userRole)) {
        return {
          valid: false,
          error: `Acceso denegado: El rol '${userRole}' no tiene permisos para modificar o escalar prioridades manualmente.`,
        };
      }

      // Regla de justificación para MANUAL HIGH
      if (newPriority === 'HIGH' && (!reason || reason.trim().length === 0)) {
        return {
          valid: false,
          error: 'Una intervención manual a prioridad ALTA (HIGH) requiere especificar un motivo de justificación.',
        };
      }

      // Regla estricta de justificación para MANUAL URGENT
      if (newPriority === 'URGENT') {
        if (!reasonCode) {
          return {
            valid: false,
            error: 'Debe seleccionar un código de motivo para asignar prioridad URGENTE.',
          };
        }
        if (!reason || reason.trim().length < 10) {
          return {
            valid: false,
            error: 'La prioridad URGENTE requiere una justificación detallada de al menos 10 caracteres explícitos.',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Calcula el puntaje de ordenamiento operativo para ranking.
   */
  getOperationalRankScore(appointment: ReceptionAppointment): number {
    const availability = this.calculateOperationalAvailability(appointment);
    let score = 0;

    // 1. Disponibilidad Operativa
    if (availability === 'READY') {
      score += 1000;
    } else if (availability === 'IN_RECEIVING') {
      score += 800;
    } else if (availability === 'BLOCKED' || availability === 'REVIEW_REQUIRED') {
      score += 500;
    } else {
      score += 100;
    }

    // 2. Prioridad Aplicada (appointment.priority es la fuente de verdad)
    if (appointment.priority === 'URGENT') {
      score += 300;
    } else if (appointment.priority === 'HIGH') {
      score += 200;
    } else {
      score += 100;
    }

    // 3. Override Manual Activo
    if (appointment.priorityDecision && this.isPriorityOverrideActive(appointment.priorityDecision, new Date(), appointment)) {
      score += 50;
    }

    // 4. Retraso o Tiempo de Espera
    const now = new Date();
    if (appointment.arrivalData?.arrivedAt) {
      const arrivedDate = new Date(appointment.arrivalData.arrivedAt);
      if (!isNaN(arrivedDate.getTime())) {
        score += Math.min(100, Math.floor((now.getTime() - arrivedDate.getTime()) / (1000 * 60)));
      }
    }

    return score;
  }

  private _parseScheduledDateTime(dateStr: string, timeStr: string): Date | null {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes);
    } catch {
      return null;
    }
  }
}
