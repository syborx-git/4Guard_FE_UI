/**
 * @file print-gate-qr-poster-layout.component.ts
 * @description Cartel oficial para imprimir en tamaño Carta Horizontal (Letter Landscape 11" × 8.5")
 * para colocar en la Caseta de Entrada / Vigilancia.
 * Permite a los transportistas auto-registrarse escaneando el código QR con su smartphone.
 * 
 * Versión 4: Layout Centrado de Alta Velocidad.
 * El código QR es el protagonista central ampliado (65mm × 65mm) para enfoque y escaneo ultrarrápido.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GateQrPosterPrintData {
  title?: string;
  subtitle?: string;
  branchName?: string;
  branchCode?: string;
  periodLabel?: string;
  targetUrl: string;
  qrDataUrl: string;
  emergencyPhone?: string;
}

@Component({
  selector: 'fg-print-gate-qr-poster-layout',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="poster-sheet">
      <!-- Borde Perimetral Doble de Seguridad Oficial -->
      <div class="poster-inner-frame">
        
        <!-- ── ENCABEZADO INSTITUCIONAL HORIZONTAL ── -->
        <header class="poster-header">
          <div class="poster-header__brand">
            <div class="poster-logo-box">
              <img src="assets/logo-4guard.svg" alt="4GUARD Logo" class="poster-logo-img" />
            </div>
            <div class="poster-brand-text">
              <div class="poster-title-row">
                <h1 class="poster-title-sys">4GUARD WMS</h1>
                <span class="poster-corp-tag">SEGURIDAD PATRIMONIAL & OPERACIONES 3PL</span>
              </div>
              <p class="poster-subtitle-sys">CONTROL DE ACCESO VEHICULAR • PROTOCOLO DE INSPECCIÓN EN CASETA</p>
            </div>
          </div>

          <div class="poster-header__meta">
            <div class="meta-tag">FORMATO OFICIAL</div>
            <div class="meta-code">F01-PO-CP-7.1.3-03-QR</div>
            <div class="meta-rev">REV. 04 • C-TPAT COMPLIANT</div>
          </div>
        </header>

        <!-- ── BANNER HERO SUPERIOR ── -->
        <div class="poster-hero-strip">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            <span>INGRESO OBLIGATORIO A PLANTA</span>
          </div>
          <h2 class="poster-headline">AUTO-REGISTRO DIGITAL DE TRANSPORTE</h2>
          <p class="poster-subheadline">
            Estimado operador: apunte la cámara de su celular al código QR central para registrar su unidad y agilizar su ingreso a rampa en 1 minuto.
          </p>
        </div>

        <!-- ── ZONA CENTRAL EN 3 BLOQUES (QR PROTAGONISTA EN EL CENTRO) ── -->
        <main class="poster-center-grid">
          
          <!-- BLOQUE IZQUIERDO: NORMAS EPP Y PATIO -->
          <section class="side-panel">
            <div class="panel-box safety-panel">
              <div class="panel-title text-amber-800">
                <span class="panel-icon">⚠️</span>
                <span>NORMAS EN PATIO (EPP)</span>
              </div>
              <div class="safety-list">
                <div class="safety-row">
                  <span class="safety-emoji">🦺</span>
                  <div><strong>Chaleco reflejante</strong> obligatorio</div>
                </div>
                <div class="safety-row">
                  <span class="safety-emoji">🥾</span>
                  <div><strong>Botas con casquillo</strong> de acero</div>
                </div>
                <div class="safety-row">
                  <span class="safety-emoji">🚸</span>
                  <div>Velocidad máxima: <strong>10 km/h</strong></div>
                </div>
                <div class="safety-row">
                  <span class="safety-emoji">🚫</span>
                  <div><strong>Prohibido descender</strong> sin permiso</div>
                </div>
              </div>
            </div>

            <div class="panel-box hint-panel">
              <div class="panel-title text-slate-800">
                <span class="panel-icon">💡</span>
                <span>¿CÓMO ESCANEAR?</span>
              </div>
              <p class="hint-text">
                Abra la <strong>cámara normal</strong> de su iPhone o Android y apunte al cuadro del centro. Toque el enlace amarillo o amarillo-dorado que aparecerá en pantalla.
              </p>
            </div>
          </section>

          <!-- BLOQUE CENTRAL: CÓDIGO QR GIGANTE Y DESTACADO -->
          <section class="center-qr-section">
            <div class="qr-master-card">
              <!-- Esquinas doradas de seguridad -->
              <div class="qr-corner qr-corner--tl"></div>
              <div class="qr-corner qr-corner--tr"></div>
              <div class="qr-corner qr-corner--bl"></div>
              <div class="qr-corner qr-corner--br"></div>

              <div class="qr-header-pill">
                <span class="qr-scan-icon">📷</span>
                <span>ENFOQUE AQUÍ CON SU CÁMARA</span>
              </div>

              <!-- Contenedor central del QR con dimensiones aumentadas -->
              <div class="qr-box">
                <img
                  [src]="data.qrDataUrl"
                  alt="Código QR de Auto-Registro Caseta"
                  class="qr-code-img"
                />
                
                <!-- Escudo Oficial Central de 4GUARD -->
                <div class="qr-center-badge">
                  <img src="assets/logo-4guard.svg" alt="4GUARD" class="qr-center-logo" />
                </div>
              </div>

              <!-- URL Directa de Respaldo -->
              <div class="qr-url-card">
                <span class="qr-url-label">Enlace Directo de Auto-Registro:</span>
                <span class="qr-url-text">{{ data.targetUrl }}</span>
              </div>
            </div>
          </section>

          <!-- BLOQUE DERECHO: SUCURSAL, VIGENCIA Y PROTOCOLO -->
          <section class="side-panel">
            <div class="panel-box branch-panel">
              <div class="panel-title text-slate-100">
                <span class="panel-icon">🏢</span>
                <span>CENTRO DE DISTRIBUCIÓN</span>
              </div>
              <div class="meta-data-rows">
                <div class="data-row">
                  <span class="data-lbl">SUCURSAL:</span>
                  <span class="data-val">{{ data.branchName || 'TOLUCA' }}</span>
                </div>
                <div class="data-row">
                  <span class="data-lbl">CÓDIGO:</span>
                  <span class="data-val-mono">{{ data.branchCode || 'BR-TOL-01' }}</span>
                </div>
                <div class="data-divider"></div>
                <div class="data-row">
                  <span class="data-lbl">VIGENCIA:</span>
                  <span class="data-val-gold">{{ data.periodLabel || 'VIGENCIA ACTIVA' }}</span>
                </div>
              </div>
              <div class="auth-strip">
                <span class="auth-dot"></span>
                <span>AUTORIZADO POR SEGURIDAD PATRIMONIAL</span>
              </div>
            </div>

            <div class="panel-box contact-panel">
              <div class="panel-title text-slate-800">
                <span class="panel-icon">📞</span>
                <span>ATENCIÓN EN VENTANILLA</span>
              </div>
              <p class="contact-desc">Dudas o asistencia con su pase:</p>
              <div class="phone-badge">
                <span>Vigilancia:</span>
                <strong>{{ data.emergencyPhone || '722-442-4827' }}</strong>
              </div>
            </div>
          </section>
        </main>

        <!-- ── FILA INFERIOR: 3 PASOS HORIZONTALES PARA EL OPERADOR ── -->
        <div class="poster-steps-horizontal">
          <div class="step-card">
            <div class="step-badge">1</div>
            <div class="step-info">
              <div class="step-title">📱 ESCANEE EL QR</div>
              <div class="step-desc">Apunte la cámara de su teléfono al cuadro central.</div>
            </div>
          </div>

          <div class="step-arrow">➔</div>

          <div class="step-card">
            <div class="step-badge">2</div>
            <div class="step-info">
              <div class="step-title">📝 COMPLETE DATOS</div>
              <div class="step-desc">Capture placas, transportista, remisión y sellos.</div>
            </div>
          </div>

          <div class="step-arrow">➔</div>

          <div class="step-card">
            <div class="step-badge">3</div>
            <div class="step-info">
              <div class="step-title">🪪 NOTIFIQUE EN CASETA</div>
              <div class="step-desc">Firme en pantalla y muestre su INE al guardia para rampa.</div>
            </div>
          </div>
        </div>

        <!-- ── PIE DE PÁGINA INSTITUCIONAL ── -->
        <footer class="poster-footer">
          <div class="footer-left">
            <strong>4GUARD WMS</strong> • Seguridad Patrimonial, Control de Pérdidas y Auditoría C-TPAT.
          </div>
          <div class="footer-right">
            En caso de requerir apoyo técnico o reporte de incidente, notifique al guardia en turno.
          </div>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      color: #0f172a;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0 auto;
    }

    /* ── HOJA CARTA HORIZONTAL / LANDSCAPE (Letter: 279.4mm × 215.9mm) ── */
    .poster-sheet {
      width: 279.4mm;
      height: 215.9mm;
      min-height: 215.9mm;
      max-height: 215.9mm;
      box-sizing: border-box;
      background: #ffffff;
      padding: 4.5mm 5.5mm;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), 0 2px 10px rgba(0, 0, 0, 0.25);
      position: relative;
      overflow: hidden;
      margin: 0 auto;
      border-radius: 4px;
    }

    /* ── MARCO DOBLE DE SEGURIDAD ── */
    .poster-inner-frame {
      border: 2.2px solid #0f172a;
      outline: 1.5px solid #d0af67;
      outline-offset: -2.5mm;
      padding: 3mm 4.5mm;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
      position: relative;
    }

    /* ── ENCABEZADO INSTITUCIONAL HORIZONTAL ── */
    .poster-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 2mm;
    }

    .poster-header__brand {
      display: flex;
      align-items: center;
      gap: 3mm;
    }

    .poster-logo-box {
      width: 12mm;
      height: 12mm;
      background: #0f172a;
      border-radius: 2mm;
      border: 1.5px solid #d0af67;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.2mm;
      box-sizing: border-box;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }

    .poster-logo-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .poster-brand-text {
      display: flex;
      flex-direction: column;
    }

    .poster-title-row {
      display: flex;
      align-items: baseline;
      gap: 2.5mm;
    }

    .poster-title-sys {
      font-size: 15pt;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .poster-corp-tag {
      font-size: 7pt;
      font-weight: 800;
      color: #b45309;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: #fef3c7;
      padding: 0.5mm 2mm;
      border-radius: 1mm;
      border: 1px solid #fde68a;
    }

    .poster-subtitle-sys {
      font-size: 6.5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.06em;
      margin: 0.8mm 0 0 0;
      text-transform: uppercase;
    }

    .poster-header__meta {
      text-align: right;
    }

    .meta-tag {
      font-size: 6pt;
      font-weight: 900;
      background: #0f172a;
      color: #f8fafc;
      padding: 0.6mm 2mm;
      border-radius: 1mm;
      letter-spacing: 0.08em;
      display: inline-block;
    }

    .meta-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7.2pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0.6mm;
      letter-spacing: 0.02em;
    }

    .meta-rev {
      font-size: 5.8pt;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    /* ── BANNER HERO SUPERIOR ── */
    .poster-hero-strip {
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 2mm;
      padding: 1.8mm 3mm;
      margin: 1.8mm 0;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 1.5mm;
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      padding: 0.3mm 2mm;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-bottom: 0.6mm;
    }

    .badge-dot {
      width: 1.4mm;
      height: 1.4mm;
      border-radius: 50%;
      background: #d97706;
    }

    .poster-headline {
      font-size: 13pt;
      font-weight: 900;
      color: #0f172a;
      margin: 0.3mm 0;
      letter-spacing: 0.01em;
      line-height: 1.15;
    }

    .poster-subheadline {
      font-size: 7pt;
      color: #475569;
      line-height: 1.25;
      margin: 0;
      font-weight: 600;
    }

    /* ── ZONA CENTRAL (3 COLUMNAS: LATERAL - QR HERO - LATERAL) ── */
    .poster-center-grid {
      display: grid;
      grid-template-columns: 78mm 1fr 78mm;
      gap: 3.5mm;
      align-items: center;
      margin: 1.5mm 0;
      flex: 1;
    }

    .side-panel {
      display: flex;
      flex-direction: column;
      gap: 2.2mm;
      height: 100%;
      justify-content: center;
    }

    .panel-box {
      border-radius: 2mm;
      padding: 2.2mm 2.8mm;
      box-sizing: border-box;
    }

    .safety-panel {
      background: #fffbeb;
      border: 1.2px solid #fde68a;
    }

    .hint-panel {
      background: #f1f5f9;
      border: 1.2px solid #cbd5e1;
    }

    .branch-panel {
      background: #0f172a;
      color: #f8fafc;
      border: 1.2px solid #d0af67;
    }

    .contact-panel {
      background: #f8fafc;
      border: 1.2px solid #e2e8f0;
      text-align: center;
    }

    .panel-title {
      display: flex;
      align-items: center;
      gap: 1.5mm;
      font-size: 6.8pt;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 1.2mm;
    }

    .panel-icon {
      font-size: 8pt;
    }

    .safety-list {
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }

    .safety-row {
      display: flex;
      align-items: center;
      gap: 1.8mm;
      font-size: 6.5pt;
      color: #1e293b;
      line-height: 1.2;
    }

    .safety-emoji {
      font-size: 9pt;
      line-height: 1;
    }

    .hint-text {
      font-size: 6.3pt;
      color: #334155;
      line-height: 1.3;
      margin: 0;
    }

    /* Datos de Sucursal y Vigencia */
    .meta-data-rows {
      display: flex;
      flex-direction: column;
      gap: 0.8mm;
    }

    .data-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.6pt;
    }

    .data-lbl {
      color: #94a3b8;
      font-weight: 700;
    }

    .data-val {
      font-weight: 900;
      color: #f8fafc;
    }

    .data-val-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 800;
      color: #e2e8f0;
    }

    .data-val-gold {
      font-weight: 900;
      color: #fbbf24;
      letter-spacing: 0.03em;
    }

    .data-divider {
      height: 1px;
      background: #334155;
      margin: 0.4mm 0;
    }

    .auth-strip {
      display: flex;
      align-items: center;
      gap: 1.5mm;
      font-size: 5.5pt;
      font-weight: 800;
      color: #34d399;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: 1mm;
      padding-top: 0.8mm;
      border-top: 1px dashed #334155;
    }

    .auth-dot {
      width: 1.4mm;
      height: 1.4mm;
      border-radius: 50%;
      background: #10b981;
    }

    .contact-desc {
      font-size: 6pt;
      color: #64748b;
      margin: 0 0 1mm 0;
    }

    .phone-badge {
      display: inline-flex;
      align-items: center;
      gap: 1.5mm;
      background: #0f172a;
      color: #fbbf24;
      font-size: 7.2pt;
      padding: 1mm 2.5mm;
      border-radius: 1.5mm;
      border: 1px solid #d0af67;
    }

    /* ── SECCIÓN CENTRAL: CÓDIGO QR GIGANTE (PROTAGONISTA) ── */
    .center-qr-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .qr-master-card {
      background: #ffffff;
      border: 2.2px solid #0f172a;
      border-radius: 3mm;
      padding: 2.5mm 3.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.15);
      box-sizing: border-box;
      width: 100%;
      max-width: 95mm;
    }

    /* Esquinas doradas de seguridad */
    .qr-corner {
      position: absolute;
      width: 4.5mm;
      height: 4.5mm;
      border-color: #d0af67;
      border-style: solid;
    }
    .qr-corner--tl { top: -1px; left: -1px; border-width: 2.5px 0 0 2.5px; }
    .qr-corner--tr { top: -1px; right: -1px; border-width: 2.5px 2.5px 0 0; }
    .qr-corner--bl { bottom: -1px; left: -1px; border-width: 0 0 2.5px 2.5px; }
    .qr-corner--br { bottom: -1px; right: -1px; border-width: 0 2.5px 2.5px 0; }

    .qr-header-pill {
      background: #0f172a;
      color: #f8fafc;
      font-size: 6.8pt;
      font-weight: 900;
      letter-spacing: 0.1em;
      padding: 1mm 4mm;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 1.5mm;
      margin-bottom: 2mm;
      border: 1px solid #d0af67;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }

    .qr-scan-icon {
      font-size: 8pt;
    }

    /* QR Box Ampliado a 65mm x 65mm (Super Visible) */
    .qr-box {
      position: relative;
      width: 65mm;
      height: 65mm;
      background: #ffffff;
      border-radius: 2mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1mm;
      box-sizing: border-box;
    }

    .qr-code-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    /* Escudo Oficial en el centro del QR */
    .qr-center-badge {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 9.5mm;
      height: 9.5mm;
      background: #0f172a;
      border: 1.8px solid #d0af67;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 0 2px #ffffff, 0 2px 6px rgba(0, 0, 0, 0.4);
      padding: 1.2mm;
      box-sizing: border-box;
    }

    .qr-center-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .qr-url-card {
      margin-top: 1.8mm;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 1.5mm;
      padding: 0.8mm 2mm;
      text-align: center;
      width: 94%;
    }

    .qr-url-label {
      display: block;
      font-size: 5.2pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .qr-url-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 5.8pt;
      font-weight: 800;
      color: #0f172a;
      word-break: break-all;
    }

    /* ── FILA INFERIOR: 3 PASOS HORIZONTALES PARA EL OPERADOR ── */
    .poster-steps-horizontal {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2.5mm;
      margin: 1.8mm 0;
      background: #f8fafc;
      border: 1.2px solid #cbd5e1;
      border-radius: 2mm;
      padding: 2mm 3.5mm;
    }

    .step-card {
      display: flex;
      align-items: center;
      gap: 2.5mm;
      flex: 1;
    }

    .step-badge {
      width: 6.5mm;
      height: 6.5mm;
      border-radius: 50%;
      background: #0f172a;
      color: #d0af67;
      font-size: 8.5pt;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      shrink: 0;
      border: 1.2px solid #d0af67;
    }

    .step-info {
      display: flex;
      flex-direction: column;
    }

    .step-title {
      font-size: 7.2pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.03em;
    }

    .step-desc {
      font-size: 6.2pt;
      color: #475569;
      line-height: 1.2;
      font-weight: 500;
    }

    .step-arrow {
      font-size: 11pt;
      color: #94a3b8;
      font-weight: bold;
    }

    /* ── PIE DE PÁGINA ── */
    .poster-footer {
      border-top: 1.5px solid #0f172a;
      padding-top: 1.5mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 5.6pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .footer-left strong {
      color: #0f172a;
    }

    .footer-right {
      color: #475569;
      font-weight: 600;
    }

    /* ── REGLAS DE IMPRESIÓN OFICIALES (@media print) ── */
    @media print {
      :host {
        display: block !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      @page {
        size: letter landscape;
        margin: 0;
      }

      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      .poster-sheet {
        box-shadow: none !important;
        margin: 0 auto !important;
        padding: 4.5mm 5.5mm !important;
        width: 279.4mm !important;
        height: 215.9mm !important;
        max-width: 100% !important;
        max-height: 100% !important;
        page-break-after: avoid !important;
        page-break-inside: avoid !important;
        border-radius: 0 !important;
      }
    }
  `]
})
export class PrintGateQrPosterLayoutComponent {
  @Input({ required: true }) data!: GateQrPosterPrintData;
}
