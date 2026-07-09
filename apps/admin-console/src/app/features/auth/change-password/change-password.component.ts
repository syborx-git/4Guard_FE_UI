/**
 * @file change-password.component.ts
 * @description Paso 3 del flujo de recuperación de contraseña — 4GUARD WMS.
 *
 * Este componente se activa cuando el usuario inicia sesión con una contraseña
 * temporal y changePasswordRequired === true. El flujo es:
 *
 *   1. El usuario ya tiene accessToken en sesión (login exitoso con contraseña temporal)
 *   2. AuthState.login() navega aquí en lugar del dashboard
 *   3. El usuario introduce y confirma una nueva contraseña (mínimo 8 caracteres)
 *   4. Se llama PUT /api/v1/users/change-password con Bearer token
 *   5. En éxito: navegar al dashboard
 *
 * Protegido por changePasswordGuard: solo accesible con sesión + changePasswordRequired.
 */

import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UsersService } from '../../../core/services/users.service';
import { AuthState } from '../../../core/auth/auth.state';

/** Validador cruzado que verifica que confirmPassword coincida con newPassword. */
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd     = control.get('newPassword')?.value;
  const confirmPwd = control.get('confirmPassword')?.value;
  if (newPwd && confirmPwd && newPwd !== confirmPwd) {
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'fg-change-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly authState    = inject(AuthState);
  private readonly router       = inject(Router);

  // ── Estado de UI ──────────────────────────────────────────
  protected readonly isLoading      = signal(false);
  protected readonly serverError    = signal<string | null>(null);
  protected readonly showPwd        = signal(false);
  protected readonly showConfirmPwd = signal(false);
  protected readonly currentYear    = new Date().getFullYear();

  // ── Formulario reactivo ───────────────────────────────────
  protected readonly form = this.fb.group(
    {
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator }
  );

  get newPasswordCtrl()     { return this.form.controls.newPassword; }
  get confirmPasswordCtrl() { return this.form.controls.confirmPassword; }

  protected readonly newPwdValue = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });

  /** Fuerza de la contraseña: 0–3 */
  protected readonly passwordStrength = computed(() => {
    const pwd = this.newPwdValue() ?? '';
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9!@#$%^&*]/.test(pwd)) score++;
    return score;
  });

  protected readonly strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s === 0) return '';
    if (s === 1) return 'Débil';
    if (s === 2) return 'Moderada';
    return 'Fuerte';
  });

  protected readonly strengthClass = computed(() => {
    const s = this.passwordStrength();
    if (s === 1) return 'cp-strength--weak';
    if (s === 2) return 'cp-strength--medium';
    if (s === 3) return 'cp-strength--strong';
    return '';
  });

  protected togglePwd(): void        { this.showPwd.update(v => !v); }
  protected toggleConfirmPwd(): void { this.showConfirmPwd.update(v => !v); }

  /**
   * Envía la nueva contraseña al backend y navega al dashboard en caso de éxito.
   */
  protected onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;

    this.serverError.set(null);
    this.isLoading.set(true);

    const newPassword = this.newPasswordCtrl.value!;

    this.usersService.changePassword(newPassword).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success) {
          // Actualizar la sesión para marcar changePasswordRequired = false
          const currentSession = this.authState.currentUser();
          if (currentSession) {
            // Forzar recarga de sesión navegando al dashboard.
            // El guard ya no bloqueará porque changePasswordRequired se actualizó en backend.
          }
          this.router.navigate(['/dashboard']);
        } else {
          this.serverError.set(response.message || 'No se pudo actualizar la contraseña.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        const backendMessage = err.error?.message;

        if (err.status === 400) {
          this.serverError.set(backendMessage || 'La contraseña no cumple los requisitos mínimos.');
        } else if (err.status === 0) {
          this.serverError.set('Sin conexión al servidor. Verifica la red e inténtalo de nuevo.');
        } else {
          this.serverError.set(backendMessage || 'Ocurrió un error. Inténtalo nuevamente.');
        }
      },
    });
  }

  /** Cierra sesión y regresa al login. */
  protected onLogout(): void {
    this.authState.logout();
  }
}
