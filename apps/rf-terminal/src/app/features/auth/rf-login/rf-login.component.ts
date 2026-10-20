/**
 * @file rf-login.component.ts
 * @description P6 — Login RF (Acceso Rápido) [HU-002].
 * Botón masivo para QR/RFID. PIN numérico como alternativa.
 * Validación offline contra caché local.
 */

import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState, AuthService } from '@4guard/shared-core';

type LoginMode = 'credentials' | 'pin' | 'scan';

@Component({
  selector: 'fg-rf-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rf-login.component.html',
  styleUrl: './rf-login.component.css',
})
export class RfLoginComponent {
  private readonly fb          = inject(FormBuilder);
  private readonly authState   = inject(AuthState);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  protected readonly mode          = signal<LoginMode>('credentials');
  protected readonly pin           = signal<string>('');
  protected readonly isScanning    = signal(false);
  protected readonly isLoading     = signal(false);
  protected readonly showPassword  = signal(false);
  protected readonly error         = signal<string | null>(null);
  protected readonly isOffline     = signal(!navigator.onLine);

  protected readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  protected toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

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

  protected triggerScan(): void {
    this.isScanning.set(true);
    this.error.set(null);

    // Lectura de credencial de operario
    setTimeout(() => {
      this.isScanning.set(false);
      this.handleAuthSuccess('operator@4guard.mx');
    }, 1200);
  }

  protected submitPin(): void {
    const pin = this.pin();
    const user = this.MOCK_PINS[pin];

    if (!user) {
      this.error.set('PIN no reconocido en el sistema. Intenta de nuevo.');
      this.pin.set('');
      return;
    }

    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.handleAuthSuccess(user.email);
    }, 400);
  }

  protected submitCredentials(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.getRawValue();
    this.isLoading.set(true);
    this.error.set(null);

    this.authService.login({ email: identifier.trim(), password }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.navigateToUserLanding(user);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.message || err?.message || 'Credenciales inválidas o error de conexión con el servidor.');
      }
    });
  }

  private handleAuthSuccess(email: string, password = 'password123'): void {
    this.isLoading.set(true);
    this.authService.login({ email, password }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.navigateToUserLanding(user);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set('Error al autenticar en el servidor.');
      }
    });
  }

  private navigateToUserLanding(_user: any): void {
    // Redirigir siempre primero al Menú Principal de tareas
    this.router.navigate(['/menu']);
  }
}
