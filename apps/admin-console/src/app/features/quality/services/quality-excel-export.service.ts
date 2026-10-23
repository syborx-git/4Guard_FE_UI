/**
 * @file quality-excel-export.service.ts
 * @description Motor de Exportación a Excel Profesional de Alta Gama (.xlsx) para el Módulo de Calidad (QM).
 * Diseñado con estilo corporativo 4GUARD (Midnight Navy #0C2340, Prestige Gold #D0AF67, Emerald #059669),
 * tipografías refinadas, bordes sutiles, zebra striping, tarjetas de resumen ejecutivo,
 * barras gráficas de progreso visual, fusión de celdas (merges) y 4 hojas temáticas completas.
 */

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import {
  QualityMonthlyBoard,
  QualityDeviation,
  QualityClaim,
  LoadVerification,
  QUALITY_MATERIAL_TYPE_LABELS,
  QUALITY_CONDITION_LABELS,
  QUALITY_ROOT_CAUSE_LABELS,
  QUALITY_ACTION_LABELS,
  CLAIM_STAGE_LABELS,
  CLAIM_DEFECT_TYPE_LABELS
} from '../models/quality.models';

// ─── PALETA DE COLORES CORPORATIVOS ──────────────────────────────────────────
const COLORS = {
  NAVY_DARK: '0C2340',     // Midnight Navy Principal
  NAVY_LIGHT: '1E3A8A',    // Azul Marino Secundario
  GOLD_PRESTIGE: 'D0AF67', // Oro Corporativo 4GUARD
  GOLD_LIGHT: 'FEF3C7',    // Fondo Oro Suave
  SLATE_HEADER: '1E293B',  // Encabezado Tablas
  SLATE_BG: 'F8FAFC',      // Fondo Cebra
  BORDER_LIGHT: 'CBD5E1',  // Borde Tabla
  BORDER_DARK: '0C2340',   // Borde Fuerte
  SUCCESS_BG: 'D1FAE5',    // Verde Éxito Fondo
  SUCCESS_TXT: '065F46',   // Verde Éxito Texto
  WARNING_BG: 'FEF3C7',    // Ámbar Fondo
  WARNING_TXT: '92400E',   // Ámbar Texto
  DANGER_BG: 'FEE2E2',     // Rojo Fondo
  DANGER_TXT: '991B1B',    // Rojo Texto
  WHITE: 'FFFFFF',
  GRAY_TXT: '475569'
};

