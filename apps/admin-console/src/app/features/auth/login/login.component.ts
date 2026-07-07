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

import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { AuthState } from '../../../core/auth/auth.state';
import { AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../core/models/auth.models';
import { ForgotPasswordModalComponent } from './forgot-password-modal/forgot-password-modal.component';

type LoginViewState = 'login' | 'locked-temporary' | 'locked-permanent';

@Component({
  selector: 'fg-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ForgotPasswordModalComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnDestroy {
  private readonly fb          = inject(FormBuilder);
  private readonly authState   = inject(AuthState);
  private readonly authService = inject(AuthService);

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
    email:    ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get emailCtrl()    { return this.form.controls.email; }
  get passwordCtrl() { return this.form.controls.password; }

  protected get isFormValid(): boolean {
    return this.form.valid;
  }

  // ── Acciones de vista ────────────────────────────────────

  protected togglePwd(): void {
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
   */
  protected onSubmit(): void {
    if (!this.form.valid || this.isLoading()) return;
    
    this.loginError.set(null);
    this.isLoading.set(true);
    this.animateShake.set(false);

    const { email, password } = this.form.getRawValue();

    this.authService.login({ identifier: email!, password: password! }).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);
        if (res.success && res.data) {
          this.authState.login(res.data);
        } else {
          this.loginError.set(res.message || 'Credenciales incorrectas.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        this.handleLoginError(err);
      },
    });
  }

  /**
   * Centraliza e intercepta los escenarios de error devueltos por Spring Boot (HU-010).
   */
  private handleLoginError(err: HttpErrorResponse): void {
    const errorData = err.error || {};
    
    switch (err.status) {
      case 401: // Intento Fallido Normal
        const remaining = errorData.attemptsRemaining ?? 3;
        this.attemptsRemaining.set(remaining);
        this.loginError.set(errorData.message || 'Contraseña incorrecta. Acceso denegado.');
        
        // Detona la vibración horizontal temporal en el input de contraseña
        this.animateShake.set(true);
        setTimeout(() => this.animateShake.set(false), 500);
        break;

      case 423: // Bloqueo Temporal Activo
        const secondsLeft = errorData.lockTimeRemaining ?? 900; // Por defecto 15 minutos
        this.startLockCountdown(secondsLeft);
        this.viewState.set('locked-temporary');
        break;

      case 403: // Bloqueo Definitivo Activo
        this.viewState.set('locked-permanent');
        break;

      default:
        this.loginError.set(errorData.message || 'Error de conexión con el servidor 4GUARD.');
        break;
    }
  }

  /**
   * Inicia el temporizador dinámico en cuenta regresiva que actualiza la UI segundo a segundo.
   */
  private startLockCountdown(initialSeconds: number): void {
    this.lockTimerSubscription?.unsubscribe();
    this.lockTimeRemaining.set(initialSeconds);
    this.updateFormattedTime(initialSeconds);

    this.lockTimerSubscription = interval(1000)
      .pipe(
        takeWhile(() => this.lockTimeRemaining() > 0)
      )
      .subscribe({
        next: () => {
          const current = this.lockTimeRemaining() - 1;
          this.lockTimeRemaining.set(current);
          this.updateFormattedTime(current);

          if (current === 0) {
            // Desbloqueado: regresar al formulario de login
            this.viewState.set('login');
            this.loginError.set(null);
            this.attemptsRemaining.set(null);
          }
        }
      });
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
    this.lockTimerSubscription?.unsubscribe();
  }
}
