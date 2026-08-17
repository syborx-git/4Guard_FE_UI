/**
 * @file print-transfer-layout.component.ts
 * @description Format de impresión "Cambio de Almacén" para trazabilidad física del montacarguista.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WarehouseTransfer } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-transfer-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="transfer" class="print-container bg-white text-slate-900 p-8 max-w-4xl mx-auto font-sans shadow-lg rounded-xl border border-slate-200 print:shadow-none print:border-none">
      
      <!-- Header Oficial WMS -->
      <div class="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-5">
        <div class="flex items-center gap-3">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-14 w-auto max-w-[60px] object-contain rounded" />
          <div>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 leading-none">4GUARD WMS</h1>
            <p class="text-[11px] uppercase font-bold text-amber-700 tracking-wider mt-1">COMPROBANTE OFICIAL DE CAMBIO DE ALMACÉN</p>
            <p class="text-[10px] text-slate-500">Sucursal Principal Toluca · Almacén Central</p>
          </div>
        </div>
        <div class="text-right">
          <div class="inline-block bg-slate-900 text-amber-400 px-3 py-1 rounded font-mono font-black text-sm mb-1 tracking-wide">
            FOLIO: {{ transfer.folio }}
          </div>
          <p class="text-xs text-slate-600 font-medium">Fecha: {{ transfer.transferredAt }}</p>
          <span class="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-0.5">
            MOVIMIENTO COMPLETADO
          </span>
        </div>
      </div>

      <!-- Resumen de Responsables y Motivo -->
      <div class="grid grid-cols-3 gap-3 mb-5 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
        <div>
          <span class="text-slate-500 font-bold uppercase block text-[10px]">Montacarguista:</span>
          <span class="text-sm font-bold text-slate-900">{{ transfer.forkliftOperator }}</span>
          <span class="text-[10px] text-slate-500 block">ID: {{ transfer.forkliftOperatorId || 'MC-101' }}</span>
        </div>
        <div>
          <span class="text-slate-500 font-bold uppercase block text-[10px]">Usuario Registrador:</span>
          <span class="text-sm font-bold text-slate-900">{{ transfer.transferredBy }}</span>
          <span class="text-[10px] text-slate-500 block">Operación y Logística</span>
        </div>
        <div>
          <span class="text-slate-500 font-bold uppercase block text-[10px]">Motivo de Reubicación:</span>
          <span class="text-xs font-bold text-amber-800 block">{{ transfer.reasonLabel || 'Reubicación operativa' }}</span>
          <span class="text-[10px] text-slate-600 italic block truncate">{{ transfer.observations || 'Sin observaciones adicionales' }}</span>
        </div>
      </div>

      <!-- Matriz de Reubicación: Origen -> Destino -->
      <div class="grid grid-cols-2 gap-4 mb-5 text-center">
        <div class="bg-amber-500/10 p-3.5 rounded-lg border border-amber-500/30">
          <span class="text-[11px] text-amber-800 uppercase font-black block tracking-wider">Bahía Origen (Desocupada)</span>
          <span class="text-3xl font-black text-amber-900 font-mono tracking-tight">{{ transfer.originLocation }}</span>
        </div>
        <div class="bg-emerald-500/10 p-3.5 rounded-lg border border-emerald-500/30">
          <span class="text-[11px] text-emerald-800 uppercase font-black block tracking-wider">Bahía Destino (Ubicación Final)</span>
          <span class="text-3xl font-black text-emerald-900 font-mono tracking-tight">{{ transfer.destinationLocation }}</span>
        </div>
      </div>

      <!-- Detalle de Tarimas Reubicadas -->
      <div class="mb-6 border border-slate-300 rounded-lg overflow-hidden">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-300">
              <th class="p-2.5 text-center w-10">#</th>
              <th class="p-2.5">Código UA (Tarima)</th>
              <th class="p-2.5">SKU</th>
              <th class="p-2.5">Descripción de Producto</th>
              <th class="p-2.5">Tipo Tarima</th>
              <th class="p-2.5 text-right">Piezas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 font-medium">
            <tr *ngFor="let p of transfer.pallets; let i = index" class="hover:bg-slate-50">
              <td class="p-2.5 text-center font-mono font-bold text-slate-500">{{ i + 1 }}</td>
              <td class="p-2.5 font-mono font-bold text-amber-700">{{ p.palletCode }}</td>
              <td class="p-2.5 font-mono font-bold text-slate-900">{{ p.productId }}</td>
              <td class="p-2.5 text-slate-800">{{ p.description }}</td>
              <td class="p-2.5 text-slate-600">{{ p.palletTypeLabel }}</td>
              <td class="p-2.5 text-right font-mono font-black text-emerald-700">{{ p.pieces }} PZAS</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
              <td colspan="3" class="p-2.5 text-xs">TOTALES TRASLADADOS:</td>
              <td class="p-2.5 text-center">{{ transfer.totalPallets }} Tarimas</td>
              <td class="p-2.5 text-center">{{ transfer.distinctSkus || 1 }} SKU(s)</td>
              <td class="p-2.5 text-right font-mono text-sm text-emerald-800 font-black">{{ transfer.totalPieces }} PZAS</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Firmas Operativas -->
      <div class="mt-10 pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-6 text-center text-xs">
        <div>
          <div class="border-b border-slate-900 w-full mb-1 h-10"></div>
          <p class="font-bold text-slate-900">{{ transfer.forkliftOperator }}</p>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Montacarguista Responsable</p>
        </div>
        <div>
          <div class="border-b border-slate-900 w-full mb-1 h-10"></div>
          <p class="font-bold text-slate-900">{{ transfer.transferredBy }}</p>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Operador WMS / Registro</p>
        </div>
        <div>
          <div class="border-b border-slate-900 w-full mb-1 h-10"></div>
          <p class="font-bold text-slate-900">Supervisor de Turno</p>
          <p class="text-[10px] text-slate-500 uppercase tracking-wider">Autorización y Control</p>
        </div>
      </div>

    </div>
  `
})
export class PrintTransferLayoutComponent {
  @Input() transfer!: WarehouseTransfer;
}
