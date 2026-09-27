import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class PrintService {

  /**
   * Genera internamente el documento jsPDF en alta resolución (2x DPI)
   * garantizando que el diseño, tipografía, márgenes y alineación sean 100% idénticos
   * tanto al Descargar PDF como al Imprimir físicamente.
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
    const margin = 8; // Margen simétrico optimizado de 8mm
    const maxUsableWidth = pageWidth - (margin * 2);
    const maxUsableHeight = pageHeight - (margin * 2);

    let printWidth = maxUsableWidth;
    let printHeight = (canvas.height * printWidth) / canvas.width;

    // Si el contenido cabe o excede ligeramente (hasta 35%, ej. 22-28 tarimas),
    // auto-escalar para que entre en 1 sola hoja de forma impecable sin cortar filas
    if (printHeight <= maxUsableHeight * 1.35) {
      if (printHeight > maxUsableHeight) {
        const scaleFactor = maxUsableHeight / printHeight;
        printHeight = maxUsableHeight;
        printWidth = printWidth * scaleFactor;
      }
      const xOffset = margin + (maxUsableWidth - printWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, margin, printWidth, printHeight);
    } else {
      // Documento multi-página extenso
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
   * Genera y descarga directamente un archivo PDF con el nombre exacto especificado (ej: "26510.pdf")
   * con 1 solo clic, descargándolo de forma inmediata en la carpeta de descargas del usuario.
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
   * Imprime de forma física el documento garantizando el MISMO ajuste perfecto que el PDF
   * (utilizando el mismo motor de renderizado exacto sin deformaciones de fuentes ni márgenes).
   *
   * @param target Elemento DOM o selector CSS del contenedor a imprimir
   * @param documentTitle Título del documento en el PDF
   */
  public async printElement(target: HTMLElement | string, documentTitle = 'Comprobante'): Promise<void> {
    try {
      const doc = await this.createPdfDocument(target);
      if (!doc) return;

      const cleanTitle = documentTitle.replace(/\.pdf$/i, '');
      const originalTitle = document.title;
      document.title = cleanTitle;

      // Crear iframe con el Blob URL del PDF idéntico
      const blob = doc.pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.name = 'fg-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('[PrintService] Fallback de impresión directa:', err);
            window.open(blobUrl, '_blank');
          } finally {
            setTimeout(() => {
              document.title = originalTitle;
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              URL.revokeObjectURL(blobUrl);
            }, 2500);
          }
        }, 250);
      };
    } catch (err) {
      console.error('[PrintService] Error en printElement:', err);
    }
  }
}
