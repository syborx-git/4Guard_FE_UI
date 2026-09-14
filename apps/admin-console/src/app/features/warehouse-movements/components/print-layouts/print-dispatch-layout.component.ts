/**
 * @file print-dispatch-layout.component.ts
 * @description Formato de impresión oficial "SALIDA DE MERCANCIA / REMISION WMS".
 * 100% fiel al formato físico industrial oficial de 4GUARD WMS.
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
    <div *ngIf="outbound" class="print-container bg-white text-black p-4 sm:p-6 max-w-[900px] mx-auto font-sans text-xs border border-slate-300 rounded shadow-sm">
      
      <!-- ── CABECERA SUPERIOR INSTITUCIONAL ── -->
      <div class="flex justify-between items-start pb-2 border-b border-black">
        <!-- Logo 4-GUARD -->
        <div class="w-44 flex items-center">
          <img src="/assets/logo-4guard.svg" alt="4-GUARD Logo" class="h-14 w-auto object-contain" />
        </div>

        <!-- Dirección Central y Título Oficial -->
        <div class="flex-1 text-center px-2">
          <p class="text-[9.5px] font-semibold text-black uppercase tracking-tight">
            Industria Automotriz 128, Delegación Santa María Totoltepec, 50200 Toluca de Lerdo, Méx
          </p>
          <h1 class="text-xl sm:text-2xl font-black uppercase tracking-wider text-black mt-1 font-sans">
            SALIDA DE MERCANCIA
          </h1>
        </div>

        <!-- Fecha de Impresión -->
        <div class="w-44 text-right">
          <p class="text-[10px] font-bold text-black uppercase">
            FECHA DE IMPRESIÓN: <span class="font-normal font-mono">{{ printDate }}</span>
          </p>
        </div>
      </div>

      <!-- ── METADATA LOGÍSTICA (3 BLOQUES HOMOLOGADOS AL FORMATO FÍSICO) ── -->
      <div class="grid grid-cols-12 gap-3 my-3 text-[10px] uppercase font-sans text-black leading-tight">
        
        <!-- Columna 1: Logística, Transporte & Chofer (Span 6) -->
        <div class="col-span-6 space-y-1">
          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">FECHA:</span>
            <span class="font-mono font-medium">{{ outbound.dispatchedAt || printDate }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">CLIENTE:</span>
            <span class="font-bold flex-1 min-w-0">{{ outbound.clientName }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">TRANSPORTA:</span>
            <span class="font-bold flex-1 min-w-0">{{ outbound.carrierName }}</span>
          </div>

          <div class="flex items-start justify-between">
            <div class="flex items-center">
              <span class="w-32 font-bold shrink-0">PLACAS:</span>
              <span class="font-mono font-bold">{{ outbound.tractorPlates || '-' }}</span>
            </div>
            <div class="flex items-center pl-2">
              <span class="font-bold mr-1">CAJA:</span>
              <span class="font-mono font-bold">{{ outbound.boxPlates || '-' }}</span>
            </div>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">N. ECONÓMICO :</span>
            <span class="font-mono font-bold">{{ outbound.economicNumber || '-' }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">TIPO :</span>
            <span class="font-bold">{{ formatTransportType(outbound.transportType).toUpperCase() }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">OPERADOR :</span>
            <span class="font-bold flex-1 min-w-0">{{ outbound.driverName || '-' }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">DESTINO :</span>
            <span class="font-bold flex-1 min-w-0">{{ outbound.destinationName }}</span>
          </div>

          <div class="flex items-start">
            <span class="w-32 font-bold shrink-0">MONTACARGUISTA :</span>
            <span class="font-bold flex-1 min-w-0">{{ outbound.forkliftOperator || 'OPERADOR WMS' }}</span>
          </div>
        </div>

        <!-- Columna 2: Sellos de Seguridad (Span 3) -->
        <div class="col-span-3 border-l border-slate-300 pl-3">
          <span class="font-bold block mb-1 text-[10px]">SELLOS DE SEGURIDAD</span>
          <div class="flex flex-col gap-0.5 font-mono text-[9.5px]">
            @for (s of sealsList; track s) {
              <span>{{ s }}</span>
            }
          </div>
        </div>

        <!-- Columna 3: Remisión Oficial & Documento Inicial (Span 3) -->
        <div class="col-span-3 text-right">
          <div class="font-black text-sm text-black mb-1">
            REMISION: <span class="font-mono font-black">{{ formattedRemisionFolio }}</span>
          </div>
          
          <span class="font-bold text-[9.5px] block mt-2 text-slate-800 uppercase">DOCUMENTO INICIAL</span>
          <div class="flex flex-col gap-0.5 font-mono text-[9.5px]">
            @for (doc of initialDocuments; track doc) {
              <span>{{ doc }}</span>
            }
            @if (initialDocuments.length === 0) {
              <span>--</span>
            }
          </div>
        </div>

      </div>

      <!-- ── TABLA DE SALIDA DE MERCANCÍA (FORMATO INDUSTRIAL OFICIAL) ── -->
      <div class="my-2 border-t-2 border-b-2 border-black">
        <table class="w-full text-left text-[8.5px] border-collapse font-sans">
          <thead>
            <tr class="border-b border-black font-bold uppercase text-black">
              <th class="py-1 px-1 text-center w-7">N. TARIMA</th>
              <th class="py-1 px-1 font-mono">CODIGO</th>
              <th class="py-1 px-1 font-mono">SKU</th>
              <th class="py-1 px-1">DESCRIPCIÓN</th>
              <th class="py-1 px-1 text-center font-mono">CANT X TARIMA</th>
              <th class="py-1 px-1 text-center">TIPO TARIMA</th>
              <th class="py-1 px-1 text-left">PROVEEDOR</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of outbound.items; let idx = index" class="border-b border-slate-200">
              <td class="py-0.5 px-1 text-center font-mono font-bold">{{ idx + 1 }}</td>
              <td class="py-0.5 px-1 font-mono font-bold">{{ item.palletCode }}</td>
              <td class="py-0.5 px-1 font-mono">{{ item.productId }}</td>
              <td class="py-0.5 px-1 font-medium truncate max-w-[220px]">{{ item.description }}</td>
              <td class="py-0.5 px-1 text-center font-mono font-bold">{{ item.pieces | number:'1.0-0' }} PIEZAS</td>
              <td class="py-0.5 px-1 text-center uppercase">{{ item.palletTypeLabel || item.palletTypeId || 'TARIMA CHEP' }}</td>
              <td class="py-0.5 px-1 truncate max-w-[150px] uppercase">{{ item.clientName || outbound.clientName }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── TOTALES OFICIALES (EN UNA SOLA LÍNEA EXACTA AL FORMATO) ── -->
      <div class="flex items-center gap-8 py-1 text-[11px] font-bold text-black border-b border-black mb-14">
        <div>TOTAL TARIMAS: <span class="font-mono font-black">{{ outbound.totalPallets }}</span></div>
        <div>TOTAL PZAS: <span class="font-mono font-black">{{ outbound.totalPieces | number:'1.0-0' }}</span></div>
        <div>TOTAL PRODUCTOS: <span class="font-mono font-black">{{ distinctProductsCount }}</span></div>
      </div>

      <!-- ── BLOQUE OFICIAL DE FIRMAS (ELABORÓ / RECIBE) ── -->
      <div class="grid grid-cols-2 gap-20 text-center text-[10px] mt-12 mb-6 uppercase font-sans">
        <div>
          <div class="border-b border-black w-4/5 mx-auto mb-1"></div>
          <p class="font-bold text-black tracking-wider">ELABORÓ</p>
          <p class="font-bold text-black text-[10px] mt-0.5 tracking-wide">{{ elaboroName }}</p>
        </div>
        <div>
          <div class="border-b border-black w-4/5 mx-auto mb-1"></div>
          <p class="font-bold text-black tracking-wider">RECIBE</p>
          <p class="text-slate-600 text-[9px] mt-0.5">(NOMBRE, FIRMA Y FECHA)</p>
        </div>
      </div>

      <!-- ── PIE DE PÁGINA ── -->
      <div class="text-right text-[9px] text-slate-500 font-sans mt-4">
        Page 1 of 1
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

  /**
   * Obtiene automáticamente el nombre completo del usuario que tiene la sesión activa iniciada en el sistema.
   */
  get elaboroName(): string {
    const user = this.authState.currentUser();
    const fullName = this.authState.userFullName() || user?.fullName || user?.username;
    if (fullName && fullName.trim()) {
      return fullName.trim().toUpperCase();
    }
    if (this.outbound?.dispatchedBy && this.outbound.dispatchedBy.trim()) {
      return this.outbound.dispatchedBy.trim().toUpperCase();
    }
    return 'ADMINISTRADOR WMS';
  }

  get capturedByName(): string {
    return this.elaboroName;
  }

  get formattedRemisionFolio(): string {
    if (!this.outbound) return '4GUARD-00,000';
    if (this.outbound.remisionNo && this.outbound.remisionNo.includes('4GUARD')) {
      return this.outbound.remisionNo;
    }
    if (this.outbound.folio) {
      return `4GUARD-${this.outbound.folio.replace(/^[A-Za-z]+-/, '')}`;
    }
    return this.outbound.remisionNo || '4GUARD-OFICIAL';
  }

  get sealsList(): string[] {
    if (!this.outbound?.sealNumber || this.outbound.sealNumber === 'N/A') return ['N/A'];
    return this.outbound.sealNumber.split(/[,;\s]+/).filter(Boolean);
  }

  get initialDocuments(): string[] {
    if (!this.outbound || !this.outbound.items) return [];
    const docs = new Set<string>();
    for (const it of this.outbound.items) {
      if (it.inboundRemisionNo && it.inboundRemisionNo.trim()) {
        docs.add(it.inboundRemisionNo.trim());
      }
    }
    if (docs.size === 0 && this.outbound.remisionNo) {
      docs.add(this.outbound.remisionNo);
    }
    return Array.from(docs);
  }

  get distinctProductsCount(): number {
    if (!this.outbound || !this.outbound.items) return 1;
    return new Set(this.outbound.items.map((it) => it.productId)).size;
  }

  formatTransportType(type?: TransportType): string {
    if (!type) return 'TRAILER';
    return TRANSPORT_TYPES.find((t) => t.id === type)?.label || type;
  }
}

