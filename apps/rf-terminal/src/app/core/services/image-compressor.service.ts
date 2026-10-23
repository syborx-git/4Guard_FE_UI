/**
 * @file image-compressor.service.ts
 * @description Servicio cliente para compresión de fotografías de evidencia (HU-020, HU-164).
 * Utiliza Canvas HTML5 para reducir imágenes a un tamaño máximo de 1024x768 px y ~150 KB JPEG,
 * evitando saturar la cuota de IndexedDB y agilizando la sincronización.
 */

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageCompressorService {
  /**
   * Comprime un archivo de imagen en el cliente usando HTML5 Canvas.
   * @param file Archivo File obtenido del input file / cámara.
   * @param maxWidth Ancho máximo en píxeles (por defecto 1024).
   * @param quality Calidad de compresión JPEG (0.0 a 1.0, por defecto 0.75).
   * @returns Promise con la imagen comprimida en Base64 DataURL.
   */
  compressPhoto(file: File, maxWidth = 1024, quality = 0.75): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            const scale = maxWidth / width;
            width = maxWidth;
            height = img.height * scale;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(img.src); // Fallback
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Retorna la imagen optimizada en JPEG (~150 KB)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (error) => reject(error);
    });
  }
}
