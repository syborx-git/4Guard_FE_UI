/**
 * @file forgot-password-modal.component.ts
 * @description HU-003 — Modal de recuperación de acceso.
 *
 * Flujo:
 *   1. Se abre desde el Login al presionar "¿Olvidó su contraseña?"
 *   2. El usuario ingresa su usuario o correo electrónico
 *   3. Se llama al endpoint público PUT /api/v1/users/reset-password-temp
 *   4. En éxito: se muestra la contraseña temporal para que el usuario la copie
 *   5. En error 404: se muestra el mensaje del backend en el formulario
 *
 * IMPORTANTE:
 *   - NO modifica rutas ni navega a otras páginas.
 *   - NO usa alert().
 *   - Se cierra con ESC o click fuera del card.
 *   - La lógica de negocio se delega al backend via UsersService.
 */

import {
  Component,
  signal,
  output,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { UsersService } from '../../../../core/services/users.service';

/** Estados internos del modal */
type ModalView = 'form' | 'loading' | 'success' | 'error';

@Component({
  selector: 'fg-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.css',
})
export class ForgotPasswordModalComponent implements OnDestroy {
  private readonly usersService = inject(UsersService);

  /**
   * Evento emitido al padre (LoginComponent) para indicar que el modal debe cerrarse.
   * El padre controla la visibilidad con showForgotModal().
   */
  readonly closed = output<void>();

  // ── Estado interno ────────────────────────────────────────
  protected readonly view              = signal<ModalView>('form');
  protected readonly fieldError        = signal('');
  protected readonly temporaryPassword = signal('');
  protected readonly copied            = signal(false);

  // ── Control del campo Usuario o Email ──────────────────────
  protected readonly identifierCtrl = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(100),
  ]);

  // Timer ref para limpieza en OnDestroy
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  private apiSubscription?: Subscription;

  // ── Cerrar con tecla ESC ────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.close();
  }

  // ── Cerrar al hacer click fuera del card ────────────────────
  protected onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fp-backdrop')) {
      this.close();
    }
  }

  /**
   * Emite el evento de cierre y reinicia el estado del modal con un pequeño
   * retardo para que la animación de fade-out se complete antes del reset.
   */
  protected close(): void {
    this.closed.emit();

    this.resetTimer = setTimeout(() => {
      this.view.set('form');
      this.identifierCtrl.reset();
      this.fieldError.set('');
      this.temporaryPassword.set('');
      this.copied.set(false);
    }, 300);
  }

  /**
   * Validación en tiempo real: limpia el error al escribir.
   */
  protected onInputChange(): void {
    if (this.fieldError()) {
      this.fieldError.set('');
    }
  }

  /**
   * Procesa la solicitud de contraseña temporal llamando al backend.
   *
   * Endpoint: PUT /api/v1/users/reset-password-temp?usernameOrEmail={valor}
   * Sin token — endpoint público.
   */
  protected onSubmit(): void {
    const rawValue = this.identifierCtrl.value?.trim() ?? '';

    if (!rawValue) {
      this.fieldError.set('Ingresa tu usuario o correo electrónico.');
      this.identifierCtrl.markAsTouched();
      return;
    }

    if (rawValue.length < 3) {
      this.fieldError.set('Debe tener al menos 3 caracteres.');
      this.identifierCtrl.markAsTouched();
      return;
    }

    this.fieldError.set('');
    this.view.set('loading');

    this.apiSubscription?.unsubscribe();
    this.apiSubscription = this.usersService
      .requestPasswordReset(rawValue)
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.temporaryPassword.set(response.data);
            this.view.set('success');
          } else {
            // El backend retornó 200 pero sin datos (caso improbable)
            this.view.set('form');
            this.fieldError.set(response.message || 'No se pudo generar la contraseña temporal.');
          }
        },
        error: (err: HttpErrorResponse) => {
          this.view.set('form');
          const backendMessage = err.error?.message;

          if (err.status === 404 && backendMessage) {
            this.fieldError.set(backendMessage);
          } else if (err.status === 0) {
            this.fieldError.set('Sin conexión al servidor. Verifica la red e inténtalo de nuevo.');
          } else {
            this.fieldError.set(backendMessage || 'Ocurrió un error. Inténtalo nuevamente.');
          }
          this.identifierCtrl.markAsTouched();
        },
      });
  }

  /**
   * Copia la contraseña temporal al portapapeles y muestra feedback visual.
   */
  protected copyToClipboard(): void {
    const password = this.temporaryPassword();
    if (!password) return;

    navigator.clipboard.writeText(password).then(() => {
      this.copied.set(true);
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2500);
    });
  }

  /**
   * Botón "Aceptar" en la pantalla de éxito: cierra el modal y regresa al Login.
   */
  protected onAccept(): void {
    this.close();
  }

  ngOnDestroy(): void {
    if (this.resetTimer)  clearTimeout(this.resetTimer);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.apiSubscription?.unsubscribe();
  }
}
