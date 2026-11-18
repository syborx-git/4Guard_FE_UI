/**
 * @file receiving-excel-export.service.ts
 * @description Generador Oficial de Archivo Excel "INVENTARIOS 4GUARD .XLSX" para Recepción y Captura de Datos.
 * Réplica idéntica al formato corporativo oficial de 4GUARD con hojas ALMACEN A, ALMACEN B y Hoja 2.
 */

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import { ReceptionHeader, ReceptionPalletItem } from '../models/warehouse-movements.models';

const PALETTE = {
  TEAL_HEADER: '38D39F',    // Verde azulado / Teal oficial de columnas principales
  ORANGE_HEADER: 'E59866',  // Naranja / Ocre para Ubicacion sys y Nivel de estiba
  HEADER_EMPTY: 'F1F5F9',   // Columna # índice
  TEXT_DARK: '0F172A',
  BORDER_COLOR: 'CBD5E1',
  WHITE: 'FFFFFF'
};

const BORDER_STYLE = {
  top: { style: 'thin', color: { rgb: PALETTE.BORDER_COLOR } },
  bottom: { style: 'thin', color: { rgb: PALETTE.BORDER_COLOR } },
  left: { style: 'thin', color: { rgb: PALETTE.BORDER_COLOR } },
  right: { style: 'thin', color: { rgb: PALETTE.BORDER_COLOR } }
};

