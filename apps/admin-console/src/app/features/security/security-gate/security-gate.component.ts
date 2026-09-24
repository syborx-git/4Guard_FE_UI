/**
 * @file security-gate.component.ts
 * @description Centro de Control de Vigilancia y Caseta de Seguridad — 4GUARD WMS.
 *
 * Arquitectura Integral (Homologada a ADR-015, ADR-017 y ADR-018):
 * - Gestión Multi-Pestaña: 📋 Nuevo Registro/Pases QR, 🚛 Unidades en Planta, 🏁 Salidas (Check-Out), 🗄️ Historial & Auditoría.
 * - Formato Oficial Físico F01-PO-CP-7.1.3-03 replicado con PrintService e impresión directa/descarga PDF.
 * - Ciclo de salida con registro de Hora de Salida, sellos finales y auditoría.
 * - Campos de observaciones vacíos por defecto para llenado manual.
 */

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { QrSimulatorCardComponent } from './qr-simulator-card/qr-simulator-card.component';
import { WarehouseMovementsService } from '../../warehouse-movements/services/warehouse-movements.service';
import { CheckInCasetaData, RampItem } from '../../warehouse-movements/models/warehouse-movements.models';
import { PrintService } from '../../../core/services/print.service';
import {
  PrintTransportChecklistLayoutComponent,
  TransportChecklistPrintData
} from '../../warehouse-movements/components/print-layouts/print-transport-checklist-layout.component';

export type SecurityGateTab = 'REGISTRATION' | 'IN_YARD' | 'HISTORY';

