/**
 * @file print-dispatch-layout.component.ts
 * @description Formato de impresión oficial "Pauta de Salida de Mercancía / Despacho Outbound".
 * 100% homologado con Pauta de Recepción y Traspaso de Almacén.
 * Incluye cabecera institucional, metadata logística, tabla de tarimas despachadas, totales y 4 bloques de firmas de auditoría.
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WarehouseOutbound, TransportType, TRANSPORT_TYPES } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-dispatch-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="outbound" class="print-container bg-white text-black p-5 sm:p-6 max-w-full mx-auto font-sans border border-slate-300 rounded-lg shadow-sm">
      
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
          <span class="text-[10px] font-bold text-slate-700 block uppercase">FECHA DE IMPRESIÓN</span>
          <span class="text-xs font-mono font-black text-black">{{ printDate }}</span>
        </div>
      </div>

      <!-- Main Title -->
      <div class="text-center mb-3.5">
        <h2 class="text-sm sm:text-base font-black uppercase tracking-wider text-black border-y border-black py-1 inline-block px-8">
          PAUTA DE SALIDA DE MERCANCÍA / DESPACHO OUTBOUND
        </h2>
      </div>

      <!-- Header Grid Metadata: 2 Columnas Estructuradas Homologadas -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] sm:text-[11px] mb-3.5 border border-black p-3 rounded-sm bg-slate-50/50">
        
        <!-- Columna Izquierda: Logística & Transporte -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. SALIDA / FOLIO:</span>
            <span class="font-black text-xs sm:text-sm font-mono text-black text-right flex-1 min-w-0">#{{ outbound.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA DESPACHO:</span>
            <span class="font-medium text-black text-right flex-1 min-w-0">{{ outbound.dispatchedAt || printDate }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.carrierName }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">OPERADOR / CHOFER:</span>
            <span class="font-medium text-black text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.driverName || '-' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">
              {{ outbound.tractorPlates || '-' }} / {{ outbound.boxPlates || '-' }}
            </span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. ECONÓMICO (TRACTO / CAJA):</span>
            <span class="font-mono font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">
              {{ outbound.economicNumber || '-' }} / {{ outbound.boxEconomicNumber || '-' }}
            </span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">TIPO DE CAMIÓN:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">
              {{ formatTransportType(outbound.transportType) }}
            </span>
          </div>

          <div class="flex justify-between items-start gap-2">
            <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.forkliftOperator || 'Operador WMS' }}</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Cliente & Destino -->
        <div class="space-y-1.5">
          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">CLIENTE PROPIETARIO:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.clientName }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">PLANTA / DESTINO:</span>
            <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.destinationName }}</span>
          </div>

          @if (outbound.destinationAddress) {
            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">DIRECCIÓN DESTINO:</span>
              <span class="text-[9.5px] text-slate-700 text-right break-words flex-1 min-w-0 leading-tight">{{ outbound.destinationAddress }}</span>
            </div>
          }

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. REMISIÓN / DOC:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ outbound.remisionNo || 'REM-OFICIAL' }}</span>
          </div>

          <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LUGAR DE ORIGEN:</span>
            <span class="font-medium text-black text-right break-words flex-1 min-w-0 leading-tight">Almacén Central — Toluca</span>
          </div>

          <div class="flex justify-between items-center gap-2 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200/80">
            <span class="font-bold text-[9.5px] uppercase text-amber-900 shrink-0">NO. SELLO / CINCHO OFICIAL:</span>
            <span class="font-mono font-black text-[10.5px] text-amber-950 text-right break-words flex-1 min-w-0">🔒 {{ outbound.sealNumber || 'N/A' }}</span>
          </div>
        </div>

      </div>

      <!-- Tabla de Tarimas Despachadas (Detalle Oficial) -->
      <div class="mb-3 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[9.5px] sm:text-[10px] border-collapse font-sans">
          <thead>
            <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
              <th class="py-1 px-2 border-r border-black text-center w-10">N.</th>
              <th class="py-1 px-2 border-r border-black font-mono">CÓDIGO UA</th>
              <th class="py-1 px-2 border-r border-black font-mono">SKU</th>
              <th class="py-1 px-2 border-r border-black">DESCRIPCIÓN DE PRODUCTO</th>
              <th class="py-1 px-2 border-r border-black font-mono">LOTE</th>
              <th class="py-1 px-2 border-r border-black font-mono">CADUCIDAD</th>
              <th class="py-1 px-2 border-r border-black">TIPO TARIMA</th>
              <th class="py-1 px-2 border-r border-black font-mono">BAHÍA ORIGEN</th>
              <th class="py-1 px-2 text-right font-mono">CANT X TARIMA</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of outbound.items; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
              <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ idx + 1 }}</td>
              <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">{{ item.palletCode }}</td>
              <td class="py-1 px-2 border-r border-black font-mono font-bold">{{ item.productId }}</td>
              <td class="py-1 px-2 border-r border-black font-semibold">{{ item.description }}</td>
              <td class="py-1 px-2 border-r border-black font-mono">{{ item.lotNumber || '-' }}</td>
              <td class="py-1 px-2 border-r border-black font-mono">{{ item.expirationDate || '-' }}</td>
              <td class="py-1 px-2 border-r border-black uppercase text-[8.5px]">{{ item.palletTypeLabel || 'Estándar' }}</td>
              <td class="py-1 px-2 border-r border-black font-mono">{{ item.locationCode || 'A-01-N1' }}</td>
              <td class="py-1 px-2 text-right font-black font-mono">{{ item.pieces | number:'1.0-0' }} PZAS</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="flex justify-between items-center text-[10.5px] sm:text-xs font-bold border-b-2 border-black pb-1.5 mb-4 bg-slate-100/60 px-3 py-1.5 rounded">
        <div>TOTAL TARIMAS: <span class="font-mono font-black text-sm">{{ outbound.totalPallets }}</span></div>
        <div>TOTAL SKUS: <span class="font-mono font-black text-sm">{{ outbound.distinctSkus || 1 }}</span></div>
        <div>TOTAL PIEZAS: <span class="font-mono font-black text-sm">{{ outbound.totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer: 4 Bloques Oficiales de Firmas Homologados -->
      <div class="pt-2">
        <div class="flex justify-between items-center text-[9.5px] text-slate-600 mb-4">
          <p><span class="font-bold text-slate-800">CAPTURÓ:</span> <span class="font-black uppercase text-black">{{ outbound.dispatchedBy || capturedByName }}</span></p>
          <p class="text-[8px] text-slate-500 font-sans tracking-wide">Documento auditado oficial 4GUARD WMS</p>
        </div>

        <div class="grid grid-cols-4 gap-4 text-center text-[9px]">
          <div>
            <div class="border-b-2 border-black w-full mb-1"></div>
            <p class="font-black uppercase text-slate-900 tracking-wider">RESPONSABLE SALIDA</p>
            <p class="text-[8px] text-slate-500 truncate">{{ outbound.dispatchedBy || 'Embarques WMS' }}</p>
          </div>
          <div>
            <div class="border-b-2 border-black w-full mb-1"></div>
            <p class="font-black uppercase text-slate-900 tracking-wider">MONTACARGUISTA</p>
            <p class="text-[8px] text-slate-500 truncate">{{ outbound.forkliftOperator || 'Maniobra Física' }}</p>
          </div>
          <div>
            <div class="border-b-2 border-black w-full mb-1"></div>
            <p class="font-black uppercase text-slate-900 tracking-wider">TRANSPORTISTA / CHOFER</p>
            <p class="text-[8px] text-slate-500 truncate">{{ outbound.driverName || 'Operador de Unidad' }}</p>
          </div>
          <div>
            <div class="border-b-2 border-black w-full mb-1"></div>
            <p class="font-black uppercase text-slate-900 tracking-wider">SUPERVISOR DE ALMACÉN</p>
            <p class="text-[8px] text-slate-500">Visto Bueno Auditoría</p>
          </div>
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
export class PrintDispatchLayoutComponent {
  @Input() outbound!: WarehouseOutbound;
  protected readonly authState = inject(AuthState);

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get capturedByName(): string {
    return this.authState.userFullName() || this.authState.currentUser()?.fullName || 'Administrador WMS';
  }

  formatTransportType(type?: TransportType): string {
    if (!type) return 'Tráiler';
    return TRANSPORT_TYPES.find((t) => t.id === type)?.label || type;
  }
}
