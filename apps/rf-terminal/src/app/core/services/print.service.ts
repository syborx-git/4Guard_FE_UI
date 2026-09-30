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
   * Genera y descarga directamente un archivo PDF con el nombre exacto especificado (ej: "REC-2026-000104.pdf").
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
   * Imprime de forma física el documento instantáneamente mediante un iframe aislado.
   */
  public printElementDirect(target: HTMLElement | string, documentTitle = 'Documento Oficial 4GUARD'): void {
    let element: HTMLElement | null = null;
    if (typeof target === 'string') {
      element = document.querySelector<HTMLElement>(target);
    } else {
      element = target;
    }

    if (!element) {
      console.warn('[PrintService] Elemento no encontrado para imprimir:', target);
      return;
    }

    // Clonar el contenido HTML del elemento a imprimir
    const printContent = element.outerHTML;

    // Recolectar todas las etiquetas <style> y <link rel="stylesheet"> del documento principal
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    // Crear iframe oculto en el DOM
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.error('[PrintService] No se pudo acceder al contexto del iframe');
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>${documentTitle}</title>
          ${styles}
          <style>
            @page {
              size: letter portrait;
              margin: 6mm;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .f01-print-sheet {
              border: none !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    doc.close();

    // Invocar la ventana nativa de impresión
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  }
}
