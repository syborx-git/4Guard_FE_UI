/**
 * @file qr-simulator-card.component.ts
 * @description Componente visual para la simulación de escaneo de pase de acceso QR en caseta de seguridad.
 * Módulo Autónomo de Seguridad — 4GUARD WMS.
 */

import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'fg-qr-simulator-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-simulator-card.component.html',
  styleUrl: './qr-simulator-card.component.css',
})
export class QrSimulatorCardComponent {
  @Output() scanSimulated = new EventEmitter<void>();

  protected isScanning = false;

  protected triggerScan(): void {
    this.isScanning = true;
    setTimeout(() => {
      this.isScanning = false;
      this.scanSimulated.emit();
    }, 600);
  }
}
