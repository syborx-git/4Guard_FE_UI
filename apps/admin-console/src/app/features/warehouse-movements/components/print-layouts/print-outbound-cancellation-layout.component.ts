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
    <div *ngIf="outbound" class="print-container bg-white text-slate-900 max-w-[800px] mx-auto font-sans border-2 border-rose-600 rounded-sm shadow-sm select-none"
         [ngClass]="densityMode === 'ultra-compact' ? 'p-2 sm:p-2.5 text-[7px] leading-tight' : (densityMode === 'compact' ? 'p-3 sm:p-3.5 text-[8px] leading-tight' : 'p-4 sm:p-5 text-[9.5px] leading-normal')">
      
      <!-- Header Advertencia Cancelación -->
      <div class="bg-rose-600 text-white rounded-md flex items-center justify-between shadow-xs"
           [ngClass]="densityMode === 'ultra-compact' ? 'p-1.5 mb-1.5' : (densityMode === 'compact' ? 'p-2 mb-2' : 'p-2.5 sm:p-3 mb-3')">
        <div class="flex items-center gap-2.5">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="w-auto object-contain rounded bg-white p-0.5"
               [ngClass]="densityMode === 'ultra-compact' ? 'h-6 max-w-[30px]' : 'h-8 sm:h-9 max-w-[40px] sm:max-w-[46px]'" />
          <div>
            <h1 class="font-black tracking-wider uppercase leading-tight" [ngClass]="densityMode === 'ultra-compact' ? 'text-[10px]' : 'text-xs sm:text-sm md:text-base'">HOJA DE CANCELACIÓN DE SALIDA DE ALMACÉN</h1>
            <p class="font-semibold opacity-95" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9px] sm:text-[10px]'">Compuerta de Seguridad / Revocación de Despacho Outbound</p>
          </div>
        </div>
        <div class="text-right">
          <span class="font-bold opacity-90 block uppercase" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[9px]'">FECHA CANCELACIÓN</span>
          <span class="font-mono font-black" [ngClass]="densityMode === 'ultra-compact' ? 'text-[9.5px]' : 'text-xs'">{{ outbound.cancelledAt || printDate }}</span>
        </div>
      </div>

      <!-- Datos Generales (Grid 2 Columnas Homologado) -->
      <div class="grid grid-cols-2 gap-x-4 bg-rose-50/90 border border-rose-200 rounded-md"
           [ngClass]="densityMode === 'ultra-compact' ? 'gap-y-0.5 text-[7.5px] mb-1.5 p-1.5' : (densityMode === 'compact' ? 'gap-y-1 text-[9px] mb-2 p-2' : 'gap-y-1.5 text-[11px] mb-3 p-2.5')"
           style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">No. Salida (Folio):</span>
          <span class="font-mono font-bold text-rose-700" [ngClass]="densityMode === 'ultra-compact' ? 'text-[9px]' : 'text-xs sm:text-sm'">#{{ outbound.folio }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Fecha Despacho Original:</span>
          <span class="font-medium text-slate-900">{{ outbound.dispatchedAt || printDate }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Cliente Propietario:</span>
          <span class="font-medium text-slate-900 block leading-snug pb-[1px] break-words">{{ outbound.clientName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Destino / Planta:</span>
          <span class="font-medium text-slate-900 block leading-snug pb-[1px] break-words">{{ outbound.destinationName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Línea Transportista:</span>
          <span class="font-medium text-slate-900 block leading-snug pb-[1px] break-words">{{ outbound.carrierName }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">No. Remisión / Documento:</span>
          <span class="font-mono font-bold text-slate-900">{{ outbound.remisionNo || 'N/A' }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Sello Oficial Anulado:</span>
          <span class="font-mono font-bold text-rose-800 line-through">🔒 {{ outbound.sealNumber }}</span>
        </div>
        <div>
          <span class="font-bold text-slate-600 block" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Estatus de Inventario:</span>
          <span class="font-bold text-rose-700 uppercase">REVERTIDO A STOCK DISPONIBLE</span>
        </div>
        <div class="col-span-2 pt-0.5 border-t border-rose-200/60">
          <span class="font-bold text-slate-600 inline" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px]'">Autorizado Por Administrador: </span>
          <span class="font-black text-rose-900 uppercase">{{ outbound.cancelledBy || capturedByName }}</span>
        </div>
      </div>

      <!-- Motivo de Cancelación -->
      <div class="bg-slate-50 border border-slate-200 rounded-md"
           [ngClass]="densityMode === 'ultra-compact' ? 'mb-1 p-1 text-[7.5px]' : (densityMode === 'compact' ? 'mb-2 p-1.5 text-[9px]' : 'mb-3 p-2.5 text-[11px]')">
        <span class="font-bold text-slate-700 block uppercase tracking-wider" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[10px] mb-0.5'">Motivo / Justificación de Cancelación:</span>
        <p class="text-rose-900 font-medium italic border-l-3 border-rose-500 pl-2 bg-white rounded-r" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] py-0' : 'text-xs py-0.5'">
          "{{ outbound.cancellationReason || 'Cancelación extraordinaria por corrección operativa o autorización de supervisor.' }}"
        </p>
      </div>

      <!-- Resumen de UAs Restituidas -->
      <div [ngClass]="densityMode === 'ultra-compact' ? 'mb-1' : 'mb-3'">
        <h3 class="font-bold text-slate-700 mb-0.5 uppercase tracking-wider" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7px]' : 'text-[10px]'">Unidades de Almacenamiento (UAs) Reintegradas a Stock:</h3>
        <div class="overflow-x-auto rounded border border-slate-200">
          <table class="w-full text-left border-collapse font-sans uppercase"
               [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px] leading-tight' : (densityMode === 'compact' ? 'text-[7.8px] leading-tight' : 'text-[8.5px] leading-normal')">
            <thead>
              <tr class="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                <th class="w-6 text-center" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">N.</th>
                <th class="font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">Código UA</th>
                <th class="font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">SKU</th>
                <th [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">Descripción</th>
                <th class="font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">Lote</th>
                <th class="text-right font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">Piezas</th>
                <th class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'py-0.5 px-1' : 'py-1.5 px-2'">Estatus</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of outbound.items; let idx = index" class="border-b border-slate-100 hover:bg-slate-50/80">
                <td class="text-center font-bold font-mono" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ idx + 1 }}</td>
                <td class="font-mono font-bold text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ item.palletCode }}</td>
                <td class="font-mono text-slate-700 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ item.productId }}</td>
                <td class="text-slate-800 font-medium leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ item.description }}</td>
                <td class="font-mono text-slate-700 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ item.lotNumber }}</td>
                <td class="text-right font-mono font-bold text-slate-900 whitespace-nowrap" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">{{ item.pieces | number:'1.0-0' }} pz</td>
                <td class="text-center" [ngClass]="densityMode === 'ultra-compact' ? 'py-[0.5px] px-1' : 'py-1 px-2'">
                  <span class="inline-block rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300" [ngClass]="densityMode === 'ultra-compact' ? 'px-1 py-0 text-[6px]' : 'px-2 py-0.5 text-[9px]'">
                    DISPONIBLE
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Totales Revertidos -->
      <div class="flex justify-between items-center font-bold border-b-2 border-rose-600 bg-rose-50/70 rounded"
           [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px] px-2 py-0.5 mb-1' : (densityMode === 'compact' ? 'text-[9px] px-2.5 py-0.5 mb-2' : 'text-[10.5px] sm:text-xs px-3 py-1.5 mb-3')">
        <div>TOTAL TARIMAS RESTAURADAS: <span class="font-mono font-black text-rose-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-sm'">{{ outbound.totalPallets }}</span></div>
        <div>TOTAL PIEZAS RESTITUIDAS: <span class="font-mono font-black text-rose-900" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8.5px]' : 'text-sm'">{{ outbound.totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer Firmas -->
      <div class="border-t border-slate-200 grid grid-cols-2 gap-8 items-end"
           [ngClass]="densityMode === 'ultra-compact' ? 'mt-1 pt-1 text-[7.5px]' : 'mt-4 pt-3 text-[10px]'">
        <div>
          <p class="font-bold text-slate-900 leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'text-[8px]' : 'text-[11px]'">AUTORIZÓ: <span class="font-black uppercase text-rose-900">{{ outbound.cancelledBy || capturedByName }}</span></p>
          <p class="text-slate-400 leading-snug" [ngClass]="densityMode === 'ultra-compact' ? 'text-[6.5px]' : 'text-[9px]'">Documento oficial de cancelación y revocación 4GUARD WMS</p>
        </div>
        <div class="text-center">
          <div class="border-b-2 border-slate-800 w-full mb-1"></div>
          <p class="font-bold uppercase tracking-widest text-slate-800 leading-snug pb-[1px]" [ngClass]="densityMode === 'ultra-compact' ? 'text-[7.5px]' : 'text-[9px] sm:text-[10px]'">FIRMA DEL SUPERVISOR / ADMIN</p>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
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

  get densityMode(): 'normal' | 'compact' | 'ultra-compact' {
    const count = this.outbound?.items?.length || this.outbound?.totalPallets || 0;
    if (count > 30) return 'ultra-compact';
    if (count > 16) return 'compact';
    return 'normal';
  }

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get capturedByName(): string {
    return this.authState.userFullName() || this.authState.currentUser()?.fullName || 'Administrador WMS';
  }
}
