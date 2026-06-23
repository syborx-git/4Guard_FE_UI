/**
 * @file receiving-wizard.component.ts
 * @description P4 — Consola de Recepción "La Bóveda" [HU-016].
 * Wizard de 2 pasos: captura de datos del vehículo + cuadratura.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

interface ReceiptLine {
  id: string;
  sku: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  status: number;
}

@Component({
  selector: 'fg-receiving-wizard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receiving-wizard.component.html',
  styleUrl: './receiving-wizard.component.css',
})
export class ReceivingWizardComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly currentStep = signal<1 | 2>(1);
  protected readonly isClosing   = signal(false);
  protected readonly isClosed    = signal(false);

  // ── Paso 1: Datos del vehículo ────────────────────────────
  protected readonly step1Form = this.fb.group({
    truckPlates: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,9}$/i)]],
    driverName:  ['', [Validators.required, Validators.minLength(3)]],
    sealPrimary: ['', Validators.required],
    sealSecondary: [''],
    asnReference: ['', Validators.required],
    dockNumber: ['AND-01', Validators.required],
  });

  // ── Paso 2: Líneas de recepción (mock) ────────────────────
  protected readonly receiptLines = signal<ReceiptLine[]>([
    { id: 'L001', sku: 'SKU-CAFE-001',     description: 'Café Molido 500g',        expectedQty: 48, receivedQty: 48, status: 30 },
    { id: 'L002', sku: 'SKU-CAFE-002',     description: 'Café Soluble 200g',       expectedQty: 36, receivedQty: 36, status: 30 },
    { id: 'L003', sku: 'SKU-CAPSULA-001',  description: 'Cápsulas Espresso x10',  expectedQty: 120, receivedQty: 100, status: 20 },
    { id: 'L004', sku: 'SKU-CAPSULA-002',  description: 'Cápsulas Lungo x10',     expectedQty: 60, receivedQty: 0, status: 10 },
    { id: 'L005', sku: 'SKU-CAPSULA-003',  description: 'Cápsulas Decaf x10',     expectedQty: 60, receivedQty: 0, status: 10 },
  ]);

  protected readonly totalExpected = computed(() =>
    this.receiptLines().reduce((s, l) => s + l.expectedQty, 0)
  );

  protected readonly totalReceived = computed(() =>
    this.receiptLines().reduce((s, l) => s + l.receivedQty, 0)
  );

  protected readonly quadraturePercent = computed(() => {
    const total = this.totalExpected();
    if (total === 0) return 0;
    return Math.round((this.totalReceived() / total) * 100);
  });

  protected readonly canClose = computed(() =>
    this.quadraturePercent() === 100
  );

  // Gauge SVG
  protected readonly gaugeCircumference = 2 * Math.PI * 44;
  protected readonly gaugeDashOffset = computed(() => {
    const pct = this.quadraturePercent() / 100;
    return this.gaugeCircumference * (1 - pct);
  });
  protected readonly gaugeColor = computed(() => {
    const pct = this.quadraturePercent();
    if (pct === 100) return 'var(--color-success, #00897B)';
    if (pct >= 80)  return 'var(--color-warning, #F9A825)';
    return 'var(--color-danger, #E53935)';
  });

  protected goToStep2(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }
    this.currentStep.set(2);
  }

  protected goBack(): void {
    this.currentStep.set(1);
  }

  protected scanLine(lineId: string): void {
    // Simula escaneo: incrementa receivedQty de la línea
    this.receiptLines.update(lines =>
      lines.map(l => {
        if (l.id === lineId && l.receivedQty < l.expectedQty) {
          return { ...l, receivedQty: l.receivedQty + Math.min(10, l.expectedQty - l.receivedQty) };
        }
        return l;
      })
    );
  }

  protected closeReceipt(): void {
    if (!this.canClose()) return;
    this.isClosing.set(true);
    setTimeout(() => {
      this.isClosing.set(false);
      this.isClosed.set(true);
    }, 2000);
  }

  protected getLineStatusClass(status: number): string {
    if (status === 30) return 'line--ok';
    if (status === 20) return 'line--partial';
    return 'line--pending';
  }

  protected getLineStatusLabel(line: ReceiptLine): string {
    if (line.receivedQty === 0) return 'Pendiente';
    if (line.receivedQty < line.expectedQty) return 'Parcial';
    return 'Completo';
  }

  protected navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
