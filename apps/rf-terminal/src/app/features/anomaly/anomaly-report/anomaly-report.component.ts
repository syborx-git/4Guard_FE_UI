/**
 * @file anomaly-report.component.ts
 * @description P10 — Reporte de Siniestros y Disposición Final [HU-164].
 * Implementa la Regla de Pablo: Transición automática a Dado de Baja (80),
 * inmutabilidad de posición en rack para trazabilidad y botón 'Liberado para destrucción'.
 */

import { Component, signal, inject, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';

type ReportStatus = 'form' | 'submitting' | 'submitted';

export interface MockPalletInfo {
  sscc: string;
  sku: string;
  description: string;
  location: string;
  pieces: number;
}

@Component({
  selector: 'fg-anomaly-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './anomaly-report.component.html',
  styleUrl: './anomaly-report.component.css',
})
export class AnomalyReportComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('ssccInput') ssccInput!: ElementRef<HTMLInputElement>;

  private readonly fb         = inject(FormBuilder);
  private readonly router     = inject(Router);
  private readonly audio      = inject(AudioFeedbackService);
  private readonly compressor = inject(ImageCompressorService);

  protected readonly status        = signal<ReportStatus>('form');
  protected readonly ticketId      = signal('');
  protected readonly isDestruction = signal(false);
  protected readonly photoPreview  = signal<string | null>(null);
  protected readonly photoSizeKb   = signal<number>(0);
  protected readonly palletFound   = signal<MockPalletInfo | null>(null);

  protected readonly CAUSES = [
    'Pallet colapsado / Tarima caída (HU-164)',
    'Mercancía perforada por uñas de montacargas',
    'Embalaje roto / Derrame de líquido',
    'Desplome por estiba vencida',
    'Caja aplastada en maniobra',
    'Otro siniestro físico',
  ];

  // Base de prueba de tarimas en rack para autocompletado de escaneo
  private readonly MOCK_PALLETS: Record<string, MockPalletInfo> = {
    'SSCC-175012345000000018': {
      sscc: 'SSCC-175012345000000018',
      sku: 'SKU-ACEITE-001',
      description: 'Aceite Vegetal Comestible 12x1L',
      location: 'RACK A-04-02 (Nivel 2, Pos 1)',
      pieces: 576,
    },
    'SSCC-175012345000000025': {
      sscc: 'SSCC-175012345000000025',
      sku: 'SKU-ARROZ-003',
      description: 'Arroz Super Extra Bolsa 24x900g',
      location: 'RACK A-04-05 (Nivel 1, Pos 2)',
      pieces: 480,
    },
  };

  protected readonly form = this.fb.group({
    sscc:        ['', [Validators.required, Validators.minLength(6)]],
    cause:       [this.CAUSES[0], Validators.required],
    description: ['Tarima colapsada durante maniobra en pasillo. Se requiere baja inmediata y retiro de pasillo.', [Validators.required, Validators.minLength(10)]],
    location:    ['', Validators.required],
  });

  ngOnInit(): void {
    setTimeout(() => this.focusSscc(), 200);
  }

  protected focusSscc(): void {
    this.ssccInput?.nativeElement?.focus();
  }

  /** Procesa el código SSCC escaneado */
  protected onSsccScan(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (value.length >= 6) {
      this.lookupPallet(value);
    }
  }

  protected lookupPallet(sscc: string): void {
    const pallet = this.MOCK_PALLETS[sscc] ?? {
      sscc,
      sku: 'SKU-GENERAL-099',
      description: 'Producto Palletizado General',
      location: 'RACK A-04-02 (Pasillo 4)',
      pieces: 320,
    };

    this.palletFound.set(pallet);
    this.form.patchValue({
      sscc: pallet.sscc,
      location: pallet.location,
    });
    this.audio.playSuccess();
  }

  /** Dispara el selector de cámara o archivo */
  protected triggerCamera(): void {
    this.fileInput?.nativeElement?.click();
  }

  /** Captura la foto y la comprime en el cliente usando HTML5 Canvas a ~150 KB */
  protected async onPhotoCaptured(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const rawFile = input.files[0];
      try {
        const compressedBase64 = await this.compressor.compressPhoto(rawFile, 1024, 0.75);
        this.photoPreview.set(compressedBase64);
        
        // Estimar tamaño en KB
        const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
        this.photoSizeKb.set(Math.round(sizeInBytes / 1024));
        this.audio.playSuccess();
      } catch (err) {
        console.error('Error comprimiendo imagen:', err);
      }
    }
  }

  /** Genera una foto simulada para pruebas en navegador */
  protected simulatePhoto(): void {
    // Generar un canvas con placeholder industrial
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('EVIDENCIA DE SINIESTRO', 140, 200);
      ctx.fillStyle = '#d0af67';
      ctx.font = '20px monospace';
      ctx.fillText(`SSCC: ${this.form.value.sscc || 'SSCC-00018'}`, 140, 250);
      ctx.fillText(`FECHA: ${new Date().toLocaleString()}`, 140, 290);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      this.photoPreview.set(dataUrl);
      this.photoSizeKb.set(138);
      this.audio.playSuccess();
    }
  }

  /** Registra la baja por siniestro y transiciona a Estado 80 */
  protected submitReport(fastDestruction = false): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.audio.playError();
      return;
    }

    if (!this.photoPreview()) {
      alert('⚠️ Es obligatorio adjuntar la fotografía de evidencia del siniestro.');
      this.audio.playWarning();
      return;
    }

    this.isDestruction.set(fastDestruction);
    this.status.set('submitting');

    setTimeout(() => {
      const ticket = `SIN-${Date.now().toString().slice(-6)}`;
      this.ticketId.set(ticket);
      this.audio.playSuccess();

      // Guardar en log local
      const log = JSON.parse(localStorage.getItem('4guard_anomaly_log') ?? '[]');
      log.push({
        ticket,
        ...this.form.getRawValue(),
        palletInfo: this.palletFound(),
        newState: '80: DADO_DE_BAJA',
        fastDestructionAuthorized: fastDestruction,
        evidenceSizeKb: this.photoSizeKb(),
        photoAttached: true,
        reportedAt: new Date().toISOString(),
      });
      localStorage.setItem('4guard_anomaly_log', JSON.stringify(log));

      this.status.set('submitted');
    }, 1200);
  }

  protected goBack(): void {
    this.router.navigate(['/menu']);
  }

  protected reset(): void {
    this.form.reset({
      cause: this.CAUSES[0],
      description: 'Tarima colapsada durante maniobra en pasillo. Se requiere baja inmediata y retiro de pasillo.',
    });
    this.status.set('form');
    this.photoPreview.set(null);
    this.photoSizeKb.set(0);
    this.palletFound.set(null);
    this.ticketId.set('');
    this.isDestruction.set(false);
    setTimeout(() => this.focusSscc(), 200);
  }
}
