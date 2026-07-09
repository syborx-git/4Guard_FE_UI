import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthState } from '../../core/auth/auth.state';
import { UsersService } from '../../core/services/users.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'fg-user-profile-bento',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-profile-bento.component.html',
  styleUrl: './user-profile-bento.component.css'
})
export class UserProfileBentoComponent implements OnInit {
  protected readonly authState = inject(AuthState);
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);

  isEditingContact = signal(false);
  isLoading = signal(false);

  contactForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    phone: ['']
  });

  ngOnInit() {
    // Inicializar el formulario con el email actual
    // Como currentUser puede ser null, usamos optional chaining
    const user = this.authState.currentUser();
    const currentEmail = user && 'email' in user ? (user as any).email : '';
    this.contactForm.patchValue({ email: currentEmail, phone: '+1 234 567 8900' });

    // Criterio de Log de Auditoría (Simulación local exigida por HU-006)
    console.log(JSON.stringify({ event: "profile_bento_view", status: "success" }));
  }

  toggleEdit() {
    this.isEditingContact.update(v => !v);
  }

  saveContactInfo() {
    if (this.contactForm.invalid) return;

    this.isLoading.set(true);
    const payload = {
      email: this.contactForm.value.email || '',
      phone: this.contactForm.value.phone || ''
    };

    this.usersService.updateUserProfile(payload)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.isEditingContact.set(false);
        },
        error: (err: unknown) => {
          console.error('Error actualizando perfil', err);
          // Opcionalmente, mostrar notificación visual al usuario aquí
          this.isEditingContact.set(false);
        }
      });
  }

  logout() {
    this.authState.logout();
  }
}
