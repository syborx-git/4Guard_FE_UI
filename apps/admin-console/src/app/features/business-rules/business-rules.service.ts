/**
 * @file business-rules.service.ts
 * @description Servicio reactivo para HU-131 — Motor de Reglas de Negocio Enterprise.
 * Utiliza Angular Signals para estado in-memory de alto rendimiento.
 */

import { Injectable, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import {
  BusinessRule,
  BusinessRuleFilters,
  BusinessRuleKpis,
} from './business-rules.models';
import { MOCK_BUSINESS_RULES } from './business-rules.mock';

@Injectable({
  providedIn: 'root',
})
export class BusinessRulesService {
  // ─── Estado reactivo principal ────────────────────────────────────────────

  private readonly _allRules = signal<BusinessRule[]>(MOCK_BUSINESS_RULES);
  private readonly _activeFilters = signal<BusinessRuleFilters | null>(null);
  private readonly _selectedRuleId = signal<string | null>('rule-01');

  readonly isLoading = signal<boolean>(false);

  // ─── Signals públicos computados ──────────────────────────────────────────

  /** Reglas filtradas reactivas */
  readonly filteredRules = computed<BusinessRule[]>(() => {
    const rules = this._allRules();
    const filters = this._activeFilters();

    if (!filters) return rules;

    return rules.filter((rule) => {
      // Buscador libre (código, nombre, descripción, modificado por)
      if (filters.searchTerm?.trim()) {
        const q = filters.searchTerm.toLowerCase().trim();
        const matchesCode = rule.code.toLowerCase().includes(q);
        const matchesName = rule.name.toLowerCase().includes(q);
        const matchesDesc = rule.description.toLowerCase().includes(q);
        const matchesUser = rule.lastModifiedBy.toLowerCase().includes(q);
        if (!matchesCode && !matchesName && !matchesDesc && !matchesUser) {
          return false;
        }
      }

      // Filtro Módulo
      if (filters.module && rule.module !== filters.module) {
        return false;
      }

      // Filtro Categoría
      if (filters.category && rule.category !== filters.category) {
        return false;
      }

      // Filtro Tipo de dato
      if (filters.dataType && rule.dataType !== filters.dataType) {
        return false;
      }

      // Filtro Alcance
      if (filters.scope && rule.scope !== filters.scope) {
        return false;
      }

      // Filtro Estado
      if (filters.status && rule.status !== filters.status) {
        return false;
      }

      return true;
    });
  });

  /** Regla actualmente seleccionada */
  readonly selectedRule = computed<BusinessRule | null>(() => {
    const id = this._selectedRuleId();
    const rules = this._allRules();
    if (!id) return rules[0] ?? null;
    return rules.find((r) => r.id === id) ?? rules[0] ?? null;
  });

  /** Indicador de ID seleccionado */
  readonly selectedRuleId = this._selectedRuleId.asReadonly();

  /** KPIs calculados dinámicamente sobre el total de reglas */
  readonly kpis = computed<BusinessRuleKpis>(() => {
    const rules = this._allRules();
    const totalConfigured = rules.length;
    const totalActive = rules.filter((r) => r.status === 'ACTIVE').length;
    const totalInactive = rules.filter((r) => r.status === 'INACTIVE').length;
    const totalCritical = rules.filter((r) => r.severity === 'CRITICAL').length;

    // Reglas modificadas en los últimos 7 días o recientes
    const recentlyModified = rules.filter((r) => {
      const mod = new Date(r.lastModifiedAt).getTime();
      const now = new Date('2026-07-24T00:00:00Z').getTime();
      const daysDiff = (now - mod) / (1000 * 3600 * 24);
      return daysDiff <= 14;
    }).length;

    return {
      totalConfigured,
      totalActive,
      totalInactive,
      totalCritical,
      recentlyModified,
    };
  });

  // ─── Acciones de Estado ───────────────────────────────────────────────────

  selectRule(id: string): void {
    this._selectedRuleId.set(id);
  }

  applyFilters(filters: BusinessRuleFilters): void {
    this._activeFilters.set({ ...filters });
  }

  clearFilters(): void {
    this._activeFilters.set(null);
  }

  /** Guarda o actualiza una regla de negocio */
  saveRule(ruleData: Partial<BusinessRule>): void {
    const current = this._allRules();
    const existingIndex = current.findIndex((r) => r.id === ruleData.id);

    const nowIso = new Date().toISOString();

    if (existingIndex >= 0) {
      // Actualizar regla existente
      const updated: BusinessRule = {
        ...current[existingIndex],
        ...ruleData,
        lastModifiedAt: nowIso,
      } as BusinessRule;

      const newRules = [...current];
      newRules[existingIndex] = updated;
      this._allRules.set(newRules);
    } else {
      // Crear nueva regla
      const newId = `rule-${Date.now().toString().slice(-4)}`;
      const newRule: BusinessRule = {
        id: newId,
        code: (ruleData.code || 'NEW_RULE').toUpperCase().replace(/\s+/g, '_'),
        name: ruleData.name || 'Nueva Regla de Negocio',
        description: ruleData.description || '',
        module: ruleData.module || 'SYSTEM',
        category: ruleData.category || 'STRATEGY',
        functionalType: ruleData.functionalType || 'POLICY',
        dataType: ruleData.dataType || 'STRING',
        value: ruleData.value ?? '',
        unit: ruleData.unit || '',
        minValue: ruleData.minValue,
        maxValue: ruleData.maxValue,
        scope: ruleData.scope || 'GLOBAL',
        status: ruleData.status || 'ACTIVE',
        severity: ruleData.severity || 'INFO',
        effectiveDate: ruleData.effectiveDate || new Date().toISOString().slice(0, 10),
        lastModifiedAt: nowIso,
        lastModifiedBy: ruleData.lastModifiedBy || 'enrique.archundia@4guard.mx',
        changeReason: ruleData.changeReason || 'Creación inicial de parámetro.',
        isSystem: false,
      };

      this._allRules.set([newRule, ...current]);
      this._selectedRuleId.set(newId);
    }
  }

  /** Simula actualización de datos */
  refreshData(): Observable<boolean> {
    this.isLoading.set(true);
    return of(true).pipe(
      delay(600)
    );
  }
}
