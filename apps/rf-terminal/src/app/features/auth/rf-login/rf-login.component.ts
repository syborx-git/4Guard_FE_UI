/**
 * @file rf-login.component.ts
 * @description P6 — Login RF (Acceso Rápido) [HU-002].
 * Botón masivo para QR/RFID. PIN numérico como alternativa.
 * Validación offline contra caché local.
 */

import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState, AuthService } from '@4guard/shared-core';

type LoginMode = 'scan' | 'pin';

@Component({
  selector: 'fg-rf-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rf-login.component.html',
  styleUrl: './rf-login.component.css',
})
export class RfLoginComponent {
  private readonly authState   = inject(AuthState);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  protected readonly mode       = signal<LoginMode>('scan');
  protected readonly pin        = signal<string>('');
  protected readonly isScanning = signal(false);
  protected readonly isLoading  = signal(false);
  protected readonly error      = signal<string | null>(null);
  protected readonly isOffline  = signal(!navigator.onLine);

  // Mock users for offline PIN auth
  private readonly MOCK_PINS: Record<string, { name: string; role: string; email: string }> = {
    '1234': { name: 'Roberto Sánchez', role: 'ROLE_WAREHOUSE_OPERATOR', email: 'op@4guard.mx' },
    '5678': { name: 'Miguel Torres',   role: 'ROLE_DOCK_SUPERVISOR',    email: 'dock@4guard.mx' },
    '0000': { name: 'Ana López',       role: 'ROLE_QM_INSPECTOR',       email: 'qm@4guard.mx' },
  };

  protected get pinDisplay(): string {
    return '●'.repeat(this.pin().length) + '•'.repeat(Math.max(0, 4 - this.pin().length));
  }

  protected get canSubmitPin(): boolean {
    return this.pin().length === 4;
  }

  protected switchMode(m: LoginMode): void {
    this.mode.set(m);
    this.pin.set('');
    this.error.set(null);
  }

  protected appendPin(digit: string): void {
    if (this.pin().length < 4) {
      this.pin.update(p => p + digit);
      this.error.set(null);
    }
  }

  protected deletePin(): void {
    this.pin.update(p => p.slice(0, -1));
  }

  protected clearPin(): void {
    this.pin.set('');
  }

  protected simulateScan(): void {
    this.isScanning.set(true);
    this.error.set(null);

    // Simula tiempo de escaneo de QR/RFID
    setTimeout(() => {
      this.isScanning.set(false);
      // Simula autenticación exitosa con usuario operario
      this.handleAuthSuccess('op@4guard.mx');
    }, 2000);
  }

  protected submitPin(): void {
    const pin = this.pin();
    const user = this.MOCK_PINS[pin];

    if (!user) {
      this.error.set('PIN incorrecto. Intenta de nuevo.');
      this.pin.set('');
      return;
    }

    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.handleAuthSuccess(user.email);
    }, 800);
  }

  private handleAuthSuccess(email: string): void {
    // Autenticar al usuario para persistir la sesión y permitir que pase authGuard
    this.authService.login({ email, password: 'password123' }).subscribe({
      next: () => {
        this.router.navigate(['/menu']);
      },
      error: (err) => {
        this.error.set('Error al simular inicio de sesión.');
      }
    });
  }
}
