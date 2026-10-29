/**
 * @file rf-login.component.ts
 * @description P6 — Login RF (Acceso Rápido) [HU-002].
 * Botón masivo para QR/RFID. PIN numérico con código de operador.
 * Autenticación real contra el backend (/api/v1/auth/login) y base de datos PostgreSQL.
 */

import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState, AuthService, UserRole, User } from '@4guard/shared-core';
import { PwaService } from '../../../core/services/pwa.service';

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
  protected readonly pwaService = inject(PwaService);

  protected readonly mode            = signal<LoginMode>('credentials');
  protected readonly pin             = signal<string>('');
  protected readonly operatorCode    = signal<string>('');
  protected readonly isScanning      = signal(false);
  protected readonly isLoading       = signal(false);
  protected readonly showPassword    = signal(false);
  protected readonly error           = signal<string | null>(null);
  protected readonly isOffline       = signal(!navigator.onLine);
  protected readonly currentLiveTime = signal<string>(new Date().toLocaleTimeString('es-MX'));

  // ── Cambio obligatorio de PIN / Contraseña temporal tras reseteo ──
  protected readonly mustChangePin   = signal<boolean>(false);
  protected readonly pendingUser     = signal<User | null>(null);
  protected readonly newPin          = signal<string>('');
  protected readonly confirmNewPin   = signal<string>('');
  protected readonly pinChangeStep   = signal<'new' | 'confirm'>('new');

  protected readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    remember: [true]
  });

  constructor() {
    setInterval(() => {
      this.currentLiveTime.set(new Date().toLocaleTimeString('es-MX'));
    }, 1000);
  }

  protected toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  protected async promptInstallPwa(): Promise<void> {
    await this.pwaService.promptInstall();
  }

  protected setOperatorCode(val: string): void {
    this.operatorCode.set(val ? val.toUpperCase() : '');
    this.error.set(null);
  }

  protected clearOperatorCode(): void {
    this.operatorCode.set('');
    this.error.set(null);
  }

  protected get pinDisplay(): string {
    return '●'.repeat(this.pin().length) + '•'.repeat(Math.max(0, 4 - this.pin().length));
  }

  protected get activeNewPinValue(): string {
    return this.pinChangeStep() === 'new' ? this.newPin() : this.confirmNewPin();
  }

  protected get newPinDisplay(): string {
    const val = this.activeNewPinValue;
    return '●'.repeat(val.length) + '•'.repeat(Math.max(0, 4 - val.length));
  }

  protected get canSubmitPin(): boolean {
    return this.pin().length === 4 && this.operatorCode().trim().length > 0;
  }

  protected switchMode(m: LoginMode): void {
    this.mode.set(m);
    this.pin.set('');
    this.operatorCode.set('');
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

  // ── Métodos para actualización de PIN Personal ──
  protected appendNewPinDigit(digit: string): void {
    this.error.set(null);
    if (this.pinChangeStep() === 'new') {
      if (this.newPin().length < 4) {
        this.newPin.update(p => p + digit);
      }
    } else {
      if (this.confirmNewPin().length < 4) {
        this.confirmNewPin.update(p => p + digit);
      }
    }
  }

  protected deleteNewPinDigit(): void {
    this.error.set(null);
    if (this.pinChangeStep() === 'new') {
      this.newPin.update(p => p.slice(0, -1));
    } else {
      this.confirmNewPin.update(p => p.slice(0, -1));
    }
  }

  protected clearNewPinDigits(): void {
    this.error.set(null);
    if (this.pinChangeStep() === 'new') {
      this.newPin.set('');
    } else {
      this.confirmNewPin.set('');
    }
  }

  protected resetPinChangeStep(): void {
    this.pinChangeStep.set('new');
    this.newPin.set('');
    this.confirmNewPin.set('');
    this.error.set(null);
  }

  protected cancelPinChange(): void {
    this.mustChangePin.set(false);
    this.pendingUser.set(null);
    this.newPin.set('');
    this.confirmNewPin.set('');
    this.error.set(null);
    this.authService.logout();
  }

  protected proceedOrSubmitNewPin(): void {
    if (this.pinChangeStep() === 'new') {
      if (this.newPin().length !== 4) {
        this.error.set('Tu nuevo PIN personal debe tener exactamente 4 dígitos.');
        return;
      }
      this.error.set(null);
      this.pinChangeStep.set('confirm');
      return;
    }

    if (this.confirmNewPin().length !== 4) {
      this.error.set('Confirma los 4 dígitos de tu nuevo PIN personal.');
      return;
    }

    if (this.newPin() !== this.confirmNewPin()) {
      this.error.set('Los PIN ingresados no coinciden. Inténtalo de nuevo.');
      this.confirmNewPin.set('');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.authService.changePassword(this.newPin()).subscribe({
      next: () => {
        this.isLoading.set(false);
        const user = this.pendingUser() || this.authService.currentUser();
        this.mustChangePin.set(false);
        this.pendingUser.set(null);
        this.newPin.set('');
        this.confirmNewPin.set('');
        this.navigateToUserLanding(user);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err?.error?.message || err?.message || 'No se pudo actualizar el PIN personal. Intenta con otro PIN de 4 dígitos.';
        this.error.set(msg);
      }
    });
  }

  protected triggerScan(): void {
    this.isScanning.set(true);
    this.error.set(null);

    // Detección óptica de gafete / credencial RFID
    setTimeout(() => {
      this.isScanning.set(false);
      this.mode.set('pin');
    }, 700);
  }

  protected submitPin(): void {
    const code = this.operatorCode().trim().toUpperCase();
    const pin = this.pin();

    if (!code) {
      this.error.set('Por favor ingresa tu código de operador o gafete (ej. MC-001).');
      return;
    }

    if (pin.length !== 4) {
      this.error.set('El PIN debe contener exactamente 4 dígitos.');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    // Autenticación real contra backend WMS (/api/v1/auth/login)
    this.authService.login({ email: code, password: pin }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.pin.set('');
        this.operatorCode.set('');
        if (user?.changePasswordRequired) {
          this.pendingUser.set(user);
          this.newPin.set('');
          this.confirmNewPin.set('');
          this.pinChangeStep.set('new');
          this.mustChangePin.set(true);
          return;
        }
        this.navigateToUserLanding(user);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.pin.set('');
        const msg = err?.error?.message || err?.message || 'Código de operador o PIN incorrecto. Verifica tus credenciales en el sistema.';
        this.error.set(msg);
      }
    });
  }

  protected submitCredentials(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.getRawValue();
    this.isLoading.set(true);
    this.error.set(null);

    const cleanIdentifier = identifier.trim();
    this.authService.login({ email: cleanIdentifier, password }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        if (user?.changePasswordRequired) {
          this.pendingUser.set(user);
          this.newPin.set('');
          this.confirmNewPin.set('');
          this.pinChangeStep.set('new');
          this.mustChangePin.set(true);
          return;
        }
        this.navigateToUserLanding(user);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err?.error?.message || err?.message || 'Credenciales inválidas o error de conexión con el servidor.');
      }
    });
  }

  private navigateToUserLanding(user: any): void {
    const role = user?.role || this.authState.role();
    if (role === UserRole.SECURITY_GUARD) {
      this.router.navigate(['/security']);
    } else {
      this.router.navigate(['/menu']);
    }
  }
}