const STYLES = {
  headerEmpty: {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: PALETTE.TEXT_DARK } },
    fill: { fgColor: { rgb: PALETTE.HEADER_EMPTY } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  },
  headerTeal: {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: PALETTE.TEAL_HEADER } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDER_STYLE
  },
  headerOrange: {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: PALETTE.ORANGE_HEADER } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDER_STYLE
  },
  cellCenter: {
    font: { name: 'Arial', sz: 10, color: { rgb: PALETTE.TEXT_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: BORDER_STYLE
  },
  cellLeft: {
    font: { name: 'Arial', sz: 10, color: { rgb: PALETTE.TEXT_DARK } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: BORDER_STYLE
  },
  cellRight: {
    font: { name: 'Arial', sz: 10, color: { rgb: PALETTE.TEXT_DARK } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: BORDER_STYLE
  }
};

@Injectable({
  providedIn: 'root'
})
export class ReceivingExcelExportService {

  /**
   * Da formato estándar DD/MM/YYYY a cualquier fecha ISO o con separadores
   */
  private formatCaducidad(rawDate?: string): string {
    if (!rawDate) return '';
    const clean = String(rawDate).trim();
    // Caso YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const parts = clean.split('T')[0].split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    // Caso DD.MM.YYYY
    if (/^\d{2}\.\d{2}\.\d{4}/.test(clean)) {
      const parts = clean.split('.');
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    // Caso DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(clean)) {
      return clean;
    }
    // Fecha normal Date parseable
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return clean;
  }

  /**
   * Genera el libro Excel con diseño exacto de Google Sheets:
   * 10 Columnas: #, ALMACEN, UBICACION, UA, SKU, DESCRIPCION, REMISIÓN, FECHA DE CADUCIDAD, Ubicacion sys, NIVEL DE ESTIBA
   * Pestañas: 'ALMACEN A', 'ALMACEN B', 'Hoja 2'
   */
  public exportInventarioExcel(rec: ReceptionHeader, pallets: ReceptionPalletItem[]): void {
    const wb = XLSX.utils.book_new();

    const headers = [
      '',
      'ALMACEN',
      'UBICACION',
      'UA',
      'SKU',
      'DESCRIPCION',
      'REMISIÓN',
      'FECHA DE CADUCIDAD',
      'Ubicacion sys',
      'NIVEL DE ESTIBA'
    ];

    // Construcción de filas de datos
    const rowsData: any[][] = [];
    rowsData.push(headers);

    const remisionDefault = rec?.folio ? (rec.folio.includes('--') ? rec.folio : `${rec.folio}--P`) : (rec?.checkIn?.docNumber || '8702690935--P');
    const ubicacionDefault = (rec?.checkIn as any)?.bayWmsAssigned || rec?.checkIn?.stagingBay || 'A7';
    const ubicacionSysDefault = 'BODEGA AT 2';

    pallets.forEach((p, idx) => {
      const consecutivo = idx + 1;
      const almacen = 'A';
      const ubicacion = p.locationCode || ubicacionDefault;
      const uaCode = String(p.palletCode || '').trim();
      const sku = String(p.productId || rec?.productId || rec?.skuCode || '').trim();
      const desc = String(p.description || rec?.productName || '').trim();
      const remision = p.docNumber ? (p.docNumber.includes('--') ? p.docNumber : `${p.docNumber}--P`) : remisionDefault;
      const caducidad = this.formatCaducidad(p.expirationDate || rec?.expirationDate);
      const ubicacionSys = ubicacionSysDefault;
      const nivelEstiba = '';

      rowsData.push([
        consecutivo,
        almacen,
        ubicacion,
        uaCode,
        sku,
        desc,
        remision,
        caducidad,
        ubicacionSys,
        nivelEstiba
      ]);
    });

    // 1. Hoja ALMACEN A
    const wsA = XLSX.utils.aoa_to_sheet(rowsData);
    this.styleSheet(wsA, rowsData.length, headers.length);
    XLSX.utils.book_append_sheet(wb, wsA, 'ALMACEN A');

    // 2. Hoja ALMACEN B (misma cabecera y estructura)
    const wsB = XLSX.utils.aoa_to_sheet([headers]);
    this.styleSheet(wsB, 1, headers.length);
    XLSX.utils.book_append_sheet(wb, wsB, 'ALMACEN B');

    // 3. Hoja 'Hoja 2'
    const ws2 = XLSX.utils.aoa_to_sheet([[]]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Hoja 2');

    // Descarga directa con el nombre exacto solicitado
    XLSX.writeFile(wb, 'INVENTARIOS 4GUARD .XLSX');
  }

  /**
   * Normaliza cualquier formato de fecha proveniente de Excel (Date, serial number, string DD/MM/YYYY)
   * hacia formato estándar ISO 'YYYY-MM-DD' para compatibilidad completa con el WMS.
   */
  public normalizeCaducidad(val: any): string {
    if (!val) return '';
    if (val instanceof Date) {
      if (!isNaN(val.getTime())) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    if (typeof val === 'number') {
      try {
        const d = new Date((val - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) {
          const year = d.getUTCFullYear();
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch {}
    }
    const str = String(val).trim();
    // DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str;
  }

  /**
   * Lee un archivo Excel (.xlsx / .xls) subido por el usuario y extrae las tarimas
   * mapeadas a ReceptionPalletItem respetando las columnas estándar del WMS.
   */
  public async parseInventarioExcel(file: File, rec: ReceptionHeader): Promise<ReceptionPalletItem[]> {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    // Seleccionar la hoja: preferir 'ALMACEN A', si no la primera que tenga contenido
    let sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('ALMACEN A') || n.toUpperCase().includes('ALMACÉN A'));
    if (!sheetName) {
      sheetName = workbook.SheetNames[0];
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('El archivo Excel no contiene hojas de datos legibles.');
    }

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawRows || rawRows.length < 2) {
      throw new Error('La hoja seleccionada está vacía o no contiene filas de tarimas.');
    }

    // Identificar fila de encabezados buscando palabras clave
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
      const row = rawRows[i].map(c => String(c).trim().toUpperCase());
      if (row.includes('UA') || row.includes('SKU') || row.includes('CODIGO TARIMA') || row.includes('DESCRIPCION') || row.includes('DESCRIPCIÓN')) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const headers = rawRows[headerRowIdx].map(c => String(c).trim().toUpperCase());

    const findColIdx = (keywords: string[]): number => {
      return headers.findIndex(h => keywords.some(k => h === k || h.includes(k)));
    };

    const uaIdx = findColIdx(['UA', 'CODIGO TARIMA', 'CODIGO', 'SSCC']);
    const skuIdx = findColIdx(['SKU', 'CODIGO PRODUCTO', 'PRODUCTO']);
    const descIdx = findColIdx(['DESCRIPCION', 'DESCRIPCIÓN', 'NOMBRE PRODUCTO']);
    const locIdx = findColIdx(['UBICACION', 'UBICACIÓN', 'POSICION', 'POSICIÓN']);
    const remIdx = findColIdx(['REMISIÓN', 'REMISION', 'FACTURA', 'DOC']);
    const cadIdx = findColIdx(['FECHA DE CADUCIDAD', 'CADUCIDAD', 'EXPIRACION', 'EXPIRACIÓN', 'VENCIMIENTO']);
    const piecesIdx = findColIdx(['PIEZAS', 'CANTIDAD', 'CANT X TARIMA', 'PZAS']);
    const lotIdx = findColIdx(['LOTE', 'LOT']);

    const defaultPieces = rec?.piecesPerPallet || 135;
    const defaultLot = rec?.lotNumber || (rec?.checkIn as any)?.lotNumber || 'LOT-2026-01';
    const defaultDoc = rec?.folio || rec?.checkIn?.docNumber || 'REM-INBOUND';
    const defaultSupplier = rec?.checkIn?.client || rec?.supplierName || 'Proveedor General';
    const defaultLocation = (rec?.checkIn as any)?.bayWmsAssigned || rec?.storageLocation || 'BAHÍA-RECEPCIÓN';

    const pallets: ReceptionPalletItem[] = [];
    const rows = rawRows.slice(headerRowIdx + 1);

    rows.forEach((r, idx) => {
      if (!r || r.every(cell => String(cell).trim() === '')) return;

      const uaRaw = uaIdx !== -1 ? String(r[uaIdx] || '').trim() : '';
      const skuRaw = skuIdx !== -1 ? String(r[skuIdx] || '').trim() : '';
      if (!uaRaw && !skuRaw) return;

      const consecutivo = idx + 1;
      const uaCode = uaRaw || `UA-${Date.now()}-${String(consecutivo).padStart(4, '0')}`;
      const sku = skuRaw || (rec?.productId || 'SKU-INBOUND');
      const desc = descIdx !== -1 && r[descIdx] ? String(r[descIdx]).trim() : (rec?.productName || 'Producto General');
      const loc = locIdx !== -1 && r[locIdx] ? String(r[locIdx]).trim() : defaultLocation;
      const doc = remIdx !== -1 && r[remIdx] ? String(r[remIdx]).trim() : defaultDoc;

      let caducidad = '';
      if (cadIdx !== -1 && r[cadIdx]) {
        caducidad = this.normalizeCaducidad(r[cadIdx]);
      } else {
        caducidad = rec?.expirationDate || new Date(Date.now() + 31536000000).toISOString().slice(0, 10);
      }

      const pzas = piecesIdx !== -1 && Number(r[piecesIdx]) > 0 ? Number(r[piecesIdx]) : defaultPieces;
      const lote = lotIdx !== -1 && r[lotIdx] ? String(r[lotIdx]).trim().toUpperCase() : defaultLot;

      pallets.push({
        id: `pallet-import-${Date.now()}-${consecutivo}`,
        palletNumber: consecutivo,
        palletCode: uaCode,
        description: desc,
        productId: sku,
        supplierName: defaultSupplier,
        pieces: pzas,
        observations: 'Cargado vía Excel',
        palletTypeId: 'MADERA_ESTANDAR',
        palletTypeLabel: 'Madera Estándar',
        lotNumber: lote,
        expirationDate: caducidad,
        docNumber: doc,
        locationCode: loc,
        status: 'SCANNED'
      });
    });

    return pallets;
  }

  private styleSheet(ws: any, rowCount: number, colCount: number): void {
    // Configuración de anchos de columna óptimos
    ws['!cols'] = [
      { wch: 6 },   // #
      { wch: 14 },  // ALMACEN
      { wch: 15 },  // UBICACION
      { wch: 28 },  // UA
      { wch: 16 },  // SKU
      { wch: 48 },  // DESCRIPCION
      { wch: 20 },  // REMISIÓN
      { wch: 24 },  // FECHA DE CADUCIDAD
      { wch: 20 },  // Ubicacion sys
      { wch: 18 }   // NIVEL DE ESTIBA
    ];

    // Estilos celda por celda
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { t: 's', v: '' };
        }

        if (r === 0) {
          // Fila de Encabezados
          if (c === 0) {
            ws[cellRef].s = STYLES.headerEmpty;
          } else if (c >= 1 && c <= 7) {
            ws[cellRef].s = STYLES.headerTeal;
          } else {
            ws[cellRef].s = STYLES.headerOrange;
          }
        } else {
          // Filas de Datos
          if (c === 0) {
            ws[cellRef].s = STYLES.cellCenter;
            ws[cellRef].t = 'n';
          } else if (c === 1 || c === 2 || c === 7) {
            ws[cellRef].s = STYLES.cellCenter;
            ws[cellRef].t = 's';
          } else if (c === 3 || c === 4) {
            ws[cellRef].s = STYLES.cellLeft;
            ws[cellRef].t = 's'; // Preserva ceros iniciales como string
          } else {
            ws[cellRef].s = STYLES.cellLeft;
            ws[cellRef].t = 's';
          }
        }
      }
    }
  }
}
