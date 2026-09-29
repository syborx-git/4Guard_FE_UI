/**
 * @file security-gate.component.ts
 * @description Módulo de Seguridad & Caseta para Terminal RF PWA.
 * Diseñado para personal de vigilancia y supervisores de patio con pantallas táctiles.
 * Integra compresión de fotos para sellos, feedback sonoro/háptico y persistencia.
 */

import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';

export type SecurityTab = 'CHECKIN' | 'YARD' | 'CHECKOUT';

export interface YardVehicle {
  id: string;
  entryFolio: string;
  driverName: string;
  carrierName: string;
  tractorPlates: string;
  boxPlates: string;
  operationType: 'INBOUND' | 'OUTBOUND';
  rampNumber?: number;
  sealNumbers: string[];
  entryTime: Date;
  status: 'WAITING_RAMP' | 'AT_RAMP' | 'DISCHARGE_FINISHED' | 'AUTHORIZED_DEPARTURE';
  photoUrl?: string;
}

@Component({
  selector: 'fg-rf-security-gate',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './security-gate.component.html',
  styleUrl: './security-gate.component.css',
})
export class SecurityGateRfComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly authState = inject(AuthState);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly compressor = inject(ImageCompressorService);

  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  // ─── Pestaña Activa ──────────────────────────────────────────────────────────
  protected readonly activeTab = signal<SecurityTab>('CHECKIN');

  // ─── Búsqueda en Patio / Salida ─────────────────────────────────────────────
  protected readonly searchQuery = signal('');

  // ─── Formulario de Check-in (Entrada) ───────────────────────────────────────
  protected readonly checkInForm = this.fb.group({
    operationType: ['INBOUND', [Validators.required]],
    carrierName: ['', [Validators.required]],
    driverName: ['', [Validators.required]],
    tractorPlates: ['', [Validators.required]],
    boxPlates: ['', [Validators.required]],
    seal1: ['', [Validators.required]],
    seal2: [''],
    assignedRamp: [''],
    observations: [''],
  });

  // ─── Evidencia Fotográfica Comprimida ───────────────────────────────────────
  protected readonly sealPhotoPreview = signal<string | null>(null);
  protected readonly isCompressingPhoto = signal(false);

  // ─── Estado de Notificación / Toast Local ───────────────────────────────────
  protected readonly alertMessage = signal<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // ─── Vehículos en Patio (Mock Reactivo / Offline Cache) ──────────────────────
  protected readonly yardVehicles = signal<YardVehicle[]>([
    {
      id: 'veh-001',
      entryFolio: 'SEC-2026-000104',
      driverName: 'Juan Carlos Mendoza',
      carrierName: 'Transportes Castores',
      tractorPlates: '72-AB-9K',
      boxPlates: '45-TR-2M',
      operationType: 'INBOUND',
      rampNumber: 3,
      sealNumbers: ['SL-99412', 'SL-99413'],
      entryTime: new Date(Date.now() - 42 * 60000),
      status: 'AT_RAMP',
    },
    {
      id: 'veh-002',
      entryFolio: 'SEC-2026-000105',
      driverName: 'Ernesto Beltrán',
      carrierName: 'TUM Logística',
      tractorPlates: '11-XY-8P',
      boxPlates: '90-QQ-1L',
      operationType: 'INBOUND',
      sealNumbers: ['SL-88120'],
      entryTime: new Date(Date.now() - 18 * 60000),
      status: 'WAITING_RAMP',
    },
    {
      id: 'veh-003',
      entryFolio: 'SEC-2026-000099',
      driverName: 'Roberto Fuentes',
      carrierName: 'Auto Express Frontera',
      tractorPlates: '33-KZ-4R',
      boxPlates: '66-PL-9A',
      operationType: 'OUTBOUND',
      rampNumber: 7,
      sealNumbers: ['SL-77301'],
      entryTime: new Date(Date.now() - 110 * 60000),
      status: 'DISCHARGE_FINISHED',
    },
  ]);

  // ─── Computed: Vehículos Filtrados ──────────────────────────────────────────
  protected readonly filteredVehicles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.yardVehicles();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.entryFolio.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.carrierName.toLowerCase().includes(q) ||
        v.tractorPlates.toLowerCase().includes(q) ||
        v.boxPlates.toLowerCase().includes(q) ||
        v.sealNumbers.some((s) => s.toLowerCase().includes(q))
    );
  });

  protected readonly yardCount = computed(() => this.yardVehicles().length);
  protected readonly waitingCount = computed(() => this.yardVehicles().filter((v) => v.status === 'WAITING_RAMP').length);
  protected readonly atRampCount = computed(() => this.yardVehicles().filter((v) => v.status === 'AT_RAMP').length);
  protected readonly readyDepartureCount = computed(() => this.yardVehicles().filter((v) => v.status === 'DISCHARGE_FINISHED').length);

  // ─── Modal de Validación de Salida ──────────────────────────────────────────
  protected readonly selectedVehicleForCheckout = signal<YardVehicle | null>(null);
  protected readonly checkoutSealInput = signal('');
  protected readonly checkoutNotes = signal('');

  // ─── Métodos de Navegación de Pestañas ──────────────────────────────────────
  protected setTab(tab: SecurityTab): void {
    this.activeTab.set(tab);
    this.alertMessage.set(null);
    this.audioService.playSuccess();
  }

  // ─── Captura y Compresión de Foto de Sellos ─────────────────────────────────
  protected triggerCamera(): void {
    this.cameraInput?.nativeElement?.click();
  }

  protected async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isCompressingPhoto.set(true);

    try {
      // Comprime imagen a max 1024px @ 75% (~150KB)
      const compressedDataUrl = await this.compressor.compressPhoto(file, 1024, 0.75);
      this.sealPhotoPreview.set(compressedDataUrl);
      this.audioService.playSuccess();
      this.showAlert('success', '📷 Foto de sellos capturada y comprimida exitosamente.');
    } catch {
      this.audioService.playWarning();
      this.showAlert('error', 'Error al procesar la fotografía.');
    } finally {
      this.isCompressingPhoto.set(false);
      input.value = '';
    }
  }

  protected removePhoto(): void {
    this.sealPhotoPreview.set(null);
  }

  // ─── Registro de Entrada (Check-In) ─────────────────────────────────────────
  protected submitCheckIn(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      this.audioService.playWarning();
      this.showAlert('warning', 'Por favor completa todos los campos requeridos (Placas, Chofer, Transportista y Sello).');
      return;
    }

    const val = this.checkInForm.value;
    const newFolio = `SEC-2026-${String(Date.now()).slice(-6)}`;
    const seals = [val.seal1?.trim().toUpperCase() || ''];
    if (val.seal2?.trim()) {
      seals.push(val.seal2.trim().toUpperCase());
    }

    const newVehicle: YardVehicle = {
      id: `veh-${Date.now()}`,
      entryFolio: newFolio,
      driverName: val.driverName?.trim() || '',
      carrierName: val.carrierName?.trim() || '',
      tractorPlates: val.tractorPlates?.trim().toUpperCase() || '',
      boxPlates: val.boxPlates?.trim().toUpperCase() || '',
      operationType: (val.operationType as 'INBOUND' | 'OUTBOUND') || 'INBOUND',
      rampNumber: val.assignedRamp ? Number(val.assignedRamp) : undefined,
      sealNumbers: seals,
      entryTime: new Date(),
      status: val.assignedRamp ? 'AT_RAMP' : 'WAITING_RAMP',
      photoUrl: this.sealPhotoPreview() || undefined,
    };

    this.yardVehicles.update((list) => [newVehicle, ...list]);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }

    this.showAlert('success', `✅ Arribo registrado exitosamente con Folio ${newFolio}.`);
    this.checkInForm.reset({ operationType: 'INBOUND' });
    this.sealPhotoPreview.set(null);
  }

  // ─── Acciones de Patio (Asignar Rampa / Autorizar) ──────────────────────────
  protected assignRampQuick(vehicle: YardVehicle, ramp: number): void {
    this.yardVehicles.update((list) =>
      list.map((v) => (v.id === vehicle.id ? { ...v, rampNumber: ramp, status: 'AT_RAMP' } : v))
    );
    this.audioService.playSuccess();
    this.showAlert('success', `Rampa ${ramp} asignada a transporte ${vehicle.tractorPlates}.`);
  }

  // ─── Modal de Check-out (Salida) ────────────────────────────────────────────
  protected openCheckoutModal(vehicle: YardVehicle): void {
    this.selectedVehicleForCheckout.set(vehicle);
    this.checkoutSealInput.set('');
    this.checkoutNotes.set('');
    this.audioService.playSuccess();
  }

  protected closeCheckoutModal(): void {
    this.selectedVehicleForCheckout.set(null);
  }

  protected confirmCheckout(): void {
    const vehicle = this.selectedVehicleForCheckout();
    if (!vehicle) return;

    const inputSeal = this.checkoutSealInput().trim().toUpperCase();
    if (!inputSeal) {
      this.audioService.playWarning();
      this.showAlert('warning', 'Debe capturar o escanear el número de sello de salida para cotejo.');
      return;
    }

    // Remueve de vehículos en patio y archiva
    this.yardVehicles.update((list) => list.filter((v) => v.id !== vehicle.id));
    this.selectedVehicleForCheckout.set(null);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([50, 80, 50]);
    }

    this.showAlert(
      'success',
      `🚪 Salida autorizada para ${vehicle.tractorPlates} (Chofer: ${vehicle.driverName}). Pluma de salida habilitada.`
    );
  }

  // ─── Helpers de Formato y UI ────────────────────────────────────────────────
  protected formatMinutesAgo(entryTime: Date): string {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }

  protected getStatusLabel(status: YardVehicle['status']): string {
    switch (status) {
      case 'WAITING_RAMP':
        return 'En Espera de Rampa';
      case 'AT_RAMP':
        return 'En Andén / Rampa';
      case 'DISCHARGE_FINISHED':
        return 'Descarga Finalizada';
      case 'AUTHORIZED_DEPARTURE':
        return 'Salida Autorizada';
      default:
        return status;
    }
  }

  protected showAlert(type: 'success' | 'warning' | 'error', text: string): void {
    this.alertMessage.set({ type, text });
    setTimeout(() => {
      this.alertMessage.set(null);
    }, 5000);
  }

  protected goBackMenu(): void {
    this.router.navigate(['/menu']);
  }
}
