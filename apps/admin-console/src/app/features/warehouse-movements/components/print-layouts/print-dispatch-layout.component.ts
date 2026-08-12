/**
 * @file print-dispatch-layout.component.ts
 * @description Format de impresión "Salida de Mercancía / Despacho Outbound".
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OutboundDispatch } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-dispatch-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="dispatch" class="print-container bg-white text-slate-900 p-8 max-w-3xl mx-auto font-sans">
      
      <!-- Header -->
      <div class="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 class="text-2xl font-black tracking-tight">4GUARD WMS</h1>
          <p class="text-xs uppercase font-semibold text-slate-600">Despacho Outbound / Embarke</p>
        </div>
        <div class="text-right">
          <h2 class="text-lg font-bold">SALIDA DE MERCANCÍA</h2>
          <p class="text-sm font-mono font-bold text-slate-900">FOLIO: #{{ dispatch.folio }}</p>
          <p class="text-xs text-slate-500">{{ dispatch.dispatchedAt }}</p>
        </div>
      </div>

      <!-- Datos de Transporte / Destino -->
      <div class="grid grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded border border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-700 block">Cliente:</span>
          <span>{{ dispatch.client }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Planta Destino:</span>
          <span class="font-semibold text-emerald-800">{{ dispatch.destinationPlant }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">No. Sello / Cincho:</span>
          <span class="font-mono font-bold">{{ dispatch.sealNumber }}</span>
        </div>

        <div>
          <span class="font-bold text-slate-700 block">Transportista / Chofer:</span>
          <span>{{ dispatch.carrierName }} ({{ dispatch.driverName }})</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Tipo Transporte / No. Eco:</span>
          <span>{{ dispatch.transportType }} / {{ dispatch.economicNumber }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Placas Tracto / Caja:</span>
          <span>{{ dispatch.tractorPlates }} / {{ dispatch.boxPlates }}</span>
        </div>

        <div class="col-span-3">
          <span class="font-bold text-slate-700 block">Montacarguista Responsable:</span>
          <span>{{ dispatch.forkliftOperator }}</span>
        </div>
      </div>

      <!-- Detalle de Producto y UAs Seleccionadas -->
      <div class="mb-6 border border-slate-300 rounded overflow-hidden">
        <div class="bg-slate-800 text-white p-2 text-xs font-bold">
          PRODUCTO: {{ dispatch.productName }} ({{ dispatch.productId }})
        </div>
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 font-bold border-b border-slate-200">
              <th class="p-2 border-r">#</th>
              <th class="p-2 border-r">Código UA</th>
              <th class="p-2 border-r">Tipo Tarima</th>
              <th class="p-2 text-right">Piezas Despachadas</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of dispatch.selectedPallets; let i = index" class="border-b border-slate-200">
              <td class="p-2 border-r font-mono">{{ i + 1 }}</td>
              <td class="p-2 border-r font-mono font-bold text-slate-900">{{ p.palletCode }}</td>
              <td class="p-2 border-r">{{ p.palletTypeLabel }}</td>
              <td class="p-2 text-right font-mono font-bold">{{ p.pieces }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-bold">
              <td colspan="2" class="p-2">Totales Despachados:</td>
              <td class="p-2 text-center">{{ dispatch.totalPallets }} Tarimas</td>
              <td class="p-2 text-right font-mono text-sm">{{ dispatch.totalPieces }} Pzas</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Footer Firmas -->
      <div class="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 items-end">
        <div class="text-xs">
          <p class="font-bold text-slate-900 text-sm">Despachó: {{ dispatch.dispatchedBy }}</p>
          <p class="text-slate-500 text-[10px]">Comprobante de Salida Outbound 4GUARD WMS</p>
        </div>
        <div class="text-center">
          <div class="border-b-2 border-slate-900 w-full mb-1"></div>
          <p class="font-bold text-xs uppercase tracking-widest text-slate-900">FIRMA</p>
        </div>
      </div>

    </div>
  `
})
export class PrintDispatchLayoutComponent {
  @Input() dispatch!: OutboundDispatch;
}
