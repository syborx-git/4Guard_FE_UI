/**
 * @file print-verification-layout.component.ts
 * @description Formato Oficial de Impresión "VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03 Rev. 03)"
 * adaptado 100% al estándar SDD-PRINT-001 y ADR-012 con logo institucional 4GUARD WMS, responsables y firmas manuales.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadVerification } from '../../models/quality.models';

@Component({
  selector: 'fg-print-verification-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="verification" id="official-f01-print-sheet" class="print-container bg-white text-black p-4 sm:p-5 max-w-full mx-auto font-sans border border-slate-300 rounded-lg shadow-sm">
      
      <!-- Top Header & Logo Institucional Oficial -->
      <div class="flex justify-between items-start mb-2 pb-1.5 border-b border-black">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[42px] sm:max-w-[48px] object-contain rounded" />
          <div>
            <h1 class="text-sm sm:text-base font-extrabold tracking-tight text-black">4-GUARD WMS</h1>
            <p class="text-[8px] sm:text-[9px] text-slate-600 font-semibold uppercase leading-tight">Industria Automotriz 128, Delegación Santa María Totoltepec, 50200 Toluca de Lerdo, Méx</p>
          </div>
        </div>

        <div class="text-right">
          <p class="text-[9px] sm:text-[10px] font-mono font-bold text-slate-800">FECHA DE IMPRESIÓN: {{ printDate }}</p>
          <p class="text-[8px] sm:text-[9px] text-slate-500 font-mono">FOLIO: #{{ verification.folio }}</p>
        </div>
      </div>

      <!-- Main Title & Document Info Box -->
      <table class="w-full border-collapse border border-black mb-2 text-center text-[10px] sm:text-[11px] font-mono">
        <tr>
          <td class="w-[15%] p-1 border-r border-black font-bold bg-slate-50 text-xs">
            4GUARD
          </td>
          <td class="w-[55%] p-1 border-r border-black">
            <div class="text-[8px] uppercase tracking-wider text-slate-600 font-bold">FORMATO INSTITUCIONAL</div>
            <div class="text-xs sm:text-sm font-black uppercase tracking-wide text-black">VERIFICACIÓN DE CARGA</div>
            <div class="text-[8px] text-slate-600">Proceso: Liberación de carga · Dueño: Seguridad e Inocuidad / Calidad</div>
          </td>
          <td class="w-[30%] p-1 text-left text-[8px] sm:text-[9px] bg-slate-50 space-y-0.5">
            <div><strong>No. de Control:</strong> {{ verification.controlNumber || 'F01-PO-GC-8.6-03' }}</div>
            <div><strong>No. de Revisión:</strong> {{ verification.revisionNumber || '03' }}</div>
            <div><strong>Fecha Revisión:</strong> {{ verification.revisionDate || '27/03/2026' }}</div>
            <div><strong>Emisión:</strong> 29/01/2025</div>
          </td>
        </tr>
      </table>

      <!-- Header Metadata Table -->
      <table class="w-full border-collapse border border-black mb-2 text-[9px] sm:text-[10px] font-mono">
        <tr class="border-b border-black bg-slate-50">
          <td class="p-1 border-r border-black w-[40%]">
            <strong>CLIENTE:</strong> <span class="font-bold text-black">{{ verification.clientName }}</span>
          </td>
          <td class="p-1 border-r border-black w-[30%]">
            <strong>NO. DE REMISIÓN:</strong> <span class="font-bold text-black">{{ verification.remisionNumber }}</span>
          </td>
          <td class="p-1 w-[30%]">
            <strong>ESTATUS:</strong> <span class="font-bold uppercase text-emerald-800">{{ verification.status }}</span>
          </td>
        </tr>
        <tr class="border-b border-black">
          <td colspan="2" class="p-1 border-r border-black">
            <strong>DESCRIPCIÓN DEL PRODUCTO:</strong> {{ verification.productDescription }}
          </td>
          <td class="p-1">
            <strong>RAMPA:</strong> {{ verification.ramp }}
          </td>
        </tr>
        <tr>
          <td class="p-1 border-r border-black">
            <strong>FECHA Y HORA:</strong> {{ verification.date }} · {{ verification.time }}
          </td>
          <td class="p-1 border-r border-black">
            <strong>ELABORÓ:</strong> {{ verification.elaboratedBy.name || '–' }}
          </td>
          <td class="p-1">
            <strong>REVISÓ:</strong> {{ verification.reviewedBy.name || '–' }}
          </td>
        </tr>
      </table>

      <!-- Subtítulo de Criterios de Producto -->
      <div class="bg-slate-800 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider mb-1 flex justify-between items-center">
        <span>1. CONDICIONES GENERALES VISUALES — CRITERIOS DE PRODUCTO</span>
        <span class="text-[8px] font-normal opacity-80">Marcar con ✓ según corresponda</span>
      </div>

      <!-- Tabla 1: Criterios de Producto -->
      <table class="w-full border-collapse border border-black mb-2 text-[8px] sm:text-[9px] font-mono text-left">
        <thead>
          <tr class="bg-slate-100 border-b border-black font-bold uppercase">
            <th class="p-1 border-r border-black w-[38%]">Criterio de Producto</th>
            <th class="p-1 border-r border-black text-center w-[6%]">SI</th>
            <th class="p-1 border-r border-black text-center w-[6%]">NO</th>
            <th class="p-1 border-r border-black text-center w-[6%]">N/A</th>
            <th class="p-1 border-r border-black w-[22%]">Acción Normativa</th>
            <th class="p-1 border-r border-black w-[11%]">Resp.</th>
            <th class="p-1 w-[11%]">Obs.</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let crit of verification.productCriteria" class="border-b border-slate-300">
            <td class="p-0.5 px-1 border-r border-black font-medium">
              {{ crit.label }}
              <span *ngIf="crit.instructionCode" class="font-bold text-[7px] text-slate-500">({{ crit.instructionCode }})</span>
            </td>
            <td class="p-0.5 border-r border-black text-center font-bold text-emerald-800">{{ crit.value === 'SI' ? '✓' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-rose-800">{{ crit.value === 'NO' ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center text-slate-400">{{ crit.value === 'NA' ? '–' : '' }}</td>
            <td class="p-0.5 px-1 border-r border-black text-[7.5px] leading-tight text-slate-700">{{ crit.actionIfNo }}</td>
            <td class="p-0.5 px-1 border-r border-black text-[7.5px] truncate">{{ crit.responsible }}</td>
            <td class="p-0.5 px-1 text-[7.5px] italic text-slate-600">{{ crit.observations || '–' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Subtítulo de Criterios de Transporte -->
      <div class="bg-slate-800 text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider mb-1 flex justify-between items-center">
        <span>2. CRITERIOS DE TRANSPORTE (UNIDAD / CAJA / TRACTO)</span>
        <span class="text-[8px] font-normal opacity-80">Inspección de caja seca, lona, olores y plagas</span>
      </div>

      <!-- Tabla 2: Criterios de Transporte -->
      <table class="w-full border-collapse border border-black mb-2 text-[8px] sm:text-[9px] font-mono text-left">
        <thead>
          <tr class="bg-slate-100 border-b border-black font-bold uppercase">
            <th class="p-1 border-r border-black w-[38%]">Criterio de Transporte</th>
            <th class="p-1 border-r border-black text-center w-[6%]">SI</th>
            <th class="p-1 border-r border-black text-center w-[6%]">NO</th>
            <th class="p-1 border-r border-black text-center w-[6%]">N/A</th>
            <th class="p-1 border-r border-black w-[22%]">Acción Normativa</th>
            <th class="p-1 border-r border-black w-[11%]">Resp.</th>
            <th class="p-1 w-[11%]">Obs.</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let crit of verification.transportCriteria" class="border-b border-slate-300">
            <td class="p-0.5 px-1 border-r border-black font-medium">{{ crit.label }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-emerald-800">{{ crit.value === 'SI' ? '✓' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-rose-800">{{ crit.value === 'NO' ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center text-slate-400">{{ crit.value === 'NA' ? '–' : '' }}</td>
            <td class="p-0.5 px-1 border-r border-black text-[7.5px] leading-tight text-slate-700">{{ crit.actionIfNo }}</td>
            <td class="p-0.5 px-1 border-r border-black text-[7.5px] truncate">{{ crit.responsible }}</td>
            <td class="p-0.5 px-1 text-[7.5px] italic text-slate-600">{{ crit.observations || '–' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Observaciones Generales en Documento -->
      <div *ngIf="verification.generalObservations" class="border border-black p-1.5 bg-slate-50 text-[8px] sm:text-[8.5px] font-mono mb-2">
        <strong>OBSERVACIONES / DICTAMEN DE CALIDAD:</strong> {{ verification.generalObservations }}
      </div>

      <!-- Sección de Firmas Manuales Físicas -->
      <div class="border border-black p-2 bg-slate-50 text-[8.5px] sm:text-[9.5px] font-mono space-y-2">
        
        <!-- Fila 1: Limpieza IT01 -->
        <div class="grid grid-cols-12 gap-2 items-end border-b border-slate-300 pb-2">
          <div class="col-span-5">
            <strong>Nombre y firma de quien realizó la limpieza (IT01-PO-GC-8.6-01):</strong>
          </div>
          <div class="col-span-7 border-b border-black text-left pl-2 font-bold font-mono text-[9px]">
            {{ verification.cleaningResponsible.name || '' }}
          </div>
        </div>

        <!-- Fila 2: 3 Firmas de Responsabilidad FÍSICA / MANUAL -->
        <div class="grid grid-cols-3 gap-6 items-end pt-3">
          <div class="text-center">
            <div class="border-b border-black pb-1 mb-1 font-bold font-mono text-[9px]">
              {{ verification.elaboratedBy.name || '' }}
            </div>
            <span class="text-[8px] uppercase font-bold text-slate-800 block">ELABORÓ (MONTACARGUISTA)</span>
            <span class="text-[7.5px] text-slate-500 font-sans block">{{ verification.elaboratedBy.position || 'Operador de Andén' }}</span>
          </div>

          <div class="text-center">
            <div class="border-b border-black pb-1 mb-1 font-bold font-mono text-[9px]">
              {{ verification.reviewedBy.name || '' }}
            </div>
            <span class="text-[8px] uppercase font-bold text-slate-800 block">REVISÓ (AUDITOR QM)</span>
            <span class="text-[7.5px] text-slate-500 font-sans block">{{ verification.reviewedBy.position || 'Auditor de Calidad' }}</span>
          </div>

          <div class="text-center">
            <div class="border-b border-black pb-1 mb-1 font-bold font-mono text-[9px]">
              {{ verification.approvedBy.name || '' }}
            </div>
            <span class="text-[8px] uppercase font-bold text-slate-800 block">APROBÓ (SUPERINTENDENCIA)</span>
            <span class="text-[7.5px] text-slate-500 font-sans block">{{ verification.approvedBy.position || 'Superintendente QM' }}</span>
          </div>
        </div>

      </div>

      <!-- Pie de Página Institucional -->
      <div class="flex justify-between items-center text-[7.5px] text-slate-500 font-mono mt-2 pt-1 border-t border-slate-300">
        <span>Documento oficial de control de calidad auditado — 4GUARD WMS</span>
        <span>Página 1 de 1</span>
      </div>

    </div>
  `
})
export class PrintVerificationLayoutComponent {
  @Input() verification!: LoadVerification;

  get printDate(): string {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
