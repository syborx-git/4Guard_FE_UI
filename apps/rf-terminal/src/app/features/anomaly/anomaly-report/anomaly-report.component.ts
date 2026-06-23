/**
 * @file anomaly-report.component.ts
 * @description P10 — Reporte de Anomalía/Siniestros [HU-164].
 * Botón flotante siempre visible. Formulario de reporte con foto simulada.
 */

import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, inject } from '@angular/forms';

type ReportStatus = 'form' | 'submitting' | 'submitted';

@Component({
  selector: 'fg-anomaly-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './anomaly-report.component.html',
  styleUrl: './anomaly-report.component.css',
})
export class AnomalyReportComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly status     = signal<ReportStatus>('form');
  protected readonly photoTaken = signal(false);
  protected readonly ticketId   = signal('');

  protected readonly CAUSES = [
    'Pallet colapsado',
    'Mercancía derramada',
    'Embalaje dañado',
    'Producto vencido detectado',
    'Merma / robo',
    'Temperatura fuera de rango',
    'Otro',
  ];

  protected readonly form = this.fb.group({
    sscc:        ['', Validators.required],
    cause:       ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    location:    ['', Validators.required],
  });

  protected get isValid() { return this.form.valid; }
  protected get isSubmitting() { return this.status() === 'submitting'; }
  protected get isSubmitted() { return this.status() === 'submitted'; }

  protected simulatePhoto(): void {
    this.photoTaken.set(true);
  }

  protected onSubmit(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.status.set('submitting');

    setTimeout(() => {
      const ticket = `ANO-${Date.now().toString().slice(-6)}`;
      this.ticketId.set(ticket);

      // Guardar en log local
      const log = JSON.parse(localStorage.getItem('4guard_anomaly_log') ?? '[]');
      log.push({
        ticket,
        ...this.form.getRawValue(),
        photoAttached: this.photoTaken(),
        reportedAt: new Date().toISOString(),
      });
      localStorage.setItem('4guard_anomaly_log', JSON.stringify(log));

      this.status.set('submitted');
    }, 1500);
  }

  protected reset(): void {
    this.form.reset();
    this.status.set('form');
    this.photoTaken.set(false);
    this.ticketId.set('');
  }
}
