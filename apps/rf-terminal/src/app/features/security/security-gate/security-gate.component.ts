/**
 * @file security-gate.component.ts
 * @description Módulo de Caseta de Seguridad & Control de Patio para Terminal RF PWA.
 *
 * Arquitectura Homologada 100% con Admin Console y ADRs (ADR-012, ADR-013, ADR-015, ADR-017, ADR-018):
 * - Formato Oficial F01-PO-CP-7.1.3-03 idéntico a consola administrativa (Revisión 01, 19/08/2025).
 * - Checklist completo de 11 criterios con botones SÍ/NO y campos de Observaciones manuales vacíos por defecto.
 * - Generador y Descargador de Documento Oficial PDF / Impresión directa mediante PrintService.
 * - Captura Bimodal (DESCARGA / Recepción -> REC vs CARGA / Embarque -> SAL).
 * - Bandeja de Solicitudes Entrantes QR (1-Tap Load).
 * - Semáforo SLA en Patio (<45m verde, 45-90m ámbar, >90m rojo) y Check-out con cotejo de sellos.
 */

import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { PrintService } from '../../../core/services/print.service';
import {
  PrintTransportChecklistLayoutComponent,
  TransportChecklistPrintData
} from '../print-transport-checklist-layout/print-transport-checklist-layout.component';

export type SecurityTab = 'REGISTRATION' | 'IN_YARD' | 'CHECKOUT' | 'HISTORY';

export interface DriverSubmittedPass {
  id: string;
  token: string;
  carrierName: string;
  driverName: string;
  driverPhone?: string;
  tractorPlates: string;
  boxPlates: string;
  ecoNumber?: string;
  boxDimensions?: string;
  transportType?: string;
  operationType: 'INBOUND' | 'OUTBOUND';
  documentNumber: string;
  clientName?: string;
  sealNumbers: string[];
  status: 'SUBMITTED' | 'PENDING_DRIVER';
  submittedAt: Date;
  checklistData?: any;
}

export interface YardVehicle {
  id: string;
  entryFolio: string;
  token?: string;
  driverName: string;
  driverPhone?: string;
  carrierName: string;
  tractorPlates: string;
  boxPlates: string;
  ecoNumber?: string;
  boxDimensions?: string;
  transportType?: string;
  operationType: 'INBOUND' | 'OUTBOUND';
  documentNumber: string;
  clientName?: string;
  rampNumber?: number;
  sealNumbers: string[];
  entryTime: Date;
  departureTime?: Date;
  status: 'WAITING_RAMP' | 'AT_RAMP' | 'DISCHARGE_FINISHED' | 'AUTHORIZED_DEPARTURE' | 'COMPLETED_EXIT';
  photoUrl?: string;
  checklistData?: any;
  observations?: string;
}

