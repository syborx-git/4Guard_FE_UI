/**
 * @file forgot-password-modal.component.ts
 * @description HU-003 — Modal de recuperación de acceso con Verificación OTP de 6 dígitos.
 *
 * Flujo:
 *   1. Se abre desde el Login al presionar "¿Olvidó su contraseña?"
 *   2. El usuario ingresa su correo electrónico.
 *   3. Se solicita el código de 6 dígitos (OTP) enviado al correo (con cuenta regresiva).
 *   4. Al validar el código, se solicita ingresar y confirmar la nueva contraseña.
 *   5. Muestra confirmación de éxito.
 */

import {
  Component,
  signal,
  output,
  HostListener,
  OnDestroy,
  inject,
  ElementRef,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';

/** Estados internos del modal */
export type ModalView = 'form' | 'loading' | 'otp' | 'reset-password' | 'success';

@Component({
  selector: 'fg-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.css',
})
export class ForgotPasswordModalComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  /** Evento emitido al padre (LoginComponent) para cerrar el modal */
  readonly closed = output<void>();

  // ── Estado interno ────────────────────────────────────────
  protected readonly view          = signal<ModalView>('form');
  protected readonly fieldError    = signal('');
  protected readonly isLoading     = signal(false);

  // Temporizador para reenvío de OTP (60s)
  protected readonly resendCountdown = signal<number>(60);
  protected readonly canResend       = signal<boolean>(false);
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Formulario Paso 1: Email ──────────────────────
  protected readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
  });

  // ── Formulario Paso 2: OTP 6 Dígitos ──────────────
  protected readonly otpForm = this.fb.group({
    digit0: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit1: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit2: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit3: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit4: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit5: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
  });

  // ── Formulario Paso 3: Nueva Contraseña ──────────
  protected readonly resetForm = this.fb.group(
    {
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&._-]).{8,}$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [this.passwordMatchValidator] }
  );

  protected showPassword = signal(false);
  protected showConfirmPassword = signal(false);

  get emailCtrl() { return this.emailForm.controls.email; }
  get newPasswordCtrl() { return this.resetForm.controls.newPassword; }
  get confirmPasswordCtrl() { return this.resetForm.controls.confirmPassword; }

  // ── Tecla ESC y Click fuera ────────────────────────
  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fp-backdrop')) {
      this.close();
    }
  }

  protected close(): void {
    this.closed.emit();
    this.stopTimer();

    this.resetTimer = setTimeout(() => {
      this.view.set('form');
      this.emailForm.reset();
      this.otpForm.reset();
      this.resetForm.reset();
      this.fieldError.set('');
    }, 300);
  }

  protected onInputChange(): void {
    if (this.fieldError()) {
      this.fieldError.set('');
    }
  }

  // ── Paso 1: Enviar Solicitud OTP ──────────────────
  protected onSubmitEmail(): void {
    if (this.emailForm.invalid) {
      this.emailCtrl.markAsTouched();
      this.fieldError.set('Ingresa un correo electrónico válido.');
      return;
    }

    this.fieldError.set('');
    this.isLoading.set(true);

    setTimeout(() => {
      this.isLoading.set(false);
      this.view.set('otp');
      this.startResendTimer();

      setTimeout(() => {
        this.otpInputs?.first?.nativeElement.focus();
      }, 100);
    }, 1000);
  }

  // ── Paso 2: Inputs OTP 6 Dígitos ──────────────────
  protected onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    if (value && !/^[0-9]$/.test(value)) {
      input.value = '';
      return;
    }

    if (value && index < 5) {
      const inputsArray = this.otpInputs.toArray();
      inputsArray[index + 1]?.nativeElement.focus();
    }

    if (this.otpForm.valid) {
      this.onVerifyOtp();
    }
  }

  protected onOtpKeyDown(event: KeyboardEvent, index: number): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      const inputsArray = this.otpInputs.toArray();
      inputsArray[index - 1]?.nativeElement.focus();
    }
  }

  protected onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);

    if (digits.length > 0) {
      const controls = [
        this.otpForm.controls.digit0,
        this.otpForm.controls.digit1,
        this.otpForm.controls.digit2,
        this.otpForm.controls.digit3,
        this.otpForm.controls.digit4,
        this.otpForm.controls.digit5,
      ];

      for (let i = 0; i < 6; i++) {
        controls[i].setValue(digits[i] || '');
      }

      const inputsArray = this.otpInputs.toArray();
      const targetIndex = Math.min(digits.length, 5);
      inputsArray[targetIndex]?.nativeElement.focus();

      if (digits.length === 6) {
        this.onVerifyOtp();
      }
    }
  }

  protected onVerifyOtp(): void {
    if (this.otpForm.invalid) {
      this.fieldError.set('Por favor ingresa los 6 dígitos.');
      return;
    }

    this.isLoading.set(true);
    this.fieldError.set('');

    setTimeout(() => {
      this.isLoading.set(false);
      this.stopTimer();
      this.view.set('reset-password');
    }, 800);
  }

  protected resendCode(): void {
    if (!this.canResend()) return;

    this.isLoading.set(true);
    this.fieldError.set('');

    setTimeout(() => {
      this.isLoading.set(false);
      this.otpForm.reset();
      this.startResendTimer();
      this.otpInputs?.first?.nativeElement.focus();
    }, 600);
  }

  // ── Paso 3: Guardar Nueva Contraseña ──────────────
  protected onResetPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      if (this.resetForm.hasError('passwordMismatch')) {
        this.fieldError.set('Las contraseñas no coinciden.');
      } else {
        this.fieldError.set('La contraseña debe tener mín. 8 caracteres, mayúscula, número y símbolo.');
      }
      return;
    }

    this.isLoading.set(true);
    this.fieldError.set('');

    setTimeout(() => {
      this.isLoading.set(false);
      this.view.set('success');
    }, 1200);
  }

  // ── Helpers & Timers ─────────────────────────────
  private startResendTimer(): void {
    this.stopTimer();
    this.resendCountdown.set(60);
    this.canResend.set(false);

    this.timerInterval = setInterval(() => {
      const current = this.resendCountdown();
      if (current > 1) {
        this.resendCountdown.set(current - 1);
      } else {
        this.resendCountdown.set(0);
        this.canResend.set(true);
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  protected toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  protected toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }
}
