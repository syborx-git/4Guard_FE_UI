/**
 * @file inventory-query.service.ts
 * @description Servicio reactivo unificado basado en Angular Signals para la Consulta de Inventarios WMS.
 */

import { Injectable, signal, computed, inject, effect } from '@angular/core';
import {
  InventoryRecord,
  InventoryFilterCriteria,
  InventoryKpiSummary,
  InventoryAnalyticsPoint,
  ExpirationBadgeStatus,
  PalletType
} from '../models/inventory-query.models';
import { WarehouseMovementsService } from '../../warehouse-movements/services/warehouse-movements.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryQueryService {
  private readonly movementsService = inject(WarehouseMovementsService);

  /** Registros reales en stock vinculados a las recepciones y tarimas del WMS */
  private readonly _rawInventory = signal<InventoryRecord[]>([]);

  /** Criterios de filtrado activo */
  private readonly _activeFilters = signal<InventoryFilterCriteria>({
    expirationMode: 'GENERAL'
  });

  /** Exponer signals públicas de lectura */
  public readonly rawInventory = this._rawInventory.asReadonly();
  public readonly activeFilters = this._activeFilters.asReadonly();

  constructor() {
    this.refreshInventory();

    // Sincronización reactiva con las recepciones de almacén
    effect(() => {
      const _recs = this.movementsService.receptions();
      this.refreshInventory();
    }, { allowSignalWrites: true });

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === '4guard_receptions_cache' || e.key === '4guard_simulated_positions') {
          this.refreshInventory();
        }
      });
    }
  }

  public refreshInventory(): void {
    this._rawInventory.set(this.buildRealInventory());
  }

  /**
   * Computed Signal: Registros filtrados multicriterio + Regla de Caducidad de Pablo
   */
  public readonly filteredInventory = computed(() => {
    const records = this._rawInventory();
    const filters = this._activeFilters();

    return records.filter((rec) => {
      // 1. Regla Crítica de Caducidad de Pablo
      if (filters.expirationMode === 'CADUCO') {
        if (rec.expirationStatus !== 'CADUCO') return false;
      } else if (filters.expirationMode === 'TIEMPO_30_DIAS') {
        if (rec.expirationStatus !== 'PROXIMO_30_DIAS') return false;
      }

      // 1.1 Filtro por múltiples estados de caducidad
      if (
        filters.selectedExpirationStatuses &&
        filters.selectedExpirationStatuses.length > 0 &&
        !filters.selectedExpirationStatuses.includes(rec.expirationStatus)
      ) {
        return false;
      }

      // 2. Rango Fechas Ingreso
      if (filters.entryDateFrom && rec.entryDate < filters.entryDateFrom) return false;
      if (filters.entryDateTo && rec.entryDate > filters.entryDateTo) return false;

      // 3. Rango Fechas Elaboración
      if (filters.elaborationDateFrom && rec.elaborationDate < filters.elaborationDateFrom) return false;
      if (filters.elaborationDateTo && rec.elaborationDate > filters.elaborationDateTo) return false;

      // 4. Rango Fechas Caducidad
      if (filters.expirationDateFrom && rec.expirationDate < filters.expirationDateFrom) return false;
      if (filters.expirationDateTo && rec.expirationDate > filters.expirationDateTo) return false;

      // 5. Filtro Múltiple de SKUs (Chips / Multi-Select)
      if (filters.selectedSkus && filters.selectedSkus.length > 0) {
        const skuMatches = filters.selectedSkus.some(
          (s) => s.toLowerCase().trim() === rec.sku.toLowerCase().trim()
        );
        if (!skuMatches) return false;
      }

      // 5.1 Filtro Múltiple de Almacenes / Bodegas
      if (filters.selectedWarehouses && filters.selectedWarehouses.length > 0) {
        const whMatches = filters.selectedWarehouses.some(
          (w) => w.toLowerCase().trim() === rec.warehouse.toLowerCase().trim()
        );
        if (!whMatches) return false;
      }

      // 6. Textos / Buscadores (Coincidencia parcial sin distinción de mayúsculas)
      if (filters.remision && !rec.remision.toLowerCase().includes(filters.remision.toLowerCase().trim())) {
        return false;
      }
      if (filters.sku && !rec.sku.toLowerCase().includes(filters.sku.toLowerCase().trim())) {
        return false;
      }
      if (
        filters.productDescription &&
        !rec.productDescription.toLowerCase().includes(filters.productDescription.toLowerCase().trim())
      ) {
        return false;
      }
      if (filters.location && !rec.location.toLowerCase().includes(filters.location.toLowerCase().trim())) {
        return false;
      }
      if (filters.supplier && !rec.supplier.toLowerCase().includes(filters.supplier.toLowerCase().trim())) {
        return false;
      }
      if (filters.client && !rec.client.toLowerCase().includes(filters.client.toLowerCase().trim())) {
        return false;
      }

      // 7. Dropdowns
      if (filters.palletType && rec.palletType !== filters.palletType) return false;
      if (filters.labeledStatus && rec.labeledStatus !== filters.labeledStatus) return false;

      return true;
    });
  });

  /**
   * Catálogo Único de SKUs disponibles en inventario
   */
  public readonly distinctSkus = computed<{ sku: string; description: string; count: number }[]>(() => {
    const list = this._rawInventory();
    const map = new Map<string, { description: string; count: number }>();
    for (const r of list) {
      const existing = map.get(r.sku);
      if (!existing) {
        map.set(r.sku, { description: r.productDescription, count: 1 });
      } else {
        existing.count += 1;
      }
    }
    return Array.from(map.entries()).map(([sku, val]) => ({
      sku,
      description: val.description,
      count: val.count
    }));
  });

  /**
   * Catálogo Único de Almacenes / Bodegas
   */
  public readonly distinctWarehouses = computed<{ warehouse: string; count: number }[]>(() => {
    const list = this._rawInventory();
    const map = new Map<string, number>();
    for (const r of list) {
      map.set(r.warehouse, (map.get(r.warehouse) || 0) + 1);
    }
    return Array.from(map.entries()).map(([warehouse, count]) => ({ warehouse, count }));
  });

  /**
   * Palabras clave y tokens predictivos únicos (ej. Frasco, Nescafé, Leche, etc.)
   */
  public readonly distinctKeywords = computed<{ word: string; count: number }[]>(() => {
    const list = this._rawInventory();
    const wordMap = new Map<string, number>();
    for (const r of list) {
      const tokens = (r.productDescription + ' ' + r.warehouse + ' ' + r.sku)
        .replace(/[,.-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3);

      for (const t of tokens) {
        const key = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        wordMap.set(key, (wordMap.get(key) || 0) + 1);
      }
    }
    return Array.from(wordMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  });

  /**
   * Computed Signal: KPIs de Resumen
   */
  public readonly kpiSummary = computed<InventoryKpiSummary>(() => {
    const list = this.filteredInventory();
    if (list.length === 0) {
      return { totalPallets: 0, totalPieces: 0, expiringNext30Days: 0, avgStayDays: 0 };
    }

    const totalPallets = list.reduce((sum, r) => sum + r.palletsCount, 0);
    const totalPieces = list.reduce((sum, r) => sum + r.measuredQuantity, 0);
    const expiringNext30Days = list.filter((r) => r.expirationStatus === 'PROXIMO_30_DIAS').length;
    const avgStayDays = Math.round(list.reduce((sum, r) => sum + r.stayDays, 0) / list.length);

    return {
      totalPallets: Math.round(totalPallets * 100) / 100,
      totalPieces,
      expiringNext30Days,
      avgStayDays
    };
  });

  /**
   * Computed Signal: Analítica Histórica de Ingresos por Año
   */
  public readonly analyticsData = computed<InventoryAnalyticsPoint[]>(() => {
    const list = this._rawInventory();
    const map = new Map<number, { pallets: number; pieces: number; folios: number[] }>();

    list.forEach((r) => {
      const year = new Date(r.entryDate).getFullYear() || 2026;
      const curr = map.get(year) || { pallets: 0, pieces: 0, folios: [] };
      curr.pallets += r.palletsCount;
      curr.pieces += r.measuredQuantity;
      curr.folios.push(r.id);
      map.set(year, curr);
    });

    const result: InventoryAnalyticsPoint[] = [];
    map.forEach((val, year) => {
      const minFolio = Math.min(...val.folios);
      const maxFolio = Math.max(...val.folios);
      result.push({
        year,
        totalPallets: Math.round(val.pallets * 100) / 100,
        totalPieces: val.pieces,
        sampleFolioRange: `#${minFolio} – #${maxFolio}`
      });
    });

    return result.sort((a, b) => b.year - a.year);
  });

  /** Actualizar filtros activos */
  public setFilters(filters: InventoryFilterCriteria): void {
    this._activeFilters.set({ ...filters });
  }

  /** Limpiar todos los filtros */
  public clearFilters(): void {
    this._activeFilters.set({ expirationMode: 'GENERAL' });
  }

  /**
   * Generar Inventario Real 4GUARD WMS derivado de las recepciones y tarimas reales en almacén.
   * Si no hay existencias en el sistema, permanece limpio (0 registros) sin mocks.
   */
  private buildRealInventory(): InventoryRecord[] {
    const receptions = this.movementsService.receptions() || [];
    const today = new Date();
    const records: InventoryRecord[] = [];
    let counter = 500000;

    for (const rec of receptions) {
      // Omitir canceladas y las que solo están registradas en caseta sin descarga física
      if (rec.status === 'CANCELLED' || rec.status === 'REGISTERED') continue;

      const pallets = rec.pallets || [];
      const entryDate = rec.checkIn?.docDate || (rec as any).createdAt?.slice(0, 10) || today.toISOString().slice(0, 10);
      const stayDays = Math.max(0, Math.floor((today.getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)));

      for (let i = 0; i < pallets.length; i++) {
        counter++;
        const p = pallets[i];
        const expDate = p.expirationDate || rec.expirationDate || '';
        let remainingDays = 180;
        let expStatus: 'EN_TIEMPO' | 'PROXIMO_30_DIAS' | 'CADUCO' = 'EN_TIEMPO';

        if (expDate) {
          const expTime = new Date(expDate).getTime();
          remainingDays = Math.ceil((expTime - today.getTime()) / (1000 * 60 * 60 * 24));
          if (remainingDays <= 0) {
            expStatus = 'CADUCO';
          } else if (remainingDays <= 30) {
            expStatus = 'PROXIMO_30_DIAS';
          } else {
            expStatus = 'EN_TIEMPO';
          }
        }

        const loc = p.locationCode || rec.storageLocation || rec.storageLocationCode || 'STAGING-01';
        let warehouse = 'Bodega A';
        if (loc.startsWith('B') || loc.includes('BODEGA B')) warehouse = 'Bodega B';
        else if (loc.includes('APC')) warehouse = 'Bodega APC';
        else if (loc.includes('AT')) warehouse = 'Bodega AT';

        records.push({
          id: counter,
          entryDate,
          elaborationDate: (p as any).elaborationDate || rec.elaborationDate || entryDate,
          expirationDate: expDate,
          usefulLifeDays: 365,
          remision: rec.checkIn?.docNumber || rec.folio,
          manufacturerBatch: p.lotNumber || rec.lotNumber || 'S/L',
          ssccBarcode: p.palletCode,
          sku: p.productId || rec.productId || rec.skuCode || 'SKU-GEN',
          productDescription: p.description || rec.productName || 'Mercancía en Almacén',
          receptionFolio: rec.folio,
          measuredQuantity: p.pieces || rec.piecesPerPallet || 0,
          palletsCount: 1.0,
          stayDays,
          warehouse,
          location: loc,
          entryNumber: `ENT-${rec.folio}`,
          palletType: ((p.palletTypeLabel || rec.selectedPalletType || 'MADERA ESTANDAR').toUpperCase()) as PalletType,
          labeledStatus: p.isUaRelabelled ? 'ETIQUETADO' : 'PENDIENTE',
          supplier: p.supplierName || rec.supplierName || rec.checkIn?.client || 'Nestlé México',
          remainingLifeDays: remainingDays,
          client: rec.checkIn?.client || 'Nestlé México',
          expirationStatus: expStatus
        });
      }
    }

    return records;
  }
}
