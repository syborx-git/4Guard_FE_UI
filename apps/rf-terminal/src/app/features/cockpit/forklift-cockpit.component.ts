/**
 * @file forklift-cockpit.component.ts
 * @description Cockpit Unificado del Montacarguista para Terminal RF PWA.
 * Flujo Inbound Dinámico:
 * - El Administrador define Remisión, Producto y Lotes Habilitados.
 * - El Montacarguista descarga el tráiler y escanea tarima por tarima,
 *   seleccionando o intercambiando el lote en caliente conforme las retira.
 * - Al terminar el tráiler, concluye la maniobra física (DISCHARGED) enviando el manifiesto a Mesa de Control.
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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState, ToastService } from '@4guard/shared-core';
import {
  ForkliftMissionService,
  ForkliftMission,
  InboundPalletItem,
  AuthorizedLotItem,
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
  protected readonly toast          = inject(ToastService);
  private readonly router           = inject(Router);

  @ViewChild('modalLaserInput') modalLaserInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('laserHudBody') laserHudBodyRef?: ElementRef<HTMLDivElement>;

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
  protected readonly currentFacingMode = signal<'environment' | 'user'>('environment');
  protected readonly availableCamerasCount = signal<number>(1);
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

  // ─── Modal 5: Intercambio / Alta de Nuevo Lote en Andén ──────────────────
  protected readonly showLotSwapModal = signal(false);
  protected readonly selectedPalletForEdit = signal<InboundPalletItem | null>(null);
  protected readonly newCustomLotInput = signal('');
  protected readonly newCustomPiecesInput = signal(48);
  protected readonly lotSwapReasonInput = signal('Embarque Mixto / Multi-Lote de Proveedor');

  // ─── Datos Computados ─────────────────────────────────────────────────────
  protected readonly activeMission = this.missionService.activeMission;
  protected readonly queuedMissions = this.missionService.queuedMissions;
  protected readonly counts = this.missionService.counts;
  protected readonly currentFilter = this.missionService.currentFilter;
  protected readonly scanFeedback = this.missionService.scanFeedback;

  protected readonly operatorName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Roberto Sánchez';
  });

  /** Lista dinámica de tarimas escaneadas en la descarga */
  protected readonly inboundPalletsList = computed<InboundPalletItem[]>(() => {
    const mission = this.activeMission();
    if (!mission || mission.type !== 'INBOUND_UNLOAD' || !mission.pallets) {
      return [];
    }
    return mission.pallets;
  });

  /** Total de tarimas físicas descargadas en andén */
  protected readonly inboundScannedCount = computed<number>(() => {
    return this.inboundPalletsList().length;
  });

  /** Total de piezas acumuladas en las tarimas descargadas */
  protected readonly inboundTotalPieces = computed<number>(() => {
    return this.inboundPalletsList().reduce((acc, p) => acc + p.pieces, 0);
  });

  /** Lotes autorizados por Mesa de Control */
  protected readonly availableLotsList = computed<AuthorizedLotItem[]>(() => {
    return this.activeMission()?.availableLots || [];
  });

  /** Lote activo seleccionado actualmente para la siguiente tarima a escanear */
  protected readonly activeScanningLot = computed<string>(() => {
    return this.activeMission()?.activeScanningLot || this.activeMission()?.lotNumber || 'LOT-2026-X99';
  });

  /** Número consecutivo de la siguiente tarima a descargar */
  protected readonly nextPalletNumber = computed<number>(() => {
    return this.inboundScannedCount() + 1;
  });

  /** Resumen de desglose de tarimas por lote para el reporte */
  protected readonly lotBreakdownSummary = computed<Array<{ lotNumber: string; palletCount: number; totalPieces: number }>>(() => {
    const mission = this.justCompletedMission() || this.activeMission();
    const list = (mission && mission.pallets && mission.pallets.length > 0)
      ? mission.pallets
      : this.inboundPalletsList();
    const map = new Map<string, { palletCount: number; totalPieces: number }>();
    for (const p of list) {
      const existing = map.get(p.lotNumber) || { palletCount: 0, totalPieces: 0 };
      existing.palletCount += 1;
      existing.totalPieces += p.pieces;
      map.set(p.lotNumber, existing);
    }
    return Array.from(map.entries()).map(([lotNumber, data]) => ({
      lotNumber,
      palletCount: data.palletCount,
      totalPieces: data.totalPieces,
    }));
  });

  ngOnInit(): void {
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

    await this.startCamera();

    setTimeout(() => {
      if (this.modalLaserInputRef?.nativeElement) {
        this.modalLaserInputRef.nativeElement.focus({ preventScroll: true });
      }
      if (this.laserHudBodyRef?.nativeElement) {
        this.laserHudBodyRef.nativeElement.scrollTop = 0;
      }
    }, 120);
  }

  closeScanningModal(): void {
    this.stopCamera();
    this.showScanningModal.set(false);
    this.scannedInput.set('');
  }

  // ─── Gestión de Cámara en Vivo (Tableta / Móvil) ──────────────────────────
  async startCamera(facingMode?: 'environment' | 'user'): Promise<void> {
    const mode = facingMode || this.currentFacingMode();
    this.currentFacingMode.set(mode);
    this.cameraError.set(null);
    this.cameraLoading.set(true);

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = devices.filter((d) => d.kind === 'videoinput');
          this.availableCamerasCount.set(videoDevs.length);
        } catch {}

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
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
          if (this.laserHudBodyRef?.nativeElement) {
            this.laserHudBodyRef.nativeElement.scrollTop = 0;
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

  async switchCamera(): Promise<void> {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(25);
    await this.startCamera(newMode);
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

      if (this.modalLaserInputRef?.nativeElement) {
        this.modalLaserInputRef.nativeElement.focus({ preventScroll: true });
      }

      if (feedback.success) {
        this.toast.success(feedback.message, 'ESCANEO VÁLIDO');
      } else {
        this.toast.error(feedback.message, 'ERROR DE ESCANEO');
      }

      if (feedback.phase === 'DISCHARGE_FINISHED' || (feedback.phase === 'DROP_COMPLETED' && activeBefore?.type !== 'INBOUND_UNLOAD')) {
        if (activeBefore) {
          this.stopCamera();
          this.justCompletedMission.set(activeBefore);
          this.showScanningModal.set(false);
          this.showCelebrationModal.set(true);
          this.toast.success(`Maniobra ${activeBefore.folio} completada y turnada a Mesa de Control.`, '¡MISIÓN CONCLUIDA!');
        }
      }
    }, 150);
  }

  // ─── 5. Control Dinámico de Lotes en Andén (Regla ADR-017 / ADR-020) ──────
  
  /** Cambia el lote activo de escaneo de entre los lotes autorizados por Admin */
  selectScanningLot(lotNumber: string): void {
    const current = this.activeMission();
    if (!current) return;
    this.missionService.setActiveScanningLot(current.id, lotNumber);
  }

  /** Abre el modal para agregar un lote nuevo / no previsto o editar lote de tarima */
  openCustomLotModal(pallet?: InboundPalletItem): void {
    const current = this.activeMission();
    if (!current) return;

    if (pallet) {
      this.selectedPalletForEdit.set(pallet);
      this.newCustomLotInput.set(pallet.lotNumber);
      this.newCustomPiecesInput.set(pallet.pieces);
    } else {
      this.selectedPalletForEdit.set(null);
      this.newCustomLotInput.set('');
      this.newCustomPiecesInput.set(current.defaultPiecesPerPallet || 48);
    }

    this.lotSwapReasonInput.set('Embarque Mixto / Multi-Lote de Proveedor');
    this.showLotSwapModal.set(true);
    this.audioService.playSuccess();
  }

  closeCustomLotModal(): void {
    this.showLotSwapModal.set(false);
    this.selectedPalletForEdit.set(null);
  }

  confirmCustomLot(): void {
    const current = this.activeMission();
    const lot = this.newCustomLotInput().trim().toUpperCase();
    const pzas = Number(this.newCustomPiecesInput()) || 48;
    const reason = this.lotSwapReasonInput();

    if (!current || !lot) return;

    const palletToEdit = this.selectedPalletForEdit();
    if (palletToEdit) {
      // Editar tarima ya escaneada
      this.missionService.swapPalletLot(current.id, palletToEdit.id, lot, pzas, reason);
    } else {
      // Agregar como nuevo lote activo para las siguientes tarimas
      this.missionService.addCustomLot(current.id, lot, reason);
      this.missionService.setCurrentPendingPieces(current.id, pzas);
    }

    this.closeCustomLotModal();
  }

  // ─── 6. Escaneo por Toque en Cámara / Botones Rápidos ─────────────────────
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
      const nextNum = this.nextPalletNumber();
      const code = `SSCC-1750123450000000${String(nextNum).padStart(2, '0')}`;
      this.executeScan(code);
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

  // ─── 7. Finalización Formal de Descarga Física (DISCHARGED) ───────────────
  finishDischargeManually(): void {
    const current = this.activeMission();
    if (!current) return;

    this.stopCamera();
    this.missionService.finishInboundDischarge(current.id);
    this.justCompletedMission.set(current);
    this.showScanningModal.set(false);
    this.showCelebrationModal.set(true);
    this.audioService.playSuccess();
  }

  // ─── 8. Acciones sobre Misiones ──────────────────────────────────────────
  postponeCurrentMission(): void {
    const current = this.activeMission();
    if (current) {
      this.missionService.postponeMission(current.id);
      this.closeScanningModal();
      this.closeMissionDetail();
    }
  }

  // ─── 9. Gestión de Anomalías ─────────────────────────────────────────────
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

  // ─── 10. Modal de Celebración ────────────────────────────────────────────
  closeCelebrationModal(): void {
    this.showCelebrationModal.set(false);
    this.justCompletedMission.set(null);
  }

  // ─── 11. Reinicio Demo y Menú ────────────────────────────────────────────
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
