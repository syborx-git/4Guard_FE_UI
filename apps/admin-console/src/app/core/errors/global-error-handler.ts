import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const errorStr = (error?.message || error?.toString() || '').toLowerCase();
    
    // Detectar fallos al cargar chunks dinámicos tras un nuevo despliegue en servidor
    if (
      errorStr.includes('failed to fetch dynamically imported module') ||
      errorStr.includes('loading chunk') ||
      errorStr.includes('failed to load module script') ||
      errorStr.includes('importing a module script failed')
    ) {
      const lastReload = sessionStorage.getItem('chunk_reload_ts');
      const now = Date.now();
      // Prevención de bucles: permitir recarga solo si no ha ocurrido en los últimos 15 segundos
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('chunk_reload_ts', now.toString());
        console.warn('[ChunkLoader] Nueva versión de la aplicación detectada. Recargando para actualizar los módulos...', error);
        window.location.reload();
        return;
      }
    }

    console.error('[GlobalErrorHandler]', error);
  }
}
