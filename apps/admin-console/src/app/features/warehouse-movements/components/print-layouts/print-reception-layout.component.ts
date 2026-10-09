import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReceptionHeader } from '../../models/warehouse-movements.models';
import { AuthState } from '../../../../core/auth/auth.state';

@Component({
  selector: 'fg-print-reception-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="reception" class="print-container bg-white text-black p-3 sm:p-4 max-w-full mx-auto font-sans border border-slate-300 rounded-sm shadow-sm text-[8.5px] leading-tight select-none">
      
      <!-- Top Header & Logo Institucional -->
      <div class="flex justify-between items-center mb-1 pb-1 border-b-2 border-black">
        <div class="flex items-center gap-2">
          <img src="/assets/logo-4guard.svg" alt="4GUARD Logo" class="h-6 sm:h-7 w-auto max-w-[34px] object-contain rounded" />
          <div>
            <h1 class="text-xs sm:text-sm font-black tracking-tight text-black leading-none mb-0.5">4-GUARD WMS</h1>
            <p class="text-[7.5px] text-slate-700 font-bold uppercase tracking-tight">
              Calle. Industria Automotriz sin número, Colonia el Coecillo, Toluca, Edo. Méx., C.P 50246.
            </p>
          </div>
        </div>

        <div class="text-right shrink-0">
          <span class="text-[8px] font-bold text-slate-700 block uppercase">FECHA DE IMPRESIÓN</span>
          <span class="text-[10px] font-mono font-black text-black">{{ printDate }}</span>
        </div>
      </div>

      <!-- Main Title -->
      <div class="text-center mb-1">
        <h2 class="text-xs font-black uppercase tracking-wider text-black border-y-2 border-black py-0.5 inline-block px-6">
          RECEPCIÓN DE MERCANCÍA
        </h2>
      </div>

      <!-- Header Grid Metadata: 2 Columnas Estrictas en Pantalla e Impresión -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8.5px] mb-1.5 border border-black p-1.5 rounded-sm bg-slate-50/60 uppercase" style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
        
        <!-- Columna Izquierda: Logística & Transporte -->
        <div class="space-y-0.5">
          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. RECEPCIÓN:</span>
            <span class="font-black text-[10px] font-mono text-black text-right flex-1 min-w-0">#{{ reception.folio }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA RECEPCIÓN:</span>
            <span class="font-bold text-black text-right flex-1 min-w-0 font-mono">{{ formatDateDMY(reception.createdAt || reception.checkIn.docDate) }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LÍNEA TRANSPORTADORA:</span>
            <span class="font-black text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.carrierLine || '').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">OPERADOR / CHOFER:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.driverName || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. ECO (TRACTO / CAJA):</span>
            <span class="font-mono font-black text-black text-right break-words flex-1 min-w-0 leading-tight text-amber-950">{{ economicNumber.toUpperCase() }} / {{ boxEconomicNumber.toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">PLACAS (TRACTO / CAJA):</span>
            <span class="font-mono font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.tractorPlates || '-').toUpperCase() }} / {{ (reception.checkIn.boxPlates || '-').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1">
            <span class="font-bold text-slate-700 shrink-0">MONTACARGUISTA / RAMPA:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.forkliftOperator || '').toUpperCase() }} (RAMPA {{ rampDisplay }})</span>
          </div>
        </div>

        <!-- Columna Derecha: Documentación, Cliente & Almacenaje -->
        <div class="space-y-0.5">
          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">NO. DOCUMENTO / REMISIÓN:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0 text-amber-950">{{ displayDocSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">FECHA(S) CADUCIDAD:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0">{{ displayExpirationSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">CLIENTE:</span>
            <span class="font-black text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.checkIn.client || '').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LOTE(S) DE PRODUCTO:</span>
            <span class="font-black font-mono text-black text-right break-words flex-1 min-w-0 text-amber-900">{{ displayLotSummary }}</span>
          </div>

          <div class="flex justify-between items-start gap-1 border-b border-slate-200 pb-0.5">
            <span class="font-bold text-slate-700 shrink-0">LUGAR DE ALMACENAJE:</span>
            <span class="font-bold text-black text-right break-words flex-1 min-w-0 leading-tight">{{ (reception.storageLocation || 'BODEGA PRINCIPAL').toUpperCase() }}</span>
          </div>

          <div class="flex justify-between items-center gap-1 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
            <span class="font-bold text-[8px] uppercase text-amber-900 shrink-0">SELLOS DE SEGURIDAD:</span>
            <span class="font-mono font-black text-[8.5px] text-amber-950 text-right break-words flex-1 min-w-0">{{ (reception.checkIn.sealNumbers && reception.checkIn.sealNumbers.length > 0) ? reception.checkIn.sealNumbers.join(', ') : (reception.checkIn.sealNumber || 'N/A') }}</span>
          </div>
        </div>

      </div>

      <!-- Tabla de Tarimas (Detalle Oficial con Remisión, Lote y Caducidad por UA) -->
      <div class="mb-1 border border-black rounded-sm overflow-hidden">
        <table class="w-full text-left text-[7.5px] sm:text-[8px] border-collapse font-sans uppercase">
          <thead>
            <tr class="border-b border-black font-black uppercase bg-slate-200 text-slate-950">
              <th class="py-0.5 px-1 border-r border-black text-center w-6">N°</th>
              <th class="py-0.5 px-1 border-r border-black font-mono">CÓDIGO TARIMA (UA)</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">REMISIÓN</th>
              <th class="py-0.5 px-1 border-r border-black font-mono">SKU</th>
              <th class="py-0.5 px-1 border-r border-black">DESCRIPCIÓN</th>
              <th class="py-0.5 px-1 border-r border-black">PROVEEDOR</th>
              <th class="py-0.5 px-1 border-r border-black">TIPO TARIMA</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">LOTE</th>
              <th class="py-0.5 px-1 border-r border-black font-mono text-center">CADUCIDAD</th>
              <th class="py-0.5 px-1 border-r border-black text-right">CANTIDAD</th>
              <th class="py-0.5 px-1">OBS</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of reception.pallets; let idx = index" class="border-b border-slate-300 hover:bg-slate-50">
              <td class="py-0.5 px-1 border-r border-black text-center font-bold font-mono">{{ item.palletNumber || (idx + 1) }}</td>
              <td class="py-0.5 px-1 border-r border-black font-bold font-mono text-slate-950">{{ item.palletCode }}</td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold text-slate-950 whitespace-nowrap">{{ item.docNumber || (item && item['doc_number']) || (item.receptionLot && item.receptionLot.docNumber) || (item && (item.remisionNo || item.documentNumber)) || reception.checkIn.docNumber || '-' }}</td>
              <td class="py-0.5 px-1 border-r border-black font-mono font-bold">{{ item.productId }}</td>
              <td class="py-0.5 px-1 border-r border-black font-semibold max-w-[140px] truncate" [title]="item.description">{{ item.description }}</td>
              <td class="py-0.5 px-1 border-r border-black text-[7.5px] max-w-[80px] truncate">{{ item.supplierName || '-' }}</td>
              <td class="py-0.5 px-1 border-r border-black text-[7.5px]">{{ item.palletTypeLabel }}</td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold text-amber-900 whitespace-nowrap">{{ item.lotNumber || (item && item['lot_number']) || (item.receptionLot && item.receptionLot.lotNumber) || (item && item['batchNumber']) || reception.lotNumber || '-' }}</td>
              <td class="py-0.5 px-1 border-r border-black font-mono text-center font-bold whitespace-nowrap">{{ formatDateDMY(item.expirationDate || (item && item['expiration_date']) || (item.receptionLot && item.receptionLot.expirationDate) || reception.expirationDate) }}</td>
              <td class="py-0.5 px-1 border-r border-black text-right font-black font-mono whitespace-nowrap">{{ item.pieces | number:'1.0-0' }} PZAS</td>
              <td class="py-0.5 px-1 italic text-slate-600 text-[7px] max-w-[50px] truncate">{{ item.observations || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="flex justify-between items-center text-[8.5px] font-bold border-b-2 border-black pb-0.5 mb-2 bg-slate-100 px-2 py-0.5 rounded uppercase">
        <div>TOTAL TARIMAS: <span class="font-mono font-black text-[10px]">{{ totalPallets }}</span></div>
        <div *ngIf="uniqueDocNumbers.length > 1">FOLIOS / REMISIONES: <span class="font-mono font-black text-[10px] text-slate-900">{{ uniqueDocNumbers.length }}</span></div>
        <div>LOTES TOTALES: <span class="font-mono font-black text-[10px] text-amber-900">{{ uniqueLots.length || 1 }}</span></div>
        <div>TOTAL PIEZAS: <span class="font-mono font-black text-[10px]">{{ totalPieces | number:'1.0-0' }} PZAS</span></div>
      </div>

      <!-- Footer Operativo: Entregó (Chofer / Transportista) y Recibió (Almacén / Montacarguista / Líder) -->
      <div class="grid grid-cols-2 gap-8 items-end text-[8.5px] pt-1 uppercase mt-1" style="display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;">
        <div>
          <p class="font-bold text-slate-800 mb-1">
            ENTREGÓ (CHOFER / TRANSPORTISTA): 
            <span class="font-black text-black">{{ (reception.checkIn.driverName || 'OPERADOR CONDUCTOR').toUpperCase() }}</span>
          </p>
          <div class="border-b border-black w-full mb-0.5"></div>
          <p class="text-[7.5px] font-bold text-slate-700 tracking-tight">
            NOMBRE Y FIRMA DE CONFORMIDAD DEL CONDUCTOR / {{ (reception.checkIn.carrierLine || 'LÍNEA TRANSPORTISTA').toUpperCase() }}
          </p>
        </div>

        <div>
          <p class="font-bold text-slate-800 mb-1 text-right">
            RECIBIÓ Y AUTORIZÓ (ALMACÉN WMS): 
            <span class="font-black text-black">{{ capturedByName }}</span>
          </p>
          <div class="border-b-2 border-black w-full mb-0.5"></div>
          <p class="text-[7.5px] font-bold text-slate-900 tracking-tight text-right">
            FIRMA DE CONFORMIDAD ALMACÉN / MONTACARGA: {{ (reception.checkIn.forkliftOperator || 'OPERADOR MONTACARGA').toUpperCase() }}
          </p>
        </div>
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

  get economicNumber(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.economicNumber ||
      this.reception.checkIn?.noEcoTractor ||
      (this.reception as any).economicNumber ||
      (this.reception as any).noEcoTractor ||
      (this.reception as any).preCheckin?.economicNumber ||
      (this.reception as any).preCheckin?.noEcoTractor ||
      '-'
    );
  }

  get boxEconomicNumber(): string {
    if (!this.reception) return '-';
    return (
      this.reception.checkIn?.boxEconomicNumber ||
      this.reception.checkIn?.noEcoCaja ||
      (this.reception as any).boxEconomicNumber ||
      (this.reception as any).noEcoCaja ||
      (this.reception as any).preCheckin?.boxEconomicNumber ||
      (this.reception as any).preCheckin?.noEcoCaja ||
      '-'
    );
  }

  get rampDisplay(): string {
    const rNum = this.reception?.checkIn?.rampNumber;
    const rCode = this.reception?.checkIn?.rampCode;
    if (rNum) return `${rNum}`;
    if (rCode) {
      const match = rCode.match(/\d+/);
      if (match) return `${parseInt(match[0], 10)}`;
      return rCode;
    }
    return '1';
  }

  get uniqueDocNumbers(): string[] {
    const set = new Set<string>();

    // 1. Recopilar remisiones específicas de cada tarima
    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const doc = p.docNumber || (p as any).doc_number || (p as any).remisionNo || (p as any).documentNumber || (p as any).receptionLot?.docNumber;
        if (doc && String(doc).trim() && doc !== 'N/A' && doc !== '-') {
          set.add(String(doc).trim().toUpperCase());
        }
      });
    }

    // 2. Fallback a remisión de cabecera si no hay en tarimas
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

    // 1. Recopilar lotes específicos de cada tarima individual
    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const num = p.lotNumber || (p as any).lot_number || (p as any).receptionLot?.lotNumber || (p as any).batchNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    // 2. Recopilar del catálogo de lotes asociados a la recepción
    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        const num = typeof l === 'string' ? l : l?.lotNumber;
        if (num && String(num).trim() && num !== 'N/A' && num !== '-' && num !== '01.07.2026') {
          set.add(String(num).trim().toUpperCase());
        }
      });
    }

    // 3. Fallback a lote general solo si no hay lotes individuales definidos
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

    // 1. Recopilar caducidades de cada tarima individual
    if (this.reception?.pallets && Array.isArray(this.reception.pallets)) {
      this.reception.pallets.forEach(p => {
        const exp = p.expirationDate || (p as any).expiration_date || (p as any).receptionLot?.expirationDate;
        if (exp && exp !== 'N/A' && exp !== '-') {
          set.add(this.formatDateDMY(exp));
        }
      });
    }

    // 2. Recopilar del catálogo de lotes
    if (this.reception?.lots && Array.isArray(this.reception.lots)) {
      this.reception.lots.forEach((l: any) => {
        if (l?.expirationDate && l.expirationDate !== 'N/A' && l.expirationDate !== '-') {
          set.add(this.formatDateDMY(l.expirationDate));
        }
      });
    }

    // 3. Fallback a caducidad de cabecera
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
