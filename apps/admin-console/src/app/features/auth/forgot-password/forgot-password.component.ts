/**
 * @file forgot-password.component.ts
 * @description P2 — Recuperar Contraseña (HU-003).
 * Flujo de recuperación simulado con log de auditoría local.
 */

import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

type FlowState = 'form' | 'loading' | 'success';

@Component({
  selector: 'fg-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly flowState = signal<FlowState>('form');

  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  get emailCtrl() { return this.form.controls.email; }

  protected get isValid() { return this.form.valid; }
  protected get isLoading() { return this.flowState() === 'loading'; }
  protected get isSuccess() { return this.flowState() === 'success'; }

  protected onSubmit(): void {
    if (!this.form.valid) return;

    this.flowState.set('loading');

    // Simula llamada al backend con delay de 1.5s
    setTimeout(() => {
      this.writeAuditLog(this.emailCtrl.value!);
      this.flowState.set('success');
    }, 1500);
  }

  /** Asienta el evento en el log de auditoría local (localStorage) */
  private writeAuditLog(email: string): void {
    const log: AuditEntry[] = JSON.parse(
      localStorage.getItem('4guard_audit_log') ?? '[]'
    );
    log.push({
      timestamp: new Date().toISOString(),
      event: 'PASSWORD_RECOVERY_REQUESTED',
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
