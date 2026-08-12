/**
 * @file print-reception-layout.component.ts
 * @description Layout de impresión optimizado para el formato "Recepción de Mercancía".
 * Cumple estrictamente con el estándar de pie de página: Capturó: [Usuario] + Línea horizontal con etiqueta FIRMA.
 */

import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-slate-900 p-8 max-w-4xl mx-auto font-sans">
      
      <!-- Print Header / Logo Header -->
      <div class="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 class="text-2xl font-black tracking-tight text-slate-900">4GUARD WMS</h1>
          <p class="text-xs uppercase font-semibold tracking-wider text-slate-600">Sistema de Gestión de Almacén</p>
        </div>
        <div class="text-right">
          <h2 class="text-xl font-bold text-slate-800">RECEPCIÓN DE MERCANCÍA</h2>
          <p class="text-sm font-mono font-bold text-slate-900">FOLIO NO: #{{ reception.folio }}</p>
          <p class="text-xs text-slate-500">Fecha: {{ reception.createdAt }}</p>
        </div>
      </div>

      <!-- Datos de Caseta (F01-PO-CP-7.1.3-03) -->
      <div class="grid grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded border border-slate-200 text-xs">
        <div>
          <span class="font-bold text-slate-700 block">Cliente:</span>
          <span>{{ reception.checkIn.client }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Línea Transportadora:</span>
          <span>{{ reception.checkIn.carrierLine }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Remisión / Factura:</span>
          <span class="font-mono font-bold">{{ reception.checkIn.docNumber }}</span>
        </div>

        <div>
          <span class="font-bold text-slate-700 block">Operador (Chofer):</span>
          <span>{{ reception.checkIn.driverName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Placas Tracto / Caja:</span>
          <span>{{ reception.checkIn.tractorPlates }} / {{ reception.checkIn.boxPlates }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">No. Sello:</span>
          <span class="font-mono">{{ reception.checkIn.sealNumber }}</span>
        </div>

        <div>
          <span class="font-bold text-slate-700 block">Rampa No.:</span>
          <span>Rampa #{{ reception.checkIn.rampNumber }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Montacarguista:</span>
          <span>{{ reception.checkIn.forkliftOperator }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700 block">Líder que Autorizó:</span>
          <span class="font-medium text-amber-800">{{ reception.leaderAuthorizedBy || 'Pablo Hernández' }}</span>
        </div>
      </div>

      <!-- Detalle de Producto / Lote -->
      <div class="mb-6 border border-slate-200 rounded overflow-hidden text-xs">
        <div class="bg-slate-800 text-white px-4 py-2 font-bold flex justify-between">
          <span>DATOS DE PRODUCTO Y LOTE</span>
          <span>Estado: {{ reception.status }}</span>
        </div>
        <div class="p-4 grid grid-cols-4 gap-4 bg-white">
          <div>
            <span class="font-bold text-slate-600 block">SKU / Producto:</span>
            <span>{{ reception.productName }} ({{ reception.productId }})</span>
          </div>
          <div>
            <span class="font-bold text-slate-600 block">Lote Recepción:</span>
            <span class="font-mono font-bold">{{ reception.lotNumber }}</span>
          </div>
          <div>
            <span class="font-bold text-slate-600 block">Fecha Elaboración:</span>
            <span>{{ reception.elaborationDate }}</span>
          </div>
          <div>
            <span class="font-bold text-slate-600 block">Fecha Caducidad:</span>
            <span>{{ reception.expirationDate }}</span>
          </div>
        </div>
      </div>

      <!-- Tabla de Palets / UAs Escaneadas -->
      <div class="mb-8 border border-slate-200 rounded overflow-hidden">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
              <th class="p-2 border-r">#</th>
              <th class="p-2 border-r">Código Tarima (UA)</th>
              <th class="p-2 border-r">Descripción SKU</th>
              <th class="p-2 border-r text-center">Tipo Tarima</th>
              <th class="p-2 text-right">Piezas</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-200">
              <td class="p-2 border-r font-mono">{{ idx + 1 }}</td>
              <td class="p-2 border-r font-mono font-bold text-slate-900">{{ item.palletCode }}</td>
              <td class="p-2 border-r">{{ item.description }}</td>
              <td class="p-2 border-r text-center">{{ item.palletTypeLabel }}</td>
              <td class="p-2 text-right font-mono font-bold">{{ item.pieces }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
              <td colspan="3" class="p-2 text-right uppercase">Totales Computados:</td>
              <td class="p-2 text-center">{{ totalPallets }} Tarimas</td>
              <td class="p-2 text-right font-mono text-sm">{{ totalPieces }} Pzas</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Observaciones si existen -->
      <div *ngIf="reception.observations" class="mb-10 text-xs bg-slate-50 p-3 border border-slate-200 rounded">
        <span class="font-bold text-slate-700 block">Observaciones:</span>
        <span>{{ reception.observations }}</span>
      </div>

      <!-- ESTÁNDAR EXACTO DE PIE DE PÁGINA (CORRECCIÓN 3) -->
      <div class="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 items-end">
        <div class="text-xs">
          <p class="font-bold text-slate-900 text-sm mb-1">
            Capturó: <span class="font-normal">{{ reception.capturedBy }}</span>
          </p>
          <p class="text-slate-500 text-[10px]">Documento impreso desde 4GUARD WMS Console</p>
        </div>

        <div class="text-center">
          <div class="border-b-2 border-slate-900 w-full mb-1"></div>
          <p class="font-bold text-xs uppercase tracking-widest text-slate-900">FIRMA</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    @media print {
      body * {
        visibility: hidden;
      }
      .print-container, .print-container * {
        visibility: visible;
      }
      .print-container {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
    }
  `]
})
export class PrintReceptionLayoutComponent {
  @Input() reception!: ReceptionHeader;

  get totalPallets(): number {
    return this.reception?.pallets?.length || 0;
  }

  get totalPieces(): number {
    return this.reception?.pallets?.reduce((acc, p) => acc + p.pieces, 0) || 0;
  }
}
