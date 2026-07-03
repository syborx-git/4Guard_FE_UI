/**
 * @file login.component.ts
 * @description P1 — Login Administrativo (HU-001).
 * Formulario centrado con validación reactiva de email.
 * Botón "Continuar" deshabilitado hasta formato válido.
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthState } from '../../../core/auth/auth.state';
import { AuthService } from '../../../core/services/auth.service';
import { LoginResponse } from '../../../core/models/auth.models';

@Component({
  selector: 'fg-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authState = inject(AuthState);
  private readonly authService = inject(AuthService);

  // Variable de estado para alternar vistas condicionalmente ('login' o 'forgot')
  protected readonly view = signal<'login' | 'forgot'>('login');

  // Señales reactivas para el estado de carga y errores
  protected readonly isLoading = signal<boolean>(false);
  protected readonly showPwd = signal<boolean>(false);
  protected readonly loginError = signal<string | null>(null);
  protected readonly loginInfo  = signal<string | null>(null);

  // Variables auxiliares para el proceso de recuperación de contraseña
  protected readonly isSendingForgot = signal<boolean>(false);
  protected readonly forgotSuccess = signal<boolean>(false);
  protected readonly forgotError = signal<string | null>(null);

  // Formulario reactivo para el ingreso de credenciales (admite email o username)
  protected readonly form = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Control independiente para el correo de recuperación
  protected readonly forgotEmail = this.fb.control('', [Validators.required, Validators.email]);

  // Getters para acceso limpio a controles del formulario de credenciales
  get emailCtrl() {
    return this.form.controls.email;
  }

  get passwordCtrl() {
    return this.form.controls.password;
  }

  // Getter para acceso limpio al control de recuperación de contraseña
  get forgotEmailCtrl() {
    return this.forgotEmail;
  }

  /**
   * Determina si el campo de correo electrónico cumple con las validaciones básicas.
   */
  protected get isEmailValid(): boolean {
    return this.emailCtrl.valid;
  }

  /**
   * Determina si todo el formulario de inicio de sesión es válido.
   */
  protected get isFormValid(): boolean {
    return this.form.valid;
  }

  /**
   * Alterna la visibilidad de la contraseña en el input.
   */
  protected togglePwd(): void {
    this.showPwd.update((v) => !v);
  }

  /**
   * Modifica la vista actual y limpia errores/valores anteriores.
   */
  protected setView(newView: 'login' | 'forgot'): void {
    this.view.set(newView);
    this.loginError.set(null);
    this.forgotError.set(null);
    this.forgotSuccess.set(false);
    this.forgotEmail.reset();
  }

  /**
   * Procesa la autenticación llamando al servicio local y actualizando el estado global.
   */
  protected onSubmit(): void {
    if (!this.form.valid || this.isLoading()) return;
    this.loginError.set(null);
    this.isLoading.set(true);

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
        const errorMsg = err.error?.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.';
        this.loginError.set(errorMsg);
      },
    });
  }

  /**
   * Procesa la solicitud de recuperación de contraseña simulando un envío asíncrono.
   */
  protected onForgotSubmit(): void {
    if (this.forgotEmail.invalid || this.isSendingForgot()) return;
    this.forgotError.set(null);
    this.forgotSuccess.set(false);
    this.isSendingForgot.set(true);

    // Simula una llamada asíncrona de recuperación (800ms)
    of(true).pipe(delay(800)).subscribe({
      next: () => {
        this.isSendingForgot.set(false);
        this.forgotSuccess.set(true);
      },
      error: () => {
        this.isSendingForgot.set(false);
        this.forgotError.set('No se pudo enviar el enlace de recuperación. Inténtalo más tarde.');
      }
    });
  }
}
