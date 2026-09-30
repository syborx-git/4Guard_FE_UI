/**
 * @file toast-container.component.ts
 * @description Contenedor Global de Notificaciones Toast para RF Terminal PWA.
 * Diseñado bajo estándar SDD Liquid Glass con soporte completo Dual Theme (Light & Dark).
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '@4guard/shared-core';

@Component({
  selector: 'fg-rf-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css',
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
