/**
 * @file security-gate.component.ts
 * @description Componente principal del Módulo Independiente de Seguridad (Caseta de Seguridad) — 4GUARD WMS.
 *
 * Aislamiento Total (Regla de Oro):
 * - Componente 100% Autónomo (Standalone).
 * - No modifica ni afecta al módulo de Recepción existente.
 * - Integra la réplica visual del formulario de caseta y la tarjeta interactiva de Simulación de QR.
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QrSimulatorCardComponent } from './qr-simulator-card/qr-simulator-card.component';
import { WarehouseMovementsService } from '../../warehouse-movements/services/warehouse-movements.service';

@Component({
  selector: 'fg-security-gate',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    QrSimulatorCardComponent
  ],
  templateUrl: './security-gate.component.html',
  styleUrl: './security-gate.component.css',
})
export class SecurityGateComponent {
  private readonly fb = inject(FormBuilder);
  private readonly movementsService = inject(WarehouseMovementsService);

  // ── Catálogos desde WarehouseMovementsService ──────────────────────────────
  protected readonly carrierLines     = this.movementsService.carrierLines;
  protected readonly clients          = this.movementsService.clients;
  protected readonly ramps            = this.movementsService.ramps;
  protected readonly forkliftOperators = this.movementsService.forkliftOperators;

  // ── Signals de Estado Local ────────────────────────────────────────────────
  protected readonly sealList           = signal<string[]>([]);
  protected readonly tempSealInput      = signal<string>('');
  protected readonly scanSuccessMessage = signal<string | null>(null);
  protected readonly isSaving           = signal<boolean>(false);
  protected readonly saveSuccess        = signal<boolean>(false);
  protected readonly showQrModal        = signal<boolean>(false);

  // ── MÉTODOS DEL MODAL DE QR DE PRUEBA ─────────────────────────────────────
  protected openQrModal(): void {
    this.showQrModal.set(true);
  }

  protected closeQrModal(): void {
    this.showQrModal.set(false);
  }

  protected handleScanFromModal(): void {
    this.simulateScan();
    this.closeQrModal();
  }


  // ── Formulario Reactivo réplica del FORMATO CHECK LIST DE TRANSPORTE ─────────
  protected readonly checkInForm: FormGroup = this.fb.group({
    // Header Metadatos
    controlNumber: ['F01-PO-CP-7.1.3-03'],
    revisionNumber: ['01'],
    revisionDate: ['19/08/2025'],
    processOwner: ['Seguridad Patrimonial'],

    // 1. DATOS GENERALES
    fecha: [this.getCurrentDateString(), Validators.required],
    noCartaPorte: [''], // Requerido dinámicamente si es CARGA
    remision: ['', Validators.required], // Requerido dinámicamente si es DESCARGA
    clientCode: ['', Validators.required],
    client: ['', Validators.required],
    procedimiento: ['Recepción', Validators.required],
    operacion: ['DESCARGA', Validators.required], // CARGA | DESCARGA
    horaEntrada: [this.getCurrentTimeString(), Validators.required],
    horaSalida: [''],

    // 2. DATOS DEL TRANSPORTE
    carrierLineCode: ['', Validators.required],
    carrierLine: ['', Validators.required],
    nombreOperador: ['', Validators.required],
    rampCode: ['', Validators.required],
    rampNumber: [0, Validators.required],
    placasTracto: ['', Validators.required],
    noEcoTractor: ['', Validators.required],
    placasCaja: ['', Validators.required],
    medidasCaja: ['53 Pies', Validators.required],
    noSello: [''],
    tipoTransporte: ['Caja Seca', Validators.required],

    // 3. REVISIÓN DEL TRANSPORTE — EPP
    eppZapatos: ['SI', Validators.required],
    eppZapatosObs: ['Cumple con calzado de casquillo'],
    eppCofia: ['SI', Validators.required],
    eppCofiaObs: ['En orden'],
    eppCubrebocas: ['SI', Validators.required],
    eppCubrebocasObs: ['En orden'],
    eppChaleco: ['SI', Validators.required],
    eppChalecoObs: ['Chaleco reflejante en buen estado'],

    // 3. REVISIÓN DEL TRANSPORTE — Documentos
    docCartaPorte: ['SI', Validators.required],
    docCartaPorteObs: ['Documento completo y legible'],
    docRemision: ['SI', Validators.required],
    docRemisionObs: ['Documento coincide con carga'],

    // 4. REVISIÓN DE LA UNIDAD
    revInteriorCaja: ['SI', Validators.required],
    revInteriorCajaObs: ['Limpio y seco'],
    revDanosCaja: ['NO', Validators.required],
    revDanosCajaObs: ['Sin abolladuras ni fisuras'],
    revDanosPuertas: ['NO', Validators.required],
    revDanosPuertasObs: ['Empaques y bisagras íntegros'],
    revOloresExtraños: ['NO', Validators.required],
    revOloresExtrañosObs: ['Sin olor anómalo'],
    revIndiciosPlagas: ['NO', Validators.required],
    revIndiciosPlagasObs: ['Sin evidencia de plaga'],

    // 5. FIRMAS Y RESPONSABLES
    responsableVigilanciaNombre: ['Guardia de Turno - Caseta Principal', Validators.required],
    responsableVigilanciaFirma: [true, Validators.requiredTrue],
    transportistaNombre: ['', Validators.required],
    transportistaFirma: [false, Validators.requiredTrue]
  });

  // ── REGLA DE NEGOCIO DINÁMICA: CARGA vs DESCARGA ───────────────────────────
  protected onOperationChange(val: 'CARGA' | 'DESCARGA'): void {
    this.checkInForm.patchValue({ operacion: val });

    const cartaControl = this.checkInForm.get('noCartaPorte');
    const remisionControl = this.checkInForm.get('remision');

    if (val === 'CARGA') {
      // En Carga se captura obligatoriamente la Carta Porte
      cartaControl?.setValidators([Validators.required]);
      remisionControl?.clearValidators();
      this.checkInForm.patchValue({ procedimiento: 'Embarque' });
    } else {
      // En Descarga se captura obligatoriamente No. Remisión o No. Factura
      remisionControl?.setValidators([Validators.required]);
      cartaControl?.clearValidators();
      this.checkInForm.patchValue({ procedimiento: 'Recepción' });
    }

    cartaControl?.updateValueAndValidity();
    remisionControl?.updateValueAndValidity();
  }


  // ── SIMULACIÓN DE ESCANEO DE TRANSPORTISTA ─────────────────────────────────
  protected simulateScan(): void {
    const today = this.getCurrentDateString();
    const nowTime = this.getCurrentTimeString();

    // Auto-completar todos los campos del formulario simulando lectura QR
    this.checkInForm.patchValue({
      fecha: today,
      noCartaPorte: 'CP-88492-MX',
      remision: 'REM-99482-4G',
      clientCode: 'MARCAS-NESTLE-001',
      client: 'MARCAS NESTLE S.A. DE C.V.',
      procedimiento: 'Recepción',
      operacion: 'DESCARGA',
      horaEntrada: nowTime,
      horaSalida: '',

      carrierLineCode: 'TR-01',
      carrierLine: 'TRANSPORTE GOLA',
      nombreOperador: 'Carlos Eduardo Mendoza Morales',
      rampCode: 'R-02',
      rampNumber: 2,
      placasTracto: '88-AB-4G',
      noEcoTractor: 'ECO-7742',
      placasCaja: '99-XX-4G',
      medidasCaja: '53 Pies',
      tipoTransporte: 'Caja Seca Refrigerada',

      eppZapatos: 'SI',
      eppZapatosObs: 'Calzado con casquillo industrial ok',
      eppCofia: 'SI',
      eppCofiaObs: 'Porta cofia reglamentaria',
      eppCubrebocas: 'SI',
      eppCubrebocasObs: 'Uso obligatorio ok',
      eppChaleco: 'SI',
      eppChalecoObs: 'Chaleco reflejante fosforescente ok',

      docCartaPorte: 'SI',
      docCartaPorteObs: 'Carta porte física validada y firmada',
      docRemision: 'SI',
      docRemisionObs: 'Remisión de proveedor cotejada con orden de compra',

      revInteriorCaja: 'SI',
      revInteriorCajaObs: 'Interior limpio, piso sanitizado',
      revDanosCaja: 'NO',
      revDanosCajaObs: 'Estructura en óptimas condiciones',
      revDanosPuertas: 'NO',
      revDanosPuertasObs: 'Sellado hermético y bisagras en perfecto estado',
      revOloresExtraños: 'NO',
      revOloresExtrañosObs: 'Ausencia total de olores extraños',
      revIndiciosPlagas: 'NO',
      revIndiciosPlagasObs: 'Libre de humedad e insectos / roedores',

      responsableVigilanciaNombre: 'Lic. Juan Pablo Torres - Jefe de Vigilancia',
      responsableVigilanciaFirma: true,
      transportistaNombre: 'Carlos Eduardo Mendoza Morales',
      transportistaFirma: true
    });

    // Cargar sellos de seguridad simulados
    this.sealList.set(['SEAL-4G-9001', 'SEAL-4G-9002']);

    // Mostrar feedback de éxito
    this.scanSuccessMessage.set('¡Escaneo de Transportista Exitoso! Todos los criterios del Check List de Transporte han sido autocompletados.');
    setTimeout(() => this.scanSuccessMessage.set(null), 6000);
  }

  // ── MANEJO DE SELECTS ──────────────────────────────────────────────────────
  protected onCarrierLineSelect(code: string): void {
    const found = this.carrierLines().find((c) => c.code === code);
    if (found) {
      this.checkInForm.patchValue({
        carrierLineCode: found.code,
        carrierLine: found.name,
      });
    }
  }

  protected onClientSelect(code: string): void {
    const found = this.clients().find((c) => c.code === code);
    if (found) {
      this.checkInForm.patchValue({
        clientCode: found.code,
        client: found.name,
      });
    }
  }

  protected onRampSelect(code: string): void {
    const found = this.ramps().find((r) => r.code === code);
    if (found) {
      this.checkInForm.patchValue({
        rampCode: found.code,
        rampNumber: found.rampNumber,
      });
    }
  }

  protected onForkliftOperatorSelect(code: string): void {
    const found = this.forkliftOperators().find((op) => op.code === code);
    if (found) {
      this.checkInForm.patchValue({
        forkliftOperatorCode: found.code,
        forkliftOperator: found.name,
      });
    }
  }

  // ── MANEJO DE SELLOS DE SEGURIDAD ──────────────────────────────────────────
  protected addSeal(): void {
    const val = this.tempSealInput().trim().toUpperCase();
    if (val && !this.sealList().includes(val)) {
      this.sealList.update((list) => [...list, val]);
      this.tempSealInput.set('');
    }
  }

  protected removeSeal(index: number): void {
    this.sealList.update((list) => list.filter((_, i) => i !== index));
  }

  // ── SETTERS RÁPIDOS PARA OPCIONES SI / NO EN CRITERIOS ─────────────────────
  protected setCriterion(controlName: string, val: 'SI' | 'NO'): void {
    this.checkInForm.patchValue({ [controlName]: val });
  }

  protected toggleSignature(controlName: string): void {
    const currentVal = this.checkInForm.get(controlName)?.value;
    this.checkInForm.patchValue({ [controlName]: !currentVal });
  }

  // ── SUBMIT FORMULARIO ──────────────────────────────────────────────────────
  protected submitCheckIn(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formVal = this.checkInForm.value;
    const sealString = this.sealList().join(', ');

    const payload = {
      ...formVal,
      noSello: sealString || formVal.noSello,
    };

    // Simulación de guardado exitoso
    setTimeout(() => {
      this.isSaving.set(false);
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 5000);
      this.resetForm();
    }, 800);
  }

  protected resetForm(): void {
    this.checkInForm.reset({
      controlNumber: 'F01-PO-CP-7.1.3-03',
      revisionNumber: '01',
      revisionDate: '19/08/2025',
      processOwner: 'Seguridad Patrimonial',
      fecha: this.getCurrentDateString(),
      procedimiento: 'Recepción',
      operacion: 'DESCARGA',
      horaEntrada: this.getCurrentTimeString(),
      medidasCaja: '53 Pies',
      tipoTransporte: 'Caja Seca',
      eppZapatos: 'SI',
      eppCofia: 'SI',
      eppCubrebocas: 'SI',
      eppChaleco: 'SI',
      docCartaPorte: 'SI',
      docRemision: 'SI',
      revInteriorCaja: 'SI',
      revDanosCaja: 'NO',
      revDanosPuertas: 'NO',
      revOloresExtraños: 'NO',
      revIndiciosPlagas: 'NO',
      responsableVigilanciaNombre: 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      transportistaFirma: false
    });
    this.sealList.set([]);
    this.tempSealInput.set('');
  }

  // ── HELPERS FECHA Y HORA ───────────────────────────────────────────────────
  private getCurrentTimeString(): string {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  }

  private getCurrentDateString(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}

