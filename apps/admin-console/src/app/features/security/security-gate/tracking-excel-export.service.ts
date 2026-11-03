/**
 * @file tracking-excel-export.service.ts
 * @description Generador Oficial en Excel (.xlsx) del Formato Institucional:
 * F02-PO-CP-7.1.3-03 · TRACKING DE UNIDADES (Seguridad Patrimonial)
 *
 * Emisión: 19/08/2025 | No. de Revisión: 01
 * 4GUARD WMS 3PL Platform
 */

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';

export type ExportRangeType = 'TODAY' | 'YESTERDAY' | 'CURRENT_MONTH' | 'ALL';

export interface TrackingExportItem {
  id?: string;
  token?: string;
  generatedFolio?: string;
  folio?: string;
  fecha?: string;
  docDate?: string;
  createdAt?: string;
  submittedAt?: string;
  shift?: string;
  turno?: string;
  groupNumber?: string | number;
  grupo?: string | number;
  rampCode?: string;
  rampNumber?: number | string;
  assignedRamp?: string;
  noEcoTractor?: string;
  noEcoCaja?: string;
  tractorPlates?: string;
  boxPlates?: string;
  operacion?: string;
  operationType?: string;
  carrierLine?: string;
  carrierLineCode?: string;
  client?: string;
  clientName?: string;
  horaEntrada?: string;
  receptionTime?: string;
  rampAssignedAt?: string;
  authorizedAt?: string;
  checkoutTime?: string;
  horaSalida?: string;
  docNumber?: string;
  remision?: string;
  noCartaPorte?: string;
  exitDocNumber?: string;
  responsableVigilanciaNombre?: string;
  guardName?: string;
  reportedToOpsAt?: string;
  opsSignerName?: string;
  observations?: string;
  isReadyForExit?: boolean;
  status?: string;
}

const COLORS = {
  NAVY_DARK: '0C2340',
  NAVY_LIGHT: '1E3A8A',
  GOLD_PRESTIGE: 'D0AF67',
  HEADER_BG: '1E293B',
  HEADER_TXT: 'FFFFFF',
  BORDER_COLOR: 'CBD5E1',
  ROW_ALT_BG: 'F8FAFC',
  SUCCESS_BG: 'ECFDF5',
  SUCCESS_TXT: '065F46',
  WARNING_BG: 'FFFBEB',
  WARNING_TXT: '92400E',
};

@Injectable({ providedIn: 'root' })
export class TrackingExcelExportService {

