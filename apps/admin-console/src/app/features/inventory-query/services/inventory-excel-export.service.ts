/**
 * @file inventory-excel-export.service.ts
 * @description Motor de Exportación a Excel profesional para 4GUARD WMS (21 columnas oficiales + Totales).
 */

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { InventoryRecord } from '../models/inventory-query.models';

@Injectable({
  providedIn: 'root'
})
export class InventoryExcelExportService {
  /**
   * Genera y descarga el archivo .xlsx con las 21 columnas oficiales y formato corporativo 4GUARD.
   * @param records Lista de registros filtrados de inventario
   * @param customFileName Nombre personalizado del archivo generado (opcional)
   */
  public exportToExcel(records: InventoryRecord[], customFileName?: string): void {
    if (!records || records.length === 0) {
      alert('No hay datos en pantalla para exportar a Excel.');
      return;
    }

    // 1. Mapeo de Filas con las 21 Columnas Operativas Oficiales de 4Guard
    const rows = records.map((r) => ({
      'NO.': `#${r.id}`,
      'FECHA INGRESO': r.entryDate,
      'FECHA ELABORACIÓN': r.elaborationDate,
      'FECHA CADUCIDAD': r.expirationDate,
      'DÍAS VIDA ÚTIL': r.usefulLifeDays,
      'REMISIÓN': r.remision,
      'LOTE FABRICANTE': r.manufacturerBatch,
      'ETIQUETA UA': r.ssccBarcode,
      'SKU': r.sku,
      'DESCRIPCIÓN PRODUCTO': r.productDescription,
      'FOLIO RECEPCIÓN': r.receptionFolio,
      'CANTIDAD MEDIDA': r.measuredQuantity,
      'PALLETS': r.palletsCount,
      'ESTADÍA': `${r.stayDays} Días`,
      'ALMACÉN': r.warehouse,
      'NÚMERO / UBICACIÓN': r.location,
      'NO. ENTRADA': r.entryNumber,
      'TIPO TARIMA': r.palletType,
      'ETIQUETADA': r.labeledStatus,
      'PROVEEDOR': r.supplier,
      'VIDA RESTANTE Y CLIENTE': `${r.remainingLifeDays}d | ${r.client}`
    }));

    // 2. Fila de Totales al final sumando TOTAL PALLETS y TOTAL PIEZAS
    const totalPallets = records.reduce((sum, r) => sum + r.palletsCount, 0);
    const totalPieces = records.reduce((sum, r) => sum + r.measuredQuantity, 0);

    const totalsRow = {
      'NO.': 'TOTALES 4GUARD',
      'FECHA INGRESO': '',
      'FECHA ELABORACIÓN': '',
      'FECHA CADUCIDAD': '',
      'DÍAS VIDA ÚTIL': '',
      'REMISIÓN': '',
      'LOTE FABRICANTE': '',
      'ETIQUETA UA': '',
      'SKU': '',
      'DESCRIPCIÓN PRODUCTO': 'SUMATORIA GLOBAL DE STOCK',
      'FOLIO RECEPCIÓN': '',
      'CANTIDAD MEDIDA': totalPieces,
      'PALLETS': Math.round(totalPallets * 100) / 100,
      'ESTADÍA': '',
      'ALMACÉN': '',
      'NÚMERO / UBICACIÓN': '',
      'NO. ENTRADA': '',
      'TIPO TARIMA': '',
      'ETIQUETADA': '',
      'PROVEEDOR': '',
      'VIDA RESTANTE Y CLIENTE': `${records.length} Regs`
    };

    const exportData = [...rows, totalsRow];

    // 3. Crear Hoja de Trabajo (Worksheet) de SheetJS
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // 4. Ancho automático sugerido para las 21 columnas
    worksheet['!cols'] = [
      { wch: 12 }, // NO.
      { wch: 15 }, // FECHA INGRESO
      { wch: 16 }, // FECHA ELABORACIÓN
      { wch: 16 }, // FECHA CADUCIDAD
      { wch: 15 }, // DÍAS VIDA ÚTIL
      { wch: 15 }, // REMISIÓN
      { wch: 18 }, // LOTE FABRICANTE
      { wch: 22 }, // ETIQUETA UA
      { wch: 16 }, // SKU
      { wch: 38 }, // DESCRIPCIÓN PRODUCTO
      { wch: 18 }, // FOLIO RECEPCIÓN
      { wch: 18 }, // CANTIDAD MEDIDA
      { wch: 12 }, // PALLETS
      { wch: 12 }, // ESTADÍA
      { wch: 14 }, // ALMACÉN
      { wch: 18 }, // NÚMERO / UBICACIÓN
      { wch: 15 }, // NO. ENTRADA
      { wch: 15 }, // TIPO TARIMA
      { wch: 15 }, // ETIQUETADA
      { wch: 28 }, // PROVEEDOR
      { wch: 32 }  // VIDA RESTANTE Y CLIENTE
    ];

    // 5. Crear Libro de Trabajo (Workbook)
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Consulta_Inventario_4GUARD');

    // 6. Generar nombre de archivo con marca de tiempo
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = customFileName || `4GUARD_WMS_Consulta_Inventarios_${dateStamp}.xlsx`;

    // 7. Descargar el archivo .xlsx
    XLSX.writeFile(workbook, fileName);
  }
}
