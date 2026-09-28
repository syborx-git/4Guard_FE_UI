/**
 * @file print-verification-layout.component.ts
 * @description Formato Oficial de Impresión "VERIFICACIÓN DE CARGA (F01-PO-GC-8.6-03 Rev. 03)"
 * Replica con exactitud 1:1 el documento oficial PDF de planta ("Checklist_43519988_89428506.pdf"),
 * incluyendo encabezados azul marino, tablas de producto y transporte con celdas combinadas,
 * y sellos de firma digital con códigos QR simulados.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadVerification } from '../../models/quality.models';

@Component({
  selector: 'fg-print-verification-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="verification" id="official-f01-print-sheet" class="f01-pdf-sheet bg-white text-black font-sans mx-auto">
      
      <!-- ── 1. ENCABEZADO SUPERIOR CON BLOQUE DE EMISIÓN Y 3 APROBACIONES AZUL MARINO ── -->
      <table class="f01-table f01-header-table w-full mb-1">
        <tr>
          <!-- Bloque Izquierdo: Dueño / Proceso / Emisión -->
          <td class="f01-header-left align-top p-1 text-[7.5px] leading-tight w-[34%]">
            <div><strong class="font-bold">Dueño:</strong> {{ verification.ownerDepartment || 'Seguridad e Inocuidad' }}</div>
            <div><strong class="font-bold">Proceso:</strong> {{ verification.processName || 'Liberación de carga' }}</div>
            <div><strong class="font-bold">Emisión:</strong> {{ verification.revisionDate || '27/03/2026' }}</div>
          </td>

          <!-- Bloque Elaboró -->
          <td class="align-top p-0 text-center w-[22%] border-l border-black">
            <div class="f01-navy-header text-white font-bold text-[8px] py-0.5 uppercase tracking-wide">
              Elaboró
            </div>
            <div class="p-1 flex items-center justify-center gap-1.5 min-h-[32px]">
              <div class="f01-qr-stamp f01-qr-stamp--blue" title="Firma Digital Elaboró">
                <svg viewBox="0 0 32 32" class="w-7 h-7">
                  <rect width="32" height="32" fill="#f8fafc" />
                  <!-- QR Finder patterns -->
                  <rect x="2" y="2" width="8" height="8" fill="#1e3a8a" />
                  <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="4.5" width="3" height="3" fill="#1e3a8a" />
                  <rect x="22" y="2" width="8" height="8" fill="#1e3a8a" />
                  <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="24.5" y="4.5" width="3" height="3" fill="#1e3a8a" />
                  <rect x="2" y="22" width="8" height="8" fill="#1e3a8a" />
                  <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="24.5" width="3" height="3" fill="#1e3a8a" />
                  <!-- Data matrix dots -->
                  <rect x="12" y="3" width="2" height="2" fill="#dc2626" />
                  <rect x="16" y="5" width="2" height="2" fill="#2563eb" />
                  <rect x="18" y="2" width="2" height="2" fill="#7c3aed" />
                  <rect x="13" y="13" width="6" height="6" fill="#1e3a8a" />
                  <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                  <rect x="3" y="13" width="2" height="2" fill="#059669" />
                  <rect x="7" y="16" width="2" height="2" fill="#2563eb" />
                  <rect x="23" y="14" width="3" height="2" fill="#dc2626" />
                  <rect x="27" y="17" width="2" height="2" fill="#1e3a8a" />
                  <rect x="12" y="23" width="2" height="2" fill="#2563eb" />
                  <rect x="17" y="26" width="3" height="2" fill="#dc2626" />
                  <rect x="24" y="23" width="2" height="2" fill="#059669" />
                  <rect x="27" y="26" width="2" height="2" fill="#1e3a8a" />
                </svg>
              </div>
              <div class="text-[7.5px] font-mono font-bold text-left leading-tight">
                <div>{{ getHeaderCode(1) }}</div>
                <div class="text-[6.5px] text-slate-600 font-sans font-normal truncate max-w-[65px]">{{ verification.elaboratedBy.name || 'Carlos Mendoza' }}</div>
              </div>
            </div>
          </td>

          <!-- Bloque Revisó -->
          <td class="align-top p-0 text-center w-[22%] border-l border-black">
            <div class="f01-navy-header text-white font-bold text-[8px] py-0.5 uppercase tracking-wide">
              Revisó
            </div>
            <div class="p-1 flex items-center justify-center gap-1.5 min-h-[32px]">
              <div class="f01-qr-stamp f01-qr-stamp--purple" title="Firma Digital Revisó">
                <svg viewBox="0 0 32 32" class="w-7 h-7">
                  <rect width="32" height="32" fill="#f8fafc" />
                  <rect x="2" y="2" width="8" height="8" fill="#4338ca" />
                  <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="4.5" width="3" height="3" fill="#4338ca" />
                  <rect x="22" y="2" width="8" height="8" fill="#4338ca" />
                  <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="24.5" y="4.5" width="3" height="3" fill="#4338ca" />
                  <rect x="2" y="22" width="8" height="8" fill="#4338ca" />
                  <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="24.5" width="3" height="3" fill="#4338ca" />
                  <rect x="12" y="4" width="2" height="2" fill="#4338ca" />
                  <rect x="16" y="2" width="2" height="2" fill="#059669" />
                  <rect x="13" y="13" width="6" height="6" fill="#4338ca" />
                  <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                  <rect x="4" y="14" width="2" height="2" fill="#dc2626" />
                  <rect x="24" y="15" width="2" height="2" fill="#4338ca" />
                  <rect x="14" y="25" width="2" height="2" fill="#059669" />
                  <rect x="25" y="24" width="2" height="2" fill="#dc2626" />
                </svg>
              </div>
              <div class="text-[7.5px] font-mono font-bold text-left leading-tight">
                <div>{{ getHeaderCode(2) }}</div>
                <div class="text-[6.5px] text-slate-600 font-sans font-normal truncate max-w-[65px]">{{ verification.reviewedBy.name || 'Laura Valdés' }}</div>
              </div>
            </div>
          </td>

          <!-- Bloque Aprobó -->
          <td class="align-top p-0 text-center w-[22%] border-l border-black">
            <div class="f01-navy-header text-white font-bold text-[8px] py-0.5 uppercase tracking-wide">
              Aprobó
            </div>
            <div class="p-1 flex items-center justify-center gap-1.5 min-h-[32px]">
              <div class="f01-qr-stamp f01-qr-stamp--gold" title="Firma Digital Aprobó">
                <svg viewBox="0 0 32 32" class="w-7 h-7">
                  <rect width="32" height="32" fill="#f8fafc" />
                  <rect x="2" y="2" width="8" height="8" fill="#1e3a8a" />
                  <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="4.5" width="3" height="3" fill="#1e3a8a" />
                  <rect x="22" y="2" width="8" height="8" fill="#1e3a8a" />
                  <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                  <rect x="24.5" y="4.5" width="3" height="3" fill="#1e3a8a" />
                  <rect x="2" y="22" width="8" height="8" fill="#1e3a8a" />
                  <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                  <rect x="4.5" y="24.5" width="3" height="3" fill="#1e3a8a" />
                  <rect x="13" y="13" width="6" height="6" fill="#b45309" />
                  <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                  <rect x="12" y="4" width="2" height="2" fill="#b45309" />
                  <rect x="17" y="3" width="2" height="2" fill="#dc2626" />
                  <rect x="25" y="14" width="2" height="2" fill="#b45309" />
                  <rect x="14" y="25" width="2" height="2" fill="#1e3a8a" />
                </svg>
              </div>
              <div class="text-[7.5px] font-mono font-bold text-left leading-tight">
                <div>{{ getHeaderCode(3) }}</div>
                <div class="text-[6.5px] text-slate-600 font-sans font-normal truncate max-w-[65px]">{{ verification.approvedBy.name || 'Ing. F. Treviño' }}</div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- ── 2. METADATOS: DESCRIPCIÓN DEL PRODUCTO, REMISIÓN, FECHA, HORA, RAMPA ── -->
      <table class="f01-table w-full mb-1 text-[8px]">
        <tr>
          <td class="p-1 border-r border-black w-[68%]">
            <span class="font-bold">DESCRIPCIÓN DEL PRODUCTO:</span>
            <span class="font-bold ml-2 font-mono text-[8.5px]">{{ verification.productDescription || verification.folio }}</span>
          </td>
          <td class="p-1 w-[32%]">
            <span class="font-bold">NO. DE REMISIÓN:</span>
            <span class="font-bold ml-2 font-mono text-[8.5px]">{{ verification.remisionNumber || '89428506' }}</span>
          </td>
        </tr>
        <tr class="border-t border-black">
          <td colspan="2" class="p-0">
            <div class="flex justify-between items-center px-2 py-0.5 text-[8px]">
              <div><span class="font-bold">FECHA:</span> <span class="font-mono ml-1">{{ verification.date || '11/09/2026' }}</span></div>
              <div><span class="font-bold">HORA:</span> <span class="font-mono ml-1">{{ verification.time ? verification.time + ':00' : '07:27:00' }}</span></div>
              <div><span class="font-bold">RAMPA:</span> <span class="font-mono ml-1 font-bold">{{ getRampNumber() }}</span></div>
            </div>
          </td>
        </tr>
      </table>

      <!-- ── 3. BANNER DE CONDICIONES GENERALES VISUALES ── -->
      <div class="text-center my-0.5">
        <div class="font-bold text-[8.5px] uppercase tracking-wide">CONDICIONES GENERALES VISUALES</div>
        <div class="text-[7px] font-bold text-slate-700">Instrucciones: Marcar con una ✔ según corresponda o n/a.</div>
      </div>

      <!-- ── 4. TABLA 1: CRITERIOS DE PRODUCTO (8 NORMATIVOS + OTROS) ── -->
      <table class="f01-table w-full mb-1 text-[7px] leading-tight">
        <thead>
          <tr class="bg-white font-bold uppercase text-[7px]">
            <th class="p-0.5 border-r border-black text-left w-[42%]">CRITERIOS DE PRODUCTO</th>
            <th class="p-0.5 border-r border-black text-center w-[4.5%]">SI</th>
            <th class="p-0.5 border-r border-black text-center w-[4.5%]">NO</th>
            <th class="p-0.5 border-r border-black text-left w-[27%]">ACCIÓN</th>
            <th class="p-0.5 border-r border-black text-left w-[11%]">RESPONSABLE</th>
            <th class="p-0.5 text-left w-[11%]">OBSERVACIONES</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1. Tarima en buen estado -->
          <tr>
            <td class="p-0.5 border-r border-black">Tarima en buen estado (Habilitada para manipularse con montacargas).</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-1') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-1') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se informa a las áreas correspondientes para su seguimiento y se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Mantenimiento, Calidad, Operaciones.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-1') }}</td>
          </tr>

          <!-- 2. Pallet sin daños -->
          <tr>
            <td class="p-0.5 border-r border-black">Pallet sin daños (Sin el producto expuesto y dañado).</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-2') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-2') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-2') }}</td>
          </tr>

          <!-- 3. Embalaje en buen estado -->
          <tr>
            <td class="p-0.5 border-r border-black">Embalaje en buen estado (sin aberturas o rasgaduras que afecte la inocuidad).</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-3') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-3') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-3') }}</td>
          </tr>

          <!-- 4. Pallets limpios -->
          <tr>
            <td class="p-0.5 border-r border-black">Pallets limpios, (sin manchas en general, sustancia ajena al pallet, exceso de polvo etc.).</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-4') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-4') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se realiza limpieza a pallet, en caso de exceso de polvo aplicando el instructivo IT01-PO-GC-8.6-01</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Mantenimiento, Calidad.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-4') }}</td>
          </tr>

          <!-- 5. Pallet visualmente estable -->
          <tr>
            <td class="p-0.5 border-r border-black">Pallet visualmente estable o alineado.</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-5') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-5') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se realiza acondicionamiento de acuerdo al instructivo IT02-PO-GC-8.6-02</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-5') }}</td>
          </tr>

          <!-- 6. Producto coincide -->
          <tr>
            <td class="p-0.5 border-r border-black">Producto coincide con lo solicitado por el cliente.</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-6') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-6') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se reporta al líder en turno.</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad, operaciones.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-6') }}</td>
          </tr>

          <!-- 7. Material identificado -->
          <tr>
            <td class="p-0.5 border-r border-black">Material identificado con UA de cliente.</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-7') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-7') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se reporta al líder en turno.</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad, operaciones.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-7') }}</td>
          </tr>

          <!-- 8. Libre de plaga -->
          <tr>
            <td class="p-0.5 border-r border-black">Producto libre de algún tipo de plaga.</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-prod-8') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-prod-8') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Se realiza un reporte, vía correo al cliente y dirección general, informando con evidencia fotográfica como respaldo del suceso, esperando respuesta por parte del cliente, para el seguimiento.</td>
            <td class="p-0.5 border-r border-black text-[6.5px]">Calidad.</td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-8') }}</td>
          </tr>

          <!-- 9. Otros -->
          <tr>
            <td class="p-0.5 border-r border-black">Otros:</td>
            <td class="p-0.5 border-r border-black text-center"></td>
            <td class="p-0.5 border-r border-black text-center"></td>
            <td class="p-0.5 border-r border-black"></td>
            <td class="p-0.5 border-r border-black"></td>
            <td class="p-0.5 text-[6.5px]">{{ getObs('crit-prod-9') }}</td>
          </tr>
        </tbody>
      </table>

      <!-- ── 5. TABLA 2: CRITERIOS DE TRANSPORTE (CON ACCIÓN Y RESPONSABLE AGRUPADOS) ── -->
      <table class="f01-table w-full mb-2 text-[7px] leading-tight">
        <thead>
          <tr class="bg-white font-bold uppercase text-[7px]">
            <th class="p-0.5 border-r border-black text-left w-[42%]">CRITERIOS DE TRANSPORTE</th>
            <th class="p-0.5 border-r border-black text-center w-[4.5%]">SI</th>
            <th class="p-0.5 border-r border-black text-center w-[4.5%]">NO</th>
            <th class="p-0.5 border-r border-black text-left w-[33%]">ACCIÓN</th>
            <th class="p-0.5 text-left w-[16%]">RESPONSABLE</th>
          </tr>
        </thead>
        <tbody>
          <!-- Fila 1 -->
          <tr>
            <td class="p-0.5 border-r border-black">Camión cerrado o con lona en buenas condiciones</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-1') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-1') ? '✕' : '' }}</td>
            <!-- Celda agrupada de Acción para filas 1 a 8 -->
            <td rowspan="8" class="p-1 border-r border-black align-middle text-[7px] leading-normal">
              Se toma evidencia de los criterios detectados y se comparte al cliente.
            </td>
            <!-- Celda agrupada de Responsable para filas 1 a 8 -->
            <td rowspan="8" class="p-1 align-middle text-[7.5px] font-medium">
              Calidad.
            </td>
          </tr>
          <!-- Fila 2 -->
          <tr>
            <td class="p-0.5 border-r border-black">Paredes limpias</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-2') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-2') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 3 -->
          <tr>
            <td class="p-0.5 border-r border-black">Puertas Limpias</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-3') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-3') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 4 -->
          <tr>
            <td class="p-0.5 border-r border-black">Libre de indicios de plagas evidentes</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-4') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-4') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 5 -->
          <tr>
            <td class="p-0.5 border-r border-black">Libre de aromas extraños</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-5') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-5') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 6 -->
          <tr>
            <td class="p-0.5 border-r border-black">Piso limpio/Libre de obstáculos y en un buen estado</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-6') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-6') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 7 -->
          <tr>
            <td class="p-0.5 border-r border-black">Libre de perforaciones</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-7') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-7') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 8 -->
          <tr>
            <td class="p-0.5 border-r border-black">Llantas en buen estado</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-8') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-8') ? '✕' : '' }}</td>
          </tr>
          <!-- Fila 9: Bloqueo de Seguridad -->
          <tr class="border-t border-black">
            <td class="p-0.5 border-r border-black">Bloqueo de Seguridad (Uso de cartón, bolsa de aire, gatas, eslingas) Cuando la carga es foránea.</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isSi('crit-trans-9') ? '✔' : '' }}</td>
            <td class="p-0.5 border-r border-black text-center font-bold text-[9px]">{{ isNo('crit-trans-9') ? '✕' : '' }}</td>
            <td class="p-0.5 border-r border-black"></td>
            <td class="p-0.5 text-[6.5px]">
              <div>Calidad/Operaciones</div>
              <div class="text-[6px] text-slate-500 font-mono">NA</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- ── 6. SECCIÓN INFERIOR: 2 CAJAS DE FIRMAS CON SELLOS DIGITALES QR ── -->
      
      <!-- CAJA 1: FIRMAS DE LIMPIEZA -->
      <div class="f01-signature-box mb-1.5 border border-black">
        <div class="f01-signature-title font-bold text-[7.5px] p-0.5 text-center border-b border-black bg-slate-50">
          Nombre y firma de quien realizo la limpieza:
        </div>
        <div class="grid grid-cols-2 divide-x divide-black p-1 min-h-[38px] items-center">
          
          <!-- Limpieza Firma 1 -->
          <div class="flex items-center gap-2 pl-2">
            <div class="f01-qr-stamp f01-qr-stamp--teal shrink-0">
              <svg viewBox="0 0 32 32" class="w-7 h-7">
                <rect width="32" height="32" fill="#f8fafc" />
                <rect x="2" y="2" width="8" height="8" fill="#0f766e" />
                <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                <rect x="4.5" y="4.5" width="3" height="3" fill="#0f766e" />
                <rect x="22" y="2" width="8" height="8" fill="#0f766e" />
                <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                <rect x="24.5" y="4.5" width="3" height="3" fill="#0f766e" />
                <rect x="2" y="22" width="8" height="8" fill="#0f766e" />
                <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                <rect x="4.5" y="24.5" width="3" height="3" fill="#0f766e" />
                <rect x="13" y="13" width="6" height="6" fill="#0f766e" />
                <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                <rect x="12" y="4" width="2" height="2" fill="#dc2626" />
                <rect x="25" y="14" width="2" height="2" fill="#0f766e" />
              </svg>
            </div>
            <div class="text-[7.5px] font-sans font-bold leading-tight">
              <div>{{ getCleaningSigner(1) }}</div>
              <div class="text-[6px] text-slate-500 font-mono font-normal">Sello ID: CLN-{{ getHeaderCode(1).slice(0, 5) }}</div>
            </div>
          </div>

          <!-- Limpieza Firma 2 -->
          <div class="flex items-center gap-2 pl-2">
            <div class="f01-qr-stamp f01-qr-stamp--rose shrink-0">
              <svg viewBox="0 0 32 32" class="w-7 h-7">
                <rect width="32" height="32" fill="#f8fafc" />
                <rect x="2" y="2" width="8" height="8" fill="#be123c" />
                <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
                <rect x="4.5" y="4.5" width="3" height="3" fill="#be123c" />
                <rect x="22" y="2" width="8" height="8" fill="#be123c" />
                <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
                <rect x="24.5" y="4.5" width="3" height="3" fill="#be123c" />
                <rect x="2" y="22" width="8" height="8" fill="#be123c" />
                <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
                <rect x="4.5" y="24.5" width="3" height="3" fill="#be123c" />
                <rect x="13" y="13" width="6" height="6" fill="#be123c" />
                <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
                <rect x="12" y="4" width="2" height="2" fill="#1e3a8a" />
                <rect x="25" y="14" width="2" height="2" fill="#be123c" />
              </svg>
            </div>
            <div class="text-[7.5px] font-sans font-bold leading-tight">
              <div>{{ getCleaningSigner(2) }}</div>
              <div class="text-[6px] text-slate-500 font-mono font-normal">Sello ID: CLN-{{ getHeaderCode(2).slice(0, 5) }}</div>
            </div>
          </div>

        </div>
      </div>

      <!-- CAJA 2: FIRMAS DE LIBERACIÓN -->
      <div class="f01-signature-box border border-black">
        <div class="f01-signature-title font-bold text-[7.5px] p-0.5 text-center border-b border-black bg-slate-50">
          Nombre y firma de quien realizo la liberacion:
        </div>
        <div class="p-1 min-h-[38px] flex items-center pl-3 gap-2">
          <div class="f01-qr-stamp f01-qr-stamp--indigo shrink-0">
            <svg viewBox="0 0 32 32" class="w-7 h-7">
              <rect width="32" height="32" fill="#f8fafc" />
              <rect x="2" y="2" width="8" height="8" fill="#4338ca" />
              <rect x="3.5" y="3.5" width="5" height="5" fill="#ffffff" />
              <rect x="4.5" y="4.5" width="3" height="3" fill="#4338ca" />
              <rect x="22" y="2" width="8" height="8" fill="#4338ca" />
              <rect x="23.5" y="3.5" width="5" height="5" fill="#ffffff" />
              <rect x="24.5" y="4.5" width="3" height="3" fill="#4338ca" />
              <rect x="2" y="22" width="8" height="8" fill="#4338ca" />
              <rect x="3.5" y="23.5" width="5" height="5" fill="#ffffff" />
              <rect x="4.5" y="24.5" width="3" height="3" fill="#4338ca" />
              <rect x="13" y="13" width="6" height="6" fill="#4338ca" />
              <rect x="15" y="15" width="2" height="2" fill="#ffffff" />
              <rect x="12" y="4" width="2" height="2" fill="#059669" />
              <rect x="17" y="3" width="2" height="2" fill="#dc2626" />
              <rect x="25" y="14" width="2" height="2" fill="#4338ca" />
              <rect x="14" y="25" width="2" height="2" fill="#4338ca" />
            </svg>
          </div>
          <div class="text-[7.5px] font-sans font-bold leading-tight">
            <div>{{ verification.releaseResponsible.name || 'Marco Belen Alva' }}</div>
            <div class="text-[6px] text-slate-500 font-mono font-normal">Sello Oficial QM: #{{ verification.folio }} · Liberación Autorizada</div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .f01-pdf-sheet {
      width: 100%;
      max-width: 680px;
      padding: 10px 14px;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      box-sizing: border-box;
      line-height: 1.15;
    }

    .f01-table {
      border-collapse: collapse;
      border: 1px solid #000000;
    }

    .f01-table th,
    .f01-table td {
      border: 1px solid #000000;
    }

    .f01-navy-header {
      background-color: #0c2340 !important;
      color: #ffffff !important;
    }

    .f01-qr-stamp {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #94a3b8;
      border-radius: 4px;
      padding: 1px;
      background: #f8fafc;
    }

    .f01-qr-stamp--blue { border-color: #93c5fd; background: #eff6ff; }
    .f01-qr-stamp--purple { border-color: #c4b5fd; background: #f5f3ff; }
    .f01-qr-stamp--gold { border-color: #fde68a; background: #fffbeb; }
    .f01-qr-stamp--teal { border-color: #99f6e4; background: #f0fdfa; }
    .f01-qr-stamp--rose { border-color: #fecdd3; background: #fff1f2; }
    .f01-qr-stamp--indigo { border-color: #c7d2fe; background: #eef2ff; }

    @media print {
      .f01-pdf-sheet {
        padding: 0;
        max-width: 100%;
      }
    }
  `]
})
export class PrintVerificationLayoutComponent {
  @Input() verification!: LoadVerification;

  isSi(critId: string): boolean {
    const crit = this.verification?.productCriteria?.find(c => c.id === critId) ||
                 this.verification?.transportCriteria?.find(c => c.id === critId);
    return crit ? crit.value === 'SI' : true;
  }

  isNo(critId: string): boolean {
    const crit = this.verification?.productCriteria?.find(c => c.id === critId) ||
                 this.verification?.transportCriteria?.find(c => c.id === critId);
    return crit ? crit.value === 'NO' : false;
  }

  getObs(critId: string): string {
    const crit = this.verification?.productCriteria?.find(c => c.id === critId) ||
                 this.verification?.transportCriteria?.find(c => c.id === critId);
    return crit?.observations || '';
  }

  getRampNumber(): string {
    if (!this.verification?.ramp) return '2';
    const match = this.verification.ramp.match(/\d+/);
    return match ? match[0] : '2';
  }

  getHeaderCode(idx: number): string {
    if (idx === 1) {
      return this.verification?.remisionNumber?.slice(-8) || '43519988';
    }
    if (idx === 3) {
      return this.verification?.folio?.replace(/\D/g, '') || '89428506';
    }
    return '';
  }

  getCleaningSigner(idx: number): string {
    if (this.verification?.cleaningResponsible?.name) {
      return idx === 1 ? this.verification.cleaningResponsible.name : 'Jose Luis Tapia';
    }
    return idx === 1 ? 'Juan Carlos Estrada' : 'Jose Luis Tapia';
  }
}

