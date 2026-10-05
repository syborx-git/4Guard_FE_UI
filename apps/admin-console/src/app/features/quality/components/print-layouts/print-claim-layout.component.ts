/**
 * @file print-claim-layout.component.ts
 * @description Formato Oficial de Impresión "DICTAMEN DE RECLAMO E INCIDENCIA DE CALIDAD (F02-PO-GC-8.6-04)"
 * Homologado bajo ADR-015 y SDD pdf-print-export con encabezado Midnight Navy (#0c2340), acentos Prestige Gold (#c5a86b),
 * trazabilidad de SKU/Lote, impacto financiero de no calidad ($ MXN), sellos QR y firmas normativas.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QualityClaim, CLAIM_STAGE_LABELS, CLAIM_DEFECT_TYPE_LABELS } from '../../models/quality.models';

@Component({
  selector: 'fg-print-claim-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="claim" id="official-claim-print-sheet" class="print-container claim-pdf-sheet bg-white text-black font-sans mx-auto">
      
      <!-- ── 1. ENCABEZADO INSTITUCIONAL CORPORATIVO ── -->
      <div class="flex justify-between items-start mb-2 pb-1.5 border-b-2 border-[#0c2340]">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[42px] sm:max-w-[48px] object-contain rounded" />
          <div>
            <h1 class="text-sm sm:text-base font-extrabold tracking-tight text-[#0c2340] m-0">4-GUARD WMS</h1>
            <p class="text-[8px] sm:text-[8.5px] text-slate-600 font-semibold uppercase leading-tight m-0">
              Almacén Central Toluca · Industria Automotriz 128, Toluca de Lerdo, Méx.
            </p>
          </div>
        </div>
        <div class="text-right">
          <div class="inline-block bg-[#0c2340] text-white px-2 py-0.5 rounded text-[8px] font-mono font-bold tracking-wide mb-0.5">
            NORMA F02-PO-GC-8.6-04
          </div>
          <p class="text-[8.5px] font-mono font-bold text-slate-800 m-0">EMISIÓN: {{ printDate }}</p>
        </div>
      </div>

      <!-- ── 2. TÍTULO CENTRAL DEL DICTAMEN DE RECLAMO ── -->
      <div class="text-center mb-2 bg-slate-100 py-1 border-y border-black">
        <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-[#0c2340] m-0">
          DICTAMEN OFICIAL DE RECLAMO E INCIDENCIA DE CALIDAD
        </h2>
        <span class="text-[7.5px] font-bold text-slate-600 uppercase tracking-wide">
          EXPEDIENTE TÉCNICO DE NO CONFORMIDAD & IMPACTO FINANCIERO
        </span>
      </div>

      <!-- ── 3. CUADRO DE IDENTIFICACIÓN Y METADATOS PRINCIPALES ── -->
      <table class="claim-table w-full mb-2 text-[8px]">
        <tr>
          <td class="p-1 w-[25%] bg-slate-50 font-bold border-r border-black text-[#0c2340]">FOLIO OFICIAL:</td>
          <td class="p-1 w-[25%] border-r border-black font-mono font-bold text-[9px] text-[#b8923d]">{{ claim.folio }}</td>
          <td class="p-1 w-[25%] bg-slate-50 font-bold border-r border-black text-[#0c2340]">FECHA Y HORA:</td>
          <td class="p-1 w-[25%] font-mono font-bold">{{ claim.date }} · {{ claim.time }} hrs</td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black text-[#0c2340]">CLIENTE / PROVEEDOR:</td>
          <td class="p-1 border-r border-black font-bold" colspan="3">{{ claim.clientName }}</td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black text-[#0c2340]">ETAPA DEL PROCESO:</td>
          <td class="p-1 border-r border-black font-bold">{{ getStageLabel(claim.stage) }}</td>
          <td class="p-1 bg-slate-50 font-bold border-r border-black text-[#0c2340]">ESTATUS DEL CASO:</td>
          <td class="p-1 font-bold">
            <span class="px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase" [ngClass]="getStatusClass(claim.status)">
              {{ claim.status }}
            </span>
          </td>
        </tr>
      </table>

      <!-- ── 4. TRAZABILIDAD DE MATERIALES Y DOCUMENTO DE EMBARQUE ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">1. IDENTIFICACIÓN DE MATERIAL Y TRAZABILIDAD</span>
      </div>

      <table class="claim-table w-full mb-2 text-[7.5px]">
        <thead>
          <tr class="bg-slate-100 font-bold uppercase text-[7px] border-b border-black">
            <th class="p-1 border-r border-black text-left w-[20%]">SKU / CÓDIGO</th>
            <th class="p-1 border-r border-black text-left w-[40%]">DESCRIPCIÓN DEL PRODUCTO</th>
            <th class="p-1 border-r border-black text-center w-[20%]">LOTE AFECTADO</th>
            <th class="p-1 text-center w-[20%]">NO. DE REMISIÓN</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="p-1 border-r border-black font-mono font-bold">{{ claim.sku }}</td>
            <td class="p-1 border-r border-black font-medium">{{ claim.productDescription }}</td>
            <td class="p-1 border-r border-black font-mono font-bold text-center text-blue-800">{{ claim.batchNumber }}</td>
            <td class="p-1 font-mono font-bold text-center text-amber-700">{{ claim.remisionNumber }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ── 5. DIAGNÓSTICO DEL DEFECTO & LIQUIDACIÓN DE NO CALIDAD ($ MXN) ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">2. CUANTIFICACIÓN DEL IMPACTO Y COSTO DE NO CALIDAD</span>
      </div>

      <table class="claim-table w-full mb-2 text-[7.5px]">
        <tr>
          <td class="p-1 bg-slate-50 font-bold border-r border-black w-[35%]">TIPIFICACIÓN DEL DEFECTO:</td>
          <td class="p-1 border-r border-black font-bold w-[65%]" colspan="3">
            {{ defectLabels[claim.defectType] || claim.defectType }}
            <span *ngIf="claim.defectCustomType" class="text-slate-600 font-normal">({{ claim.defectCustomType }})</span>
          </td>
        </tr>
        <tr class="border-t border-black">
          <td class="p-1 bg-slate-50 font-bold border-r border-black">PIEZAS FÍSICAS DAÑADAS:</td>
          <td class="p-1 border-r border-black font-mono font-bold text-amber-700 w-[20%]">{{ claim.damagedQty }} Pzas</td>
          <td class="p-1 bg-slate-50 font-bold border-r border-black w-[25%]">PIEZAS EXTRAVIADAS / MERMA:</td>
          <td class="p-1 font-mono font-bold text-red-700 w-[20%]">{{ claim.lostQty }} Pzas</td>
        </tr>
        <tr class="border-t border-black bg-amber-50">
          <td class="p-1 font-bold border-r border-black text-[#0c2340]">COSTO TOTAL DE NO CALIDAD:</td>
          <td class="p-1 font-mono font-black text-[9px] text-emerald-700" colspan="3">
            {{ formatCurrency(claim.associatedCost) }} {{ claim.currency || 'MXN' }}
          </td>
        </tr>
      </table>

      <!-- ── 6. OBSERVACIONES TÉCNICAS Y JUSTIFICACIÓN ── -->
      <div class="section-badge-header mb-1">
        <span class="font-bold text-[8px] uppercase tracking-wide text-white">3. OBSERVACIONES TÉCNICAS & MEDIDAS CORRECTIVAS</span>
      </div>

      <div class="border border-black p-1.5 mb-2 bg-slate-50 text-[7.5px] leading-relaxed">
        <p class="m-0 italic text-slate-800">
          "{{ claim.observations || 'Sin observaciones adicionales asentadas en el sistema.' }}"
        </p>
      </div>

      <!-- ── 7. SECCIÓN DE SELLOS DIGITALES QR Y FIRMAS NORMATIVAS ── -->
      <table class="claim-table w-full mb-1 text-[7.5px]">
        <thead>
          <tr class="bg-[#0c2340] text-white font-bold uppercase text-[7px]">
            <th class="p-1 border-r border-black text-center w-[50%]">AUDITOR DE CALIDAD (QM)</th>
            <th class="p-1 text-center w-[50%]">SUPERINTENDENCIA / AUTORIZÓ</th>
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
                  <div class="font-bold text-[#0c2340]">{{ claim.authorizedByName || 'Laura Valdés' }}</div>
                  <div class="text-[6.5px] text-slate-600">{{ claim.authorizedByPosition || 'Auditora QM' }}</div>
                  <div class="text-[6px] text-slate-500 font-mono mt-0.5">Hash: #{{ claim.folio }}-QM</div>
                </div>
              </div>
            </td>

            <!-- Aprobó Dirección -->
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
                  <div class="font-bold text-[#0c2340]">Ing. Fernando Treviño</div>
                  <div class="text-[6.5px] text-slate-600">Superintendencia de Aseguramiento de Calidad</div>
                  <div class="text-[6px] text-slate-500 font-mono mt-0.5">Sello Digital: AUT-{{ claim.folio.slice(-4) }}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ── 8. PIE DE PÁGINA Y AVISO DE AUDITORÍA ── -->
      <div class="flex justify-between items-center text-[6.5px] text-slate-500 pt-1 border-t border-slate-300 font-mono">
        <span>Sistema de Gestión de Calidad 4GUARD WMS · Documento Electrónico Certificado</span>
        <span>Página 1 de 1</span>
      </div>

    </div>
  `,
  styles: [`
    .claim-pdf-sheet {
      width: 100%;
      max-width: 680px;
      padding: 10px 14px;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      box-sizing: border-box;
      line-height: 1.15;
    }

    .claim-table {
      border-collapse: collapse;
      border: 1px solid #000000;
    }

    .claim-table th,
    .claim-table td {
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
      .claim-pdf-sheet {
        padding: 0;
        max-width: 100%;
      }
    }
  `]
})
export class PrintClaimLayoutComponent {
  @Input() claim!: QualityClaim;

  stageLabels = CLAIM_STAGE_LABELS;
  defectLabels = CLAIM_DEFECT_TYPE_LABELS;

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);
  }

  getStageLabel(stage: any): string {
    if (!stage) return 'N/A';
    const labelObj = this.stageLabels[stage as keyof typeof this.stageLabels];
    return labelObj ? labelObj.label : String(stage);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'APPROVED':
      case 'RESOLVED':
      case 'CLOSED':
      case 'SETTLED':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      case 'OPEN':
      case 'IN_REVIEW':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-300';
    }
  }
}
