/**
 * @file products-catalog.models.ts
 * @description Modelos e interfaces para el Catálogo de Productos/SKUs en 4GUARD WMS.
 * Cumple con la regla NOM-251 de inactivación (sin borrado físico) y los 20 proveedores oficiales.
 */

export type UnitOfMeasure = 'PZA' | 'KG' | 'L' | 'CAJ' | 'TMB' | 'TAR';

export interface UomOption {
  code: UnitOfMeasure;
  label: string;
}

export const UOM_OPTIONS: UomOption[] = [
  { code: 'PZA', label: 'Piezas [PZA]' },
  { code: 'KG', label: 'Kilos [KG]' },
  { code: 'L', label: 'Litros [L]' },
  { code: 'CAJ', label: 'Cajas [CAJ]' },
  { code: 'TMB', label: 'Tambores [TMB]' },
  { code: 'TAR', label: 'Tarimas [TAR]' },
];

export const OFFICIAL_4GUARD_SUPPLIERS: string[] = [
  'GLASS MEXICO',
  'ADEGERMEX',
  'AMCOR',
  'APTAR',
  'ARLA FOODS',
  'ARTES GRAFICAS',
  'BEMIS',
  'BIO PAPPEL',
  'CHEP MEXICO',
  'CONVERTIDORA GMV',
  'COPAMEX',
  'CRODA',
  'DAIRY FARMERS',
  'DESCAFEINADORES',
  'EDELPAME',
  'EMPAQUES AMERICA',
  'EMPAQUES SAN PABLO',
  'FUJI SEAL',
  'PACKAGING CORP',
  'SMURFIT KAPPA',
];

export type ExpirationCriticality = 'ACEPTABLE' | 'PRECAUCION' | 'CRITICO';

export interface CatalogProduct {
  id: string;
  sku: string;
  description: string;
  lotNumber: string;
  supplier: string;
  uom: UnitOfMeasure;
  expirationDays: number;
  status: 'ACTIVO' | 'INACTIVO';
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  sku: string;
  description: string;
  lotNumber: string;
  supplier: string;
  uom: UnitOfMeasure;
  expirationDays: number;
}

/**
 * Retorna la criticidad del producto según días de caducidad (Cumplimiento NOM-251):
 * > 90 días -> Verde (Aceptable)
 * 30 a 90 días -> Amarillo (Precaución)
 * < 30 días -> Rojo (Crítico / NOM-251)
 */
export function getExpirationCriticality(days: number): ExpirationCriticality {
  if (days > 90) return 'ACEPTABLE';
  if (days >= 30) return 'PRECAUCION';
  return 'CRITICO';
}
