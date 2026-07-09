import { Component, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs';

import { AuthState } from '../../../core/auth/auth.state';

@Component({
  selector: 'fg-password-collapse',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './password-collapse.component.html',
  styleUrl: './password-collapse.component.css'
})
export class PasswordCollapseComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  protected readonly authState = inject(AuthState);

  @Output() closed = new EventEmitter<void>();

  // Estados de UI
  step = signal<1 | 2>(1);
  isOpen = signal(false);
  isLoading = signal(false);
  successMessage = signal<string | null>(null);

  // Visibilidad de contraseñas
  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  // Lógica de intentos
  attemptsLeft = signal(3);
  passwordErrorMsg = signal<string | null>(null);

  // Formulario verificación
  emailCtrl = this.fb.control('', [Validators.required, Validators.email]);
  emailError = signal(false);

  // Formulario contraseñas
  form = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  // Fuerza de contraseña (0 a 3)
  passwordStrength = computed(() => {
    const pwd = this.form.get('newPassword')?.value || '';
    if (!pwd) return 0;
    
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    
    return strength;
  });

  toggleOpen() {
    this.isOpen.update(v => !v);
    if (!this.isOpen()) {
      this.close();
    }
  }

  open() {
    this.isOpen.set(true);
  }

  verifyEmail() {
    if (this.emailCtrl.invalid) return;
    const input = this.emailCtrl.value || '';
    const userEmail = this.authState.currentUser()?.email || 'admin@4guard.com';
    
    // Simulación: Comparamos con el correo del usuario actual o un correo dummy
    if (input.toLowerCase() === userEmail.toLowerCase() || input === 'admin@4guard.com' || input === 'enrique@4guard.com') {
      this.emailError.set(false);
      this.step.set(2);
    } else {
      this.emailError.set(true);
    }
  }

  close() {
    this.isOpen.set(false);
    this.step.set(1);
    this.emailCtrl.reset();
    this.emailError.set(false);
    this.form.reset();
    this.form.enable();
    this.attemptsLeft.set(3);
    this.passwordErrorMsg.set(null);
    this.successMessage.set(null);
    this.closed.emit();
  }

  toggleCurrent() { this.showCurrent.update(v => !v); }
  toggleNew() { this.showNew.update(v => !v); }
  toggleConfirm() { this.showConfirm.update(v => !v); }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPwd = control.get('newPassword')?.value;
    const confirmPwd = control.get('confirmPassword')?.value;
    if (newPwd !== confirmPwd) {
      control.get('confirmPassword')?.setErrors({ mismatch: true });
      return { mismatch: true };
    }
    return null;
  }

  onSubmit() {
    if (this.form.invalid) return;

    this.isLoading.set(true);
    this.successMessage.set(null);
    this.passwordErrorMsg.set(null);

    const payload = {
      currentPassword: this.form.value.currentPassword,
      newPassword: this.form.value.newPassword
    };

    this.authService.changePassword(payload).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        // Log de auditoria local (HU-007)
        console.log(JSON.stringify({ event: "password_change_profile", status: "success" }));
        
        this.successMessage.set('Contraseña actualizada correctamente.');
        this.form.reset();
        
        // Auto colapsar después de un tiempo
        setTimeout(() => {
          this.isOpen.set(false);
          this.successMessage.set(null);
          this.closed.emit();
        }, 3000);
      },
      error: (err) => {
        console.error('Error al cambiar contraseña', err);
        const left = this.attemptsLeft() - 1;
        this.attemptsLeft.set(left);
        if (left > 0) {
          this.passwordErrorMsg.set(`Contraseña actual incorrecta. Te quedan ${left} intentos.`);
        } else {
          this.passwordErrorMsg.set(`Has agotado tus intentos. Por seguridad, la función ha sido bloqueada.`);
          this.form.disable();
        }
      }
    });
  }
}