@Component({
  selector: 'fg-security-gate',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    QrSimulatorCardComponent,
    PrintTransportChecklistLayoutComponent
  ],
  templateUrl: './security-gate.component.html',
  styleUrl: './security-gate.component.css',
})
export class SecurityGateComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly printService = inject(PrintService);
  private readonly router = inject(Router);
  private refreshIntervalId: any = null;

  // ── Navegación por Pestañas ───────────────────────────────────────────────
  protected readonly activeTab = signal<SecurityGateTab>('REGISTRATION');

  // ── Catálogos desde WarehouseMovementsService ──────────────────────────────
  protected readonly carrierLines      = this.movementsService.carrierLines;
  protected readonly clients           = this.movementsService.clients;
  protected readonly ramps             = this.movementsService.ramps;
  protected readonly forkliftOperators = this.movementsService.forkliftOperators;
  protected readonly rampOccupancy     = this.movementsService.rampOccupancyStatus;

  // ── Signals de Estado Local ────────────────────────────────────────────────
  protected readonly sealList           = signal<string[]>([]);
  protected readonly tempSealInput      = signal<string>('');
  protected readonly scanSuccessMessage = signal<string | null>(null);
  protected readonly isSaving           = signal<boolean>(false);
  protected readonly saveSuccess        = signal<boolean>(false);
  protected readonly createdFolio       = signal<string | null>(null);
  protected readonly assignedRampLabel  = signal<string | null>(null);
  protected readonly errorMessage       = signal<string | null>(null);
  protected readonly lastCompletedPrintItem = signal<any | null>(null);
  protected readonly showQrModal        = signal<boolean>(false);
  protected readonly showPassListModal  = signal<boolean>(false);

  // ── Catálogos Flexibles de Tipos de Transporte y Medidas ──
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
    'Camioneta / Van',
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
  protected readonly isCustomBoxDimension = signal<boolean>(false);
  protected readonly customTransportInput = signal<string>('');
  protected readonly customBoxDimensionInput = signal<string>('');

  // ── Pases QR Dinámicos y Choferes en Espera ──
  protected readonly activePasses       = signal<any[]>([]);
  protected readonly inYardPasses       = signal<any[]>([]);
  protected readonly historyPasses      = signal<any[]>([]);
  protected readonly historySearch      = signal<string>('');
  protected readonly isLoadingHistory   = signal<boolean>(false);
  protected readonly isLoadingInYard    = signal<boolean>(false);

  protected readonly activeToken        = signal<string | null>(null);
  protected readonly qrModalToken       = signal<string>('PASS-4G-2026');
  protected readonly qrModalUrl         = signal<string>('');
  protected readonly isGeneratingPass   = signal<boolean>(false);
  protected readonly copyNotice         = signal<string | null>(null);
  protected readonly passActionNotice   = signal<string | null>(null);

  // ── Check-Out (Salida de Planta) ──
  protected readonly showCheckOutModal       = signal<boolean>(false);
  protected readonly selectedCheckOutPass    = signal<any | null>(null);
  protected readonly isCheckingOut           = signal<boolean>(false);
  protected readonly checkOutSuccessNotice   = signal<string | null>(null);

  // ── Formato F01 Impresión y Descarga ──
  protected readonly showF01PrintModal       = signal<boolean>(false);
  protected readonly currentPrintData        = signal<TransportChecklistPrintData | null>(null);

  // ── Formulario de Check-Out ──
  protected readonly checkOutForm: FormGroup = this.fb.group({
    departureTime: [this.getCurrentTimeString(), Validators.required],
    exitSealNumbers: [''],
    exitObservations: [''],
    guardNotes: ['']
  });

  // ── Formulario Reactivo F01 (con observaciones vacías por defecto) ─────────
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
    medidasCaja: ['', Validators.required],
    noSello: [''],
    tipoTransporte: ['', Validators.required],

    // 3. REVISIÓN DEL TRANSPORTE — EPP (Observaciones en blanco por defecto)
    eppZapatos: ['SI', Validators.required],
    eppZapatosObs: [''],
    eppCofia: ['SI', Validators.required],
    eppCofiaObs: [''],
    eppCubrebocas: ['SI', Validators.required],
    eppCubrebocasObs: [''],
    eppChaleco: ['SI', Validators.required],
    eppChalecoObs: [''],

    // 3. REVISIÓN DEL TRANSPORTE — Documentos
    docCartaPorte: ['SI', Validators.required],
    docCartaPorteObs: [''],
    docRemision: ['SI', Validators.required],
    docRemisionObs: [''],

    // 4. REVISIÓN DE LA UNIDAD
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

    // 5. FIRMAS Y RESPONSABLES
    responsableVigilanciaNombre: ['Guardia de Turno - Caseta Principal', Validators.required],
    responsableVigilanciaFirma: [true, Validators.requiredTrue],
    transportistaNombre: ['', Validators.required],
    transportistaFirma: [false, Validators.requiredTrue]
  });

  // ── Conteo Computado de Pestañas & Filtros de Patio ───────────────────────
  protected readonly inYardFilter = signal<'ALL' | 'IN_MANEUVER' | 'READY_EXIT'>('ALL');
  protected readonly inYardSearch = signal<string>('');

  protected readonly pendingDriverCount = computed(() => {
    return this.activePasses().filter(p => p.status === 'SUBMITTED' || p.status === 'PENDING_DRIVER').length;
  });

  protected readonly inYardCount = computed(() => {
    return this.inYardPasses().length;
  });

  protected readonly inManeuverCount = computed(() => {
    return this.inYardPasses().filter(p => !p.isReadyForExit).length;
  });

  protected readonly readyForExitCount = computed(() => {
    return this.inYardPasses().filter(p => p.isReadyForExit === true).length;
  });

  protected readonly completedShiftExitsCount = computed(() => {
    return this.historyPasses().length;
  });

  protected calculateDuration(inTime: any, outTime: any): string {
    const cleanIn = this.formatTimeString(inTime);
    const cleanOut = this.formatTimeString(outTime);
    if (!cleanIn || cleanIn === '--:--' || !cleanOut || cleanOut === '--:--') return '--';

    const inParts = cleanIn.split(':').map(Number);
    const outParts = cleanOut.split(':').map(Number);
    if (inParts.length < 2 || outParts.length < 2) return '--';
    if (isNaN(inParts[0]) || isNaN(inParts[1]) || isNaN(outParts[0]) || isNaN(outParts[1])) return '--';

    let diffMins = (outParts[0] * 60 + outParts[1]) - (inParts[0] * 60 + inParts[1]);
    if (diffMins < 0) diffMins += 24 * 60;

    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hrs === 0) return `${mins} min`;
    return `${hrs}h ${mins}m`;
  }

  protected readonly filteredInYardPasses = computed(() => {
    let list = this.inYardPasses();
    const filter = this.inYardFilter();
    const search = this.inYardSearch().trim().toLowerCase();

    if (filter === 'IN_MANEUVER') {
      list = list.filter(p => !p.isReadyForExit);
    } else if (filter === 'READY_EXIT') {
      list = list.filter(p => p.isReadyForExit === true);
    }

    if (search) {
      list = list.filter(p =>
        (p.generatedFolio && p.generatedFolio.toLowerCase().includes(search)) ||
        (p.token && p.token.toLowerCase().includes(search)) ||
        (p.carrierLine && p.carrierLine.toLowerCase().includes(search)) ||
        (p.driverName && p.driverName.toLowerCase().includes(search)) ||
        (p.tractorPlates && p.tractorPlates.toLowerCase().includes(search)) ||
        (p.boxPlates && p.boxPlates.toLowerCase().includes(search)) ||
        (p.rampCode && p.rampCode.toLowerCase().includes(search))
      );
    }

    return list;
  });

  ngOnInit(): void {
    this.movementsService.loadInitialBackendData();
    this.movementsService.reloadCarriers();
    this.loadPublicCatalogs();
    this.reloadAllData();

    // Auto-refresco en tiempo real de choferes en espera y unidades en patio
    this.refreshIntervalId = setInterval(() => {
      if (this.activeTab() === 'REGISTRATION') {
        this.reloadActivePasses();
      } else if (this.activeTab() === 'IN_YARD') {
        this.reloadInYardPasses();
      }
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  protected loadPublicCatalogs(): void {
    this.movementsService.movementsApi.getPublicCatalogs().subscribe({
      next: (data) => {
        if (data) {
          if (data.transportTypes && data.transportTypes.length > 0) {
            this.transportTypesList.set(data.transportTypes);
          }
          if (data.boxDimensions && data.boxDimensions.length > 0) {
            this.boxDimensionsList.set(data.boxDimensions);
          }
        }
      },
      error: () => {}
    });
  }

  // ── Cambio de Pestaña ─────────────────────────────────────────────────────
  protected setTab(tab: SecurityGateTab): void {
    this.activeTab.set(tab);
    if (tab === 'IN_YARD') {
      this.reloadInYardPasses();
    } else if (tab === 'HISTORY') {
      this.reloadHistoryPasses();
    } else {
      this.reloadActivePasses();
    }
  }

  protected reloadAllData(): void {
    this.reloadActivePasses();
    this.reloadInYardPasses();
    this.reloadHistoryPasses();
  }

  // ── REGLA DE NEGOCIO DINÁMICA: CARGA vs DESCARGA ───────────────────────────
  protected onOperationChange(val: 'CARGA' | 'DESCARGA'): void {
    this.checkInForm.patchValue({ operacion: val });

    const cartaControl = this.checkInForm.get('noCartaPorte');
    const remisionControl = this.checkInForm.get('remision');

    if (val === 'CARGA') {
      cartaControl?.setValidators([Validators.required]);
      remisionControl?.clearValidators();
      this.checkInForm.patchValue({ procedimiento: 'Embarque' });
    } else {
      remisionControl?.setValidators([Validators.required]);
      cartaControl?.clearValidators();
      this.checkInForm.patchValue({ procedimiento: 'Recepción' });
    }

    cartaControl?.updateValueAndValidity();
    remisionControl?.updateValueAndValidity();
  }

  protected getQrBaseUrl(): string {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      // En desarrollo local (localhost), Safari en el celular no puede resolver 'localhost'.
      // Apuntamos automáticamente al dominio desplegado de Netlify/Cloudify para pruebas con el smartphone.
      return 'https://guard.netlify.app';
    }
    return origin;
  }

  // ── GENERACIÓN DE PASE QR DINÁMICO PARA CHOFER ─────────────────────────────
  protected generateDriverPass(): void {
    this.isGeneratingPass.set(true);
    const session = this.movementsService.movementsApi.getSessionOrg();
    const formVal = this.checkInForm.value;

    const payload = {
      organizationId: session.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
      branchId: session.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
      operationType: formVal.operacion || 'DESCARGA',
      clientCode: formVal.clientCode,
      clientName: formVal.client,
      carrierLineCode: formVal.carrierLineCode,
      carrierLine: formVal.carrierLine,
      driverName: formVal.nombreOperador,
      tractorPlates: formVal.placasTracto,
      docNumber: formVal.operacion === 'CARGA' ? formVal.noCartaPorte : formVal.remision,
    };

    this.movementsService.movementsApi.generatePass(payload).subscribe({
      next: (res: any) => {
        this.isGeneratingPass.set(false);
        const token = res.token || ('PASS-' + Date.now());
        this.qrModalToken.set(token);
        const baseUrl = this.getQrBaseUrl();
        this.qrModalUrl.set(`${baseUrl}/carrier-checkin?token=${token}`);
        this.showQrModal.set(true);
        this.reloadActivePasses();
      },
      error: () => {
        this.isGeneratingPass.set(false);
        const fallbackToken = 'PASS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        this.qrModalToken.set(fallbackToken);
        const baseUrl = this.getQrBaseUrl();
        this.qrModalUrl.set(`${baseUrl}/carrier-checkin?token=${fallbackToken}`);
        this.showQrModal.set(true);
      }
    });
  }

  protected copyQrUrl(): void {
    if (this.qrModalUrl()) {
      navigator.clipboard.writeText(this.qrModalUrl()).then(() => {
        this.copyNotice.set('¡Enlace copiado al portapapeles!');
        setTimeout(() => this.copyNotice.set(null), 3000);
      });
    }
  }

  protected openDriverPortalInNewTab(): void {
    if (this.qrModalUrl()) {
      window.open(this.qrModalUrl(), '_blank');
    }
  }

  protected reloadActivePasses(): void {
    const session = this.movementsService.movementsApi.getSessionOrg();
    this.movementsService.movementsApi.getActivePasses({ organizationId: session.organizationId, branchId: session.branchId }).subscribe({
      next: (passes) => {
        this.activePasses.set(passes || []);
      },
      error: () => {}
    });
  }

  protected reloadInYardPasses(): void {
    this.isLoadingInYard.set(true);
    const session = this.movementsService.movementsApi.getSessionOrg();
    this.movementsService.movementsApi.getInYardPasses({ organizationId: session.organizationId, branchId: session.branchId }).subscribe({
      next: (passes) => {
        this.isLoadingInYard.set(false);
        this.inYardPasses.set(passes || []);
      },
      error: () => {
        this.isLoadingInYard.set(false);
      }
    });
  }

  protected reloadHistoryPasses(): void {
    this.isLoadingHistory.set(true);
    const session = this.movementsService.movementsApi.getSessionOrg();
    this.movementsService.movementsApi.getPassHistory({
      organizationId: session.organizationId,
      branchId: session.branchId,
      search: this.historySearch()
    }).subscribe({
      next: (passes) => {
        this.isLoadingHistory.set(false);
        const exitOnly = (passes || []).filter(p => p.status === 'COMPLETED_EXIT');
        this.historyPasses.set(exitOnly);
      },
      error: () => {
        this.isLoadingHistory.set(false);
      }
    });
  }

  protected loadDriverSubmission(pass: any): void {
    if (!pass) return;
    this.activeToken.set(pass.token);

    if (pass.operationType) {
      this.onOperationChange(pass.operationType as 'CARGA' | 'DESCARGA');
    }

    // Resolver Cliente en el catálogo
    let matchedClientCode = pass.clientCode || '';
    let matchedClientName = pass.clientName || '';
    const foundClient = this.clients().find(c => 
      (pass.clientCode && (c.code === pass.clientCode || c.code.toLowerCase() === pass.clientCode.toLowerCase())) ||
      (pass.clientName && c.name.toLowerCase() === pass.clientName.toLowerCase())
    );
    if (foundClient) {
      matchedClientCode = foundClient.code;
      matchedClientName = foundClient.name;
    } else if (!matchedClientCode && this.clients().length > 0) {
      matchedClientCode = this.clients()[0].code;
      matchedClientName = this.clients()[0].name;
    }

    // Resolver Línea Transportista en el catálogo
    let matchedCarrierCode = pass.carrierLineCode || '';
    let matchedCarrierName = pass.carrierLine || '';
    const foundCarrier = this.carrierLines().find(c =>
      (pass.carrierLineCode && (c.code === pass.carrierLineCode || c.code.toLowerCase() === pass.carrierLineCode.toLowerCase())) ||
      (pass.carrierLine && c.name.toLowerCase() === pass.carrierLine.toLowerCase())
    );
    if (foundCarrier) {
      matchedCarrierCode = foundCarrier.code;
      matchedCarrierName = foundCarrier.name;
    } else if (!matchedCarrierCode && this.carrierLines().length > 0) {
      matchedCarrierCode = this.carrierLines()[0].code;
      matchedCarrierName = this.carrierLines()[0].name;
    }

    // Resolver Tipo de Transporte y Medidas
    if (pass.transportType && !this.transportTypesList().includes(pass.transportType)) {
      this.transportTypesList.update(list => [...list.filter(x => x !== 'Otro (Especificar)'), pass.transportType, 'Otro (Especificar)']);
    }
    if (pass.boxDimensions && !this.boxDimensionsList().includes(pass.boxDimensions)) {
      this.boxDimensionsList.update(list => [...list.filter(x => x !== 'Otra Medida'), pass.boxDimensions, 'Otra Medida']);
    }

    this.checkInForm.patchValue({
      clientCode: matchedClientCode,
      client: matchedClientName,
      carrierLineCode: matchedCarrierCode,
      carrierLine: matchedCarrierName,
      nombreOperador: pass.driverName || '',
      placasTracto: pass.tractorPlates || '',
      noEcoTractor: pass.economicNumber || pass.noEcoTractor || 'ECO-01',
      placasCaja: pass.boxPlates || '',
      medidasCaja: pass.boxDimensions || '53 Pies',
      tipoTransporte: pass.transportType || 'Caja Seca',
      transportistaNombre: pass.driverName || '',
      transportistaFirma: true,
    });

    if (pass.docNumber) {
      if (pass.operationType === 'CARGA') {
        this.checkInForm.patchValue({ noCartaPorte: pass.docNumber });
      } else {
        this.checkInForm.patchValue({ remision: pass.docNumber });
      }
    }

    if (pass.sealNumbers && Array.isArray(pass.sealNumbers) && pass.sealNumbers.length > 0) {
      this.sealList.set(pass.sealNumbers);
    }

    if (pass.checklistData) {
      try {
        const parsed = typeof pass.checklistData === 'string' ? JSON.parse(pass.checklistData) : pass.checklistData;
        if (parsed?.epp) {
          if (parsed.epp.zapatos) this.checkInForm.patchValue({ eppZapatos: parsed.epp.zapatos });
          if (parsed.epp.cofia) this.checkInForm.patchValue({ eppCofia: parsed.epp.cofia });
          if (parsed.epp.cubrebocas) this.checkInForm.patchValue({ eppCubrebocas: parsed.epp.cubrebocas });
          if (parsed.epp.chaleco) this.checkInForm.patchValue({ eppChaleco: parsed.epp.chaleco });
        }
        if (parsed?.caja) {
          if (parsed.caja.interior) this.checkInForm.patchValue({ revInteriorCaja: parsed.caja.interior });
          if (parsed.caja.danos) this.checkInForm.patchValue({ revDanosCaja: parsed.caja.danos });
          if (parsed.caja.puertas) this.checkInForm.patchValue({ revDanosPuertas: parsed.caja.puertas });
          if (parsed.caja.olores) this.checkInForm.patchValue({ revOloresExtranos: parsed.caja.olores });
          if (parsed.caja.plagas) this.checkInForm.patchValue({ revIndiciosPlagas: parsed.caja.plagas });
        }
      } catch {}
    }

    this.showPassListModal.set(false);
    this.scanSuccessMessage.set(`¡Datos del Pase #${pass.token} cargados! Chofer: ${pass.driverName || 'S/N'}, Placas: ${pass.tractorPlates || 'S/P'}.`);
    setTimeout(() => this.scanSuccessMessage.set(null), 6000);
  }

  // ── MÉTODOS DEL MODAL DE QR DE PRUEBA ─────────────────────────────────────
  protected openPassQr(pass: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!pass || !pass.token) return;
    this.qrModalToken.set(pass.token);
    this.qrModalUrl.set(`${this.getQrBaseUrl()}/carrier-checkin?token=${pass.token}`);
    this.showQrModal.set(true);
  }

  protected openQrModal(): void {
    // Si ya existe un pase PENDING_DRIVER activo, reutilizarlo para no generar pases huérfanos
    const existingPending = this.activePasses().find(p => p.status === 'PENDING_DRIVER');
    if (existingPending) {
      this.qrModalToken.set(existingPending.token);
      this.qrModalUrl.set(`${this.getQrBaseUrl()}/carrier-checkin?token=${existingPending.token}`);
      this.showQrModal.set(true);
    } else if (!this.qrModalUrl()) {
      this.generateDriverPass();
    } else {
      this.showQrModal.set(true);
    }
  }

  protected generateNewDriverPass(): void {
    this.generateDriverPass();
  }

  protected closeQrModal(): void {
    this.showQrModal.set(false);
  }

  protected discardCurrentQrPass(): void {
    const currentToken = this.qrModalToken();
    const found = this.activePasses().find(p => p.token === currentToken);
    if (found) {
      this.deleteDriverPass(found);
    }
    this.qrModalUrl.set('');
    this.qrModalToken.set('');
    this.closeQrModal();
  }

  protected deleteDriverPass(pass: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (!pass) return;

    const passId = pass.id;
    const passToken = pass.token;

    if (passId) {
      this.movementsService.movementsApi.deletePass(passId).subscribe({
        next: () => {
          this.activePasses.update(list => list.filter(p => p.id !== passId && p.token !== passToken));
          if (this.qrModalToken() === passToken) {
            this.qrModalUrl.set('');
            this.qrModalToken.set('');
          }
          this.passActionNotice.set(`Pase #${passToken} descartado correctamente.`);
          setTimeout(() => this.passActionNotice.set(null), 4000);
        },
        error: (err) => {
          console.error('Error al descartar pase:', err);
          // Actualizar en memoria por fallback
          this.activePasses.update(list => list.filter(p => p.id !== passId && p.token !== passToken));
          this.passActionNotice.set(`Pase #${passToken} removido.`);
          setTimeout(() => this.passActionNotice.set(null), 4000);
        }
      });
    } else {
      this.activePasses.update(list => list.filter(p => p.token !== passToken));
    }
  }

  // ── CHECK-OUT / SALIDA DE CASETA ──────────────────────────────────────────
  protected openCheckOutModal(pass: any): void {
    if (!pass) return;
    if (!pass.isReadyForExit) {
      alert('Esta unidad aún se encuentra en proceso de maniobra/descarga en almacén. Requiere que el Líder de Almacén autorice y finalice la recepción (F01) antes de proceder con el Check-Out.');
      return;
    }
    this.selectedCheckOutPass.set(pass);
    this.checkOutForm.reset({
      departureTime: this.getCurrentTimeString(),
      exitSealNumbers: pass.sealNumbers?.join(', ') || '',
      exitObservations: '',
      guardNotes: ''
    });
    this.showCheckOutModal.set(true);
  }

  protected closeCheckOutModal(): void {
    this.showCheckOutModal.set(false);
    this.selectedCheckOutPass.set(null);
  }

  protected confirmCheckOut(): void {
    const pass = this.selectedCheckOutPass();
    if (!pass) return;

    this.isCheckingOut.set(true);
    const formVal = this.checkOutForm.value;

    const exitSeals: string[] = formVal.exitSealNumbers
      ? formVal.exitSealNumbers.split(',').map((s: string) => s.trim().toUpperCase()).filter((s: string) => s.length > 0)
      : [];

    const payload = {
      departureTime: formVal.departureTime || this.getCurrentTimeString(),
      exitObservations: formVal.exitObservations || 'Salida en orden y autorizada por caseta',
      exitSealNumbers: exitSeals,
      guardNotes: formVal.guardNotes
    };

    const token = pass.token || pass.generatedFolio;
    this.movementsService.movementsApi.checkOutPass(token, payload).subscribe({
      next: (res) => {
        this.isCheckingOut.set(false);
        this.closeCheckOutModal();
        this.reloadAllData();
        this.checkOutSuccessNotice.set(`¡Salida de unidad (${pass.tractorPlates || pass.driverName}) registrada con éxito a las ${payload.departureTime}!`);
        setTimeout(() => this.checkOutSuccessNotice.set(null), 6000);

        // Abrir inmediatamente la vista de impresión del Formato F01
        this.openF01Print(res || pass);
      },
      error: (err) => {
        this.isCheckingOut.set(false);
        alert(err?.error?.message || 'Error al procesar la salida en el servidor.');
      }
    });
  }

  // ── IMPRESIÓN Y DESCARGA FORMATO F01 ──────────────────────────────────────
  protected openF01Print(item: any): void {
    if (!item) return;

    const formVal = this.checkInForm.value;

    let epp: any = {};
    let caja: any = {};
    if (item.checklistData) {
      try {
        const parsed = typeof item.checklistData === 'string' ? JSON.parse(item.checklistData) : item.checklistData;
        epp = parsed.epp || {};
        caja = parsed.caja || {};
      } catch {}
    }

    const op = item.operacion || item.operationType || formVal.operacion || 'DESCARGA';
    const docNo = item.remision || item.noCartaPorte || item.docNumber || (op === 'CARGA' ? formVal.noCartaPorte : formVal.remision) || '';
    const tractor = item.placasTracto || item.tractorPlates || formVal.placasTracto || '-';
    const box = item.placasCaja || item.boxPlates || formVal.placasCaja || '-';
    const driver = item.nombreOperador || item.driverName || item.transportistaNombre || formVal.nombreOperador || formVal.transportistaNombre || 'OPERADOR CHOFER';
    const carrier = item.carrierLine || item.carrierLineCode || formVal.carrierLine || 'TRANSPORTE GENERAL';
    const client = item.client || item.clientName || formVal.client || 'CLIENTE GENERAL';
    const eco = item.noEcoTractor || item.economicNumber || formVal.noEcoTractor || '-';
    const dimensions = item.medidasCaja || item.boxDimensions || formVal.medidasCaja || '53 Pies';
    const transType = item.tipoTransporte || item.transportType || formVal.tipoTransporte || 'Caja Seca';
    const ramp = item.rampCode || (item.rampNumber ? `R-${item.rampNumber}` : (formVal.rampCode || (formVal.rampNumber ? `R-${formVal.rampNumber}` : 'R-01')));
    const dateVal = item.fecha || item.docDate ? String(item.fecha || item.docDate) : this.getCurrentDateString();
    const inTime = this.formatTimeString(item.horaEntrada || item.receptionTime || this.getCurrentTimeString());
    const outTime = this.formatTimeString(item.horaSalida || item.departureTime || '');

    let sealsString = '-';
    if (item.sealNumbers && (Array.isArray(item.sealNumbers) ? item.sealNumbers.length > 0 : String(item.sealNumbers).trim().length > 0)) {
      sealsString = Array.isArray(item.sealNumbers) ? item.sealNumbers.join(', ') : String(item.sealNumbers);
    } else if (this.sealList().length > 0) {
      sealsString = this.sealList().join(', ');
    } else if (item.noSello || formVal.noSello) {
      sealsString = item.noSello || formVal.noSello;
    }

    const printData: TransportChecklistPrintData = {
      controlNumber: 'F01-PO-CP-7.1.3-03',
      revisionNumber: '01',
      revisionDate: '19/08/2025',
      emissionDate: '19/08/2025',
      processOwner: 'Seguridad Patrimonial',
      elaboratedBy: 'SP',
      reviewedBy: 'CG',
      approvedBy: 'DG',

      fecha: dateVal,
      noCartaPorte: op === 'CARGA' ? docNo : (item.noCartaPorte || formVal.noCartaPorte || ''),
      remision: op === 'DESCARGA' ? docNo : (item.remision || formVal.remision || ''),
      cliente: client,
      procedimiento: op === 'CARGA' ? 'Embarque' : 'Recepción',
      operacion: op as 'CARGA' | 'DESCARGA',
      horaEntrada: inTime,
      horaSalida: outTime,

      lineaTransporte: carrier,
      nombreOperador: driver,
      noRampa: ramp,
      placasTracto: tractor,
      noEcoTractor: eco,
      placasCaja: box,
      medidasCaja: dimensions,
      noSello: sealsString,
      tipoTransporte: transType,

      eppZapatos: epp.zapatos || item.eppZapatos || formVal.eppZapatos || 'SI',
      eppZapatosObs: item.eppZapatosObs || formVal.eppZapatosObs || '',
      eppCofia: epp.cofia || item.eppCofia || formVal.eppCofia || 'SI',
      eppCofiaObs: item.eppCofiaObs || formVal.eppCofiaObs || '',
      eppCubrebocas: epp.cubrebocas || item.eppCubrebocas || formVal.eppCubrebocas || 'SI',
      eppCubrebocasObs: item.eppCubrebocasObs || formVal.eppCubrebocasObs || '',
      eppChaleco: epp.chaleco || item.eppChaleco || formVal.eppChaleco || 'SI',
      eppChalecoObs: item.eppChalecoObs || formVal.eppChalecoObs || '',

      docCartaPorte: item.docCartaPorte || formVal.docCartaPorte || 'SI',
      docCartaPorteObs: item.docCartaPorteObs || formVal.docCartaPorteObs || '',
      docRemision: item.docRemision || formVal.docRemision || 'SI',
      docRemisionObs: item.docRemisionObs || formVal.docRemisionObs || '',

      revInteriorCaja: caja.interior || item.revInteriorCaja || formVal.revInteriorCaja || 'SI',
      revInteriorCajaObs: item.revInteriorCajaObs || formVal.revInteriorCajaObs || '',
      revDanosCaja: caja.danos || item.revDanosCaja || formVal.revDanosCaja || 'NO',
      revDanosCajaObs: item.revDanosCajaObs || formVal.revDanosCajaObs || '',
      revDanosPuertas: caja.puertas || item.revDanosPuertas || formVal.revDanosPuertas || 'NO',
      revDanosPuertasObs: item.revDanosPuertasObs || formVal.revDanosPuertasObs || '',
      revOloresExtranos: caja.olores || item.revOloresExtranos || formVal.revOloresExtranos || 'NO',
      revOloresExtranosObs: item.revOloresExtranosObs || formVal.revOloresExtranosObs || '',
      revIndiciosPlagas: caja.plagas || item.revIndiciosPlagas || formVal.revIndiciosPlagas || 'NO',
      revIndiciosPlagasObs: item.revIndiciosPlagasObs || formVal.revIndiciosPlagasObs || '',

      responsableVigilanciaNombre: item.responsableVigilanciaNombre || item.processedBy || formVal.responsableVigilanciaNombre || 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      transportistaNombre: item.transportistaNombre || item.driverName || item.nombreOperador || formVal.transportistaNombre || formVal.nombreOperador || 'Chofer Transportista',
      driverSignature: item.driverSignature,
      driverSignedAt: item.driverSignedAt ? String(item.driverSignedAt) : undefined,

      folio: item.generatedFolio || item.folio || this.createdFolio() || 'N/A',
      token: item.token || this.activeToken() || 'N/A'
    };

    this.currentPrintData.set(printData);
    this.showF01PrintModal.set(true);
  }

  protected closeF01Print(): void {
    this.showF01PrintModal.set(false);
  }

  protected printF01(): void {
    const data: TransportChecklistPrintData | null = this.currentPrintData();
    const folio = data?.folio || 'F01';
    this.printService.printElement('#f01-print-target', `Formato_F01_CheckList_${folio}`);
  }

  protected downloadF01Pdf(): void {
    const data: TransportChecklistPrintData | null = this.currentPrintData();
    const folio = data?.folio || 'F01';
    this.printService.downloadPdf('#f01-print-target', `Formato_F01_CheckList_${folio}.pdf`);
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

  protected onRampSelect(code: string): void {
    const found = this.ramps().find((r) => r.code === code);
    if (found) {
      this.checkInForm.patchValue({
        rampCode: found.code,
        rampNumber: found.rampNumber,
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

  protected setCriterion(controlName: string, val: 'SI' | 'NO'): void {
    this.checkInForm.patchValue({ [controlName]: val });
  }

  protected toggleSignature(controlName: string): void {
    const currentVal = this.checkInForm.get(controlName)?.value;
    this.checkInForm.patchValue({ [controlName]: !currentVal });
  }

  protected getRampDisplayLabel(rm: RampItem): string {
    const occ = this.rampOccupancy().find((r) => r.rampNumber === rm.rampNumber || r.code === rm.code);
    if (!occ || occ.status === 'AVAILABLE') {
      return `Rampa ${rm.rampNumber < 10 ? '0' + rm.rampNumber : rm.rampNumber} (Libre)`;
    }
    if (occ.status === 'OCCUPIED_INBOUND') {
      return `Rampa ${rm.rampNumber < 10 ? '0' + rm.rampNumber : rm.rampNumber} (Ocupada - Folio #${occ.operationFolio})`;
    }
    return `Rampa ${rm.rampNumber < 10 ? '0' + rm.rampNumber : rm.rampNumber} (Ocupada - Salida #${occ.operationFolio})`;
  }

  // ── SUBMIT FORMULARIO (CHECK-IN REAL DE CASETA) ─────────────────────────────
  protected submitCheckIn(): void {
    if (this.tempSealInput().trim()) {
      this.addSeal();
    }

    const formVal = this.checkInForm.value;
    const missing: string[] = [];

    if (!formVal.fecha) missing.push('Fecha');
    if (formVal.operacion === 'CARGA' && (!formVal.noCartaPorte || !formVal.noCartaPorte.trim())) {
      missing.push('Número de Carta Porte (Obligatorio en Carga)');
    }
    if (formVal.operacion === 'DESCARGA' && (!formVal.remision || !formVal.remision.trim())) {
      missing.push('Número de Remisión / Factura (Obligatorio en Descarga)');
    }
    if (!formVal.clientCode || !formVal.client) missing.push('Cliente Destinatario');
    if (!formVal.rampCode || !formVal.rampNumber) missing.push('Andén / Rampa Asignada');
    if (!formVal.carrierLineCode || !formVal.carrierLine) missing.push('Línea Transportista');
    if (!formVal.nombreOperador || !formVal.nombreOperador.trim()) missing.push('Nombre del Operador / Chofer');
    if (!formVal.placasTracto || !formVal.placasTracto.trim()) missing.push('Placas del Tracto');
    if (!formVal.noEcoTractor || !formVal.noEcoTractor.trim()) missing.push('No. Económico Tracto');
    if (!formVal.placasCaja || !formVal.placasCaja.trim()) missing.push('Placas de la Caja');
    if (!formVal.tipoTransporte || !formVal.tipoTransporte.trim()) missing.push('Tipo de Transporte');
    if (!formVal.medidasCaja || !formVal.medidasCaja.trim()) missing.push('Medidas de Caja');

    if (this.sealList().length === 0 && (!formVal.noSello || !formVal.noSello.trim())) {
      missing.push('Al menos 1 Número de Sello de Seguridad / Cincho (Obligatorio)');
    }

    if (missing.length > 0 || this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      this.errorMessage.set(`⚠️ No se puede registrar. Faltan los siguientes campos obligatorios: ${missing.join(', ')}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const seals: string[] = this.sealList().length > 0 
      ? [...this.sealList()] 
      : [formVal.noSello.trim().toUpperCase()];

    const inspectionObservations = [
      `[FORMATO F01-PO-CP-7.1.3-03] Arribo en Caseta de Seguridad`,
      `Unidad: Eco=${formVal.noEcoTractor || 'S/N'} | Tipo=${formVal.tipoTransporte || 'Caja Seca'} | Medidas=${formVal.medidasCaja || '53 Pies'}`,
      `EPP: Calzado=${formVal.eppZapatos} (${formVal.eppZapatosObs || 'OK'}), Cofia=${formVal.eppCofia}, Cubrebocas=${formVal.eppCubrebocas}, Chaleco=${formVal.eppChaleco}`,
      `Documentación: CartaPorte=${formVal.docCartaPorte} (${formVal.docCartaPorteObs || 'OK'}), Remisión=${formVal.docRemision} (${formVal.docRemisionObs || 'OK'})`,
      `Revisión Caja: Interior=${formVal.revInteriorCaja}, Daños=${formVal.revDanosCaja}, Puertas=${formVal.revDanosPuertas}, Olores=${formVal.revOloresExtranos}, Plagas=${formVal.revIndiciosPlagas}`,
      `Firmas: Vigilancia=${formVal.responsableVigilanciaNombre || 'Guardia'} | Chofer=${formVal.transportistaNombre || formVal.nombreOperador}`
    ].join(' | ');

    const checkInData: CheckInCasetaData = {
      carrierLineCode: formVal.carrierLineCode,
      carrierLine: formVal.carrierLine,
      receptionTime: formVal.horaEntrada,
      docNumber: formVal.operacion === 'DESCARGA' ? formVal.remision : (formVal.noCartaPorte || formVal.remision),
      docDate: formVal.fecha,
      clientCode: formVal.clientCode,
      client: formVal.client,
      rampCode: formVal.rampCode,
      rampNumber: Number(formVal.rampNumber) || 1,
      driverName: formVal.nombreOperador,
      tractorPlates: (formVal.placasTracto || '').toUpperCase(),
      boxPlates: (formVal.placasCaja || '').toUpperCase(),
      sealNumbers: seals,
      sealNumber: seals.join(', '),
      observations: inspectionObservations,
    };

    if (this.activeToken()) {
      // Flujo con Pase Digital QR / Pre-registro de chofer: Se completa atómicamente en el Backend
      const op = formVal.operacion || 'DESCARGA';
      const completePayload = {
        operationType: op,
        clientCode: formVal.clientCode,
        clientName: formVal.client,
        carrierLineCode: formVal.carrierLineCode,
        carrierLine: formVal.carrierLine,
        rampNumber: Number(formVal.rampNumber) || 1,
        rampCode: formVal.rampCode,
        driverName: formVal.nombreOperador,
        tractorPlates: (formVal.placasTracto || '').toUpperCase().trim(),
        boxPlates: (formVal.placasCaja || '').toUpperCase().trim(),
        noEcoTractor: formVal.noEcoTractor,
        transportType: formVal.tipoTransporte,
        boxDimensions: formVal.medidasCaja,
        docNumber: op === 'CARGA' ? formVal.noCartaPorte : formVal.remision,
        docDate: formVal.fecha,
        receptionTime: formVal.horaEntrada,
        sealNumbers: seals,
        observations: inspectionObservations,
        guardNotes: formVal.guardNotes
      };

      this.movementsService.movementsApi.completePassCheckin(this.activeToken()!, completePayload).subscribe({
        next: (passRes) => {
          this.isSaving.set(false);
          const folio = passRes?.generatedFolio || passRes?.folio || this.activeToken() || 'OK';
          this.createdFolio.set(folio);
          this.assignedRampLabel.set(formVal.rampCode || `R-${formVal.rampNumber}`);
          this.saveSuccess.set(true);

          const printSnapshot = {
            ...formVal,
            sealNumbers: [...seals],
            checklistData: inspectionObservations,
            generatedFolio: folio,
            folio: folio,
            rampCode: formVal.rampCode || `R-${formVal.rampNumber}`
          };
          this.lastCompletedPrintItem.set(printSnapshot);
          this.resetFormFieldsOnly();

          this.reloadAllData();
          this.movementsService.reloadReceptions();
          this.movementsService.reloadOutbounds();
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || err?.message || 'Error al completar el pase en el servidor';
          this.errorMessage.set(msg);
        }
      });
    } else {
      // Flujo de Registro Directo en Caseta (sin pase QR previo)
      if (formVal.operacion === 'CARGA') {
        this.movementsService.createOutboundCheckInBackend(checkInData).subscribe({
          next: (outbound) => {
            this.isSaving.set(false);
            this.createdFolio.set(outbound.folio);
            this.assignedRampLabel.set(formVal.rampCode || `R-${formVal.rampNumber}`);
            this.saveSuccess.set(true);

            const printSnapshot = {
              ...formVal,
              sealNumbers: [...seals],
              checklistData: inspectionObservations,
              generatedFolio: outbound.folio,
              folio: outbound.folio,
              rampCode: formVal.rampCode || `R-${formVal.rampNumber}`
            };
            this.lastCompletedPrintItem.set(printSnapshot);
            this.resetFormFieldsOnly();

            this.reloadAllData();
            this.movementsService.reloadOutbounds();
          },
          error: (err) => {
            this.isSaving.set(false);
            const msg = err?.error?.message || err?.message || 'Error al registrar la salida / carga en el servidor';
            this.errorMessage.set(msg);
          }
        });
      } else {
        this.movementsService.createCheckInBackend(checkInData).subscribe({
          next: (header) => {
            this.isSaving.set(false);
            this.createdFolio.set(header.folio);
            this.assignedRampLabel.set(formVal.rampCode || `R-${formVal.rampNumber}`);
            this.saveSuccess.set(true);

            const printSnapshot = {
              ...formVal,
              sealNumbers: [...seals],
              checklistData: inspectionObservations,
              generatedFolio: header.folio,
              folio: header.folio,
              rampCode: formVal.rampCode || `R-${formVal.rampNumber}`
            };
            this.lastCompletedPrintItem.set(printSnapshot);
            this.resetFormFieldsOnly();

            this.reloadAllData();
            this.movementsService.reloadReceptions();
          },
          error: (err) => {
            this.isSaving.set(false);
            const msg = err?.error?.message || err?.message || 'Error al registrar el check-in en el servidor';
            this.errorMessage.set(msg);
          }
        });
      }
    }
  }

  protected resetFormFieldsOnly(): void {
    const firstClient = this.clients()[0];
    const firstCarrier = this.carrierLines()[0];
    const firstRamp = this.ramps()[0];

    this.checkInForm.reset({
      controlNumber: 'F01-PO-CP-7.1.3-03',
      revisionNumber: '01',
      revisionDate: '19/08/2025',
      processOwner: 'Seguridad Patrimonial',
      fecha: this.getCurrentDateString(),
      noCartaPorte: '',
      remision: '',
      clientCode: firstClient ? firstClient.code : '',
      client: firstClient ? firstClient.name : '',
      procedimiento: 'Recepción',
      operacion: 'DESCARGA',
      horaEntrada: this.getCurrentTimeString(),
      horaSalida: '',
      carrierLineCode: firstCarrier ? firstCarrier.code : '',
      carrierLine: firstCarrier ? firstCarrier.name : '',
      nombreOperador: '',
      rampCode: firstRamp ? firstRamp.code : 'R-01',
      rampNumber: firstRamp ? firstRamp.rampNumber : 1,
      placasTracto: '',
      noEcoTractor: '',
      placasCaja: '',
      medidasCaja: '',
      noSello: '',
      tipoTransporte: '',
      eppZapatos: 'SI',
      eppZapatosObs: '',
      eppCofia: 'SI',
      eppCofiaObs: '',
      eppCubrebocas: 'SI',
      eppCubrebocasObs: '',
      eppChaleco: 'SI',
      eppChalecoObs: '',
      docCartaPorte: 'SI',
      docCartaPorteObs: '',
      docRemision: 'SI',
      docRemisionObs: '',
      revInteriorCaja: 'SI',
      revInteriorCajaObs: '',
      revDanosCaja: 'NO',
      revDanosCajaObs: '',
      revDanosPuertas: 'NO',
      revDanosPuertasObs: '',
      revOloresExtranos: 'NO',
      revOloresExtranosObs: '',
      revIndiciosPlagas: 'NO',
      revIndiciosPlagasObs: '',
      responsableVigilanciaNombre: 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      transportistaNombre: '',
      transportistaFirma: false
    });
    this.sealList.set([]);
    this.tempSealInput.set('');
    this.activeToken.set(null);
  }

  protected resetForm(): void {
    this.resetFormFieldsOnly();
    this.saveSuccess.set(false);
    this.createdFolio.set(null);
    this.assignedRampLabel.set(null);
    this.errorMessage.set(null);
    this.lastCompletedPrintItem.set(null);
  }

  // ── HELPERS FECHA Y HORA ───────────────────────────────────────────────────
  protected formatTimeString(val: any): string {
    if (!val) return '--:--';
    const str = String(val).trim();
    if (!str || str === '--:--' || str === 'null' || str === 'undefined') return '--:--';
    const withoutMillis = str.split('.')[0];
    if (withoutMillis.includes('T')) {
      return withoutMillis.split('T')[1];
    }
    return withoutMillis;
  }

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
