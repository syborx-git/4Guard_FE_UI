/**
 * @file currency-exchange.service.ts
 * @description Servicio dummy tipado para HU-148 — Gestión de Divisas y Tipos de Cambio.
 * Simula todas las operaciones CRUD con RxJS Observables y retardos realistas.
 * No se conecta a ningún endpoint real mientras el backend se integra.
 */

import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError, delay } from 'rxjs';

import {
  Currency,
  ExchangeRate,
  CurrencyAuditEntry,
  CurrencyStatus,
  ExchangeRateStatus,
  DUMMY_CURRENCIES,
  DUMMY_EXCHANGE_RATES,
  DUMMY_AUDIT_ENTRIES,
} from './currency-exchange.models';

// ═══════════════════════════════════════════════════════════════════
// Interfaz de respuesta estándar del servicio dummy
// ═══════════════════════════════════════════════════════════════════
export interface ServiceResult<T> {
  data: T;
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CurrencyExchangeService {
  // ─── Estado interno mutable del catálogo ─────────────────────────────────
  private _currencies = signal<Currency[]>([...DUMMY_CURRENCIES]);
  private _exchangeRates = signal<ExchangeRate[]>([...DUMMY_EXCHANGE_RATES]);
  private _auditEntries = signal<CurrencyAuditEntry[]>([...DUMMY_AUDIT_ENTRIES]);

  // ─── Señales públicas de lectura ──────────────────────────────────────────
  readonly currencies = this._currencies.asReadonly();
  readonly exchangeRates = this._exchangeRates.asReadonly();
  readonly auditEntries = this._auditEntries.asReadonly();

  // ─── SIMULACIÓN DELAY ────────────────────────────────────────────────────
  private readonly MOCK_DELAY_MS = 550;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSULTAS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Retorna todas las monedas de la organización. */
  getCurrencies(): Observable<ServiceResult<Currency[]>> {
    return of({
      data: [...this._currencies()],
      message: 'Monedas cargadas correctamente.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Retorna los tipos de cambio filtrados por moneda origen. */
  getExchangeRates(sourceCurrencyCode?: string): Observable<ServiceResult<ExchangeRate[]>> {
    const all = this._exchangeRates();
    const filtered = sourceCurrencyCode
      ? all.filter((r) => r.sourceCurrencyCode === sourceCurrencyCode)
      : all;

    return of({
      data: [...filtered],
      message: 'Tipos de cambio cargados correctamente.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Retorna los registros de auditoría de la organización. */
  getAuditEntries(): Observable<ServiceResult<CurrencyAuditEntry[]>> {
    return of({
      data: [...this._auditEntries()],
      message: 'Registros de auditoría cargados.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES — MONEDA
  // ═══════════════════════════════════════════════════════════════════════════

  /** Crea una nueva moneda y genera entrada de auditoría. */
  createCurrency(
    payload: Omit<Currency, 'id' | 'createdAt' | 'updatedAt'>
  ): Observable<ServiceResult<Currency>> {
    const now = new Date().toISOString();

    const existing = this._currencies().find(
      (c) => c.isoCode === payload.isoCode.toUpperCase()
    );
    if (existing) {
      return throwError(() => ({
        success: false,
        message: `Ya existe una moneda con el código ${payload.isoCode.toUpperCase()}.`,
      })).pipe(delay(200));
    }

    const newCurrency: Currency = {
      ...payload,
      id: `cur-${Date.now()}`,
      isoCode: payload.isoCode.toUpperCase(),
      createdAt: now,
      updatedAt: now,
    };

    // Actualizar estado
    this._currencies.update((list) => [...list, newCurrency]);

    // Auditoría
    this._addAuditEntry({
      entityType: 'CURRENCY',
      entityId: newCurrency.id,
      action: 'CREATE',
      previousValue: null,
      newValue: { isoCode: newCurrency.isoCode, name: newCurrency.name },
      performedBy: payload.updatedBy,
    });

    return of({
      data: newCurrency,
      message: `Moneda ${newCurrency.isoCode} creada exitosamente.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Actualiza una moneda existente por ID. */
  updateCurrency(
    id: string,
    payload: Partial<Omit<Currency, 'id' | 'organizationId' | 'createdAt'>>,
    performedBy: string
  ): Observable<ServiceResult<Currency>> {
    const list = this._currencies();
    const idx = list.findIndex((c) => c.id === id);

    if (idx === -1) {
      return throwError(() => ({
        success: false,
        message: 'Moneda no encontrada.',
      })).pipe(delay(200));
    }

    const previous = { ...list[idx] };
    const updated: Currency = {
      ...list[idx],
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: performedBy,
    };

    this._currencies.update((arr) => {
      const copy = [...arr];
      copy[idx] = updated;
      return copy;
    });

    this._addAuditEntry({
      entityType: 'CURRENCY',
      entityId: id,
      action: 'UPDATE',
      previousValue: previous,
      newValue: updated,
      performedBy,
    });

    return of({
      data: updated,
      message: `Moneda ${updated.isoCode} actualizada correctamente.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Activa o inactiva una moneda. */
  toggleCurrencyStatus(
    id: string,
    newStatus: CurrencyStatus,
    performedBy: string
  ): Observable<ServiceResult<Currency>> {
    const currency = this._currencies().find((c) => c.id === id);

    if (!currency) {
      return throwError(() => ({ success: false, message: 'Moneda no encontrada.' })).pipe(
        delay(200)
      );
    }

    if (currency.isBaseCurrency && newStatus === 'INACTIVE') {
      return throwError(() => ({
        success: false,
        message: 'La moneda base no puede inactivarse.',
      })).pipe(delay(200));
    }

    return this.updateCurrency(
      id,
      { status: newStatus },
      performedBy
    );
  }

  /** Cambia la moneda base de la organización. Solo puede haber una. */
  changeBaseCurrency(
    newBaseId: string,
    performedBy: string
  ): Observable<ServiceResult<boolean>> {
    const list = this._currencies();
    const newBase = list.find((c) => c.id === newBaseId);

    if (!newBase) {
      return throwError(() => ({ success: false, message: 'Moneda no encontrada.' })).pipe(
        delay(200)
      );
    }

    if (newBase.status !== 'ACTIVE') {
      return throwError(() => ({
        success: false,
        message: 'La moneda base debe estar activa.',
      })).pipe(delay(200));
    }

    // Quitar base de todas y asignar al nuevo
    this._currencies.update((arr) =>
      arr.map((c) => ({
        ...c,
        isBaseCurrency: c.id === newBaseId,
        currentRate: c.id === newBaseId ? 1.0 : c.currentRate,
        updatedAt: new Date().toISOString(),
        updatedBy: performedBy,
      }))
    );

    this._addAuditEntry({
      entityType: 'CURRENCY',
      entityId: newBaseId,
      action: 'CHANGE_BASE_CURRENCY',
      previousValue: null,
      newValue: { isoCode: newBase.isoCode, isBaseCurrency: true },
      performedBy,
    });

    return of({
      data: true,
      message: `${newBase.isoCode} ahora es la moneda base de la organización.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MUTACIONES — TIPO DE CAMBIO
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea un nuevo tipo de cambio.
   * Si el nuevo estado es CURRENT, cierra el tipo vigente anterior.
   */
  createExchangeRate(
    payload: Omit<ExchangeRate, 'id' | 'createdAt'>,
    performedBy: string
  ): Observable<ServiceResult<ExchangeRate>> {
    const now = new Date().toISOString();
    const effectiveFrom = new Date(payload.effectiveFrom);
    const isFuture = effectiveFrom > new Date();
    const rateStatus: ExchangeRateStatus = isFuture ? 'SCHEDULED' : 'CURRENT';

    const newRate: ExchangeRate = {
      ...payload,
      id: `er-${Date.now()}`,
      status: rateStatus,
      createdAt: now,
      createdBy: performedBy,
    };

    // Si el nuevo es CURRENT, cerrar el vigente anterior del mismo par
    if (rateStatus === 'CURRENT') {
      this._exchangeRates.update((arr) =>
        arr.map((r) => {
          if (
            r.sourceCurrencyCode === payload.sourceCurrencyCode &&
            r.targetCurrencyCode === payload.targetCurrencyCode &&
            r.status === 'CURRENT'
          ) {
            return {
              ...r,
              status: 'HISTORICAL' as ExchangeRateStatus,
              effectiveTo: now,
            };
          }
          return r;
        })
      );

      // Actualizar el currentRate de la moneda
      this._currencies.update((arr) =>
        arr.map((c) => {
          if (c.isoCode === payload.sourceCurrencyCode) {
            return {
              ...c,
              currentRate: payload.rate,
              freshnessStatus: 'CURRENT' as const,
              updatedAt: now,
              updatedBy: performedBy,
            };
          }
          return c;
        })
      );
    }

    this._exchangeRates.update((arr) => [...arr, newRate]);

    this._addAuditEntry({
      entityType: 'EXCHANGE_RATE',
      entityId: newRate.id,
      action: 'CREATE_EXCHANGE_RATE',
      previousValue: null,
      newValue: {
        sourceCurrencyCode: newRate.sourceCurrencyCode,
        targetCurrencyCode: newRate.targetCurrencyCode,
        rate: newRate.rate,
        status: newRate.status,
      },
      performedBy,
    });

    return of({
      data: newRate,
      message: `Tipo de cambio ${payload.sourceCurrencyCode}/${payload.targetCurrencyCode} registrado correctamente.`,
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  /** Cancela un tipo de cambio programado (SCHEDULED). */
  cancelScheduledRate(
    rateId: string,
    performedBy: string
  ): Observable<ServiceResult<boolean>> {
    const rate = this._exchangeRates().find((r) => r.id === rateId);

    if (!rate) {
      return throwError(() => ({ success: false, message: 'Tipo de cambio no encontrado.' })).pipe(
        delay(200)
      );
    }

    if (rate.status !== 'SCHEDULED') {
      return throwError(() => ({
        success: false,
        message: 'Solo se pueden cancelar tipos de cambio programados.',
      })).pipe(delay(200));
    }

    this._exchangeRates.update((arr) =>
      arr.map((r) =>
        r.id === rateId
          ? { ...r, status: 'HISTORICAL' as ExchangeRateStatus, effectiveTo: new Date().toISOString() }
          : r
      )
    );

    this._addAuditEntry({
      entityType: 'EXCHANGE_RATE',
      entityId: rateId,
      action: 'UPDATE',
      previousValue: { status: 'SCHEDULED' },
      newValue: { status: 'HISTORICAL' },
      performedBy,
    });

    return of({
      data: true,
      message: 'Tipo de cambio programado cancelado correctamente.',
      success: true,
    }).pipe(delay(this.MOCK_DELAY_MS));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Verifica si existe duplicado de código ISO (excluyendo el ID actual en edición). */
  isDuplicateIsoCode(isoCode: string, excludeId?: string): boolean {
    return this._currencies().some(
      (c) =>
        c.isoCode.toLowerCase() === isoCode.toLowerCase() &&
        c.id !== excludeId
    );
  }

  /** Retorna la moneda base actual. */
  getBaseCurrency(): Currency | undefined {
    return this._currencies().find((c) => c.isBaseCurrency);
  }

  /** Retorna el tipo de cambio vigente para un par de monedas. */
  getCurrentRate(
    sourceCurrencyCode: string,
    targetCurrencyCode: string
  ): ExchangeRate | undefined {
    return this._exchangeRates().find(
      (r) =>
        r.sourceCurrencyCode === sourceCurrencyCode &&
        r.targetCurrencyCode === targetCurrencyCode &&
        r.status === 'CURRENT'
    );
  }

  // ─── Helper privado para agregar auditoría ─────────────────────────────
  private _addAuditEntry(
    entry: Omit<CurrencyAuditEntry, 'id' | 'organizationId' | 'performedAt'>
  ): void {
    const newEntry: CurrencyAuditEntry = {
      ...entry,
      id: `aud-${Date.now()}`,
      organizationId: 'org-4guard-mx-001',
      performedAt: new Date().toISOString(),
    };

    this._auditEntries.update((arr) => [newEntry, ...arr]);
  }
}
