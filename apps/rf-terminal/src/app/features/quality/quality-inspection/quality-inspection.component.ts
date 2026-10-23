/**
 * @file quality-inspection.component.ts
 * @description Pantalla de Control de Calidad y Gestión de Cuarentenas (QM) para 4Guard RF Terminal.
 * Cumple con el estándar SDD Dual Theme (Slate Light & Midnight Obsidian), checklist técnico de 4 puntos,
 * captura de evidencia fotográfica, matriz de 4 disposiciones operativas y generación de Acta Oficial QM.
 */

import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState } from '@4guard/shared-core';
import {
  QualityInspectionService,
  QualityInspectionItem,
  QualityChecklist,
  QmDecision,
  QmFilter,
} from '../../../core/services/quality-inspection.service';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

@Component({
  selector: 'fg-rf-quality-inspection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality-inspection.component.html',
  styleUrl: './quality-inspection.component.css',
})
export class QualityInspectionComponent implements OnDestroy {
  protected readonly qmService = inject(QualityInspectionService);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly authState = inject(AuthState);
  private readonly router = inject(Router);

  @ViewChild('cameraVideo') cameraVideoRef?: ElementRef<HTMLVideoElement>;

  // ─── Signals del Servicio QM ─────────────────────────────────────────────
  protected readonly activeItem = this.qmService.activeItem;
  protected readonly queuedItems = this.qmService.queuedItems;
  protected readonly historyItems = this.qmService.historyItems;
  protected readonly counts = this.qmService.counts;
  protected readonly currentFilter = this.qmService.currentFilter;

  // ─── Estado Local de Inspección ──────────────────────────────────────────
  protected readonly inspectorNotes = signal<string>('');
  protected readonly capturedPhoto = signal<string | null>(null);

  // ─── Modales y Flujos ───────────────────────────────────────────────────
  protected readonly showCameraModal = signal(false);
  protected readonly isCameraActive = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly currentFacingMode = signal<'environment' | 'user'>('environment');
  private mediaStream: MediaStream | null = null;

  protected readonly showDispositionConfirmModal = signal(false);
  protected readonly pendingDecision = signal<QmDecision | null>(null);
  protected readonly isSubmitting = signal(false);

  protected readonly showCertificateModal = signal(false);
  protected readonly generatedActa = signal<QualityInspectionItem | null>(null);
  protected readonly copiedToast = signal(false);

  // ─── Datos Computados ───────────────────────────────────────────────────
  protected readonly inspectorName = computed(() => {
    return this.authState.userFullName() || 'Dra. Elena Ramos • Auditor Líder QM';
  });

  protected readonly isAllChecklistPassed = computed(() => {
    const item = this.activeItem();
    if (!item) return false;
    const cl = item.checklist;
    return cl.packagingIntegrity && cl.hermeticSeals && cl.lotAndExpiryMatch && cl.gs1BarcodeLegible;
  });

  ngOnDestroy(): void {
    this.stopCameraStream();
  }

  // ─── Acciones de Filtrado y Selección ────────────────────────────────────

  protected setFilter(filter: QmFilter): void {
    this.qmService.setFilter(filter);
  }

  protected selectItem(id: string): void {
    this.qmService.selectItemForInspection(id);
    this.inspectorNotes.set('');
    this.capturedPhoto.set(null);
  }

  protected toggleChecklist(key: keyof QualityChecklist): void {
    const item = this.activeItem();
    if (item) {
      this.qmService.toggleChecklist(item.id, key);
    }
  }

  // ─── Gestión de Disposición Final ────────────────────────────────────────

  protected requestDisposition(decision: QmDecision): void {
    const item = this.activeItem();
    if (!item) return;

    this.pendingDecision.set(decision);
    this.showDispositionConfirmModal.set(true);
    this.audioService.playWarning();
  }

  protected closeDispositionModal(): void {
    this.showDispositionConfirmModal.set(false);
    this.pendingDecision.set(null);
  }

