import { Component, input, output, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'fg-set-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './set-password-modal.component.html',
  styleUrl: './set-password-modal.component.css'
})
export class SetPasswordModalComponent {
  readonly userName = input.required<string>();
  readonly userEmail = input.required<string>();

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected newPassword = signal('');
  protected confirmPassword = signal('');
  protected showNewPassword = signal(false);
  protected showConfirmPassword = signal(false);

  protected errorMessage = signal<string | null>(null);
  protected isSaving = signal(false);

  @HostListener('document:keydown.escape')
  onEscKey(): void {
    this.close();
  }

  protected toggleShowNew(): void {
    this.showNewPassword.update((v) => !v);
  }

  protected toggleShowConfirm(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  protected close(): void {
    this.cancelled.emit();
  }

  protected submit(): void {
    const pwd1 = this.newPassword().trim();
    const pwd2 = this.confirmPassword().trim();

    if (!pwd1) {
      this.errorMessage.set('Por favor ingresa la nueva contraseña.');
      return;
    }

    if (pwd1.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!pwd2) {
      this.errorMessage.set('Por favor confirma la contraseña introduciéndola de nuevo.');
      return;
    }

    if (pwd1 !== pwd2) {
      this.errorMessage.set('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    this.errorMessage.set(null);
    this.isSaving.set(true);

    setTimeout(() => {
      this.isSaving.set(false);
      this.confirmed.emit(pwd1);
    }, 300);
  }
}
