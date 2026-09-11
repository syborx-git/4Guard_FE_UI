/**
 * @file print-outbound-cancellation-layout.component.ts
 * @description Formato de impresión "Hoja de Cancelación de Salida de Almacén" homologado al 100% con Recepción y Traspasos.
 * Incluye trazabilidad, justificación de auditoría, restablecimiento de stock y 2 bloques de firmas oficiales.
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WarehouseOutbound } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-outbound-cancellation-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="outbound" class="print-container bg-white text-slate-900 p-4 sm:p-5 max-w-full mx-auto font-sans border-2 border-rose-600 rounded-lg shadow-sm">
      
      <!-- Header Advertencia Cancelación -->
      <div class="bg-rose-600 text-white p-2.5 sm:p-3 rounded-md mb-3 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[40px] sm:max-w-[46px] object-contain rounded bg-white p-1" />
          <div>
            <h1 class="text-xs sm:text-sm md:text-base font-black tracking-wider uppercase leading-tight">HOJA DE CANCELACIÓN DE SALIDA DE ALMACÉN</h1>
            <p class="text-[9px] sm:text-[10px] font-semibold opacity-95">Compuerta de Seguridad / Revocación de Despacho Outbound</p>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[9px] font-bold opacity-90 block uppercase">FECHA CANCELACIÓN</span>
          <span class="text-xs font-mono font-black">{{ outbound.cancelledAt || printDate }}</span>
        </div>
      </div>

      <!-- Datos Generales (Grid 2 Columnas Homologado) -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-3 bg-rose-50/90 p-2.5 border border-rose-200 rounded-md">
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">No. Salida (Folio):</span>
          <span class="font-mono font-bold text-rose-700 text-xs sm:text-sm">#{{ outbound.folio }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Fecha Despacho Original:</span>
          <span class="font-medium text-slate-900">{{ outbound.dispatchedAt || printDate }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Cliente Propietario:</span>
          <span class="font-medium text-slate-900 truncate block">{{ outbound.clientName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Destino / Planta:</span>
          <span class="font-medium text-slate-900 truncate block">{{ outbound.destinationName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Línea Transportista:</span>
          <span class="font-medium text-slate-900 truncate block">{{ outbound.carrierName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">No. Remisión / Documento:</span>
          <span class="font-mono font-bold text-slate-900">{{ outbound.remisionNo || 'N/A' }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Sello Oficial Anulado:</span>
          <span class="font-mono font-bold text-rose-800 line-through">🔒 {{ outbound.sealNumber }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block text-[10px]">Estatus de Inventario:</span>
          <span class="font-bold text-rose-700 uppercase">REVERTIDO A STOCK DISPONIBLE</span>
        </div>
        <div class="col-span-2 pt-1 border-t border-rose-200/60">
          <span class="font-bold text-slate-600 inline text-[10px]">Autorizado Por Administrador: </span>
          <span class="font-black text-rose-900 uppercase">{{ outbound.cancelledBy || capturedByName }}</span>
        </div>
      </div>

      <!-- Motivo de Cancelación -->
      <div class="mb-3 bg-slate-50 p-2.5 border border-slate-200 rounded-md text-[11px]">
        <span class="font-bold text-slate-700 block text-[10px] uppercase tracking-wider mb-0.5">Motivo / Justificación de Cancelación:</span>
        <p class="text-rose-900 font-medium italic border-l-3 border-rose-500 pl-2.5 py-0.5 bg-white rounded-r text-xs">
          "{{ outbound.cancellationReason || 'Cancelación extraordinaria por corrección operativa o autorización de supervisor.' }}"
        </p>
      </div>

      <!-- Resumen de UAs Restituidas -->
      <div class="mb-3">
        <h3 class="text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">Unidades de Almacenamiento (UAs) Reintegradas a Stock:</h3>
        <div class="overflow-x-auto rounded border border-slate-200">
          <table class="w-full text-left text-[11px]">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <th class="py-1.5 px-2 w-8 text-center">N.</th>
                <th class="py-1.5 px-2 font-mono">Código UA</th>
                <th class="py-1.5 px-2 font-mono">SKU</th>
                <th class="py-1.5 px-2">Descripción</th>
                <th class="py-1.5 px-2 font-mono">Lote</th>
                <th class="py-1.5 px-2 text-right font-mono">Piezas</th>
                <th class="py-1.5 px-2 text-center">Estatus</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of outbound.items; let idx = index" class="border-b border-slate-100 hover:bg-slate-50/80">
                <td class="py-1 px-2 text-center font-bold font-mono">{{ idx + 1 }}</td>
                <td class="py-1 px-2 font-mono font-bold text-slate-900">{{ item.palletCode }}</td>
                <td class="py-1 px-2 font-mono text-slate-700">{{ item.productId }}</td>
                <td class="py-1 px-2 text-slate-800 font-medium">{{ item.description }}</td>
                <td class="py-1 px-2 font-mono text-slate-700">{{ item.lotNumber }}</td>
                <td class="py-1 px-2 text-right font-mono font-bold text-slate-900">{{ item.pieces | number:'1.0-0' }} pz</td>
                <td class="py-1 px-2 text-center">
                  <span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    DISPONIBLE
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Totales Revertidos -->
      <div class="flex justify-between items-center text-[10.5px] sm:text-xs font-bold border-b-2 border-rose-600 pb-1.5 mb-3 bg-rose-50/70 px-3 py-1.5 rounded">
        <div>TOTAL TARIMAS RESTAURADAS: <span class="font-mono font-black text-sm text-rose-900">{{ outbound.totalPallets }}</span></div>
        <div>TOTAL PIEZAS RESTITUIDAS: <span class="font-mono font-black text-sm text-rose-900">{{ outbound.totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer Firmas -->
      <div class="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-8 items-end">
        <div class="text-[10px]">
          <p class="font-bold text-slate-900 text-[11px]">AUTORIZÓ: <span class="font-black uppercase text-rose-900">{{ outbound.cancelledBy || capturedByName }}</span></p>
          <p class="text-slate-400 text-[9px]">Documento oficial de cancelación y revocación 4GUARD WMS</p>
        </div>
        <div class="text-center">
          <div class="border-b-2 border-slate-800 w-full mb-1"></div>
          <p class="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-800">FIRMA DEL SUPERVISOR / ADMIN</p>
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
export class PrintOutboundCancellationLayoutComponent {
  @Input() outbound!: WarehouseOutbound;
  protected readonly authState = inject(AuthState);

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get capturedByName(): string {
    return this.authState.userFullName() || this.authState.currentUser()?.fullName || 'Administrador WMS';
  }
}
