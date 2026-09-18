import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-black p-4 sm:p-5 max-w-full mx-auto font-sans border border-slate-300 rounded-sm shadow-sm text-[10px] leading-tight">
      
      <!-- Top Header & Logo Institucional -->
      <div class="flex justify-between items-center mb-2 pb-1.5 border-b-2 border-black">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 w-auto max-w-[40px] object-contain rounded" />
          <div>
            <h1 class="text-sm sm:text-base font-black tracking-tight text-black leading-none mb-0.5">4-GUARD WMS</h1>
            <p class="text-[8.5px] text-slate-700 font-bold uppercase tracking-tight">
              Calle. Industria Automotriz sin número, Colonia el Coecillo, municipio de Toluca, Estado de México, C.P 50246.
            </p>
          </div>
        </div>

        <div class="text-right shrink-0">
          <span class="text-[9px] font-bold text-slate-700 block uppercase">FECHA DE IMPRESIÓN</span>
          <span class="text-xs font-mono font-black text-black">{{ printDate }}</span>
        </div>
      </div>

      <!-- Main Title (Quitar "pauta de." por especificación oficial) -->
      <div class="text-center mb-2">
        <h2 class="text-xs sm:text-sm font-black uppercase tracking-widest text-black border-y-2 border-black py-0.5 inline-block px-8">
          RECEPCIÓN DE MERCANCÍA
        </h2>
      </div>

      <!-- Header Grid Metadata: 2 Columnas Estructuradas en MAYÚSCULAS y Espacio Optimizado -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 text-[9.5px] mb-2.5 border border-black p-2 rounded-sm bg-slate-50/50 uppercase">
        
        <!-- Columna Izquierda: Logística & Transporte -->
        <div class="space-y-1">
          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. RECEPCIÓN:</span>
            <span class="font-black text-xs font-mono text-black text-right flex-1 min-w-0">#{{ reception.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA RECEPCIÓN:</span>
            <span class="font-bold text-black text-right flex-1 min-w-0 font-mono">{{ formatDateDMY(reception.createdAt || reception.checkIn.docDate) }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-black text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.carrierLine || '').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">OPERADOR / CHOFER:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.driverName || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.tractorPlates || '-').toUpperCase() }} / {{ (reception.checkIn.boxPlates || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5">
            <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA / RAMPA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.forkliftOperator || '').toUpperCase() }} (RAMPA {{ reception.checkIn.rampNumber }})</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Cliente & Almacenaje -->
        <div class="space-y-1">
          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. DOCUMENTO / REMISIÓN:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ reception.checkIn.docNumber }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA CADUCIDAD:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ formatDateDMY(reception.expirationDate) }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">CLIENTE:</span>
            <span class="font-black text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.client || '').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LOTE DE PRODUCTO:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ reception.lotNumber || 'N/A' }}</span>
          </div>

          <div class="flex justify-between items-start gap-1.5 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LUGAR DE ALMACENAJE:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.storageLocation || 'BODEGA PRINCIPAL').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-center gap-1.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            <span class="font-bold text-[9px] uppercase text-amber-900 shrink-0">SELLOS DE SEGURIDAD:</span>
            <span class="font-mono font-black text-[9.5px] text-amber-950 text-right break-words flex-1 min-w-0">{{ (reception.checkIn.sealNumbers && reception.checkIn.sealNumbers.length > 0) ? reception.checkIn.sealNumbers.join(', ') : (reception.checkIn.sealNumber || 'N/A') }}</span>
          </div>
        </div>

      </div>

      <!-- Tabla de Tarimas (Detalle Oficial con Remisión y Caducidad por UA) -->
      <div class="mb-2 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[8.5px] sm:text-[9px] border-collapse font-sans uppercase">
          <thead>
            <tr class="border-b border-black font-black uppercase bg-slate-200 text-slate-950">
              <th class="py-0.5 px-1.5 border-r border-black text-center w-8">N. TARIMA</th>
              <th class="py-0.5 px-1.5 border-r border-black font-mono">CÓDIGO TARIMA (UA)</th>
              <th class="py-0.5 px-1.5 border-r border-black font-mono text-center">NO. REMISIÓN</th>
              <th class="py-0.5 px-1.5 border-r border-black font-mono">SKU</th>
              <th class="py-0.5 px-1.5 border-r border-black">DESCRIPCIÓN</th>
              <th class="py-0.5 px-1.5 border-r border-black">PROVEEDOR</th>
              <th class="py-0.5 px-1.5 border-r border-black">TIPO TARIMA</th>
              <th class="py-0.5 px-1.5 border-r border-black font-mono text-center">CADUCIDAD</th>
              <th class="py-0.5 px-1.5 border-r border-black text-right">CANT X TARIMA</th>
              <th class="py-0.5 px-1.5">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-300 hover:bg-slate-50">
              <td class="py-0.5 px-1.5 border-r border-black text-center font-bold font-mono">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="py-0.5 px-1.5 border-r border-black font-bold font-mono text-slate-950">{{ item.palletCode }}</td>
              <td class="py-0.5 px-1.5 border-r border-black font-mono text-center font-bold">{{ item.docNumber || reception.checkIn.docNumber || '-' }}</td>
              <td class="py-0.5 px-1.5 border-r border-black font-mono font-bold">{{ item.productId }}</td>
              <td class="py-0.5 px-1.5 border-r border-black font-semibold">{{ item.description }}</td>
              <td class="py-0.5 px-1.5 border-r border-black text-[8px]">{{ item.supplierName || '-' }}</td>
              <td class="py-0.5 px-1.5 border-r border-black text-[8px]">{{ item.palletTypeLabel }}</td>
              <td class="py-0.5 px-1.5 border-r border-black font-mono text-center font-bold">{{ formatDateDMY(item.expirationDate || reception.expirationDate) }}</td>
              <td class="py-0.5 px-1.5 border-r border-black text-right font-black font-mono">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              <td class="py-0.5 px-1.5 italic text-slate-600 text-[8px]">{{ item.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="flex justify-between items-center text-[10px] font-bold border-b-2 border-black pb-1 mb-3 bg-slate-100 px-2.5 py-1 rounded uppercase">
        <div>TOTAL TARIMAS: <span class="font-mono font-black text-xs">{{ totalPallets }}</span></div>
        <div>TOTAL PIEZAS: <span class="font-mono font-black text-xs">{{ totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer: Capturó + Firma de Conformidad -->
      <div class="grid grid-cols-2 gap-10 items-end text-[9.5px] pt-1 uppercase">
        <div>
          <p class="font-bold text-slate-800">CAPTURÓ: <span class="font-black text-black">{{ capturedByName }}</span></p>
          <p class="text-[7.5px] text-slate-500 font-sans tracking-wide">Documento auditado oficial 4GUARD WMS</p>
        </div>

        <div class="text-center">
          <div class="border-b-2 border-black w-full mb-1"></div>
          <p class="font-black text-[9px] tracking-widest uppercase text-slate-950">FIRMA DE CONFORMIDAD</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    @media print {
      .print-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
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

  get totalPallets(): number {
    return this.reception?.pallets?.length || 0;
  }

  get totalPieces(): number {
    return this.reception?.pallets?.reduce((acc, p) => acc + p.pieces, 0) || 0;
  }

  get capturedByName(): string {
    return (
      this.reception?.capturedBy ||
      this.reception?.leaderAuthorizedBy ||
      this.authState.userFullName() ||
      this.authState.currentUser()?.fullName ||
      'OPERADOR WMS'
    ).toUpperCase();
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
}

