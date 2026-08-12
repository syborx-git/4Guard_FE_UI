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
    <div *ngIf="reception" class="print-container bg-white text-slate-900 p-8 max-w-3xl mx-auto font-sans border-4 border-rose-600 rounded-lg">
      
      <!-- Header Advertencia -->
      <div class="bg-rose-600 text-white p-4 rounded mb-6 text-center">
        <h1 class="text-2xl font-black tracking-wider uppercase">HOJA DE CANCELACIÓN DE RECEPCIÓN</h1>
        <p class="text-xs font-semibold">Compuerta de Seguridad / Revocación de Inventario</p>
      </div>

      <div class="grid grid-cols-2 gap-4 text-xs mb-6 bg-rose-50 p-4 border border-rose-200 rounded">
        <div>
          <span class="font-bold text-slate-700 block">No. Recepción (Folio):</span>
          <span class="font-mono font-bold text-rose-700 text-base">#{{ reception.folio }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Fecha y Hora de Cancelación:</span>
          <span>{{ reception.cancelledAt || 'Hoy' }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Cliente:</span>
          <span>{{ reception.checkIn.client }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Remisión Cancelada:</span>
          <span class="font-mono font-bold">{{ reception.checkIn.docNumber }}</span>
        </div>
        <div class="col-span-2">
          <span class="font-bold text-slate-700 block">Autorizado Por Líder:</span>
          <span class="font-semibold text-rose-900">{{ reception.leaderAuthorizedBy || 'Pablo Hernández' }}</span>
        </div>
      </div>

      <div class="mb-6 bg-slate-50 p-4 border border-slate-300 rounded text-xs">
        <span class="font-bold text-slate-800 block text-sm mb-1">Motivo / Justificación Obligatoria de Cancelación:</span>
        <p class="text-rose-900 font-medium italic border-l-4 border-rose-500 pl-3 py-1">
          "{{ reception.cancellationReason || 'Sin justificación registrada.' }}"
        </p>
      </div>

      <!-- Resumen de UAs dadas de baja -->
      <div class="mb-8">
        <h3 class="text-xs font-bold text-slate-800 mb-2 uppercase">Unidades de Almacenamiento (UAs) Removidas de Stock:</h3>
        <table class="w-full text-left text-xs border border-slate-300">
          <thead>
            <tr class="bg-slate-200 font-bold text-slate-700">
              <th class="p-2 border-b">Código UA</th>
              <th class="p-2 border-b">Producto</th>
              <th class="p-2 border-b text-right">Piezas</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of reception.pallets" class="border-b border-slate-200">
              <td class="p-2 font-mono font-bold text-slate-900">{{ p.palletCode }}</td>
              <td class="p-2">{{ p.description }}</td>
              <td class="p-2 text-right font-mono">{{ p.pieces }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Firmas -->
      <div class="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 items-end">
        <div class="text-xs">
          <p class="font-bold text-slate-900 text-sm">Capturó: {{ reception.capturedBy }}</p>
          <p class="text-slate-500 text-[10px]">Documento auditado de seguridad 4GUARD WMS</p>
        </div>
        <div class="text-center">
          <div class="border-b-2 border-slate-900 w-full mb-1"></div>
          <p class="font-bold text-xs uppercase tracking-widest text-slate-900">FIRMA</p>
        </div>
      </div>

    </div>
  `
})
export class PrintCancellationLayoutComponent {
  @Input() reception!: ReceptionHeader;
}
