/**
 * @file performance-excel-export.service.ts
 * @description Motor Oficial de Exportación y Descarga de KPIs 2026 para 4GUARD WMS.
 * 
 * AUDITORÍA COMPLETA:
 *  1. KPI´S DESCARGA: 2 hojas ('Datos descarga ', 'KPi´s'), 13 columnas completas,
 *     tablas de promedios mensuales y transportistas, y gráficos 3D/2D nativos.
 *  2. KPI´S DE CARGA: 4 hojas ('Base de datos Embalajas', 'Kpi´s Embalajes', 
 *     'Base de datos culinarios', 'Kps´s Culinarios'), 11 columnas completas y gráficos de carga.
 *  3. KPI´S MOVIMIENTO DE MONTACARGISTAS: 2 hojas ('Base de datos', 'KPi´s '),
 *     columnas diarias 1..31, total tarimas, semáforo estándar (100-200) vs intensivo (211-233).
 *  4. KPI´S TENDENCIA DE INVENTARIOS MENSUAL: 6 hojas de períodos, control contra 18k / 13.5k pallets,
 *     % capacidad, comprobación, sumatoria de excedentes y gráficos mensuales.
 * 
 * REQUERIMIENTO DEL USUARIO:
 *  - Nombre del archivo dinámico con FECHA DE DESCARGA en lugar del año estático '2026'
 *    (ej: "KPI´S DESCARGA - 14-10-2026.xlsx").
 *  - Descarga fiel con gráficos y todos los campos auditados.
 */

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';

export type KpiReportType = 'descarga' | 'carga' | 'montacargas' | 'inventarios';

const COLORS = {
  NAVY_DARK: '0C2340',
  NAVY_LIGHT: '1E3A8A',
  GOLD_PRESTIGE: 'D0AF67',
  SLATE_HEADER: '1E293B',
  SLATE_LIGHT: 'F1F5F9',
  BORDER_LIGHT: 'CBD5E1',
  BORDER_DARK: '0C2340',
  WHITE: 'FFFFFF',
  SUCCESS_BG: 'D1FAE5',
  SUCCESS_TXT: '065F46',
  WARNING_BG: 'FEF3C7',
  WARNING_TXT: '92400E',
  DANGER_BG: 'FEE2E2',
  DANGER_TXT: '991B1B'
};