  /**
   * Genera y descarga el archivo oficial F02-PO-CP-7.1.3-03 en formato .xlsx
   */
  exportTrackingReport(rawItems: TrackingExportItem[], rangeType: ExportRangeType = 'TODAY'): void {
    const filteredItems = this.filterByRange(rawItems, rangeType);
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Construir matriz de datos con encabezado institucional
    const dataMatrix: any[][] = [];

    // Fila 1: Metadatos institucionales
    dataMatrix.push([
      '', '', 'FORMATO', '', '', '', '', '', '', '', '', '', '', '',
      'No. de Control: F02-PO-CP-7.1.3-03', '', '', ''
    ]);

    // Fila 2: Título del Formato y Revisión
    dataMatrix.push([
      '', '', 'TRACKING DE UNIDADES', '', '', '', '', '', '', '', '', '', '', '',
      'No. de Revisión: 01 Fecha de Revisión: 19/08/2025', '', '', ''
    ]);

    // Fila 3: Dueño de Proceso y Firmas
    dataMatrix.push([
      'Dueño: Seguridad Patrimonial', '', 'Emisión: 19/08/2025', '', '', '', '', '', '', '', '',
      'Elaboró: Vigilancia', '', 'Revisó: Coord. Ops', '', 'Aprobó: Gerencia Ops', '', ''
    ]);

    // Fila 4: Proceso
    dataMatrix.push([
      'Proceso: Seguridad Patrimonial / Control de Acceso', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]);

    // Fila 5: Separador en blanco
    dataMatrix.push([]);

    // Fila 6: Las 18 Columnas Oficiales del Formato
    const headers = [
      'Fecha',
      'Turno',
      'Grupo',
      'Rampa',
      'No. Economico',
      'Carga o Descarga (C y D)',
      'Linea de Transporte',
      'Entrega de papeles (hora)',
      'Asignación de rampa (hora)',
      'Tiempo en carga o descarga',
      'Hora de Salida',
      'Tiempo de Actividad',
      'Documento de Entrada',
      'Documento de Salida',
      'Guardia que Realiza Registro',
      'Hora de reporte a Operaciones',
      'Firma del personal de Operaciones',
      'Observaciones'
    ];
    dataMatrix.push(headers);

    // Filas 7+: Contenido de Datos
    filteredItems.forEach((item) => {
      const row = this.mapItemToRow(item, todayStr);
      dataMatrix.push(row);
    });

    // 2. Crear Worksheet con XLSX
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(dataMatrix);

    // 3. Configurar Anchos de Columnas (ColWidths)
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 7 },  // Turno
      { wch: 7 },  // Grupo
      { wch: 8 },  // Rampa
      { wch: 14 }, // No. Economico
      { wch: 12 }, // C / D
      { wch: 22 }, // Línea Transporte
      { wch: 14 }, // Entrega Papeles
      { wch: 14 }, // Asignación Rampa
      { wch: 15 }, // Tiempo Carga/Descarga
      { wch: 14 }, // Hora Salida
      { wch: 14 }, // Tiempo Actividad
      { wch: 16 }, // Doc Entrada
      { wch: 16 }, // Doc Salida
      { wch: 20 }, // Guardia
      { wch: 15 }, // Reporte Ops
      { wch: 18 }, // Firma Ops
      { wch: 28 }, // Observaciones
    ];

    // 4. Aplicar Estilos visuales de Alta Gama (xlsx-js-style)
    this.applySheetStyles(ws, dataMatrix.length);

    // 5. Crear Workbook y Descargar
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    const sheetName = rangeType === 'TODAY' ? 'Tracking_Hoy' : 'Tracking_F02';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = this.generateFileName(rangeType, todayStr);
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Mapea un ítem del sistema al arreglo de 18 columnas oficiales
   */
  private mapItemToRow(item: TrackingExportItem, defaultDate: string): any[] {
    const rawDate = item.fecha || item.docDate || (item.createdAt ? item.createdAt.slice(0, 10) : defaultDate);
    const timeIn = this.normalizeTime(item.horaEntrada || item.receptionTime || (item.createdAt ? item.createdAt.slice(11, 19) : '08:00:00'));
    
    // Asignación de rampa (hora)
    const rampTime = item.rampAssignedAt 
      ? this.normalizeTime(item.rampAssignedAt) 
      : (item.authorizedAt ? this.normalizeTime(item.authorizedAt.slice(11, 19)) : timeIn);

    // Hora de salida
    const timeOut = item.checkoutTime 
      ? this.normalizeTime(item.checkoutTime) 
      : (item.horaSalida ? this.normalizeTime(item.horaSalida) : (item.status === 'COMPLETED' ? '18:00:00' : 'EN PLANTA'));

    // Tiempos calculados
    const timeManiobra = (timeOut !== 'EN PLANTA' && rampTime !== '--:--:--')
      ? this.calculateTimeDiff(rampTime, timeOut)
      : '00:00:00';

    const timeTotal = (timeOut !== 'EN PLANTA' && timeIn !== '--:--:--')
      ? this.calculateTimeDiff(timeIn, timeOut)
      : this.calculateTimeDiff(timeIn, new Date().toLocaleTimeString('es-MX', { hour12: false }));

    // Rampa (limpia, ej: Rampa R-08 -> 8, R-02 -> 2)
    const cleanRamp = this.extractRampNumber(item.rampNumber || item.rampCode || item.assignedRamp);

    // Tipo operación (C o D)
    const op = (item.operacion || item.operationType || 'DESCARGA').toUpperCase().includes('CARGA') ? 'C' : 'D';

    // Turno (D = Diurno / N = Nocturno)
    const turno = this.determineShift(item.shift || item.turno, timeIn);

    // Económico
    const economico = item.noEcoTractor || item.noEcoCaja || item.tractorPlates || 'S/N';

    // Documento de entrada y salida
    const docEntrada = item.docNumber || item.remision || item.noCartaPorte || item.generatedFolio || 'N/A';
    const docSalida = item.exitDocNumber || (op === 'C' ? docEntrada : 'N/A');

    // Guardia
    const guardia = (item.responsableVigilanciaNombre || item.guardName || 'RICARDO').toUpperCase();

    // Personal de Operaciones
    const firmaOps = item.opsSignerName || 'OPERACIONES';

    // Observaciones
    const obs = item.observations || (op === 'D' ? 'SALE VACIO' : 'CARGA COMPLETA');

    return [
      rawDate,
      turno,
      item.grupo || item.groupNumber || '1',
      cleanRamp,
      economico,
      op,
      item.carrierLine || item.carrierLineCode || 'TRANSPORTE GENERAL',
      timeIn,
      rampTime,
      timeManiobra,
      timeOut,
      timeTotal,
      docEntrada,
      docSalida,
      guardia,
      item.reportedToOpsAt || rampTime,
      firmaOps,
      obs
    ];
  }

  /**
   * Filtra la lista de acuerdo al rango seleccionado
   */
  private filterByRange(items: TrackingExportItem[], rangeType: ExportRangeType): TrackingExportItem[] {
    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    return (items || []).filter((item) => {
      const itemDate = item.fecha || item.docDate || (item.createdAt ? item.createdAt.slice(0, 10) : today);
      switch (rangeType) {
        case 'TODAY':
          return itemDate === today;
        case 'YESTERDAY':
          return itemDate === yesterday;
        case 'CURRENT_MONTH':
          return itemDate.startsWith(currentMonth);
        case 'ALL':
        default:
          return true;
      }
    });
  }

  /**
   * Aplica estilos de celda profesionales al worksheet
   */
  private applySheetStyles(ws: XLSX.WorkSheet, totalRows: number): void {
    // 1. Estilo para el encabezado de metadatos (Filas 0 a 3)
    const titleStyle = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLORS.NAVY_DARK } },
      alignment: { vertical: 'center' }
    };
    const metaStyle = {
      font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '475569' } },
      alignment: { vertical: 'center' }
    };

    // Aplicar a filas 0..3
    for (let r = 0; r <= 3; r++) {
      for (let c = 0; c < 18; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].s = (r <= 1) ? titleStyle : metaStyle;
        }
      }
    }

    // 2. Estilo para la Fila de Encabezados (Fila 5)
    const headerStyle = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLORS.HEADER_TXT } },
      fill: { fgColor: { rgb: COLORS.HEADER_BG } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } },
        bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } },
        left: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } },
        right: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } }
      }
    };

    for (let c = 0; c < 18; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 5, c });
      if (ws[cellRef]) {
        ws[cellRef].s = headerStyle;
      }
    }

    // 3. Estilo para las Filas de Datos (Filas 6 en adelante)
    const dataFont = { name: 'Calibri', sz: 9.5 };
    const borderThin = {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_COLOR } }
    };

    for (let r = 6; r < totalRows; r++) {
      const isAlt = (r % 2 === 1);
      const rowBg = isAlt ? COLORS.ROW_ALT_BG : 'FFFFFF';

      for (let c = 0; c < 18; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          const isCenterCol = [0, 1, 2, 3, 5, 7, 8, 9, 10, 11, 14, 15].includes(c);
          ws[cellRef].s = {
            font: dataFont,
            fill: { fgColor: { rgb: rowBg } },
            alignment: { horizontal: isCenterCol ? 'center' : 'left', vertical: 'center' },
            border: borderThin
          };
        }
      }
    }
  }

  private normalizeTime(val: any): string {
    if (!val) return '00:00:00';
    const s = String(val).trim();
    if (s.includes('T') && s.length >= 19) return s.slice(11, 19);
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
    return s;
  }

  private calculateTimeDiff(start: string, end: string): string {
    const parse = (t: string) => {
      const p = t.split(':').map(Number);
      return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
    };
    let diffSec = parse(end) - parse(start);
    if (diffSec < 0) diffSec += 24 * 3600; // Cambio de día

    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private extractRampNumber(val: any): string {
    if (!val) return 'PATIO';
    const s = String(val).toUpperCase();
    if (s.includes('PATIO')) return 'PATIO';
    const match = s.match(/R-?(\d+)/i) || s.match(/RAMPA\s*(\d+)/i) || s.match(/(\d+)/);
    return match ? match[1] : s;
  }

  private determineShift(shift: string | undefined, timeStr: string): string {
    if (shift) {
      const s = shift.toUpperCase();
      if (s.includes('NOCTURNO') || s === 'N' || s.includes('TURNO 2') || s.includes('TURNO 3')) return 'N';
      return 'D';
    }
    const hr = parseInt((timeStr || '').split(':')[0], 10);
    return (hr >= 6 && hr < 18) ? 'D' : 'N';
  }

  private generateFileName(rangeType: ExportRangeType, todayStr: string): string {
    switch (rangeType) {
      case 'TODAY':
        return `F02_Tracking_Unidades_${todayStr}.xlsx`;
      case 'YESTERDAY':
        return `F02_Tracking_Unidades_Ayer_${todayStr}.xlsx`;
      case 'CURRENT_MONTH':
        return `F02_Tracking_Unidades_Mes_${todayStr.slice(0, 7)}.xlsx`;
      case 'ALL':
      default:
        return `F02_Tracking_Unidades_Historico_${todayStr}.xlsx`;
    }
  }
}

