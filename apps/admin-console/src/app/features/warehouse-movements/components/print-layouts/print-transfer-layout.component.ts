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
    <div *ngIf="transfer" class="print-container bg-white text-slate-900 p-8 max-w-3xl mx-auto font-sans">
      
      <!-- Header -->
      <div class="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 class="text-2xl font-black tracking-tight">4GUARD WMS</h1>
          <p class="text-xs uppercase font-semibold text-slate-600">Reubicación Interna / Traspaso</p>
        </div>
        <div class="text-right">
          <h2 class="text-lg font-bold">CAMBIO DE ALMACÉN</h2>
          <p class="text-sm font-mono font-bold text-slate-900">FOLIO: #{{ transfer.folio }}</p>
          <p class="text-xs text-slate-500">{{ transfer.transferredAt }}</p>
        </div>
      </div>

      <!-- Rutas Origen / Destino -->
      <div class="grid grid-cols-2 gap-4 mb-6 bg-slate-100 p-4 rounded border border-slate-300 text-center">
        <div class="border-r border-slate-300 pr-4">
          <span class="text-xs text-slate-500 uppercase font-bold block">Bahía Origen</span>
          <span class="text-3xl font-black text-slate-900 font-mono">{{ transfer.originLocation }}</span>
        </div>
        <div class="pl-4">
          <span class="text-xs text-emerald-600 uppercase font-bold block">Bahía Destino (En Ceros)</span>
          <span class="text-3xl font-black text-emerald-700 font-mono">{{ transfer.destinationLocation }}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6 text-xs bg-slate-50 p-4 rounded border border-slate-200">
        <div>
          <span class="font-bold text-slate-700 block">Montacarguista Asignado:</span>
          <span class="text-sm font-medium">{{ transfer.forkliftOperator }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Usuario Solicitante:</span>
          <span>{{ transfer.transferredBy }}</span>
        </div>
      </div>

      <!-- Tarimas Reubicadas -->
      <div class="mb-8 border border-slate-300 rounded overflow-hidden">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-200 font-bold text-slate-700">
              <th class="p-2 border-r">#</th>
              <th class="p-2 border-r">Código UA</th>
              <th class="p-2 border-r">SKU / Producto</th>
              <th class="p-2 text-right">Piezas</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of transfer.pallets; let i = index" class="border-b border-slate-200">
              <td class="p-2 border-r font-mono">{{ i + 1 }}</td>
              <td class="p-2 border-r font-mono font-bold text-slate-900">{{ p.palletCode }}</td>
              <td class="p-2 border-r">{{ p.description }}</td>
              <td class="p-2 text-right font-mono font-bold">{{ p.pieces }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-bold">
              <td colspan="2" class="p-2">Totales Reubicados:</td>
              <td class="p-2 text-center">{{ transfer.totalPallets }} Tarimas</td>
              <td class="p-2 text-right font-mono text-sm">{{ transfer.totalPieces }} Pzas</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer Firmas -->
      <div class="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 items-end">
        <div class="text-xs">
          <p class="font-bold text-slate-900 text-sm">Operador: {{ transfer.forkliftOperator }}</p>
          <p class="text-slate-500 text-[10px]">Trazabilidad física de reubicación</p>
        </div>
        <div class="text-center">
          <div class="border-b-2 border-slate-900 w-full mb-1"></div>
          <p class="font-bold text-xs uppercase tracking-widest text-slate-900">FIRMA</p>
        </div>
      </div>

    </div>
  `
})
export class PrintTransferLayoutComponent {
  @Input() transfer!: WarehouseTransfer;
}
