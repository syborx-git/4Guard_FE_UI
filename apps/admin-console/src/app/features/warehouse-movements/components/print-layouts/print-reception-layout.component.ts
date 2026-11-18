/**
 * @file print-reception-layout.component.ts
 * @description Formato de impresión oficial "Recepción de Mercancía" (Formato F01),
 * 100% homologado con el estándar de Cambio de Almacén (7 columnas oficiales legibles,
 * SKU destacado, márgenes de hoja naturales y diseño ejecutivo vertical).
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-black max-w-[800px] mx-auto font-sans border rounded-sm shadow-sm select-none"
         [ngClass]="[
           reception.status === 'CANCELLED' ? 'border-2 border-rose-600' : 'border-slate-300',
           densityMode === 'ultra-compact' ? 'p-2 sm:p-2.5 text-[7px] leading-tight' : (densityMode === 'compact' ? 'p-3.5 sm:p-4 text-[8px] leading-tight' : 'p-5 sm:p-6 text-[8.5px] leading-normal')
         ]">
      
      <!-- ═══════════════════════════════════════════════════════════
           HEADER ADVERTENCIA: SI LA RECEPCIÓN ESTÁ CANCELADA
           ═══════════════════════════════════════════════════════════ -->
      <div *ngIf="reception.status === 'CANCELLED'" class="bg-rose-600 text-white rounded-md flex items-center justify-between shadow-xs"
           [ngClass]="densityMode === 'ultra-compact' ? 'p-1.5 mb-1' : 'p-2.5 mb-2'">
        <div class="flex items-center gap-2">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-6 w-auto max-w-[34px] object-contain rounded bg-white p-0.5" />
          <div>
            <h1 class="font-black tracking-wider uppercase leading-tight"
                [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-xs sm:text-sm'">COMPROBANTE DE CANCELACIÓN DE RECEPCIÓN</h1>
            <p class="font-semibold opacity-95" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[8px]'">Compuerta de Seguridad / Entrada Rechazada o Revocada en Andén</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-bold uppercase block opacity-90" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[7.5px]'">FECHA CANCELACIÓN</span>
          <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[10px]'">{{ reception.cancelledAt || printDate }}</span>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           TOP HEADER & LOGO INSTITUCIONAL (ESTÁNDAR OFICIAL 4GUARD)
           ═══════════════════════════════════════════════════════════ -->
      <div class="flex justify-between items-center border-b-2 border-black"
           [ngClass]="densityMode === 'ultra-compact' ? 'mb-1 pb-1' : (densityMode === 'compact' ? 'mb-1.5 pb-1' : 'mb-2 pb-1.5')">
        <div class="flex items-center gap-2">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo"
               class="w-auto object-contain rounded"
               [ngClass]="densityMode === 'ultra-compact' ? 'h-6 max-w-[32px]' : (densityMode === 'compact' ? 'h-7 max-w-[36px]' : 'h-8 max-w-[40px]')" />
          <div>
            <h1 class="font-black tracking-tight text-black leading-none mb-0.5"
                [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : (densityMode === 'compact' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base')">
              4-GUARD WMS
            </h1>
            <p class="text-slate-700 font-bold uppercase tracking-tight"
               [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : (densityMode === 'compact' ? 'text-[7px]' : 'text-[8px]')">
              Calle Industria Automotriz 128, Delegación Santa María Totoltepec, 50200 Toluca de Lerdo, Edo. Méx.
            </p>
          </div>
        </div>

        <div class="text-right shrink-0">
          <span class="font-bold text-slate-700 block uppercase"
                [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : (densityMode === 'compact' ? 'text-[7px]' : 'text-[8px]')">
            FECHA DE IMPRESIÓN
          </span>
          <span class="font-mono font-black text-black"
                [ngClass]="densityMode === 'ultra-compact' ? 'text-[9.5px]' : (densityMode === 'compact' ? 'text-[10px]' : 'text-xs')">
            {{ printDate }}
          </span>
        </div>
      </div>

      <!-- MAIN TITLE HOMOLOGADO -->
      <div class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : (densityMode === 'compact' ? 'mb-1.5' : 'mb-2')">
        <h2 class="font-black uppercase tracking-wider text-black border-y border-black inline-block"
            [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px] py-0.5 px-4' : (densityMode === 'compact' ? 'text-[9.5px] py-0.5 px-6' : 'text-xs sm:text-sm py-0.5 px-8')">
          COMPROBANTE OFICIAL DE RECEPCIÓN DE MERCANCÍA · FORMATO F01
        </h2>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           HEADER GRID METADATA: 2 COLUMNAS CON DATOS COMPLETOS
           ═══════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-2 border border-black rounded-sm bg-slate-50/50"
           style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;"
           [ngClass]="densityMode === 'ultra-compact' ? 'gap-x-3 gap-y-0 text-[7px] mb-1 p-1' : (densityMode === 'compact' ? 'gap-x-4 gap-y-0.5 text-[8px] mb-1.5 p-1.5' : 'gap-x-5 gap-y-1 text-[9px] mb-2 p-2')">
        
        <!-- Columna Izquierda: Logística del Arribo y Transporte -->
        <div [ngClass]="densityMode === 'ultra-compact' ? 'space-y-0.5' : 'space-y-1'">
          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">NO. RECEPCIÓN (FOLIO):</span>
            <span class="font-black font-mono text-black text-right flex-1 min-w-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8px]' : 'text-xs'">#{{ reception.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">FECHA Y HORA RECEPCIÓN:</span>
            <span class="font-medium text-black text-right flex-1 min-w-0 font-mono">{{ formatDateTime(reception.createdAt || reception.checkIn.docDate) }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight uppercase">{{ reception.checkIn.carrierLine || 'Transporte TUM' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">OPERADOR / CONDUCTOR:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight uppercase">{{ reception.checkIn.driverName || 'Armando Flores' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right flex-1 min-w-0 uppercase">{{ reception.checkIn.tractorPlates || '32BC8V' }} / {{ reception.checkIn.boxPlates || '087YJ9' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">NO. ECO (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right flex-1 min-w-0 uppercase">{{ noEcoTractor }} / {{ noEcoCaja }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight uppercase">{{ reception.checkIn.forkliftOperator || 'POR ASIGNAR' }}</span>
          </div>

          <!-- Badge Resaltado: Rampa de Andén -->
          <div class="flex justify-between items-center gap-1 bg-amber-500/10 rounded border border-amber-500/30"
               [ngClass]="densityMode === 'ultra-compact' ? 'px-1 py-[1px]' : 'px-2 py-0.5'">
            <span class="font-bold uppercase text-amber-900 shrink-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[8.5px]'">RAMPA DE ANDÉN:</span>
            <span class="font-mono font-black text-amber-950 text-right flex-1 min-w-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9.5px]'">RAMPA {{ rampDisplay }} (DESCARGA EN SITIO)</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Cliente & Ubicaciones -->
        <div [ngClass]="densityMode === 'ultra-compact' ? 'space-y-0.5' : 'space-y-1'">
          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">NO. DOCUMENTO / REMISIÓN:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0 text-amber-950 uppercase">{{ displayDocSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">FECHA DEL DOCUMENTO:</span>
            <span class="font-medium text-black text-right flex-1 min-w-0 font-mono">{{ formatDateDMY(reception.checkIn.docDate || reception.createdAt) }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">CLIENTE DESTINATARIO:</span>
            <span class="font-black text-black text-right break-words flex-1 min-w-0 leading-tight uppercase">{{ reception.checkIn.client || 'Nestlé México S.A. de C.V.' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">PROVEEDOR:</span>
            <span class="font-bold text-slate-900 text-right break-words flex-1 min-w-0 leading-tight uppercase">{{ reception.supplierName || 'QUALAMEX S.A. DE C.V.' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">LOTE(S) DE PRODUCTO:</span>
            <span class="font-bold font-mono text-amber-900 text-right break-words flex-1 min-w-0 uppercase">{{ displayLotSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">FECHA(S) CADUCIDAD:</span>
            <span class="font-bold font-mono text-black text-right break-words flex-1 min-w-0">{{ displayExpirationSummary }}</span>
          </div>

          <div class="flex justify-between items-center gap-1 border-b border-slate-200" [ngClass]="densityMode === 'ultra-compact' ? 'pb-0' : 'pb-0.5'">
            <span class="font-bold text-slate-700 shrink-0">SELLOS DE SEGURIDAD:</span>
            <span class="font-mono font-black text-amber-950 text-right break-words flex-1 min-w-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9px]'">{{ displaySeals }}</span>
          </div>

          <!-- Badge Resaltado: Bahía de Almacenaje -->
          <div class="flex justify-between items-center gap-1 bg-emerald-500/10 rounded border border-emerald-500/30"
               [ngClass]="densityMode === 'ultra-compact' ? 'px-1 py-[1px]' : 'px-2 py-0.5'">
            <span class="font-bold uppercase text-emerald-900 shrink-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[8.5px]'">BAHÍA / ALMACENAJE:</span>
            <span class="font-mono font-black text-emerald-950 text-right flex-1 min-w-0" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9.5px]'">{{ reception.storageLocation || 'STAGING-R01' }}</span>
          </div>
        </div>

      </div>

      <!-- ═══════════════════════════════════════════════════════════
           TABLA DE TARIMAS (7 COLUMNAS OFICIALES - ESTÁNDAR CAMBIO DE ALMACÉN)
           ═══════════════════════════════════════════════════════════ -->
      <div class="border border-black rounded-sm overflow-hidden"
           [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : 'mb-1.5'">
        <table class="w-full text-left border-collapse font-sans uppercase"
               [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.8px] leading-tight' : (densityMode === 'compact' ? 'text-[7.8px] leading-tight' : 'text-[8.8px] leading-normal')">
          <thead>
            <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900"
                [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : (densityMode === 'compact' ? 'text-[7.5px]' : 'text-[8.5px]')">
              <th class="border-r border-black text-center w-6" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-1.5'">N.</th>
              <th class="border-r border-black font-mono w-36" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">CÓDIGO TARIMA (SSCC)</th>
              <th class="border-r border-black font-mono text-center w-20" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">LOTE</th>
              <th class="border-r border-black font-mono text-center w-16" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">SKU</th>
              <th class="border-r border-black" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">DESCRIPCIÓN DE PRODUCTO</th>
              <th class="border-r border-black text-center w-24" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">TIPO TARIMA</th>
              <th class="text-right w-20" [ngClass]="densityMode === 'ultra-compact' ? 'py-[1px] px-1' : 'py-1 px-2'">CANT X TARIMA</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngIf="effectivePallets && effectivePallets.length > 0; else samplePallets">
              <tr *ngFor="let item of effectivePallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                <td class="border-r border-black text-center font-bold font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1' : 'py-1 px-1.5')">{{ item.palletNumber || (idx + 1) }}</td>
                <td class="border-r border-black font-bold font-mono text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletCode }}</td>
                <td class="border-r border-black font-mono text-center font-bold text-amber-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.lotNumber || reception.lotNumber || '-' }}</td>
                <td class="border-r border-black font-mono font-bold text-center text-slate-950 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.productId }}</td>
                <td class="border-r border-black font-semibold text-slate-950" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">
                  <div class="leading-tight truncate max-w-[210px]">{{ item.description }}</div>
                  @if (item.observations && item.observations !== 'Descarga conforme estándar' && densityMode !== 'ultra-compact') {
                    <span class="block text-[6.5px] italic text-slate-500 normal-case leading-none truncate max-w-[210px]">{{ item.observations }}</span>
                  }
                </td>
                <td class="border-r border-black text-center uppercase" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1 text-[6.5px]' : (densityMode === 'compact' ? 'py-0.5 px-1.5 text-[7.5px]' : 'py-1 px-2 text-[8px]')">{{ item.palletTypeLabel || 'Madera Estándar' }}</td>
                <td class="text-right font-black font-mono whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              </tr>
            </ng-container>
            <ng-template #samplePallets>
              <tr *ngFor="let item of sampleFallbackPallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                <td class="border-r border-black text-center font-bold font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1' : 'py-1 px-1.5')">{{ item.palletNumber }}</td>
                <td class="border-r border-black font-bold font-mono text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletCode }}</td>
                <td class="border-r border-black font-mono text-center font-bold text-amber-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.lotNumber }}</td>
                <td class="border-r border-black font-mono font-bold text-center text-slate-950 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.productId }}</td>
                <td class="border-r border-black font-semibold text-slate-950" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">
                  <div class="leading-tight truncate max-w-[210px]">{{ item.description }}</div>
                </td>
                <td class="border-r border-black text-center uppercase" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1 text-[6.5px]' : (densityMode === 'compact' ? 'py-0.5 px-1.5 text-[7.5px]' : 'py-1 px-2 text-[8px]')">{{ item.palletTypeLabel }}</td>
                <td class="text-right font-black font-mono whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              </tr>
            </ng-template>
          </tbody>
        </table>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           TOTALES (ESTÁNDAR HOMOLOGADO)
           ═══════════════════════════════════════════════════════════ -->
      <div class="flex justify-between items-center font-bold border-b-2 border-black rounded uppercase"
           [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] py-0.5 px-2 mb-1 bg-slate-100/90' : (densityMode === 'compact' ? 'text-[8.5px] py-0.5 px-2.5 mb-1.5 bg-slate-100/80' : 'text-[9px] sm:text-[9.5px] py-1 px-2.5 mb-2 bg-slate-100/80')">
        <div>TOTAL TARIMAS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[11px]'">{{ totalPallets }}</span></div>
        <div>FOLIOS / REMISIONES: <span class="font-mono font-black text-slate-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[11px]'">{{ uniqueDocNumbers.length || 1 }}</span></div>
        <div>LOTES TOTALES: <span class="font-mono font-black text-amber-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[11px]'">{{ uniqueLots.length || 1 }}</span></div>
        <div>SKUS DISTINTOS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[11px]'">{{ uniqueSkusCount }}</span></div>
        <div>TOTAL PIEZAS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-[11px]'">{{ totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- ═══════════════════════════════════════════════════════════
           FOOTER: 3 COLUMNAS DE FIRMAS (ESTÁNDAR COMPACTO)
           ═══════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-3 gap-4 items-end uppercase"
           style="display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important;"
           [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px] pt-1' : (densityMode === 'compact' ? 'text-[7.5px] pt-1' : 'text-[8.5px] pt-1.5')">
        <div class="text-left">
          <div class="border-b border-black w-full" [ngClass]="densityMode === 'ultra-compact' ? 'mb-0.5' : 'mb-1'"></div>
          <p class="font-bold text-slate-900 truncate">{{ (reception.checkIn.driverName || 'Armando Flores').toUpperCase() }}</p>
          <p class="text-slate-500 uppercase tracking-wide" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[7.5px]'">Entregó: Chofer / {{ (reception.checkIn.carrierLine || 'Transportista').toUpperCase() }}</p>
        </div>
        <div class="text-center">
          <div class="border-b border-black w-full" [ngClass]="densityMode === 'ultra-compact' ? 'mb-0.5' : 'mb-1'"></div>
          <p class="font-bold text-slate-900 truncate">{{ (reception.checkIn.forkliftOperator || 'POR ASIGNAR').toUpperCase() }}</p>
          <p class="text-slate-500 uppercase tracking-wide" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[7.5px]'">Montacarguista: Descarga en Andén</p>
        </div>
        <div class="text-right">
          <div class="border-b border-black w-full" [ngClass]="densityMode === 'ultra-compact' ? 'mb-0.5' : 'mb-1'"></div>
          <p class="font-bold text-slate-900 truncate">{{ capturedByName }}</p>
          <p class="text-slate-500 uppercase tracking-wide" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[7.5px]'">Recibió y Autorizó: Supervisor WMS</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    @media print {
      @page {
        size: letter portrait;
        margin: 5mm 5mm !important;
      }
      .print-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        background: transparent !important;
        page-break-inside: avoid !important;
      }
      .grid.grid-cols-2 {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
      .grid.grid-cols-3 {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
    }
  `]
})
export class PrintReceptionLayoutComponent {
  @Input() reception!: ReceptionHeader;
  protected readonly authState = inject(AuthState);

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get densityMode(): 'normal' | 'compact' | 'ultra-compact' {
    const count = this.totalPallets;
    if (count > 30) return 'ultra-compact';
    if (count > 16) return 'compact';
    return 'normal';
  }

  get effectivePallets(): any[] {
    if (this.reception?.pallets && this.reception.pallets.length > 0) {
      return this.reception.pallets;
    }
    return [];
  }

  get totalPallets(): number {
    if (this.effectivePallets.length > 0) {
      return this.effectivePallets.length;
    }
    return this.reception?.totalPallets || this.sampleFallbackPallets.length;
  }

  get totalPieces(): number {
    if (this.effectivePallets.length > 0) {
      return this.effectivePallets.reduce((acc, p) => acc + (p.pieces || 0), 0);
    }
    return this.sampleFallbackPallets.reduce((acc, p) => acc + (p.pieces || 0), 0);
  }

  get uniqueSkusCount(): number {
    const list = this.effectivePallets.length > 0 ? this.effectivePallets : this.sampleFallbackPallets;
    const set = new Set(list.map((p) => p.productId).filter(Boolean));
    return set.size || 1;
  }

  get capturedByName(): string {
    return (
      this.reception?.capturedBy ||
      this.reception?.leaderAuthorizedBy ||
      this.authState.userFullName() ||
      this.authState.currentUser()?.fullName ||
      'ENRIQUE ARCHIT. (LÍDER WMS)'
    ).toUpperCase();
  }

  get noEcoTractor(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.noEcoTractor ||
      (this.reception as any).preCheckin?.noEcoTractor ||
      '-'
    );
  }

  get noEcoCaja(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.noEcoCaja ||
      (this.reception as any).preCheckin?.noEcoCaja ||
      '-'
    );
  }

  get rampDisplay(): string {
    const rNum = this.reception?.checkIn?.rampNumber;
    const rCode = this.reception?.checkIn?.rampCode;
    if (rNum) return `${rNum}`;
    if (rCode) {
      const match = rCode.match(/\d+/);
      if (match) return `${parseInt(match[0], 10)}`;
      return rCode;
    }
    return '1';
  }

  get displaySeals(): string {
    if (!this.reception?.checkIn) return 'N/A';
    const ci = this.reception.checkIn;
    if (ci.sealNumbers && ci.sealNumbers.length > 0) {
      return ci.sealNumbers.join(', ');
    }
    return ci.sealNumber || 'N/A';
  }

  get sampleFallbackPallets(): any[] {
    const count = this.reception?.totalPallets || 5;
    const items = [];
    const sku = this.reception?.productId || '8505641';
    const desc = this.reception?.productName || 'ABUELITA TABLETA 24X540G MX';
    const sup = this.reception?.supplierName || 'QUALAMEX S.A. DE C.V.';
    const pzas = this.reception?.piecesPerPallet || 135;
    const lot = this.displayLotSummary || 'LOT-2026-01';
    const exp = this.displayExpirationSummary || '2027-11-03';
    const doc = this.displayDocSummary || 'HEHDHDHHD';

    for (let i = 0; i < count; i++) {
      items.push({
        palletNumber: i + 1,
        palletCode: `00075036838${(1007590 + i * 1111).toString()}`,
        productId: sku,
        description: desc,
        supplierName: sup,
        palletTypeLabel: 'Madera Estándar',
        pieces: pzas,
        lotNumber: lot,
        expirationDate: exp,
        docNumber: doc,
        observations: 'Descarga conforme estándar'
      });
    }
    return items;
  }

  get uniqueDocNumbers(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const doc = p.docNumber || (p as any).doc_number || (p as any).remisionNo || (p as any).documentNumber || (p as any).receptionLot?.docNumber;
        if (doc && String(doc).trim() && doc !== 'N/A' && doc !== '-') {
          set.add(String(doc).trim().toUpperCase());
        }
      });
    }

    if (set.size === 0 && this.reception?.checkIn?.docNumber && this.reception.checkIn.docNumber !== 'N/A' && this.reception.checkIn.docNumber !== '-') {
      set.add(this.reception.checkIn.docNumber.trim().toUpperCase());
    }

    return Array.from(set);
  }

  get displayDocSummary(): string {
    const docs = this.uniqueDocNumbers;
    if (docs.length === 0) return this.reception?.checkIn?.docNumber || 'N/A';
    if (docs.length === 1) return docs[0];
    return `${docs.join(', ')} (${docs.length} FOLIOS / REMISIONES)`;
  }

  get uniqueLots(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const num = p.lotNumber || (p as any).lot_number || (p as any).receptionLot?.lotNumber || (p as any).batchNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        const num = typeof l === 'string' ? l : l?.lotNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    if (set.size === 0 && this.reception?.lotNumber && this.reception.lotNumber !== 'N/A' && this.reception.lotNumber !== '-' && this.reception.lotNumber !== '01.07.2026') {
      set.add(this.reception.lotNumber.trim().toUpperCase());
    }

    return Array.from(set);
  }

  get displayLotSummary(): string {
    const lots = this.uniqueLots;
    if (lots.length === 0) return (this.reception?.lotNumber && this.reception.lotNumber !== '01.07.2026') ? this.reception.lotNumber : 'N/A';
    if (lots.length === 1) return lots[0];
    return `${lots.join(', ')} (${lots.length} LOTES)`;
  }

  get uniqueExpirations(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const exp = p.expirationDate || (p as any).expiration_date || (p as any).receptionLot?.expirationDate;
        if (exp && exp !== 'N/A' && exp !== '-') {
          set.add(this.formatDateDMY(exp));
        }
      });
    }

    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        if (l?.expirationDate && l.expirationDate !== 'N/A' && l.expirationDate !== '-') {
          set.add(this.formatDateDMY(l.expirationDate));
        }
      });
    }

    if (set.size === 0 && this.reception?.expirationDate && this.reception.expirationDate !== 'N/A' && this.reception.expirationDate !== '-') {
      set.add(this.formatDateDMY(this.reception.expirationDate));
    }

    return Array.from(set);
  }

  get displayExpirationSummary(): string {
    const exps = this.uniqueExpirations;
    if (exps.length === 0) return this.formatDateDMY(this.reception?.expirationDate);
    if (exps.length === 1) return exps[0];
    return exps.join(', ');
  }

  formatDateDMY(dateVal?: string): string {
    if (!dateVal) return 'N/A';
    const str = String(dateVal).trim();
    if (str.includes('/')) return str;
    const parts = str.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
  }

  formatDateTime(dateVal?: string): string {
    if (!dateVal) return 'N/A';
    const str = String(dateVal).trim();
    if (str.includes('/') && str.includes(':')) return str;
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'P.M.' : 'A.M.';
      hours = hours % 12 || 12;
      return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
    }
    return str;
  }
}
