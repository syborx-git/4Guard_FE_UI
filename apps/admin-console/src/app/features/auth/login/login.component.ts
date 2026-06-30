/**
 * @file login.component.ts
 * @description P1 — Login Administrativo (HU-001).
 * Formulario centrado con validación reactiva de email.
 * Botón "Continuar" deshabilitado hasta formato válido.
 */

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthState } from '@4guard/shared-core';

@Component({
  selector: 'fg-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb        = inject(FormBuilder);
  private readonly authState = inject(AuthState);
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);

  protected readonly isLoading  = this.authState.isLoading;
  protected readonly showPwd    = signal(false);
  protected readonly loginError = signal<string | null>(null);
  protected readonly loginInfo  = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get emailCtrl()    { return this.form.controls.email; }
  get passwordCtrl() { return this.form.controls.password; }

  protected get isEmailValid(): boolean {
    return this.emailCtrl.valid;
  }

  protected get isFormValid(): boolean {
    return this.form.valid;
  }

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'inactivity') {
      this.loginInfo.set('Sesión cerrada por inactividad.');
    }
  }

  protected togglePwd(): void {
    this.showPwd.update((v) => !v);
  }

  protected onSubmit(): void {
    if (!this.form.valid) return;
    this.loginError.set(null);
    this.loginInfo.set(null);

    const { email, password } = this.form.getRawValue();

    // Mock login — simula autenticación exitosa
    this.authState.login({ email: email!, password: password! }).subscribe({
      next: () => {
        /* AuthState.login() ya redirige según rol */
      },
      error: () => {
        this.loginError.set('Credenciales incorrectas. Verifica tu correo y contraseña.');
      },
    });
  }
}
