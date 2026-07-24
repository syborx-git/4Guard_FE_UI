/**
 * @file forgot-password.component.ts
 * @description P2 — Recuperar Contraseña (HU-003) con Verificación de Código OTP de 6 Dígitos.
 * Flujo interactivo de 3 pasos (Correo -> Código 6 Dígitos -> Nueva Contraseña -> Éxito).
 */

import { Component, signal, inject, ElementRef, ViewChildren, QueryList, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink } from '@angular/router';

export type FlowState = 'email' | 'otp' | 'reset-password' | 'success';

@Component({
  selector: 'fg-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  protected readonly flowState = signal<FlowState>('email');
  protected readonly isLoading = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected get showSteps(): boolean {
    return this.flowState() !== 'success';
  }

  protected get currentState(): string {
    return this.flowState();
  }

  // Temporizador para reenvío de OTP (60s)
  protected readonly resendCountdown = signal<number>(60);
  protected readonly canResend = signal<boolean>(false);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Formulario Paso 1: Email
  protected readonly emailForm = this.fb.group({
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
  });

  // Formulario Paso 2: OTP 6 dígitos
  protected readonly otpForm = this.fb.group({
    digit0: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit1: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit2: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit3: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit4: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
    digit5: ['', [Validators.required, Validators.pattern(/^[0-9]$/)]],
  });

  // Formulario Paso 3: Nueva Contraseña
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

  protected showPassword = signal<boolean>(false);
  protected showConfirmPassword = signal<boolean>(false);

  get emailCtrl() { return this.emailForm.controls.email; }
  get newPasswordCtrl() { return this.resetForm.controls.newPassword; }
  get confirmPasswordCtrl() { return this.resetForm.controls.confirmPassword; }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // --- PASO 1: Enviar Email ---
  protected onEmailSubmit(): void {
    if (this.emailForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Simulación de llamada a API
    setTimeout(() => {
      this.isLoading.set(false);
      this.writeAuditLog('PASSWORD_RECOVERY_OTP_REQUESTED', this.emailCtrl.value!);
      this.flowState.set('otp');
      this.startResendTimer();

      // Auto-enfoque al primer input OTP tras renderizado
      setTimeout(() => {
        const firstInput = this.otpInputs?.first?.nativeElement;
        if (firstInput) firstInput.focus();
      }, 100);
    }, 1200);
  }

  // --- PASO 2: Manejo de Inputs OTP ---
  protected onOtpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;

    // Aceptar solo números
    if (value && !/^[0-9]$/.test(value)) {
      input.value = '';
      return;
    }

    if (value && index < 5) {
      const inputsArray = this.otpInputs.toArray();
      inputsArray[index + 1]?.nativeElement.focus();
    }

    // Auto-verificar si los 6 dígitos se han llenado
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
      this.errorMessage.set('Por favor ingresa los 6 dígitos del código.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const otpCode = Object.values(this.otpForm.value).join('');

    setTimeout(() => {
      this.isLoading.set(false);

      // Simulación de código válido (acepta cualquier código de 6 dígitos para la demo)
      if (otpCode.length === 6) {
        this.stopTimer();
        this.writeAuditLog('OTP_VERIFIED_SUCCESSFULLY', this.emailCtrl.value!);
        this.flowState.set('reset-password');
      } else {
        this.errorMessage.set('Código inválido o expirado. Inténtalo nuevamente.');
      }
    }, 1000);
  }

  protected resendCode(): void {
    if (!this.canResend()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    setTimeout(() => {
      this.isLoading.set(false);
      this.otpForm.reset();
      this.startResendTimer();
      this.writeAuditLog('OTP_RESENT', this.emailCtrl.value!);
      this.otpInputs?.first?.nativeElement.focus();
    }, 800);
  }

  // --- PASO 3: Restablecer Contraseña ---
  protected onResetPassword(): void {
    if (this.resetForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    setTimeout(() => {
      this.isLoading.set(false);
      this.writeAuditLog('PASSWORD_RESET_COMPLETED', this.emailCtrl.value!);
      this.flowState.set('success');
    }, 1500);
  }

  // --- Helpers de Temporizador y Utilidades ---
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
    this.showPassword.update((val) => !val);
  }

  protected toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((val) => !val);
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  private writeAuditLog(event: string, email: string): void {
    const log: AuditEntry[] = JSON.parse(localStorage.getItem('4guard_audit_log') ?? '[]');
    log.push({
      timestamp: new Date().toISOString(),
      event,
      email,
      ip: '127.0.0.1',
    });
    localStorage.setItem('4guard_audit_log', JSON.stringify(log));
  }
}

interface AuditEntry {
  timestamp: string;
  event: string;
  email: string;
  ip: string;
}
