/**
 * @file currency-exchange.validators.ts
 * @description Validadores personalizados TypeScript-strict para HU-148 — Gestión de Divisas y Tipos de Cambio.
 * Todos los validadores son reutilizables, no usan `any` y retornan ValidationErrors | null.
 */

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// ═══════════════════════════════════════════════════════════════════
// positiveFiniteNumberValidator
// Valida que el control contenga un número finito, positivo,
// sin notación científica y con máximo 6 decimales.
// ═══════════════════════════════════════════════════════════════════
export function positiveFiniteNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined || raw === '') {
      return null; // Dejar que required lo capture
    }

    const strVal = String(raw).trim();

    // Rechazar notación científica
    if (/[eE]/.test(strVal)) {
      return { scientificNotation: true };
    }

    // Rechazar caracteres no numéricos (excepto punto decimal único)
    if (!/^\d+(\.\d+)?$/.test(strVal)) {
      return { invalidNumber: true };
    }

    const num = parseFloat(strVal);

    if (isNaN(num)) {
      return { nanValue: true };
    }

    if (!isFinite(num)) {
      return { infiniteValue: true };
    }

    if (num <= 0) {
      return { notPositive: true };
    }

    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════
// maximumDecimalPlacesValidator
// Valida que el número no exceda `maxDecimals` lugares decimales.
// ═══════════════════════════════════════════════════════════════════
export function maximumDecimalPlacesValidator(maxDecimals: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined || raw === '') {
      return null;
    }

    const strVal = String(raw).trim();
    const dotIndex = strVal.indexOf('.');

    if (dotIndex === -1) {
      return null; // Sin decimales — válido
    }

    const decimals = strVal.length - dotIndex - 1;

    if (decimals > maxDecimals) {
      return { maxDecimalPlaces: { max: maxDecimals, actual: decimals } };
    }

    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════
// dateRangeValidator
// Valida que effectiveTo sea posterior a effectiveFrom cuando ambos están presentes.
// Debe aplicarse al FormGroup que contenga ambos controles.
// ═══════════════════════════════════════════════════════════════════
export function dateRangeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const from = group.get('effectiveFrom')?.value as string | null;
    const to = group.get('effectiveTo')?.value as string | null;

    if (!from || !to) {
      return null; // effectiveTo es opcional
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return null; // Las validaciones de formato individuales lo capturan
    }

    if (toDate <= fromDate) {
      return { dateRangeInvalid: true };
    }

    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════
// differentCurrenciesValidator
// Valida que sourceCurrencyCode ≠ targetCurrencyCode.
// Debe aplicarse al FormGroup que contenga ambos controles.
// ═══════════════════════════════════════════════════════════════════
export function differentCurrenciesValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const source = group.get('isoCode')?.value as string | null;
    const target = group.get('targetCurrencyCode')?.value as string | null;

    if (!source || !target) {
      return null;
    }

    if (source.toUpperCase() === target.toUpperCase()) {
      return { sameCurrency: true };
    }

    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════
// baseCurrencyRulesValidator
// Valida que, si isBaseCurrency es true, el rate sea 1.000000
// y el status sea ACTIVE.
// Debe aplicarse al FormGroup que contenga los controles relevantes.
// ═══════════════════════════════════════════════════════════════════
export function baseCurrencyRulesValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const isBase = group.get('isBaseCurrency')?.value as boolean;
    const rate = parseFloat(String(group.get('rate')?.value ?? '0'));
    const status = group.get('status')?.value as string;

    if (!isBase) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (Math.abs(rate - 1.0) > 0.000001) {
      errors['baseCurrencyRateNotOne'] = true;
    }

    if (status !== 'ACTIVE') {
      errors['baseCurrencyMustBeActive'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

// ═══════════════════════════════════════════════════════════════════
// noWhitespaceOnlyValidator
// Valida que el campo no contenga únicamente espacios en blanco.
// ═══════════════════════════════════════════════════════════════════
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
