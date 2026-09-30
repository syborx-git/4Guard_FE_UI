/**
 * @file forklift-cockpit.component.ts
 * @description Cockpit Unificado del Montacarguista para Terminal RF PWA.
 * Flujo táctico: Seleccionar tarjeta -> Ver información concreta ->
 * Iniciar -> Abre modal de lectura con cámara en vivo (getUserMedia),
 * retícula animada, pistola láser física o escaneo por toque en tableta.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState } from '@4guard/shared-core';
import {
  ForkliftMissionService,
  ForkliftMission,
  CockpitFilter,
  ScanFeedback,
} from '../../core/services/forklift-mission.service';
import { AudioFeedbackService } from '../../core/services/audio-feedback.service';

@Component({
  selector: 'fg-forklift-cockpit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forklift-cockpit.component.html',
  styleUrl: './forklift-cockpit.component.css',
})
export class ForkliftCockpitComponent implements OnInit, OnDestroy {
  protected readonly missionService = inject(ForkliftMissionService);
  protected readonly audioService   = inject(AudioFeedbackService);
  protected readonly authState      = inject(AuthState);
  private readonly router           = inject(Router);

  @ViewChild('modalLaserInput') modalLaserInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;

  // ─── Modal 1: Ficha de Información Concreta / Plan de Misión ───────────────
  protected readonly selectedMissionForDetail = signal<ForkliftMission | null>(null);

  // ─── Modal 2: Modal Dedicado de Lectura Láser y Cámara en Vivo ────────────
  protected readonly showScanningModal = signal(false);
  protected readonly scannedInput = signal('');
  protected readonly isProcessingScan = signal(false);

  // Cámara en vivo en Tableta
  protected readonly cameraActive = signal(false);
  protected readonly cameraLoading = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly useCameraOverlay = signal(true);
  private mediaStream: MediaStream | null = null;
  private barcodeDetectorTimer: any = null;

  // ─── Modal 3: Reporte de Anomalía / Siniestro ─────────────────────────────
  protected readonly showIncidentModal = signal(false);
  protected readonly incidentType = signal('Pallet Inclinado / Colapsado');
  protected readonly incidentNote = signal('');
  protected readonly incidentPhotoCaptured = signal(false);

  // ─── Modal 4: Misión Completada / Celebración ─────────────────────────────
  protected readonly showCelebrationModal = signal(false);
  protected readonly justCompletedMission = signal<ForkliftMission | null>(null);

  // ─── Datos Computados ─────────────────────────────────────────────────────
  protected readonly activeMission = this.missionService.activeMission;
  protected readonly queuedMissions = this.missionService.queuedMissions;
  protected readonly counts = this.missionService.counts;
  protected readonly currentFilter = this.missionService.currentFilter;
  protected readonly scanFeedback = this.missionService.scanFeedback;

  protected readonly operatorName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Roberto Sánchez';
  });

  ngOnInit(): void {
    // Escuchar eventos globales de escaneo disparados por hardware o simulador
    window.addEventListener('rf:barcode-scanned', this.handleGlobalBarcodeScanned as EventListener);
  }

  ngOnDestroy(): void {
    window.removeEventListener('rf:barcode-scanned', this.handleGlobalBarcodeScanned as EventListener);
    this.stopCamera();
  }

  private handleGlobalBarcodeScanned = (event: CustomEvent<string>): void => {
    if (event.detail) {
      this.executeScan(event.detail);
    }
  };

  // ─── 1. Selección de Tarjeta para Ver Ficha Detallada ─────────────────────
  openMissionDetail(mission: ForkliftMission): void {
    this.selectedMissionForDetail.set(mission);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(30);
  }

  closeMissionDetail(): void {
    this.selectedMissionForDetail.set(null);
  }

  // ─── 2. Iniciar Movimiento y Abrir Modal de Lectura Láser / Cámara ─────────
  startMissionFromDetail(mission: ForkliftMission): void {
    this.missionService.takeMissionNow(mission.id);
    this.selectedMissionForDetail.set(null);
    this.openScanningModal();
  }

  async openScanningModal(): Promise<void> {
    this.showScanningModal.set(true);
    this.scannedInput.set('');
    this.audioService.playSuccess();

    // Enfocar input para lectura inmediata con pistola láser
    setTimeout(() => {
      if (this.modalLaserInputRef?.nativeElement) {
        this.modalLaserInputRef.nativeElement.focus();
      }
    }, 150);

    // Iniciar cámara de la tableta automáticamente
    await this.startCamera();
  }

  closeScanningModal(): void {
    this.stopCamera();
    this.showScanningModal.set(false);
    this.scannedInput.set('');
  }

  // ─── Gestión de Cámara en Vivo (Tableta / Móvil) ──────────────────────────
  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    this.cameraLoading.set(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // Cámara trasera preferida en tableta
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        this.mediaStream = stream;
        this.cameraActive.set(true);
        this.cameraLoading.set(false);

        setTimeout(() => {
          if (this.cameraVideoRef?.nativeElement) {
            this.cameraVideoRef.nativeElement.srcObject = stream;
            this.cameraVideoRef.nativeElement.play().catch(() => {});
            this.initBarcodeDetector();
          }
        }, 100);
      } else {
        this.cameraActive.set(false);
        this.cameraLoading.set(false);
        this.cameraError.set('Acceso a cámara no disponible en este dispositivo. Usa el láser o simulación.');
      }
    } catch (err: any) {
      this.cameraActive.set(false);
      this.cameraLoading.set(false);
      this.cameraError.set('Permiso de cámara no concedido o no detectada. Puedes escanear con láser o toque.');
    }
  }

  stopCamera(): void {
    if (this.barcodeDetectorTimer) {
      clearInterval(this.barcodeDetectorTimer);
      this.barcodeDetectorTimer = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.cameraVideoRef?.nativeElement) {
      this.cameraVideoRef.nativeElement.srcObject = null;
    }
    this.cameraActive.set(false);
    this.cameraLoading.set(false);
  }

  toggleCamera(): void {
    if (this.cameraActive()) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  }

  /** Detector nativo de código de barras con fallback a toque */
  private initBarcodeDetector(): void {
    if (typeof (window as any).BarcodeDetector !== 'undefined') {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'qr_code', 'data_matrix', 'itf'],
        });

        this.barcodeDetectorTimer = setInterval(async () => {
          if (this.cameraVideoRef?.nativeElement && this.cameraActive() && !this.isProcessingScan()) {
            try {
              const barcodes = await detector.detect(this.cameraVideoRef.nativeElement);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                this.executeScan(barcodes[0].rawValue);
              }
            } catch {}
          }
        }, 600);
      } catch {}
    }
  }

  // ─── 3. Filtrado Contextual ──────────────────────────────────────────────
  setFilter(filter: CockpitFilter): void {
    this.missionService.setFilter(filter);
  }

  // ─── 4. Procesamiento de Escaneo Láser ────────────────────────────────────
  onScanSubmit(): void {
    const code = this.scannedInput();
    if (!code) return;
    this.executeScan(code);
    this.scannedInput.set('');
  }

  executeScan(code: string): void {
    this.isProcessingScan.set(true);

    setTimeout(() => {
      const activeBefore = this.activeMission();
      const feedback = this.missionService.processScan(code);
      this.isProcessingScan.set(false);

      // Reenfocar input tras escaneo
      if (this.modalLaserInputRef?.nativeElement) {
        this.modalLaserInputRef.nativeElement.focus();
      }

      if (feedback.phase === 'DROP_COMPLETED') {
        if (activeBefore) {
          this.stopCamera();
          this.justCompletedMission.set(activeBefore);
          this.showScanningModal.set(false);
          this.showCelebrationModal.set(true);
        }
      }
    }, 150);
  }

  // ─── 5. Escaneo por Toque en Cámara / Botones Rápidos ─────────────────────
  onCameraFeedTapped(): void {
    const current = this.activeMission();
    if (!current) return;

    if (current.status === 'ACTIVE_PICK' || current.status === 'QUEUED') {
      this.simulateModalScanPick();
    } else if (current.status === 'ACTIVE_DROP') {
      this.simulateModalScanDrop();
    }
  }

  simulateModalScanPick(): void {
    const current = this.activeMission();
    if (current) {
      this.executeScan(current.ssccBarcode);
    }
  }

  simulateModalScanDrop(): void {
    const current = this.activeMission();
    if (current) {
      this.executeScan(current.destBarcode);
    }
  }

  simulateModalScanError(): void {
    this.executeScan('CODIGO-ERRONEO-999');
  }

  // ─── 6. Acciones sobre Misiones ──────────────────────────────────────────
  postponeCurrentMission(): void {
    const current = this.activeMission();
    if (current) {
      this.missionService.postponeMission(current.id);
      this.closeScanningModal();
      this.closeMissionDetail();
    }
  }

  // ─── 7. Gestión de Anomalías ─────────────────────────────────────────────
  openIncidentModal(): void {
    this.audioService.playWarning();
    this.incidentType.set('Pallet Inclinado / Colapsado');
    this.incidentNote.set('');
    this.incidentPhotoCaptured.set(false);
    this.showIncidentModal.set(true);
  }

  closeIncidentModal(): void {
    this.showIncidentModal.set(false);
  }

  toggleSimulatePhotoCapture(): void {
    this.audioService.playSuccess();
    this.incidentPhotoCaptured.update((v) => !v);
  }

  submitIncidentReport(): void {
    const current = this.activeMission();
    if (!current) return;

    this.missionService.reportAnomaly(
      current.id,
      this.incidentType(),
      this.incidentNote() || 'Sin notas adicionales',
      this.incidentPhotoCaptured() ? 'assets/mock-damaged-pallet.jpg' : undefined
    );

    this.showIncidentModal.set(false);
    this.closeScanningModal();
    this.closeMissionDetail();
  }

  // ─── 8. Modal de Celebración ─────────────────────────────────────────────
  closeCelebrationModal(): void {
    this.showCelebrationModal.set(false);
    this.justCompletedMission.set(null);
  }

  // ─── 9. Reinicio Demo y Menú ─────────────────────────────────────────────
  resetDemo(): void {
    this.stopCamera();
    this.missionService.resetDemoQueue();
    this.closeScanningModal();
    this.closeMissionDetail();
  }

  goToMenu(): void {
    this.stopCamera();
    this.router.navigate(['/menu']);
    this.audioService.playSuccess();
  }
}
