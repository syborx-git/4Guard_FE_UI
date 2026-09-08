import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-black p-5 sm:p-6 max-w-full mx-auto font-sans border border-slate-300 rounded-lg shadow-sm">
      
      <!-- Top Header & Logo Institucional -->
      <div class="flex justify-between items-center mb-3 pb-2 border-b-2 border-black">
        <div class="flex items-center gap-3">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-9 w-auto max-w-[44px] object-contain rounded" />
          <div>
            <h1 class="text-base font-black tracking-tight text-black leading-none mb-1">4-GUARD WMS</h1>
            <p class="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Industria Automotriz 128, Toluca de Lerdo, Méx</p>
          </div>
        </div>

        <div class="text-right">
          <span class="text-[10px] font-bold text-slate-700 block">FECHA DE IMPRESIÓN</span>
          <span class="text-xs font-mono font-black text-black">{{ printDate }}</span>
        </div>
      </div>

      <!-- Main Title -->
      <div class="text-center mb-3.5">
        <h2 class="text-sm sm:text-base font-black uppercase tracking-wider text-black border-y border-black py-1 inline-block px-8">
          PAUTA DE RECEPCIÓN DE MERCANCÍA
        </h2>
      </div>

      <!-- Header Grid Metadata: 2 Columnas Estructuradas con Espacio Adecuado y Responsive -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] sm:text-[11px] mb-3.5 border border-black p-3 rounded-sm bg-slate-50/50">
        
        <!-- Columna Izquierda: Logística & Transporte -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. RECEPCIÓN:</span>
            <span class="font-black text-xs sm:text-sm font-mono text-black text-right flex-1 min-w-0">#{{ reception.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA RECEPCIÓN:</span>
            <span class="font-medium text-black text-right flex-1 min-w-0">{{ reception.createdAt }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.checkIn.carrierLine }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">OPERADOR / CHOFER:</span>
            <span class="font-medium text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.checkIn.driverName || '-' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.checkIn.tractorPlates || '-' }} / {{ reception.checkIn.boxPlates || '-' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2">
            <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA / RAMPA:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.checkIn.forkliftOperator }} (Rampa {{ reception.checkIn.rampNumber }})</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Cliente & Almacenaje -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. DOCUMENTO / REMISIÓN:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ reception.checkIn.docNumber }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA DOC / CADUCIDAD:</span>
            <span class="font-medium text-black text-right break-words flex-1 min-w-0">{{ reception.checkIn.docDate }} / {{ reception.expirationDate || 'N/A' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">CLIENTE:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.checkIn.client }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LOTE DE PRODUCTO:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ reception.lotNumber || 'N/A' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LUGAR DE ALMACENAJE:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ reception.storageLocation || 'Bodega Principal' }}</span>
          </div>

          <div class="flex justify-between items-center gap-2 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200/80">
            <span class="font-bold text-[9.5px] uppercase text-amber-900 shrink-0">SELLOS DE SEGURIDAD:</span>
            <span class="font-mono font-black text-[10.5px] text-amber-950 text-right break-words flex-1 min-w-0">{{ reception.checkIn.sealNumber || 'N/A' }}</span>
          </div>
        </div>

      </div>

      <!-- Tabla de Tarimas (Detalle Oficial) -->
      <div class="mb-3 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[9.5px] sm:text-[10px] border-collapse font-sans">
          <thead>
            <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
              <th class="py-1 px-2 border-r border-black text-center w-10">N. TARIMA</th>
              <th class="py-1 px-2 border-r border-black font-mono">CÓDIGO TARIMA</th>
              <th class="py-1 px-2 border-r border-black font-mono">SKU</th>
              <th class="py-1 px-2 border-r border-black">DESCRIPCIÓN</th>
              <th class="py-1 px-2 border-r border-black">PROVEEDOR</th>
              <th class="py-1 px-2 border-r border-black">TIPO TARIMA</th>
              <th class="py-1 px-2 border-r border-black text-right">CANT X TARIMA</th>
              <th class="py-1 px-2">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
              <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">{{ item.palletCode }}</td>
              <td class="py-1 px-2 border-r border-black font-mono font-bold">{{ item.productId }}</td>
              <td class="py-1 px-2 border-r border-black font-semibold">{{ item.description }}</td>
              <td class="py-1 px-2 border-r border-black uppercase text-[9px]">{{ item.supplierName || '-' }}</td>
              <td class="py-1 px-2 border-r border-black uppercase text-[9px]">{{ item.palletTypeLabel }}</td>
              <td class="py-1 px-2 border-r border-black text-right font-black font-mono">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              <td class="py-1 px-2 italic text-slate-600 text-[8.5px]">{{ item.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="flex justify-between items-center text-[10.5px] sm:text-xs font-bold border-b-2 border-black pb-1.5 mb-4 bg-slate-100/60 px-3 py-1.5 rounded">
        <div>TOTAL TARIMAS: <span class="font-mono font-black text-sm">{{ totalPallets }}</span></div>
        <div>TOTAL PIEZAS: <span class="font-mono font-black text-sm">{{ totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer: Capturó + Firma de Conformidad -->
      <div class="grid grid-cols-2 gap-12 items-end text-[10px] sm:text-[11px] pt-2">
        <div>
          <p class="font-bold text-slate-800">CAPTURÓ: <span class="font-black uppercase text-black">{{ capturedByName }}</span></p>
          <p class="text-[8px] text-slate-500 font-sans tracking-wide">Documento auditado oficial 4GUARD WMS</p>
        </div>

        <div class="text-center">
          <div class="border-b-2 border-black w-full mb-1.5"></div>
          <p class="font-black text-[9px] sm:text-[10px] tracking-widest uppercase text-slate-900">FIRMA DE CONFORMIDAD</p>
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
    );
  }
}
