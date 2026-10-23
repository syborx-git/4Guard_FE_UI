/**
 * @file leader-auth-modal.component.ts
 * @description Modal de autenticación obligatoria para Líder de Almacén (Pablo / Alejandro).
 * Requerido para Cierre y Cancelación de Recepciones.
 */

import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'fg-leader-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div class="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        
        <!-- Header -->
        <div class="px-6 py-4 bg-gradient-to-r from-amber-900/40 via-slate-900 to-slate-900 border-b border-slate-700/60 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span class="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <h3 class="font-bold text-slate-100 text-lg leading-tight">{{ title }}</h3>
              <p class="text-xs text-amber-400 font-medium">Autenticación de Líder requerida</p>
            </div>
          </div>
          <button (click)="cancel()" type="button" class="text-slate-400 hover:text-slate-200 transition-colors">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <p class="text-xs text-slate-300">
            {{ description || 'Por favor ingresa las credenciales autorizadas del Líder de Almacén para validar esta operación.' }}
          </p>

          <div *ngIf="errorMessage()" class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <span class="material-symbols-outlined text-base">error</span>
            <span>{{ errorMessage() }}</span>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Usuario del Líder</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                <input
                  type="text"
                  [(ngModel)]="username"
                  placeholder="ej. pablo.lider"
                  class="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                <input
                  type="password"
                  [(ngModel)]="password"
                  (keyup.enter)="confirm()"
                  placeholder="••••••••"
                  class="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            (click)="cancel()"
            class="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="confirm()"
            class="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-base">security</span>
            Autorizar
          </button>
        </div>

      </div>
    </div>
  `
})
export class LeaderAuthModalComponent {
  @Input() isOpen = false;
  @Input() title = 'Autorización de Líder';
  @Input() description = '';

  @Output() validated = new EventEmitter<{ leaderName: string; username: string; password: string }>();
  @Output() closed = new EventEmitter<void>();

  username = '';
  password = '';
  errorMessage = signal<string | null>(null);

  confirm(): void {
    this.errorMessage.set(null);
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage.set('Por favor ingresa usuario y contraseña.');
      return;
    }

    // Formateo del nombre del líder
    const name = this.username.trim();
    const formattedLeaderName = name.toLowerCase().includes('pablo')
      ? 'Pablo Hernández (Líder)'
      : name.toLowerCase().includes('alejandro')
      ? 'Alejandro Martínez (Líder)'
      : `${name} (Líder Autorizado)`;

    this.validated.emit({
      leaderName: formattedLeaderName,
      username: this.username.trim(),
      password: this.password.trim(),
    });
    this.resetForm();
  }

  cancel(): void {
    this.resetForm();
    this.closed.emit();
  }

  private resetForm(): void {
    this.username = '';
    this.password = '';
    this.errorMessage.set(null);
  }
}
