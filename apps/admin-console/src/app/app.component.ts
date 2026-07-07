/**
 * @file app.component.ts
 * @description Componente raíz de la Consola Administrativa 4GUARD.
 * Actúa como host del router outlet y del diseño global.
 */

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { InactivityService } from './core/services/inactivity.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { InactivityModalComponent } from './shared/components/inactivity-modal/inactivity-modal.component';

@Component({
  selector: 'fg-admin-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, InactivityModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = '4GUARD WMS — Consola Administrativa';

  // Inyectar el servicio para activar el tracking de inactividad global
  protected readonly inactivityService = inject(InactivityService);
}
