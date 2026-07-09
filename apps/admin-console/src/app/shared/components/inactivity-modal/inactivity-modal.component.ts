/**
 * @file inactivity-modal.component.ts
 * @description Componente modal de advertencia de inactividad (HU-004).
 *
 * Muestra una cuenta regresiva de 60 segundos antes de cerrar sesión automáticamente.
 * Ofrece la opción de mantener la sesión activa llamando a POST /auth/refresh.
 * Utiliza opacidad y desenfoque del fondo (#121414 con backdrop-blur) para proteger datos sensibles.
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InactivityService } from '../../../core/services/inactivity.service';

@Component({
  selector: 'fg-inactivity-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inactivity-modal.component.html',
  styleUrl: './inactivity-modal.component.css'
})
export class InactivityModalComponent {
  protected readonly inactivityService = inject(InactivityService);

  /**
   * Solicita al servicio mantener la sesión activa.
   */
  protected keepAlive(): void {
    this.inactivityService.keepSessionAlive();
  }

  /**
   * Solicita al servicio cerrar sesión de forma manual e inmediata.
   */
  protected logoutNow(): void {
    this.inactivityService.autoLogout();
  }
}
