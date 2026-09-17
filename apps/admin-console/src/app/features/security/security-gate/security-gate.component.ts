/**
 * @file security-gate.component.ts
 * @description Componente principal del Módulo Independiente de Seguridad (Caseta de Seguridad) — 4GUARD WMS.
 *
 * Aislamiento Total (Regla de Oro):
 * - Componente 100% Autónomo (Standalone).
 * - No modifica ni afecta al módulo de Recepción existente.
 * - Integra la réplica visual del formulario de caseta y la tarjeta interactiva de Simulación de QR.
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { QrSimulatorCardComponent } from './qr-simulator-card/qr-simulator-card.component';
import { WarehouseMovementsService } from '../../warehouse-movements/services/warehouse-movements.service';
import { CheckInCasetaData, RampItem } from '../../warehouse-movements/models/warehouse-movements.models';

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
export class SecurityGateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly router = inject(Router);

  // ── Catálogos desde WarehouseMovementsService ──────────────────────────────
  protected readonly carrierLines      = this.movementsService.carrierLines;
  protected readonly clients           = this.movementsService.clients;
  protected readonly ramps             = this.movementsService.ramps;
  protected readonly forkliftOperators  = this.movementsService.forkliftOperators;
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
  protected readonly showQrModal        = signal<boolean>(false);
  protected readonly showPassListModal  = signal<boolean>(false);

  // ── Pases QR Dinámicos y Choferes en Espera ──
  protected readonly activePasses       = signal<any[]>([]);
  protected readonly activeToken        = signal<string | null>(null);
  protected readonly qrModalToken       = signal<string>('PASS-4G-2026');
  protected readonly qrModalUrl         = signal<string>('');
  protected readonly isGeneratingPass   = signal<boolean>(false);
  protected readonly copyNotice         = signal<string | null>(null);

  ngOnInit(): void {
    this.movementsService.loadInitialBackendData();
    this.movementsService.reloadCarriers();
    this.reloadActivePasses();
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
        const origin = window.location.origin;
        this.qrModalUrl.set(`${origin}/carrier-checkin?token=${token}`);
        this.showQrModal.set(true);
        this.reloadActivePasses();
      },
      error: () => {
        this.isGeneratingPass.set(false);
        const fallbackToken = 'PASS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        this.qrModalToken.set(fallbackToken);
        this.qrModalUrl.set(`${window.location.origin}/carrier-checkin?token=${fallbackToken}`);
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

  protected loadDriverSubmission(pass: any): void {
    if (!pass) return;
    this.activeToken.set(pass.token);

    if (pass.operationType) {
      this.onOperationChange(pass.operationType as 'CARGA' | 'DESCARGA');
    }

    this.checkInForm.patchValue({
      clientCode: pass.clientCode || this.checkInForm.get('clientCode')?.value,
      client: pass.clientName || this.checkInForm.get('client')?.value,
      carrierLineCode: pass.carrierLineCode || this.checkInForm.get('carrierLineCode')?.value,
      carrierLine: pass.carrierLine || this.checkInForm.get('carrierLine')?.value,
      nombreOperador: pass.driverName || '',
      placasTracto: pass.tractorPlates || '',
      noEcoTractor: pass.economicNumber || pass.noEcoTractor || '',
      placasCaja: pass.boxPlates || '',
      medidasCaja: pass.boxDimensions || '53 Pies',
      tipoTransporte: pass.transportType || 'Caja Seca',
      transportistaNombre: pass.driverName || '',
      transportistaFirma: !!pass.driverSignature,
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
          if (parsed.caja.olores) this.checkInForm.patchValue({ revOloresExtraños: parsed.caja.olores });
          if (parsed.caja.plagas) this.checkInForm.patchValue({ revIndiciosPlagas: parsed.caja.plagas });
        }
      } catch {}
    }

    this.showPassListModal.set(false);
    this.scanSuccessMessage.set(`¡Datos del Pase #${pass.token} cargados exitosamente! Chofer: ${pass.driverName || 'S/N'}, Placas: ${pass.tractorPlates || 'S/P'}.`);
    setTimeout(() => this.scanSuccessMessage.set(null), 6000);
  }

  // ── MÉTODOS DEL MODAL DE QR DE PRUEBA ─────────────────────────────────────
  protected openQrModal(): void {
    if (!this.qrModalUrl()) {
      this.generateDriverPass();
    } else {
      this.showQrModal.set(true);
    }
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

  // ── MANEJO DE ESTATUS DE RAMPAS (DISPONIBLE / OCUPADA) ────────────────────
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

    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    const formVal = this.checkInForm.value;

    // Sellos de seguridad obligatorios
    const seals: string[] = this.sealList().length > 0 
      ? [...this.sealList()] 
      : (formVal.noSello ? [formVal.noSello.trim().toUpperCase()] : ['SEAL-4G-001']);

    // Construcción del resumen estructurado del Formato F01-PO-CP-7.1.3-03
    const inspectionObservations = [
      `[FORMATO F01-PO-CP-7.1.3-03] Arribo en Caseta de Seguridad`,
      `Unidad: Eco=${formVal.noEcoTractor || 'S/N'} | Tipo=${formVal.tipoTransporte || 'Caja Seca'} | Medidas=${formVal.medidasCaja || '53 Pies'}`,
      `EPP: Calzado=${formVal.eppZapatos} (${formVal.eppZapatosObs || 'OK'}), Cofia=${formVal.eppCofia}, Cubrebocas=${formVal.eppCubrebocas}, Chaleco=${formVal.eppChaleco}`,
      `Documentación: CartaPorte=${formVal.docCartaPorte} (${formVal.docCartaPorteObs || 'OK'}), Remisión=${formVal.docRemision} (${formVal.docRemisionObs || 'OK'})`,
      `Revisión Caja: Interior=${formVal.revInteriorCaja}, Daños=${formVal.revDanosCaja}, Puertas=${formVal.revDanosPuertas}, Olores=${formVal.revOloresExtraños}, Plagas=${formVal.revIndiciosPlagas}`,
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

    if (formVal.operacion === 'CARGA') {
      this.movementsService.createOutboundCheckInBackend(checkInData).subscribe({
        next: (outbound) => {
          this.isSaving.set(false);
          this.createdFolio.set(outbound.folio);
          this.assignedRampLabel.set(formVal.rampCode || `R-${formVal.rampNumber}`);
          this.saveSuccess.set(true);
          this.movementsService.loadInitialBackendData();

          if (this.activeToken()) {
            this.movementsService.movementsApi.completePassCheckin(this.activeToken()!, {
              operationType: 'CARGA',
              rampNumber: Number(formVal.rampNumber) || 1,
              rampCode: formVal.rampCode,
              driverName: formVal.nombreOperador,
              tractorPlates: formVal.placasTracto,
              boxPlates: formVal.placasCaja,
              docNumber: formVal.noCartaPorte || formVal.remision,
              sealNumbers: seals,
              observations: inspectionObservations
            }).subscribe({ next: () => this.reloadActivePasses(), error: () => {} });
          }
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
          this.movementsService.reloadReceptions();

          if (this.activeToken()) {
            this.movementsService.movementsApi.completePassCheckin(this.activeToken()!, {
              operationType: 'DESCARGA',
              rampNumber: Number(formVal.rampNumber) || 1,
              rampCode: formVal.rampCode,
              driverName: formVal.nombreOperador,
              tractorPlates: formVal.placasTracto,
              boxPlates: formVal.placasCaja,
              docNumber: formVal.remision,
              sealNumbers: seals,
              observations: inspectionObservations
            }).subscribe({ next: () => this.reloadActivePasses(), error: () => {} });
          }
        },
        error: (err) => {
          this.isSaving.set(false);
          const msg = err?.error?.message || err?.message || 'Error al registrar el check-in en el servidor';
          this.errorMessage.set(msg);
        }
      });
    }
  }

  protected resetForm(): void {
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
      medidasCaja: '53 Pies',
      noSello: '',
      tipoTransporte: 'Caja Seca',
      eppZapatos: 'SI',
      eppZapatosObs: 'Cumple con calzado de casquillo',
      eppCofia: 'SI',
      eppCofiaObs: 'En orden',
      eppCubrebocas: 'SI',
      eppCubrebocasObs: 'En orden',
      eppChaleco: 'SI',
      eppChalecoObs: 'Chaleco reflejante en buen estado',
      docCartaPorte: 'SI',
      docCartaPorteObs: 'Documento completo y legible',
      docRemision: 'SI',
      docRemisionObs: 'Documento coincide con carga',
      revInteriorCaja: 'SI',
      revInteriorCajaObs: 'Limpio y seco',
      revDanosCaja: 'NO',
      revDanosCajaObs: 'Sin abolladuras ni fisuras',
      revDanosPuertas: 'NO',
      revDanosPuertasObs: 'Empaques y bisagras íntegros',
      revOloresExtraños: 'NO',
      revOloresExtrañosObs: 'Sin olor anómalo',
      revIndiciosPlagas: 'NO',
      revIndiciosPlagasObs: 'Sin evidencia de plaga',
      responsableVigilanciaNombre: 'Guardia de Turno - Caseta Principal',
      responsableVigilanciaFirma: true,
      transportistaNombre: '',
      transportistaFirma: false
    });
    this.sealList.set([]);
    this.tempSealInput.set('');
    this.saveSuccess.set(false);
    this.createdFolio.set(null);
    this.assignedRampLabel.set(null);
    this.errorMessage.set(null);
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

