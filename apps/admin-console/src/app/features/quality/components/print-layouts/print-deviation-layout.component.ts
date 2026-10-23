/**
 * @file print-deviation-layout.component.ts
 * @description Cédula Oficial de Impresión "REPORTE DE DESVIACIÓN DE CALIDAD EN ALMACÉN / DESCARGA (DEV-PO-QM-01)"
 * Homologado bajo ADR-015 y SDD pdf-print-export.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  QualityDeviation,
  QUALITY_MATERIAL_TYPE_LABELS,
  QUALITY_CONDITION_LABELS,
  QUALITY_ROOT_CAUSE_LABELS,
  QUALITY_ACTION_LABELS
} from '../../models/quality.models';

@Component({
  selector: 'fg-print-deviation-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="deviation" id="official-deviation-print-sheet" class="print-container dev-pdf-sheet bg-white text-black font-sans mx-auto">
      
      <!-- ── 1. ENCABEZADO INSTITUCIONAL CORPORATIVO ── -->
      <div class="flex justify-between items-start mb-2 pb-1.5 border-b-2 border-[#0c2340]">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[42px] sm:max-w-[48px] object-contain rounded" />
          <div>
            <h1 class="text-sm sm:text-base font-extrabold tracking-tight text-[#0c2340] m-0">4-GUARD WMS</h1>
            <p class="text-[8px] sm:text-[8.5px] text-slate-600 font-semibold uppercase leading-tight m-0">
              Calle. Industria Automotriz sin número, Colonia el Coecillo, Toluca, Edo. Méx., C.P 50246.
            </p>
          </div>
        </div>
        <div class="text-right">
          <div class="inline-block bg-[#0c2340] text-white px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wide mb-0.5">
            CÉDULA DEV-PO-QM-01
          </div>
          <p class="text-[8.5px] font-mono font-bold text-slate-800 m-0">EMISIÓN: {{ printDate }}</p>
        </div>
      </div>

      <!-- ── 2. TÍTULO CENTRAL ── -->
      <div class="text-center mb-2 bg-slate-100 py-1 border-y border-black">
        <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0c2340] m-0">
          CÉDULA DE DESVIACIÓN DE CALIDAD EN ALMACÉN Y DESCARGA
        </h2>
        <span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-wide">
          REGISTRO OFICIAL DE MERMA, DAÑO DE MATERIAL & DICTAMEN FSM
        </span>
      </div>

      <!-- ── 3. METADATOS DEL EXPEDIENTE ── -->
      <table class="dev-table w-full mb-2 text-[8px]">
        <tr>
          <td class="p-1 w-[25%] bg-slate-50 font-bold border-r border-black text-[#0c2340]">FOLIO DE DESVIACIÓN:</td>
          <td class="p-1 w-[25%] border-r border-black font-mono font-bold text-[9px] text-[#b8923d]">{{ deviation.folio }}</td>
          <td class="p-1 w-[25%] bg-slate-50 font-bold border-r border-black text-[#0c2340]">FECHA Y HORA:</td>
          <td class="p-1 w-[25%] font-mono font-bold">{{ deviation.deviationDate }} · {{ deviation.deviationTime }} hrs</td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black text-[#0c2340]">TIPO DE MATERIAL:</td>
          <td class="p-1 border-r border-black font-bold">
            {{ materialLabels[deviation.materialType] || deviation.materialType }}
          </td>
          <td class="p-1 bg-slate-50 font-bold border-r border-black text-[#0c2340]">UBICACIÓN / BAHÍA:</td>
          <td class="p-1 font-mono font-bold">{{ deviation.bayLocationCode || 'N/A' }}</td>
        </tr>
      </table>

      <!-- ── 4. TRAZABILIDAD Y MATERIAL AFECTADO ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">1. IDENTIFICACIÓN DE MATERIAL Y TRAZABILIDAD</span>
      </div>

      <table class="dev-table w-full mb-2 text-[7.5px]">
        <thead>
          <tr class="bg-slate-100 font-bold uppercase text-[7px] border-b border-black">
            <th class="p-1 border-r border-black text-left w-[20%]">SKU / CÓDIGO</th>
            <th class="p-1 border-r border-black text-left w-[35%]">DESCRIPCIÓN DEL MATERIAL</th>
            <th class="p-1 border-r border-black text-center w-[25%]">UA / SSCC (LOTE)</th>
            <th class="p-1 text-center w-[20%]">NO. REMISIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="p-1 border-r border-black font-mono font-bold">{{ deviation.skuId }}</td>
            <td class="p-1 border-r border-black font-medium">{{ deviation.skuDescription || 'N/A' }}</td>
            <td class="p-1 border-r border-black font-mono font-bold text-center text-blue-800">{{ deviation.uaCode }}</td>
            <td class="p-1 font-mono font-bold text-center text-amber-700">{{ deviation.remisionNumber }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ── 5. DIAGNÓSTICO, CAUSA RAÍZ Y COSTO ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">2. DIAGNÓSTICO, CAUSA RAÍZ Y COSTO DE NO CALIDAD</span>
      </div>

      <table class="dev-table w-full mb-2 text-[7.5px]">
        <tr>
          <td class="p-1 bg-slate-50 font-bold border-r border-black w-[30%]">CONDICIÓN FÍSICA DETECTADA:</td>
          <td class="p-1 border-r border-black font-bold text-red-700 w-[70%]" colspan="3">
            {{ conditionLabels[deviation.conditionDeviation] || deviation.conditionDeviation }}
          </td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black">MOTIVO DEL DAÑO (CAUSA RAÍZ):</td>
          <td class="p-1 border-r border-black font-bold" colspan="3">
            {{ rootCauseLabels[deviation.rootCauseMotive] || deviation.rootCauseMotive }}
          </td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black">ÁREA DE DETECCIÓN:</td>
          <td class="p-1 border-r border-black font-bold">{{ deviation.originArea || 'OPERACIONES' }}</td>
          <td class="p-1 bg-slate-50 font-bold border-r border-black">COLABORADOR INVOLUCRADO:</td>
          <td class="p-1 font-medium">{{ deviation.responsibleCollaborator || 'No especificado' }}</td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black">PIEZAS DAÑADAS:</td>
          <td class="p-1 border-r border-black font-mono font-bold text-amber-700">{{ deviation.damagedUnits }} Pzas</td>
          <td class="p-1 bg-slate-50 font-bold border-r border-black">COSTO DE NO CALIDAD:</td>
          <td class="p-1 font-mono font-black text-emerald-700">{{ formatCurrency(deviation.materialCost) }} MXN</td>
        </tr>
        <tr class="border-t border-black bg-amber-50">
          <td class="p-1 font-bold border-r border-black text-[#0c2340]">ACCIÓN TOMADA / RESOLUCIÓN:</td>
          <td class="p-1 font-bold text-[#0c2340]" colspan="3">
            {{ actionLabels[deviation.actionTaken] || deviation.actionTaken }}
          </td>
        </tr>
      </table>

      <!-- ── 6. OBSERVACIONES TÉCNICAS ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">3. OBSERVACIONES & JUSTIFICACIÓN TÉCNICA</span>
      </div>

      <div class="border border-black p-1.5 mb-2 bg-slate-50 text-[7.5px] leading-relaxed">
        <p class="m-0 italic text-slate-800">
          "{{ deviation.observations || 'Sin observaciones adicionales asentadas en la bitácora técnica.' }}"
        </p>
      </div>

      <!-- ── 7. FIRMAS NORMATIVAS Y SELLOS DIGITALES QR ── -->
      <table class="dev-table w-full mb-1 text-[7.5px]">
        <thead>
          <tr class="bg-[#0c2340] text-white font-bold uppercase text-[7px]">
            <th class="p-1 border-r border-black text-center w-[50%]">AUDITOR DE CALIDAD (QM)</th>
            <th class="p-1 text-center w-[50%]">RESPONSABLE DE OPERACIONES / ALMACÉN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <!-- Auditor QM -->
            <td class="p-1.5 border-r border-black align-middle">
              <div class="flex items-center justify-center gap-2">
                <div class="f01-qr-stamp f01-qr-stamp--blue shrink-0">
                  <svg viewBox="0 0 32 32" class="w-7 h-7">
                    <rect width="32" height="32" fill="#f8fafc" />
                    <rect x="2" y="2" width="8" height="8" fill="#0c2340" />
                    <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                    <rect x="4.5" y="4.5" width="3" height="3" fill="#0c2340" />
                    <rect x="22" y="2" width="8" height="8" fill="#0c2340" />
                    <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                    <rect x="24.5" y="4.5" width="3" height="3" fill="#0c2340" />
                    <rect x="2" y="22" width="8" height="8" fill="#0c2340" />
                    <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                    <rect x="4.5" y="24.5" width="3" height="3" fill="#0c2340" />
                    <rect x="13" y="13" width="6" height="6" fill="#b8923d" />
                    <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                    <rect x="12" y="4" width="2" height="2" fill="#dc2626" />
                    <rect x="25" y="14" width="2" height="2" fill="#0c2340" />
                  </svg>
                </div>
                <div class="text-[7.5px] leading-tight text-left">
                  <div class="font-bold text-[#0c2340]">Laura Valdés</div>
                  <div class="text-[6.5px] text-slate-600">Aseguramiento de Calidad</div>
                  <div class="text-[6px] text-slate-500 font-mono mt-0.5">Sello: #{{ deviation.folio }}-QM</div>
                </div>
              </div>
            </td>

            <!-- Responsable de Operaciones -->
            <td class="p-1.5 align-middle">
              <div class="flex items-center justify-center gap-2">
                <div class="f01-qr-stamp f01-qr-stamp--gold shrink-0">
                  <svg viewBox="0 0 32 32" class="w-7 h-7">
                    <rect width="32" height="32" fill="#f8fafc" />
                    <rect x="2" y="2" width="8" height="8" fill="#b8923d" />
                    <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                    <rect x="4.5" y="4.5" width="3" height="3" fill="#b8923d" />
                    <rect x="22" y="2" width="8" height="8" fill="#b8923d" />
                    <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                    <rect x="24.5" y="4.5" width="3" height="3" fill="#b8923d" />
                    <rect x="2" y="22" width="8" height="8" fill="#b8923d" />
                    <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                    <rect x="4.5" y="24.5" width="3" height="3" fill="#b8923d" />
                    <rect x="13" y="13" width="6" height="6" fill="#0c2340" />
                    <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                    <rect x="12" y="4" width="2" height="2" fill="#059669" />
                    <rect x="25" y="14" width="2" height="2" fill="#b8923d" />
                  </svg>
                </div>
                <div class="text-[7.5px] leading-tight text-left">
                  <div class="font-bold text-[#0c2340]">{{ deviation.responsibleCollaborator || 'Operaciones Almacén' }}</div>
                  <div class="text-[6.5px] text-slate-600">Líder de Turno / Almacén</div>
                  <div class="text-[6px] text-slate-500 font-mono mt-0.5">Validación: OP-{{ deviation.folio.slice(-4) }}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ── 8. PIE DE PÁGINA ── -->
      <div class="flex justify-between items-center text-[6.5px] text-slate-500 pt-1 border-t border-slate-300 font-mono">
        <span>Sistema de Gestión de Calidad 4GUARD WMS · Control de Merma y Desviaciones</span>
        <span>Página 1 de 1</span>
      </div>

    </div>
  `,
  styles: [`
    .dev-pdf-sheet {
      width: 100%;
      max-width: 680px;
      padding: 10px 14px;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      box-sizing: border-box;
      line-height: 1.15;
    }

    .dev-table {
      border-collapse: collapse;
      border: 1px solid #000000;
    }

    .dev-table th,
    .dev-table td {
      border: 1px solid #000000;
    }

    .section-badge-header {
      background-color: #0c2340;
      padding: 2px 6px;
      border-radius: 2px;
    }

    .f01-qr-stamp {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      padding: 1px;
      background: #f8fafc;
    }

    .f01-qr-stamp--blue { border-color: #93c5fd; background: #eff6ff; }
    .f01-qr-stamp--gold { border-color: #fde68a; background: #fffbeb; }

    @media print {
      .dev-pdf-sheet {
        padding: 0;
        max-width: 100%;
      }
    }
  `]
})
export class PrintDeviationLayoutComponent {
  @Input() deviation!: QualityDeviation;

  materialLabels = QUALITY_MATERIAL_TYPE_LABELS;
  conditionLabels = QUALITY_CONDITION_LABELS;
  rootCauseLabels = QUALITY_ROOT_CAUSE_LABELS;
  actionLabels = QUALITY_ACTION_LABELS;

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  }
}
