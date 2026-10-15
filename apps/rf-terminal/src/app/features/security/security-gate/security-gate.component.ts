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

import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthState } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { PrintService } from '../../../core/services/print.service';
import { RfNotificationService } from '../../../core/services/rf-notification.service';
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
  rampCode?: string;
  sealNumbers: string[];
  exitSealNumbers?: string[];
  entryTime: Date;
  departureTime?: Date;
  status: 'WAITING_RAMP' | 'AT_RAMP' | 'DISCHARGE_FINISHED' | 'AUTHORIZED_DEPARTURE' | 'COMPLETED_EXIT';
  warehouseStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isReadyForExit?: boolean;
  photoUrl?: string;
  checklistData?: any;
  observations?: string;
  exitObservations?: string;
  guardNotes?: string;
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
  private readonly route = inject(ActivatedRoute);
  protected readonly authState = inject(AuthState);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly printService = inject(PrintService);
  protected readonly notifService = inject(RfNotificationService);

  constructor() {
    effect(() => {
      const pass = this.notifService.requestedPassToLoad();
      if (pass) {
        this.activeTab.set('REGISTRATION');
        this.loadPassIntoForm(pass);
        this.notifService.clearRequestedPassToLoad();
      }
    });

    // Conexión con Sesión Activa: Auto-asignar el nombre del guardia autenticado
    effect(() => {
      const user = this.authState.user();
      if (user?.fullName) {
        const currentVal = this.checkInForm.get('responsableVigilanciaNombre')?.value;
        if (!currentVal || currentVal === 'Guardia de Turno - Caseta Principal') {
          this.checkInForm.patchValue({ responsableVigilanciaNombre: user.fullName });
        }
      }
    }, { allowSignalWrites: true });
  }

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
    'Camioneta',
    'Tortón',
    'Tráiler',
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

  // Conexión con Módulo de Andenes / Rampas (Reactivo)
  protected readonly rampOptions = signal([
    { num: 1, label: 'Rampa 01', available: true, occupiedBy: undefined as string | undefined },
    { num: 2, label: 'Rampa 02', available: true, occupiedBy: undefined as string | undefined },
    { num: 3, label: 'Rampa 03', available: false, occupiedBy: '72-AB-9K' },
    { num: 4, label: 'Rampa 04', available: true, occupiedBy: undefined as string | undefined },
    { num: 5, label: 'Rampa 05', available: true, occupiedBy: undefined as string | undefined },
    { num: 6, label: 'Rampa 06', available: true, occupiedBy: undefined as string | undefined },
    { num: 7, label: 'Rampa 07', available: false, occupiedBy: '33-KZ-4R' },
    { num: 8, label: 'Rampa 08', available: true, occupiedBy: undefined as string | undefined },
    { num: 9, label: 'Rampa 09', available: true, occupiedBy: undefined as string | undefined },
    { num: 10, label: 'Rampa 10', available: true, occupiedBy: undefined as string | undefined },
    { num: 11, label: 'Rampa 11', available: true, occupiedBy: undefined as string | undefined },
    { num: 12, label: 'Rampa 12', available: true, occupiedBy: undefined as string | undefined },
  ]);

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
      isReadyForExit: false,
      warehouseStatus: 'IN_PROGRESS',
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
      isReadyForExit: false,
      warehouseStatus: 'IN_PROGRESS',
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
      sealNumbers: ['PENDIENTE_ANDEN'],
      entryTime: new Date(Date.now() - 110 * 60000),
      status: 'DISCHARGE_FINISHED',
      isReadyForExit: true,
      warehouseStatus: 'COMPLETED',
      checklistData: {
        eppZapatos: 'SI', eppChaleco: 'SI', eppCofia: 'SI', eppCubrebocas: 'SI',
        revInteriorCaja: 'SI', revDanosCaja: 'NO', revDanosPuertas: 'NO', revOloresExtranos: 'NO', revIndiciosPlagas: 'NO'
      }
    },
  ]);

  // ─── Historial & Auditoría de Egresos Oficiales (Salidas Concluidas) ────────
  protected readonly historyVehicles = signal<YardVehicle[]>([
    {
      id: 'veh-hist-001',
      entryFolio: 'REC-2026-000088',
      token: 'PASS-20260929-0071',
      driverName: 'Miguel Ángel Valenzuela',
      driverPhone: '55-8812-4400',
      carrierName: 'Transportes Tresguerras',
      tractorPlates: '90-TR-1A',
      boxPlates: '12-BB-8K',
      ecoNumber: 'TG-104',
      boxDimensions: '53 Pies',
      transportType: 'Caja Seca',
      operationType: 'INBOUND',
      documentNumber: 'REM-77192',
      clientName: 'Amazon México',
      rampNumber: 2,
      sealNumbers: ['SL-33419'],
      exitSealNumbers: ['SL-33419'],
      entryTime: new Date(Date.now() - 240 * 60000),
      departureTime: new Date(Date.now() - 95 * 60000),
      status: 'COMPLETED_EXIT',
      isReadyForExit: true,
      warehouseStatus: 'COMPLETED',
      exitObservations: 'Salida en orden con sello cotejado sin violación',
      guardNotes: 'Maniobra de descarga completada sin daños reportados'
    }
  ]);

  // ─── Modal de Validación de Salida (Check-out) ───────────────────────────────
  protected readonly selectedVehicleForCheckout = signal<YardVehicle | null>(null);
  protected readonly checkoutSealInput = signal('');
  protected readonly checkoutObservations = signal('');
  protected readonly checkoutNotes = signal('');

  // ─── Modal de Asignación Rápida de Rampa ────────────────────────────────────
  protected readonly selectedVehicleForRamp = signal<YardVehicle | null>(null);

  // ─── Computed Metrics & Lists ───────────────────────────────────────────────
  protected readonly yardCount = computed(() => this.yardVehicles().length);
  protected readonly waitingCount = computed(() => this.yardVehicles().filter((v) => v.status === 'WAITING_RAMP').length);
  protected readonly atRampCount = computed(() => this.yardVehicles().filter((v) => v.status === 'AT_RAMP').length);
  protected readonly readyDepartureCount = computed(() => this.yardVehicles().filter((v) => v.status === 'DISCHARGE_FINISHED' || v.isReadyForExit).length);
  protected readonly pendingPassesCount = computed(() => this.activePasses().length);
  protected readonly historyCount = computed(() => this.historyVehicles().length);

  protected readonly readyForExitVehicles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.yardVehicles().filter(v => v.status === 'DISCHARGE_FINISHED' || v.isReadyForExit);
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

  protected readonly filteredHistory = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.historyVehicles();
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
    // Sincronizar pestaña solicitada desde el menú táctil y carga por token
    this.route.queryParamMap.subscribe((params) => {
      const tabParam = params.get('tab');
      if (tabParam === 'REGISTRATION' || tabParam === 'IN_YARD' || tabParam === 'CHECKOUT' || tabParam === 'HISTORY') {
        this.activeTab.set(tabParam as SecurityTab);
      }
      const token = params.get('token');
      if (token) {
        const found = this.activePasses().find(p => p.token === token);
        if (found) {
          this.activeTab.set('REGISTRATION');
          this.loadPassIntoForm(found);
        }
      }
    });

    // Sincronizar pases QR enviados por choferes con el Centro de Notificaciones
    for (const p of this.activePasses()) {
      if (p.status === 'SUBMITTED') {
        this.notifService.addSubmittedDriverPass({
          id: p.id,
          token: p.token,
          carrierName: p.carrierName,
          driverName: p.driverName,
          driverPhone: p.driverPhone,
          tractorPlates: p.tractorPlates,
          boxPlates: p.boxPlates,
          ecoNumber: p.ecoNumber,
          operationType: p.operationType,
          documentNumber: p.documentNumber,
          clientName: p.clientName,
          status: 'SUBMITTED',
          submittedAt: p.submittedAt,
          time: new Date(p.submittedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
      }
    }

    // Sincronizar unidades con maniobra concluida listas para salida
    for (const v of this.yardVehicles()) {
      if (v.status === 'DISCHARGE_FINISHED') {
        this.notifService.addReadyExitPass({
          id: v.id,
          folio: v.entryFolio,
          token: v.token,
          driverName: v.driverName,
          carrierName: v.carrierName,
          tractorPlates: v.tractorPlates,
          rampCode: v.rampNumber ? `Rampa ${v.rampNumber}` : 'Andén',
          rampNumber: v.rampNumber,
          time: new Date(v.entryTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          isReadyForExit: true
        });
      }
    }

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
      
      // Regla de Negocio: En CARGA la unidad ingresa vacía; los sellos se aplican al salir en andén
      this.sealList.set(['PENDIENTE_ANDEN']);
      this.tempSealInput.set('');
    } else {
      remisionControl?.setValidators([Validators.required]);
      cartaPorteControl?.clearValidators();
      docRemisionControl?.setValue('SI');
      docRemisionObsControl?.setValue('');
      docCartaPorteControl?.setValue('NO');
      docCartaPorteObsControl?.setValue('N/A - Operación de Descarga/Recepción');
      
      // Si venía de CARGA, limpiar el sello provisional PENDIENTE_ANDEN
      if (this.sealList().some(s => s === 'PENDIENTE_ANDEN')) {
        this.sealList.set([]);
      }
    }

    remisionControl?.updateValueAndValidity();
    cartaPorteControl?.updateValueAndValidity();
  }

  // ─── Gestión de Sellos Fiscales (Tags) ─────────────────────────────────────
  protected addSeal(): void {
    if (this.checkInForm.get('operacion')?.value === 'CARGA') {
      return; // Bloqueado en Carga (Se asignan en andén de salida)
    }
    const seal = this.tempSealInput().trim().toUpperCase();
    if (seal && !this.sealList().includes(seal)) {
      this.sealList.update(list => [...list, seal]);
      this.tempSealInput.set('');
      this.audioService.playSuccess();
    }
  }

  protected removeSeal(index: number): void {
    if (this.checkInForm.get('operacion')?.value === 'CARGA') {
      return; // Bloqueado en Carga
    }
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
      this.sealList.set(['PENDIENTE_ANDEN']);
    } else {
      this.checkInForm.patchValue({ remision: pass.documentNumber, noCartaPorte: '' });
      if (pass.sealNumbers && pass.sealNumbers.length > 0) {
        this.sealList.set([...pass.sealNumbers]);
      } else {
        this.sealList.set([]);
      }
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
    this.showAlert('warning', 'Formulario limpiado para captura manual.');
  }

  // ─── Registro de Entrada (Check-In) ─────────────────────────────────────────
  protected submitCheckIn(): void {
    if (this.tempSealInput().trim() && this.checkInForm.get('operacion')?.value === 'DESCARGA') {
      this.addSeal();
    }

    const val = this.checkInForm.value;
    const isOutbound = val.operacion === 'CARGA';

    // Validación de Campos Obligatorios homologada con Admin Console
    const missing: string[] = [];
    if (!val.fecha) missing.push('Fecha');
    if (isOutbound && (!val.noCartaPorte || !val.noCartaPorte.trim())) {
      missing.push('Número de Carta Porte (Obligatorio en Carga)');
    }
    if (!isOutbound && (!val.remision || !val.remision.trim())) {
      missing.push('Número de Remisión / Factura (Obligatorio en Descarga)');
    }
    if (!val.client || !val.client.trim()) missing.push('Cliente Destinatario');
    if (!val.carrierLine || !val.carrierLine.trim()) missing.push('Línea Transportista');
    if (!val.nombreOperador || !val.nombreOperador.trim()) missing.push('Nombre del Operador / Chofer');
    if (!val.placasTracto || !val.placasTracto.trim()) missing.push('Placas del Tracto');
    if (!val.noEcoTractor || !val.noEcoTractor.trim()) missing.push('No. Económico Tracto');
    if (!val.placasCaja || !val.placasCaja.trim()) missing.push('Placas de la Caja');
    if (!val.rampNumber) missing.push('Andén / Rampa');

    // Regla de Negocio: En DESCARGA es obligatorio registrar al menos 1 sello/cincho físico de llegada. En CARGA no.
    if (!isOutbound && this.sealList().length === 0) {
      missing.push('Al menos 1 Sello de Seguridad / Cincho (Obligatorio en Descarga)');
    }

    if (missing.length > 0 || this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      this.audioService.playWarning();
      this.showAlert('warning', `⚠️ Faltan campos obligatorios: ${missing.join(', ')}`);
      return;
    }

    const prefix = isOutbound ? 'SAL' : 'REC';
    const generatedFolio = `${prefix}-2026-${String(Date.now()).slice(-6)}`;

    const seals = this.sealList().length > 0
      ? this.sealList()
      : (isOutbound ? ['PENDIENTE_ANDEN'] : ['SL-00000']);
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
      checklistData: { ...val }
    };

    // Remover de solicitudes activas si venía de un pase
    const loadedTok = this.activeLoadedToken();
    if (loadedTok) {
      this.activePasses.update(list => list.filter(p => p.token !== loadedTok));
    }

    // Conexión con Módulo de Rampas / Andenes: Ocupar la rampa seleccionada
    if (val.rampNumber) {
      const assignedRampNum = Number(val.rampNumber);
      this.rampOptions.update((ramps) =>
        ramps.map((r) =>
          r.num === assignedRampNum
            ? { ...r, available: false, occupiedBy: val.placasTracto?.trim().toUpperCase() }
            : r
        )
      );
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

    const prevRamp = vehicle.rampNumber;
    // Conexión con Rampas / Andenes: Liberar previa y ocupar nueva
    this.rampOptions.update((ramps) =>
      ramps.map((r) => {
        if (prevRamp && r.num === prevRamp) {
          return { ...r, available: true, occupiedBy: undefined };
        }
        if (r.num === rampNumber) {
          return { ...r, available: false, occupiedBy: vehicle.tractorPlates };
        }
        return r;
      })
    );

    this.yardVehicles.update((list) =>
      list.map((v) => (v.id === vehicle.id ? { ...v, rampNumber, status: 'AT_RAMP' } : v))
    );

    this.closeRampModal();
    this.audioService.playSuccess();
    this.showAlert('success', `Rampa 0${rampNumber} asignada al tracto ${vehicle.tractorPlates}.`);
  }

  // ─── Modal de Check-out (Salida & Cotejo de Sellos) ──────────────────────────
  protected openCheckoutModal(vehicle: YardVehicle): void {
    // REGLA ESTIPULADA DE CONEXIÓN CON ALMACÉN:
    // La unidad NO puede salir de caseta si aún se encuentra en maniobra activa en almacén
    if (!vehicle.isReadyForExit && vehicle.status !== 'DISCHARGE_FINISHED' && vehicle.status !== 'AUTHORIZED_DEPARTURE') {
      this.audioService.playWarning();
      this.showAlert(
        'warning',
        '⚠️ Esta unidad aún se encuentra en proceso de maniobra/descarga en almacén. Requiere que Almacén autorice y finalice la recepción antes del Check-Out.'
      );
      return;
    }

    this.selectedVehicleForCheckout.set(vehicle);

    // Si es CARGA: los sellos son los colocados en andén de salida (no los de entrada)
    if (vehicle.operationType === 'OUTBOUND') {
      this.checkoutSealInput.set('');
    } else {
      const firstValidSeal = vehicle.sealNumbers.find(s => s !== 'PENDIENTE_ANDEN') || '';
      this.checkoutSealInput.set(firstValidSeal);
    }

    this.checkoutObservations.set('');
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

    // Regla de Negocio en CARGA: Es obligatorio capturar el sello oficial colocado en andén
    if (vehicle.operationType === 'OUTBOUND' && (!inputSeal || inputSeal === 'PENDIENTE_ANDEN')) {
      this.audioService.playWarning();
      this.showAlert(
        'warning',
        '⚠️ En operaciones de CARGA es obligatorio capturar el Sello Oficial colocado en Andén de Salida antes del egreso.'
      );
      return;
    }

    if (!inputSeal) {
      this.audioService.playWarning();
      this.showAlert('warning', 'Debe capturar o escanear el número de sello de salida para cotejo.');
      return;
    }

    // 1. Estampar la fecha y hora oficial de salida física
    const exitTime = new Date();
    vehicle.departureTime = exitTime;
    vehicle.status = 'COMPLETED_EXIT';
    vehicle.exitSealNumbers = [inputSeal];
    vehicle.exitObservations = this.checkoutObservations().trim() || 'Salida en orden y autorizada por caseta';
    vehicle.guardNotes = this.checkoutNotes().trim();

    // 2. Si se capturó un sello de salida diferente o nuevo, registrarlo
    if (!vehicle.sealNumbers.includes(inputSeal)) {
      vehicle.sealNumbers = [inputSeal, ...vehicle.sealNumbers.filter(s => s !== 'PENDIENTE_ANDEN')];
    }

    // 3. Conexión con Módulo de Rampas / Andenes: Liberar automáticamente la rampa asignada
    if (vehicle.rampNumber) {
      const freeRampNum = vehicle.rampNumber;
      this.rampOptions.update((ramps) =>
        ramps.map((r) => (r.num === freeRampNum ? { ...r, available: true, occupiedBy: undefined } : r))
      );
    }

    // 4. Conexión con Historial & Auditoría: Mover de Patio a Historial
    this.yardVehicles.update((list) => list.filter((v) => v.id !== vehicle.id));
    this.historyVehicles.update((hist) => [{ ...vehicle }, ...hist]);
    this.selectedVehicleForCheckout.set(null);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([50, 80, 50]);
    }

    // 5. Preparar datos oficiales del F01 con la hora de salida exacta registrada
    this.preparePrintDataFromVehicle(vehicle);

    // 6. Desplegar automáticamente el Formato Oficial F01 con la hora de salida para descarga/impresión inmediata
    this.showF01PrintModal.set(true);

    const formattedExit = this.formatTimeStringFromDate(exitTime);
    this.showAlert(
      'success',
      `🚪 Salida autorizada para ${vehicle.tractorPlates} a las ${formattedExit}. Rampa 0${vehicle.rampNumber || 1} liberada. Formato F01 oficial generado.`
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
