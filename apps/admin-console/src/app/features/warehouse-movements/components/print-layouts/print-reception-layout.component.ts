/**
 * @file print-reception-layout.component.ts
 * @description Formato Oficial de Impresión "RECEPCIÓN DE MERCANCÍA" adaptado 100% al diseño cliente (Imágenes 2 y 3).
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="official-print-document bg-white text-black p-6 max-w-4xl mx-auto font-sans">
      
      <!-- Top Header & Logo -->
      <div class="flex justify-between items-start mb-3 pb-2 border-b border-black">
        <div class="flex items-center gap-3">
          <div class="w-14 h-14 bg-navy text-gold font-black flex items-center justify-center rounded border border-gold text-lg">
            4G
          </div>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight text-black">4-GUARD</h1>
            <p class="text-[10px] text-slate-700 font-semibold uppercase">Industria Automotriz 128, Delegación Santa María Totoltepec, 50200 Toluca de Lerdo, Méx</p>
          </div>
        </div>

        <div class="text-right">
          <p class="text-[11px] font-mono font-bold text-slate-800">FECHA DE IMPRESIÓN: {{ printDate }}</p>
        </div>
      </div>

      <!-- Main Title -->
      <div class="text-center mb-4">
        <h2 class="text-xl font-black uppercase tracking-wider text-black">RECEPCIÓN DE MERCANCIA</h2>
      </div>

      <!-- Header Grid Metadata (Idéntico a Imagen 2) -->
      <div class="grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] mb-4 font-mono">
        
        <!-- Fila 1 -->
        <div class="col-span-4">
          <span class="font-bold">NO. RECEPCIÓN:</span> <span class="font-bold text-black">{{ reception.folio }}</span>
        </div>
        <div class="col-span-8">
          <span class="font-bold">FECHA RECEPCIÓN:</span> <span>{{ reception.createdAt }}</span>
        </div>

        <!-- Fila 2 -->
        <div class="col-span-6">
          <span class="font-bold">LINEA TRANSPORTADORA:</span> <span>{{ reception.checkIn.carrierLine }}</span>
        </div>
        <div class="col-span-6">
          <span class="font-bold">NO. DOCUMENTO:</span> <span class="font-bold">{{ reception.checkIn.docNumber }}</span>
        </div>

        <!-- Fila 3 -->
        <div class="col-span-6">
          <span class="font-bold">OPERADOR:</span> <span>{{ reception.checkIn.driverName }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">FECHA DOCUMENTO:</span> <span>{{ reception.checkIn.docDate }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">FECHA CADUCIDAD:</span> <span>{{ reception.expirationDate || 'N/A' }}</span>
        </div>

        <!-- Fila 4 -->
        <div class="col-span-6">
          <span class="font-bold">CLIENTE:</span> <span>{{ reception.checkIn.client }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">PLACAS TRACTO:</span> <span>{{ reception.checkIn.tractorPlates }}</span>
        </div>
        <div class="col-span-3">
          <span class="font-bold">PLACAS CAJA:</span> <span>{{ reception.checkIn.boxPlates }}</span>
        </div>

        <!-- Fila 5: Montacarguista, Lote, Sellos de Seguridad (Box a la derecha) -->
        <div class="col-span-7 space-y-1">
          <div>
            <span class="font-bold">MONTACARGUISTA:</span> <span>{{ reception.checkIn.forkliftOperator }}</span>
          </div>
          <div>
            <span class="font-bold">RAMPA DE RECEPCIÓN:</span> <span>Rampa {{ reception.checkIn.rampNumber }}</span>
          </div>
        </div>

        <div class="col-span-5 border border-black p-2 rounded relative">
          <span class="font-bold text-[10px] block uppercase">SELLOS SEGURIDAD:</span>
          <span class="font-bold font-mono text-xs">{{ reception.checkIn.sealNumber || '2312550' }}</span>
        </div>

        <!-- Fila 6: Lote y Almacenaje -->
        <div class="col-span-6">
          <span class="font-bold">LOTE:</span> <span>{{ reception.lotNumber || '01.07.2026' }}</span>
        </div>
        <div class="col-span-6">
          <span class="font-bold">LUGAR DE ALMACENAJE:</span> <span>{{ reception.storageLocation || 'Bodega M 98' }}</span>
        </div>
      </div>

      <!-- Tabla de Tarimas (Formato exacto Imágenes 2 y 3) -->
      <div class="mb-4 border border-black">
        <table class="w-full text-left text-[10px] border-collapse font-mono">
          <thead>
            <tr class="border-b border-black font-bold uppercase bg-slate-100">
              <th class="p-1.5 border-r border-black text-center w-12">N. TARIMA</th>
              <th class="p-1.5 border-r border-black">CODIGO TARIMA</th>
              <th class="p-1.5 border-r border-black">SKU</th>
              <th class="p-1.5 border-r border-black">DESCRIPCIÓN</th>
              <th class="p-1.5 border-r border-black">PROVEEDOR</th>
              <th class="p-1.5 border-r border-black">TIPO TARIMA</th>
              <th class="p-1.5 border-r border-black text-right">CANT X TARIMA</th>
              <th class="p-1.5">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-300">
              <td class="p-1 border-r border-black text-center">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="p-1 border-r border-black font-bold">{{ item.palletCode }}</td>
              <td class="p-1 border-r border-black">{{ item.productId }}</td>
              <td class="p-1 border-r border-black font-semibold">{{ item.description }}</td>
              <td class="p-1 border-r border-black uppercase">{{ item.supplierName || 'LE MEXICO S.A DE C.V' }}</td>
              <td class="p-1 border-r border-black uppercase">{{ item.palletTypeLabel }}</td>
              <td class="p-1 border-r border-black text-right font-bold">{{ item.pieces | number:'1.4-4' }} PIEZAS</td>
              <td class="p-1 italic text-slate-700">{{ item.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales (Imagen 3) -->
      <div class="flex justify-between items-center text-xs font-mono font-bold border-b-2 border-black pb-2 mb-6">
        <div>TOTAL TARIMAS: {{ totalPallets }}</div>
        <div>TOTAL PZAS: {{ totalPieces | number:'1.2-2' }}</div>
      </div>

      <!-- Footer: Capturó + Firma (Imagen 3) -->
      <div class="grid grid-cols-2 gap-8 items-end text-xs font-mono pt-4">
        <div>
          <p class="font-bold">CAPTURÓ: <span class="font-normal uppercase">{{ reception.capturedBy || '12 PABLO VALLE MENDOZA' }}</span></p>
        </div>

        <div>
          <div class="border-b border-black w-full mb-1"></div>
          <p class="font-bold">NOMBRE Y FIRMA</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .bg-navy { background-color: #172033; }
    .text-gold { color: #ad8129; }
    .border-gold { border-color: #ad8129; }

    @media print {
      body * {
        visibility: hidden !important;
      }
      .official-print-document, .official-print-document * {
        visibility: visible !important;
      }
      .official-print-document {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 20px !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
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
