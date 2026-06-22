/**
 * @file main.ts
 * @description Punto de entrada de la aplicación rf-terminal (PWA).
 */

import { bootstrapApplication }   from '@angular/platform-browser';
import { AppComponent }           from './app/app.component';
import { appConfig }              from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error('[4GUARD RF Terminal] Error al iniciar:', err),
);