@Component({
  selector: 'fg-rf-security-gate',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PrintTransportChecklistLayoutComponent
  ],
  templateUrl: './security-gate.component.html',
  styleUrl: './security-gate.component.css',
})
export class SecurityGateRfComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly authState = inject(AuthState);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly compressor = inject(ImageCompressorService);
  protected readonly printService = inject(PrintService);

  @ViewChild('cameraInput') cameraInput!: ElementRef<HTMLInputElement>;

  // ─── Pestaña Activa ──────────────────────────────────────────────────────────
  protected readonly activeTab = signal<SecurityTab>('REGISTRATION');

  // ─── Búsqueda & Filtro en Patio / Salida ─────────────────────────────────────
  protected readonly searchQuery = signal('');
  protected readonly yardFilter = signal<'ALL' | 'WAITING' | 'AT_RAMP' | 'READY'>('ALL');

  // ─── Token de Pase Vinculado Activo ──────────────────────────────────────────
  protected readonly activeLoadedToken = signal<string | null>(null);

  // ─── Catálogos Oficiales ───────────────────────────────────────────────────
  protected readonly carrierLinesList = signal<string[]>([
    'Transportes Castores S.A. de C.V.',
    'TUM Logística Internacional',
    'Auto Express Frontera',
    'Transportes Tresguerras',
    'Fletes México',
    'Beto Logistics',
    'Otro (Especificar)'
  ]);

  protected readonly clientsList = signal<string[]>([
    'Walmart Logistics',
    'Soriana Cedis',
    'Costco México',
    'Chedraui Logística',
    'Amazon México',
    'Mercado Libre',
    'OXXO Cedis',
    'Otro (Especificar)'
  ]);

  protected readonly transportTypesList = signal<string[]>([
    'Caja Seca',
    'Caja Refrigerada',
    'Plataforma',
    'Tortón',
    'Rabón',
    'Camioneta 3.5',
    'Tráiler',
    'Contenedor',
    'Tolva',
    'Pipa',
    'Otro (Especificar)'
  ]);

  protected readonly boxDimensionsList = signal<string[]>([
    '53 Pies',
    '48 Pies',
    '40 Pies',
    '20 Pies',
    'Tortón',
    'Rabón',
    '3.5 Toneladas',
    'N/A - Plataforma',
    'Otra Medida'
  ]);

  protected readonly rampOptions = [
    { num: 1, label: 'Rampa 01', available: true },
    { num: 2, label: 'Rampa 02', available: true },
    { num: 3, label: 'Rampa 03', available: false, occupiedBy: '72-AB-9K' },
    { num: 4, label: 'Rampa 04', available: true },
    { num: 5, label: 'Rampa 05', available: true },
    { num: 6, label: 'Rampa 06', available: true },
    { num: 7, label: 'Rampa 07', available: false, occupiedBy: '33-KZ-4R' },
    { num: 8, label: 'Rampa 08', available: true },
    { num: 9, label: 'Rampa 09', available: true },
    { num: 10, label: 'Rampa 10', available: true },
    { num: 11, label: 'Rampa 11', available: true },
    { num: 12, label: 'Rampa 12', available: true },
  ];

  // ─── Control de Sellos ─────────────────────────────────────────────────────
  protected readonly sealList = signal<string[]>([]);
  protected readonly tempSealInput = signal<string>('');

  // ─── Modal de Previsualización e Impresión F01 ──────────────────────────────
  protected readonly showF01PrintModal = signal<boolean>(false);
  protected readonly currentPrintData = signal<TransportChecklistPrintData | null>(null);
  protected readonly isGeneratingPdf = signal<boolean>(false);

  // ─── Formulario Oficial F01-PO-CP-7.1.3-03 (Homologado a Admin Console) ────
  protected readonly checkInForm: FormGroup = this.fb.group({
    // Metadatos
    controlNumber: ['F01-PO-CP-7.1.3-03'],
    revisionNumber: ['01'],
    revisionDate: ['19/08/2025'],
    processOwner: ['Seguridad Patrimonial'],

    // 1. Datos Generales
    fecha: [this.getCurrentDateString(), Validators.required],
    operacion: ['DESCARGA', Validators.required], // DESCARGA | CARGA
    noCartaPorte: [''],
    remision: ['', Validators.required],
    client: ['', Validators.required],
    clientNameCustom: [''],
    horaEntrada: [this.getCurrentTimeString(), Validators.required],
    horaSalida: [''],
    rampNumber: ['', Validators.required],

    // 2. Datos del Transporte
    carrierLine: ['', Validators.required],
    carrierLineCustom: [''],
    nombreOperador: ['', Validators.required],
    driverPhone: [''],
    tipoTransporte: ['Caja Seca', Validators.required],
    tipoTransporteCustom: [''],
    placasTracto: ['', Validators.required],
    noEcoTractor: ['', Validators.required],
    placasCaja: ['', Validators.required],
    medidasCaja: ['53 Pies', Validators.required],
    medidasCajaCustom: [''],

    // 3. Revisión del Transporte — EPP (Observaciones vacías por defecto)
    eppZapatos: ['SI', Validators.required],
    eppZapatosObs: [''],
    eppCofia: ['SI', Validators.required],
    eppCofiaObs: [''],
    eppCubrebocas: ['SI', Validators.required],
    eppCubrebocasObs: [''],
    eppChaleco: ['SI', Validators.required],
    eppChalecoObs: [''],

    // 3. Revisión del Transporte — Documentos
    docCartaPorte: ['NO', Validators.required],
    docCartaPorteObs: ['N/A - Operación de Descarga/Recepción'],
    docRemision: ['SI', Validators.required],
    docRemisionObs: [''],

    // 4. Revisión de la Unidad (Caja)
    revInteriorCaja: ['SI', Validators.required],
    revInteriorCajaObs: [''],
    revDanosCaja: ['NO', Validators.required],
    revDanosCajaObs: [''],
    revDanosPuertas: ['NO', Validators.required],
    revDanosPuertasObs: [''],
    revOloresExtranos: ['NO', Validators.required],
    revOloresExtranosObs: [''],
    revIndiciosPlagas: ['NO', Validators.required],
    revIndiciosPlagasObs: [''],

    // 5. Responsables y Firmas
    responsableVigilanciaNombre: ['Guardia de Turno - Caseta Principal', Validators.required],
    responsableVigilanciaFirma: [true, Validators.requiredTrue],
    transportistaNombre: ['', Validators.required],
    transportistaFirma: [false, Validators.requiredTrue]
  });

  // ─── Bandeja en Vivo de Solicitudes de Choferes (ADR-017) ────────────────────
  protected readonly activePasses = signal<DriverSubmittedPass[]>([
    {
      id: 'pass-001',
      token: 'PASS-20260929-0104',
      carrierName: 'Transportes Castores S.A. de C.V.',
      driverName: 'Juan Carlos Mendoza',
      driverPhone: '55-4812-9011',
      tractorPlates: '72-AB-9K',
      boxPlates: '45-TR-2M',
      ecoNumber: 'TC-402',
      boxDimensions: '53 Pies',
      transportType: 'Caja Seca',
      operationType: 'INBOUND',
      documentNumber: 'REM-884120',
      clientName: 'Walmart Logistics',
      sealNumbers: ['SL-99412', 'SL-99413'],
      status: 'SUBMITTED',
      submittedAt: new Date(Date.now() - 3 * 60000),
      checklistData: {
        epp: { zapatos: 'SI', chaleco: 'SI', cofia: 'SI', cubrebocas: 'SI' },
        caja: { interior: 'SI', danos: 'NO', puertas: 'NO', olores: 'NO', plagas: 'NO' }
      }
    },
    {
      id: 'pass-002',
      token: 'PASS-20260929-0105',
      carrierName: 'TUM Logística Internacional',
      driverName: 'Ernesto Beltrán',
      driverPhone: '81-1902-3344',
      tractorPlates: '11-XY-8P',
      boxPlates: '90-QQ-1L',
      ecoNumber: 'TUM-88',
      boxDimensions: '48 Pies',
      transportType: 'Caja Refrigerada',
      operationType: 'INBOUND',
      documentNumber: 'REM-991204',
      clientName: 'Soriana Cedis',
      sealNumbers: ['SL-88120'],
      status: 'SUBMITTED',
      submittedAt: new Date(Date.now() - 8 * 60000),
      checklistData: {
        epp: { zapatos: 'SI', chaleco: 'SI', cofia: 'NO', cubrebocas: 'SI' },
        caja: { interior: 'SI', danos: 'NO', puertas: 'NO', olores: 'NO', plagas: 'NO' }
      }
    },
    {
      id: 'pass-003',
      token: 'PASS-20260929-0108',
      carrierName: 'Auto Express Frontera',
      driverName: 'Roberto Fuentes',
      driverPhone: '66-4190-2211',
      tractorPlates: '33-KZ-4R',
      boxPlates: '66-PL-9A',
      ecoNumber: 'AEF-19',
      boxDimensions: '53 Pies',
      transportType: 'Caja Seca',
      operationType: 'OUTBOUND',
      documentNumber: 'CP-2026-00412',
      clientName: 'Costco México',
      sealNumbers: ['SL-77301'],
      status: 'SUBMITTED',
      submittedAt: new Date(Date.now() - 14 * 60000),
      checklistData: {
        epp: { zapatos: 'SI', chaleco: 'SI', cofia: 'SI', cubrebocas: 'SI' },
        caja: { interior: 'SI', danos: 'NO', puertas: 'NO', olores: 'NO', plagas: 'NO' }
      }
    }
  ]);

  // ─── Evidencia Fotográfica Comprimida (Canvas API) ───────────────────────────
  protected readonly sealPhotoPreview = signal<string | null>(null);
  protected readonly isCompressingPhoto = signal(false);

  // ─── Estado de Notificación / Toast Local ───────────────────────────────────
  protected readonly alertMessage = signal<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // ─── Vehículos en Patio (Persistencia / Mock Reactivo) ──────────────────────
  protected readonly yardVehicles = signal<YardVehicle[]>([
    {
      id: 'veh-001',
      entryFolio: 'REC-2026-000104',
      token: 'PASS-20260929-0099',
      driverName: 'Juan Carlos Mendoza',
      driverPhone: '55-4812-9011',
      carrierName: 'Transportes Castores S.A. de C.V.',
      tractorPlates: '72-AB-9K',
      boxPlates: '45-TR-2M',
      ecoNumber: 'TC-402',
      boxDimensions: '53 Pies',
      transportType: 'Caja Seca',
      operationType: 'INBOUND',
      documentNumber: 'REM-884120',
      clientName: 'Walmart Logistics',
      rampNumber: 3,
      sealNumbers: ['SL-99412', 'SL-99413'],
      entryTime: new Date(Date.now() - 42 * 60000),
      status: 'AT_RAMP',
      checklistData: {
        eppZapatos: 'SI', eppChaleco: 'SI', eppCofia: 'SI', eppCubrebocas: 'SI',
        revInteriorCaja: 'SI', revDanosCaja: 'NO', revDanosPuertas: 'NO', revOloresExtranos: 'NO', revIndiciosPlagas: 'NO'
      }
    },
    {
      id: 'veh-002',
      entryFolio: 'REC-2026-000105',
      token: 'PASS-20260929-0098',
      driverName: 'Ernesto Beltrán',
      driverPhone: '81-1902-3344',
      carrierName: 'TUM Logística Internacional',
      tractorPlates: '11-XY-8P',
      boxPlates: '90-QQ-1L',
      ecoNumber: 'TUM-88',
      boxDimensions: '48 Pies',
      transportType: 'Caja Refrigerada',
      operationType: 'INBOUND',
      documentNumber: 'REM-991204',
      clientName: 'Soriana Cedis',
      sealNumbers: ['SL-88120'],
      entryTime: new Date(Date.now() - 18 * 60000),
      status: 'WAITING_RAMP',
      checklistData: {
        eppZapatos: 'SI', eppChaleco: 'SI', eppCofia: 'NO', eppCubrebocas: 'SI',
        revInteriorCaja: 'SI', revDanosCaja: 'NO', revDanosPuertas: 'NO', revOloresExtranos: 'NO', revIndiciosPlagas: 'NO'
      }
    },
    {
      id: 'veh-003',
      entryFolio: 'SAL-2026-000099',
      token: 'PASS-20260929-0092',
      driverName: 'Roberto Fuentes',
      driverPhone: '66-4190-2211',
      carrierName: 'Auto Express Frontera',
      tractorPlates: '33-KZ-4R',
      boxPlates: '66-PL-9A',
      ecoNumber: 'AEF-19',
      boxDimensions: '53 Pies',
      transportType: 'Caja Seca',
      operationType: 'OUTBOUND',
      documentNumber: 'CP-2026-00412',
      clientName: 'Costco México',
      rampNumber: 7,
      sealNumbers: ['SL-77301'],
      entryTime: new Date(Date.now() - 110 * 60000),
      status: 'DISCHARGE_FINISHED',
      checklistData: {
        eppZapatos: 'SI', eppChaleco: 'SI', eppCofia: 'SI', eppCubrebocas: 'SI',
        revInteriorCaja: 'SI', revDanosCaja: 'NO', revDanosPuertas: 'NO', revOloresExtranos: 'NO', revIndiciosPlagas: 'NO'
      }
    },
  ]);

  // ─── Modal de Validación de Salida (Check-out) ───────────────────────────────
  protected readonly selectedVehicleForCheckout = signal<YardVehicle | null>(null);
  protected readonly checkoutSealInput = signal('');
  protected readonly checkoutNotes = signal('');

  // ─── Modal de Asignación Rápida de Rampa ────────────────────────────────────
  protected readonly selectedVehicleForRamp = signal<YardVehicle | null>(null);

  // ─── Computed Metrics & Lists ───────────────────────────────────────────────
  protected readonly yardCount = computed(() => this.yardVehicles().length);
  protected readonly waitingCount = computed(() => this.yardVehicles().filter((v) => v.status === 'WAITING_RAMP').length);
  protected readonly atRampCount = computed(() => this.yardVehicles().filter((v) => v.status === 'AT_RAMP').length);
  protected readonly readyDepartureCount = computed(() => this.yardVehicles().filter((v) => v.status === 'DISCHARGE_FINISHED').length);
  protected readonly pendingPassesCount = computed(() => this.activePasses().length);

  protected readonly filteredVehicles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.yardFilter();
    let list = this.yardVehicles();

    if (filter === 'WAITING') {
      list = list.filter(v => v.status === 'WAITING_RAMP');
    } else if (filter === 'AT_RAMP') {
      list = list.filter(v => v.status === 'AT_RAMP');
    } else if (filter === 'READY') {
      list = list.filter(v => v.status === 'DISCHARGE_FINISHED');
    }

    if (!q) return list;

    return list.filter(
      (v) =>
        v.entryFolio.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.carrierName.toLowerCase().includes(q) ||
        v.tractorPlates.toLowerCase().includes(q) ||
        v.boxPlates.toLowerCase().includes(q) ||
        (v.documentNumber && v.documentNumber.toLowerCase().includes(q)) ||
        v.sealNumbers.some((s) => s.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    // Sincronizar validaciones bimodal
    this.checkInForm.get('operacion')?.valueChanges.subscribe((op) => {
      this.updateBimodalValidators(op);
    });
  }

  ngOnDestroy(): void {}

  // ─── Cambiar Criterio de Checklist F01 (SI / NO) ───────────────────────────
  protected setCriterion(field: string, value: 'SI' | 'NO'): void {
    this.checkInForm.get(field)?.setValue(value);
    this.audioService.playSuccess();
  }

  // ─── Cambio Bimodal (DESCARGA vs CARGA) ────────────────────────────────────
  protected onOperationChange(op: 'DESCARGA' | 'CARGA'): void {
    this.checkInForm.patchValue({ operacion: op });
    this.updateBimodalValidators(op);
    this.audioService.playSuccess();
  }

  private updateBimodalValidators(op: string): void {
    const remisionControl = this.checkInForm.get('remision');
    const cartaPorteControl = this.checkInForm.get('noCartaPorte');
    const docCartaPorteControl = this.checkInForm.get('docCartaPorte');
    const docCartaPorteObsControl = this.checkInForm.get('docCartaPorteObs');
    const docRemisionControl = this.checkInForm.get('docRemision');
    const docRemisionObsControl = this.checkInForm.get('docRemisionObs');

    if (op === 'CARGA') {
      cartaPorteControl?.setValidators([Validators.required]);
      remisionControl?.clearValidators();
      docCartaPorteControl?.setValue('SI');
      docCartaPorteObsControl?.setValue('');
      docRemisionControl?.setValue('NO');
      docRemisionObsControl?.setValue('N/A - Operación de Carga/Embarque');
    } else {
      remisionControl?.setValidators([Validators.required]);
      cartaPorteControl?.clearValidators();
      docRemisionControl?.setValue('SI');
      docRemisionObsControl?.setValue('');
      docCartaPorteControl?.setValue('NO');
      docCartaPorteObsControl?.setValue('N/A - Operación de Descarga/Recepción');
    }

    remisionControl?.updateValueAndValidity();
    cartaPorteControl?.updateValueAndValidity();
  }

  // ─── Gestión de Sellos Fiscales (Tags) ─────────────────────────────────────
  protected addSeal(): void {
    const seal = this.tempSealInput().trim().toUpperCase();
    if (seal && !this.sealList().includes(seal)) {
      this.sealList.update(list => [...list, seal]);
      this.tempSealInput.set('');
      this.audioService.playSuccess();
    }
  }

  protected removeSeal(index: number): void {
    this.sealList.update(list => list.filter((_, i) => i !== index));
    this.audioService.playWarning();
  }

  // ─── Navegación por Pestañas ───────────────────────────────────────────────
  protected setTab(tab: SecurityTab): void {
    this.activeTab.set(tab);
    this.alertMessage.set(null);
    this.audioService.playSuccess();
  }

  // ─── Carga Rápida 1-Tap desde Solicitud de Chofer (ADR-017) ─────────────────
  protected loadPassIntoForm(pass: DriverSubmittedPass): void {
    this.activeLoadedToken.set(pass.token);

    const isCarga = pass.operationType === 'OUTBOUND';
    const opValue = isCarga ? 'CARGA' : 'DESCARGA';

    this.checkInForm.patchValue({
      operacion: opValue,
      carrierLine: pass.carrierName,
      nombreOperador: pass.driverName,
      driverPhone: pass.driverPhone || '',
      placasTracto: pass.tractorPlates,
      placasCaja: pass.boxPlates,
      noEcoTractor: pass.ecoNumber || 'ECO-01',
      tipoTransporte: pass.transportType || 'Caja Seca',
      medidasCaja: pass.boxDimensions || '53 Pies',
      client: pass.clientName || 'Walmart Logistics',
      transportistaNombre: pass.driverName,
      transportistaFirma: true,
    });

    if (isCarga) {
      this.checkInForm.patchValue({ noCartaPorte: pass.documentNumber, remision: '' });
    } else {
      this.checkInForm.patchValue({ remision: pass.documentNumber, noCartaPorte: '' });
    }

    if (pass.sealNumbers && pass.sealNumbers.length > 0) {
      this.sealList.set([...pass.sealNumbers]);
    }

    // Si viene checklist previo del chofer
    if (pass.checklistData?.epp) {
      this.checkInForm.patchValue({
        eppZapatos: pass.checklistData.epp.zapatos || 'SI',
        eppChaleco: pass.checklistData.epp.chaleco || 'SI',
        eppCofia: pass.checklistData.epp.cofia || 'SI',
        eppCubrebocas: pass.checklistData.epp.cubrebocas || 'SI',
      });
    }

    this.onOperationChange(opValue);
    this.audioService.playSuccess();
    this.showAlert(
      'success',
      `⚡ Pase #${pass.token} (${pass.carrierName}) cargado al Formulario Oficial F01. Revisa y autoriza la entrada.`
    );
  }

  protected clearLoadedPass(): void {
    this.activeLoadedToken.set(null);
    this.checkInForm.reset({
      controlNumber: 'F01-PO-CP-7.1.3-03',
      revisionNumber: '01',
      revisionDate: '19/08/2025',
      processOwner: 'Seguridad Patrimonial',
      fecha: this.getCurrentDateString(),
      operacion: 'DESCARGA',
      horaEntrada: this.getCurrentTimeString(),
      eppZapatos: 'SI',
      eppCofia: 'SI',
      eppCubrebocas: 'SI',
      eppChaleco: 'SI',
      docCartaPorte: 'NO',
      docCartaPorteObs: 'N/A - Operación de Descarga/Recepción',
      docRemision: 'SI',
      revInteriorCaja: 'SI',
      revDanosCaja: 'NO',
      revDanosPuertas: 'NO',
      revOloresExtranos: 'NO',
      revIndiciosPlagas: 'NO',
      responsableVigilanciaNombre: 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      tipoTransporte: 'Caja Seca',
      medidasCaja: '53 Pies'
    });
    this.sealList.set([]);
    this.sealPhotoPreview.set(null);
    this.showAlert('warning', 'Formulario limpiado para captura manual.');
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
      this.showAlert('warning', 'Por favor completa los campos requeridos marcados con (*).');
      return;
    }

    const val = this.checkInForm.value;
    const isOutbound = val.operacion === 'CARGA';
    const prefix = isOutbound ? 'SAL' : 'REC';
    const generatedFolio = `${prefix}-2026-${String(Date.now()).slice(-6)}`;

    const seals = this.sealList().length > 0 ? this.sealList() : ['SL-00000'];
    const rampNum = val.rampNumber ? Number(val.rampNumber) : 1;

    const newVehicle: YardVehicle = {
      id: `veh-${Date.now()}`,
      entryFolio: generatedFolio,
      token: this.activeLoadedToken() || undefined,
      driverName: val.nombreOperador?.trim() || '',
      driverPhone: val.driverPhone?.trim() || undefined,
      carrierName: val.carrierLine?.trim() || '',
      tractorPlates: val.placasTracto?.trim().toUpperCase() || '',
      boxPlates: val.placasCaja?.trim().toUpperCase() || '',
      ecoNumber: val.noEcoTractor?.trim() || undefined,
      boxDimensions: val.medidasCaja || '53 Pies',
      transportType: val.tipoTransporte || 'Caja Seca',
      operationType: isOutbound ? 'OUTBOUND' : 'INBOUND',
      documentNumber: isOutbound ? val.noCartaPorte : val.remision,
      clientName: val.client === 'OTRO' ? val.clientNameCustom : val.client,
      rampNumber: rampNum,
      sealNumbers: seals,
      entryTime: new Date(),
      status: 'AT_RAMP',
      photoUrl: this.sealPhotoPreview() || undefined,
      checklistData: { ...val }
    };

    // Remover de solicitudes activas si venía de un pase
    const loadedTok = this.activeLoadedToken();
    if (loadedTok) {
      this.activePasses.update(list => list.filter(p => p.token !== loadedTok));
    }

    // Agregar al patio
    this.yardVehicles.update((list) => [newVehicle, ...list]);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }

    // Preparar datos para imprimir/descargar F01
    this.preparePrintDataFromVehicle(newVehicle);

    this.showAlert(
      'success',
      `✅ Arribo autorizado con Folio ${generatedFolio}. Rampa 0${rampNum} asignada. Pluma abierta.`
    );

    // Reset de formulario
    this.activeLoadedToken.set(null);
    this.clearLoadedPass();
  }

  // ─── Generación & Descarga PDF del Formato Oficial F01 ──────────────────────
  protected preparePrintDataFromVehicle(vehicle: YardVehicle): void {
    const chk = vehicle.checklistData || {};
    const printData: TransportChecklistPrintData = {
      controlNumber: 'F01-PO-CP-7.1.3-03',
      revisionNumber: '01',
      revisionDate: '19/08/2025',
      emissionDate: '19/08/2025',
      processOwner: 'Seguridad Patrimonial',
      elaboratedBy: 'SP',
      reviewedBy: 'CG',
      approvedBy: 'DG',

      fecha: this.formatDate(vehicle.entryTime),
      noCartaPorte: vehicle.operationType === 'OUTBOUND' ? vehicle.documentNumber : chk.noCartaPorte,
      remision: vehicle.operationType === 'INBOUND' ? vehicle.documentNumber : chk.remision,
      cliente: vehicle.clientName || 'General',
      procedimiento: vehicle.operationType === 'INBOUND' ? 'Recepción' : 'Embarque',
      operacion: vehicle.operationType === 'INBOUND' ? 'DESCARGA' : 'CARGA',
      horaEntrada: this.formatTimeStringFromDate(vehicle.entryTime),
      horaSalida: vehicle.departureTime ? this.formatTimeStringFromDate(vehicle.departureTime) : '--:--',

      lineaTransporte: vehicle.carrierName,
      nombreOperador: vehicle.driverName,
      telefonoChofer: vehicle.driverPhone,
      driverPhone: vehicle.driverPhone,
      noRampa: vehicle.rampNumber ? `R-0${vehicle.rampNumber}` : 'R-01',
      placasTracto: vehicle.tractorPlates,
      noEcoTractor: vehicle.ecoNumber || 'ECO-01',
      placasCaja: vehicle.boxPlates,
      medidasCaja: vehicle.boxDimensions || '53 Pies',
      noSello: vehicle.sealNumbers.join(', '),
      tipoTransporte: vehicle.transportType || 'Caja Seca',

      eppZapatos: chk.eppZapatos || 'SI',
      eppZapatosObs: chk.eppZapatosObs || '',
      eppCofia: chk.eppCofia || 'SI',
      eppCofiaObs: chk.eppCofiaObs || '',
      eppCubrebocas: chk.eppCubrebocas || 'SI',
      eppCubrebocasObs: chk.eppCubrebocasObs || '',
      eppChaleco: chk.eppChaleco || 'SI',
      eppChalecoObs: chk.eppChalecoObs || '',

      docCartaPorte: chk.docCartaPorte || (vehicle.operationType === 'OUTBOUND' ? 'SI' : 'NO'),
      docCartaPorteObs: chk.docCartaPorteObs || '',
      docRemision: chk.docRemision || (vehicle.operationType === 'INBOUND' ? 'SI' : 'NO'),
      docRemisionObs: chk.docRemisionObs || '',

      revInteriorCaja: chk.revInteriorCaja || 'SI',
      revInteriorCajaObs: chk.revInteriorCajaObs || '',
      revDanosCaja: chk.revDanosCaja || 'NO',
      revDanosCajaObs: chk.revDanosCajaObs || '',
      revDanosPuertas: chk.revDanosPuertas || 'NO',
      revDanosPuertasObs: chk.revDanosPuertasObs || '',
      revOloresExtranos: chk.revOloresExtranos || 'NO',
      revOloresExtranosObs: chk.revOloresExtranosObs || '',
      revIndiciosPlagas: chk.revIndiciosPlagas || 'NO',
      revIndiciosPlagasObs: chk.revIndiciosPlagasObs || '',

      responsableVigilanciaNombre: chk.responsableVigilanciaNombre || 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      transportistaNombre: vehicle.driverName,
      folio: vehicle.entryFolio,
      token: vehicle.token || vehicle.entryFolio
    };

    this.currentPrintData.set(printData);
  }

  protected openPrintModalForVehicle(vehicle: YardVehicle): void {
    this.preparePrintDataFromVehicle(vehicle);
    this.showF01PrintModal.set(true);
    this.audioService.playSuccess();
  }

  protected closePrintModal(): void {
    this.showF01PrintModal.set(false);
  }

  protected async downloadPdfDirect(): Promise<void> {
    const data = this.currentPrintData();
    if (!data) return;

    this.isGeneratingPdf.set(true);
    const filename = `F01_${data.folio || 'Checklist'}_${data.placasTracto || 'Unidad'}`;
    
    try {
      await this.printService.downloadPdf('#f01-rf-print-target', filename);
      this.audioService.playSuccess();
      this.showAlert('success', `📄 Documento oficial ${filename}.pdf generado y descargado.`);
    } catch {
      this.audioService.playWarning();
      this.showAlert('error', 'Error al generar el archivo PDF.');
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  protected printDirect(): void {
    const data = this.currentPrintData();
    if (!data) return;

    this.printService.printElementDirect('#f01-rf-print-target', `Formato F01 - ${data.folio}`);
    this.audioService.playSuccess();
  }

  // ─── Modal & Asignación Rápida de Rampa ────────────────────────────────────
  protected openRampModal(vehicle: YardVehicle): void {
    this.selectedVehicleForRamp.set(vehicle);
    this.audioService.playSuccess();
  }

  protected closeRampModal(): void {
    this.selectedVehicleForRamp.set(null);
  }

  protected selectRampQuick(rampNumber: number): void {
    const vehicle = this.selectedVehicleForRamp();
    if (!vehicle) return;

    this.yardVehicles.update((list) =>
      list.map((v) => (v.id === vehicle.id ? { ...v, rampNumber, status: 'AT_RAMP' } : v))
    );

    this.closeRampModal();
    this.audioService.playSuccess();
    this.showAlert('success', `Rampa 0${rampNumber} asignada al tracto ${vehicle.tractorPlates}.`);
  }

  // ─── Modal de Check-out (Salida & Cotejo de Sellos) ──────────────────────────
  protected openCheckoutModal(vehicle: YardVehicle): void {
    this.selectedVehicleForCheckout.set(vehicle);
    this.checkoutSealInput.set(vehicle.sealNumbers[0] || '');
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

    // 1. Estampar la fecha y hora oficial de salida física
    const exitTime = new Date();
    vehicle.departureTime = exitTime;
    vehicle.status = 'COMPLETED_EXIT';

    // 2. Si se capturó un sello de salida diferente, agregar a la lista de sellos cotejados
    if (!vehicle.sealNumbers.includes(inputSeal)) {
      vehicle.sealNumbers = [inputSeal, ...vehicle.sealNumbers];
    }

    // 3. Remover de vehículos activos en patio y cerrar modal de checkout
    this.yardVehicles.update((list) => list.filter((v) => v.id !== vehicle.id));
    this.selectedVehicleForCheckout.set(null);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([50, 80, 50]);
    }

    // 4. Preparar datos oficiales del F01 con la hora de salida exacta registrada
    this.preparePrintDataFromVehicle(vehicle);

    // 5. Desplegar automáticamente el Formato Oficial F01 con la hora de salida para descarga/impresión inmediata
    this.showF01PrintModal.set(true);

    const formattedExit = this.formatTimeStringFromDate(exitTime);
    this.showAlert(
      'success',
      `🚪 Salida autorizada para ${vehicle.tractorPlates} a las ${formattedExit}. Formato F01 generado con hora de salida oficial.`
    );
  }

  // ─── Helpers Ergonómicos y de Fechas ───────────────────────────────────────
  protected formatStayDuration(entryTime: Date): { text: string; slaClass: string } {
    const diffMs = Date.now() - new Date(entryTime).getTime();
    const mins = Math.floor(diffMs / 60000);

    let slaClass = 'sla-normal'; // <45m Verde
    if (mins >= 45 && mins < 90) {
      slaClass = 'sla-warning'; // 45-90m Ámbar
    } else if (mins >= 90) {
      slaClass = 'sla-critical'; // >90m Rojo
    }

    if (mins < 60) {
      return { text: `${mins} min`, slaClass };
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return { text: `${hrs}h ${remMins}m`, slaClass };
  }

  protected getStatusLabel(status: YardVehicle['status']): string {
    switch (status) {
      case 'WAITING_RAMP':
        return 'En Espera de Rampa';
      case 'AT_RAMP':
        return 'En Andén / Maniobra';
      case 'DISCHARGE_FINISHED':
        return 'Descarga Finalizada';
      case 'AUTHORIZED_DEPARTURE':
        return 'Salida Autorizada';
      case 'COMPLETED_EXIT':
        return 'Salida Concluida';
      default:
        return status;
    }
  }

  protected getCurrentDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  protected getCurrentTimeString(): string {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  protected formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  protected formatTimeStringFromDate(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
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
