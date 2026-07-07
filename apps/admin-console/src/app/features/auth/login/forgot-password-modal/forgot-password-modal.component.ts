/**
 * @file forgot-password-modal.component.ts
 * @description HU-003 — Modal de recuperacion de acceso.
 *
 * Flujo:
 *   1. Se abre desde el Login al presionar "¿Olvido su contrasena?"
 *   2. El usuario ingresa su USUARIO (no email)
 *   3. Se simula una peticion al backend
 *   4. Se muestra pantalla de exito con instrucciones para contactar al Supervisor
 *
 * IMPORTANTE:
 *   - NO modifica rutas ni navega a otras paginas.
 *   - NO usa alert().
 *   - Se cierra con ESC o click fuera del card.
 *   - La logica de negocio se delega al backend via endpoints Swagger.
 */

import {
  Component,
  signal,
  output,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

/** Estados internos del modal */
type ModalView = 'form' | 'loading' | 'success';

@Component({
  selector: 'fg-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.css',
})
export class ForgotPasswordModalComponent implements OnDestroy {
  /**
   * Evento emitido al padre (LoginComponent) para indicar que el modal debe cerrarse.
   * El padre controla la visibilidad con showForgotModal().
   */
  readonly closed = output<void>();

  // ── Estado interno ───────────────────────────────────────
  protected readonly view = signal<ModalView>('form');
  protected readonly submittedUsername = signal('');
  protected readonly fieldError = signal('');

  // ── Control del campo Usuario ────────────────────────────
  protected readonly usernameCtrl = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(50),
  ]);

  // Timer ref para limpieza en OnDestroy
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Cerrar con tecla ESC ─────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.close();
  }

  // ── Cerrar al hacer click fuera del card ─────────────────
  protected onBackdropClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('fp-backdrop')) {
      this.close();
    }
  }

  /**
   * Emite el evento de cierre y reinicia el estado del modal con un pequeño
   * retardo para que la animacion de fade-out se complete antes del reset.
   */
  protected close(): void {
    this.closed.emit();

    this.resetTimer = setTimeout(() => {
      this.view.set('form');
      this.usernameCtrl.reset();
      this.fieldError.set('');
    }, 300);
  }

  /**
   * Validacion en tiempo real: limpia el error al escribir.
   */
  protected onInputChange(): void {
    if (this.fieldError()) {
      this.fieldError.set('');
    }
  }

  /**
   * Procesa la solicitud de recuperacion.
   *
   * Validaciones previas al envio:
   *   - Campo no vacio
   *   - Minimo 3 caracteres
   *
   * TODO: Consumir endpoint de recuperacion
   *   POST /api/v1/auth/recovery-request
   *   Body: { username: string }
   *
   * TODO: Registrar evento en auditoria
   *   POST /api/v1/audit/events
   *   Body: { eventType: 'RECOVERY_REQUEST', username: string, timestamp: ISO }
   */
  protected onSubmit(): void {
    const rawValue = this.usernameCtrl.value?.trim() ?? '';

    // Validacion en tiempo real: campo vacio
    if (!rawValue) {
      this.fieldError.set('Ingresa tu usuario.');
      this.usernameCtrl.markAsTouched();
      return;
    }

    // Validacion: longitud minima
    if (rawValue.length < 3) {
      this.fieldError.set('El usuario debe tener al menos 3 caracteres.');
      this.usernameCtrl.markAsTouched();
      return;
    }

    // Limpiar error y pasar a estado loading
    this.fieldError.set('');
    this.view.set('loading');

    // Lista simulada de usuarios conocidos en el sistema
    const validUsers = ['enrique', 'carlos', 'chris4g', 'Chris4G', 'admin', 'admin123'];

    // Simulacion de llamada al backend (1500ms)
    // TODO: Reemplazar con llamada real al servicio de recuperacion
    setTimeout(() => {
      // TODO: Registrar evento en auditoria
      // TODO: Manejar errores del backend

      const userExists = validUsers.includes(rawValue);

      if (!userExists) {
        // Regresa a la vista del formulario y muestra el error discretamente
        this.view.set('form');
        this.fieldError.set('Usuario no encontrado.');
        this.usernameCtrl.markAsTouched();
        return;
      }

      // Registro exitoso
      this.submittedUsername.set(rawValue);
      this.view.set('success');
    }, 1500);
  }

  /**
   * Boton "Aceptar" en la pantalla de exito: cierra el modal y regresa al Login.
   */
  protected onAccept(): void {
    this.close();
  }

  ngOnDestroy(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }
}
