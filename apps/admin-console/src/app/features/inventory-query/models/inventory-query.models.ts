/**
 * @file inventory-query.models.ts
 * @description Modelos TypeScript, interfaces y tipos para el módulo Consulta de Inventarios 4GUARD WMS.
 */

export type ExpirationFilterMode = 'GENERAL' | 'CADUCO' | 'TIEMPO_30_DIAS';

export type PalletType =
  | 'CHEP'
  | 'MADERA'
  | 'PLASTICO'
  | 'SUPERIOR'
  | 'EURO'
  | 'RETORNABLE'
  | 'ESTANDAR';

export type LabeledStatus = 'ETIQUETADO' | 'PENDIENTE' | 'OBSOLETO';

export type ExpirationBadgeStatus = 'EN_TIEMPO' | 'PROXIMO_30_DIAS' | 'CADUCO';

/**
 * Registro completo de Inventario (contiene las 21 columnas oficiales de 4Guard WMS)
 */
export interface InventoryRecord {
  id: number; // 1. NO. (ID Consecutivo histórico de Palet, ej. 563633)
  entryDate: string; // 2. FECHA INGRESO (YYYY-MM-DD)
  elaborationDate: string; // 3. FECHA ELABORACIÓN (YYYY-MM-DD)
  expirationDate: string; // 4. FECHA CADUCIDAD (YYYY-MM-DD)
  usefulLifeDays: number; // 5. DÍAS VIDA ÚTIL
  remision: string; // 6. REMISIÓN (Factura / Remisión)
  manufacturerBatch: string; // 7. LOTE FABRICANTE
  ssccBarcode: string; // 8. ETIQUETA UA (Código de Barras SSCC de la Tarima)
  sku: string; // 9. SKU
  productDescription: string; // 10. DESCRIPCIÓN PRODUCTO
  receptionFolio: string; // 11. FOLIO RECEPCIÓN (No. de Entrada)
  measuredQuantity: number; // 12. CANTIDAD MEDIDA (Piezas)
  palletsCount: number; // 13. PALLETS (Cantidad de tarimas, ej. 1.00)
  stayDays: number; // 14. ESTADÍA (Días transcurridos en almacén desde ingreso)
  warehouse: string; // 15. ALMACÉN (Bodega A, B, APC, AT, BT, etc.)
  location: string; // 16. NÚMERO / UBICACIÓN (Posición física, ej. A-02-14)
  entryNumber: string; // 17. NO. ENTRADA (Folio físico de recepción)
  palletType: PalletType; // 18. TIPO TARIMA
  labeledStatus: LabeledStatus; // 19. ETIQUETADA
  supplier: string; // 20. PROVEEDOR
  remainingLifeDays: number; // 21a. VIDA RESTANTE (Días faltantes para caducar)
  client: string; // 21b. CLIENTE
  expirationStatus: ExpirationBadgeStatus; // Badge calculado de caducidad
}

/**
 * Criterios de filtrado multicriterio del modal
 */
export interface InventoryFilterCriteria {
  // Rangos de Fechas (Desde - Hasta)
  entryDateFrom?: string | null;
  entryDateTo?: string | null;
  elaborationDateFrom?: string | null;
  elaborationDateTo?: string | null;
  expirationDateFrom?: string | null;
  expirationDateTo?: string | null;

  // Campos de texto / buscadores
  remision?: string | null;
  sku?: string | null;
  productDescription?: string | null;
  location?: string | null;
  supplier?: string | null;
  client?: string | null;

  // Dropdowns
  palletType?: PalletType | '' | null;
  labeledStatus?: LabeledStatus | '' | null;

  // Radio Buttons de Regla de Pablo
  expirationMode: ExpirationFilterMode;
}

/**
 * Resumen de KPIs superiores
 */
export interface InventoryKpiSummary {
  totalPallets: number;
  totalPieces: number;
  expiringNext30Days: number;
  avgStayDays: number;
}

/**
 * Punto de datos para modal de analítica histórica por año
 */
export interface InventoryAnalyticsPoint {
  year: number;
  totalPallets: number;
  totalPieces: number;
  sampleFolioRange: string;
}
