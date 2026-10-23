/**
 * @file receiving-wizard.component.ts
 * @description Consola de Recepción "La Bóveda" [HU-016].
 * Wizard de 2 pasos integrado con HU-028 (Centro de Recepciones & Citas).
 * Soporta precarga por appointmentId en URL, rehidratación de progreso y lineId.
 */

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ReceptionAppointmentService } from '../services/reception-appointment.service';
import { ReceptionAppointment } from '../models/reception-appointment.models';

interface ReceiptLine {
  id: string; // lineId
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
export class ReceivingWizardComponent implements OnInit {
  private readonly fb      = inject(FormBuilder);
  private readonly router  = inject(Router);
  private readonly route   = inject(ActivatedRoute);
  private readonly service = inject(ReceptionAppointmentService);

  protected readonly currentStep = signal<1 | 2>(1);
  protected readonly isClosing   = signal(false);
  protected readonly isClosed    = signal(false);

  protected activeAppointment = signal<ReceptionAppointment | null>(null);
  protected appointmentId = signal<string | null>(null);
  protected appointmentError = signal<string | null>(null);

  // ── Paso 1: Datos del vehículo ────────────────────────────
  protected readonly step1Form = this.fb.group({
    truckPlates: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,10}$/i)]],
    driverName:  ['', [Validators.required, Validators.minLength(3)]],
    sealPrimary: ['', Validators.required],
    sealSecondary: [''],
    asnReference: ['', Validators.required],
    dockNumber: ['AND-01', Validators.required],
  });

  // ── Paso 2: Líneas de recepción (mock / pre-cargadas) ──────
  protected readonly receiptLines = signal<ReceiptLine[]>([
    { id: 'LNE-001', sku: 'SKU-CAFE-001',     description: 'Café Molido 500g',        expectedQty: 48, receivedQty: 48, status: 30 },
    { id: 'LNE-002', sku: 'SKU-CAFE-002',     description: 'Café Soluble 200g',       expectedQty: 36, receivedQty: 36, status: 30 },
    { id: 'LNE-003', sku: 'SKU-CAPSULA-001',  description: 'Cápsulas Espresso x10',  expectedQty: 120, receivedQty: 100, status: 20 },
    { id: 'LNE-004', sku: 'SKU-CAPSULA-002',  description: 'Cápsulas Lungo x10',     expectedQty: 60, receivedQty: 0, status: 10 },
    { id: 'LNE-005', sku: 'SKU-CAPSULA-003',  description: 'Cápsulas Decaf x10',     expectedQty: 60, receivedQty: 0, status: 10 },
  ]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('appointmentId');
    if (id) {
      this.appointmentId.set(id);
      const appt = this.service.getAppointmentById(id);
      if (appt) {
        this.activeAppointment.set(appt);
        this._populateFromAppointment(appt);
      } else {
        this.appointmentError.set(`No se encontró la cita de recepción con el código ${id}.`);
      }
    }
  }

  private _populateFromAppointment(appt: ReceptionAppointment): void {
    const actualPlates = appt.arrivalData?.actualPlates || appt.expectedPlates || '';
    const actualDriver = appt.arrivalData?.actualDriver || appt.expectedDriver || '';
    const sealPrimary  = appt.arrivalData?.sealPrimary || 'SL-' + Math.floor(100000 + Math.random() * 900000);
    const sealSecondary = appt.arrivalData?.sealSecondary || '';

    this.step1Form.patchValue({
      truckPlates: actualPlates,
      driverName: actualDriver,
      sealPrimary,
      sealSecondary,
      asnReference: appt.asnReference,
      dockNumber: appt.dockNumber,
    });

    if (appt.lines && appt.lines.length > 0) {
      const mappedLines: ReceiptLine[] = appt.lines.map((line) => {
        const received = appt.progress?.receivedQtyByLine?.[line.lineId] ?? 0;
        let st = 10;
        if (received >= line.expectedQty) st = 30;
        else if (received > 0) st = 20;

        return {
          id: line.lineId,
          sku: line.sku,
          description: line.description,
          expectedQty: line.expectedQty,
          receivedQty: received,
          status: st,
        };
      });
      this.receiptLines.set(mappedLines);
    }

    if (appt.progress?.currentStep) {
      this.currentStep.set(appt.progress.currentStep);
    }
  }

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

    const apptId = this.appointmentId();
    if (apptId) {
      this.service.updateProgress(apptId, {
        currentStep: 2,
        vehicleDataCompleted: true,
      });
    }
  }

  protected goBack(): void {
    this.currentStep.set(1);
    const apptId = this.appointmentId();
    if (apptId) {
      this.service.updateProgress(apptId, { currentStep: 1 });
    }
  }

  protected scanLine(lineId: string): void {
    let scannedSku = '';
    this.receiptLines.update(lines =>
      lines.map(l => {
        if (l.id === lineId && l.receivedQty < l.expectedQty) {
          scannedSku = l.sku;
          const nextQty = l.receivedQty + Math.min(10, l.expectedQty - l.receivedQty);
          const st = nextQty >= l.expectedQty ? 30 : 20;
          return { ...l, receivedQty: nextQty, status: st };
        }
        return l;
      })
    );

    const apptId = this.appointmentId();
    if (apptId) {
      const map: Record<string, number> = {};
      this.receiptLines().forEach(l => { map[l.id] = l.receivedQty; });
      this.service.updateProgress(apptId, {
        receivedQtyByLine: map,
        lastScannedSku: scannedSku || undefined,
        lastScanAt: new Date().toISOString(),
      });
    }
  }

  protected closeReceipt(): void {
    if (!this.canClose()) return;
    this.isClosing.set(true);

    const apptId = this.appointmentId();
    if (apptId) {
      this.service.updateProgress(apptId, {
        reconciliationCompleted: true,
        reconciliationCompletedAt: new Date().toISOString(),
        reconciliationCompletedBy: 'OPERATIONS_MANAGER',
      });
    }

    setTimeout(() => {
      this.isClosing.set(false);
      this.isClosed.set(true);
    }, 1500);
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

  protected navigateToCenter(): void {
    this.router.navigate(['/receiving']);
  }

  protected navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
