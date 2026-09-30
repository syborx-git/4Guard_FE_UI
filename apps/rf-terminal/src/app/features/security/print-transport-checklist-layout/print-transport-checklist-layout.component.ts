/**
 * @file print-transport-checklist-layout.component.ts
 * @description Formato de impresión oficial "FORMATO - CHECK LIST DE TRANSPORTE" (F01-PO-CP-7.1.3-03).
 * Replicación fiel y de alta precisión visual para Seguridad Patrimonial / Caseta de Vigilancia de 4GUARD WMS.
 * Ajustado con márgenes armónicos, tipografía legible y alta densidad para previsualización e impresión física/PDF.
 */

import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TransportChecklistPrintData {
  controlNumber?: string;
  revisionNumber?: string;
  revisionDate?: string;
  emissionDate?: string;
  processOwner?: string;
  elaboratedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;

  // Datos Generales
  fecha?: string;
  noCartaPorte?: string;
  remision?: string;
  cliente?: string;
  procedimiento?: string;
  operacion?: 'CARGA' | 'DESCARGA';
  horaEntrada?: string;
  horaSalida?: string;

  // Datos del Transporte
  lineaTransporte?: string;
  nombreOperador?: string;
  telefonoChofer?: string;
  driverPhone?: string;
  noRampa?: string | number;
  placasTracto?: string;
  noEcoTractor?: string;
  placasCaja?: string;
  medidasCaja?: string;
  noSello?: string;
  tipoTransporte?: string;

  // Checklist EPP
  eppZapatos?: 'SI' | 'NO';
  eppZapatosObs?: string;
  eppCofia?: 'SI' | 'NO';
  eppCofiaObs?: string;
  eppCubrebocas?: 'SI' | 'NO';
  eppCubrebocasObs?: string;
  eppChaleco?: 'SI' | 'NO';
  eppChalecoObs?: string;

  // Checklist Documentos
  docCartaPorte?: 'SI' | 'NO';
  docCartaPorteObs?: string;
  docRemision?: 'SI' | 'NO';
  docRemisionObs?: string;

  // Revisión Unidad
  revInteriorCaja?: 'SI' | 'NO';
  revInteriorCajaObs?: string;
  revDanosCaja?: 'SI' | 'NO';
  revDanosCajaObs?: string;
  revDanosPuertas?: 'SI' | 'NO';
  revDanosPuertasObs?: string;
  revOloresExtranos?: 'SI' | 'NO';
  revOloresExtranosObs?: string;
  revIndiciosPlagas?: 'SI' | 'NO';
  revIndiciosPlagasObs?: string;

  // Firmas
  responsableVigilanciaNombre?: string;
  responsableVigilanciaFirma?: boolean;
  transportistaNombre?: string;
  driverSignature?: string;

  folio?: string;
  token?: string;
}

