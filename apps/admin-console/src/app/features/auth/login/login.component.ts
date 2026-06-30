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
import { AuthState, LoginService, LoginResponse } from '@4guard/shared-core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';

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
  private readonly loginService = inject(LoginService);

  // Variable de estado para alternar vistas condicionalmente ('login' o 'forgot')
  protected readonly view = signal<'login' | 'forgot'>('login');

  // Señales reactivas para el estado de carga y errores
  protected readonly isLoading = signal<boolean>(false);
  protected readonly showPwd = signal<boolean>(false);
  protected readonly loginError = signal<string | null>(null);

  // Variables auxiliares para el proceso de recuperación de contraseña
  protected readonly isSendingForgot = signal<boolean>(false);
  protected readonly forgotSuccess = signal<boolean>(false);
  protected readonly forgotError = signal<string | null>(null);

  // Formulario reactivo para el ingreso de credenciales
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
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
   * Procesa la autenticación y realiza la redirección directa si el usuario pertenece a Toluca.
   */
  protected onSubmit(): void {
    if (!this.form.valid || this.isLoading()) return;
    this.loginError.set(null);
    this.isLoading.set(true);

    const { email, password } = this.form.getRawValue();

    this.loginService.login({ email: email!, password: password! }).subscribe({
      next: (res: LoginResponse) => {
        this.isLoading.set(false);

        // Criterio de aceptación 1: Redirección directa si pertenece a Toluca
        if (res.user.branchId === 'BR-TOL-01') {
          this.authState.completeLogin(
            res.user,
            res.accessToken,
            res.refreshToken
          );
        } else {
          // Si pertenece a otra sucursal (ej. Querétaro), mostrar error corporativo amigable
          this.loginError.set('La sucursal asignada no está activa o disponible para este usuario.');
        }
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.loginError.set(err.message || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
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
