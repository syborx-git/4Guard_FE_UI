/**
 * @file picking-list.component.ts
 * @description P9 — Picking FEFO Guiado [HU-071].
 * Lista de recolección con validación FEFO crítica.
 * Si el operador escanea un SSCC que viola FEFO → pantalla ROJA + chicharra.
 */

import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PickLine {
  lineId: string;
  sku: string;
  description: string;
  qty: number;
  qtyDone: number;
  location: string;
  sscc: string;
  lot: string;
  expiresAt: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
}

@Component({
  selector: 'fg-picking-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './picking-list.component.html',
  styleUrl: './picking-list.component.css',
})
export class PickingListComponent implements AfterViewInit {
  @ViewChild('pickScanInput') scanInput!: ElementRef<HTMLInputElement>;

  protected readonly currentInput = signal('');
  protected readonly fefoViolation = signal(false);
  protected readonly violationSSCC = signal('');
  protected readonly successFlash  = signal(false);
  protected readonly currentLineIdx = signal(0);

  // Orden de picking FEFO (ordenado por fecha de vencimiento — más antiguo primero)
  protected readonly pickLines = signal<PickLine[]>([
    {
      lineId: 'PL-001',
      sku: 'SKU-CAFE-001',
      description: 'Café Molido Premium 500g',
      qty: 12, qtyDone: 0,
      location: 'A-1-01',
      sscc: 'SSCC-0001',
      lot: 'L2024-001',
      expiresAt: '2025-06-10',
      status: 'IN_PROGRESS',
    },
    {
      lineId: 'PL-002',
      sku: 'SKU-CAFE-001',
      description: 'Café Molido Premium 500g',
      qty: 6, qtyDone: 0,
      location: 'A-1-02',
      sscc: 'SSCC-0002',
      lot: 'L2024-002',
      expiresAt: '2025-06-12',
      status: 'PENDING',
    },
    {
      lineId: 'PL-003',
      sku: 'SKU-CEREAL-006',
      description: 'Cereal Integral 750g',
      qty: 24, qtyDone: 0,
      location: 'A-2-01',
      sscc: 'SSCC-0008',
      lot: 'L2024-008',
      expiresAt: '2025-03-15',
      status: 'PENDING',
    },
  ]);

  protected readonly currentLine = computed(() =>
    this.pickLines()[this.currentLineIdx()] ?? null
  );

  protected readonly completedCount = computed(() =>
    this.pickLines().filter(l => l.status === 'DONE').length
  );

  protected readonly totalCount = computed(() => this.pickLines().length);

  protected readonly progressPct = computed(() =>
    Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  protected readonly isComplete = computed(() =>
    this.completedCount() === this.totalCount()
  );

  // Web Audio API — chicharra
  private audioCtx: AudioContext | null = null;

  ngAfterViewInit(): void {
    this.scanInput?.nativeElement?.focus();
  }

  protected focusScan(): void {
    this.scanInput?.nativeElement?.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const val = this.currentInput().trim();
      if (val) {
        this.validateScan(val);
        this.currentInput.set('');
      }
    }
  }

  protected simulateScan(sscc: string): void {
    this.validateScan(sscc);
  }

  protected simulateWrongScan(): void {
    // Simula escaneo del 2do SSCC cuando corresponde el 1ro (viola FEFO)
    const wrongSSCC = 'SSCC-0002';
    this.validateScan(wrongSSCC);
  }

  private validateScan(sscc: string): void {
    const line = this.currentLine();
    if (!line) return;

    // ─ Validación FEFO ─────────────────────────────────────
    if (sscc !== line.sscc) {
      // ¡VIOLACIÓN FEFO! Pantalla roja + chicharra
      this.fefoViolation.set(true);
      this.violationSSCC.set(sscc);
      this.playBuzzer();

      // Auto-reset después de 3s
      setTimeout(() => {
        this.fefoViolation.set(false);
        this.violationSSCC.set('');
      }, 3000);
      return;
    }

    // ─ Escaneo correcto ─────────────────────────────────────
    this.pickLines.update(lines =>
      lines.map((l, i) => {
        if (i === this.currentLineIdx()) {
          return { ...l, qtyDone: l.qty, status: 'DONE' as const };
        }
        return l;
      })
    );

    this.successFlash.set(true);
    setTimeout(() => {
      this.successFlash.set(false);
      // Avanzar a la siguiente línea pendiente
      const nextIdx = this.pickLines().findIndex(
        (l, i) => i > this.currentLineIdx() && l.status !== 'DONE'
      );
      if (nextIdx !== -1) {
        this.currentLineIdx.set(nextIdx);
      }
    }, 800);
  }

  private playBuzzer(): void {
    try {
      this.audioCtx ??= new AudioContext();
      const osc  = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.type = 'square';
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime);
      osc.frequency.setValueAtTime(200, this.audioCtx.currentTime + 0.15);
      osc.frequency.setValueAtTime(320, this.audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);

      osc.start(this.audioCtx.currentTime);
      osc.stop(this.audioCtx.currentTime + 0.6);
    } catch {
      // Fallback silencioso si AudioContext no está disponible
    }
  }
}
