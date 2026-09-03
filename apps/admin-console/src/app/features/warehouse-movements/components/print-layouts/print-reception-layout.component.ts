/**
 * @file print-reception-layout.component.ts
 * @description Formato Oficial de Impresión "PAUTA DE RECEPCIÓN DE MERCANCÍA" adaptado 100% al estándar SDD-PRINT-001 y ADR-012.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-black p-4 sm:p-5 max-w-full mx-auto font-sans border border-slate-300 rounded-lg shadow-sm">
      
      <!-- Top Header & Logo Institucional -->
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
        </div>
      </div>

      <!-- Main Title -->
      <div class="text-center mb-2.5">
        <h2 class="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-black">PAUTA DE RECEPCIÓN DE MERCANCÍA</h2>
      </div>

      <!-- Header Grid Metadata -->
      <div class="grid grid-cols-12 gap-x-3 gap-y-1 text-[10px] sm:text-[11px] mb-3 font-mono">
        
        <!-- Fila 1 -->
        <div class="col-span-4">
          <span class="font-bold">NO. RECEPCIÓN:</span> <span class="font-bold text-black text-xs sm:text-sm">#{{ reception.folio }}</span>
        </div>
        <div class="col-span-8">
          <span class="font-bold">FECHA RECEPCIÓN:</span> <span>{{ reception.createdAt }}</span>
        </div>

        <!-- Fila 2 -->
        <div class="col-span-6">
          <span class="font-bold">LINEA TRANSPORTADORA:</span> <span class="truncate inline-block max-w-[180px] align-bottom">{{ reception.checkIn.carrierLine }}</span>
        </div>
        <div class="col-span-6">
          <span class="font-bold">NO. DOCUMENTO:</span> <span class="font-bold">{{ reception.checkIn.docNumber }}</span>
        </div>

        <!-- Fila 3 -->
        <div class="col-span-6">
          <span class="font-bold">OPERADOR:</span> <span>{{ reception.checkIn.driverName }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">FECHA DOC:</span> <span>{{ reception.checkIn.docDate }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">CADUCIDAD:</span> <span>{{ reception.expirationDate || 'N/A' }}</span>
        </div>

        <!-- Fila 4 -->
        <div class="col-span-6">
          <span class="font-bold">CLIENTE:</span> <span class="truncate inline-block max-w-[180px] align-bottom">{{ reception.checkIn.client }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">PLACAS TRACTO:</span> <span>{{ reception.checkIn.tractorPlates }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">PLACAS CAJA:</span> <span>{{ reception.checkIn.boxPlates }}</span>
        </div>

        <!-- Fila 5: Montacarguista, Rampa y Sellos -->
        <div class="col-span-7 space-y-0.5">
          <div>
            <span class="font-bold">MONTACARGUISTA:</span> <span>{{ reception.checkIn.forkliftOperator }}</span>
          </div>
          <div>
            <span class="font-bold">RAMPA DE RECEPCIÓN:</span> <span>Rampa {{ reception.checkIn.rampNumber }}</span>
          </div>
        </div>

        <div class="col-span-5 border border-black p-1.5 rounded relative bg-slate-50">
          <span class="font-bold text-[9px] block uppercase text-slate-700">SELLOS DE SEGURIDAD:</span>
          <span class="font-bold font-mono text-[10px] sm:text-xs text-black">{{ reception.checkIn.sealNumber || '2312550' }}</span>
        </div>

        <!-- Fila 6: Lote y Almacenaje -->
        <div class="col-span-6">
          <span class="font-bold">LOTE:</span> <span class="font-bold">{{ reception.lotNumber || '01.07.2026' }}</span>
        </div>
        <div class="col-span-6">
          <span class="font-bold">LUGAR DE ALMACENAJE:</span> <span>{{ reception.storageLocation || 'Bodega M 98' }}</span>
        </div>
      </div>

      <!-- Tabla de Tarimas (Detalle Oficial) -->
      <div class="mb-2.5 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[9px] sm:text-[10px] border-collapse font-mono">
          <thead>
            <tr class="border-b border-black font-bold uppercase bg-slate-100">
              <th class="py-1 px-1.5 border-r border-black text-center w-10">N. TARIMA</th>
              <th class="py-1 px-1.5 border-r border-black">CODIGO TARIMA</th>
              <th class="py-1 px-1.5 border-r border-black">SKU</th>
              <th class="py-1 px-1.5 border-r border-black">DESCRIPCIÓN</th>
              <th class="py-1 px-1.5 border-r border-black">PROVEEDOR</th>
              <th class="py-1 px-1.5 border-r border-black">TIPO TARIMA</th>
              <th class="py-1 px-1.5 border-r border-black text-right">CANT X TARIMA</th>
              <th class="py-1 px-1.5">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
              <td class="py-0.5 px-1 border-r border-black text-center font-bold">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="py-0.5 px-1 border-r border-black font-bold text-slate-900">{{ item.palletCode }}</td>
              <td class="py-0.5 px-1 border-r border-black">{{ item.productId }}</td>
              <td class="py-0.5 px-1 border-r border-black font-semibold">{{ item.description }}</td>
              <td class="py-0.5 px-1 border-r border-black uppercase">{{ item.supplierName || 'LE MEXICO S.A DE C.V' }}</td>
              <td class="py-0.5 px-1 border-r border-black uppercase">{{ item.palletTypeLabel }}</td>
              <td class="py-0.5 px-1 border-r border-black text-right font-bold">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              <td class="py-0.5 px-1 italic text-slate-600 text-[8px] sm:text-[9px]">{{ item.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="flex justify-between items-center text-[10px] sm:text-[11px] font-mono font-bold border-b border-black pb-1 mb-3">
        <div>TOTAL TARIMAS: {{ totalPallets }}</div>
        <div>TOTAL PIEZAS: {{ totalPieces | number:'1.0-0' }} PZAS</div>
      </div>

      <!-- Footer: Capturó + Firma -->
      <div class="grid grid-cols-2 gap-8 items-end text-[10px] sm:text-[11px] font-mono pt-2">
        <div>
          <p class="font-bold">CAPTURÓ: <span class="font-normal uppercase">{{ reception.capturedBy || '12 PABLO VALLE MENDOZA' }}</span></p>
          <p class="text-[8px] text-slate-500 font-sans">Documento auditado oficial 4GUARD WMS</p>
        </div>

        <div class="text-center">
          <div class="border-b border-black w-full mb-1"></div>
          <p class="font-bold text-[9px] sm:text-[10px]">NOMBRE Y FIRMA</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .bg-navy { background-color: #172033; }
    .text-gold { color: #ad8129; }
    .border-gold { border-color: #ad8129; }
  `]
})
export class PrintReceptionLayoutComponent {
  @Input() reception!: ReceptionHeader;

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get totalPallets(): number {
    return this.reception?.pallets?.length || 0;
  }

  get totalPieces(): number {
    return this.reception?.pallets?.reduce((acc, p) => acc + p.pieces, 0) || 0;
  }
}
