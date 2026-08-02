/**
 * @file alerts-config.validators.ts
 * @description Validadores personalizados TypeScript-strict para HU-134 — Configuración de Alertas.
 * Todos los validadores son reutilizables, sin `any` y retornan ValidationErrors | null.
 */

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AlertConfiguration } from './alerts-config.models';

/**
 * Valida que el control contenga un número estrictamente mayor a 0 (finito y positivo).
 */
export function positiveNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined || raw === '') {
      return null; // Dejar que required lo capture si aplica
    }

    const strVal = String(raw).trim();

    if (!/^\d+(\.\d+)?$/.test(strVal)) {
      return { invalidNumber: true };
    }

    const num = parseFloat(strVal);

    if (isNaN(num) || !isFinite(num)) {
      return { invalidNumber: true };
    }

    if (num <= 0) {
      return { nonPositiveValue: true };
    }

    return null;
  };
}

/**
 * Valida que el texto no contenga únicamente espacios en blanco.
 */
export function noWhitespaceOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = control.value as string | null;

    if (!val) {
      return null;
    }

    if (val.trim().length === 0) {
      return { whitespaceOnly: true };
    }

    return null;
  };
}

/**
 * Valida que al menos un canal esté seleccionado en el array/objeto de canales.
 */
export function atLeastOneChannelValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (Array.isArray(value)) {
      return value.length > 0 ? null : { noChannelsSelected: true };
    }

    if (value && typeof value === 'object') {
      const hasAnyTrue = Object.values(value).some((v) => v === true);
      return hasAnyTrue ? null : { noChannelsSelected: true };
    }

    return { noChannelsSelected: true };
  };
}

/**
 * Valida que al menos un rol destinatario esté seleccionado en la configuración.
 */
export function atLeastOneRecipientValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (Array.isArray(value)) {
      return value.length > 0 ? null : { noRecipientsSelected: true };
    }

    if (value && typeof value === 'object') {
      const hasAnyTrue = Object.values(value).some((v) => v === true);
      return hasAnyTrue ? null : { noRecipientsSelected: true };
    }

    return { noRecipientsSelected: true };
  };
}

/**
 * Valida que el nombre de la alerta no esté duplicado en el catálogo.
 */
export function uniqueAlertNameValidator(
  getAlerts: () => AlertConfiguration[],
  currentIdSupplier: () => string | null
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const rawName = control.value as string | null;
    if (!rawName || !rawName.trim()) return null;

    const normalized = rawName.trim().toLowerCase();
    const currentId = currentIdSupplier();
    const alerts = getAlerts();

    const isDuplicate = alerts.some(
      (a) => a.name.trim().toLowerCase() === normalized && a.id !== currentId
    );

    return isDuplicate ? { duplicateAlertName: true } : null;
  };
}
