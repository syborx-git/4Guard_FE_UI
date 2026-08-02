/**
 * @file license-management.validators.ts
 * @description Validadores personalizados TypeScript-strict para HU-139 — Gestión de Licencias.
 * Todos retornan ValidationErrors | null. Sin `any`. Todos reutilizables.
 */

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { WmsLicense, LicenseUsage } from './license-management.models';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica que un valor sea un entero finito y no negativo.
 * Rechaza: NaN, Infinity, decimales, strings no numéricos.
 */
function isValidInteger(raw: unknown): boolean {
  if (raw === null || raw === undefined || raw === '') return false;
  const num = Number(raw);
  if (!Number.isFinite(num)) return false;
  if (!Number.isInteger(num)) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES INDIVIDUALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida que el control sea un entero positivo (≥ 1).
 * Rechaza: null, undefined, '', NaN, Infinity, decimales, negativos, cero.
 * Uso: maxUsers, maxConcurrentUsers, maxWarehouses, maxHandheldDevices.
 */
export function positiveIntegerValidator(max = 10_000): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return null; // required lo captura

    if (!isValidInteger(raw)) {
      return { invalidInteger: true };
    }

    const num = Number(raw);
    if (num <= 0) return { nonPositiveValue: true };
    if (num > max) return { exceedsMaximum: { max } };

    return null;
  };
}

/**
 * Valida que el control sea un entero no negativo (≥ 0).
 * Rechaza: null, undefined, '', NaN, Infinity, decimales, negativos.
 * Uso: maxIntegrations (puede ser 0).
 */
export function nonNegativeIntegerValidator(max = 100): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return null;

    if (!isValidInteger(raw)) {
      return { invalidInteger: true };
    }

    const num = Number(raw);
    if (num < 0) return { negativeValue: true };
    if (num > max) return { exceedsMaximum: { max } };

    return null;
  };
}

/**
 * Valida que el string no sea solo espacios en blanco.
 * Uso: licenseName, administrativeReason.
 */
export function noWhitespaceOnlyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = control.value as string | null;
    if (!val) return null;
    if (val.trim().length === 0) return { whitespaceOnly: true };
    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDADORES DE GRUPO (CROSS-FIELD)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valida que validUntil sea posterior a validFrom.
 * Aplicar al FormGroup de vigencia.
 */
export function dateRangeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const from = group.get('validFrom')?.value as string | null;
    const until = group.get('validUntil')?.value as string | null;

    if (!from || !until) return null;

    const fromDate = new Date(from);
    const untilDate = new Date(until);

    if (isNaN(fromDate.getTime()) || isNaN(untilDate.getTime())) return null;
    if (untilDate <= fromDate) return { dateRangeInvalid: true };

    return null;
  };
}

/**
 * Valida que maxConcurrentUsers no sea mayor que maxUsers.
 * Aplicar al FormGroup de capacidades.
 */
export function concurrentUsersLimitValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const maxUsers = group.get('maxUsers')?.value;
    const maxConcurrent = group.get('maxConcurrentUsers')?.value;

    if (!isValidInteger(maxUsers) || !isValidInteger(maxConcurrent)) return null;

    const users = Number(maxUsers);
    const concurrent = Number(maxConcurrent);

    if (concurrent > users) {
      return { concurrentExceedsMax: { maxUsers: users, concurrent } };
    }

    return null;
  };
}

/**
 * Valida que los nuevos límites de capacidad no sean inferiores al consumo actual.
 * Factory que recibe una función para obtener el consumo actual de la licencia seleccionada.
 * Aplicar al FormGroup de capacidades.
 *
 * @param getUsage - Función que retorna el LicenseUsage actual (o null si es nueva licencia).
 */
export function capacityNotBelowUsageValidator(
  getUsage: () => LicenseUsage | null
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const usage = getUsage();
    if (!usage) return null; // Nueva licencia, sin consumo previo

    const errors: ValidationErrors = {};

    const check = (
      controlName: string,
      usageValue: number,
      errorKey: string
    ): void => {
      const raw = group.get(controlName)?.value;
      if (!isValidInteger(raw)) return;
      const limit = Number(raw);
      if (limit < usageValue) {
        errors[errorKey] = { current: usageValue, attempted: limit };
      }
    };

    check('maxUsers', usage.currentUsers, 'usersBelowUsage');
    check('maxConcurrentUsers', usage.concurrentUsersPeak, 'concurrentBelowUsage');
    check('maxWarehouses', usage.currentWarehouses, 'warehousesBelowUsage');
    check('maxHandheldDevices', usage.registeredHandheldDevices, 'handheldsBelowUsage');
    check('maxIntegrations', usage.activeIntegrations, 'integrationsBelowUsage');

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

/**
 * Valida que el array de módulos habilitados contenga al menos un elemento
 * y que siempre incluya WMS_CORE.
 * Uso: FormControl enabledModules.
 */
export function atLeastOneModuleValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const modules = control.value as unknown[];

    if (!Array.isArray(modules) || modules.length === 0) {
      return { noModulesSelected: true };
    }

    if (!modules.includes('WMS_CORE')) {
      return { wmsCoreRequired: true };
    }

    return null;
  };
}

/**
 * Valida que la clave de licencia sea única en el catálogo.
 * Factory que recibe funciones para obtener licencias y el ID actual.
 *
 * @param getLicenses    - Función que retorna el array de WmsLicense actuales.
 * @param getCurrentId   - Función que retorna el ID de la licencia en edición (null si nueva).
 */
export function uniqueLicenseKeyValidator(
  getLicenses: () => WmsLicense[],
  getCurrentId: () => string | null
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value as string | null;
    if (!raw || !raw.trim()) return null;

    const normalizedKey = raw.trim().toUpperCase();
    const currentId = getCurrentId();
    const licenses = getLicenses();

    const isDuplicate = licenses.some(
      (lic) =>
        lic.licenseKey.trim().toUpperCase() === normalizedKey &&
        lic.id !== currentId
    );

    return isDuplicate ? { duplicateLicenseKey: true } : null;
  };
}

/**
 * Valida que el periodo de gracia esté en el rango 0–90.
 */
export function gracePeriodRangeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return null;

    if (!isValidInteger(raw)) return { invalidInteger: true };

    const num = Number(raw);
    if (num < 0) return { negativeValue: true };
    if (num > 90) return { exceedsMaximum: { max: 90 } };

    return null;
  };
}
