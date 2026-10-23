/**
 * @file main.ts
 * @description Punto de entrada de la aplicación admin-console.
 * Inicializa Angular 17 con bootstrap en modo standalone.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent }         from './app/app.component';
import { appConfig }            from './app/app.config';

// Auto-recuperación ante chunks desactualizados (evita error 404 en lazy imports tras recompilaciones o despliegues)
window.addEventListener('error', (event) => {
  const msg = event?.message || '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Loading chunk')) {
    console.warn('[4GUARD] Chunk desactualizado detectado. Recargando página con el bundle vigente...');
    window.location.reload();
  }
});

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error('[4GUARD Admin] Error al iniciar la aplicación:', err),
);