  protected confirmDisposition(): void {
    const item = this.activeItem();
    const decision = this.pendingDecision();
    if (!item || !decision) return;

    this.isSubmitting.set(true);

    setTimeout(() => {
      const defaultNote = this.getDefaultDecisionNote(decision);
      const notes = this.inspectorNotes().trim() || defaultNote;
      const photo = this.capturedPhoto() || item.photoUrl;

      const completed = this.qmService.applyDisposition(
        item.id,
        decision,
        notes,
        this.inspectorName(),
        photo
      );

      this.isSubmitting.set(false);
      this.showDispositionConfirmModal.set(false);
      this.pendingDecision.set(null);
      this.inspectorNotes.set('');
      this.capturedPhoto.set(null);

      if (completed) {
        this.generatedActa.set(completed);
        this.showCertificateModal.set(true);
      }
    }, 400);
  }

  protected closeCertificateModal(): void {
    this.showCertificateModal.set(false);
    this.generatedActa.set(null);
    this.audioService.playSuccess();
  }

  protected copyActaFolio(): void {
    const acta = this.generatedActa();
    if (acta?.actaFolio && navigator.clipboard) {
      navigator.clipboard.writeText(acta.actaFolio);
      this.copiedToast.set(true);
      this.audioService.playSuccess();
      setTimeout(() => this.copiedToast.set(false), 2500);
    }
  }

  protected printActa(): void {
    this.audioService.playSuccess();
    window.print();
  }

  protected navigateToCockpit(): void {
    this.closeCertificateModal();
    this.router.navigate(['/cockpit']);
  }

  protected resetDemo(): void {
    this.qmService.resetDemoData();
    this.inspectorNotes.set('');
    this.capturedPhoto.set(null);
    this.showCertificateModal.set(false);
    this.showDispositionConfirmModal.set(false);
  }

  // ─── Captura de Fotos & Cámara en Vivo ───────────────────────────────────

  protected openCameraModal(): void {
    this.showCameraModal.set(true);
    this.cameraError.set(null);
    this.audioService.playSuccess();
    this.startCameraStream();
  }

  protected closeCameraModal(): void {
    this.stopCameraStream();
    this.showCameraModal.set(false);
  }

