/**
 * @file print-transfer-layout.component.ts
 * @description Formato de impresión "Cambio de Almacén" homologado con el diseño oficial de Recepción y Salidas WMS.
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WarehouseTransfer } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-transfer-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="transfer" class="print-container bg-white text-black w-full max-w-full mx-auto font-sans border rounded-sm shadow-sm select-none"
         [ngClass]="[
           densityMode === 'ultra-compact' ? 'p-2 sm:p-2.5 text-[7px] leading-tight' : (densityMode === 'compact' ? 'p-3.5 sm:p-4 text-[8px] leading-tight' : 'p-5 sm:p-6 text-[8.5px] leading-normal'),
           transfer.status === 'CANCELLED' ? 'border-2 border-rose-600' : 'border-slate-300'
         ]">
      
      <!-- ═══════════════════════════════════════════════════════════
           CASO 1: TRASPASO CANCELADO / REVOCADO DE AUDITORÍA
           ═══════════════════════════════════════════════════════════ -->
      <ng-container *ngIf="transfer.status === 'CANCELLED'; else completedLayout">
        
        <!-- Header Advertencia Cancelación -->
        <div class="bg-rose-600 text-white rounded-md flex items-center justify-between shadow-xs"
             [ngClass]="densityMode === 'ultra-compact' ? 'p-1.5 mb-1.5' : (densityMode === 'compact' ? 'p-2 mb-2' : 'p-2.5 sm:p-3 mb-3')">
          <div class="flex items-center gap-2.5">
            <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" width="34" height="34" style="width: 34px !important; height: 34px !important; max-width: 34px !important; max-height: 34px !important; object-fit: contain !important;" class="w-auto object-contain rounded bg-white p-0.5"
                 [ngClass]="densityMode === 'ultra-compact' ? 'h-6 max-w-[30px]' : 'h-8 sm:h-9 max-w-[40px] sm:max-w-[46px]'" />
            <div>
              <h1 class="font-black tracking-wider uppercase leading-tight" [ngClass]="densityMode === 'ultra-compact' ? 'text-[10px]' : 'text-xs sm:text-sm md:text-base'">HOJA DE CANCELACIÓN DE CAMBIO DE ALMACÉN</h1>
              <p class="font-semibold opacity-95" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9px] sm:text-[10px]'">Compuerta de Seguridad / Revocación de Reubicación de Inventario</p>
            </div>
          </div>
          <div class="text-right">
            <span class="font-bold uppercase block opacity-90" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9px]'">FECHA CANCELACIÓN</span>
            <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[9.5px]' : 'text-xs'">{{ transfer.cancelledAt || printDate }}</span>
          </div>
        </div>

        <!-- Grid Metadata de Cancelación (2 Columnas Estructuradas) -->
        <div class="grid grid-cols-2 gap-x-4 bg-rose-50/90 border border-rose-200 rounded-md"
             [ngClass]="densityMode === 'ultra-compact' ? 'gap-y-0.5 text-[7.5px] mb-1.5 p-1.5' : (densityMode === 'compact' ? 'gap-y-1 text-[9px] mb-2 p-2' : 'gap-y-1.5 text-[10px] sm:text-[11px] mb-3 p-2.5')"
             style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
          
          <!-- Columna Izquierda -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FOLIO TRASPASO:</span>
              <span class="font-mono font-bold text-rose-700 text-xs sm:text-sm">#{{ transfer.folio }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FECHA REGISTRO:</span>
              <span class="font-medium text-slate-900">{{ transfer.transferredAt }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA:</span>
              <span class="font-bold text-slate-900">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</span>
            </div>
            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">REGISTRADO POR:</span>
              <span class="font-medium text-slate-900">{{ transfer.transferredBy || capturedByName }}</span>
            </div>
          </div>

          <!-- Columna Derecha -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">AUTORIZADO / CANCELADO POR:</span>
              <span class="font-bold text-rose-900">{{ transfer.cancelledBy || capturedByName }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA ORIGEN (RESTITUIDA):</span>
              <span class="font-mono font-bold text-emerald-800">{{ transfer.originLocation }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA DESTINO (REVOCADA):</span>
              <span class="font-mono font-bold text-rose-700 line-through">{{ transfer.destinationLocation }}</span>
            </div>
            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">ESTADO OPERATIVO:</span>
              <span class="font-bold text-rose-700 uppercase">CANCELADO / REVERTIDO</span>
            </div>
          </div>
        </div>

        <!-- Motivo de Cancelación -->
        <div class="bg-slate-50 border border-slate-200 rounded-md"
             [ngClass]="densityMode === 'ultra-compact' ? 'mb-1 p-1 text-[7.5px]' : (densityMode === 'compact' ? 'mb-2 p-1.5 text-[9px]' : 'mb-3 p-2 text-[10.5px]')">
          <span class="font-bold text-slate-700 block uppercase tracking-wider" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9.5px] mb-0.5'">MOTIVO / JUSTIFICACIÓN DE LA CANCELACIÓN:</span>
          <p class="text-rose-900 font-medium italic border-l-3 border-rose-500 pl-2 bg-white rounded-r" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] py-0' : 'text-[11px] py-0.5'">
            "{{ transfer.cancellationReason || 'Cancelación extraordinaria por corrección operativa o autorización de supervisor.' }}"
          </p>
        </div>

        <!-- Matriz de Ubicaciones -->
        <div class="grid grid-cols-2 gap-2 text-center" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1.5 text-[8px]' : (densityMode === 'compact' ? 'mb-2 text-[10px]' : 'mb-3 text-xs')">
          <div class="bg-emerald-50 rounded border border-emerald-200" [ngClass]="densityMode === 'ultra-compact' ? 'p-1' : 'p-2'">
            <span class="text-emerald-800 uppercase font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9.5px]'">Bahía Origen (Stock Restaurado)</span>
            <span class="font-mono font-black text-emerald-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-xl'">{{ transfer.originLocation }}</span>
            <span class="text-emerald-700 font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[8.5px]'">INVENTARIO REINTEGRADO</span>
          </div>
          <div class="bg-slate-100 rounded border border-slate-300" [ngClass]="densityMode === 'ultra-compact' ? 'p-1' : 'p-2'">
            <span class="text-slate-600 uppercase font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9.5px]'">Bahía Destino (Movimiento Revocado)</span>
            <span class="font-mono font-black text-slate-500 line-through" [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-xl'">{{ transfer.destinationLocation }}</span>
            <span class="text-rose-600 font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[8.5px]'">LIBERADA / SIN CARGO</span>
          </div>
        </div>

        <!-- Tabla de Tarimas Revertidas -->
        <div class="border border-black rounded-sm overflow-hidden" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : 'mb-2.5'">
          <table class="w-full text-left border-collapse font-sans"
                 [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.8px] leading-tight' : (densityMode === 'compact' ? 'text-[8px]' : 'text-[9.5px] sm:text-[10px]')">
            <thead>
              <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
                <th class="border-r border-black text-center w-8" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">N. TARIMA</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">CÓDIGO TARIMA</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">LOTE</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">SKU</th>
                <th class="border-r border-black" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">DESCRIPCIÓN DE PRODUCTO</th>
                <th class="border-r border-black text-right" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">PIEZAS</th>
                <th class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">ESTATUS FÍSICO</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="transfer.pallets && transfer.pallets.length > 0; else defaultCancelledRows">
                <tr *ngFor="let item of transfer.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="border-r border-black text-center font-bold font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletNumber || (idx + 1) }}</td>
                  <td class="border-r border-black font-bold font-mono text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletCode }}</td>
                  <td class="border-r border-black font-mono font-bold text-amber-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.lotNumber || 'N/D' }}</td>
                  <td class="border-r border-black font-mono font-bold whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.productId || 'S/N' }}</td>
                  <td class="border-r border-black font-semibold" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.description || 'Mercancía en Traspaso' }}</td>
                  <td class="border-r border-black text-right font-black font-mono whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.pieces | number:'1.0-2' }} {{ item.unit || 'PZAS' }}</td>
                  <td class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">
                    <span class="inline-block bg-emerald-100 text-emerald-800 rounded font-bold" [ngClass]="densityMode === 'ultra-compact' ? 'px-1 py-0 text-[6px]' : 'px-1.5 py-0.5 text-[9px]'">REVERTIDO</span>
                  </td>
                </tr>
              </ng-container>
              <ng-template #defaultCancelledRows>
                <tr>
                  <td colspan="7" class="text-center italic py-2 text-slate-500 font-semibold" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-xs'">
                    Sin tarimas individuales especificadas en este folio cancelado.
                  </td>
                </tr>
              </ng-template>
            </tbody>
          </table>
        </div>

        <!-- Totales Restaurados -->
        <div class="flex justify-between items-center font-bold border-b-2 border-rose-600 bg-rose-50/70 rounded"
             [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] px-2 py-0.5 mb-1' : (densityMode === 'compact' ? 'text-[9px] px-2.5 py-0.5 mb-2' : 'text-[10px] sm:text-[11px] px-3 py-1 mb-3')">
          <div>TOTAL TARIMAS RESTAURADAS: <span class="font-mono font-black text-rose-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-xs'">{{ transfer.totalPallets || 5 }}</span></div>
          <div>TOTAL PIEZAS / KGS RESTITUIDAS: <span class="font-mono font-black text-rose-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-xs'">{{ (transfer.totalPieces || 225) | number:'1.0-2' }}</span></div>
        </div>

        <!-- Footer Firmas Cancelación -->
        <div class="grid grid-cols-3 gap-4 items-end" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px] pt-1' : (densityMode === 'compact' ? 'text-[8px] pt-1' : 'text-[9.5px] sm:text-[10px] pt-1.5')">
          <div class="text-left">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Montacarguista Notificado</p>
          </div>
          <div class="text-center">
            <div class="border-b border-rose-600 w-full mb-1"></div>
            <p class="font-bold text-rose-900">{{ transfer.cancelledBy || capturedByName }}</p>
            <p class="text-[8px] text-rose-600 font-bold uppercase tracking-wide">Autorizó Cancelación</p>
          </div>
          <div class="text-right">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">Auditoría / Control WMS</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Seguridad y Validación</p>
          </div>
        </div>

      </ng-container>

      <!-- ═══════════════════════════════════════════════════════════
           CASO 2: TRASPASO COMPLETADO (ESTÁNDAR HOMOLOGADO)
           ═══════════════════════════════════════════════════════════ -->
      <ng-template #completedLayout>
        
        <!-- Top Header & Logo Institucional -->
        <div class="flex justify-between items-center border-b-2 border-black"
             [ngClass]="densityMode === 'ultra-compact' ? 'mb-1 pb-1' : (densityMode === 'compact' ? 'mb-1.5 pb-1' : 'mb-2 pb-1.5')">
          <div class="flex items-center gap-2.5">
            <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" width="34" height="34" style="width: 34px !important; height: 34px !important; max-width: 34px !important; max-height: 34px !important; object-fit: contain !important;" class="w-auto object-contain rounded"
                 [ngClass]="densityMode === 'ultra-compact' ? 'h-6 max-w-[30px]' : 'h-8 max-w-[40px]'" />
            <div>
              <h1 class="font-black tracking-tight text-black leading-none mb-0.5" [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-sm sm:text-base'">4-GUARD WMS</h1>
              <p class="text-slate-700 font-bold uppercase tracking-tight" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[8.5px]'">
                Calle. Industria Automotriz sin número, Colonia el Coecillo, municipio de Toluca, Estado de México, C.P 50246.
              </p>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="font-bold text-slate-700 block uppercase" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9px]'">FECHA DE IMPRESIÓN</span>
            <span class="font-mono font-black text-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[9.5px]' : 'text-xs'">{{ printDate }}</span>
          </div>
        </div>

        <!-- Main Title -->
        <div class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : (densityMode === 'compact' ? 'mb-2' : 'mb-3')">
          <h2 class="font-black uppercase tracking-wider text-black border-y border-black inline-block"
              [ngClass]="densityMode === 'ultra-compact' ? 'text-[10px] py-0.5 px-4' : 'text-sm sm:text-base py-1 px-8'">
            COMPROBANTE OFICIAL DE CAMBIO DE ALMACÉN
          </h2>
        </div>

        <!-- Header Grid Metadata: 2 Columnas Estructuradas Homologadas -->
        <div class="grid grid-cols-2 gap-x-4 border border-black rounded-sm bg-slate-50/50"
             [ngClass]="densityMode === 'ultra-compact' ? 'gap-y-0.5 text-[7.5px] mb-1 p-1.5' : (densityMode === 'compact' ? 'gap-y-1 text-[9px] mb-2 p-2' : 'gap-y-1.5 text-[10px] sm:text-[11px] mb-3 p-3')"
             style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
          
          <!-- Columna Izquierda: Logística del Movimiento -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">NO. MOVIMIENTO (FOLIO):</span>
              <span class="font-black text-xs sm:text-sm font-mono text-black text-right flex-1 min-w-0">#{{ transfer.folio }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FECHA Y HORA DE TRASPASO:</span>
              <span class="font-medium text-black text-right flex-1 min-w-0">{{ transfer.transferredAt }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA RESPONSABLE:</span>
              <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">USUARIO REGISTRADOR:</span>
              <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ transfer.transferredBy || capturedByName }}</span>
            </div>
          </div>

          <!-- Columna Derecha: Motivo & Ubicaciones -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MOTIVO DE REUBICACIÓN:</span>
              <span class="font-bold text-amber-800 text-right break-words flex-1 min-w-0">{{ transfer.reasonLabel || 'Reubicación operativa' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">OBSERVACIONES:</span>
              <span class="font-medium text-slate-800 italic text-right break-words flex-1 min-w-0">{{ transfer.observations || 'Sin observaciones' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA ORIGEN:</span>
              <span class="font-mono font-bold text-amber-900 text-right flex-1 min-w-0">{{ transfer.originLocation }}</span>
            </div>

            <div class="flex justify-between items-center gap-2 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <span class="font-bold text-[9.5px] uppercase text-emerald-900 shrink-0">BAHÍA DESTINO (ACTUAL):</span>
              <span class="font-mono font-black text-[10.5px] text-emerald-950 text-right break-words flex-1 min-w-0">{{ transfer.destinationLocation }}</span>
            </div>
          </div>

        </div>

        <!-- Matriz Visual de Reubicación -->
        <div class="grid grid-cols-2 gap-2 text-center" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1 text-[8px]' : (densityMode === 'compact' ? 'mb-2 text-[10px]' : 'mb-3 text-xs')">
          <div class="bg-amber-500/10 rounded border border-amber-500/30" [ngClass]="densityMode === 'ultra-compact' ? 'p-1' : 'p-2'">
            <span class="text-amber-800 uppercase font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9.5px]'">Bahía Origen (Desocupada)</span>
            <span class="font-mono font-black text-amber-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-xl'">{{ transfer.originLocation }}</span>
          </div>
          <div class="bg-emerald-500/10 rounded border border-emerald-500/30" [ngClass]="densityMode === 'ultra-compact' ? 'p-1' : 'p-2'">
            <span class="text-emerald-800 uppercase font-bold block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9.5px]'">Bahía Destino (Ubicación Final)</span>
            <span class="font-mono font-black text-emerald-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-xs' : 'text-xl'">{{ transfer.destinationLocation }}</span>
          </div>
        </div>

        <!-- Tabla de Tarimas (Detalle Oficial) -->
        <div class="border border-black rounded-sm overflow-hidden" [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : 'mb-2.5'">
          <table class="w-full text-left border-collapse font-sans"
                 [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.8px] leading-tight' : (densityMode === 'compact' ? 'text-[8px]' : 'text-[9.5px] sm:text-[10px]')">
            <thead>
              <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
                <th class="border-r border-black text-center w-8" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">N. TARIMA</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">CÓDIGO TARIMA</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">LOTE</th>
                <th class="border-r border-black font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">SKU</th>
                <th class="border-r border-black" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">DESCRIPCIÓN DE PRODUCTO</th>
                <th class="border-r border-black" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">TIPO TARIMA</th>
                <th class="text-right" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1 px-2'">CANT X TARIMA</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="transfer.pallets && transfer.pallets.length > 0; else defaultPallets">
                <tr *ngFor="let item of transfer.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="border-r border-black text-center font-bold font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletNumber || (idx + 1) }}</td>
                  <td class="border-r border-black font-bold font-mono text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.palletCode }}</td>
                  <td class="border-r border-black font-mono font-bold text-amber-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.lotNumber || 'N/D' }}</td>
                  <td class="border-r border-black font-mono font-bold whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.productId || 'S/N' }}</td>
                  <td class="border-r border-black font-semibold" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.description || 'Mercancía en Traspaso' }}</td>
                  <td class="border-r border-black uppercase" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1 text-[6.5px]' : (densityMode === 'compact' ? 'py-0.5 px-1.5 text-[7.5px]' : 'py-1 px-2 text-[9px]')">{{ item.palletTypeLabel || 'Estándar' }}</td>
                  <td class="text-right font-black font-mono whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : (densityMode === 'compact' ? 'py-0.5 px-1.5' : 'py-1 px-2')">{{ item.pieces | number:'1.0-0' }} PZAS</td>
                </tr>
              </ng-container>
              <ng-template #defaultPallets>
                <tr>
                  <td colspan="7" class="text-center italic py-2 text-slate-500 font-semibold" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-xs'">
                    Sin tarimas individuales especificadas en este folio de traspaso.
                  </td>
                </tr>
              </ng-template>
            </tbody>
          </table>
        </div>

        <!-- Totales -->
        <div class="flex justify-between items-center font-bold border-b-2 border-black bg-slate-100/60 rounded"
             [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] px-2 py-0.5 mb-1' : (densityMode === 'compact' ? 'text-[9px] px-2.5 py-0.5 mb-2' : 'text-[10px] sm:text-[11px] px-3 py-1 mb-3')">
          <div>TOTAL TARIMAS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-xs'">{{ transfer.totalPallets || 5 }}</span></div>
          <div>SKUS DISTINTOS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-xs'">{{ transfer.distinctSkus || 1 }}</span></div>
          <div>TOTAL PIEZAS / KGS: <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-xs'">{{ (transfer.totalPieces || 225) | number:'1.0-2' }}</span></div>
        </div>

        <!-- Footer: Responsables + Firmas -->
        <div class="grid grid-cols-3 gap-4 items-end" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px] pt-1' : (densityMode === 'compact' ? 'text-[8px] pt-1' : 'text-[9.5px] sm:text-[10px] pt-1.5')">
          <div class="text-left">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900 leading-snug pb-[1px]">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</p>
            <p class="text-slate-500 uppercase tracking-wide leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[8px]'">Montacarguista Responsable</p>
          </div>
          <div class="text-center">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900 leading-snug pb-[1px]">{{ transfer.transferredBy || capturedByName }}</p>
            <p class="text-slate-500 uppercase tracking-wide leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[8px]'">Operador WMS / Registro</p>
          </div>
          <div class="text-right">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900 leading-snug pb-[1px]">Supervisor de Turno</p>
            <p class="text-slate-500 uppercase tracking-wide leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6px]' : 'text-[8px]'">Autorización y Control</p>
          </div>
        </div>

      </ng-template>

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    @media print {
      @page {
        size: letter portrait;
        margin: 5mm 6mm !important;
      }
      .print-container {
        box-shadow: none !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      th, td {
        line-height: 1.08 !important;
      }
    }
  `]
})
export class PrintTransferLayoutComponent {
  @Input() transfer!: WarehouseTransfer;
  protected readonly authState = inject(AuthState);

  get densityMode(): 'normal' | 'compact' | 'ultra-compact' {
    const count = this.transfer?.totalPallets || this.transfer?.pallets?.length || 0;
    if (count > 30) return 'ultra-compact';
    if (count > 16) return 'compact';
    return 'normal';
  }

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get capturedByName(): string {
    return (
      this.authState.userFullName() ||
      this.authState.currentUser()?.fullName ||
      this.authState.currentUser()?.username ||
      'OPERADOR WMS'
    );
  }
}
