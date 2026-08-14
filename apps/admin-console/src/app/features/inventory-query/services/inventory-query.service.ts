/**
 * @file inventory-query.service.ts
 * @description Servicio reactivo unificado basado en Angular Signals para la Consulta de Inventarios WMS.
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  InventoryRecord,
  InventoryFilterCriteria,
  InventoryKpiSummary,
  InventoryAnalyticsPoint,
  ExpirationBadgeStatus
} from '../models/inventory-query.models';

@Injectable({
  providedIn: 'root'
})
export class InventoryQueryService {
  /** Registros crudos en stock (Muestra oficial completa de 4GUARD WMS) */
  private readonly _rawInventory = signal<InventoryRecord[]>(this.buildMockInventory());

  /** Criterios de filtrado activo */
  private readonly _activeFilters = signal<InventoryFilterCriteria>({
    expirationMode: 'GENERAL'
  });

  /** Exponer signals públicas de lectura */
  public readonly rawInventory = this._rawInventory.asReadonly();
  public readonly activeFilters = this._activeFilters.asReadonly();

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

      // 2. Rango Fechas Ingreso
      if (filters.entryDateFrom && rec.entryDate < filters.entryDateFrom) return false;
      if (filters.entryDateTo && rec.entryDate > filters.entryDateTo) return false;

      // 3. Rango Fechas Elaboración
      if (filters.elaborationDateFrom && rec.elaborationDate < filters.elaborationDateFrom) return false;
      if (filters.elaborationDateTo && rec.elaborationDate > filters.elaborationDateTo) return false;

      // 4. Rango Fechas Caducidad
      if (filters.expirationDateFrom && rec.expirationDate < filters.expirationDateFrom) return false;
      if (filters.expirationDateTo && rec.expirationDate > filters.expirationDateTo) return false;

      // 5. Textos / Buscadores (Coincidencia parcial sin distinción de mayúsculas)
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

      // 6. Dropdowns
      if (filters.palletType && rec.palletType !== filters.palletType) return false;
      if (filters.labeledStatus && rec.labeledStatus !== filters.labeledStatus) return false;

      return true;
    });
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
   * Generar Muestra Oficial de Datos de Inventario 4GUARD WMS
   */
  private buildMockInventory(): InventoryRecord[] {
    const today = new Date();
    
    const records: InventoryRecord[] = [
      {
        id: 563633,
        entryDate: '2026-02-10',
        elaborationDate: '2025-11-01',
        expirationDate: '2026-03-01', // Próximo 30 días (<16 días)
        usefulLifeDays: 120,
        remision: 'REM-89201',
        manufacturerBatch: 'LOTE-NEST-2025A',
        ssccBarcode: '750100982390192837',
        sku: 'SKU-NEST-001',
        productDescription: 'Fórmula Láctea Infantil Gold Pack 800g',
        receptionFolio: 'REC-2026-0045',
        measuredQuantity: 1440,
        palletsCount: 1.0,
        stayDays: 3,
        warehouse: 'Bodega A',
        location: 'A-02-14',
        entryNumber: 'ENT-2026-901',
        palletType: 'CHEP',
        labeledStatus: 'ETIQUETADO',
        supplier: 'Nestlé México S.A. de C.V.',
        remainingLifeDays: 16,
        client: 'Comercializadora Alpura S.A.',
        expirationStatus: 'PROXIMO_30_DIAS'
      },
      {
        id: 563634,
        entryDate: '2026-01-15',
        elaborationDate: '2025-08-10',
        expirationDate: '2026-02-05', // Caduco
        usefulLifeDays: 180,
        remision: 'REM-88120',
        manufacturerBatch: 'LOTE-BIM-991',
        ssccBarcode: '750100982390192838',
        sku: 'SKU-BIM-004',
        productDescription: 'Pan Dulce Nito Choco Pack 12PZ',
        receptionFolio: 'REC-2026-0012',
        measuredQuantity: 960,
        palletsCount: 1.0,
        stayDays: 29,
        warehouse: 'Bodega B',
        location: 'B-05-08',
        entryNumber: 'ENT-2026-812',
        palletType: 'MADERA',
        labeledStatus: 'ETIQUETADO',
        supplier: 'Grupo Bimbo S.A.B. de C.V.',
        remainingLifeDays: -8,
        client: 'Walmart de México VIPS',
        expirationStatus: 'CADUCO'
      },
      {
        id: 563635,
        entryDate: '2026-02-01',
        elaborationDate: '2025-12-01',
        expirationDate: '2026-12-01', // En tiempo
        usefulLifeDays: 365,
        remision: 'REM-90112',
        manufacturerBatch: 'LOTE-LIV-401',
        ssccBarcode: '750100982390192839',
        sku: 'SKU-LIV-010',
        productDescription: 'Aceite de Oliva Extra Virgen 1L',
        receptionFolio: 'REC-2026-0089',
        measuredQuantity: 720,
        palletsCount: 1.0,
        stayDays: 12,
        warehouse: 'Bodega APC',
        location: 'APC-01-02',
        entryNumber: 'ENT-2026-950',
        palletType: 'PLASTICO',
        labeledStatus: 'ETIQUETADO',
        supplier: 'Aceites y Grasas Liverpool S.A.',
        remainingLifeDays: 291,
        client: 'Soriana Supermercados',
        expirationStatus: 'EN_TIEMPO'
      },
      {
        id: 563636,
        entryDate: '2026-02-08',
        elaborationDate: '2025-10-15',
        expirationDate: '2026-03-05', // Próximo 30 días (20 días)
        usefulLifeDays: 140,
        remision: 'REM-91040',
        manufacturerBatch: 'LOTE-KOF-772',
        ssccBarcode: '750100982390192840',
        sku: 'SKU-KOF-002',
        productDescription: 'Refresco Coca-Cola Sin Azúcar 600ml NR',
        receptionFolio: 'REC-2026-0102',
        measuredQuantity: 1800,
        palletsCount: 1.0,
        stayDays: 5,
        warehouse: 'Bodega AT',
        location: 'AT-04-19',
        entryNumber: 'ENT-2026-988',
        palletType: 'SUPERIOR',
        labeledStatus: 'PENDIENTE',
        supplier: 'Coca-Cola FEMSA S.A.B. de C.V.',
        remainingLifeDays: 20,
        client: 'Chedraui Logística 3PL',
        expirationStatus: 'PROXIMO_30_DIAS'
      },
      {
        id: 563637,
        entryDate: '2025-11-20',
        elaborationDate: '2025-05-10',
        expirationDate: '2025-12-30', // Caduco
        usefulLifeDays: 200,
        remision: 'REM-77210',
        manufacturerBatch: 'LOTE-HER-119',
        ssccBarcode: '750100982390192841',
        sku: 'SKU-HER-005',
        productDescription: 'Cereal Avena Con Miel y Nueces 500g',
        receptionFolio: 'REC-2025-0912',
        measuredQuantity: 1200,
        palletsCount: 1.0,
        stayDays: 85,
        warehouse: 'Bodega BPC',
        location: 'BPC-02-05',
        entryNumber: 'ENT-2025-720',
        palletType: 'EURO',
        labeledStatus: 'OBSOLETO',
        supplier: 'Herdez Del Fuerte S.A.',
        remainingLifeDays: -45,
        client: 'La Comer Central 4G',
        expirationStatus: 'CADUCO'
      },
      {
        id: 563638,
        entryDate: '2026-02-12',
        elaborationDate: '2026-01-20',
        expirationDate: '2027-01-20', // En tiempo
        usefulLifeDays: 365,
        remision: 'REM-92100',
        manufacturerBatch: 'LOTE-ALN-330',
        ssccBarcode: '750100982390192842',
        sku: 'SKU-ALN-008',
        productDescription: 'Atún en Agua Lomo Entero 140g Pack 4PZ',
        receptionFolio: 'REC-2026-0130',
        measuredQuantity: 2400,
        palletsCount: 1.0,
        stayDays: 1,
        warehouse: 'Bodega BT',
        location: 'BT-01-01',
        entryNumber: 'ENT-2026-999',
        palletType: 'RETORNABLE',
        labeledStatus: 'ETIQUETADO',
        supplier: 'Alimentos Marinos S.A.',
        remainingLifeDays: 341,
        client: 'Comercializadora Alpura S.A.',
        expirationStatus: 'EN_TIEMPO'
      },
      {
        id: 563639,
        entryDate: '2026-02-05',
        elaborationDate: '2025-09-01',
        expirationDate: '2026-03-02', // Próximo 30 días (17 días)
        usefulLifeDays: 180,
        remision: 'REM-89912',
        manufacturerBatch: 'LOTE-LAL-882',
        ssccBarcode: '750100982390192843',
        sku: 'SKU-LAL-003',
        productDescription: 'Leche Entera UHT 1L Caja 12PZ',
        receptionFolio: 'REC-2026-0062',
        measuredQuantity: 1080,
        palletsCount: 1.0,
        stayDays: 8,
        warehouse: 'Bodega A',
        location: 'A-03-22',
        entryNumber: 'ENT-2026-922',
        palletType: 'ESTANDAR',
        labeledStatus: 'ETIQUETADO',
        supplier: 'Grupo Lala S.A.B. de C.V.',
        remainingLifeDays: 17,
        client: 'Walmart de México VIPS',
        expirationStatus: 'PROXIMO_30_DIAS'
      }
    ];

    return records;
  }
}