@Component({
  selector: 'fg-print-transport-checklist-layout',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div *ngIf="data" class="f01-print-sheet" id="f01-document-sheet">
      
      <!-- ════════════════════════════════════════════════════════════════════════════════
           1. ENCABEZADO INSTITUCIONAL OFICIAL (F01-PO-CP-7.1.3-03)
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="f01-table f01-header-table">
        <tbody>
          <tr>
            <!-- Logo 4Guard -->
            <td rowspan="2" class="f01-logo-cell">
              <div class="f01-brand-box">
                <span class="f01-brand-badge">4G</span>
                <div class="f01-brand-text">
                  <strong class="f01-brand-name">4GUARD</strong>
                  <span class="f01-brand-sub">WMS LOGISTICS</span>
                </div>
              </div>
            </td>
            <!-- Título Central -->
            <td class="f01-title-cell">
              <span class="f01-doc-type">FORMATO INSTITUCIONAL</span>
              <h2 class="f01-doc-title">CHECK LIST DE TRANSPORTE</h2>
            </td>
            <!-- Código y Control -->
            <td class="f01-meta-cell">
              <div class="f01-meta-row f01-meta-row--highlight">
                <span class="f01-meta-lbl">No. de Control:</span>
                <strong class="f01-meta-val font-mono">{{ data.controlNumber || 'F01-PO-CP-7.1.3-03' }}</strong>
              </div>
              <div class="f01-meta-row">
                <span class="f01-meta-lbl">Revisión:</span>
                <strong class="f01-meta-val">{{ data.revisionNumber || '01' }}</strong>
                <span class="f01-meta-sep">|</span>
                <span class="f01-meta-lbl">Fecha:</span>
                <span class="f01-meta-val">{{ data.revisionDate || '19/08/2025' }}</span>
              </div>
            </td>
          </tr>
          <tr class="f01-subhead-row">
            <td class="f01-subhead-center">
              <span>Dueño: <strong>{{ data.processOwner || 'Seguridad Patrimonial' }}</strong></span>
              <span class="f01-meta-sep">•</span>
              <span>Emisión: <strong>{{ data.emissionDate || '19/08/2025' }}</strong></span>
            </td>
            <td class="f01-subhead-approval">
              <span>Elab: <strong>{{ data.elaboratedBy || 'SP' }}</strong></span>
              <span class="f01-meta-sep">•</span>
              <span>Rev: <strong>{{ data.reviewedBy || 'CG' }}</strong></span>
              <span class="f01-meta-sep">•</span>
              <span>Aprob: <strong>{{ data.approvedBy || 'DG' }}</strong></span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           2. DATOS GENERALES
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="f01-table f01-section-table">
        <thead>
          <tr class="f01-section-header">
            <th colspan="6">1. DATOS GENERALES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="f01-lbl col-dg-lbl1">Fecha:</td>
            <td class="f01-val col-dg-val1 font-bold">{{ data.fecha }}</td>
            <td class="f01-lbl col-dg-lbl2">No. Carta Porte:</td>
            <td class="f01-val col-dg-val2 font-mono font-bold">{{ data.noCartaPorte || '-' }}</td>
            <td class="f01-lbl col-dg-lbl3">Remisión:</td>
            <td class="f01-val col-dg-val3 font-mono font-bold">{{ data.remision || '-' }}</td>
          </tr>
          <tr>
            <td class="f01-lbl">Cliente:</td>
            <td class="f01-val font-bold text-dark">{{ data.cliente }}</td>
            <td class="f01-lbl">Procedimiento:</td>
            <td class="f01-val font-semibold">
              <div class="f01-checkbox-group">
                <span class="f01-check-item">
                  <span class="f01-box-square" [class.f01-box-square--checked]="data.operacion === 'CARGA'">{{ data.operacion === 'CARGA' ? '✓' : '' }}</span> Carga
                </span>
                <span class="f01-check-item">
                  <span class="f01-box-square" [class.f01-box-square--checked]="data.operacion === 'DESCARGA'">{{ data.operacion === 'DESCARGA' ? '✓' : '' }}</span> Descarga
                </span>
              </div>
            </td>
            <td class="f01-lbl">Horario:</td>
            <td class="f01-val f01-val--times font-mono">
              <div><strong>Entrada:</strong> {{ formatTime(data.horaEntrada) }}</div>
              <div><strong>Salida:</strong> {{ formatTime(data.horaSalida) }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           3. DATOS DEL TRANSPORTE
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="f01-table f01-section-table">
        <thead>
          <tr class="f01-section-header">
            <th colspan="6">2. DATOS DEL TRANSPORTE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="f01-lbl col-dt-lbl1">Línea Transp.:</td>
            <td class="f01-val col-dt-val1 font-bold">{{ data.lineaTransporte }}</td>
            <td class="f01-lbl col-dt-lbl2">Nombre Chofer:</td>
            <td class="f01-val col-dt-val2 font-bold">{{ data.nombreOperador }}</td>
            <td class="f01-lbl col-dt-lbl3">No. Rampa:</td>
            <td class="f01-val col-dt-val3 font-bold font-mono text-highlight">{{ data.noRampa || 'R-01' }}</td>
          </tr>
          <tr>
            <td class="f01-lbl">Placas Tracto:</td>
            <td class="f01-val font-mono font-bold">{{ data.placasTracto || '-' }}</td>
            <td class="f01-lbl">No. Eco Tracto:</td>
            <td class="f01-val font-mono font-bold">{{ data.noEcoTractor || '-' }}</td>
            <td class="f01-lbl">Placas Caja:</td>
            <td class="f01-val font-mono font-bold">{{ data.placasCaja || '-' }}</td>
          </tr>
          <tr>
            <td class="f01-lbl">Medidas Caja:</td>
            <td class="f01-val font-semibold">{{ data.medidasCaja || '53 Pies' }}</td>
            <td class="f01-lbl">No. Sello(s):</td>
            <td class="f01-val font-mono font-bold text-highlight">{{ data.noSello || '-' }}</td>
            <td class="f01-lbl">Tipo Unidad:</td>
            <td class="f01-val font-semibold">{{ data.tipoTransporte || 'Caja Seca' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           4. REVISIÓN DEL TRANSPORTE (CHECKLIST COMPLETO)
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="f01-table f01-checklist-table">
        <thead>
          <tr class="f01-section-header">
            <th class="col-chk-criterios text-left">3. CRITERIOS DE REVISIÓN</th>
            <th class="col-chk-opt text-center">SÍ</th>
            <th class="col-chk-opt text-center">NO</th>
            <th class="col-chk-obs text-left">OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          <!-- ── Grupo EPP ── -->
          <tr class="f01-group-header">
            <td colspan="4">EPP (Equipo de Protección Personal del Conductor)</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Zapatos de seguridad industrial con casquillo</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppZapatos === 'SI'">{{ data.eppZapatos === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppZapatos === 'NO'">{{ data.eppZapatos === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.eppZapatosObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Cofia o red para cabello</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppCofia === 'SI'">{{ data.eppCofia === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppCofia === 'NO'">{{ data.eppCofia === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.eppCofiaObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Cubrebocas puesto correctamente</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppCubrebocas === 'SI'">{{ data.eppCubrebocas === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppCubrebocas === 'NO'">{{ data.eppCubrebocas === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.eppCubrebocasObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Chaleco de alta visibilidad con reflejante</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppChaleco === 'SI'">{{ data.eppChaleco === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.eppChaleco === 'NO'">{{ data.eppChaleco === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.eppChalecoObs || '' }}</td>
          </tr>

          <!-- ── Grupo Documentos ── -->
          <tr class="f01-group-header">
            <td colspan="4">Documentación Obligatoria</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Carta porte fiscal / Complemento Carta Porte</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.docCartaPorte === 'SI'">{{ data.docCartaPorte === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.docCartaPorte === 'NO'">{{ data.docCartaPorte === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.docCartaPorteObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Remisión o Factura de Embarque física / digital</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.docRemision === 'SI'">{{ data.docRemision === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.docRemision === 'NO'">{{ data.docRemision === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.docRemisionObs || '' }}</td>
          </tr>

          <!-- ── Grupo Unidad ── -->
          <tr class="f01-group-header">
            <td colspan="4">Inspección de Unidad y Caja</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Interior de caja limpio, seco y libre de impurezas</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revInteriorCaja === 'SI'">{{ data.revInteriorCaja === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revInteriorCaja === 'NO'">{{ data.revInteriorCaja === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.revInteriorCajaObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Daños visibles a la caja (golpes, fisuras o agujeros)</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revDanosCaja === 'SI'">{{ data.revDanosCaja === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revDanosCaja === 'NO'">{{ data.revDanosCaja === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.revDanosCajaObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Daños en puertas, bisagras o empaques de cierre</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revDanosPuertas === 'SI'">{{ data.revDanosPuertas === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revDanosPuertas === 'NO'">{{ data.revDanosPuertas === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.revDanosPuertasObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Olores extraños o sustancias químicas no identificadas</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revOloresExtranos === 'SI'">{{ data.revOloresExtranos === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revOloresExtranos === 'NO'">{{ data.revOloresExtranos === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.revOloresExtranosObs || '' }}</td>
          </tr>
          <tr>
            <td class="f01-criterio-lbl">Indicios de plagas, insectos o roedores</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revIndiciosPlagas === 'SI'">{{ data.revIndiciosPlagas === 'SI' ? 'X' : '' }}</td>
            <td class="f01-chk-cell" [class.f01-chk-selected]="data.revIndiciosPlagas === 'NO'">{{ data.revIndiciosPlagas === 'NO' ? 'X' : '' }}</td>
            <td class="f01-obs-cell">{{ data.revIndiciosPlagasObs || '' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           5. RESPONSABLES Y FIRMAS
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="f01-table f01-signatures-table">
        <thead>
          <tr class="f01-section-header">
            <th class="w-50 text-center">4. RESPONSABLE DE VIGILANCIA / CASETA</th>
            <th class="w-50 text-center">5. OPERADOR / TRANSPORTISTA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <!-- Columna Caseta -->
            <td class="f01-signature-box">
              <div class="f01-sign-field">
                <span class="f01-sign-lbl">Nombre:</span>
                <strong class="f01-sign-name">{{ data.responsableVigilanciaNombre || 'Guardia de Turno - Caseta Principal' }}</strong>
              </div>
              <div class="f01-sign-area">
                <span class="f01-sign-placeholder">(Firma física / Sello oficial de Caseta)</span>
              </div>
              <div class="f01-sign-caption">NOMBRE Y FIRMA DEL VIGILANTE / CASETA</div>
            </td>

            <!-- Columna Transportista -->
            <td class="f01-signature-box">
              <div class="f01-sign-field">
                <span class="f01-sign-lbl">Nombre:</span>
                <strong class="f01-sign-name">{{ data.transportistaNombre || data.nombreOperador || 'Operador Chofer' }}</strong>
              </div>
              <div class="f01-sign-area">
                <span class="f01-sign-placeholder">(Firma autógrafa del operador transportista)</span>
              </div>
              <div class="f01-sign-caption">NOMBRE Y FIRMA DEL CONDUCTOR / TRANSPORTISTA</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           6. PIE DE PÁGINA INSTITUCIONAL & TRAZABILIDAD WMS
      ════════════════════════════════════════════════════════════════════════════════ -->
      <div class="f01-footer">
        <div class="f01-footer-left">
          <span>4GUARD WMS &copy; 2026 — SISTEMA INTEGRAL DE SEGURIDAD PATRIMONIAL Y PATIO</span>
        </div>
        <div class="f01-footer-right font-mono">
          <span>FOLIO: <strong>{{ data.folio || 'N/A' }}</strong></span>
          <span class="f01-meta-sep">•</span>
          <span>TOKEN: <strong>{{ data.token || 'N/A' }}</strong></span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* ══════════════════════════════════════════════════════════════════
       ESTILOS AUTOCONTENIDOS Y DE ALTA DENSIDAD FORMATO F01
       ══════════════════════════════════════════════════════════════════ */
    .f01-print-sheet {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 10px !important;
      line-height: 1.25 !important;
      width: 100% !important;
      max-width: 820px !important;
      margin: 0 auto !important;
      padding: 20px 24px !important;
      box-sizing: border-box !important;
      border: 1.5px solid #334155 !important;
      border-radius: 6px !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25) !important;
      user-select: text !important;
      -webkit-user-select: text !important;
    }

    /* ── Tablas Base ── */
    .f01-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-bottom: 8px !important;
      table-layout: fixed !important;
      border: 1.5px solid #0f172a !important;
      background: #ffffff !important;
    }

    .f01-table td,
    .f01-table th {
      border: 1px solid #1e293b !important;
      padding: 4px 6px !important;
      font-size: 9.5px !important;
      color: #0f172a !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
    }

    /* ── Header Table ── */
    .f01-header-table {
      margin-bottom: 8px !important;
    }

    .f01-logo-cell {
      width: 140px !important;
      background: #f8fafc !important;
      text-align: center !important;
      padding: 8px 6px !important;
    }

    .f01-brand-box {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
    }

    .f01-brand-badge {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 26px !important;
      height: 26px !important;
      background: #0f172a !important;
      color: #d0af67 !important;
      font-size: 11px !important;
      font-weight: 900 !important;
      border-radius: 4px !important;
    }

    .f01-brand-text {
      display: flex !important;
      flex-direction: column !important;
      text-align: left !important;
    }

    .f01-brand-name {
      font-size: 13px !important;
      font-weight: 900 !important;
      letter-spacing: 0.05em !important;
      color: #0f172a !important;
      line-height: 1 !important;
    }

    .f01-brand-sub {
      font-size: 7.5px !important;
      font-weight: 700 !important;
      color: #64748b !important;
      letter-spacing: 0.08em !important;
    }

    .f01-title-cell {
      text-align: center !important;
      background: #f1f5f9 !important;
      padding: 6px !important;
    }

    .f01-doc-type {
      display: block !important;
      font-size: 8px !important;
      font-weight: 800 !important;
      letter-spacing: 0.12em !important;
      color: #475569 !important;
      text-transform: uppercase !important;
    }

    .f01-doc-title {
      font-size: 13px !important;
      font-weight: 900 !important;
      letter-spacing: 0.06em !important;
      color: #0f172a !important;
      margin: 2px 0 0 0 !important;
      text-transform: uppercase !important;
    }

    .f01-meta-cell {
      width: 200px !important;
      background: #f8fafc !important;
      font-size: 9px !important;
      padding: 5px 8px !important;
      text-align: right !important;
    }

    .f01-meta-row {
      display: flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      gap: 4px !important;
      line-height: 1.25 !important;
    }

    .f01-meta-row--highlight {
      border-bottom: 1px solid #cbd5e1 !important;
      padding-bottom: 3px !important;
      margin-bottom: 3px !important;
    }

    .f01-meta-lbl {
      color: #475569 !important;
      font-size: 8.5px !important;
      font-weight: 700 !important;
    }

    .f01-meta-val {
      color: #0f172a !important;
      font-weight: 800 !important;
    }

    .f01-meta-sep {
      color: #94a3b8 !important;
      font-size: 8.5px !important;
      margin: 0 2px !important;
    }

    .f01-subhead-row td {
      font-size: 8.5px !important;
      padding: 3px 6px !important;
      background: #f8fafc !important;
      color: #334155 !important;
    }

    .f01-subhead-center {
      text-align: center !important;
    }

    .f01-subhead-approval {
      text-align: center !important;
    }

    /* ── Sección Headers ── */
    .f01-section-header th {
      background: #e2e8f0 !important;
      color: #0f172a !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.05em !important;
      padding: 4px 8px !important;
      border: 1.5px solid #0f172a !important;
      text-align: left !important;
    }

    .f01-group-header td {
      background: #f1f5f9 !important;
      color: #1e293b !important;
      font-size: 9px !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.04em !important;
      padding: 3px 8px !important;
      border: 1px solid #1e293b !important;
    }

    /* ── Labels & Values ── */
    .f01-lbl {
      background: #f8fafc !important;
      font-weight: 700 !important;
      color: #334155 !important;
      font-size: 9px !important;
    }

    .f01-val {
      background: #ffffff !important;
      font-size: 9.5px !important;
      color: #0f172a !important;
    }

    .f01-val--times {
      font-size: 9px !important;
      line-height: 1.2 !important;
    }

    .text-highlight {
      color: #0f172a !important;
      font-weight: 800 !important;
    }

    /* Anchos de columnas balanceados para Datos Generales */
    .col-dg-lbl1 { width: 12% !important; }
    .col-dg-val1 { width: 20% !important; }
    .col-dg-lbl2 { width: 16% !important; }
    .col-dg-val2 { width: 20% !important; }
    .col-dg-lbl3 { width: 14% !important; }
    .col-dg-val3 { width: 18% !important; }

    /* Anchos de columnas balanceados para Datos del Transporte */
    .col-dt-lbl1 { width: 14% !important; }
    .col-dt-val1 { width: 22% !important; }
    .col-dt-lbl2 { width: 16% !important; }
    .col-dt-val2 { width: 22% !important; }
    .col-dt-lbl3 { width: 12% !important; }
    .col-dt-val3 { width: 14% !important; }

    /* Columnas Checklist */
    .col-chk-criterios { width: 44% !important; }
    .col-chk-opt       { width: 7% !important; }
    .col-chk-obs       { width: 42% !important; }

    .f01-checkbox-group {
      display: flex !important;
      align-items: center !important;
      gap: 14px !important;
    }

    .f01-check-item {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-size: 9px !important;
    }

    .f01-box-square {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 14px !important;
      height: 14px !important;
      border: 1.5px solid #0f172a !important;
      border-radius: 2px !important;
      font-size: 10px !important;
      font-weight: 900 !important;
      line-height: 1 !important;
      background: #ffffff !important;
    }

    .f01-box-square--checked {
      background: #0f172a !important;
      color: #ffffff !important;
    }

    .f01-criterio-lbl {
      font-size: 9.5px !important;
      font-weight: 600 !important;
      color: #1e293b !important;
      padding-left: 8px !important;
    }

    .f01-chk-cell {
      text-align: center !important;
      font-weight: 900 !important;
      font-size: 11px !important;
      font-family: 'JetBrains Mono', monospace !important;
    }

    .f01-chk-selected {
      background: #f1f5f9 !important;
      color: #0f172a !important;
    }

    .f01-obs-cell {
      font-size: 9px !important;
      color: #334155 !important;
      font-style: italic !important;
      padding-left: 8px !important;
    }

    /* ── Firmas ── */
    .f01-signature-box {
      padding: 8px 10px !important;
      vertical-align: top !important;
      background: #ffffff !important;
    }

    .f01-sign-field {
      display: flex !important;
      align-items: baseline !important;
      gap: 5px !important;
      margin-bottom: 6px !important;
      font-size: 9.5px !important;
    }

    .f01-sign-lbl {
      color: #475569 !important;
      font-weight: 700 !important;
      font-size: 9px !important;
    }

    .f01-sign-name {
      color: #0f172a !important;
      font-weight: 800 !important;
    }

    .f01-sign-area {
      height: 42px !important;
      border-bottom: 1.5px dashed #94a3b8 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-bottom: 5px !important;
    }

    .f01-sign-placeholder {
      font-size: 8.5px !important;
      font-style: italic !important;
      color: #94a3b8 !important;
    }

    .f01-sign-caption {
      text-align: center !important;
      font-size: 8px !important;
      font-weight: 800 !important;
      color: #475569 !important;
      letter-spacing: 0.05em !important;
      text-transform: uppercase !important;
    }

    /* ── Footer ── */
    .f01-footer {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      font-size: 8px !important;
      color: #64748b !important;
      padding-top: 6px !important;
      border-top: 1px solid #cbd5e1 !important;
      margin-top: 6px !important;
    }

    .f01-footer-left {
      font-weight: 600 !important;
    }

    .f01-footer-right {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    /* ── Clases Utilitarias Fijas ── */
    .font-mono { font-family: 'JetBrains Mono', monospace !important; }
    .font-bold { font-weight: 700 !important; }
    .font-semibold { font-weight: 600 !important; }
    .text-center { text-align: center !important; }
    .text-left { text-align: left !important; }
    .text-right { text-align: right !important; }
    .w-50 { width: 50% !important; }

    /* ── Reglas de Impresión Física ── */
    @page {
      size: letter portrait;
      margin: 6mm;
    }

    @media print {
      body, html {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .f01-print-sheet {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 auto !important;
        border: none !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .f01-table {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        border-color: #000000 !important;
        margin-bottom: 6px !important;
      }
      .f01-table td,
      .f01-table th {
        border-color: #000000 !important;
        color: #000000 !important;
      }
    }
  `]
})
export class PrintTransportChecklistLayoutComponent {
  @Input() data?: TransportChecklistPrintData;

  formatTime(val?: string | null): string {
    if (!val) return '--:--';
    const str = String(val).trim();
    if (!str || str === '--:--' || str === 'null' || str === 'undefined') return '--:--';
    const withoutMillis = str.split('.')[0];
    if (withoutMillis.includes('T')) {
      return withoutMillis.split('T')[1];
    }
    return withoutMillis;
  }
}
