
/**
 * @file print-cancellation-layout.component.ts
 * @description Formato de impresión "Hoja de Cancelación y Revocación de Recepción de Almacén" (F01-CANC).
 * Cumple con el estándar corporativo ADR-015 y SDD pdf-print-export.sdd.md (1 sola hoja Carta, paridad 100% PDF/Impresión).
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-cancellation-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-slate-900 p-3 sm:p-4 max-w-full mx-auto font-sans border-2 border-rose-600 rounded-sm shadow-sm text-[8.5px] leading-tight select-none">
      
      <!-- 1. Header Institucional y Advertencia de Cancelación -->
      <div class="flex justify-between items-center mb-1 pb-1 border-b-2 border-rose-600">
        <div class="flex items-center gap-2">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-6 sm:h-7 w-auto max-w-[34px] object-contain rounded bg-white p-0.5" />
          <div>
            <h1 class="text-xs sm:text-sm font-black tracking-tight text-slate-950 leading-none mb-0.5">4-GUARD WMS</h1>
            <p class="text-[7.5px] text-slate-800 font-bold uppercase tracking-tight">
              Calle. Industria Automotriz sin número, Colonia el Coecillo, Toluca, Edo. Méx., C.P 50246.
            </p>
          </div>
        </div>

        <div class="text-right shrink-0">
          <span class="text-[8px] font-black text-slate-800 block uppercase">FECHA DE EMISIÓN</span>
          <span class="text-[10px] font-mono font-black text-slate-950">{{ printDate }}</span>
        </div>
      </div>

      <!-- 2. Título Oficial y Badge de Cancelado (Alto Contraste sin texto blanco) -->
      <div class="flex justify-between items-center mb-1.5 bg-rose-100 border border-rose-400 text-rose-950 px-3 py-1.5 rounded-sm shadow-xs">
        <div>
          <h2 class="text-xs font-black uppercase tracking-wider leading-none text-rose-950">
            HOJA DE CANCELACIÓN Y REVOCACIÓN DE RECEPCIÓN
          </h2>
          <p class="text-[8px] font-bold text-rose-900 uppercase tracking-tight mt-0.5">
            Compuerta de Seguridad / Revocación de Inventario WMS — Formato Oficial F01-CANC
          </p>
        </div>
        <div class="shrink-0">
          <span class="inline-block px-2.5 py-0.5 bg-rose-200 border border-rose-600 text-rose-950 font-mono font-black text-[9px] rounded uppercase shadow-xs">
            CANCELADO / REVOCADO
          </span>
        </div>
      </div>

      <!-- 3. Metadatos Operativos: 2 Columnas Estrictas en Pantalla e Impresión -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8.5px] mb-1.5 border border-rose-300 p-1.5 rounded-sm bg-rose-50/80 uppercase" style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
        
        <!-- Columna Izquierda: Logística & Transporte -->
        <div class="space-y-0.5">
          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">NO. RECEPCIÓN (FOLIO):</span>
            <span class="font-black text-[10px] font-mono text-rose-800 text-right flex-1 min-w-0">#{{ reception.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">FECHA Y HORA CANCELACIÓN:</span>
            <span class="font-black text-rose-950 text-right flex-1 min-w-0 font-mono">{{ cancellationDateDisplay }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-black text-slate-950 text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn?.carrierLine || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">OPERADOR / CHOFER:</span>
            <span class="font-bold text-slate-950 text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn?.driverName || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">NO. ECO (TRACTO / CAJA):</span>
            <span class="font-mono font-black text-slate-950 text-right break-words flex-1 min-w-0 leading-tight">{{ noEcoTractor.toUpperCase() }} / {{ noEcoCaja.toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-slate-950 text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn?.tractorPlates || '-').toUpperCase() }} / {{ (reception.checkIn?.boxPlates || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1">
            <span class="font-black text-slate-900 shrink-0">ESTADO DE RAMPA:</span>
            <span class="font-black text-emerald-900 text-right break-words flex-1 min-w-0 leading-tight font-mono">RAMPA {{ rampDisplay }} (LIBERADA)</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Propietario & Seguridad -->
        <div class="space-y-0.5">
          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">REMISIÓN CANCELADA:</span>
            <span class="font-black font-mono text-rose-950 text-right break-words flex-1 min-w-0">{{ displayDocSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">CLIENTE / PROPIETARIO:</span>
            <span class="font-black text-slate-950 text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn?.client || reception.supplierName || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">LOTE(S) AFECTADOS:</span>
            <span class="font-black font-mono text-slate-950 text-right break-words flex-1 min-w-0">{{ displayLotSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">FECHA(S) CADUCIDAD:</span>
            <span class="font-black font-mono text-slate-950 text-right break-words flex-1 min-w-0">{{ displayExpirationSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">ESTATUS DE INVENTARIO:</span>
            <span class="font-black text-rose-900 text-right break-words flex-1 min-w-0">REVOCADO / SIN INGRESO A STOCK</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-rose-200 pb-0.5">
            <span class="font-black text-slate-900 shrink-0">SELLOS DE SEGURIDAD:</span>
            <span class="font-mono font-black text-rose-900 line-through text-right break-words flex-1 min-w-0">🔒 {{ displaySeals }}</span>
          </div>

          <div class="flex justify-between items-start gap-1">
            <span class="font-black text-slate-900 shrink-0">AUTORIZÓ CANCELACIÓN:</span>
            <span class="font-black text-rose-950 text-right break-words flex-1 min-w-0 leading-tight">{{ cancelledByName }}</span>
          </div>
        </div>

      </div>

      <!-- 4. Motivo / Justificación de la Cancelación Extraordinaria -->
      <div class="mb-1.5 bg-rose-50 p-2 border-l-4 border-rose-600 border-y border-r border-rose-200 rounded-sm text-[8.5px]">
        <span class="font-black text-rose-900 uppercase tracking-wider block text-[7.5px] mb-0.5">
          MOTIVO / JUSTIFICACIÓN OFICIAL DE CANCELACIÓN (AUDITORÍA WMS):
        </span>
        <p class="text-slate-950 font-bold italic font-mono leading-snug">
          "{{ reception.cancellationReason || 'Cancelación extraordinaria autorizada por Administración WMS. Rampa liberada y registros revocados.' }}"
        </p>
      </div>

      <!-- 5. Tabla de Partidas / Unidades de Almacenamiento (UAs) Revocadas -->
      <div class="mb-1 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[7.5px] sm:text-[8px] border-collapse font-sans uppercase">
          <thead>
            <tr class="border-b border-black font-black uppercase bg-slate-200 text-slate-950">
              <th class="py-0.5 px-1 border-r border-black text-center w-6">N°</th>
              <th class="py-0.5 px-1 border-r border-black font-mono">CÓDIGO TARIMA (UA)</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">REMISIÓN</th>
              <th class="py-0.5 px-1 border-r border-black font-mono">SKU</th>
              <th class="py-0.5 px-1 border-r border-black">DESCRIPCIÓN</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">LOTE</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">CADUCIDAD</th>
              <th class="py-0.5 px-1 border-r border-black text-right">PIEZAS</th>
              <th class="py-0.5 px-1 text-center">ESTADO</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-300 hover:bg-rose-50/50">
              <td class="py-0.5 px-1 border-r border-black text-center font-bold font-mono text-slate-950">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="py-0.5 px-1 border-r border-black font-black font-mono text-slate-950">{{ item.palletCode }}</td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold text-slate-950 whitespace-nowrap">
                {{ item.docNumber || (item && item['doc_number']) || (item.receptionLot && item.receptionLot.docNumber) || (item && (item.remisionNo || item.documentNumber)) || reception.checkIn?.docNumber || '-' }}
              </td>
              <td class="py-0.5 px-1 border-r border-black font-mono font-bold text-slate-950">{{ item.productId || reception.productId || '-' }}</td>
              <td class="py-0.5 px-1 border-r border-black font-bold max-w-[150px] truncate text-slate-950" [title]="item.description || reception.productName">
                {{ item.description || reception.productName || 'PRODUCTO CANCELADO' }}
              </td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold text-rose-900 whitespace-nowrap">
                {{ item.lotNumber || (item && item['lot_number']) || (item.receptionLot && item.receptionLot.lotNumber) || (item && item['batchNumber']) || reception.lotNumber || '-' }}
              </td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold text-slate-950 whitespace-nowrap">
                {{ formatDateDMY(item.expirationDate || (item && item['expiration_date']) || (item.receptionLot && item.receptionLot.expirationDate) || reception.expirationDate) }}
              </td>
              <td class="py-0.5 px-1 border-r border-black text-right font-black font-mono text-slate-950 whitespace-nowrap">
                {{ item.pieces | number:'1.0-0' }} PZAS
              </td>
              <td class="py-0.5 px-1 text-center font-mono font-black text-rose-800 text-[7px] whitespace-nowrap">
                REVOCADO
              </td>
            </tr>
            <tr *ngIf="!reception.pallets || reception.pallets.length === 0">
              <td colspan="9" class="py-2 px-2 text-center text-slate-900 font-bold italic text-[8px] bg-slate-50">
                Cancelación preventiva registrada antes del inicio de descarga física en andén. No se generaron unidades de almacenamiento físicas ni afectación al inventario en almacén.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 6. Totales Revocados -->
      <div class="flex justify-between items-center text-[8.5px] font-bold border-b-2 border-rose-600 pb-0.5 mb-2 bg-rose-50 px-2 py-0.5 rounded uppercase">
        <div>TOTAL TARIMAS CANCELADAS: <span class="font-mono font-black text-[10px] text-rose-900">{{ totalPallets }}</span></div>
        <div *ngIf="uniqueDocNumbers.length > 1">FOLIOS / REMISIONES: <span class="font-mono font-black text-[10px] text-slate-950">{{ uniqueDocNumbers.length }}</span></div>
        <div>LOTES TOTALES: <span class="font-mono font-black text-[10px] text-rose-900">{{ uniqueLots.length || 1 }}</span></div>
        <div>TOTAL PIEZAS ANULADAS: <span class="font-mono font-black text-[10px] text-rose-900">{{ totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- 7. Footer Operativo de Auditoría: Firmas Oficiales -->
      <div class="grid grid-cols-2 gap-8 items-end text-[8.5px] pt-1 uppercase mt-1" style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
        <div>
          <p class="font-bold text-slate-950 mb-1">
            CANCELÓ Y AUTORIZÓ (ADMINISTRACIÓN WMS): 
            <span class="font-black text-rose-950">{{ cancelledByName }}</span>
          </p>
          <div class="border-b-2 border-rose-600 w-full mb-0.5"></div>
          <p class="text-[7.5px] font-bold text-slate-900 tracking-tight">
            FIRMA Y CREDENCIALES DE SEGURIDAD VALIDADA / MESA DE CONTROL
          </p>
        </div>

        <div>
          <p class="font-bold text-slate-950 mb-1 text-right">
            NOTIFICADO A TRANSPORTISTA / PATIO: 
            <span class="font-black text-slate-950">{{ (reception.checkIn?.driverName || 'CONDUCTOR / SUPERVISOR PATIO').toUpperCase() }}</span>
          </p>
          <div class="border-b border-black w-full mb-0.5"></div>
          <p class="text-[7.5px] font-bold text-slate-900 tracking-tight text-right">
            FIRMA DE NOTIFICACIÓN DE RECHAZO / {{ (reception.checkIn?.carrierLine || 'LÍNEA TRANSPORTISTA').toUpperCase() }}
          </p>
        </div>
      </div>

      <div class="mt-1 pt-0.5 border-t border-slate-400 text-center text-[7px] text-slate-950 font-mono font-bold">
        Documento oficial de auditoría y revocación 4GUARD WMS — Este movimiento anula el ingreso en el Kardex y libera la rampa operativa.
      </div>

    </div>
  `,
  styles: [`
    @media print {
      @page {
        size: letter portrait;
        margin: 6mm;
      }
      .print-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        page-break-inside: avoid !important;
      }
      .grid.grid-cols-2 {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
      table {
        page-break-inside: avoid !important;
      }
      tr, td, th {
        page-break-inside: avoid !important;
      }
    }
  `]
})
export class PrintCancellationLayoutComponent {
  @Input() reception!: ReceptionHeader;
  protected readonly authState = inject(AuthState);

  get printDate(): string {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  get cancellationDateDisplay(): string {
    if (this.reception?.cancelledAt) {
      return this.reception.cancelledAt;
    }
    return this.printDate;
  }

  get totalPallets(): number {
    return this.reception?.pallets?.length || 0;
  }

  get totalPieces(): number {
    return this.reception?.pallets?.reduce((acc, p) => acc + (p.pieces || 0), 0) || 0;
  }

  get cancelledByName(): string {
    return (
      this.reception?.cancelledBy ||
      this.reception?.leaderAuthorizedBy ||
      this.reception?.capturedBy ||
      this.authState.userFullName() ||
      this.authState.currentUser()?.fullName ||
      'ADMINISTRADOR WMS'
    ).toUpperCase();
  }

  get noEcoTractor(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.noEcoTractor ||
      (this.reception as any).preCheckin?.noEcoTractor ||
      '-'
    );
  }

  get noEcoCaja(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.noEcoCaja ||
      (this.reception as any).preCheckin?.noEcoCaja ||
      '-'
    );
  }

  get rampDisplay(): string {
    const rNum = this.reception?.checkIn?.rampNumber ?? (this.reception as any)?.rampNumber;
    const rCode = this.reception?.checkIn?.rampCode ?? (this.reception as any)?.rampCode;
    if (rNum != null && rNum !== '' && Number(rNum) > 0) return `${rNum}`;
    if (rCode) {
      const match = rCode.match(/\d+/);
      if (match) return `${parseInt(match[0], 10)}`;
      return rCode;
    }
    return '1';
  }

  get displaySeals(): string {
    const seals = this.reception?.checkIn?.sealNumbers;
    if (seals && seals.length > 0) return seals.join(', ');
    return this.reception?.checkIn?.sealNumber || 'N/A';
  }

  get uniqueDocNumbers(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const doc = p.docNumber || (p as any).doc_number || (p as any).remisionNo || (p as any).documentNumber || (p as any).receptionLot?.docNumber;
        if (doc && String(doc).trim() && doc !== 'N/A' && doc !== '-') {
          set.add(String(doc).trim().toUpperCase());
        }
      });
    }

    if (set.size === 0 && this.reception?.checkIn?.docNumber && this.reception.checkIn.docNumber !== 'N/A' && this.reception.checkIn.docNumber !== '-') {
      set.add(this.reception.checkIn.docNumber.trim().toUpperCase());
    }

    return Array.from(set);
  }

  get displayDocSummary(): string {
    const docs = this.uniqueDocNumbers;
    if (docs.length === 0) return this.reception?.checkIn?.docNumber || 'N/A';
    if (docs.length === 1) return docs[0];
    return `${docs.join(', ')} (${docs.length} FOLIOS / REMISIONES)`;
  }

  get uniqueLots(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const num = p.lotNumber || (p as any).lot_number || (p as any).receptionLot?.lotNumber || (p as any).batchNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        const num = typeof l === 'string' ? l : l?.lotNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    if (set.size === 0 && this.reception?.lotNumber && this.reception.lotNumber !== 'N/A' && this.reception.lotNumber !== '-' && this.reception.lotNumber !== '01.07.2026') {
      set.add(this.reception.lotNumber.trim().toUpperCase());
    }

    return Array.from(set);
  }

  get displayLotSummary(): string {
    const lots = this.uniqueLots;
    if (lots.length === 0) return (this.reception?.lotNumber && this.reception.lotNumber !== '01.07.2026') ? this.reception.lotNumber : 'N/A';
    if (lots.length === 1) return lots[0];
    return `${lots.join(', ')} (${lots.length} LOTES)`;
  }

  get uniqueExpirations(): string[] {
    const set = new Set<string>();

    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const exp = p.expirationDate || (p as any).expiration_date || (p as any).receptionLot?.expirationDate;
        if (exp && exp !== 'N/A' && exp !== '-') {
          set.add(this.formatDateDMY(exp));
        }
      });
    }

    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        if (l?.expirationDate && l.expirationDate !== 'N/A' && l.expirationDate !== '-') {
          set.add(this.formatDateDMY(l.expirationDate));
        }
      });
    }

    if (set.size === 0 && this.reception?.expirationDate && this.reception.expirationDate !== 'N/A' && this.reception.expirationDate !== '-') {
      set.add(this.formatDateDMY(this.reception.expirationDate));
    }

    return Array.from(set);
  }

  get displayExpirationSummary(): string {
    const exps = this.uniqueExpirations;
    if (exps.length === 0) return this.formatDateDMY(this.reception?.expirationDate);
    if (exps.length === 1) return exps[0];
    return exps.join(', ');
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
