/**
 * @file print-transport-checklist-layout.component.ts
 * @description Formato de impresión oficial "FORMATO - CHECK LIST DE TRANSPORTE" (F01-PO-CP-7.1.3-03).
 * Replicación 100% fiel al formato físico institucional de Seguridad Patrimonial / Caseta de Vigilancia de 4GUARD WMS.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TransportChecklistPrintData {
  controlNumber?: string;
  revisionNumber?: string;
  revisionDate?: string;
  emissionDate?: string;
  processOwner?: string;
  elaboratedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;

  // Datos Generales
  fecha?: string;
  noCartaPorte?: string;
  remision?: string;
  cliente?: string;
  procedimiento?: string;
  operacion?: 'CARGA' | 'DESCARGA';
  horaEntrada?: string;
  horaSalida?: string;

  // Datos del Transporte
  lineaTransporte?: string;
  nombreOperador?: string;
  noRampa?: string | number;
  placasTracto?: string;
  noEcoTractor?: string;
  placasCaja?: string;
  medidasCaja?: string;
  noSello?: string;
  tipoTransporte?: string;

  // Checklist EPP
  eppZapatos?: 'SI' | 'NO';
  eppZapatosObs?: string;
  eppCofia?: 'SI' | 'NO';
  eppCofiaObs?: string;
  eppCubrebocas?: 'SI' | 'NO';
  eppCubrebocasObs?: string;
  eppChaleco?: 'SI' | 'NO';
  eppChalecoObs?: string;

  // Checklist Documentos
  docCartaPorte?: 'SI' | 'NO';
  docCartaPorteObs?: string;
  docRemision?: 'SI' | 'NO';
  docRemisionObs?: string;

  // Revisión Unidad
  revInteriorCaja?: 'SI' | 'NO';
  revInteriorCajaObs?: string;
  revDanosCaja?: 'SI' | 'NO';
  revDanosCajaObs?: string;
  revDanosPuertas?: 'SI' | 'NO';
  revDanosPuertasObs?: string;
  revOloresExtranos?: 'SI' | 'NO';
  revOloresExtranosObs?: string;
  revIndiciosPlagas?: 'SI' | 'NO';
  revIndiciosPlagasObs?: string;

  // Firmas
  responsableVigilanciaNombre?: string;
  responsableVigilanciaFirma?: boolean;
  transportistaNombre?: string;
  driverSignature?: string; // Data URL Base64 de la firma digital
  driverSignedAt?: string;

  folio?: string;
  token?: string;
}

@Component({
  selector: 'fg-print-transport-checklist-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="data" class="f01-print-sheet bg-white text-black p-4 sm:p-5 max-w-[850px] mx-auto font-sans text-[11px] leading-tight border border-slate-400 rounded-sm shadow-sm print:border-0 print:p-0 print:shadow-none">
      
      <!-- ════════════════════════════════════════════════════════════════════════════════
           1. ENCABEZADO INSTITUCIONAL OFICIAL (F01-PO-CP-7.1.3-03)
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="w-full border-collapse border border-slate-900 text-center mb-1">
        <tr>
          <!-- Logo 4Guard -->
          <td rowspan="2" class="w-[140px] border border-slate-900 p-1 bg-slate-100 align-middle">
            <div class="flex items-center justify-center gap-1">
              <img src="/assets/logo-4guard.svg" alt="4Guard" class="h-8 max-h-9 w-auto object-contain" />
              <span class="font-black text-xs tracking-tighter text-slate-900">4GUARD</span>
            </div>
          </td>
          <!-- Título Central -->
          <td class="border border-slate-900 p-1 bg-slate-200">
            <span class="text-[10px] font-black uppercase tracking-wider block">FORMATO</span>
            <span class="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-950 block">CHECK LIST DE TRANSPORTE</span>
          </td>
          <!-- Código y Versión -->
          <td class="w-[200px] border border-slate-900 p-0.5 text-[9px] text-right font-medium bg-slate-100">
            <div class="border-b border-slate-900 pb-0.5 px-1 font-bold">
              No. de Control: <span class="font-black">{{ data.controlNumber || 'F01-PO-CP-7.1.3-03' }}</span>
            </div>
            <div class="px-1 pt-0.5">
              No. de Revisión: <span class="font-bold">{{ data.revisionNumber || '01' }}</span> &nbsp;|&nbsp; Fecha: <span class="font-bold">{{ data.revisionDate || '19/08/2025' }}</span>
            </div>
          </td>
        </tr>
        <tr class="text-[8.5px] bg-slate-50 font-semibold">
          <td class="border border-slate-900 p-0.5 text-center">
            <span>Dueño: <strong>{{ data.processOwner || 'Seguridad Patrimonial' }}</strong></span>
            &nbsp;|&nbsp;
            <span>Emisión: <strong>{{ data.emissionDate || '19/08/2025' }}</strong></span>
          </td>
          <td class="border border-slate-900 p-0.5 text-center">
            <span>Elab: <strong>{{ data.elaboratedBy || 'SP' }}</strong></span>
            &nbsp;|&nbsp;
            <span>Rev: <strong>{{ data.reviewedBy || 'CG' }}</strong></span>
            &nbsp;|&nbsp;
            <span>Aprob: <strong>{{ data.approvedBy || 'DG' }}</strong></span>
          </td>
        </tr>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           2. DATOS GENERALES
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="w-full border-collapse border border-slate-900 mb-1.5 text-[10px]">
        <thead>
          <tr class="bg-slate-300 text-slate-900 uppercase font-black tracking-wide text-center">
            <th colspan="6" class="border border-slate-900 py-0.5 px-2">DATOS GENERALES</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100 w-[70px]">Fecha:</td>
            <td class="border border-slate-900 px-2 py-1 font-semibold">{{ data.fecha }}</td>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100 w-[110px]">No. Carta Porte:</td>
            <td class="border border-slate-900 px-2 py-1 font-semibold font-mono">{{ data.noCartaPorte || '-' }}</td>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100 w-[80px]">Remisión:</td>
            <td class="border border-slate-900 px-2 py-1 font-semibold font-mono">{{ data.remision || '-' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100">Cliente:</td>
            <td class="border border-slate-900 px-2 py-1 font-bold text-slate-900" colspan="1">{{ data.cliente }}</td>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100">Procedimiento:</td>
            <td class="border border-slate-900 px-2 py-1 font-semibold">
              <span class="inline-flex items-center gap-3">
                <span>[ {{ data.operacion === 'CARGA' ? 'X' : '&nbsp;&nbsp;' }} ] Carga</span>
                <span>[ {{ data.operacion === 'DESCARGA' ? 'X' : '&nbsp;&nbsp;' }} ] Descarga</span>
              </span>
            </td>
            <td class="border border-slate-900 px-2 py-1 font-bold bg-slate-100">Horas:</td>
            <td class="border border-slate-900 px-2 py-1 font-mono text-[9.5px]">
              <div><strong>Entrada:</strong> {{ data.horaEntrada || '--:--' }}</div>
              <div><strong>Salida:</strong> {{ data.horaSalida || '--:--' }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           3. DATOS DEL TRANSPORTE
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="w-full border-collapse border border-slate-900 mb-1.5 text-[10px]">
        <thead>
          <tr class="bg-slate-300 text-slate-900 uppercase font-black tracking-wide text-center">
            <th colspan="6" class="border border-slate-900 py-0.5 px-2">DATOS DEL TRANSPORTE</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100 w-[90px]">Línea Transp.:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-semibold">{{ data.lineaTransporte }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100 w-[110px]">Nombre Operador:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-semibold">{{ data.nombreOperador }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100 w-[80px]">No. Rampa:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold font-mono">{{ data.noRampa || 'R-01' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">Placas Tracto:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-mono font-bold">{{ data.placasTracto || '-' }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">No. Eco Tracto:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-mono font-bold">{{ data.noEcoTractor || '-' }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">Placas Caja:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-mono font-bold">{{ data.placasCaja || '-' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">Medidas Caja:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-semibold">{{ data.medidasCaja || '53 Pies' }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">No. Sello(s):</td>
            <td class="border border-slate-900 px-2 py-0.5 font-mono font-bold break-all">{{ data.noSello || '-' }}</td>
            <td class="border border-slate-900 px-2 py-0.5 font-bold bg-slate-100">Tipo Transp.:</td>
            <td class="border border-slate-900 px-2 py-0.5 font-semibold">{{ data.tipoTransporte || 'Caja Seca' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           4. REVISIÓN DEL TRANSPORTE (CHECKLIST COMPLETO)
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="w-full border-collapse border border-slate-900 mb-1.5 text-[9.5px]">
        <thead>
          <tr class="bg-slate-300 text-slate-900 uppercase font-black text-center">
            <th class="border border-slate-900 py-0.5 px-2 text-left w-[36%]">CRITERIOS</th>
            <th class="border border-slate-900 py-0.5 px-1 w-[8%]">SÍ</th>
            <th class="border border-slate-900 py-0.5 px-1 w-[8%]">NO</th>
            <th class="border border-slate-900 py-0.5 px-2 text-left w-[48%]">OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          <!-- EPP -->
          <tr class="bg-slate-200 font-bold text-slate-950">
            <td colspan="4" class="border border-slate-900 px-2 py-0.5 uppercase tracking-wide">
              EPP (Equipo de Protección Personal)
            </td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Zapatos de seguridad</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppZapatos === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppZapatos === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.eppZapatosObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Cofia</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppCofia === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppCofia === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.eppCofiaObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Cubrebocas</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppCubrebocas === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppCubrebocas === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.eppCubrebocasObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Chaleco con reflejante</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppChaleco === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.eppChaleco === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.eppChalecoObs || '' }}</td>
          </tr>

          <!-- Documentos -->
          <tr class="bg-slate-200 font-bold text-slate-950">
            <td colspan="4" class="border border-slate-900 px-2 py-0.5 uppercase tracking-wide">
              Documentos
            </td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Carta porte</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.docCartaPorte === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.docCartaPorte === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.docCartaPorteObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Remisión</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.docRemision === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.docRemision === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.docRemisionObs || '' }}</td>
          </tr>

          <!-- Revisión de la unidad -->
          <tr class="bg-slate-200 font-bold text-slate-950">
            <td colspan="4" class="border border-slate-900 px-2 py-0.5 uppercase tracking-wide">
              Revisión de la unidad
            </td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Interior de Caja</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revInteriorCaja === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revInteriorCaja === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.revInteriorCajaObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Daños a la caja</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revDanosCaja === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revDanosCaja === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.revDanosCajaObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Daños en puertas</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revDanosPuertas === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revDanosPuertas === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.revDanosPuertasObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Olores extraños</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revOloresExtranos === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revOloresExtranos === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.revOloresExtranosObs || '' }}</td>
          </tr>
          <tr>
            <td class="border border-slate-900 px-2 py-0.5 font-medium">Indicios de plagas</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revIndiciosPlagas === 'SI' ? 'X' : '' }}</td>
            <td class="border border-slate-900 text-center font-bold">{{ data.revIndiciosPlagas === 'NO' ? 'X' : '' }}</td>
            <td class="border border-slate-900 px-2 py-0.5">{{ data.revIndiciosPlagasObs || '' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ════════════════════════════════════════════════════════════════════════════════
           5. RESPONSABLES Y FIRMAS
      ════════════════════════════════════════════════════════════════════════════════ -->
      <table class="w-full border-collapse border border-slate-900 text-[9.5px]">
        <thead>
          <tr class="bg-slate-300 text-slate-900 uppercase font-black text-center">
            <th class="border border-slate-900 py-0.5 px-2 w-1/2">Responsable Vigilancia</th>
            <th class="border border-slate-900 py-0.5 px-2 w-1/2">Transportista</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <!-- Columna Vigilancia -->
            <td class="border border-slate-900 p-2 align-top">
              <div class="mb-1">
                <span class="font-bold">Nombre:</span>
                <span class="font-semibold ml-1">{{ data.responsableVigilanciaNombre || 'Guardia en Turno' }}</span>
              </div>
              <div class="h-16 border-b border-dashed border-slate-400 flex items-center justify-center">
                <div class="text-center text-[9px] text-slate-700 font-serif italic">
                  [ Sello Digital de Caseta Autorizado ]
                </div>
              </div>
              <div class="text-center text-[8.5px] font-bold text-slate-600 mt-1 uppercase">Firma Vigilancia</div>
            </td>

            <!-- Columna Transportista -->
            <td class="border border-slate-900 p-2 align-top">
              <div class="mb-1">
                <span class="font-bold">Nombre:</span>
                <span class="font-semibold ml-1">{{ data.transportistaNombre || data.nombreOperador || 'Operador Chofer' }}</span>
              </div>
              <div class="h-16 border-b border-dashed border-slate-400 flex items-center justify-center">
                <img *ngIf="data.driverSignature" [src]="data.driverSignature" alt="Firma Chofer" class="h-14 max-w-full object-contain" />
                <span *ngIf="!data.driverSignature" class="text-center text-[9px] text-slate-400 font-serif italic">
                  (Firma autógrafa del operador)
                </span>
              </div>
              <div class="text-center text-[8.5px] font-bold text-slate-600 mt-1 uppercase">Firma Transportista</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pie de página con Folio y Token WMS -->
      <div class="flex justify-between items-center text-[8px] text-slate-500 font-mono mt-1 pt-0.5 border-t border-slate-200">
        <span>4GUARD WMS &copy; 2026 — SISTEMA INTEGRAL DE GESTIÓN DE PATIO Y ALMACÉN</span>
        <span>FOLIO WMS: <strong>{{ data.folio || 'N/A' }}</strong> &nbsp;|&nbsp; TOKEN: <strong>{{ data.token || 'N/A' }}</strong></span>
      </div>

    </div>
  `,
  styles: [`
    @media print {
      .f01-print-sheet {
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }
      table {
        page-break-inside: avoid;
      }
    }
  `]
})
export class PrintTransportChecklistLayoutComponent {
  @Input() data?: TransportChecklistPrintData;
}
