/**
 * @file login.component.ts
 * @description P1 — Login Administrativo (HU-001 / HU-003 / HU-010).
 *
 * Implementa control de autenticación y bloqueo de cuenta por intentos fallidos (HU-010).
 * Maneja los estados:
 *   - Normal / Intento fallido con badge y vibración (401 Unauthorized)
 *   - Bloqueo Temporal con cuenta regresiva MM:SS (423 Locked)
 *   - Bloqueo Definitivo con advertencia de auditoría por email (403 Forbidden)
 */

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { AuthState } from '../../../core/auth/auth.state';
import { AuthService } from '../../../core/services/auth.service';
import { SessionStorageService } from '../../../core/services/session-storage.service';
import { LoginResponse } from '../../../core/models/auth.models';
import { AUTH_CONFIG } from '../../../core/auth/auth.config';
import { ForgotPasswordModalComponent } from './forgot-password-modal/forgot-password-modal.component';

type LoginViewState = 'login' | 'locked-temporary' | 'locked-permanent';

@Component({
  selector: 'fg-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ForgotPasswordModalComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb                   = inject(FormBuilder);
  private readonly authState            = inject(AuthState);
  private readonly authService          = inject(AuthService);
  private readonly sessionStorageService = inject(SessionStorageService);

  // ── Estado del layout / vistas (HU-010) ──────────────────
  protected readonly viewState = signal<LoginViewState>('login');
  protected readonly showForgotModal = signal<boolean>(false);

  // ── Estado de carga y errores ────────────────────────────
  protected readonly isLoading  = signal<boolean>(false);
  protected readonly showPwd    = signal<boolean>(false);
  protected readonly loginError = signal<string | null>(null);

  // ── Gestión de Intentos Fallidos (HU-010) ────────────────
  protected readonly attemptsRemaining = signal<number | null>(null);
  protected readonly animateShake      = signal<boolean>(false);

  // ── Bloqueo Temporal (HU-010) ────────────────────────────
  protected readonly lockTimeRemaining = signal<number>(0); // En segundos
  protected readonly formattedLockTime = signal<string>('00:00');
  private lockTimerSubscription?: Subscription;

  // ── Formulario reactivo ──────────────────────────────────
  protected readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get emailCtrl()    { return this.form.controls.email; }
  get passwordCtrl() { return this.form.controls.password; }

  protected get isFormValid(): boolean {
    return this.form.valid;
  }

  ngOnInit(): void {
    this.checkAndRestoreLockoutState();

    // Sincronizar el conteo de intentos fallidos cuando el usuario cambia o escribe el email
    this.emailCtrl.valueChanges.subscribe((rawEmail) => {
      if (this.viewState() === 'login' && rawEmail) {
        const email = this.sessionStorageService.normalizeIdentifier(rawEmail);
        const failed = this.sessionStorageService.getFailedAttempts(email);
        if (failed > 0 && failed < AUTH_CONFIG.maxFailedAttempts) {
          this.attemptsRemaining.set(AUTH_CONFIG.maxFailedAttempts - failed);
        }
      }
    });
  }

  /**
   * Verifica al cargar la página si existe un bloqueo activo guardado en localStorage.
   * Evita mostrar brevemente el formulario si la cuenta está pausada.
   */
  private checkAndRestoreLockoutState(): void {
    const lockoutState = this.sessionStorageService.getAuthLockout();
    if (!lockoutState) return;

    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.ceil((lockoutState.lockedUntil - now) / 1000));

    if (remainingSeconds > 0) {
      // Restaurar inmediatamente el bloqueo sin mostrar el formulario
      this.viewState.set('locked-temporary');
      if (lockoutState.identifier) {
        this.emailCtrl.setValue(lockoutState.identifier, { emitEvent: false });
      }
      this.startLockCountdown(lockoutState.lockedUntil);
    } else {
      // El bloqueo expiró mientras la página estaba cerrada o refrescada
      this.sessionStorageService.clearAuthLockout();
      if (lockoutState.identifier) {
        this.sessionStorageService.clearFailedAttempts(lockoutState.identifier);
      }
      this.viewState.set('login');
      this.attemptsRemaining.set(null);
    }
  }

  // ── Acciones de vista ────────────────────────────────────

  protected togglePwd(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showPwd.update((v) => !v);
  }

  protected openForgotModal(): void {
    this.loginError.set(null);
    this.showForgotModal.set(true);
  }

  protected closeForgotModal(): void {
    this.showForgotModal.set(false);
  }

  /**
   * Procesa el inicio de sesión y gestiona las respuestas de error del servidor (HU-010).
   * Contiene validación defensiva contra ejecuciones durante estado bloqueado.
   */
  protected onSubmit(): void {
    // Validación defensiva: No procesar si está bloqueado o en proceso de envío
    if (this.viewState() === 'locked-temporary' || this.viewState() === 'locked-permanent' || this.isLoading()) {
      return;
    }

    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError.set(null);
    this.isLoading.set(true);
    this.animateShake.set(false);

    const { email, password } = this.form.getRawValue();
    const normalizedEmail = this.sessionStorageService.normalizeIdentifier(email!);

    this.authService.login({ identifier: normalizedEmail, password: password! }).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          // Login exitoso: limpiar por completo bloqueos e intentos fallidos
          this.clearLockCountdown();
          this.sessionStorageService.clearAuthLockout();
          this.sessionStorageService.clearFailedAttempts(normalizedEmail);
          this.attemptsRemaining.set(null);

          this.authState.login(res.data);
        } else {
          // Respuesta no exitosa cuenta como intento fallido
          this.decrementAttempts(normalizedEmail);
          this.loginError.set(res.message || 'Credenciales incorrectas.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.handleLoginError(err, normalizedEmail);
      },
    });
  }

  /**
   * Decrementa los intentos restantes asociándolos al identificador normalizado (HU-010).
   * Al alcanzar el límite (maxFailedAttempts), calcula el timestamp absoluto e inicia el bloqueo.
   */
  private decrementAttempts(identifier?: string): void {
    const email = identifier || this.sessionStorageService.normalizeIdentifier(this.emailCtrl.value || '');
    const currentFailed = this.sessionStorageService.getFailedAttempts(email) + 1;
    this.sessionStorageService.saveFailedAttempts(email, currentFailed);

    const remaining = Math.max(0, AUTH_CONFIG.maxFailedAttempts - currentFailed);

    if (currentFailed >= AUTH_CONFIG.maxFailedAttempts) {
      const lockedUntil = Date.now() + AUTH_CONFIG.lockoutDurationSeconds * 1000;
      
      this.sessionStorageService.setAuthLockout({
        identifier: email,
        failedAttempts: currentFailed,
        lockedUntil,
      });

      this.attemptsRemaining.set(0);
      this.loginError.set('Has agotado tus intentos. Por seguridad, tu acceso ha sido bloqueado temporalmente.');
      this.animateShake.set(true);
      setTimeout(() => this.animateShake.set(false), 500);

      this.viewState.set('locked-temporary');
      this.startLockCountdown(lockedUntil);
    } else {
      this.attemptsRemaining.set(remaining);
      this.animateShake.set(true);
      setTimeout(() => this.animateShake.set(false), 500);
    }
  }

  /**
   * Intercepta los escenarios de error devueltos por la API o el entorno mock (HU-010).
   */
  private handleLoginError(err: HttpErrorResponse, identifier: string): void {
    const errorData = err.error || {};

    switch (err.status) {
      case 423: {
        const secondsLeft = errorData.lockTimeRemaining ?? AUTH_CONFIG.lockoutDurationSeconds;
        const lockedUntil = Date.now() + secondsLeft * 1000;
        this.sessionStorageService.setAuthLockout({
          identifier,
          failedAttempts: AUTH_CONFIG.maxFailedAttempts,
          lockedUntil,
        });
        this.startLockCountdown(lockedUntil);
        this.viewState.set('locked-temporary');
        break;
      }

      case 403:
        this.viewState.set('locked-permanent');
        break;

      default:
        this.decrementAttempts(identifier);
        this.loginError.set(errorData.message || 'Credenciales incorrectas. Acceso denegado.');
        break;
    }
  }

  /**
   * Inicia el temporizador dinámico basado en tiempo real (timestamp absoluto lockedUntil).
   * Recalcula el tiempo restante en cada tick para mantener exactitud ante recargas, suspensión o pestañas inactivas.
   */
  private startLockCountdown(lockedUntilTimestamp: number): void {
    this.clearLockCountdown();

    const initialRemaining = Math.max(0, Math.ceil((lockedUntilTimestamp - Date.now()) / 1000));
    this.lockTimeRemaining.set(initialRemaining);
    this.updateFormattedTime(initialRemaining);

    this.lockTimerSubscription = interval(1000).subscribe({
      next: () => {
        const nowRemaining = Math.max(0, Math.ceil((lockedUntilTimestamp - Date.now()) / 1000));
        this.lockTimeRemaining.set(nowRemaining);
        this.updateFormattedTime(nowRemaining);

        if (nowRemaining <= 0) {
          this.clearLockCountdown();
          this.sessionStorageService.clearAuthLockout();

          const email = this.sessionStorageService.normalizeIdentifier(this.emailCtrl.value || '');
          if (email) {
            this.sessionStorageService.clearFailedAttempts(email);
          }

          this.viewState.set('login');
          this.loginError.set(null);
          this.attemptsRemaining.set(null);
          this.passwordCtrl.setValue('');
        }
      },
    });
  }

  /**
   * Detiene y limpia el temporizador de cuenta regresiva activo si existe.
   */
  private clearLockCountdown(): void {
    if (this.lockTimerSubscription) {
      this.lockTimerSubscription.unsubscribe();
      this.lockTimerSubscription = undefined;
    }
  }

  /**
   * Formatea los segundos restantes a formato MM:SS.
   */
  private updateFormattedTime(totalSeconds: number): void {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

    this.formattedLockTime.set(`${minutesStr}:${secondsStr}`);
  }

  /**
   * Permite simular el envío o contacto a soporte técnico.
   */
  protected contactSupport(): void {
    window.location.href = 'mailto:soporte@4guard.com?subject=Desbloqueo de Cuenta 4GUARD WMS';
  }

  ngOnDestroy(): void {
    this.clearLockCountdown();
  }
}
