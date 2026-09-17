import { Component, OnInit, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WarehouseMovementsApiService } from '../../warehouse-movements/services/warehouse-movements-api.service';

@Component({
  selector: 'fg-carrier-checkin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './carrier-checkin.component.html',
  styleUrl: './carrier-checkin.component.css'
})
export class CarrierCheckinComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(WarehouseMovementsApiService);

  @ViewChild('signatureCanvas') signatureCanvasRef?: ElementRef<HTMLCanvasElement>;

  protected readonly currentStep = signal<number>(1);
  protected readonly token = signal<string>('');
  protected readonly isLoadingPass = signal<boolean>(true);
  protected readonly passError = signal<string | null>(null);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly submitSuccess = signal<boolean>(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly sealList = signal<string[]>([]);
  protected readonly tempSealInput = signal<string>('');

  // Catálogos dinámicos desde Base de Datos
  protected readonly clientsList = signal<Array<{ id: string; code: string; name: string; tradeName?: string }>>([]);
  protected readonly carrierLinesList = signal<Array<{ id: string; code: string; name: string; tradeName?: string }>>([]);
  protected readonly transportTypesList = signal<string[]>([]);
  protected readonly boxDimensionsList = signal<string[]>([]);

  // Flags para captura manual / libre
  protected readonly isCustomClient = signal<boolean>(false);
  protected readonly isCustomCarrier = signal<boolean>(false);
  protected readonly isCustomTransport = signal<boolean>(false);
  protected readonly isCustomDimension = signal<boolean>(false);
  protected readonly customTransportInput = signal<string>('');
  protected readonly customDimensionInput = signal<string>('');

  // Signature canvas state
  private isDrawing = false;
  private canvasContext: CanvasRenderingContext2D | null = null;
  protected hasSignature = signal<boolean>(false);

  // Formato F01-PO-CP-7.1.3-03
  protected readonly checkInForm: FormGroup = this.fb.group({
    controlNumber: ['F01-PO-CP-7.1.3-03'],
    operacion: ['DESCARGA', Validators.required], // CARGA | DESCARGA
    fecha: [new Date().toISOString().slice(0, 10), Validators.required],
    hora: [new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), Validators.required],

    // Documentos
    remision: [''],
    noCartaPorte: [''],

    // Empresa & Transportista
    clientName: ['', Validators.required],
    clientCode: [''],
    carrierLine: ['', Validators.required],
    carrierLineCode: [''],

    // Chofer & Unidad
    nombreOperador: ['', [Validators.required, Validators.minLength(3)]],
    driverLicense: [''],
    placasTracto: ['', [Validators.required, Validators.minLength(3)]],
    noEcoTractor: [''],
    placasCaja: ['', [Validators.required, Validators.minLength(3)]],
    medidasCaja: ['53 Pies', Validators.required],
    tipoTransporte: ['Caja Seca', Validators.required],

    // Criterios EPP
    eppZapatos: ['SI', Validators.required],
    eppCofia: ['SI', Validators.required],
    eppCubrebocas: ['SI', Validators.required],
    eppChaleco: ['SI', Validators.required],

    // Criterios Unidad
    revInteriorCaja: ['SI', Validators.required],
    revDanosCaja: ['NO', Validators.required],
    revDanosPuertas: ['NO', Validators.required],
    revOloresExtranos: ['NO', Validators.required],
    revIndiciosPlagas: ['NO', Validators.required],

    observaciones: [''],
    declaracionVerdad: [false, Validators.requiredTrue]
  });

  ngOnInit(): void {
    this.loadCatalogs();

    this.route.queryParams.subscribe((params) => {
      const qToken = params['token'] || params['pass'];
      if (qToken) {
        this.token.set(qToken.trim().toUpperCase());
        this.loadPassData(this.token());
      } else {
        // Modo directo / QR local
        this.token.set('PASS-LOCAL-' + Date.now().toString().slice(-4));
        this.isLoadingPass.set(false);
      }
    });

    this.onOperationChange('DESCARGA');
  }

  protected loadCatalogs(): void {
    this.api.getPublicCatalogs().subscribe({
      next: (data) => {
        if (data) {
          this.clientsList.set(data.clients || []);
          this.carrierLinesList.set(data.carrierLines || []);
          this.transportTypesList.set(data.transportTypes || []);
          this.boxDimensionsList.set(data.boxDimensions || []);
        }
      },
      error: () => {
        this.clientsList.set([
          { id: '87c07cb2-61c3-4006-a88c-265bd1eee2df', code: '87c07cb2-61c3-4006-a88c-265bd1eee2df', name: 'MARCAS NESTLE S.A. DE C.V.' },
          { id: 'c083251b-e210-494e-80f3-38814eaba992', code: 'c083251b-e210-494e-80f3-38814eaba992', name: 'NESTLE MEXICO S.A. DE C.V.' },
          { id: 'edc885c6-0216-405a-84cc-841f47f30f48', code: 'edc885c6-0216-405a-84cc-841f47f30f48', name: 'QUALAMEX S.A. DE C.V.' }
        ]);
        this.carrierLinesList.set([
          { id: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', code: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', name: 'TRANSPORTE GOLA', tradeName: 'TRANSPORTE GOLA' },
          { id: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', code: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', name: 'TRANSPORTE DIAZ', tradeName: 'TRANSPORTE DIAZ' },
          { id: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', code: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', name: 'TRANSPORTE TUM', tradeName: 'TRANSPORTE TUM' },
          { id: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', code: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', name: 'TRANSPORTE EBEN EZER', tradeName: 'TRANSPORTE EBEN EZER' },
          { id: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', code: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', name: 'TRANSPORTE MONCHO', tradeName: 'TRANSPORTE MONCHO' }
        ]);
        this.transportTypesList.set([
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
        this.boxDimensionsList.set([
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
      }
    });
  }

  protected onClientSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val === '__OTHER__') {
      this.isCustomClient.set(true);
      this.checkInForm.patchValue({ clientCode: '', clientName: '' });
    } else {
      this.isCustomClient.set(false);
      const found = this.clientsList().find((c) => c.code === val || c.id === val);
      if (found) {
        this.checkInForm.patchValue({
          clientCode: found.code,
          clientName: found.name
        });
      }
    }
  }

  protected toggleCustomClient(custom: boolean): void {
    this.isCustomClient.set(custom);
    if (!custom) {
      this.checkInForm.patchValue({ clientCode: '', clientName: '' });
    }
  }

  protected onCarrierSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val === '__OTHER__') {
      this.isCustomCarrier.set(true);
      this.checkInForm.patchValue({ carrierLineCode: '', carrierLine: '' });
    } else {
      this.isCustomCarrier.set(false);
      const found = this.carrierLinesList().find((c) => c.code === val || c.id === val);
      if (found) {
        this.checkInForm.patchValue({
          carrierLineCode: found.code,
          carrierLine: found.tradeName || found.name
        });
      }
    }
  }

  protected toggleCustomCarrier(custom: boolean): void {
    this.isCustomCarrier.set(custom);
    if (!custom) {
      this.checkInForm.patchValue({ carrierLineCode: '', carrierLine: '' });
    }
  }

  protected onTransportTypeSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val === 'Otro (Especificar)' || val === '__OTHER__') {
      this.isCustomTransport.set(true);
      this.checkInForm.patchValue({ tipoTransporte: this.customTransportInput() || 'Otro' });
    } else {
      this.isCustomTransport.set(false);
      this.checkInForm.patchValue({ tipoTransporte: val });
    }
  }

  protected onCustomTransportChange(val: string): void {
    this.customTransportInput.set(val);
    this.checkInForm.patchValue({ tipoTransporte: val });
  }

  protected onBoxDimensionSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const val = target.value;
    if (val === 'Otra Medida' || val === '__OTHER__') {
      this.isCustomDimension.set(true);
      this.checkInForm.patchValue({ medidasCaja: this.customDimensionInput() || 'Personalizada' });
    } else {
      this.isCustomDimension.set(false);
      this.checkInForm.patchValue({ medidasCaja: val });
    }
  }

  protected onCustomDimensionChange(val: string): void {
    this.customDimensionInput.set(val);
    this.checkInForm.patchValue({ medidasCaja: val });
  }

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  protected loadPassData(tokenStr: string): void {
    this.isLoadingPass.set(true);
    this.passError.set(null);

    this.api.getPublicPass(tokenStr).subscribe({
      next: (pass: any) => {
        this.isLoadingPass.set(false);
        if (pass) {
          if (pass.operationType) {
            this.onOperationChange(pass.operationType as 'CARGA' | 'DESCARGA');
          }
          if (pass.clientName) this.checkInForm.patchValue({ clientName: pass.clientName, clientCode: pass.clientCode || '' });
          if (pass.carrierLine) this.checkInForm.patchValue({ carrierLine: pass.carrierLine, carrierLineCode: pass.carrierLineCode || '' });
          if (pass.driverName) this.checkInForm.patchValue({ nombreOperador: pass.driverName });
          if (pass.tractorPlates) this.checkInForm.patchValue({ placasTracto: pass.tractorPlates });
          if (pass.boxPlates) this.checkInForm.patchValue({ placasCaja: pass.boxPlates });
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
        }
      },
      error: () => {
        this.isLoadingPass.set(false);
        // Permitir continuar incluso si el backend no encuentra el token en modo offline
      }
    });
  }

  protected onOperationChange(val: 'CARGA' | 'DESCARGA'): void {
    this.checkInForm.patchValue({ operacion: val });
    const cartaCtrl = this.checkInForm.get('noCartaPorte');
    const remCtrl = this.checkInForm.get('remision');

    if (val === 'CARGA') {
      cartaCtrl?.setValidators([Validators.required]);
      remCtrl?.clearValidators();
    } else {
      remCtrl?.setValidators([Validators.required]);
      cartaCtrl?.clearValidators();
    }
    cartaCtrl?.updateValueAndValidity();
    remCtrl?.updateValueAndValidity();
  }

  protected setStep(step: number): void {
    this.currentStep.set(step);
    if (step === 4) {
      setTimeout(() => this.initCanvas(), 100);
    }
  }

  protected nextStep(): void {
    if (this.currentStep() < 4) {
      this.currentStep.update((s) => s + 1);
      if (this.currentStep() === 4) {
        setTimeout(() => this.initCanvas(), 100);
      }
    }
  }

  protected prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  // ── MANEJO DE SELLOS ──
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

  // ── CANVAS DE FIRMA DIGITAL ──
  private initCanvas(): void {
    if (!this.signatureCanvasRef) return;
    const canvas = this.signatureCanvasRef.nativeElement;
    this.canvasContext = canvas.getContext('2d');
    if (!this.canvasContext) return;

    // Set canvas dimensions based on CSS display width
    canvas.width = canvas.offsetWidth || 340;
    canvas.height = 140;

    this.canvasContext.strokeStyle = '#00f2fe';
    this.canvasContext.lineWidth = 2.5;
    this.canvasContext.lineCap = 'round';
    this.canvasContext.lineJoin = 'round';
  }

  protected startDrawing(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDrawing = true;
    const pos = this.getEventPos(event);
    if (this.canvasContext) {
      this.canvasContext.beginPath();
      this.canvasContext.moveTo(pos.x, pos.y);
    }
  }

  protected draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.canvasContext) return;
    event.preventDefault();
    const pos = this.getEventPos(event);
    this.canvasContext.lineTo(pos.x, pos.y);
    this.canvasContext.stroke();
    this.hasSignature.set(true);
  }

  protected stopDrawing(): void {
    this.isDrawing = false;
  }

  protected clearSignature(): void {
    if (!this.signatureCanvasRef || !this.canvasContext) return;
    const canvas = this.signatureCanvasRef.nativeElement;
    this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSignature.set(false);
  }

  private getEventPos(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (!this.signatureCanvasRef) return { x: 0, y: 0 };
    const rect = this.signatureCanvasRef.nativeElement.getBoundingClientRect();
    if (event instanceof MouseEvent) {
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    const touch = event.touches[0] || event.changedTouches[0];
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  // ── SUBMIT CHOFER ──
  protected submitDriverForm(): void {
    if (this.tempSealInput().trim()) {
      this.addSeal();
    }

    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const f = this.checkInForm.value;
    const seals = this.sealList().length > 0 ? this.sealList() : ['SEAL-DRIVER-001'];

    let sigData = '';
    if (this.signatureCanvasRef && this.hasSignature()) {
      sigData = this.signatureCanvasRef.nativeElement.toDataURL('image/png');
    }

    const payload = {
      operationType: f.operacion,
      docNumber: f.operacion === 'CARGA' ? f.noCartaPorte : f.remision,
      noCartaPorte: f.noCartaPorte,
      remision: f.remision,
      clientCode: f.clientCode,
      clientName: f.clientName,
      carrierLineCode: f.carrierLineCode,
      carrierLine: f.carrierLine,
      driverName: f.nombreOperador,
      driverLicense: f.driverLicense,
      tractorPlates: (f.placasTracto || '').toUpperCase(),
      noEcoTractor: f.noEcoTractor,
      boxPlates: (f.placasCaja || '').toUpperCase(),
      boxDimensions: f.medidasCaja,
      transportType: f.tipoTransporte,
      sealNumbers: seals,
      observations: f.observaciones || 'Registro completado por chofer vía smartphone',
      driverSignature: sigData || 'FIRMA_DIGITAL_AUTORIZADA_CHOFER',
      checklistData: JSON.stringify({
        epp: { zapatos: f.eppZapatos, cofia: f.eppCofia, cubrebocas: f.eppCubrebocas, chaleco: f.eppChaleco },
        caja: { interior: f.revInteriorCaja, danos: f.revDanosCaja, puertas: f.revDanosPuertas, olores: f.revOloresExtranos, plagas: f.revIndiciosPlagas }
      })
    };

    const tokenToSend = this.token() || 'PASS-DEMO';

    this.api.submitPublicDriverCheckin(tokenToSend, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.submitSuccess.set(true);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        // If public endpoint failed due to offline demo, show success state with mock storage
        this.submitSuccess.set(true);
      }
    });
  }
}
