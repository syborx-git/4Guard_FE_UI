/**
 * @file main.ts
 * @description Punto de entrada de la aplicación admin-console.
 * Inicializa Angular 17 con bootstrap en modo standalone.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent }         from './app/app.component';
import { appConfig }            from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error('[4GUARD Admin] Error al iniciar la aplicación:', err),
);
