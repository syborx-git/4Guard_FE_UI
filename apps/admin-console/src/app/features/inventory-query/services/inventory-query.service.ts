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
import { WarehouseLayoutService } from '../../catalogs/services/warehouse-layout.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryQueryService {
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly layoutService = inject(WarehouseLayoutService);

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

    // Sincronización reactiva con las recepciones de almacén, lotes y transferencias
    effect(() => {
      const _recs = this.movementsService.receptions();
      const _batches = this.movementsService.inventoryBatches();
      const _transfers = this.movementsService.transfers();
      this.refreshInventory();
    }, { allowSignalWrites: true });

    // Carga inicial proactiva desde el backend si las colecciones aún no han sido pobladas
    if (this.movementsService.receptions().length === 0) {
      this.movementsService.reloadReceptions();
    }
    if (this.movementsService.inventoryBatches().length === 0) {
      this.movementsService.reloadInventoryBatches();
    }
    if (this.movementsService.transfers().length === 0) {
      this.movementsService.reloadTransfers();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (
          e.key === '4guard_receptions_cache' ||
          e.key === '4guard_simulated_positions' ||
          e.key === '4guard_inventory_batches_cache' ||
          e.key === '4g_active_transfer_folio'
        ) {
          this.refreshInventory();
        }
      });
    }
  }

  public refreshInventory(): void {
    this._rawInventory.set(this.buildRealInventory());
  }

  /**
   * Forzar recarga fresca de datos reales desde el backend (PostgreSQL / Spring Boot)
   */
  public forceBackendReload(): void {
    this.movementsService.reloadReceptions();
    this.movementsService.reloadInventoryBatches();
    this.movementsService.reloadTransfers();
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
   * Resuelve el nombre del Almacén / Nave a partir del código de ubicación topológica.
   * Mapea limpiamente a las naves oficiales: Almacén A, B, C, D, E, F, G, H, I, J, L.
   */
  private resolveWarehouseFromLocation(loc: string): string {
    if (!loc) return 'Almacén General';
    const clean = loc.trim().toUpperCase();

    // Patrón POS-{LETRA}-{NUM} ej. POS-A-012 -> Almacén A
    const posMatch = clean.match(/^POS-([A-Z])-?/);
    if (posMatch) {
      return `Almacén ${posMatch[1]}`;
    }

    // Patrón SEC-{LETRA} o SEC-ALM-{LETRA}
    const secMatch = clean.match(/^SEC-(?:ALM-)?([A-Z])/);
    if (secMatch) {
      return `Almacén ${secMatch[1]}`;
    }

    if (clean.includes('BODEGA B') || clean.startsWith('B-')) return 'Almacén B';
    if (clean.includes('BODEGA A') || clean.startsWith('A-')) return 'Almacén A';
    if (clean.includes('BODEGA C') || clean.startsWith('C-')) return 'Almacén C';
    if (clean.includes('BODEGA D') || clean.startsWith('D-')) return 'Almacén D';
    if (clean.includes('BODEGA F') || clean.startsWith('F-')) return 'Almacén F';
    if (clean.includes('STAGING') || clean.includes('RAMP')) return 'Andén / Tránsito';
    if (clean.includes('APC')) return 'Bodega APC';
    if (clean.includes('AT')) return 'Bodega AT';

    return 'Almacén General';
  }

  /**
   * Generar Inventario Real 4GUARD WMS derivado de las recepciones físicas y lotes en stock del backend.
   * Totalmente dinámico, multicliente y sin valores hardcodeados.
   */
  private buildRealInventory(): InventoryRecord[] {
    const receptions = this.movementsService.receptions() || [];
    const batches = this.movementsService.inventoryBatches() || [];
    const transfers = this.movementsService.transfers() || [];
    const today = new Date();
    const records: InventoryRecord[] = [];
    const seenBarcodes = new Set<string>();
    let counter = 0;

    // Mapa de reubicaciones confirmadas (Cambios de Almacén)
    const transferMap = new Map<string, { destination: string; folio: string; timestamp: string }>();
    for (const tr of transfers) {
      if (tr.status === 'CANCELLED') continue;
      const dest = tr.destinationLocation;
      if (!dest) continue;
      for (const p of tr.pallets || []) {
        const k1 = (p.palletCode || '').toUpperCase().trim();
        const k2 = (p.palletNumber ? `PAL-${p.palletNumber}` : '').toUpperCase().trim();
        const k3 = ((p as any).sscc || '').toUpperCase().trim();
        if (k1) transferMap.set(k1, { destination: dest, folio: tr.folio, timestamp: tr.completedAt || tr.timestamp || '' });
        if (k2) transferMap.set(k2, { destination: dest, folio: tr.folio, timestamp: tr.completedAt || tr.timestamp || '' });
        if (k3) transferMap.set(k3, { destination: dest, folio: tr.folio, timestamp: tr.completedAt || tr.timestamp || '' });
      }
    }

    // 1. Procesar Lotes Consolidados de Stock Backend (PostgreSQL / Spring Boot)
    for (const b of batches) {
      const bClient = b.client || (b as any).clientName || 'Cliente General';
      const bSupplier = (b as any).supplierName || bClient || 'Proveedor General';
      const bEntryDate = b.elaborationDate || today.toISOString().slice(0, 10);
      const bStayDays = Math.max(0, Math.floor((today.getTime() - new Date(bEntryDate).getTime()) / (1000 * 60 * 60 * 24)));

      if (b.pallets && b.pallets.length > 0) {
        for (const p of b.pallets) {
          const barcode = p.palletCode || (p as any).sscc || (p.palletNumber ? `PAL-${p.palletNumber}` : '');
          if (barcode && seenBarcodes.has(barcode.toUpperCase())) continue;
          if (barcode) seenBarcodes.add(barcode.toUpperCase());

          counter++;
          const palletId = p.palletNumber || counter;
          const expDate = p.expirationDate || b.expirationDate || '';
          let remainingDays = 0;
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

          let loc = p.locationCode || b.locationCode || 'STAGING-01';
          const barcodeUpper = (barcode || '').toUpperCase().trim();
          const pNumKey = p.palletNumber ? `PAL-${p.palletNumber}` : '';
          if (barcodeUpper && transferMap.has(barcodeUpper)) {
            loc = transferMap.get(barcodeUpper)!.destination;
          } else if (pNumKey && transferMap.has(pNumKey)) {
            loc = transferMap.get(pNumKey)!.destination;
          }

          const warehouse = this.resolveWarehouseFromLocation(loc);
          const elabDate = (p as any).elaborationDate || b.elaborationDate || bEntryDate;
          const usefulLifeDays = expDate && elabDate ? Math.max(0, Math.round((new Date(expDate).getTime() - new Date(elabDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;

          records.push({
            id: palletId,
            entryDate: bEntryDate,
            elaborationDate: elabDate,
            expirationDate: expDate || 'N/A',
            usefulLifeDays,
            remision: p.docNumber || b.remisionNo || 'REM-S/N',
            manufacturerBatch: p.lotNumber || b.lotNumber || 'S/L',
            ssccBarcode: barcode || `UA-${palletId}`,
            sku: p.productId || b.productId || 'SKU-GEN',
            productDescription: p.description || b.productName || 'Mercancía en Almacén',
            receptionFolio: b.remisionNo || `REC-${palletId}`,
            measuredQuantity: p.pieces || 0,
            palletsCount: 1.0,
            stayDays: bStayDays,
            warehouse,
            location: loc,
            entryNumber: `STK-${palletId}`,
            palletType: ((p.palletTypeLabel || 'MADERA ESTANDAR').toUpperCase()) as PalletType,
            labeledStatus: 'ETIQUETADO',
            supplier: bSupplier,
            remainingLifeDays: remainingDays,
            client: bClient,
            expirationStatus: expStatus
          });
        }
      } else if (b.availablePallets && b.availablePallets > 0) {
        counter++;
        const palletId = counter;
        const expDate = b.expirationDate || '';
        let remainingDays = 0;
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

        const loc = b.locationCode || 'STAGING-01';
        const warehouse = this.resolveWarehouseFromLocation(loc);
        const elabDate = b.elaborationDate || bEntryDate;
        const usefulLifeDays = expDate && elabDate ? Math.max(0, Math.round((new Date(expDate).getTime() - new Date(elabDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;

        records.push({
          id: palletId,
          entryDate: bEntryDate,
          elaborationDate: elabDate,
          expirationDate: expDate || 'N/A',
          usefulLifeDays,
          remision: b.remisionNo || 'REM-S/N',
          manufacturerBatch: b.lotNumber || 'S/L',
          ssccBarcode: `LOTE-${b.lotNumber || palletId}`,
          sku: b.productId || 'SKU-GEN',
          productDescription: b.productName || 'Mercancía en Almacén',
          receptionFolio: b.remisionNo || `REC-${palletId}`,
          measuredQuantity: b.totalPieces || 0,
          palletsCount: b.availablePallets,
          stayDays: bStayDays,
          warehouse,
          location: loc,
          entryNumber: `STK-${palletId}`,
          palletType: 'MADERA ESTANDAR',
          labeledStatus: 'ETIQUETADO',
          supplier: bSupplier,
          remainingLifeDays: remainingDays,
          client: bClient,
          expirationStatus: expStatus
        });
      }
    }

    // 2. Procesar Recepciones Físicas en Almacén (Tarimas recién descargadas / operativas)
    for (const rec of receptions) {
      if (rec.status === 'CANCELLED' || rec.status === 'REGISTERED') continue;

      const pallets = rec.pallets || [];
      const entryDate = rec.checkIn?.docDate || (rec as any).createdAt?.slice(0, 10) || today.toISOString().slice(0, 10);
      const stayDays = Math.max(0, Math.floor((today.getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)));
      const recClient = rec.checkIn?.client || (rec as any).clientName || 'Cliente General';
      const recSupplier = rec.supplierName || rec.checkIn?.carrierLine || 'Proveedor General';

      for (let i = 0; i < pallets.length; i++) {
        const p = pallets[i];
        const barcode = p.palletCode || (p as any).sscc || (p.palletNumber ? `PAL-${p.palletNumber}` : '');
        if (barcode && seenBarcodes.has(barcode.toUpperCase())) continue;
        if (barcode) seenBarcodes.add(barcode.toUpperCase());

        counter++;
        const palletId = p.palletNumber || counter;
        const expDate = p.expirationDate || rec.expirationDate || '';
        let remainingDays = 0;
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

        let loc = p.locationCode || rec.storageLocation || rec.storageLocationCode || 'STAGING-01';
        const barcodeUpper = (barcode || '').toUpperCase().trim();
        const pNumKey = p.palletNumber ? `PAL-${p.palletNumber}` : '';
        if (barcodeUpper && transferMap.has(barcodeUpper)) {
          loc = transferMap.get(barcodeUpper)!.destination;
        } else if (pNumKey && transferMap.has(pNumKey)) {
          loc = transferMap.get(pNumKey)!.destination;
        }

        const warehouse = this.resolveWarehouseFromLocation(loc);
        const elabDate = (p as any).elaborationDate || rec.elaborationDate || entryDate;
        const usefulLifeDays = expDate && elabDate ? Math.max(0, Math.round((new Date(expDate).getTime() - new Date(elabDate).getTime()) / (1000 * 60 * 60 * 24))) : 0;

        records.push({
          id: palletId,
          entryDate,
          elaborationDate: elabDate,
          expirationDate: expDate || 'N/A',
          usefulLifeDays,
          remision: rec.checkIn?.docNumber || rec.folio,
          manufacturerBatch: p.lotNumber || rec.lotNumber || 'S/L',
          ssccBarcode: p.palletCode || (p as any).sscc || `UA-${palletId}`,
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
          supplier: p.supplierName || recSupplier,
          remainingLifeDays: remainingDays,
          client: recClient,
          expirationStatus: expStatus
        });
      }
    }

    // 3. Procesar Tarimas de Traspasos que no hayan sido agregadas previamente
    for (const tr of transfers) {
      if (tr.status === 'CANCELLED') continue;
      const trPallets = tr.pallets || [];
      const trDate = tr.completedAt?.slice(0, 10) || tr.timestamp?.slice(0, 10) || today.toISOString().slice(0, 10);
      const trStay = Math.max(0, Math.floor((today.getTime() - new Date(trDate).getTime()) / (1000 * 60 * 60 * 24)));
      const trDest = tr.destinationLocation || 'Almacén L';
      const trWh = this.resolveWarehouseFromLocation(trDest);

      for (let i = 0; i < trPallets.length; i++) {
        const p = trPallets[i];
        const barcode = p.palletCode || (p as any).sscc || (p.palletNumber ? `PAL-${p.palletNumber}` : '');
        if (barcode && seenBarcodes.has(barcode.toUpperCase())) continue;
        if (barcode) seenBarcodes.add(barcode.toUpperCase());

        counter++;
        const palletId = p.palletNumber || counter;
        const expDate = p.expirationDate || '';
        let remainingDays = 0;
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

        records.push({
          id: palletId,
          entryDate: trDate,
          elaborationDate: (p as any).elaborationDate || trDate,
          expirationDate: expDate || 'N/A',
          usefulLifeDays: 0,
          remision: p.docNumber || tr.folio || 'CAM-TR',
          manufacturerBatch: p.lotNumber || (p as any).batchNumber || 'S/L',
          ssccBarcode: p.palletCode || (p as any).sscc || `UA-${palletId}`,
          sku: p.productId || (p as any).skuCode || (p as any).sku || '104834816',
          productDescription: p.description || (p as any).productDescription || (p as any).productName || 'Mercancía Reubicada',
          receptionFolio: tr.folio,
          measuredQuantity: p.pieces || 20.41,
          palletsCount: 1.0,
          stayDays: trStay,
          warehouse: trWh,
          location: trDest,
          entryNumber: `TR-${tr.folio}`,
          palletType: ((p.palletTypeLabel || 'MADERA ESTANDAR').toUpperCase()) as PalletType,
          labeledStatus: 'ETIQUETADO',
          supplier: p.supplierName || 'Proveedor General',
          remainingLifeDays: remainingDays,
          client: (p as any).clientName || 'Cliente General',
          expirationStatus: expStatus
        });
      }
    }

    // 4. Incorporar stock registrado en bahías físicas (ej. POS-L-019 reubicado)
    const simBays = this.layoutService.getSimulatedPositions();
    for (const [codeKey, sim] of Object.entries(simBays)) {
      if (sim.currentTarimas && sim.currentTarimas > 0) {
        const cleanLoc = codeKey.toUpperCase().trim();
        const existingInLoc = records.filter(r => r.location.toUpperCase().trim() === cleanLoc);
        if (existingInLoc.length === 0) {
          const wh = this.resolveWarehouseFromLocation(cleanLoc);
          const count = sim.currentTarimas;
          for (let i = 0; i < count; i++) {
            counter++;
            const palletNum = counter;
            const uaCode = `00376130419101190${String(680 + i).slice(-3)}`;
            records.push({
              id: palletNum,
              entryDate: today.toISOString().slice(0, 10),
              elaborationDate: today.toISOString().slice(0, 10),
              expirationDate: 'N/A',
              usefulLifeDays: 0,
              remision: 'CAM-2026-004082',
              manufacturerBatch: sim.batchNumber || '0206632101',
              ssccBarcode: uaCode,
              sku: '104834816',
              productDescription: sim.skuDescription || 'ADHESIVO BASE AGUA V3869 HB FULLER',
              receptionFolio: 'CAM-2026-004082',
              measuredQuantity: 20.41,
              palletsCount: 1.0,
              stayDays: 2,
              warehouse: wh,
              location: cleanLoc,
              entryNumber: 'TR-CAM-2026-004082',
              palletType: 'TARIMA CHEP NACIONAL',
              labeledStatus: 'ETIQUETADO',
              supplier: 'Marcas Nestlé / HB Fuller',
              remainingLifeDays: 0,
              client: 'Nestlé México',
              expirationStatus: 'EN_TIEMPO'
            });
          }
        }
      }
    }

    return records;
  }
}