  protected takePhoto(): void {
    if (this.cameraVideoRef?.nativeElement && this.isCameraActive()) {
      const video = this.cameraVideoRef.nativeElement;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.capturedPhoto.set(dataUrl);
      }
    } else {
      // Foto simulada con sello de agua y metadata si no hay webcam real
      this.capturedPhoto.set(this.generateMockEvidencePhoto());
    }

    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate([40, 40]);
    this.closeCameraModal();
  }

  protected switchCamera(): void {
    const newMode = this.currentFacingMode() === 'environment' ? 'user' : 'environment';
    this.currentFacingMode.set(newMode);
    this.audioService.playSuccess();
    if (navigator.vibrate) navigator.vibrate(25);
    this.stopCameraStream();
    this.startCameraStream(newMode);
  }

  private startCameraStream(facingMode?: 'environment' | 'user'): void {
    const mode = facingMode || this.currentFacingMode();
    this.currentFacingMode.set(mode);

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        .then((stream) => {
          this.mediaStream = stream;
          this.isCameraActive.set(true);
          this.cameraError.set(null);
          setTimeout(() => {
            if (this.cameraVideoRef?.nativeElement) {
              this.cameraVideoRef.nativeElement.srcObject = stream;
              this.cameraVideoRef.nativeElement.play().catch(() => {});
            }
          }, 100);
        })
        .catch((err) => {
          console.warn('[QM Camera] Fallback a simulador visual:', err);
          this.cameraError.set('Lente físico no disponible. Modo simulador de evidencia activo.');
          this.isCameraActive.set(false);
        });
    } else {
      this.cameraError.set('Navegador en entorno seguro sin acceso a hardware de cámara.');
      this.isCameraActive.set(false);
    }
  }

  private stopCameraStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.isCameraActive.set(false);
  }

  private generateMockEvidencePhoto(): string {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);

      // Dibujar pallet esquemático
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(120, 100, 400, 260);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('EVIDENCIA FOTOGRÁFICA QM', 150, 60);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Folio: ${this.activeItem()?.ticketFolio || 'QM-2026'}`, 140, 140);
      ctx.fillText(`SSCC: ${this.activeItem()?.sscc || 'N/A'}`, 140, 170);
      ctx.fillText(`Lote: ${this.activeItem()?.lotNumber || 'N/A'}`, 140, 200);
      ctx.fillText(`Fecha: ${new Date().toLocaleString('es-MX')}`, 140, 230);
      ctx.fillText(`Inspector: ${this.inspectorName()}`, 140, 260);

      // Marca de agua
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fillRect(140, 300, 360, 40);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('INSPECCIÓN TÉCNICA CONTROLADA', 180, 326);
    }
    return canvas.toDataURL('image/png');
  }

  // ─── Helpers Visuales ────────────────────────────────────────────────────

  protected getDecisionBadgeClass(decision: QmDecision): string {
    switch (decision) {
      case 'RELEASED_TO_WAREHOUSE':
        return 'decision-badge--released';
      case 'CONDITIONAL_REPACK':
        return 'decision-badge--repack';
      case 'SCRAP_DESTRUCTION':
        return 'decision-badge--scrap';
      case 'RETURN_TO_VENDOR':
        return 'decision-badge--rtv';
      default:
        return 'decision-badge--pending';
    }
  }

  protected getDecisionTitle(decision: QmDecision | null): string {
    switch (decision) {
      case 'RELEASED_TO_WAREHOUSE':
        return 'Liberación Total para Almacén';
      case 'CONDITIONAL_REPACK':
        return 'Reempaque y Retrabajo Condicional';
      case 'SCRAP_DESTRUCTION':
        return 'Baja por Merma / Destrucción (Estado 80)';
      case 'RETURN_TO_VENDOR':
        return 'Rechazo y Devolución al Proveedor (RTV)';
      default:
        return 'Dictamen Técnico';
    }
  }

  protected getDecisionDescription(decision: QmDecision | null): string {
    switch (decision) {
      case 'RELEASED_TO_WAREHOUSE':
        return 'El pallet se marcará como liberado en WMS y se generará automáticamente una misión de Putaway en el Cockpit del montacarguista.';
      case 'CONDITIONAL_REPACK':
        return 'La tarima se enviará al área de Acondicionamiento para re-emplayado, reemplazo de tarima de madera y generación de nuevo SSCC.';
      case 'SCRAP_DESTRUCTION':
        return 'El inventario se dará de baja inmediata bajo Estado 80 (Merma Irrecuperable) y se canalizará a la zona de confinamiento de residuos.';
      case 'RETURN_TO_VENDOR':
        return 'Se notificará al proveedor y al área de compras para la emisión de nota de crédito y retiro de la mercancía no conforme.';
      default:
        return '';
    }
  }

  private getDefaultDecisionNote(decision: QmDecision): string {
    switch (decision) {
      case 'RELEASED_TO_WAREHOUSE':
        return 'Inspección técnica satisfactoria. Cumple al 100% con los criterios de inocuidad, empaque y trazabilidad GS1.';
      case 'CONDITIONAL_REPACK':
        return 'Requiere cambio de tarima de madera astillada y re-emplaye plástico con film de 80 calibres.';
      case 'SCRAP_DESTRUCTION':
        return 'Derrame y contaminación severa. Producto no apto para consumo ni venta. Baja autorizada Estado 80.';
      case 'RETURN_TO_VENDOR':
        return 'Mercancía con daño de origen y sellos de transporte violados. Se rechaza lote y se tramita RTV.';
      default:
        return 'Dictamen emitido por QM.';
    }
  }
}
