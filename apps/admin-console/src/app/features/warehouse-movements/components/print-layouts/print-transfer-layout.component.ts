/**
 * @file print-transfer-layout.component.ts
 * @description Formato de impresión "Cambio de Almacén" homologado con el diseño oficial de Recepción y Salidas WMS.
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WarehouseTransfer } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-transfer-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="transfer" class="print-container bg-white text-black p-5 sm:p-6 max-w-full mx-auto font-sans border rounded-lg shadow-sm"
         [ngClass]="transfer.status === 'CANCELLED' ? 'border-2 border-rose-600' : 'border-slate-300'">
      
      <!-- ═══════════════════════════════════════════════════════════
           CASO 1: TRASPASO CANCELADO / REVOCADO DE AUDITORÍA
           ═══════════════════════════════════════════════════════════ -->
      <ng-container *ngIf="transfer.status === 'CANCELLED'; else completedLayout">
        
        <!-- Header Advertencia Cancelación -->
        <div class="bg-rose-600 text-white p-2.5 sm:p-3 rounded-md mb-3 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2.5">
            <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-8 sm:h-9 w-auto max-w-[40px] sm:max-w-[46px] object-contain rounded bg-white p-1" />
            <div>
              <h1 class="text-xs sm:text-sm md:text-base font-black tracking-wider uppercase leading-tight">HOJA DE CANCELACIÓN DE CAMBIO DE ALMACÉN</h1>
              <p class="text-[9px] sm:text-[10px] font-semibold opacity-95">Compuerta de Seguridad / Revocación de Reubicación de Inventario</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-[9px] font-bold uppercase block opacity-90">FECHA CANCELACIÓN</span>
            <span class="text-xs font-mono font-black">{{ transfer.cancelledAt || printDate }}</span>
          </div>
        </div>

        <!-- Grid Metadata de Cancelación (2 Columnas Estructuradas) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] sm:text-[11px] mb-3 bg-rose-50/90 p-2.5 border border-rose-200 rounded-md">
          
          <!-- Columna Izquierda -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FOLIO TRASPASO:</span>
              <span class="font-mono font-bold text-rose-700 text-xs sm:text-sm">#{{ transfer.folio }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FECHA REGISTRO:</span>
              <span class="font-medium text-slate-900">{{ transfer.transferredAt }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA:</span>
              <span class="font-bold text-slate-900">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</span>
            </div>
            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">REGISTRADO POR:</span>
              <span class="font-medium text-slate-900">{{ transfer.transferredBy || capturedByName }}</span>
            </div>
          </div>

          <!-- Columna Derecha -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">AUTORIZADO / CANCELADO POR:</span>
              <span class="font-bold text-rose-900">{{ transfer.cancelledBy || capturedByName }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA ORIGEN (RESTITUIDA):</span>
              <span class="font-mono font-bold text-emerald-800">{{ transfer.originLocation }}</span>
            </div>
            <div class="flex justify-between items-start gap-2 border-b border-rose-200/80 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA DESTINO (REVOCADA):</span>
              <span class="font-mono font-bold text-rose-700 line-through">{{ transfer.destinationLocation }}</span>
            </div>
            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">ESTADO OPERATIVO:</span>
              <span class="font-bold text-rose-700 uppercase">CANCELADO / REVERTIDO</span>
            </div>
          </div>
        </div>

        <!-- Motivo de Cancelación -->
        <div class="mb-3 bg-slate-50 p-2 border border-slate-200 rounded-md text-[10.5px]">
          <span class="font-bold text-slate-700 block text-[9.5px] uppercase tracking-wider mb-0.5">MOTIVO / JUSTIFICACIÓN DE LA CANCELACIÓN:</span>
          <p class="text-rose-900 font-medium italic border-l-3 border-rose-500 pl-2 py-0.5 bg-white rounded-r text-[11px]">
            "{{ transfer.cancellationReason || 'Cancelación extraordinaria por corrección operativa o autorización de supervisor.' }}"
          </p>
        </div>

        <!-- Matriz de Ubicaciones -->
        <div class="grid grid-cols-2 gap-3 mb-3 text-center text-xs">
          <div class="bg-emerald-50 p-2 rounded border border-emerald-200">
            <span class="text-[9.5px] text-emerald-800 uppercase font-bold block">Bahía Origen (Stock Restaurado)</span>
            <span class="text-xl font-mono font-black text-emerald-900">{{ transfer.originLocation }}</span>
            <span class="text-[8.5px] text-emerald-700 font-bold block">INVENTARIO REINTEGRADO</span>
          </div>
          <div class="bg-slate-100 p-2 rounded border border-slate-300">
            <span class="text-[9.5px] text-slate-600 uppercase font-bold block">Bahía Destino (Movimiento Revocado)</span>
            <span class="text-xl font-mono font-black text-slate-500 line-through">{{ transfer.destinationLocation }}</span>
            <span class="text-[8.5px] text-rose-600 font-bold block">LIBERADA / SIN CARGO</span>
          </div>
        </div>

        <!-- Tabla de Tarimas Revertidas -->
        <div class="mb-2.5 border border-black rounded-sm overflow-hidden">
          <table class="w-full text-left text-[9.5px] sm:text-[10px] border-collapse font-sans">
            <thead>
              <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
                <th class="py-1 px-2 border-r border-black text-center w-10">N. TARIMA</th>
                <th class="py-1 px-2 border-r border-black font-mono">CÓDIGO TARIMA</th>
                <th class="py-1 px-2 border-r border-black font-mono">SKU</th>
                <th class="py-1 px-2 border-r border-black">DESCRIPCIÓN DE PRODUCTO</th>
                <th class="py-1 px-2 border-r border-black text-right">PIEZAS</th>
                <th class="py-1 px-2 text-center">ESTATUS FÍSICO</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="transfer.pallets && transfer.pallets.length > 0; else defaultCancelledRows">
                <tr *ngFor="let item of transfer.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ item.palletNumber || (idx + 1) }}</td>
                  <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">{{ item.palletCode }}</td>
                  <td class="py-1 px-2 border-r border-black font-mono font-bold">{{ item.productId || '12572733' }}</td>
                  <td class="py-1 px-2 border-r border-black font-semibold">{{ item.description || 'ALIMENTO BALANCEADO PURINA' }}</td>
                  <td class="py-1 px-2 border-r border-black text-right font-black font-mono">{{ item.pieces | number:'1.0-0' }} PZAS</td>
                  <td class="py-1 px-2 text-center">
                    <span class="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px]">REVERTIDO</span>
                  </td>
                </tr>
              </ng-container>
              <ng-template #defaultCancelledRows>
                <tr *ngFor="let i of [1,2,3,4,5].slice(0, transfer.totalPallets || 5); let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ idx + 1 }}</td>
                  <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">UA-{{ 104000 + idx + 1 }}</td>
                  <td class="py-1 px-2 border-r border-black font-mono font-bold">12572733</td>
                  <td class="py-1 px-2 border-r border-black font-semibold">ALIMENTO BALANCEADO PURINA</td>
                  <td class="py-1 px-2 border-r border-black text-right font-black font-mono">45 PZAS</td>
                  <td class="py-1 px-2 text-center">
                    <span class="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[9px]">REVERTIDO</span>
                  </td>
                </tr>
              </ng-template>
            </tbody>
          </table>
        </div>

        <!-- Totales Restaurados -->
        <div class="flex justify-between items-center text-[10px] sm:text-[11px] font-bold border-b-2 border-rose-600 pb-1 mb-3 bg-rose-50/70 px-3 py-1 rounded">
          <div>TOTAL TARIMAS RESTAURADAS: <span class="font-mono font-black text-xs text-rose-900">{{ transfer.totalPallets || 5 }}</span></div>
          <div>TOTAL PIEZAS RESTITUIDAS: <span class="font-mono font-black text-xs text-rose-900">{{ (transfer.totalPieces || 225) | number:'1.0-0' }} PZAS</span></div>
        </div>

        <!-- Footer Firmas Cancelación -->
        <div class="grid grid-cols-3 gap-6 items-end text-[9.5px] sm:text-[10px] pt-1.5">
          <div class="text-left">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Montacarguista Notificado</p>
          </div>
          <div class="text-center">
            <div class="border-b border-rose-600 w-full mb-1"></div>
            <p class="font-bold text-rose-900">{{ transfer.cancelledBy || capturedByName }}</p>
            <p class="text-[8px] text-rose-600 font-bold uppercase tracking-wide">Autorizó Cancelación</p>
          </div>
          <div class="text-right">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">Auditoría / Control WMS</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Seguridad y Validación</p>
          </div>
        </div>

      </ng-container>

      <!-- ═══════════════════════════════════════════════════════════
           CASO 2: TRASPASO COMPLETADO (ESTÁNDAR HOMOLOGADO)
           ═══════════════════════════════════════════════════════════ -->
      <ng-template #completedLayout>
        
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
        <div class="text-center mb-3">
          <h2 class="text-sm sm:text-base font-black uppercase tracking-wider text-black border-y border-black py-1 inline-block px-8">
            COMPROBANTE OFICIAL DE CAMBIO DE ALMACÉN
          </h2>
        </div>

        <!-- Header Grid Metadata: 2 Columnas Estructuradas Homologadas -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] sm:text-[11px] mb-3 border border-black p-3 rounded-sm bg-slate-50/50">
          
          <!-- Columna Izquierda: Logística del Movimiento -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">NO. MOVIMIENTO (FOLIO):</span>
              <span class="font-black text-xs sm:text-sm font-mono text-black text-right flex-1 min-w-0">#{{ transfer.folio }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">FECHA Y HORA DE TRASPASO:</span>
              <span class="font-medium text-black text-right flex-1 min-w-0">{{ transfer.transferredAt }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA RESPONSABLE:</span>
              <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2">
              <span class="font-bold text-slate-700 shrink-0">USUARIO REGISTRADOR:</span>
              <span class="font-semibold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ transfer.transferredBy || capturedByName }}</span>
            </div>
          </div>

          <!-- Columna Derecha: Motivo & Ubicaciones -->
          <div class="space-y-1">
            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">MOTIVO DE REUBICACIÓN:</span>
              <span class="font-bold text-amber-800 text-right break-words flex-1 min-w-0">{{ transfer.reasonLabel || 'Reubicación operativa' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">OBSERVACIONES:</span>
              <span class="font-medium text-slate-800 italic text-right break-words flex-1 min-w-0">{{ transfer.observations || 'Sin observaciones' }}</span>
            </div>

            <div class="flex justify-between items-start gap-2 border-b border-slate-200 pb-0.5">
              <span class="font-bold text-slate-700 shrink-0">BAHÍA ORIGEN:</span>
              <span class="font-mono font-bold text-amber-900 text-right flex-1 min-w-0">{{ transfer.originLocation }}</span>
            </div>

            <div class="flex justify-between items-center gap-2 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <span class="font-bold text-[9.5px] uppercase text-emerald-900 shrink-0">BAHÍA DESTINO (ACTUAL):</span>
              <span class="font-mono font-black text-[10.5px] text-emerald-950 text-right break-words flex-1 min-w-0">{{ transfer.destinationLocation }}</span>
            </div>
          </div>

        </div>

        <!-- Matriz Visual de Reubicación -->
        <div class="grid grid-cols-2 gap-3 mb-3 text-center text-xs">
          <div class="bg-amber-500/10 p-2 rounded border border-amber-500/30">
            <span class="text-[9.5px] text-amber-800 uppercase font-bold block">Bahía Origen (Desocupada)</span>
            <span class="text-xl font-mono font-black text-amber-900">{{ transfer.originLocation }}</span>
          </div>
          <div class="bg-emerald-500/10 p-2 rounded border border-emerald-500/30">
            <span class="text-[9.5px] text-emerald-800 uppercase font-bold block">Bahía Destino (Ubicación Final)</span>
            <span class="text-xl font-mono font-black text-emerald-900">{{ transfer.destinationLocation }}</span>
          </div>
        </div>

        <!-- Tabla de Tarimas (Detalle Oficial) -->
        <div class="mb-2.5 border border-black rounded-sm overflow-hidden">
          <table class="w-full text-left text-[9.5px] sm:text-[10px] border-collapse font-sans">
            <thead>
              <tr class="border-b border-black font-bold uppercase bg-slate-100 text-slate-900">
                <th class="py-1 px-2 border-r border-black text-center w-10">N. TARIMA</th>
                <th class="py-1 px-2 border-r border-black font-mono">CÓDIGO TARIMA</th>
                <th class="py-1 px-2 border-r border-black font-mono">SKU</th>
                <th class="py-1 px-2 border-r border-black">DESCRIPCIÓN DE PRODUCTO</th>
                <th class="py-1 px-2 border-r border-black">TIPO TARIMA</th>
                <th class="py-1 px-2 text-right">CANT X TARIMA</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngIf="transfer.pallets && transfer.pallets.length > 0; else defaultPallets">
                <tr *ngFor="let item of transfer.pallets; let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ item.palletNumber || (idx + 1) }}</td>
                  <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">{{ item.palletCode }}</td>
                  <td class="py-1 px-2 border-r border-black font-mono font-bold">{{ item.productId || '12572733' }}</td>
                  <td class="py-1 px-2 border-r border-black font-semibold">{{ item.description || 'ALIMENTO BALANCEADO PURINA' }}</td>
                  <td class="py-1 px-2 border-r border-black uppercase text-[9px]">{{ item.palletTypeLabel || 'Estándar' }}</td>
                  <td class="py-1 px-2 text-right font-black font-mono">{{ item.pieces | number:'1.0-0' }} PZAS</td>
                </tr>
              </ng-container>
              <ng-template #defaultPallets>
                <tr *ngFor="let i of [1,2,3,4,5].slice(0, transfer.totalPallets || 5); let idx = index" class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="py-1 px-2 border-r border-black text-center font-bold font-mono">{{ idx + 1 }}</td>
                  <td class="py-1 px-2 border-r border-black font-bold font-mono text-slate-900">UA-{{ 104000 + idx + 1 }}</td>
                  <td class="py-1 px-2 border-r border-black font-mono font-bold">12572733</td>
                  <td class="py-1 px-2 border-r border-black font-semibold">ALIMENTO BALANCEADO PURINA</td>
                  <td class="py-1 px-2 border-r border-black uppercase text-[9px]">Estándar</td>
                  <td class="py-1 px-2 text-right font-black font-mono">45 PZAS</td>
                </tr>
              </ng-template>
            </tbody>
          </table>
        </div>

        <!-- Totales -->
        <div class="flex justify-between items-center text-[10px] sm:text-[11px] font-bold border-b-2 border-black pb-1 mb-3 bg-slate-100/60 px-3 py-1 rounded">
          <div>TOTAL TARIMAS: <span class="font-mono font-black text-xs">{{ transfer.totalPallets || 5 }}</span></div>
          <div>SKUS DISTINTOS: <span class="font-mono font-black text-xs">{{ transfer.distinctSkus || 1 }}</span></div>
          <div>TOTAL PIEZAS: <span class="font-mono font-black text-xs">{{ (transfer.totalPieces || 225) | number:'1.0-0' }} PZAS</span></div>
        </div>

        <!-- Footer: Responsables + Firmas -->
        <div class="grid grid-cols-3 gap-6 items-end text-[9.5px] sm:text-[10px] pt-1.5">
          <div class="text-left">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">{{ transfer.forkliftOperator || 'Operador de Montacargas' }}</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Montacarguista Responsable</p>
          </div>
          <div class="text-center">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">{{ transfer.transferredBy || capturedByName }}</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Operador WMS / Registro</p>
          </div>
          <div class="text-right">
            <div class="border-b border-black w-full mb-1"></div>
            <p class="font-bold text-slate-900">Supervisor de Turno</p>
            <p class="text-[8px] text-slate-500 uppercase tracking-wide">Autorización y Control</p>
          </div>
        </div>

      </ng-template>

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
export class PrintTransferLayoutComponent {
  @Input() transfer!: WarehouseTransfer;
  protected readonly authState = inject(AuthState);

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get capturedByName(): string {
    return (
      this.authState.userFullName() ||
      this.authState.currentUser()?.fullName ||
      this.authState.currentUser()?.username ||
      'OPERADOR WMS'
    );
  }
}