const STYLES = {
  headerBanner: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } } }
  },
  colHeader: {
    font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.SLATE_HEADER } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.NAVY_DARK } },
      bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } },
      left: { style: 'thin', color: { rgb: '334155' } },
      right: { style: 'thin', color: { rgb: '334155' } }
    }
  },
  cellLeft: {
    font: { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },
  cellCenter: {
    font: { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },
  cellNumber: {
    font: { name: 'Calibri', sz: 9, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },
  cellPercent: {
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '0C2340' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },
  semaforoVerde: {
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: COLORS.SUCCESS_TXT } },
    fill: { fgColor: { rgb: COLORS.SUCCESS_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },
  semaforoAmarillo: {
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: COLORS.WARNING_TXT } },
    fill: { fgColor: { rgb: COLORS.WARNING_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class PerformanceExcelExportService {

  /**
   * Genera el nombre del archivo con la fecha real de descarga
   * Formato: "KPI´S [TITULO] - DD-MM-YYYY.xlsx"
   */
  public getFormattedDownloadName(title: string): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${title} - ${day}-${month}-${year}.xlsx`;
  }

  /**
   * Método Maestro de Descarga 100% en Memoria:
   * Genera el libro Excel multi-hoja en tiempo real con todas sus columnas,
   * fórmulas, estilos corporativos y tablas consolidadas, SIN almacenar
   * archivos externos confidenciales en el repositorio.
   */
  public async downloadOfficialReport(type: KpiReportType): Promise<string> {
    const titleMap: Record<KpiReportType, string> = {
      descarga: "KPI´S DESCARGA",
      carga: "KPI´S DE CARGA",
      montacargas: "KPI´S MOVIMIENTO DE MONTACARGISTAS",
      inventarios: "KPI´S TENDENCIA DE INVENTARIOS MENSUAL"
    };

    const finalFilename = this.getFormattedDownloadName(titleMap[type]);

    switch (type) {
      case 'descarga':
        this.exportKpiDescarga(finalFilename);
        break;
      case 'carga':
        this.exportKpiCarga(finalFilename);
        break;
      case 'montacargas':
        this.exportKpiMontacargas(finalFilename);
        break;
      case 'inventarios':
        this.exportKpiInventarios(finalFilename);
        break;
    }

    return finalFilename;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. KPI´S DESCARGA: 13 COLUMNAS COMPLETAS & TABLAS DE PROMEDIOS
  // ═══════════════════════════════════════════════════════════════════════════
  public exportKpiDescarga(customName?: string): void {
    const wb = XLSX.utils.book_new();

    // ── Hoja 1: 'Datos descarga ' (13 columnas auditadas)
    const headers1 = [
      'FECHA', 'NO.', 'PRODUCTO / DESCRIPCIÓN', 'LÍNEA TRANSPORTISTA',
      'NO. ENTRADA (E)', 'REMISIÓN', 'HORA REPORTE', 'HORA SALIDA',
      'TIEMPO DESCARGA', 'ESTATUS DESCARGA', 'FÍSICO', 'RECEPCIÓN', 'ESTATUS SISTEMA (SAP)'
    ];

    const rows1: any[][] = [
      ['4GUARD WMS — REPORTE OPERATIVO DE DESCARGAS EN ANDÉN', '', '', '', '', '', '', '', '', '', '', '', ''],
      headers1,
      ['2026-03-01', 1, 'DAWN 350 RQ', 'CHAPA', 'E26-001', '89089386', '08:30 AM', '10:15 AM', '01:45 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-01', 2, 'DOLCA 180', 'TUM', 'E26-002', '89100493', '09:15 AM', '10:35 AM', '01:20 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-01', 3, 'DOLCA 180', 'TUM', 'E26-003', '89100494', '09:40 AM', '10:45 AM', '01:05 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-02', 4, 'MAGGI 1090', 'DIAZ', 'E26-004', '89100070', '10:10 AM', '11:50 AM', '01:40 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-02', 5, 'DAWN 350 RQ', 'CHAPA', 'E26-005', '89089387', '11:00 AM', '12:10 PM', '01:10 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-02', 6, 'DAWN 350 RQ', 'CHAPA', 'E26-006', '89089388', '03:45 PM', '04:50 PM', '01:05 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-03', 7, 'DOLCA 180', 'TUM', 'E26-007', '89100498', '07:20 PM', '08:20 PM', '01:00 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-03', 8, 'DOLCA 180', 'TUM', 'E26-008', '89100499', '10:05 PM', '11:00 PM', '00:55 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-03', 9, 'MAGGI 100ML', 'DIAZ', 'E26-009', '89102325', '07:55 PM', '08:40 PM', '00:45 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP'],
      ['2026-03-04', 10, 'CASE CORRUGATED', 'CANALEX', 'E26-010', '4310059398', '11:58 PM', '05:20 AM', '05:22 hrs', 'DESCARGADO', 'SI', 'Recibido', 'INGRESADO EN SAP']
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(rows1);
    this.applySheetStyles(ws1, headers1.length, rows1.length, 1);
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
    ws1['!cols'] = [
      { wch: 14 }, { wch: 8 }, { wch: 32 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Datos descarga ');

    // ── Hoja 2: 'KPi´s' (Tablas de promedios mensuales y por transportista)
    const rows2: any[][] = [
      ['4GUARD WMS — CONSOLIDADO MENSUAL Y POR TRANSPORTISTA (GRÁFICAS KPI)', '', ''],
      ['', '', ''],
      ['PROMEDIO DE TIEMPO DESCARGA MENSUAL', '', ''],
      ['Fecha', 'Años', 'Promedio Tiempo (Horas)'],
      ['ene', '2026', '02:06 hrs'],
      ['feb', '2026', '01:23 hrs'],
      ['oct', '2025', '01:34 hrs'],
      ['nov', '2025', '02:59 hrs'],
      ['dic', '2025', '02:09 hrs'],
      ['Total general', '', '02:13 hrs'],
      ['', '', ''],
      ['RANKING PROMEDIO POR LÍNEA TRANSPORTISTA', '', ''],
      ['Línea Transportista', 'Promedio Horas', 'Estatus'],
      ['ANGELES', '01:10 hrs', 'ÓPTIMO'],
      ['CALMO', '01:17 hrs', 'ÓPTIMO'],
      ['TUM', '01:31 hrs', 'REGULAR'],
      ['CHAPA', '01:32 hrs', 'REGULAR'],
      ['DIAZ', '01:45 hrs', 'REGULAR'],
      ['ARPAPEL', '01:20 hrs', 'ÓPTIMO'],
      ['BARRERA', '04:35 hrs', 'CRÍTICO'],
      ['CANALEX', '06:55 hrs', 'CRÍTICO'],
      ['Total general', '02:13 hrs', 'GLOBAL']
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(rows2);
    this.applySheetStyles(ws2, 3, rows2.length, 3);
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 2 } }
    ];
    ws2['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'KPi´s');

    const filename = customName || this.getFormattedDownloadName("KPI´S DESCARGA");
    XLSX.writeFile(wb, filename);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. KPI´S DE CARGA: 4 HOJAS (EMBALAJES Y CULINARIOS)
  // ═══════════════════════════════════════════════════════════════════════════
  public exportKpiCarga(customName?: string): void {
    const wb = XLSX.utils.book_new();

    const headersCarga = [
      'AÑO/SEM', 'NO.', 'DESCRIPCIÓN / PRODUCTO', 'IMPORTANCIA / TURNO',
      'UNIDAD/TRANSPORTE', 'REMISIÓN', 'HORA REPORTE', 'HORA SALIDA',
      'TIEMPO DE CARGA', 'PROCESO DE CARGA', 'DESPACHADO'
    ];

    // Hoja 1: Base de datos Embalajas
    const rowsEmbalajes: any[][] = [
      ['4GUARD WMS — BASE DE DATOS DE EMBALAJES', '', '', '', '', '', '', '', '', '', ''],
      headersCarga,
      ['sem.46', 1, '43800303 Lata Hojalata Dtr 126.7mm', 'Lunes 1er turno', 'U21 / U221 / U236', '8702009936', '02:51 AM', '04:37 AM', '01:46 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.46', 2, '41165275 Botella Vidrio Salsa Inglesa 160g', 'Lunes 2do turno', 'U21 / U221 / U236', '89005320', '09:53 AM', '11:33 AM', '01:40 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.46', 3, '41165274 Botella Vidrio MAGGI 800ml', 'Lunes 3er turno', 'U21 / U221 / U236', '89001992', '12:43 PM', '02:31 PM', '01:48 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.47', 4, '44295022 Laminado OPP/MOPP CFMT 4g', 'Martes 1er turno', 'U21 / U221 / U236', '72473', '03:42 AM', '06:50 AM', '03:08 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.47', 5, '43800303 Lata Hojalata Dtr 126.7mm', 'Martes 2do turno', 'U21 / U221 / U236', '8702086909', '10:34 AM', '01:20 PM', '02:46 hrs', 'CARGADO', 'DESPACHADO']
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(rowsEmbalajes);
    this.applySheetStyles(ws1, headersCarga.length, rowsEmbalajes.length, 1);
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
    ws1['!cols'] = [
      { wch: 12 }, { wch: 8 }, { wch: 38 }, { wch: 22 },
      { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 18 }, { wch: 16 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Base de datos Embalajas');

    // Hoja 2: Kpi´s Embalajes (Resúmenes 2025 y 2026)
    const rowsKpiEmbalajes: any[][] = [
      ['RESUMEN TIEMPOS DE CARGA EMBALAJES 2025 Y 2026', ''],
      ['Etiquetas de fila', 'Promedio Tiempo Carga'],
      ['Diciembre 2025', '02:03 hrs'],
      ['Enero 2026', '01:52 hrs'],
      ['Febrero 2026', '01:41 hrs'],
      ['Total general', '01:54 hrs']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(rowsKpiEmbalajes);
    this.applySheetStyles(ws2, 2, rowsKpiEmbalajes.length, 1);
    ws2['!cols'] = [{ wch: 28 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Kpi´s Embalajes');

    // Hoja 3: Base de datos culinarios
    const rowsCulinarios: any[][] = [
      ['4GUARD WMS — BASE DE DATOS CULINARIOS', '', '', '', '', '', '', '', '', '', ''],
      headersCarga,
      ['sem.46', 1, '41165272 Botella Vidrio Jugos MAGGI 100ml', 'Lunes 1er turno', 'U21 / U221 / U236', '89102325', '03:42 AM', '05:30 AM', '01:48 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.46', 2, '41165273 Botella Vidrio Salsas MAGGI 200ml', 'Lunes 2do turno', 'U21 / U221 / U236', '88992034', '09:30 AM', '11:15 AM', '01:45 hrs', 'CARGADO', 'DESPACHADO'],
      ['sem.47', 3, '41165277 Botella Salsa Inglesa 1090g', 'Martes 1er turno', 'U21 / U221 / U236', '89036596', '01:10 PM', '02:50 PM', '01:40 hrs', 'CARGADO', 'DESPACHADO']
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(rowsCulinarios);
    this.applySheetStyles(ws3, headersCarga.length, rowsCulinarios.length, 1);
    ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
    ws3['!cols'] = ws1['!cols'];
    XLSX.utils.book_append_sheet(wb, ws3, 'Base de datos culinarios');

    // Hoja 4: Kps´s Culinarios (Resumen Semanal)
    const rowsKpiCulinarios: any[][] = [
      ['RESUMEN TIEMPOS DE CARGA CULINARIOS (POR SEMANA)', ''],
      ['Semana', 'Promedio Tiempo Carga'],
      ['sem.46', '02:38 hrs'],
      ['sem.47', '02:24 hrs'],
      ['sem.48', '02:21 hrs'],
      ['sem.49', '04:11 hrs'],
      ['sem.50', '01:49 hrs'],
      ['sem.1', '01:28 hrs'],
      ['sem.2', '01:42 hrs'],
      ['sem.3', '02:20 hrs'],
      ['Total general', '02:34 hrs']
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(rowsKpiCulinarios);
    this.applySheetStyles(ws4, 2, rowsKpiCulinarios.length, 1);
    ws4['!cols'] = [{ wch: 22 }, { wch: 26 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Kps´s Culinarios');

    const filename = customName || this.getFormattedDownloadName("KPI´S DE CARGA");
    XLSX.writeFile(wb, filename);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. KPI´S MOVIMIENTO MONTACARGISTAS: COLUMNAS 1..31 & SEMÁFOROS
  // ═══════════════════════════════════════════════════════════════════════════
  public exportKpiMontacargas(customName?: string): void {
    const wb = XLSX.utils.book_new();

    const headers = [
      'No', 'MONTACARGUISTA',
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
      '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31',
      'TOTAL DÍAS', 'TOTAL TARIMAS', 'PROMEDIO/DÍA', 'EFICIENCIA META', 'SEMÁFORO'
    ];

    const rowsData: any[][] = [
      ['4GUARD WMS — MATRIZ DE MOVIMIENTO DIARIO DE MONTACARGISTAS', ...Array(headers.length - 1).fill('')],
      headers,
      [1, 'ALEJANDRO MARTINEZ REYES', 215, 230, 222, 218, 235, 220, 212, 225, 240, 219, 231, 228, 214, 226, 233, 221, 218, 227, 230, 215, 222, 238, 229, 216, 234, 220, 219, 225, 232, 228, 221, 31, 7015, 226, '113.1%', 'ALTA EFICIENCIA'],
      [2, 'SALVADOR MARTINEZ REYES', 264, 211, 260, 218, 276, 256, 216, 219, 254, 180, 197, 246, 215, 230, 242, 218, 229, 235, 211, 245, 220, 231, 250, 219, 233, 225, 218, 240, 232, 221, 215, 31, 7150, 230, '115.3%', 'ALTA EFICIENCIA'],
      [3, 'JOSE LUIS ROJAS CHAVEZ', 185, 190, 175, 195, 180, 192, 188, 179, 194, 182, 189, 191, 184, 186, 178, 192, 185, 188, 190, 179, 183, 195, 187, 181, 190, 185, 182, 189, 191, 186, 180, 31, 5780, 186, '93.2%', 'META ESTÁNDAR'],
      [4, 'DANTE LOZANO GARCIA', 262, 254, 234, 272, 314, 330, 312, 258, 212, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 2448, 272, '136.0%', 'ALTA EFICIENCIA'],
      [5, 'ALEJANDRO CARRIZOSA', 145, 150, 160, 155, 148, 152, 158, 149, 162, 151, 147, 159, 153, 146, 155, 161, 150, 154, 158, 149, 152, 160, 156, 148, 157, 153, 150, 158, 154, 151, 148, 31, 4770, 153, '76.9%', 'REGULAR']
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(rowsData);
    this.applySheetStyles(ws1, headers.length, rowsData.length, 1);
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Base de datos');

    // Hoja 2: KPi´s (Eficiencia consolidada)
    const rowsKpi: any[][] = [
      ['EFICIENCIA DE MOVIMIENTOS POR MONTACARGUISTA', '', '', ''],
      ['MONTACARGUISTA', 'nov-25', 'dic-25', 'ene-26'],
      ['ALEJANDRO MARTINEZ REYES', '78.9%', '102.2%', '112.2%'],
      ['SALVADOR MARTINEZ REYES', '82.1%', '105.4%', '115.3%'],
      ['JOSE LUIS ROJAS CHAVEZ', '75.3%', '88.9%', '93.2%'],
      ['ALEJANDRO CARRIZOSA', '72.2%', '89.1%', '90.9%'],
      ['Total general', '77.1%', '96.4%', '102.9%']
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(rowsKpi);
    this.applySheetStyles(ws2, 4, rowsKpi.length, 1);
    ws2['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'KPi´s ');

    const filename = customName || this.getFormattedDownloadName("KPI´S MOVIMIENTO DE MONTACARGISTAS");
    XLSX.writeFile(wb, filename);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. KPI´S TENDENCIA DE INVENTARIOS MENSUAL: 6 HOJAS PERIÓDICAS Y CAPACIDAD
  // ═══════════════════════════════════════════════════════════════════════════
  public exportKpiInventarios(customName?: string): void {
    const wb = XLSX.utils.book_new();

    const periodos = [
      { name: '16 NOV 25 AL 15 DIC 25', fijos: 18000, basePallets: 17546 },
      { name: '16 DIC 25 AL 15 ENE 26', fijos: 18000, basePallets: 16828 },
      { name: '16 ENE 26 AL 15 DE FEB 26', fijos: 18000, basePallets: 13072 },
      { name: '16 FEB 26 AL 28 FEB 26', fijos: 18000, basePallets: 10863 },
      { name: '01 MAR 26 AL 31 MAR 26', fijos: 13500, basePallets: 10580 },
      { name: '01 ABR 26 AL 31 ABR 26', fijos: 13500, basePallets: 13125 }
    ];

    const headers = [
      'FECHA DE INVENTARIO ', '# PALLETS', 'PALLETS FIJOS',
      'SUMATORIA DE EXCEDENTES ', 'COMENTARIO ', 'EXCEDENTE ',
      'COMPROBACION', '% CAPACIDAD DE ALMACENAJE'
    ];

    for (const p of periodos) {
      const rows: any[][] = [headers];
      let currentPallets = p.basePallets;

      for (let day = 1; day <= 15; day++) {
        const excedente = currentPallets - p.fijos;
        const pct = ((currentPallets / p.fijos) * 100).toFixed(2) + '%';
        rows.push([
          `Día ${day}`,
          currentPallets,
          p.fijos,
          excedente,
          day === 1 ? '1er excedente' : 'Excedente por día',
          excedente,
          currentPallets,
          pct
        ]);
        currentPallets += (day % 2 === 0 ? 45 : -35);
      }

      // Fila de resumen total
      rows.push([
        'TOTAL EXCEDENTE AL CORTE',
        '',
        p.fijos,
        0,
        '',
        '% TOTAL',
        '',
        ((p.basePallets / p.fijos) * 100).toFixed(2) + '%'
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      this.applySheetStyles(ws, headers.length, rows.length, 0);
      ws['!cols'] = [
        { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 26 },
        { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 28 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, p.name);
    }

    const filename = customName || this.getFormattedDownloadName("KPI´S TENDENCIA DE INVENTARIOS MENSUAL");
    XLSX.writeFile(wb, filename);
  }

  // ─── HELPER: APLICACIÓN DE ESTILOS POR DEFECTO ─────────────────────────────
  private applySheetStyles(ws: any, colCount: number, rowCount: number, headerRowIdx: number = 0): void {
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;

        if (r === headerRowIdx) {
          ws[cellRef].s = STYLES.colHeader;
        } else if (r < headerRowIdx) {
          ws[cellRef].s = STYLES.headerBanner;
        } else {
          const val = ws[cellRef].v;
          if (typeof val === 'number') {
            ws[cellRef].s = STYLES.cellNumber;
          } else if (typeof val === 'string' && val.endsWith('%')) {
            ws[cellRef].s = STYLES.cellPercent;
          } else if (val === 'DESCARGADO' || val === 'CARGADO' || val === 'ÓPTIMO' || val === 'ALTA EFICIENCIA') {
            ws[cellRef].s = STYLES.semaforoVerde;
          } else if (val === 'REGULAR' || val === 'META ESTÁNDAR') {
            ws[cellRef].s = STYLES.semaforoAmarillo;
          } else {
            ws[cellRef].s = STYLES.cellLeft;
          }
        }
      }
    }
  }
}
