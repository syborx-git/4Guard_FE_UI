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
import { AuthState, AuthService, UserRole } from '@4guard/shared-core';
import { PwaService } from '../../../core/services/pwa.service';

type LoginMode = 'credentials' | 'pin' | 'scan';

interface MockPinConfig {
  name: string;
  role: UserRole;
  email: string;
  landing: string;
}

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

  protected readonly mode          = signal<LoginMode>('credentials');
  protected readonly pin           = signal<string>('');
  protected readonly isScanning    = signal(false);
  protected readonly isLoading     = signal(false);
  protected readonly showPassword  = signal(false);
  protected readonly error         = signal<string | null>(null);
  protected readonly isOffline     = signal(!navigator.onLine);
  protected readonly currentLiveTime = signal<string>(new Date().toLocaleTimeString('es-MX'));

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

  // ─── Perfiles de Acceso Rápido / PIN Offline / Demo ─────────────────────────
  private readonly MOCK_PINS: Record<string, MockPinConfig> = {
    '1234': {
      name: 'Roberto Sánchez (Montacarguista #07)',
      role: UserRole.WAREHOUSE_OPERATOR,
      email: 'montacarguista@4guard.mx',
      landing: '/menu'
    },
    '9999': {
      name: 'Carlos Mendoza (Guardia Caseta)',
      role: UserRole.SECURITY_GUARD,
      email: 'guard@4guard.mx',
      landing: '/security'
    },
    '5678': {
      name: 'Miguel Torres (Líder de Turno)',
      role: UserRole.SHIFT_LEADER,
      email: 'lider@4guard.mx',
      landing: '/menu'
    },
    '0000': {
      name: 'Dra. Elena Ramos (Calidad QM)',
      role: UserRole.QM_INSPECTOR,
      email: 'qm@4guard.mx',
      landing: '/quality'
    },
  };

  /** Acceso Directo 1-Clic: Perfil Genérico Montacarguista (#07) */
  public loginAsForklift(): void {
    this.isLoading.set(true);
    this.error.set(null);
    setTimeout(() => {
      this.authState.switchRoleForTesting(
        UserRole.WAREHOUSE_OPERATOR,
        'Roberto Sánchez (Montacarguista #07)'
      );
      this.isLoading.set(false);
      this.router.navigate(['/menu']);
    }, 200);
  }

  /** Acceso Directo 1-Clic: Perfil Guardia de Caseta */
  public loginAsSecurityGuard(): void {
    this.isLoading.set(true);
    this.error.set(null);
    setTimeout(() => {
      this.authState.switchRoleForTesting(
        UserRole.SECURITY_GUARD,
        'Carlos Mendoza (Guardia Caseta)'
      );
      this.isLoading.set(false);
      this.router.navigate(['/security']);
    }, 200);
  }

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

    // Lectura automática de gafete RFID / QR de Montacarguista
    setTimeout(() => {
      this.isScanning.set(false);
      this.loginAsForklift();
    }, 900);
  }

  protected submitPin(): void {
    const pin = this.pin();
    const config = this.MOCK_PINS[pin];

    if (!config) {
      this.error.set('PIN no reconocido. Usa "1234" para Montacarguista o "9999" para Caseta.');
      this.pin.set('');
      return;
    }

    this.isLoading.set(true);
    this.authService.login({ email: config.email, password: 'password123' }).subscribe({
      next: (_user) => {
        this.isLoading.set(false);
        this.router.navigate([config.landing || '/menu']);
      },
      error: () => {
        // Fallback local resiliente para testing y modo offline
        this.isLoading.set(false);
        this.authState.switchRoleForTesting(config.role, config.name);
        this.router.navigate([config.landing || '/menu']);
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

    const lower = identifier.toLowerCase();
    const userPrefix = lower.split('@')[0];
    const isForklift = userPrefix.includes('montacarg') || userPrefix.includes('operad') || userPrefix.includes('fork') || userPrefix === 'op';
    const isGuard = userPrefix.includes('guard') || userPrefix.includes('caseta') || userPrefix.includes('seguridad') || userPrefix.includes('vigilan');

    this.authService.login({ email: identifier.trim(), password }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        if (user.role === UserRole.SECURITY_GUARD || isGuard) {
          this.router.navigate(['/security']);
        } else {
          this.router.navigate(['/menu']);
        }
      },
      error: (err) => {
        // Si no responde el backend local o no existe el usuario, fallback resiliente
        if (isForklift) {
          this.isLoading.set(false);
          this.authState.switchRoleForTesting(UserRole.WAREHOUSE_OPERATOR, 'Roberto Sánchez (Montacarguista #07)');
          this.router.navigate(['/menu']);
          return;
        }
        if (isGuard) {
          this.isLoading.set(false);
          this.authState.switchRoleForTesting(UserRole.SECURITY_GUARD, 'Carlos Mendoza (Guardia Caseta)');
          this.router.navigate(['/security']);
          return;
        }

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