// ─── ESTILOS REUTILIZABLES ───────────────────────────────────────────────────
const STYLES = {
  // 1. Título Maestro (Banner Superior)
  mainTitle: {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
  },

  // 2. Subtítulo / Período
  subTitle: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLORS.GOLD_PRESTIGE } },
    fill: { fgColor: { rgb: COLORS.NAVY_LIGHT } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 }
  },

  // 3. Encabezado de Sección (Banners Temáticos)
  sectionBanner: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    border: {
      bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } }
    }
  },

  // 4. Encabezados de Columnas de Tabla (Table Headers)
  tableHeader: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.SLATE_HEADER } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.NAVY_DARK } },
      bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } },
      left: { style: 'thin', color: { rgb: '334155' } },
      right: { style: 'thin', color: { rgb: '334155' } }
    }
  },

  // 5. Celdas de Datos Generales (Texto Normal)
  dataCellLeft: {
    font: { name: 'Calibri', sz: 9.5, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },

  dataCellCenter: {
    font: { name: 'Calibri', sz: 9.5, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },

  dataCellRight: {
    font: { name: 'Calibri', sz: 9.5, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      bottom: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },

  // 6. Tarjetas de Resumen Ejecutivo (KPI Box)
  summaryCardTitle: {
    font: { name: 'Calibri', sz: 8.5, bold: true, color: { rgb: '475569' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },

  summaryCardValue: {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLORS.NAVY_DARK } },
    fill: { fgColor: { rgb: COLORS.WHITE } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      bottom: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } },
      left: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } },
      right: { style: 'thin', color: { rgb: COLORS.BORDER_LIGHT } }
    }
  },

  // 7. Badges de Estatus de Calidad
  statusSuccess: {
    font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: COLORS.SUCCESS_TXT } },
    fill: { fgColor: { rgb: COLORS.SUCCESS_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'A7F3D0' } },
      bottom: { style: 'thin', color: { rgb: 'A7F3D0' } },
      left: { style: 'thin', color: { rgb: 'A7F3D0' } },
      right: { style: 'thin', color: { rgb: 'A7F3D0' } }
    }
  },

  statusWarning: {
    font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: COLORS.WARNING_TXT } },
    fill: { fgColor: { rgb: COLORS.WARNING_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'FDE68A' } },
      bottom: { style: 'thin', color: { rgb: 'FDE68A' } },
      left: { style: 'thin', color: { rgb: 'FDE68A' } },
      right: { style: 'thin', color: { rgb: 'FDE68A' } }
    }
  },

  statusDanger: {
    font: { name: 'Calibri', sz: 9.5, bold: true, color: { rgb: COLORS.DANGER_TXT } },
    fill: { fgColor: { rgb: COLORS.DANGER_BG } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'FECACA' } },
      bottom: { style: 'thin', color: { rgb: 'FECACA' } },
      left: { style: 'thin', color: { rgb: 'FECACA' } },
      right: { style: 'thin', color: { rgb: 'FECACA' } }
    }
  },

  // 8. Barra Gráfica de Progreso
  progressBar: {
    font: { name: 'Consolas', sz: 9, bold: true, color: { rgb: '1D4ED8' } },
    fill: { fgColor: { rgb: 'EFF6FF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'BFDBFE' } },
      bottom: { style: 'thin', color: { rgb: 'BFDBFE' } },
      left: { style: 'thin', color: { rgb: 'BFDBFE' } },
      right: { style: 'thin', color: { rgb: 'BFDBFE' } }
    }
  },

  // 9. Fila de Totales Finales
  totalsRow: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COLORS.WHITE } },
    fill: { fgColor: { rgb: COLORS.NAVY_DARK } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'medium', color: { rgb: COLORS.GOLD_PRESTIGE } },
      bottom: { style: 'double', color: { rgb: COLORS.GOLD_PRESTIGE } }
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class QualityExcelExportService {

  /**
   * Genera y descarga el archivo .xlsx multi-hoja con diseño corporativo y estilos de color.
   */
  public exportQualityWorkbook(
    board: QualityMonthlyBoard,
    claims: QualityClaim[] = [],
    verifications: LoadVerification[] = []
  ): void {
    if (!board) {
      console.warn('[QualityExcelExportService] No hay datos del tablero para exportar.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // ── 1. HOJA 1: TABLERO EJECUTIVO DE 10 KPIS ──
    const wsDashboard = this.buildKpiDashboardSheet(board);
    XLSX.utils.book_append_sheet(workbook, wsDashboard, '1. Tablero 10 KPIs');

    // ── 2. HOJA 2: CÉDULA DE DESVIACIONES DETALLADAS ──
    const wsDeviations = this.buildDeviationsSheet(board);
    XLSX.utils.book_append_sheet(workbook, wsDeviations, '2. Cédula Desviaciones');

    // ── 3. HOJA 3: RECLAMOS E INCIDENCIAS (F02) ──
    const wsClaims = this.buildClaimsSheet(claims, board.year, board.month);
    XLSX.utils.book_append_sheet(workbook, wsClaims, '3. Reclamos e Incidencias');

    // ── 4. HOJA 4: VERIFICACIONES DE CARGA (F01) ──
    const wsVerifications = this.buildVerificationsSheet(verifications);
    XLSX.utils.book_append_sheet(workbook, wsVerifications, '4. Verificaciones F01');

    // Nombre de archivo con fecha y periodo
    const periodStr = `${board.year}-${String(board.month).padStart(2, '0')}`;
    const fileName = `4GUARD_WMS_Reporte_Calidad_KPIs_${periodStr}.xlsx`;

    // Descarga directa con estilos embebidos
    XLSX.writeFile(workbook, fileName);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 1: TABLERO EJECUTIVO DE 10 KPIS
  // ══════════════════════════════════════════════════════════════════════════

  private buildKpiDashboardSheet(board: QualityMonthlyBoard): XLSX.WorkSheet {
    const rawData: (string | number)[][] = [];

    // Fila 0: Título Principal
    rawData.push(['4GUARD WMS — SISTEMA DE GESTIÓN DE CALIDAD E INOCUIDAD (QM)', '', '', '', '', '', '', '']);
    
    // Fila 1: Subtítulo y Metadatos
    const formattedDate = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    rawData.push([
      `PERIODO: ${board.monthName?.toUpperCase() || 'OCTUBRE'} ${board.year}   |   ALMACÉN: ${board.branchName?.toUpperCase() || 'TOLUCA - NAVE M1'}   |   EMISIÓN OFICIAL: ${formattedDate}`,
      '', '', '', '', '', '', ''
    ]);
    
    // Fila 2: Vacía (Espaciador)
    rawData.push([]);

    // Fila 3: Tarjetas de Resumen Ejecutivo (Banner Sección)
    rawData.push(['INDICADORES RESUMEN EJECUTIVO DEL PERIODO', '', '', '', '', '', '', '']);
    
    // Fila 4: Tarjetas Título (8 Columnas de la A a la H)
    const resolvedDevsCount = board.deviations ? board.deviations.filter(d => d.isResolved).length : board.totalDeviations;
    rawData.push([
      'COSTO TOTAL NO CALIDAD',
      'TOTAL PIEZAS DAÑADAS',
      'LOTES INSPECCIONADOS (F01)',
      'PRODUCTO TERMINADO (PT)',
      'EMBALAJES DAÑADOS',
      'CAFÉ VERDE AFECTADO',
      'DESVIACIONES REGISTRADAS',
      'RESOLUCIÓN DE ACCIONES'
    ]);
    
    // Fila 5: Tarjetas Valores (8 Columnas de la A a la H)
    rawData.push([
      `$ ${board.totalNonQualityCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`,
      `${board.totalDamagedPieces} Unidades`,
      `${board.totalInspectedLots} Lotes`,
      `${board.ptDamagedPieces} Pzas`,
      `${board.packagingDamagedPieces} Pzas`,
      `${board.greenCoffeeDamagedPieces} Pzas`,
      `${board.totalDeviations} Eventos`,
      `${resolvedDevsCount} / ${board.totalDeviations} Resueltas`
    ]);
    
    // Fila 6: Vacía (Espaciador)
    rawData.push([]);

    // Fila 7: Banner Sección Matriz 10 KPIs
    rawData.push(['MATRIZ OFICIAL DE LOS 10 INDICADORES NORMATIVOS DE CALIDAD Y DESEMPEÑO QM:', '', '', '', '', '', '', '']);
    
    // Fila 8: Encabezados de la Tabla
    rawData.push([
      'NO.',
      'INDICADOR / KPI',
      'CATEGORÍA',
      'VALOR REGISTRADO',
      'META (TARGET)',
      'ESTATUS',
      'GRÁFICO DE CUMPLIMIENTO',
      'OBSERVACIONES / IMPACTO'
    ]);

    // Fila 9 a 18: Los 10 KPIs
    const kpiStartRow = 9;
    for (const card of board.kpiCards) {
      const compliance = card.compliancePercentage ?? (card.status === 'SUCCESS' ? 100 : 70);
      const progressBar = this.generateAsciiProgressBar(compliance);
      const statusLabel = card.status === 'SUCCESS' ? '✓ CUMPLE META' : (card.status === 'WARNING' ? '⚠ EN RIESGO' : '❌ NO CUMPLE');

      rawData.push([
        card.kpiNumber,
        card.title,
        card.category,
        card.value,
        card.target,
        statusLabel,
        progressBar,
        card.sublabel
      ]);
    }

    // Fila 19 y 20: Vacías (Espaciadores)
    rawData.push([]);
    rawData.push([]);

    // Fila 21: Banner Sección Gráficas y Distribuciones
    rawData.push(['DATOS Y DISTRIBUCIONES ANALÍTICAS PARA GRÁFICAS DE CONTROL:', '', '', '', '', '', '', '']);
    
    // Fila 22: Encabezados de Distribuciones (Cols A+B merged para Pareto)
    rawData.push([
      'DISTRIBUCIÓN POR CAUSA RAÍZ (PARETO)',
      '',
      'EVENTOS',
      '% TOTAL',
      'GRÁFICO VISUAL',
      'DESGLOSE POR MATERIAL',
      'PZAS DAÑADAS',
      '% PARTICIPACIÓN'
    ]);

    const rootCauses = Object.entries(board.rootCauseDistribution || {});
    const totalRootEvents = rootCauses.reduce((acc, [, val]) => acc + val, 0) || 1;

    const materials = [
      { name: 'Producto Terminado', qty: board.ptDamagedPieces || 0 },
      { name: 'Embalajes / Material Seco', qty: board.packagingDamagedPieces || 0 },
      { name: 'Café Verde / Granel', qty: board.greenCoffeeDamagedPieces || 0 }
    ];
    const totalMaterialQty = board.totalDamagedPieces || 1;
    const maxDistRows = Math.max(rootCauses.length, materials.length);
    const distStartRow = 23;

    for (let i = 0; i < maxDistRows; i++) {
      const row: (string | number)[] = [];

      if (i < rootCauses.length) {
        const [code, count] = rootCauses[i];
        const label = QUALITY_ROOT_CAUSE_LABELS[code as keyof typeof QUALITY_ROOT_CAUSE_LABELS] || code;
        const pct = Math.round((count / totalRootEvents) * 100);
        row.push(label, '', count, `${pct}%`, this.generateAsciiBar(pct));
      } else {
        row.push('', '', '', '', '');
      }

      if (i < materials.length) {
        const mat = materials[i];
        const pct = Math.round((mat.qty / totalMaterialQty) * 100);
        row.push(mat.name, mat.qty, `${pct}%`);
      } else {
        row.push('', '', '');
      }

      rawData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rawData);

    // ── FUSIONES (MERGES) Y APLICACIÓN DE ESTILOS COMPLETOS ──
    // Fila 0: Título Principal A1:H1
    this.mergeAndStyle(ws, 0, 0, 0, 7, STYLES.mainTitle);

    // Fila 1: Subtítulo A2:H2
    this.mergeAndStyle(ws, 1, 0, 1, 7, STYLES.subTitle);

    // Fila 3: Banner Resumen Ejecutivo A4:H4
    this.mergeAndStyle(ws, 3, 0, 3, 7, STYLES.sectionBanner);

    // Filas 4 y 5: Tarjetas de Resumen Ejecutivo (8 Columnas de la A a la H)
    for (let c = 0; c < 8; c++) {
      const refTitle = XLSX.utils.encode_cell({ r: 4, c });
      const refVal = XLSX.utils.encode_cell({ r: 5, c });
      this.applyStyleToCell(ws, refTitle, STYLES.summaryCardTitle);
      this.applyStyleToCell(ws, refVal, STYLES.summaryCardValue);
    }

    // Fila 7: Banner Sección Matriz 10 KPIs A8:H8
    this.mergeAndStyle(ws, 7, 0, 7, 7, STYLES.sectionBanner);

    // Fila 8: Encabezados de la Tabla de KPIs (Cols 0 a 7)
    for (let c = 0; c < 8; c++) {
      const ref = XLSX.utils.encode_cell({ r: 8, c });
      this.applyStyleToCell(ws, ref, STYLES.tableHeader);
    }

    // Filas 9 a 18: Estilos de Filas de los 10 KPIs
    for (let i = 0; i < board.kpiCards.length; i++) {
      const r = kpiStartRow + i;
      const card = board.kpiCards[i];
      const isZebra = i % 2 === 1;
      const baseStyle = isZebra ? { ...STYLES.dataCellLeft, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellLeft;
      const baseCenter = isZebra ? { ...STYLES.dataCellCenter, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellCenter;

      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 0 }), { ...baseCenter, font: { ...baseCenter.font, bold: true } }); // No.
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 1 }), { ...baseStyle, font: { ...baseStyle.font, bold: true } }); // Indicador
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 2 }), baseCenter); // Categoría
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 3 }), { ...baseCenter, font: { ...baseCenter.font, bold: true, color: { rgb: COLORS.NAVY_DARK } } }); // Valor
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 4 }), baseCenter); // Meta

      // Estatus con Badge de Color
      const statusStyle = card.status === 'SUCCESS' ? STYLES.statusSuccess : (card.status === 'WARNING' ? STYLES.statusWarning : STYLES.statusDanger);
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 5 }), statusStyle);

      // Barra de Progreso
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 6 }), STYLES.progressBar);

      // Observaciones
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 7 }), baseStyle);
    }

    // Fila 21: Banner de Distribuciones A22:H22
    this.mergeAndStyle(ws, 21, 0, 21, 7, STYLES.sectionBanner);

    // Fila 22: Encabezados de Distribuciones (Cols A+B fusionadas para Pareto)
    this.mergeAndStyle(ws, 22, 0, 22, 1, STYLES.tableHeader);
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 2 }), STYLES.tableHeader); // EVENTOS
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 3 }), STYLES.tableHeader); // % TOTAL
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 4 }), STYLES.tableHeader); // GRÁFICO VISUAL
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 5 }), STYLES.tableHeader); // DESGLOSE MATERIAL
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 6 }), STYLES.tableHeader); // PZAS DAÑADAS
    this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r: 22, c: 7 }), STYLES.tableHeader); // % PARTICIPACIÓN

    // Filas 23+: Estilos de Filas de Distribuciones
    for (let i = 0; i < maxDistRows; i++) {
      const r = distStartRow + i;
      const isZebra = i % 2 === 1;
      const baseStyle = isZebra ? { ...STYLES.dataCellLeft, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellLeft;
      const baseCenter = isZebra ? { ...STYLES.dataCellCenter, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellCenter;

      this.mergeAndStyle(ws, r, 0, r, 1, baseStyle); // Label Pareto fusionado A+B
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 2 }), baseCenter); // Eventos
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 3 }), baseCenter); // % Total
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 4 }), STYLES.progressBar); // Gráfico Barra

      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 5 }), baseStyle); // Material
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 6 }), baseCenter); // Pzas
      this.applyStyleToCell(ws, XLSX.utils.encode_cell({ r, c: 7 }), baseCenter); // % Part
    }

    // ── ALTURAS DE FILA (ROW HEIGHTS EN PUNTOS) ──
    const rowHeights: { hpt: number }[] = [];
    rowHeights[0] = { hpt: 32 }; // Fila 0: Título Principal
    rowHeights[1] = { hpt: 22 }; // Fila 1: Subtítulo
    rowHeights[2] = { hpt: 10 }; // Fila 2: Espaciador
    rowHeights[3] = { hpt: 24 }; // Fila 3: Banner Resumen
    rowHeights[4] = { hpt: 22 }; // Fila 4: Tarjetas Títulos
    rowHeights[5] = { hpt: 26 }; // Fila 5: Tarjetas Valores
    rowHeights[6] = { hpt: 10 }; // Fila 6: Espaciador
    rowHeights[7] = { hpt: 24 }; // Fila 7: Banner KPIs
    rowHeights[8] = { hpt: 26 }; // Fila 8: Headers KPIs
    for (let i = 9; i <= 18; i++) {
      rowHeights[i] = { hpt: 22 }; // Filas 9 a 18: 10 KPIs
    }
    rowHeights[19] = { hpt: 10 }; // Espaciador
    rowHeights[20] = { hpt: 10 }; // Espaciador
    rowHeights[21] = { hpt: 24 }; // Fila 21: Banner Distribuciones
    rowHeights[22] = { hpt: 24 }; // Fila 22: Headers Distribuciones
    for (let i = 0; i < maxDistRows; i++) {
      rowHeights[distStartRow + i] = { hpt: 20 };
    }
    ws['!rows'] = rowHeights;

    // ── ANCHOS DE COLUMNAS (COLUMN WIDTHS) ──
    ws['!cols'] = [
      { wch: 8 },  // A: NO.
      { wch: 38 }, // B: INDICADOR / KPI
      { wch: 22 }, // C: CATEGORÍA
      { wch: 24 }, // D: VALOR REGISTRADO
      { wch: 18 }, // E: META (TARGET)
      { wch: 20 }, // F: ESTATUS
      { wch: 24 }, // G: GRÁFICO DE CUMPLIMIENTO
      { wch: 36 }  // H: OBSERVACIONES / IMPACTO
    ];

    return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 2: CÉDULA DE DESVIACIONES DETALLADAS (DEV-PO-QM-01)
  // ══════════════════════════════════════════════════════════════════════════

  private buildDeviationsSheet(board: QualityMonthlyBoard): XLSX.WorkSheet {
    const devs = board.deviations || [];

    const headers = [
      'FOLIO',
      'FECHA',
      'HORA',
      'NO. REMISIÓN',
      'SKU / CÓDIGO',
      'DESCRIPCIÓN DEL PRODUCTO',
      'UA / SSCC (LOTE)',
      'TIPO MATERIAL',
      'UBICACIÓN / BAHÍA',
      'UNIDADES DAÑADAS',
      'COSTO MATERIAL ($ MXN)',
      'CONDICIÓN FÍSICA DETECTADA',
      'MOTIVO (CAUSA RAÍZ)',
      'ÁREA DE DETECCIÓN',
      'COLABORADOR INVOLUCRADO',
      'ACCIÓN CORRECTIVA / DICTAMEN',
      'OBSERVACIONES',
      'ESTATUS'
    ];

    const rows = devs.map(d => [
      d.folio,
      d.deviationDate,
      d.deviationTime || '12:00',
      d.remisionNumber || 'N/A',
      d.skuId,
      d.skuDescription || 'N/A',
      d.uaCode,
      QUALITY_MATERIAL_TYPE_LABELS[d.materialType as keyof typeof QUALITY_MATERIAL_TYPE_LABELS] || d.materialType,
      d.bayLocationCode || 'N/A',
      d.damagedUnits || 0,
      d.materialCost || 0,
      QUALITY_CONDITION_LABELS[d.conditionDeviation as keyof typeof QUALITY_CONDITION_LABELS] || d.conditionDeviation,
      QUALITY_ROOT_CAUSE_LABELS[d.rootCauseMotive as keyof typeof QUALITY_ROOT_CAUSE_LABELS] || d.rootCauseMotive,
      d.originArea || 'OPERACIONES',
      d.responsibleCollaborator || 'No especificado',
      QUALITY_ACTION_LABELS[d.actionTaken as keyof typeof QUALITY_ACTION_LABELS] || d.actionTaken,
      d.observations || '',
      d.isResolved ? 'RESUELTO / CERRADO' : 'ABIERTO / EN INSPECCIÓN'
    ]);

    const totalUnits = devs.reduce((sum, d) => sum + (d.damagedUnits || 0), 0);
    const totalCost = devs.reduce((sum, d) => sum + (d.materialCost || 0), 0);

    const totalsRow = [
      'TOTALES',
      `${devs.length} Registros`,
      '',
      '',
      '',
      'SUMATORIA MENSUAL DE DAÑOS',
      '',
      '',
      '',
      totalUnits,
      `$ ${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`,
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];

    const rawData = [
      ['4GUARD WMS — CÉDULA DETALLADA DE DESVIACIONES DE CALIDAD (DEV-PO-QM-01)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`PERIODO: ${board.monthName?.toUpperCase() || 'MES'} ${board.year}   |   ALMACÉN: ${board.branchName || 'TOLUCA - NAVE M1'}   |   REGISTROS TOTALES: ${devs.length}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [],
      headers,
      ...rows,
      totalsRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(rawData);

    // Fusión de celdas de encabezado maestro y subtítulo (18 Columnas A:R)
    this.mergeAndStyle(ws, 0, 0, 0, 17, STYLES.mainTitle);
    this.mergeAndStyle(ws, 1, 0, 1, 17, STYLES.subTitle);

    // Headers de la tabla (Fila 3)
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      this.applyStyleToCell(ws, ref, STYLES.tableHeader);
    }

    // Filas de datos (Fila 4 a 4 + devs.length - 1)
    for (let r = 0; r < rows.length; r++) {
      const rowIndex = 4 + r;
      const isZebra = r % 2 === 1;
      const baseStyle = isZebra ? { ...STYLES.dataCellLeft, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellLeft;
      const baseCenter = isZebra ? { ...STYLES.dataCellCenter, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellCenter;
      const baseRight = isZebra ? { ...STYLES.dataCellRight, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellRight;

      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c });
        if (c === 0 || c === 1 || c === 2 || c === 4 || c === 6 || c === 8 || c === 17) {
          this.applyStyleToCell(ws, ref, baseCenter);
        } else if (c === 9 || c === 10) {
          this.applyStyleToCell(ws, ref, baseRight);
        } else {
          this.applyStyleToCell(ws, ref, baseStyle);
        }
      }
    }

    // Fila de Totales (Última fila)
    const totalRowIndex = 4 + rows.length;
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: totalRowIndex, c });
      this.applyStyleToCell(ws, ref, STYLES.totalsRow);
    }

    // Alturas de Fila
    const rowHeights: { hpt: number }[] = [];
    rowHeights[0] = { hpt: 32 };
    rowHeights[1] = { hpt: 22 };
    rowHeights[2] = { hpt: 10 };
    rowHeights[3] = { hpt: 26 };
    for (let r = 0; r < rows.length; r++) {
      rowHeights[4 + r] = { hpt: 20 };
    }
    rowHeights[totalRowIndex] = { hpt: 24 };
    ws['!rows'] = rowHeights;

    ws['!cols'] = [
      { wch: 18 }, // Folio
      { wch: 14 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 18 }, // Remision
      { wch: 16 }, // SKU
      { wch: 38 }, // Descripcion
      { wch: 22 }, // UA / SSCC
      { wch: 22 }, // Material
      { wch: 18 }, // Bahía
      { wch: 16 }, // Unidades
      { wch: 22 }, // Costo
      { wch: 32 }, // Condicion
      { wch: 32 }, // Causa Raiz
      { wch: 18 }, // Area
      { wch: 26 }, // Colaborador
      { wch: 28 }, // Accion
      { wch: 38 }, // Observaciones
      { wch: 22 }  // Estatus
    ];

    return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 3: EXPEDIENTES DE RECLAMOS E INCIDENCIAS (F02)
  // ══════════════════════════════════════════════════════════════════════════

  private buildClaimsSheet(claims: QualityClaim[], year: number, month: number): XLSX.WorkSheet {
    const headers = [
      'FOLIO',
      'FECHA',
      'HORA',
      'CLIENTE / PROVEEDOR',
      'ETAPA DEL PROCESO',
      'SKU / CÓDIGO',
      'DESCRIPCIÓN DEL PRODUCTO',
      'LOTE AFECTADO',
      'NO. REMISIÓN',
      'TIPIFICACIÓN DEL DEFECTO',
      'PIEZAS DAÑADAS',
      'PIEZAS EXTRAVIADAS / MERMA',
      'COSTO ASOCIADO ($ MXN)',
      'ESTATUS',
      'AUTORIZADO POR',
      'OBSERVACIONES'
    ];

    const rows = claims.map(c => [
      c.folio,
      c.date,
      c.time || '12:00',
      c.clientName,
      CLAIM_STAGE_LABELS[c.stage]?.label || c.stage,
      c.sku,
      c.productDescription,
      c.batchNumber,
      c.remisionNumber,
      CLAIM_DEFECT_TYPE_LABELS[c.defectType] || c.defectType,
      c.damagedQty || 0,
      c.lostQty || 0,
      c.associatedCost || 0,
      c.status,
      c.authorizedByName || 'Auditor QM',
      c.observations || ''
    ]);

    const totalDamaged = claims.reduce((acc, c) => acc + (c.damagedQty || 0), 0);
    const totalLost = claims.reduce((acc, c) => acc + (c.lostQty || 0), 0);
    const totalCost = claims.reduce((acc, c) => acc + (c.associatedCost || 0), 0);

    const totalsRow = [
      'TOTALES',
      `${claims.length} Reclamos`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'SUMATORIA TOTAL',
      totalDamaged,
      totalLost,
      `$ ${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`,
      '',
      '',
      ''
    ];

    const rawData = [
      ['4GUARD WMS — DICTAMEN DE RECLAMOS E INCIDENCIAS DE CALIDAD (F02-PO-GC-8.6-04)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`PERIODO FISCAL: ${month}/${year}   |   EXPEDIENTE DE NO CONFORMIDAD & IMPACTO FINANCIERO   |   TOTAL EXPEDIENTES: ${claims.length}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [],
      headers,
      ...rows,
      totalsRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(rawData);

    // Fusión de celdas A1:P1 y A2:P2 (16 Columnas)
    this.mergeAndStyle(ws, 0, 0, 0, 15, STYLES.mainTitle);
    this.mergeAndStyle(ws, 1, 0, 1, 15, STYLES.subTitle);

    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      this.applyStyleToCell(ws, ref, STYLES.tableHeader);
    }

    for (let r = 0; r < rows.length; r++) {
      const rowIndex = 4 + r;
      const isZebra = r % 2 === 1;
      const baseStyle = isZebra ? { ...STYLES.dataCellLeft, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellLeft;
      const baseCenter = isZebra ? { ...STYLES.dataCellCenter, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellCenter;
      const baseRight = isZebra ? { ...STYLES.dataCellRight, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellRight;

      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c });
        if (c === 0 || c === 1 || c === 2 || c === 4 || c === 5 || c === 7 || c === 8 || c === 13) {
          this.applyStyleToCell(ws, ref, baseCenter);
        } else if (c === 10 || c === 11 || c === 12) {
          this.applyStyleToCell(ws, ref, baseRight);
        } else {
          this.applyStyleToCell(ws, ref, baseStyle);
        }
      }
    }

    const totalRowIndex = 4 + rows.length;
    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: totalRowIndex, c });
      this.applyStyleToCell(ws, ref, STYLES.totalsRow);
    }

    // Alturas de Fila
    const rowHeights: { hpt: number }[] = [];
    rowHeights[0] = { hpt: 32 };
    rowHeights[1] = { hpt: 22 };
    rowHeights[2] = { hpt: 10 };
    rowHeights[3] = { hpt: 26 };
    for (let r = 0; r < rows.length; r++) {
      rowHeights[4 + r] = { hpt: 20 };
    }
    rowHeights[totalRowIndex] = { hpt: 24 };
    ws['!rows'] = rowHeights;

    ws['!cols'] = [
      { wch: 18 }, // Folio
      { wch: 14 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 28 }, // Cliente
      { wch: 24 }, // Etapa
      { wch: 16 }, // SKU
      { wch: 38 }, // Descripcion
      { wch: 20 }, // Lote
      { wch: 20 }, // Remision
      { wch: 30 }, // Tipificacion
      { wch: 16 }, // Dañadas
      { wch: 18 }, // Merma
      { wch: 24 }, // Costo
      { wch: 16 }, // Estatus
      { wch: 24 }, // Autorizado por
      { wch: 38 }  // Observaciones
    ];

    return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HOJA 4: VERIFICACIONES DE CARGA (F01)
  // ══════════════════════════════════════════════════════════════════════════

  private buildVerificationsSheet(verifications: LoadVerification[]): XLSX.WorkSheet {
    const headers = [
      'FOLIO',
      'FECHA',
      'HORA',
      'CLIENTE',
      'REMISIÓN / EMBARQUE',
      'DESCRIPCIÓN DEL PRODUCTO',
      'RAMPA / ANDÉN',
      'ESTADO DEL DICTAMEN',
      'CRITERIOS PRODUCTO CONFORME',
      'CRITERIOS TRANSPORTE CONFORME',
      'AUDITOR ELABORÓ',
      'SUPERINTENDENCIA APROBÓ'
    ];

    const rows = verifications.map(v => {
      const prodOk = v.productCriteria ? v.productCriteria.filter(c => c.value === 'SI').length : 8;
      const transOk = v.transportCriteria ? v.transportCriteria.filter(c => c.value === 'SI').length : 9;

      return [
        v.folio,
        v.date,
        v.time || '12:00',
        v.clientName,
        v.remisionNumber || 'N/A',
        v.productDescription || 'N/A',
        v.ramp || 'Rampa 01',
        v.status,
        `${prodOk} / 8 Conformes`,
        `${transOk} / 9 Conformes`,
        v.elaboratedBy?.name || 'Laura Valdés',
        v.approvedBy?.name || 'Fernando Treviño'
      ];
    });

    const rawData = [
      ['4GUARD WMS — PROTOCOLO OFICIAL DE VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03 Rev. 03)', '', '', '', '', '', '', '', '', '', '', ''],
      [`INSTRUCTIVOS APLICABLES: IT01-PO-GC-8.6-01 E IT02-PO-GC-8.6-02   |   TOTAL INSPECCIONES: ${verifications.length}`, '', '', '', '', '', '', '', '', '', '', ''],
      [],
      headers,
      ...rows
    ];

    const ws = XLSX.utils.aoa_to_sheet(rawData);

    // Fusión de celdas A1:L1 y A2:L2 (12 Columnas)
    this.mergeAndStyle(ws, 0, 0, 0, 11, STYLES.mainTitle);
    this.mergeAndStyle(ws, 1, 0, 1, 11, STYLES.subTitle);

    for (let c = 0; c < headers.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      this.applyStyleToCell(ws, ref, STYLES.tableHeader);
    }

    for (let r = 0; r < rows.length; r++) {
      const rowIndex = 4 + r;
      const isZebra = r % 2 === 1;
      const baseStyle = isZebra ? { ...STYLES.dataCellLeft, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellLeft;
      const baseCenter = isZebra ? { ...STYLES.dataCellCenter, fill: { fgColor: { rgb: COLORS.SLATE_BG } } } : STYLES.dataCellCenter;

      for (let c = 0; c < headers.length; c++) {
        const ref = XLSX.utils.encode_cell({ r: rowIndex, c });
        if (c === 0 || c === 1 || c === 2 || c === 6 || c === 7 || c === 8 || c === 9) {
          this.applyStyleToCell(ws, ref, baseCenter);
        } else {
          this.applyStyleToCell(ws, ref, baseStyle);
        }
      }
    }

    // Alturas de Fila
    const rowHeights: { hpt: number }[] = [];
    rowHeights[0] = { hpt: 32 };
    rowHeights[1] = { hpt: 22 };
    rowHeights[2] = { hpt: 10 };
    rowHeights[3] = { hpt: 26 };
    for (let r = 0; r < rows.length; r++) {
      rowHeights[4 + r] = { hpt: 20 };
    }
    ws['!rows'] = rowHeights;

    ws['!cols'] = [
      { wch: 18 }, // Folio
      { wch: 14 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 28 }, // Cliente
      { wch: 22 }, // Remision
      { wch: 38 }, // Descripcion
      { wch: 16 }, // Rampa
      { wch: 18 }, // Estado
      { wch: 28 }, // Prod Conforme
      { wch: 28 }, // Transp Conforme
      { wch: 24 }, // Elaboro
      { wch: 24 }  // Aprobo
    ];

    return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS DE ESTILIZADO, FUSIONES Y BARRAS VISUALES
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Fusiona un rango de celdas (startRow, startCol) -> (endRow, endCol)
   * y aplica el estilo indicado a TODAS las celdas del bloque para evitar artefactos visuales en Excel.
   */
  private mergeAndStyle(
    ws: XLSX.WorkSheet,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    style: any
  ): void {
    if (!ws['!merges']) {
      ws['!merges'] = [];
    }
    ws['!merges'].push({
      s: { r: startRow, c: startCol },
      e: { r: endRow, c: endCol }
    });

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) {
          ws[cellRef] = { v: '', t: 's' };
        }
        ws[cellRef].s = { ...style };
      }
    }
  }

  /**
   * Aplica un estilo específico a una celda individual.
   */
  private applyStyleToCell(ws: XLSX.WorkSheet, cellRef: string, style: any): void {
    if (!ws[cellRef]) {
      ws[cellRef] = { v: '', t: 's' };
    }
    ws[cellRef].s = { ...style };
  }

  private generateAsciiProgressBar(percentage: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    const totalBlocks = 10;
    const filledBlocks = Math.round((clamped / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    return `[${bar}] ${clamped}%`;
  }

  private generateAsciiBar(percentage: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
    const length = Math.max(1, Math.round(clamped / 10));
    return '█'.repeat(length) + ` ${clamped}%`;
  }
}
