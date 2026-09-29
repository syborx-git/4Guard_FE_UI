import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  /**
   * Genera internamente el documento jsPDF para descarga física de archivo .pdf.
   * Utiliza html2canvas optimizado a 2x DPI.
   */
  private async createPdfDocument(target: HTMLElement | string): Promise<{ pdf: jsPDF; canvas: HTMLCanvasElement } | null> {
    let element: HTMLElement | null = null;
    if (typeof target === 'string') {
      element = document.querySelector<HTMLElement>(target);
    } else {
      element = target;
    }

    if (!element) {
      console.warn('[PrintService] No se encontró el elemento a procesar:', target);
      return null;
    }

    const canvas = await html2canvas(element, {
      scale: 2, // Calidad retina 2x para nitidez y fidelidad exacta
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8; // Margen simétrico de 8mm
    const maxUsableWidth = pageWidth - (margin * 2);
    const maxUsableHeight = pageHeight - (margin * 2);

    let printWidth = maxUsableWidth;
    let printHeight = (canvas.height * printWidth) / canvas.width;

    if (printHeight <= maxUsableHeight * 1.35) {
      if (printHeight > maxUsableHeight) {
        const scaleFactor = maxUsableHeight / printHeight;
        printHeight = maxUsableHeight;
        printWidth = printWidth * scaleFactor;
      }
      const xOffset = margin + (maxUsableWidth - printWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, printWidth, printHeight);
    } else {
      let heightLeft = printHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight);
      heightLeft -= maxUsableHeight;

      while (heightLeft > 0) {
        position = heightLeft - printHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printWidth, printHeight);
        heightLeft -= maxUsableHeight;
      }
    }

    return { pdf, canvas };
  }

  /**
   * Genera y descarga directamente un archivo PDF con el nombre exacto especificado (ej: "26510.pdf").
   *
   * @param target Elemento DOM o selector CSS
   * @param filename Nombre del archivo (ej. "26510")
   */
  public async downloadPdf(target: HTMLElement | string, filename: string): Promise<void> {
    try {
      const doc = await this.createPdfDocument(target);
      if (!doc) return;

      const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      doc.pdf.save(cleanFilename);
    } catch (err) {
      console.error('[PrintService] Error al generar PDF directo:', err);
    }
  }

  /**
   * Imprime de forma física el documento de manera INSTANTÁNEA (<50ms).
   * Utiliza renderizado HTML nativo vectorial dentro de un iframe aislado,
   * replicando todas las hojas de estilo y Tailwind CSS sin sobrecargar la CPU ni generar canvas pesados.
   *
   * @param target Elemento DOM o selector CSS del contenedor a imprimir
   * @param documentTitle Título del documento en la ventana de impresión
   */
  public printElement(target: HTMLElement | string, documentTitle = 'Comprobante'): void {
    try {
      let element: HTMLElement | null = null;
      if (typeof target === 'string') {
        element = document.querySelector<HTMLElement>(target);
      } else {
        element = target;
      }

      if (!element) {
        console.warn('[PrintService] No se encontró el elemento para imprimir:', target);
        return;
      }

      const cleanTitle = documentTitle.replace(/\.pdf$/i, '');

      // 1. Recopilar todas las hojas de estilo del documento (Tailwind, fuentes, iconos)
      const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      // 2. Crear iframe invisible para impresión limpia
      const iframe = document.createElement('iframe');
      iframe.name = 'fg-instant-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        window.print();
        return;
      }

      // 3. Escribir documento HTML limpio con reglas de impresión exactas
      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <title>${cleanTitle}</title>
            ${styleSheets}
            <style>
              @page {
                size: letter portrait;
                margin: 6mm;
              }
              @media print {
                html, body {
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .no-print, .modal-overlay, button {
                  display: none !important;
                }
                .print-container {
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  max-width: 100% !important;
                  width: 100% !important;
                }
              }
              body {
                margin: 0;
                padding: 0;
                background-color: #ffffff !important;
                color: #000000 !important;
                font-family: inherit;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
            </style>
          </head>
          <body class="bg-white text-black p-0 m-0">
            ${element.outerHTML}
          </body>
        </html>
      `);
      frameDoc.close();

      // 4. Disparar impresión nativa una vez montado el DOM del iframe (inmediato)
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('[PrintService] Fallback de impresión:', err);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 50);

    } catch (err) {
      console.error('[PrintService] Error en printElement:', err);
      window.print();
    }
  }
}
