/**
 * @file putaway-scan.component.ts
 * @description P9 — Módulo de Ubicación en Rack (Putaway) RF.
 * Implementa la Regla de Pablo (Coordinador): El operador no sugiere rack;
 * la coordinación preasigna la Rampa y el Rack destino.
 * Validación guiada en 2 pasos: Escaneo de SSCC en Rampa ➔ Escaneo estricto de Rack Asignado.
 */

import {
  Component,
  signal,
  computed,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

export type PutawayStep = 'SCAN_PALLET' | 'SCAN_RACK' | 'BATCH_COMPLETED';

export interface AssignedPutawayTask {
  folio: string;
  rampCode: string;
  assignedBy: string;
  supplier: string;
  totalPallets: number;
}

export interface PutawayItem {
  sscc: string;
  sku: string;
  description: string;
  pieces: number;
  assignedRack: string;
  levelInfo: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'STORED';
  scannedAt?: Date;
}

@Component({
  selector: 'fg-rf-putaway-scan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './putaway-scan.component.html',
  styleUrl: './putaway-scan.component.css',
})
export class PutawayScanComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef<HTMLInputElement>;

  private readonly router = inject(Router);
  private readonly audio  = inject(AudioFeedbackService);

  // Datos de la orden de recepción preasignada por Pablo
  protected readonly assignedTask = signal<AssignedPutawayTask>({
    folio: 'REC-2026-000042',
    rampCode: 'RAMPA 03 (Andén Norte)',
    assignedBy: 'Pablo R. (Coordinación)',
    supplier: 'Distribuidora Internacional de Alimentos S.A.',
    totalPallets: 5,
  });

  // Estado del flujo guiado
  protected readonly currentStep      = signal<PutawayStep>('SCAN_PALLET');
  protected readonly currentInput     = signal('');
  protected readonly isProcessing     = signal(false);
  protected readonly lastError        = signal<string | null>(null);
  protected readonly activePallet     = signal<PutawayItem | null>(null);

  // Base de tarimas de la recepción asignada
  protected readonly pendingPallets = signal<PutawayItem[]>([
    {
      sscc: 'SSCC-175012345000000018',
      sku: 'SKU-ACEITE-001',
      description: 'Aceite Vegetal Comestible 12x1L',
      pieces: 576,
      assignedRack: 'RACK A-04-02',
      levelInfo: 'Nivel 2, Posición 1',
      status: 'PENDING',
    },
    {
      sscc: 'SSCC-175012345000000025',
      sku: 'SKU-ARROZ-003',
      description: 'Arroz Super Extra Bolsa 24x900g',
      pieces: 480,
      assignedRack: 'RACK A-04-05',
      levelInfo: 'Nivel 1, Posición 2',
      status: 'PENDING',
    },
    {
      sscc: 'SSCC-175012345000000032',
      sku: 'SKU-ATUN-007',
      description: 'Atún en Agua Lata 180g (Pack 48)',
      pieces: 1152,
      assignedRack: 'RACK A-04-08',
      levelInfo: 'Nivel 3, Posición 1',
      status: 'PENDING',
    },
    {
      sscc: 'SSCC-175012345000000049',
      sku: 'SKU-CAFE-001',
      description: 'Café Tostado y Molido Gourmet 500g',
      pieces: 720,
      assignedRack: 'RACK A-05-01',
      levelInfo: 'Nivel 1, Posición 1',
      status: 'PENDING',
    },
  ]);

  // Tarimas ya guardadas exitosamente en rack
  protected readonly storedBuffer = signal<PutawayItem[]>([
    {
      sscc: 'SSCC-175012345000000001',
      sku: 'SKU-AGUA-002',
      description: 'Agua Purificada Botella 1.5L',
      pieces: 600,
      assignedRack: 'RACK A-04-01',
      levelInfo: 'Nivel 1, Posición 1',
      status: 'STORED',
      scannedAt: new Date(Date.now() - 15 * 60000),
    },
  ]);

  protected readonly storedCount = computed(() => this.storedBuffer().length);
  protected readonly totalCount  = computed(() => this.storedBuffer().length + this.pendingPallets().length);

  ngAfterViewInit(): void {
    this.focusScanInput();
  }

  protected focusScanInput(): void {
    setTimeout(() => this.scanInput?.nativeElement?.focus(), 100);
  }

  /** Procesa entrada de lector láser */
  protected onScanInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.trim();
    if (val.length >= 4) {
      this.handleScannedCode(val);
      this.currentInput.set('');
      (event.target as HTMLInputElement).value = '';
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.currentInput().trim();
      if (val) {
        this.handleScannedCode(val);
        this.currentInput.set('');
      }
    }
  }

  /**
   * Manejador central de escaneo con validación estricta de 2 pasos
   */
  protected handleScannedCode(code: string): void {
    this.lastError.set(null);
    const step = this.currentStep();

    if (step === 'SCAN_PALLET') {
      this.processPalletScan(code);
    } else if (step === 'SCAN_RACK') {
      this.processRackScan(code);
    }
  }

  /** Paso 1: Valida el SSCC escaneado en Rampa */
  private processPalletScan(code: string): void {
    // Verificar si ya fue guardado
    if (this.storedBuffer().some(item => item.sscc === code)) {
      this.lastError.set(`⚠️ Tarima Duplicada: El SSCC ${code} ya fue guardado en su rack.`);
      this.audio.playError();
      return;
    }

    // Buscar en las tarimas pendientes de la recepción
    const found = this.pendingPallets().find(item => item.sscc === code);
    if (!found) {
      // Tarima no pertenece a esta recepción asignada
      this.lastError.set(`❌ Tarima no asignada a esta recepción: ${code}. Verifica con Pablo (Coordinación).`);
      this.audio.playError();
      return;
    }

    // Tarima válida encontrada
    this.isProcessing.set(true);
    setTimeout(() => {
      this.activePallet.set({ ...found, status: 'IN_TRANSIT' });
      this.currentStep.set('SCAN_RACK');
      this.isProcessing.set(false);
      this.audio.playSuccess();
      this.focusScanInput();
    }, 250);
  }

  /** Paso 2: Valida que el operario esté en el Rack exactamente preasignado */
  private processRackScan(code: string): void {
    const pallet = this.activePallet();
    if (!pallet) {
      this.currentStep.set('SCAN_PALLET');
      return;
    }

    // Normalizar códigos de rack para comparación insensible a espacios o mayúsculas
    const normalizedScanned = code.toUpperCase().replace(/\s+/g, '-');
    const normalizedExpected = pallet.assignedRack.toUpperCase().replace(/\s+/g, '-');

    if (normalizedScanned !== normalizedExpected && !normalizedScanned.includes(normalizedExpected.replace('RACK-', ''))) {
      // Error de colocación: El operario intentó escanear otro rack
      this.lastError.set(`❌ RACK INCORRECTO: Escaneaste '${code}'. La regla de coordinación de Pablo exige colocarlo en: ${pallet.assignedRack}.`);
      this.audio.playError();
      return;
    }

    // Rack correcto: Guardado exitoso y transición FSM a Estado 40 (Almacenado)
    this.isProcessing.set(true);
    setTimeout(() => {
      const storedItem: PutawayItem = {
        ...pallet,
        status: 'STORED',
        scannedAt: new Date(),
      };

      // Mover de pendiente a guardado
      this.pendingPallets.update(list => list.filter(p => p.sscc !== pallet.sscc));
      this.storedBuffer.update(list => [storedItem, ...list]);

      this.activePallet.set(null);
      this.isProcessing.set(false);
      this.audio.playSuccess();

      if (this.pendingPallets().length === 0) {
        this.currentStep.set('BATCH_COMPLETED');
      } else {
        this.currentStep.set('SCAN_PALLET');
      }

      this.focusScanInput();
    }, 400);
  }

  /** Simulación Paso 1: Escanear siguiente tarima pendiente en rampa */
  protected simulateScanNextPallet(): void {
    const next = this.pendingPallets()[0];
    if (next) {
      this.handleScannedCode(next.sscc);
    }
  }

  /** Simulación Paso 2: Escanear el rack asignado correcto */
  protected simulateScanCorrectRack(): void {
    const pallet = this.activePallet();
    if (pallet) {
      this.handleScannedCode(pallet.assignedRack);
    }
  }

  /** Simulación Paso 2: Escanear un rack incorrecto para probar validación y sonido de error */
  protected simulateScanWrongRack(): void {
    this.handleScannedCode('RACK B-99-99');
  }

  /** Cancelar traslado actual y volver al paso 1 */
  protected cancelCurrentTransit(): void {
    this.activePallet.set(null);
    this.lastError.set(null);
    this.currentStep.set('SCAN_PALLET');
    this.audio.playWarning();
    this.focusScanInput();
  }

  protected goBack(): void {
    this.router.navigate(['/menu']);
  }

  protected formatTime(date?: Date): string {
    if (!date) return '';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
}
