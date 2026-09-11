/**
 * @file print-cancellation-layout.component.ts
 * @description Format de impresión "Hoja de Cancelación de Recepción" para trazabilidad y auditoría.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-cancellation-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-slate-900 p-4 sm:p-5 max-w-full mx-auto font-sans border-2 border-rose-600 rounded-lg shadow-sm">
      
      <!-- Header Advertencia -->
      <div class="bg-rose-600 text-white p-2.5 sm:p-3 rounded-md mb-3 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[40px] sm:max-w-[46px] object-contain rounded bg-white p-1" />
          <div>
            <h1 class="text-xs sm:text-sm md:text-base font-black tracking-wider uppercase leading-tight">HOJA DE CANCELACIÓN DE RECEPCIÓN</h1>
            <p class="text-[9px] sm:text-[10px] font-semibold opacity-95">Compuerta de Seguridad / Revocación de Inventario</p>
          </div>
        </div>
      </div>

      <!-- Datos Generales -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-3 bg-rose-50/90 p-2.5 border border-rose-200 rounded-md">
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">No. Recepción (Folio):</span>
          <span class="font-mono font-bold text-rose-700 text-xs sm:text-sm">#{{ reception.folio }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Fecha y Hora de Cancelación:</span>
          <span class="font-medium text-slate-900">{{ reception.cancelledAt || 'Hoy' }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Cliente:</span>
          <span class="font-medium text-slate-900 truncate block">{{ reception.checkIn.client }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Remisión Cancelada:</span>
          <span class="font-mono font-bold text-slate-900">{{ reception.checkIn.docNumber }}</span>
        </div>
        <div class="col-span-2 pt-0.5 border-t border-rose-200/60">
          <span class="font-bold text-slate-600 inline text-[10px]">Autorizado Por Líder: </span>
          <span class="font-semibold text-rose-900">{{ reception.leaderAuthorizedBy || 'Pablo Hernández' }}</span>
        </div>
      </div>

      <!-- Motivo de Cancelación -->
      <div class="mb-3 bg-slate-50 p-2.5 border border-slate-200 rounded-md text-[11px]">
        <span class="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">Motivo / Justificación de Cancelación:</span>
        <p class="text-rose-900 font-medium italic border-l-3 border-rose-500 pl-2.5 py-0.5 bg-white rounded-r text-xs">
          "{{ reception.cancellationReason || 'Sin justificación registrada.' }}"
        </p>
      </div>

      <!-- Resumen de UAs dadas de baja -->
      <div class="mb-3">
        <h3 class="text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Unidades de Almacenamiento (UAs) Removidas de Stock:</h3>
        <div class="overflow-x-auto rounded border border-slate-200">
          <table class="w-full text-left text-[11px]">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <th class="py-1.5 px-2">Código UA</th>
                <th class="py-1.5 px-2">Producto</th>
                <th class="py-1.5 px-2 text-right">Piezas</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of reception.pallets" class="border-b border-slate-100 hover:bg-slate-50/80">
                <td class="py-1 px-2 font-mono font-bold text-slate-900 text-[10px] sm:text-[11px]">{{ p.palletCode }}</td>
                <td class="py-1 px-2 text-slate-800 text-[10px] sm:text-[11px]">{{ p.description }}</td>
                <td class="py-1 px-2 text-right font-mono font-bold text-slate-900 text-[10px] sm:text-[11px]">{{ p.pieces }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer Firmas -->
      <div class="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-6 items-end">
        <div class="text-[10px]">
          <p class="font-bold text-slate-900 text-[11px]">Capturó: {{ reception.capturedBy }}</p>
          <p class="text-slate-400 text-[9px]">Documento auditado de seguridad 4GUARD WMS</p>
        </div>
        <div class="text-center">
          <div class="border-b border-slate-800 w-full mb-1"></div>
          <p class="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-800">FIRMA</p>
        </div>
      </div>

    </div>
  `
})
export class PrintCancellationLayoutComponent {
  @Input() reception!: ReceptionHeader;
}
