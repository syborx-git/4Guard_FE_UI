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
import { SecurityGateApiService, SecurityGatePass } from '../../../core/services/security-gate-api.service';
import {
  PrintTransportChecklistLayoutComponent,
  TransportChecklistPrintData
} from '../print-transport-checklist-layout/print-transport-checklist-layout.component';
import { IncomingPassCardComponent } from '../incoming-pass-card/incoming-pass-card.component';

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
    PrintTransportChecklistLayoutComponent,
    IncomingPassCardComponent
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
  protected readonly apiService = inject(SecurityGateApiService);

  protected readonly isLoadingData = signal(false);

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
  protected readonly yardViewMode = signal<'CARDS' | 'COMPACT'>('CARDS');

  // ─── Token y Datos de Pase Vinculado Activo ──────────────────────────────────
  protected readonly activeLoadedToken = signal<string | null>(null);
  protected readonly activeLoadedPass = signal<DriverSubmittedPass | null>(null);

  // ─── Catálogos Oficiales (Sincronizados con Base de Datos PostgreSQL) ────────
  protected readonly carrierLinesList = signal<string[]>([
    'TRANSPORTADORA TERRESTRES DIAZ S.A. DE C.V.',
    'TRANSPORTES EBEN EZER S.A. DE C.V.',
    'TRANSPORTADORA GOLA S.A. DE C.V.',
    'TRANSPORTES MONCHO S.A. DE C.V.',
    'TUM TRANSPORTES UNIDOS MEXICANOS DIVISION DEL NORTE S.A. DE C.V.',
    'Otro (Especificar)'
  ]);

  protected readonly clientsList = signal<string[]>([
    'MARCAS NESTLE S.A. DE C.V.',
    'NESTLE MEXICO S.A. DE C.V.',
    'QUALAMEX S.A. DE C.V.',
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

  protected readonly isCustomTransportType = signal<boolean>(false);
  protected readonly customTransportInput = signal<string>('');
  protected readonly isCustomBoxDimension = signal<boolean>(false);
  protected readonly customBoxDimensionInput = signal<string>('');

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
    rampCode: [''],
    rampNumber: [null as number | null],

    // 2. Datos del Transporte
    carrierLine: ['', Validators.required],
    carrierLineCustom: [''],
    nombreOperador: ['', Validators.required],
    driverPhone: [''],
    tipoTransporte: ['', Validators.required],
    tipoTransporteCustom: [''],
    placasTracto: ['', Validators.required],
    noEcoTractor: ['', Validators.required],
    placasCaja: ['', Validators.required],
    medidasCaja: ['', Validators.required],
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

  // ─── Bandeja en Vivo de Solicitudes de Choferes (100% Base de Datos / API / Tiempo Real) ────
  protected readonly activePasses = signal<DriverSubmittedPass[]>([]);

  /**
   * Vista consolidada de solicitudes de choferes:
   * Fusiona los pases activos del backend con las notificaciones recibidas en tiempo real
   * (vía BroadcastChannel, Storage y Polling de RfNotificationService).
   */
  protected readonly displayActivePasses = computed<DriverSubmittedPass[]>(() => {
    const fromBackend = this.activePasses();
    const fromNotifs = this.notifService.pendingDriverPasses().map(p => ({
      id: p.id || p.token,
      token: p.token,
      carrierName: p.carrierName,
      driverName: p.driverName,
      driverPhone: p.driverPhone,
      tractorPlates: p.tractorPlates,
      boxPlates: p.boxPlates || '',
      ecoNumber: p.ecoNumber,
      boxDimensions: p.boxDimensions,
      transportType: p.transportType,
      operationType: p.operationType,
      documentNumber: p.documentNumber,
      clientName: p.clientName,
      sealNumbers: p.sealNumbers || [],
      status: 'SUBMITTED' as const,
      submittedAt: p.submittedAt instanceof Date ? p.submittedAt : new Date(p.submittedAt || Date.now()),
      checklistData: p.checklistData
    }));

    const map = new Map<string, DriverSubmittedPass>();
    // Prioridad 1: pases de backend (descartando los rechazados)
    for (const pass of fromBackend) {
      if (pass.token && !this.notifService.isPassDismissed(pass.token)) {
        map.set(pass.token, pass);
      }
    }
    // Prioridad 2: incorporar o enriquecer con notificaciones en vivo (descartando los rechazados)
    for (const notifPass of fromNotifs) {
      if (notifPass.token && !this.notifService.isPassDismissed(notifPass.token) && !map.has(notifPass.token)) {
        map.set(notifPass.token, notifPass);
      }
    }

    return Array.from(map.values());
  });

  // ─── Estado de Notificación / Toast Local ───────────────────────────────────
  protected readonly alertMessage = signal<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // ─── Vehículos en Patio (100% Base de Datos / Spring Boot) ─────────────────
  protected readonly yardVehicles = signal<YardVehicle[]>([]);

  // ─── Historial & Auditoría de Egresos Oficiales (100% Base de Datos) ───────
  protected readonly historyVehicles = signal<YardVehicle[]>([]);

  // ─── Modal de Validación de Salida (Check-out) ───────────────────────────────
  protected readonly selectedVehicleForCheckout = signal<YardVehicle | null>(null);
  protected readonly checkoutSealInput = signal('');
  protected readonly checkoutObservations = signal('');
  protected readonly checkoutNotes = signal('');

  // ─── Control de Colapso de Métricas KPI (Homologado a Consola Admin) ─────────
  protected readonly isKpiCollapsed = signal<boolean>(this.loadStorageBool('4g_security_rf_kpis_collapsed', false));

  protected toggleKpiCollapse(): void {
    const next = !this.isKpiCollapsed();
    this.isKpiCollapsed.set(next);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('4g_security_rf_kpis_collapsed', String(next));
      }
    } catch {}
    this.audioService.playSuccess();
  }

  private loadStorageBool(key: string, defaultValue: boolean): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = localStorage.getItem(key);
        if (val !== null) return val === 'true';
      }
    } catch {}
    return defaultValue;
  }

  // ─── Computed Metrics & Lists ───────────────────────────────────────────────
  protected readonly yardCount = computed(() => this.yardVehicles().length);
  protected readonly waitingCount = computed(() => this.yardVehicles().filter((v) => v.status === 'WAITING_RAMP').length);
  protected readonly atRampCount = computed(() => this.yardVehicles().filter((v) => v.status === 'AT_RAMP').length);
  protected readonly readyDepartureCount = computed(() => this.yardVehicles().filter((v) => v.status === 'DISCHARGE_FINISHED' || v.isReadyForExit).length);
  protected readonly pendingPassesCount = computed(() => this.displayActivePasses().length);
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

  // ─── Filtros & Búsqueda Específicos para Historial / Auditoría ──────────────
  protected readonly historyFilter = signal<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  protected readonly historySearchQuery = signal<string>('');

  /** Calcula la duración de estancia y clasifica el SLA operativo */
  protected calculateStayDuration(entryTime: Date | string, departureTime?: Date | string): { text: string; sla: 'ok' | 'warn' | 'late' } {
    if (!departureTime) return { text: 'En estancia', sla: 'ok' };
    const entry = new Date(entryTime).getTime();
    const exit = new Date(departureTime).getTime();
    const diffMs = Math.max(0, exit - entry);
    const diffMins = Math.round(diffMs / 60000);

    let text = '';
    if (diffMins < 60) {
      text = `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      text = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    let sla: 'ok' | 'warn' | 'late' = 'ok';
    if (diffMins > 90) sla = 'late';
    else if (diffMins > 45) sla = 'warn';

    return { text, sla };
  }

  /** Métricas KPI del Historial para auditoría de patio */
  protected readonly historyKpis = computed(() => {
    const list = this.historyVehicles();
    const total = list.length;
    const inbounds = list.filter(v => v.operationType === 'INBOUND').length;
    const outbounds = list.filter(v => v.operationType === 'OUTBOUND').length;

    let totalMins = 0;
    let withExitCount = 0;
    for (const v of list) {
      if (v.departureTime && v.entryTime) {
        const diff = new Date(v.departureTime).getTime() - new Date(v.entryTime).getTime();
        if (diff > 0) {
          totalMins += Math.round(diff / 60000);
          withExitCount++;
        }
      }
    }
    const avgMins = withExitCount > 0 ? Math.round(totalMins / withExitCount) : 0;
    const avgText = avgMins >= 60 ? `${Math.floor(avgMins / 60)}h ${avgMins % 60}m` : `${avgMins} min`;

    return {
      total,
      inbounds,
      outbounds,
      avgStay: avgText,
      avgSla: avgMins > 90 ? 'late' : (avgMins > 45 ? 'warn' : 'ok')
    };
  });

  protected readonly filteredHistory = computed(() => {
    const q = this.historySearchQuery().toLowerCase().trim() || this.searchQuery().toLowerCase().trim();
    const filter = this.historyFilter();
    let list = this.historyVehicles();

    if (filter === 'INBOUND') {
      list = list.filter(v => v.operationType === 'INBOUND');
    } else if (filter === 'OUTBOUND') {
      list = list.filter(v => v.operationType === 'OUTBOUND');
    }

    if (!q) return list;

    return list.filter(
      (v) =>
        v.entryFolio.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        v.carrierName.toLowerCase().includes(q) ||
        v.tractorPlates.toLowerCase().includes(q) ||
        v.boxPlates.toLowerCase().includes(q) ||
        (v.clientName && v.clientName.toLowerCase().includes(q)) ||
        (v.documentNumber && v.documentNumber.toLowerCase().includes(q)) ||
        v.sealNumbers.some((s) => s.toLowerCase().includes(q)) ||
        (v.exitSealNumbers && v.exitSealNumbers.some((s) => s.toLowerCase().includes(q)))
    );
  });

  private pollTimer?: any;

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

    // Carga inicial 100% real desde el Backend / BD
    this.loadBackendData();

    // Sincronización periódica en vivo con la Base de Datos y Consola Admin (cada 4s)
    this.pollTimer = setInterval(() => {
      this.loadBackendData(false);
    }, 4000);

    // Sincronizar validaciones bimodal
    this.checkInForm.get('operacion')?.valueChanges.subscribe((op) => {
      this.updateBimodalValidators(op);
    });
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  // ─── Carga de Datos desde el Backend Spring Boot / PostgreSQL ─────────────
  protected loadBackendData(showLoading = true): void {
    if (showLoading) this.isLoadingData.set(true);

    // 1. Pases Activos (Choferes en espera o con auto-registro enviado)
    this.apiService.getActivePasses().subscribe({
      next: (passes) => {
        const mapped = passes.map(p => this.mapToDriverSubmittedPass(p));
        this.activePasses.set(mapped);
        
        // Sincronizar con el centro de notificaciones
        for (const p of mapped) {
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
              boxDimensions: p.boxDimensions,
              transportType: p.transportType,
              operationType: p.operationType,
              documentNumber: p.documentNumber,
              clientName: p.clientName,
              sealNumbers: p.sealNumbers,
              checklistData: p.checklistData,
              status: 'SUBMITTED',
              submittedAt: p.submittedAt,
              time: new Date(p.submittedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            });
          }
        }

        // Si hay un token en URL y no se ha cargado en form
        const urlToken = this.route.snapshot.queryParamMap.get('token');
        if (urlToken && !this.activeLoadedToken()) {
          const pass = mapped.find(p => p.token === urlToken);
          if (pass) {
            this.activeTab.set('REGISTRATION');
            this.loadPassIntoForm(pass);
          }
        }
      },
      error: () => {}
    });

    // 2. Unidades en Patio / Andenes
    this.apiService.getInYardPasses().subscribe({
      next: (passes) => {
        const mapped = passes.map(p => this.mapToYardVehicle(p));
        this.yardVehicles.set(mapped);

        for (const v of mapped) {
          if (v.status === 'DISCHARGE_FINISHED' || v.isReadyForExit) {
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

        if (showLoading) this.isLoadingData.set(false);
      },
      error: () => {
        if (showLoading) this.isLoadingData.set(false);
      }
    });

    // 3. Historial de Caseta
    this.apiService.getHistoryPasses().subscribe({
      next: (passes) => {
        const mapped = passes.map(p => this.mapToYardVehicle(p));
        this.historyVehicles.set(mapped);
      },
      error: () => {}
    });

    // 4. Catálogos Oficiales de Caseta (Clientes, Transportistas, Tipos, Medidas)
    this.apiService.getPublicCatalogs().subscribe({
      next: (cats) => {
        if (cats.clients && cats.clients.length > 0) {
          const uniqueClients = Array.from(new Set([...cats.clients, 'Otro (Especificar)']));
          this.clientsList.set(uniqueClients);
        }
        if (cats.carrierLines && cats.carrierLines.length > 0) {
          const uniqueCarriers = Array.from(new Set([...cats.carrierLines, 'Otro (Especificar)']));
          this.carrierLinesList.set(uniqueCarriers);
        }
        if (cats.transportTypes && cats.transportTypes.length > 0) {
          this.transportTypesList.set(cats.transportTypes);
        }
        if (cats.boxDimensions && cats.boxDimensions.length > 0) {
          this.boxDimensionsList.set(cats.boxDimensions);
        }
      },
      error: () => {}
    });
  }

  private mapToDriverSubmittedPass(p: any): DriverSubmittedPass {
    const doc = p.remision || p.docNumber || p.noCartaPorte || p.documentNumber || '';
    return {
      id: p.id || p.token,
      token: p.token,
      carrierName: p.carrierLine || p.carrierName || 'Transportista',
      driverName: p.driverName || p.nombreOperador || 'Operador',
      driverPhone: p.driverPhone,
      tractorPlates: p.tractorPlates || p.placasTracto || 'S/P',
      boxPlates: p.boxPlates || p.placasCaja || '',
      ecoNumber: p.noEcoTractor || p.ecoNumber,
      boxDimensions: p.boxDimensions || p.medidasCaja,
      transportType: p.transportType || p.tipoTransporte,
      operationType: (p.operationType === 'CARGA' || p.operationType === 'OUTBOUND') ? 'OUTBOUND' : 'INBOUND',
      documentNumber: doc,
      clientName: p.clientName || p.client || 'Cliente',
      sealNumbers: p.sealNumbers || [],
      status: (p.status as any) || 'SUBMITTED',
      submittedAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      checklistData: typeof p.checklistData === 'string' ? JSON.parse(p.checklistData) : (p.checklistData || {})
    };
  }

  private mapToYardVehicle(p: SecurityGatePass): YardVehicle {
    return {
      id: p.id || p.token,
      entryFolio: p.generatedFolio || p.token || 'S/F',
      token: p.token,
      driverName: p.driverName || 'Operador',
      driverPhone: p.driverPhone,
      carrierName: p.carrierLine || p.carrierName || 'Transportista',
      tractorPlates: p.tractorPlates || 'S/P',
      boxPlates: p.boxPlates || '',
      ecoNumber: p.noEcoTractor || p.ecoNumber,
      boxDimensions: p.boxDimensions,
      transportType: p.transportType,
      operationType: (p.operationType === 'CARGA' || p.operationType === 'OUTBOUND') ? 'OUTBOUND' : 'INBOUND',
      documentNumber: p.docNumber || '',
      clientName: p.clientName,
      rampNumber: p.rampNumber,
      rampCode: p.rampCode,
      sealNumbers: p.sealNumbers || [],
      exitSealNumbers: p.exitSealNumbers || [],
      entryTime: p.processedAt ? new Date(p.processedAt) : (p.createdAt ? new Date(p.createdAt) : new Date()),
      departureTime: p.exitedAt ? new Date(p.exitedAt) : undefined,
      status: p.status === 'COMPLETED'
        ? (p.exitedAt ? 'COMPLETED_EXIT' : (p.isReadyForExit ? 'DISCHARGE_FINISHED' : (p.rampNumber ? 'AT_RAMP' : 'WAITING_RAMP')))
        : (p.rampNumber ? 'AT_RAMP' : 'WAITING_RAMP'),
      warehouseStatus: p.warehouseStatus || 'IN_PROGRESS',
      isReadyForExit: !!p.isReadyForExit,
      photoUrl: undefined,
      checklistData: typeof p.checklistData === 'string' ? JSON.parse(p.checklistData) : (p.checklistData || {}),
      observations: p.observations || '',
      exitObservations: p.exitObservations || '',
      guardNotes: p.guardNotes || ''
    };
  }

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

  // ─── Normalización y Gestión Dinámica de Tipos de Transporte y Medidas ──────
  protected normalizeTransportType(rawType?: string | null): string {
    if (!rawType || !rawType.trim()) return '';
    const clean = rawType.trim();
    const upper = clean.toUpperCase();

    // Mapeos oficiales a las 4 opciones autorizadas
    if (upper === 'CAMIONETA' || upper.includes('PICKUP') || upper.includes('VAN')) {
      return 'Camioneta';
    }
    if (upper === 'TORTON' || upper === 'TORTÓN' || upper.includes('TORTON') || upper.includes('TORTÓN') || upper.includes('RABON') || upper.includes('RABÓN')) {
      return 'Tortón';
    }
    if (upper === 'TRAILER' || upper === 'TRÁILER' || upper.includes('TRAILER') || upper.includes('TRÁILER') || upper.includes('TRACTO') || upper.includes('SECA') || upper.includes('REFRIGERAD') || upper.includes('REEFER') || upper.includes('PLATAFORMA') || upper.includes('FULL') || upper.includes('DOBLE')) {
      return 'Tráiler';
    }

    // Coincidencia con catálogo
    const exact = this.transportTypesList().find(t => t.toLowerCase() === clean.toLowerCase());
    if (exact) return exact;

    // Cualquier otra opción no estándar se cataloga como 'Otro (Especificar)'
    return 'Otro (Especificar)';
  }

  protected normalizeBoxDimensions(rawDim?: string | null): string {
    if (!rawDim || !rawDim.trim()) return '53 Pies';
    const clean = rawDim.trim();
    const upper = clean.toUpperCase();

    if (upper.includes('53')) return '53 Pies';
    if (upper.includes('48')) return '48 Pies';
    if (upper.includes('40')) return '40 Pies';
    if (upper.includes('20')) return '20 Pies';
    if (upper.includes('3.5')) return '3.5 Toneladas';
    if (upper.includes('PLATAFORMA')) return 'N/A - Plataforma';

    const match = this.boxDimensionsList().find(d => d.toLowerCase() === clean.toLowerCase());
    if (match) return match;

    this.boxDimensionsList.update(list => [
      ...list.filter(x => x !== 'Otra Medida'),
      clean,
      'Otra Medida'
    ]);
    return clean;
  }

  protected normalizeCarrierLine(rawCarrier?: string | null): string {
    if (!rawCarrier || !rawCarrier.trim()) return '';
    const clean = rawCarrier.trim();
    const match = this.carrierLinesList().find(c => c.toLowerCase() === clean.toLowerCase());
    if (match) return match;

    // Si viene una línea nueva registrada por el chofer, incorporarla dinámicamente al catálogo
    this.carrierLinesList.update(list => [
      ...list.filter(x => x !== 'Otro (Especificar)'),
      clean,
      'Otro (Especificar)'
    ]);
    return clean;
  }

  protected normalizeClient(rawClient?: string | null): string {
    if (!rawClient || !rawClient.trim()) return '';
    const clean = rawClient.trim();
    const match = this.clientsList().find(c => c.toLowerCase() === clean.toLowerCase());
    if (match) return match;

    // Si viene un cliente nuevo registrado por el chofer, incorporarlo dinámicamente al catálogo
    this.clientsList.update(list => [
      ...list.filter(x => x !== 'Otro (Especificar)'),
      clean,
      'Otro (Especificar)'
    ]);
    return clean;
  }

  protected onTransportTypeSelect(val: string): void {
    if (val === 'Otro (Especificar)') {
      this.isCustomTransportType.set(true);
      this.checkInForm.patchValue({ tipoTransporte: this.customTransportInput() || 'Otro' });
    } else {
      this.isCustomTransportType.set(false);
      this.checkInForm.patchValue({ tipoTransporte: val });
    }
  }

  protected onCustomTransportInput(val: string): void {
    this.customTransportInput.set(val);
    this.checkInForm.patchValue({ tipoTransporte: val });
  }

  protected onBoxDimensionSelect(val: string): void {
    if (val === 'Otra Medida') {
      this.isCustomBoxDimension.set(true);
      this.checkInForm.patchValue({ medidasCaja: this.customBoxDimensionInput() || 'Personalizada' });
    } else {
      this.isCustomBoxDimension.set(false);
      this.checkInForm.patchValue({ medidasCaja: val });
    }
  }

  protected onCustomBoxDimensionInput(val: string): void {
    this.customBoxDimensionInput.set(val);
    this.checkInForm.patchValue({ medidasCaja: val });
  }

  // ─── Carga Rápida 1-Tap desde Solicitud de Chofer (ADR-017) ─────────────────
  protected loadPassIntoForm(pass: DriverSubmittedPass): void {
    this.activeLoadedToken.set(pass.token);
    this.activeLoadedPass.set(pass);

    const isCarga = pass.operationType === 'OUTBOUND';
    const opValue = isCarga ? 'CARGA' : 'DESCARGA';

    const rawTransport = (pass as any).transportType || (pass as any).tipoTransporte || (pass as any).vehicleType;
    const resolvedTransport = this.normalizeTransportType(rawTransport);

    const rawBoxDim = (pass as any).boxDimensions || (pass as any).medidasCaja || (pass as any).boxSize;
    const resolvedBoxDim = this.normalizeBoxDimensions(rawBoxDim);

    const resolvedCarrier = this.normalizeCarrierLine(pass.carrierName);
    const resolvedClient = this.normalizeClient(pass.clientName);

    const docNum = (pass.documentNumber && pass.documentNumber !== 'S/N' && pass.documentNumber !== 'S/D') ? pass.documentNumber : '';

    this.checkInForm.patchValue({
      operacion: opValue,
      carrierLine: resolvedCarrier,
      nombreOperador: pass.driverName,
      driverPhone: pass.driverPhone || '',
      placasTracto: pass.tractorPlates,
      placasCaja: pass.boxPlates,
      noEcoTractor: pass.ecoNumber || 'ECO-01',
      tipoTransporte: resolvedTransport,
      medidasCaja: resolvedBoxDim,
      client: resolvedClient,
      transportistaNombre: pass.driverName,
      transportistaFirma: true,
    });

    if (resolvedTransport === 'Otro (Especificar)') {
      this.isCustomTransportType.set(true);
      this.customTransportInput.set(rawTransport || '');
    } else {
      this.isCustomTransportType.set(false);
      this.customTransportInput.set('');
    }

    if (resolvedBoxDim === 'Otra Medida') {
      this.isCustomBoxDimension.set(true);
      this.customBoxDimensionInput.set(rawBoxDim || '');
    } else {
      this.isCustomBoxDimension.set(false);
      this.customBoxDimensionInput.set('');
    }

    if (isCarga) {
      this.checkInForm.patchValue({ noCartaPorte: docNum, remision: '' });
      this.sealList.set(['PENDIENTE_ANDEN']);
    } else {
      this.checkInForm.patchValue({ remision: docNum, noCartaPorte: '' });
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
    this.activeLoadedPass.set(null);
    this.isCustomTransportType.set(false);
    this.customTransportInput.set('');
    this.isCustomBoxDimension.set(false);
    this.customBoxDimensionInput.set('');
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
      tipoTransporte: '',
      medidasCaja: ''
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

    const seals = this.sealList().length > 0
      ? this.sealList()
      : (isOutbound ? ['PENDIENTE_ANDEN'] : ['SL-00000']);
    const rampNum = val.rampNumber ? Number(val.rampNumber) : undefined;
    const clientSelected = val.client === 'OTRO' ? val.clientNameCustom : val.client;

    const completionPayload = {
      operationType: isOutbound ? 'CARGA' : 'DESCARGA',
      rampNumber: rampNum,
      rampCode: rampNum ? `R-${rampNum < 10 ? '0' + rampNum : rampNum}` : undefined,
      clientName: clientSelected,
      carrierLine: val.carrierLine?.trim(),
      driverName: val.nombreOperador?.trim(),
      driverPhone: val.driverPhone?.trim(),
      tractorPlates: val.placasTracto?.trim().toUpperCase(),
      noEcoTractor: val.noEcoTractor?.trim(),
      boxPlates: val.placasCaja?.trim().toUpperCase(),
      boxDimensions: (this.isCustomBoxDimension() && this.customBoxDimensionInput().trim())
        ? this.customBoxDimensionInput().trim()
        : (val.medidasCaja || ''),
      transportType: (this.isCustomTransportType() && this.customTransportInput().trim())
        ? this.customTransportInput().trim()
        : (val.tipoTransporte || ''),
      docNumber: isOutbound ? val.noCartaPorte : val.remision,
      sealNumbers: seals,
      observations: val.docRemisionObs || val.docCartaPorteObs || '',
      guardNotes: val.responsableVigilanciaNombre || 'Guardia de Turno'
    };

    const token = this.activeLoadedToken();
    const handleSuccess = (savedPass: SecurityGatePass) => {
      this.audioService.playSuccess();
      if (navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }

      const vehicle = this.mapToYardVehicle(savedPass);
      this.preparePrintDataFromVehicle(vehicle);

      this.showAlert(
        'success',
        `✅ Arribo autorizado con Folio ${savedPass.generatedFolio || vehicle.entryFolio}. Registrado en Base de Datos. Pluma abierta.`
      );

      this.activeLoadedToken.set(null);
      this.clearLoadedPass();
      this.loadBackendData(false);
      this.activeTab.set('IN_YARD');
    };

    if (token) {
      // Chofer ya tenía pase digital QR generado
      this.apiService.completeCheckin(token, completionPayload).subscribe({
        next: handleSuccess,
        error: (err) => {
          this.audioService.playWarning();
          this.showAlert('error', `Error al autorizar ingreso en servidor: ${err?.error?.message || err?.message || 'Verifica la conexión'}`);
        }
      });
    } else {
      // Registro en caseta sin pase previo: crear pase oficial en BD y luego completarlo
      this.apiService.generatePass({
        operationType: isOutbound ? 'CARGA' : 'DESCARGA',
        clientName: clientSelected,
        carrierLine: val.carrierLine?.trim(),
        driverName: val.nombreOperador?.trim(),
        driverPhone: val.driverPhone?.trim(),
        tractorPlates: val.placasTracto?.trim().toUpperCase(),
        docNumber: isOutbound ? val.noCartaPorte : val.remision
      }).subscribe({
        next: (generatedPass) => {
          this.apiService.completeCheckin(generatedPass.token, completionPayload).subscribe({
            next: handleSuccess,
            error: (err) => {
              this.audioService.playWarning();
              this.showAlert('error', `Error al completar el check-in: ${err?.error?.message || err?.message || 'Verifica la conexión'}`);
            }
          });
        },
        error: (err) => {
          this.audioService.playWarning();
          this.showAlert('error', `Error al generar pase en caseta: ${err?.error?.message || err?.message || 'Verifica la conexión'}`);
        }
      });
    }
  }

  // ─── Helpers de Rampa Homologados con Admin Console ─────────────────────────
  protected hasRampAssigned(item: YardVehicle): boolean {
    return item.rampNumber != null && Number(item.rampNumber) > 0;
  }

  protected formatRampDisplay(item: YardVehicle): string {
    if (item.rampNumber != null && Number(item.rampNumber) > 0) {
      const num = Number(item.rampNumber);
      return `Andén R-${num < 10 ? '0' + num : num}`;
    }
    return 'Por Asignar en Almacén';
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
      medidasCaja: vehicle.boxDimensions || '',
      noSello: this.formatSealDisplay(vehicle.exitSealNumbers || vehicle.sealNumbers),
      tipoTransporte: vehicle.transportType || '',

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
    const formattedExitTime = this.formatTimeStringFromDate(exitTime);
    const observations = this.checkoutObservations().trim() || 'Salida en orden y autorizada por caseta';
    const notes = this.checkoutNotes().trim();

    const checkoutBody = {
      departureTime: formattedExitTime,
      exitObservations: observations,
      exitSealNumbers: [inputSeal],
      guardNotes: notes
    };

    const token = vehicle.token;
    const executeLocalCheckout = () => {
      vehicle.departureTime = exitTime;
      vehicle.status = 'COMPLETED_EXIT';
      vehicle.exitSealNumbers = [inputSeal];
      vehicle.exitObservations = observations;
      vehicle.guardNotes = notes;

      if (!vehicle.sealNumbers.includes(inputSeal)) {
        vehicle.sealNumbers = [inputSeal, ...vehicle.sealNumbers.filter(s => s !== 'PENDIENTE_ANDEN')];
      }

      if (vehicle.rampNumber) {
        const freeRampNum = vehicle.rampNumber;
        this.rampOptions.update((ramps) =>
          ramps.map((r) => (r.num === freeRampNum ? { ...r, available: true, occupiedBy: undefined } : r))
        );
      }

      this.selectedVehicleForCheckout.set(null);
      this.audioService.playSuccess();

      if (navigator.vibrate) {
        navigator.vibrate([50, 80, 50]);
      }

      this.preparePrintDataFromVehicle(vehicle);
      this.showF01PrintModal.set(true);

      this.showAlert(
        'success',
        `🚪 Salida autorizada para ${vehicle.tractorPlates} a las ${formattedExitTime}. Registrado en Base de Datos. Formato F01 oficial generado.`
      );

      this.loadBackendData(false);
    };

    if (token) {
      this.apiService.checkOut(token, checkoutBody).subscribe({
        next: () => {
          executeLocalCheckout();
        },
        error: (err) => {
          this.audioService.playWarning();
          this.showAlert('error', `Error al registrar salida en servidor: ${err?.error?.message || err?.message || 'Verifica la conexión'}`);
        }
      });
    } else {
      executeLocalCheckout();
    }
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

  protected isSealPendingDock(seals?: string[] | null): boolean {
    if (!seals || seals.length === 0) return false;
    return seals.some((s) => s === 'PENDIENTE_ANDEN') && !seals.some((s) => s && s !== 'PENDIENTE_ANDEN');
  }

  protected formatSealDisplay(seals?: string[] | null): string {
    if (!seals || seals.length === 0) return 'Sin sellos';
    const valid = seals.filter((s) => s && s !== 'PENDIENTE_ANDEN' && s !== 'SIN_SELLOS' && s !== 'SIN_SELLO');
    if (valid.length > 0) {
      return valid.join(', ');
    }
    if (seals.some((s) => s === 'PENDIENTE_ANDEN')) {
      return 'Pendiente en andén';
    }
    return 'Sin sellos';
  }

  protected getStatusLabel(status: YardVehicle['status'], opType?: 'INBOUND' | 'OUTBOUND'): string {
    switch (status) {
      case 'WAITING_RAMP':
        return 'En Espera de Rampa';
      case 'AT_RAMP':
        return 'En Andén / Maniobra';
      case 'DISCHARGE_FINISHED':
        return opType === 'OUTBOUND' ? 'Carga Finalizada' : 'Descarga Finalizada';
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

  // ─── Modal de Confirmación para Rechazar / Eliminar Solicitud de Chofer ────
  protected readonly passToReject = signal<DriverSubmittedPass | null>(null);
  protected readonly isRejectingPass = signal<boolean>(false);

  protected openRejectPassModal(pass: DriverSubmittedPass, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.passToReject.set(pass);
  }

  protected closeRejectPassModal(): void {
    if (this.isRejectingPass()) return;
    this.passToReject.set(null);
  }

  protected confirmRejectPass(): void {
    const pass = this.passToReject();
    if (!pass) return;

    this.isRejectingPass.set(true);

    const finishDismissal = () => {
      // 1. Quitar de notificaciones reactivas (y persistir en descartados)
      this.notifService.dismissDriverPass(pass.token);

      // 2. Quitar del listado local de pases activos
      this.activePasses.update(list => list.filter(p => p.token !== pass.token && p.id !== pass.id));

      // 3. Si estaba cargado en el formulario, limpiar la vinculación
      if (this.activeLoadedToken() === pass.token) {
        this.clearLoadedPass();
      }

      this.isRejectingPass.set(false);
      this.passToReject.set(null);
      this.audioService.playSuccess();
      this.showAlert('warning', `Solicitud de chofer #${pass.token} (${pass.driverName}) ha sido rechazada y eliminada de la caseta.`);
    };

    // Si el ID parece UUID válido del backend, enviar delete al backend
    if (pass.id && pass.id.length === 36 && !pass.id.startsWith('PASS-')) {
      this.apiService.deletePass(pass.id).subscribe({
        next: () => finishDismissal(),
        error: () => finishDismissal()
      });
    } else {
      finishDismissal();
    }
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
