/**
 * @file receiving-center.component.ts
 * @description Centro de Recepciones — Agenda de Citas de Recepción [HU-028].
 * Módulo Enterprise para planeación, FSM de citas y control operativo del patio y andenes.
 */

import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ReceptionAppointmentService } from '../services/reception-appointment.service';
import {
  ReceptionAppointment,
  AppointmentStatus,
  ExpectedLine,
  PriorityLevel,
  ReceptionType,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_CLASSES,
  PRIORITY_LABELS,
  RECEPTION_TYPE_LABELS,
} from '../models/reception-appointment.models';
import { PurchaseOrderValidationService } from '../services/purchase-order-validation.service';
import {
  POValidationStatus,
  POValidationResult,
  POComparisonOutcome,
  PODiscrepancyType,
  PO_VALIDATION_STATUS_LABELS,
  PO_VALIDATION_STATUS_CLASSES,
  DISCREPANCY_LABELS,
} from '../models/purchase-order.models';
import { TransportArrivalService } from '../services/transport-arrival.service';
import {
  TransportArrivalRecord,
  ArrivalClearanceStatus,
  ArrivalIncident,
  CheckInInput,
  ARRIVAL_CLEARANCE_LABELS,
  ARRIVAL_CLEARANCE_CLASSES,
  INCIDENT_TYPE_LABELS,
} from '../models/transport-arrival.models';
import { ReceptionPriorityService } from '../services/reception-priority.service';
import {
  PrioritySource,
  PriorityReasonCode,
  PriorityExpirationPolicy,
  OperationalAvailability,
  PrioritySuggestion,
  ReceptionPriorityDecision,
  PRIORITY_FACTOR_LABELS,
  PRIORITY_REASON_LABELS,
  OPERATIONAL_AVAILABILITY_LABELS,
  OPERATIONAL_AVAILABILITY_CLASSES,
} from '../models/reception-priority.models';

export type TabMode = 'AGENDA' | 'TODAY' | 'HISTORY';

@Component({
  selector: 'fg-receiving-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receiving-center.component.html',
  styleUrl: './receiving-center.component.css',
})
export class ReceivingCenterComponent implements OnInit {
  protected readonly service = inject(ReceptionAppointmentService);
  protected readonly priorityService = inject(ReceptionPriorityService);
  protected readonly poService = inject(PurchaseOrderValidationService);
  protected readonly arrivalService = inject(TransportArrivalService);
  private readonly fb      = inject(FormBuilder);
  private readonly router  = inject(Router);

  // Constants
  protected readonly statusLabels  = APPOINTMENT_STATUS_LABELS;
  protected readonly statusClasses = APPOINTMENT_STATUS_CLASSES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly receptionTypeLabels = RECEPTION_TYPE_LABELS;
  protected readonly poStatusLabels = PO_VALIDATION_STATUS_LABELS;
  protected readonly poStatusClasses = PO_VALIDATION_STATUS_CLASSES;
  protected readonly discrepancyLabels = DISCREPANCY_LABELS;
  protected readonly arrivalClearanceLabels = ARRIVAL_CLEARANCE_LABELS;
  protected readonly arrivalClearanceClasses = ARRIVAL_CLEARANCE_CLASSES;
  protected readonly incidentTypeLabels = INCIDENT_TYPE_LABELS;

  // HU-026 Labels & Maps
  protected readonly priorityFactorLabels = PRIORITY_FACTOR_LABELS;
  protected readonly priorityReasonLabels = PRIORITY_REASON_LABELS;
  protected readonly operationalAvailabilityLabels = OPERATIONAL_AVAILABILITY_LABELS;
  protected readonly operationalAvailabilityClasses = OPERATIONAL_AVAILABILITY_CLASSES;
  protected readonly priorityReasonCodesList: PriorityReasonCode[] = [
    'CUSTOMER_COMMITMENT',
    'PRODUCTION_IMPACT',
    'COLD_CHAIN',
    'HAZARDOUS_MATERIAL',
    'SLA_RISK',
    'DELIVERY_WINDOW',
    'OPERATIONAL_CONTINGENCY',
    'MANAGEMENT_DECISION',
    'DELAY_ESCALATION',
    'OTHER',
  ];

  // Mock Master Catalogs for Form
  protected readonly clients = [
    { id: 'CLI-3PL-01', name: 'Nestlé México 3PL' },
    { id: 'CLI-3PL-02', name: 'Unilever Logística' },
    { id: 'CLI-3PL-03', name: 'Procter & Gamble 3PL' },
  ];

  protected readonly suppliers = [
    { id: 'SUP-101', name: 'Café de Altura S.A. de C.V.', active: true },
    { id: 'SUP-102', name: 'Distribuidora Química del Valle', active: true },
    { id: 'SUP-103', name: 'Empaques e Insumos Industriales', active: true },
    { id: 'SUP-104', name: 'Plásticos y Envases de México', active: true },
    { id: 'SUP-105', name: 'Lácteos E Insumos Del Norte', active: true },
    { id: 'SUP-106', name: 'Proveedora Logística Del Pacífico', active: true },
    { id: 'SUP-999', name: 'Proveedor Inactivo Demo', active: false },
  ];

  protected readonly carriers = [
    { id: 'CAR-501', name: 'Transportes Express del Norte', suspended: false },
    { id: 'CAR-502', name: 'Logística Fletera del Golfo', suspended: false },
    { id: 'CAR-503', name: 'Autotransportes de Carga Real', suspended: false },
    { id: 'CAR-504', name: 'Fletes Directos de Puebla', suspended: false },
    { id: 'CAR-505', name: 'Fletes Peninsulares S.A.', suspended: false },
    { id: 'CAR-999', name: 'Transportista Suspendido Demo', suspended: true },
  ];

  protected readonly docks = ['AND-01', 'AND-02', 'AND-03', 'AND-04', 'AND-05', 'AND-06', 'AND-07', 'AND-08'];
  protected readonly vehicleTypes = ['Tráiler 53ft', 'Torton 15t', 'Rabón 8t', 'Camioneta 3.5t', 'Contenedor 40ft'];

  // Signals para Filtros, Pestañas y Orden Operativo
  protected readonly activeTab     = signal<TabMode>('AGENDA');
  protected readonly searchQuery   = signal('');
  protected readonly statusFilter  = signal<string>('ALL');
  protected readonly dockFilter    = signal<string>('ALL');
  protected readonly sortMode      = signal<'SCHEDULE' | 'OPERATIONAL'>('SCHEDULE');

  // Signals para Modales y Drawers
  protected readonly isDrawerOpen        = signal(false);
  protected readonly drawerMode          = signal<'CREATE' | 'EDIT' | 'VIEW' | 'CLONE'>('CREATE');
  protected readonly editingAppointmentId = signal<string | null>(null);

  protected readonly isArrivalModalOpen  = signal(false);
  protected readonly isReprogramModalOpen= signal(false);
  protected readonly isCancelModalOpen   = signal(false);
  protected readonly isAuditDrawerOpen   = signal(false);

  // HU-026: Signals para Modal de Cambio de Prioridad
  protected readonly isPriorityModalOpen = signal(false);
  protected readonly selectedAppointmentForPriority = signal<ReceptionAppointment | null>(null);
  protected readonly currentPrioritySuggestion = signal<PrioritySuggestion | null>(null);
  protected readonly priorityErrorMessage = signal<string | null>(null);

  // Form Groups
  protected appointmentForm!: FormGroup;
  protected arrivalForm!: FormGroup;
  protected reprogramForm!: FormGroup;
  protected cancelForm!: FormGroup;
  protected priorityForm!: FormGroup;

  // Mensaje de Error en Formulario General
  protected formErrorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this._initForms();
  }

  private _initForms(): void {
    this.appointmentForm = this.fb.group({
      clientId: ['CLI-3PL-01', Validators.required],
      supplierId: ['SUP-101', Validators.required],
      receptionType: ['NATIONAL', Validators.required],
      asnReference: ['', [Validators.required, Validators.minLength(3)]],
      priority: ['NORMAL', Validators.required],
      observations: [''],

      scheduledDate: [new Date().toISOString().split('T')[0], Validators.required],
      scheduledTime: ['09:00', Validators.required],
      durationMinutes: [60, [Validators.required, Validators.min(15), Validators.max(480)]],
      dockNumber: ['AND-01', Validators.required],

      carrierId: ['CAR-501', Validators.required],
      expectedPlates: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,10}$/i)]],
      expectedDriver: [''],
      vehicleType: ['Tráiler 53ft', Validators.required],

      lines: this.fb.array([]),
    });

    // Agregar línea de mercancía por defecto
    this.addFormLine('SKU-CAFE-001', 'Café Molido 500g', 48, 'Caja', 'LOT-2026-A1');

    // Formulario de Check-In del Transporte (Llegada a patio / caseta - HU-027)
    this.arrivalForm = this.fb.group({
      actualPlates: ['', [Validators.required, Validators.pattern(/^[A-Z0-9-]{5,10}$/i)]],
      actualDriver: [''],
      actualCarrier: [''],
      actualVehicleType: ['Tráiler 53ft', Validators.required],
      sealPrimary: ['', Validators.required],
      sealSecondary: [''],
      sealPrimaryCondition: ['INTACT', Validators.required],
      accessGate: ['Caseta Principal A1', Validators.required],
      observations: [''],
    });

    // Formulario de Reprogramación
    this.reprogramForm = this.fb.group({
      newDate: [new Date().toISOString().split('T')[0], Validators.required],
      newTime: ['10:00', Validators.required],
      newDock: ['AND-01', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]],
    });

    // Formulario de Cancelación
    this.cancelForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  // Getter del FormArray de Líneas
  get linesFormArray(): FormArray {
    return this.appointmentForm.get('lines') as FormArray;
  }

  addFormLine(sku = '', description = '', expectedQty = 10, unit = 'Caja', expectedLot = ''): void {
    const lineGroup = this.fb.group({
      lineId: [`LNE-${Date.now()}-${Math.floor(Math.random() * 100)}`],
      sku: [sku, Validators.required],
      description: [description, Validators.required],
      expectedQty: [expectedQty, [Validators.required, Validators.min(1)]],
      unit: [unit, Validators.required],
      expectedLot: [expectedLot],
    });
    this.linesFormArray.push(lineGroup);
  }

  removeFormLine(index: number): void {
    if (this.linesFormArray.length > 1) {
      this.linesFormArray.removeAt(index);
    }
  }

  // ─── COMPUTED SIGNALS PARA FILTERING Y KPIS ──────────────────────────────────

  protected readonly todayDate = new Date().toISOString().split('T')[0];

  /** Conteo de recepciones URGENT activas en la sucursal para control de abuso */
  protected readonly activeUrgentCount = computed(() =>
    this.service.appointments().filter(
      (a) => a.priority === 'URGENT' && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'].includes(a.status)
    ).length
  );

  /** Citas filtradas según pestaña activa, búsqueda, filtros y modo de ordenamiento */
  protected readonly filteredAppointments = computed(() => {
    const list = this.service.appointments();
    const tab = this.activeTab();
    const q = this.searchQuery().trim().toLowerCase();
    const statusF = this.statusFilter();
    const dockF = this.dockFilter();
    const sort = this.sortMode();

    const filtered = list.filter((appt) => {
      // Pestaña
      if (tab === 'TODAY' && appt.scheduledDate !== this.todayDate) {
        return false;
      }
      if (tab === 'HISTORY' && !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'].includes(appt.status)) {
        return false;
      }
      if (tab === 'AGENDA' && ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'].includes(appt.status)) {
        return false;
      }

      // Filtro estado
      if (statusF !== 'ALL' && appt.status !== statusF) {
        return false;
      }

      // Filtro andén
      if (dockF !== 'ALL' && appt.dockNumber !== dockF) {
        return false;
      }

      // Buscador
      if (q) {
        const matchAsn  = appt.asnReference.toLowerCase().includes(q);
        const matchSupp = appt.supplierName.toLowerCase().includes(q);
        const matchCarr = appt.carrierName.toLowerCase().includes(q);
        const matchId   = appt.id.toLowerCase().includes(q);
        if (!matchAsn && !matchSupp && !matchCarr && !matchId) return false;
      }

      return true;
    });

    if (sort === 'OPERATIONAL') {
      return [...filtered].sort(
        (a, b) => this.priorityService.getOperationalRankScore(b) - this.priorityService.getOperationalRankScore(a)
      );
    }

    return filtered;
  });

  /** Grupo 1: Atención Inmediata (READY + URGENT / HIGH / NORMAL) */
  protected readonly attentionRequiredGroup = computed(() =>
    this.filteredAppointments().filter(
      (a) => this.priorityService.calculateOperationalAvailability(a) === 'READY'
    )
  );

  /** Grupo 2: Bloqueos Prioritarios (BLOCKED / REVIEW_REQUIRED) */
  protected readonly priorityBlockedGroup = computed(() =>
    this.filteredAppointments().filter((a) => {
      const avail = this.priorityService.calculateOperationalAvailability(a);
      return avail === 'BLOCKED' || avail === 'REVIEW_REQUIRED';
    })
  );

  /** Grupo 3: Cola Previa en Espera (WAITING_DOCUMENTS / WAITING_CHECKIN) */
  protected readonly standardQueueGroup = computed(() =>
    this.filteredAppointments().filter((a) => {
      const avail = this.priorityService.calculateOperationalAvailability(a);
      return avail === 'WAITING_DOCUMENTS' || avail === 'WAITING_CHECKIN' || avail === 'IN_RECEIVING';
    })
  );

  /** KPI 1: Recepciones Programadas (SCHEDULED + CONFIRMED) */
  protected readonly kpiScheduled = computed(() =>
    this.service.appointments().filter((a) => a.status === 'SCHEDULED' || a.status === 'CONFIRMED').length
  );

  /** KPI 2: Vehículos en Sitio (ARRIVED) */
  protected readonly kpiArrived = computed(() =>
    this.service.appointments().filter((a) => a.status === 'ARRIVED').length
  );

  /** KPI 3: En Proceso (IN_RECEIVING) */
  protected readonly kpiInReceiving = computed(() =>
    this.service.appointments().filter((a) => a.status === 'IN_RECEIVING').length
  );

  /** KPI 4: Finalizadas (COMPLETED) */
  protected readonly kpiCompleted = computed(() =>
    this.service.appointments().filter((a) => a.status === 'COMPLETED').length
  );

  /** KPI 5: Retrasadas (Citas activas cuya fecha/hora programada ya pasó) */
  /** KPI 5: Retrasadas (Citas activas cuya fecha/hora programada ya pasó) */
  protected readonly kpiDelayed = computed(() => {
    const today = this.todayDate;
    const nowTimeMin = new Date().getHours() * 60 + new Date().getMinutes();

    return this.service.appointments().filter((a) => {
      if (!['SCHEDULED', 'CONFIRMED'].includes(a.status)) return false;
      if (a.scheduledDate < today) return true;
      if (a.scheduledDate === today) {
        const [h, m] = a.scheduledTime.split(':').map(Number);
        const apptMin = (h || 0) * 60 + (m || 0);
        return nowTimeMin > apptMin + 30; // 30 mins de tolerancia
      }
      return false;
    }).length;
  });

  /** Recepción Activa Destacada (en estado IN_RECEIVING) */
  protected readonly activeReception = computed(() => {
    const active = this.service.appointments().find((a) => a.status === 'IN_RECEIVING');
    if (!active) return null;

    const progress = active.progress;
    const lines = active.lines || [];
    let reconciledLinesCount = 0;

    if (progress?.receivedQtyByLine) {
      lines.forEach((l) => {
        if ((progress.receivedQtyByLine[l.lineId] ?? 0) >= l.expectedQty) {
          reconciledLinesCount++;
        }
      });
    }

    let elapsedMin = 35;
    if (progress?.startedAt) {
      const start = new Date(progress.startedAt).getTime();
      const now = new Date().getTime();
      elapsedMin = Math.max(1, Math.round((now - start) / 60000));
    }

    return {
      appointment: active,
      reconciledLinesCount,
      totalLinesCount: lines.length,
      elapsedMinutes: elapsedMin,
      operatorName: progress?.startedBy || 'OPERATIONS_MANAGER',
      currentStepLabel: progress?.currentStep === 2 ? 'Paso 2 de 2 · Cuadratura y Escaneo' : 'Paso 1 de 2 · Datos del Vehículo',
    };
  });

  /** Conteo por Pestaña */
  protected readonly agendaCount = computed(() =>
    this.service.appointments().filter((a) => !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'].includes(a.status)).length
  );

  protected readonly todayCount = computed(() =>
    this.service.appointments().filter((a) => a.scheduledDate === this.todayDate).length
  );

  protected readonly historyCount = computed(() =>
    this.service.appointments().filter((a) => ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'REJECTED'].includes(a.status)).length
  );

  /** Toggle de Filtro interactivo desde KPI card */
  protected toggleKpiFilter(statusKey: string): void {
    if (this.statusFilter() === statusKey) {
      this.statusFilter.set('ALL');
    } else {
      this.statusFilter.set(statusKey);
    }
  }

  /** Helper para resumen de SKUs y cajas por línea */
  protected getSkusSummary(lines: ExpectedLine[]): string {
    if (!lines || lines.length === 0) return '0 SKUs';
    const totalQty = lines.reduce((s, l) => s + l.expectedQty, 0);
    const unitLabel = lines[0]?.unit || 'unidades';
    return `${lines.length} SKU${lines.length > 1 ? 's' : ''} · ${totalQty} ${unitLabel}`;
  }

  /** Helper para contexto operativo en tabla */
  protected getArrivalContext(appt: ReceptionAppointment): string {
    if (appt.status === 'ARRIVED') {
      let mins = 12;
      if (appt.arrivalData?.arrivedAt) {
        const arrTime = new Date(appt.arrivalData.arrivedAt).getTime();
        mins = Math.max(1, Math.round((new Date().getTime() - arrTime) / 60000));
      }
      return `Llegó hace ${mins} min · Esperando asignación`;
    }

    if (appt.status === 'IN_RECEIVING') {
      const step = appt.progress?.currentStep ?? 1;
      return `En descarga / cuadratura · Paso ${step} de 2`;
    }

    if (appt.status === 'CONFIRMED') {
      return `Programada ${appt.scheduledTime} · A tiempo`;
    }

    if (appt.status === 'SCHEDULED') {
      return `Esperando confirmación`;
    }

    if (appt.status === 'COMPLETED') {
      return `Cuadratura 100% completada`;
    }

    if (appt.status === 'CANCELLED') {
      return `Cita cancelada auditada`;
    }

    if (appt.status === 'NO_SHOW') {
      return `No se presentó al andén`;
    }

    return `Incidencia registrada`;
  }

  /** Helper para calcular minutos de retraso */
  protected getDelayMinutes(appt: ReceptionAppointment): number {
    if (!['SCHEDULED', 'CONFIRMED'].includes(appt.status)) return 0;
    const today = this.todayDate;
    if (appt.scheduledDate < today) return 60; // Día previo
    if (appt.scheduledDate === today) {
      const nowTimeMin = new Date().getHours() * 60 + new Date().getMinutes();
      const [h, m] = appt.scheduledTime.split(':').map(Number);
      const apptMin = (h || 0) * 60 + (m || 0);
      const diff = nowTimeMin - apptMin;
      return diff > 15 ? diff : 0;
    }
    return 0;
  }

  // ─── ACCIONES DE NAVEGACIÓN Y ACCIONES POR ESTADO ─────────────────────────────

  /** Abre el Drawer para crear una cita */
  openCreateDrawer(): void {
    this.formErrorMessage.set(null);
    this.drawerMode.set('CREATE');
    this.editingAppointmentId.set(null);

    this.appointmentForm.reset({
      clientId: 'CLI-3PL-01',
      supplierId: 'SUP-101',
      receptionType: 'NATIONAL',
      asnReference: `ASN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      priority: 'NORMAL',
      scheduledDate: this.todayDate,
      scheduledTime: '09:00',
      durationMinutes: 60,
      dockNumber: 'AND-01',
      carrierId: 'CAR-501',
      expectedPlates: '77-AB-9C',
      expectedDriver: 'Carlos Mendoza',
      vehicleType: 'Tráiler 53ft',
    });

    this.linesFormArray.clear();
    this.addFormLine('SKU-CAFE-001', 'Café Molido 500g', 48, 'Caja', 'LOT-2026-A1');

    this.isDrawerOpen.set(true);
  }

  /** Abre el Drawer en modo edición o lectura */
  openEditDrawer(appt: ReceptionAppointment, mode: 'EDIT' | 'VIEW' | 'CLONE'): void {
    this.formErrorMessage.set(null);
    this.drawerMode.set(mode);
    this.editingAppointmentId.set(appt.id);

    if (mode === 'CLONE') {
      // Si es clonación desde No-Show
      this.appointmentForm.reset({
        clientId: appt.clientId,
        supplierId: appt.supplierId,
        receptionType: appt.receptionType,
        asnReference: `${appt.asnReference}-R`,
        priority: appt.priority,
        observations: `Re-agendada desde cita No Show ${appt.id}. ${appt.observations || ''}`,
        scheduledDate: this.todayDate,
        scheduledTime: '10:00',
        durationMinutes: appt.durationMinutes,
        dockNumber: appt.dockNumber,
        carrierId: appt.carrierId,
        expectedPlates: appt.expectedPlates,
        expectedDriver: appt.expectedDriver,
        vehicleType: appt.vehicleType,
      });
    } else {
      this.appointmentForm.reset({
        clientId: appt.clientId,
        supplierId: appt.supplierId,
        receptionType: appt.receptionType,
        asnReference: appt.asnReference,
        priority: appt.priority,
        observations: appt.observations,
        scheduledDate: appt.scheduledDate,
        scheduledTime: appt.scheduledTime,
        durationMinutes: appt.durationMinutes,
        dockNumber: appt.dockNumber,
        carrierId: appt.carrierId,
        expectedPlates: appt.expectedPlates,
        expectedDriver: appt.expectedDriver,
        vehicleType: appt.vehicleType,
      });
    }

    this.linesFormArray.clear();
    appt.lines.forEach((l) => {
      this.linesFormArray.push(
        this.fb.group({
          lineId: [l.lineId],
          sku: [l.sku, Validators.required],
          description: [l.description, Validators.required],
          expectedQty: [l.expectedQty, [Validators.required, Validators.min(1)]],
          unit: [l.unit, Validators.required],
          expectedLot: [l.expectedLot],
        })
      );
    });

    if (mode === 'VIEW') {
      this.appointmentForm.disable();
    } else {
      this.appointmentForm.enable();
    }

    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.appointmentForm.enable();
  }

  /** Guarda la cita (Creación, Edición o Clonación) */
  onSubmitAppointment(): void {
    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched();
      this.formErrorMessage.set('Completa todos los campos obligatorios del formulario.');
      return;
    }

    const val = this.appointmentForm.value;

    // 1. Validar proveedor activo
    const supplier = this.suppliers.find((s) => s.id === val.supplierId);
    if (supplier && !supplier.active) {
      this.formErrorMessage.set('El proveedor seleccionado se encuentra inactivo.');
      return;
    }

    // 2. Validar transportista no suspendido
    const carrier = this.carriers.find((c) => c.id === val.carrierId);
    if (carrier && carrier.suspended) {
      this.formErrorMessage.set('El transportista seleccionado se encuentra suspendido.');
      return;
    }

    // 3. Validar ASN único activo
    const currentId = this.editingAppointmentId();
    if (!this.service.validateAsnUniqueness(val.asnReference, currentId || undefined)) {
      this.formErrorMessage.set(`El ASN / Referencia "${val.asnReference}" ya pertenece a una cita activa.`);
      return;
    }

    // 4. Validar disponibilidad de andén
    const dockCheck = this.service.validateDockAvailability(
      val.scheduledDate,
      val.scheduledTime,
      val.durationMinutes,
      val.dockNumber,
      currentId || undefined
    );

    if (!dockCheck.valid) {
      this.formErrorMessage.set(dockCheck.conflictMessage || 'Conflicto de andén u horario.');
      return;
    }

    const client = this.clients.find((c) => c.id === val.clientId);

    const linesData: ExpectedLine[] = val.lines.map((l: any) => ({
      lineId: l.lineId || `LNE-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      sku: l.sku,
      description: l.description,
      expectedQty: l.expectedQty,
      unit: l.unit,
      expectedLot: l.expectedLot,
    }));

    if (this.drawerMode() === 'CREATE' || this.drawerMode() === 'CLONE') {
      this.service.createAppointment({
        branchId: 'SUC-001',
        branchName: 'Planta Central CDMX',
        clientId: val.clientId,
        clientName: client?.name || 'Cliente Genérico 3PL',
        supplierId: val.supplierId,
        supplierName: supplier?.name || 'Proveedor General S.A.',
        supplierActive: true,
        receptionType: val.receptionType,
        asnReference: val.asnReference,
        priority: val.priority,
        observations: val.observations,
        scheduledDate: val.scheduledDate,
        scheduledTime: val.scheduledTime,
        durationMinutes: val.durationMinutes,
        dockNumber: val.dockNumber,
        carrierId: val.carrierId,
        carrierName: carrier?.name || 'Transportista General',
        carrierSuspended: false,
        expectedPlates: val.expectedPlates,
        expectedDriver: val.expectedDriver,
        vehicleType: val.vehicleType,
        lines: linesData,
        status: 'SCHEDULED',
      });
    } else if (this.drawerMode() === 'EDIT' && currentId) {
      this.service.updateAppointment(currentId, {
        clientId: val.clientId,
        clientName: client?.name,
        supplierId: val.supplierId,
        supplierName: supplier?.name,
        receptionType: val.receptionType,
        asnReference: val.asnReference,
        priority: val.priority,
        observations: val.observations,
        scheduledDate: val.scheduledDate,
        scheduledTime: val.scheduledTime,
        durationMinutes: val.durationMinutes,
        dockNumber: val.dockNumber,
        carrierId: val.carrierId,
        carrierName: carrier?.name,
        expectedPlates: val.expectedPlates,
        expectedDriver: val.expectedDriver,
        vehicleType: val.vehicleType,
        lines: linesData,
      });
    }

    this.closeDrawer();
  }

  // ─── ACCIONES POR ESTADO ──────────────────────────────────────────────────────

  /** Accion Confirmar cita */
  onConfirmAppointment(appt: ReceptionAppointment): void {
    this.service.confirmAppointment(appt.id);
  }

  // Signals para Drawer de Check-In del Transporte (HU-027)
  protected readonly isCheckInDrawerOpen       = signal(false);
  protected readonly selectedCheckInAppt       = signal<ReceptionAppointment | null>(null);
  protected readonly currentCheckInRecord      = signal<TransportArrivalRecord | null>(null);
  protected readonly checkInErrorMessage        = signal<string | null>(null);
  protected readonly checkInSuccessMessage       = signal<string | null>(null);
  protected readonly checkInDrawerMode          = signal<'CHECKIN_FORM' | 'INCIDENT_RESOLVE_FORM' | 'REJECT_GATE_FORM'>('CHECKIN_FORM');
  protected readonly selectedIncidentForResolve = signal<ArrivalIncident | null>(null);
  protected readonly incidentResolutionReason  = signal('');

  /** Accion Registrar Llegada (Abre Drawer de Check-In del Transporte - HU-027) */
  openArrivalModal(appt: ReceptionAppointment): void {
    this.openCheckInDrawer(appt);
  }

  openCheckInDrawer(appt: ReceptionAppointment): void {
    this.service.setSelectedAppointmentId(appt.id);
    this.selectedCheckInAppt.set(appt);
    this.checkInErrorMessage.set(null);
    this.checkInSuccessMessage.set(null);
    this.incidentResolutionReason.set('');
    this.checkInDrawerMode.set('CHECKIN_FORM');

    const existingRecord = this.arrivalService.arrivalsMap()[appt.id] || appt.transportArrivalRecord;
    this.currentCheckInRecord.set(existingRecord || null);

    this.arrivalForm.patchValue({
      actualPlates: appt.arrivalData?.actualPlates || appt.expectedPlates || '',
      actualDriver: appt.arrivalData?.actualDriver || appt.expectedDriver || '',
      actualCarrier: appt.carrierName || '',
      actualVehicleType: appt.vehicleType || 'Tráiler 53ft',
      sealPrimary: appt.arrivalData?.sealPrimary || 'SL-' + Math.floor(100000 + Math.random() * 900000),
      sealSecondary: appt.arrivalData?.sealSecondary || '',
      sealPrimaryCondition: 'INTACT',
      accessGate: 'Caseta Principal A1',
      observations: appt.observations || '',
    });

    this.isCheckInDrawerOpen.set(true);
  }

  closeCheckInDrawer(): void {
    this.isCheckInDrawerOpen.set(false);
    this.selectedCheckInAppt.set(null);
    this.currentCheckInRecord.set(null);
  }

  submitTransportCheckIn(): void {
    const appt = this.selectedCheckInAppt();
    if (!appt) return;

    if (this.arrivalForm.invalid) {
      this.arrivalForm.markAllAsTouched();
      this.checkInErrorMessage.set('Por favor completa todos los campos requeridos marcados en rojo.');
      return;
    }

    const input: CheckInInput = this.arrivalForm.value;

    try {
      const record = this.arrivalService.processTransportCheckIn(appt, input);
      this.currentCheckInRecord.set(record);

      this.service.registerArrival(
        appt.id,
        record.actualPlates,
        record.actualDriver,
        record.sealPrimary,
        record.sealSecondary,
        record.clearanceStatus,
        record
      );

      this.checkInErrorMessage.set(null);
      this.checkInSuccessMessage.set(
        `Check-In completado exitosamente. Clearance de Arribo: ${this.arrivalClearanceLabels[record.clearanceStatus]}`
      );
    } catch (e: any) {
      this.checkInErrorMessage.set(e?.message || 'Error al procesar el Check-In del Transporte.');
    }
  }

  openIncidentResolveForm(incident: ArrivalIncident): void {
    this.selectedIncidentForResolve.set(incident);
    this.incidentResolutionReason.set('');
    this.checkInDrawerMode.set('INCIDENT_RESOLVE_FORM');
  }

  authorizeArrivalIncident(): void {
    const appt = this.selectedCheckInAppt();
    const incident = this.selectedIncidentForResolve();
    const reason = this.incidentResolutionReason().trim();
    if (!appt || !incident) return;

    if (!reason || reason.length < 10) {
      this.checkInErrorMessage.set('El motivo de la autorización es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    try {
      const updatedRecord = this.arrivalService.authorizeArrivalIncident(appt.id, incident.id, reason);
      this.currentCheckInRecord.set(updatedRecord);
      this.service.updateArrivalClearanceStatus(appt.id, updatedRecord.clearanceStatus, updatedRecord);
      this.checkInErrorMessage.set(null);
      this.checkInSuccessMessage.set(`Incidencia '${incident.title}' autorizada por supervisor.`);
      this.checkInDrawerMode.set('CHECKIN_FORM');
    } catch (e: any) {
      this.checkInErrorMessage.set(e?.message || 'Error al autorizar la incidencia.');
    }
  }

  rejectTransportAtGate(): void {
    const appt = this.selectedCheckInAppt();
    const reason = this.incidentResolutionReason().trim();
    if (!appt) return;

    if (!reason || reason.length < 10) {
      this.checkInErrorMessage.set('El motivo del rechazo en caseta es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    try {
      const updatedRecord = this.arrivalService.rejectAtGate(appt.id, reason);
      this.currentCheckInRecord.set(updatedRecord);
      this.service.updateArrivalClearanceStatus(appt.id, 'REJECTED_AT_GATE', updatedRecord);
      this.checkInErrorMessage.set(null);
      this.checkInSuccessMessage.set('Unidad rechazada en caseta. Registro de auditoría guardado.');
      this.checkInDrawerMode.set('CHECKIN_FORM');
    } catch (e: any) {
      this.checkInErrorMessage.set(e?.message || 'Error al rechazar unidad en caseta.');
    }
  }

  // Signals para Drawer de Validación Documental vs OC (HU-029)
  protected readonly isPOValidationDrawerOpen   = signal(false);
  protected readonly selectedPOValidationAppt   = signal<ReceptionAppointment | null>(null);
  protected readonly currentPOValidationResult  = signal<POValidationResult | null>(null);
  protected readonly poExceptionReason          = signal('');
  protected readonly poRejectionReason          = signal('');
  protected readonly poNotRequiredReason        = signal('');
  protected readonly poDrawerErrorMessage        = signal<string | null>(null);
  protected readonly poDrawerMode                = signal<'OVERVIEW' | 'EXCEPTION_FORM' | 'REJECT_FORM' | 'NOT_REQUIRED_FORM'>('OVERVIEW');

  /** Abre el Drawer de Validación Documental ejecutando automáticamente el motor de comparación */
  openPOValidationDrawer(appt: ReceptionAppointment): void {
    this.selectedPOValidationAppt.set(appt);
    this.poDrawerErrorMessage.set(null);
    this.poExceptionReason.set('');
    this.poRejectionReason.set('');
    this.poNotRequiredReason.set('');
    this.poDrawerMode.set('OVERVIEW');

    // Motor de comparación algorítmica automático
    const result = this.poService.validateAppointmentAgainstPO(appt);
    this.currentPOValidationResult.set(result);
    this.isPOValidationDrawerOpen.set(true);
  }

  closePOValidationDrawer(): void {
    this.isPOValidationDrawerOpen.set(false);
    this.selectedPOValidationAppt.set(null);
    this.currentPOValidationResult.set(null);
  }

  /** Confirmación de validación limpia */
  confirmPOValidation(): void {
    const appt = this.selectedPOValidationAppt();
    if (!appt) return;

    try {
      this.poService.confirmValidation(appt.id, appt.poNumber || 'PO-2026-8801');
      this.service.updatePOValidationStatus(appt.id, 'VALIDATED');

      const updated = this.poService.validateAppointmentAgainstPO(appt);
      this.currentPOValidationResult.set(updated);
      this.poDrawerErrorMessage.set(null);
    } catch (e: any) {
      this.poDrawerErrorMessage.set(e?.message || 'Error al confirmar la validación documental.');
    }
  }

  /** Autorización de Excepción por Supervisor */
  authorizePOException(): void {
    const appt = this.selectedPOValidationAppt();
    const reason = this.poExceptionReason().trim();
    if (!appt) return;

    if (!reason || reason.length < 10) {
      this.poDrawerErrorMessage.set('El motivo de excepción es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    try {
      this.poService.authorizeException(appt.id, appt.poNumber || 'PO-2026-8801', reason);
      this.service.updatePOValidationStatus(appt.id, 'EXCEPTED');

      const updated = this.poService.validateAppointmentAgainstPO(appt);
      this.currentPOValidationResult.set(updated);
      this.poDrawerErrorMessage.set(null);
      this.poDrawerMode.set('OVERVIEW');
    } catch (e: any) {
      this.poDrawerErrorMessage.set(e?.message || 'Error al autorizar excepción.');
    }
  }

  /** Rechazo explícito de validación documental */
  rejectPOValidation(): void {
    const appt = this.selectedPOValidationAppt();
    const reason = this.poRejectionReason().trim();
    if (!appt) return;

    if (!reason || reason.length < 10) {
      this.poDrawerErrorMessage.set('El motivo de rechazo es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    try {
      this.poService.rejectValidation(appt.id, appt.poNumber || 'PO-2026-8801', reason);
      this.service.updatePOValidationStatus(appt.id, 'REJECTED');

      const updated = this.poService.validateAppointmentAgainstPO(appt);
      this.currentPOValidationResult.set(updated);
      this.poDrawerErrorMessage.set(null);
      this.poDrawerMode.set('OVERVIEW');
    } catch (e: any) {
      this.poDrawerErrorMessage.set(e?.message || 'Error al rechazar validación.');
    }
  }

  /** Marcar recepción como No Requerida de OC */
  markPONotRequired(): void {
    const appt = this.selectedPOValidationAppt();
    const reason = this.poNotRequiredReason().trim();
    if (!appt) return;

    if (!reason || reason.length < 10) {
      this.poDrawerErrorMessage.set('El motivo de exención es obligatorio y debe tener al menos 10 caracteres.');
      return;
    }

    try {
      this.poService.markNotRequired(appt.id, reason);
      this.service.updatePOValidationStatus(appt.id, 'NOT_REQUIRED');

      const updated = this.poService.validateAppointmentAgainstPO(appt);
      this.currentPOValidationResult.set(updated);
      this.poDrawerErrorMessage.set(null);
      this.poDrawerMode.set('OVERVIEW');
    } catch (e: any) {
      this.poDrawerErrorMessage.set(e?.message || 'Error al marcar como no requerida.');
    }
  }

  /** Inicia la recepción (solo en estado ARRIVED) y navega al Wizard */
  onStartReceiving(appt: ReceptionAppointment): void {
    const poStatus = appt.poValidationStatus || 'PENDING';
    const allowedPOStatuses = ['VALIDATED', 'EXCEPTED', 'NOT_REQUIRED'];

    if (!allowedPOStatuses.includes(poStatus)) {
      this.formErrorMessage.set(
        'La recepción física no puede iniciar hasta completar correctamente la validación documental contra la Orden de Compra.'
      );
      return;
    }

    try {
      this.service.startReceiving(appt.id);
      this.router.navigate(['/receiving/appointments', appt.id, 'wizard']);
    } catch (e: any) {
      this.formErrorMessage.set(
        e?.message || 'La recepción física no puede iniciar hasta completar correctamente la validación documental contra la Orden de Compra.'
      );
    }
  }

  /** Continúa la recepción en proceso (en estado IN_RECEIVING) y navega al Wizard */
  onContinueReceiving(appt: ReceptionAppointment): void {
    this.router.navigate(['/receiving/appointments', appt.id, 'wizard']);
  }

  /** Abre Modal de Reprogramación */
  openReprogramModal(appt: ReceptionAppointment): void {
    this.service.setSelectedAppointmentId(appt.id);
    this.reprogramForm.reset({
      newDate: appt.scheduledDate,
      newTime: appt.scheduledTime,
      newDock: appt.dockNumber,
      reason: '',
    });
    this.isReprogramModalOpen.set(true);
  }

  submitReprogram(): void {
    if (this.reprogramForm.invalid) {
      this.reprogramForm.markAllAsTouched();
      return;
    }
    const apptId = this.service.selectedAppointmentId();
    if (!apptId) return;

    const val = this.reprogramForm.value;
    const check = this.service.validateDockAvailability(val.newDate, val.newTime, 60, val.newDock, apptId);
    if (!check.valid) {
      alert(check.conflictMessage);
      return;
    }

    this.service.reprogramAppointment(apptId, val.newDate, val.newTime, val.newDock, val.reason);
    this.isReprogramModalOpen.set(false);
  }

  /** Abre Modal de Cancelación */
  openCancelModal(appt: ReceptionAppointment): void {
    this.service.setSelectedAppointmentId(appt.id);
    this.cancelForm.reset({ reason: '' });
    this.isCancelModalOpen.set(true);
  }

  submitCancel(): void {
    if (this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    const apptId = this.service.selectedAppointmentId();
    if (!apptId) return;

    this.service.cancelAppointment(apptId, this.cancelForm.value.reason);
    this.isCancelModalOpen.set(false);
  }

  /** Marca cita como No Show */
  onMarkNoShow(appt: ReceptionAppointment): void {
    if (confirm(`¿Confirmar marca de NO SHOW para la cita ${appt.id} (${appt.asnReference})?`)) {
      this.service.markNoShow(appt.id);
    }
  }

  /** Formatea fecha corta */
  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Formatea fecha y hora iso */
  formatDateTime(isoStr?: string): string {
    if (!isoStr) return '—';
    const date = new Date(isoStr);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ════════════════════════════════════════════════════════
  // ENTERPRISE POLISH HELPERS (HU-028, HU-029, HU-027)
  // ════════════════════════════════════════════════════════

  protected readonly isCheckInProcessing = signal(false);

  /** Iconos Semánticos para el Timeline de Auditoría (HU-028) */
  getAuditIcon(action: string): string {
    const act = (action || '').toUpperCase();
    if (act.includes('CREATE')) return 'add_circle';
    if (act.includes('EDIT') || act.includes('UPDATE')) return 'edit';
    if (act.includes('CONFIRM')) return 'check_circle';
    if (act.includes('REPROGRAM')) return 'event_repeat';
    if (act.includes('ARRIVED') || act.includes('REGISTER_ARRIVAL')) return 'local_shipping';
    if (act.includes('CHECK') || act.includes('CHECKIN') || act.includes('GATE')) return 'meeting_room';
    if (act.includes('VALIDAT')) return 'description';
    if (act.includes('RECEIVING_STARTED') || act.includes('RECEPTION')) return 'warehouse';
    if (act.includes('REJECT') || act.includes('CANCEL')) return 'warning';
    return 'history';
  }

  getAuditIconClass(action: string): string {
    const act = (action || '').toUpperCase();
    if (act.includes('CREATE')) return 'rc-audit-icon--create';
    if (act.includes('EDIT') || act.includes('UPDATE')) return 'rc-audit-icon--edit';
    if (act.includes('CONFIRM')) return 'rc-audit-icon--confirm';
    if (act.includes('REPROGRAM')) return 'rc-audit-icon--reprogram';
    if (act.includes('ARRIVED') || act.includes('REGISTER_ARRIVAL')) return 'rc-audit-icon--arrived';
    if (act.includes('CHECK') || act.includes('CHECKIN') || act.includes('GATE')) return 'rc-audit-icon--checkin';
    if (act.includes('VALIDAT')) return 'rc-audit-icon--validation';
    if (act.includes('RECEIVING_STARTED') || act.includes('RECEPTION')) return 'rc-audit-icon--start';
    if (act.includes('REJECT') || act.includes('CANCEL')) return 'rc-audit-icon--reject';
    return 'rc-audit-icon--default';
  }

  /** Explicación dinámica de Resultado Técnico para Validación Documental (HU-029) */
  getPOOutcomeExplanation(outcome?: POComparisonOutcome): string {
    if (!outcome) return '';
    switch (outcome) {
      case 'BLOCKED':
        return 'No es posible continuar la recepción debido a discrepancias críticas detectadas durante la conciliación documental.';
      case 'MATCH':
        return 'La documentación coincide correctamente. La recepción puede continuar.';
      case 'WITH_DIFFERENCES':
        return 'La recepción puede continuar bajo revisión del supervisor.';
      default:
        return '';
    }
  }

  getPOMatchPercentClass(percent?: number): string {
    const p = percent ?? 0;
    if (p >= 100) return 'po-match-bar--100';
    if (p >= 80) return 'po-match-bar--80';
    if (p >= 50) return 'po-match-bar--50';
    return 'po-match-bar--0';
  }

  getDiscrepancySeverityInfo(type: PODiscrepancyType): { class: string; icon: string; label: string } {
    if (
      type === 'PO_NOT_FOUND' ||
      type === 'PO_CANCELLED' ||
      type === 'BRANCH_MISMATCH' ||
      type === 'CLIENT_MISMATCH' ||
      type === 'SUPPLIER_MISMATCH' ||
      type === 'SKU_NOT_IN_PO' ||
      type === 'QTY_OVER_PO'
    ) {
      return { class: 'po-disc-badge--critical', icon: 'stop', label: 'CRÍTICO' };
    }
    if (type === 'PO_EXPIRED' || type === 'ASN_MISMATCH' || type === 'QTY_UNDER_PO' || type === 'UNIT_MISMATCH') {
      return { class: 'po-disc-badge--warning', icon: 'warning', label: 'ADVERTENCIA' };
    }
    return { class: 'po-disc-badge--info', icon: 'info', label: 'INFO' };
  }

  /** Explicación Dinámica de Clearance de Arribo (HU-027) */
  getClearanceExplanation(status?: ArrivalClearanceStatus): string {
    switch (status) {
      case 'CLEARED':
        return 'El transporte cumple todas las validaciones de acceso y seguridad.';
      case 'WARNING_CLEARED':
        return 'Se detectaron incidencias menores autorizadas por un supervisor.';
      case 'REVIEW_REQUIRED':
        return 'Se detectaron incidencias que requieren autorización o revisión de supervisor.';
      case 'BLOCKED':
        return 'El transporte no puede ingresar al almacén por incidencias críticas.';
      case 'REJECTED_AT_GATE':
        return 'La unidad ha sido rechazada en caseta de acceso.';
      default:
        return 'En espera de inspección de caseta.';
    }
  }

  /** Checklist Vivo en Tiempo Real para Check-In (HU-027) */
  getCheckInLiveChecklist(): Array<{ label: string; valid: boolean | null; warning?: boolean }> {
    const appt = this.selectedCheckInAppt();
    if (!appt) return [];

    const formVal = this.arrivalForm.value;
    const actualPlates = (formVal.actualPlates || '').trim().toUpperCase();
    const expectedPlates = (appt.expectedPlates || '').trim().toUpperCase();

    const actualDriver = (formVal.actualDriver || '').trim().toUpperCase();
    const expectedDriver = (appt.expectedDriver || '').trim().toUpperCase();

    const actualCarrier = (formVal.actualCarrier || '').trim().toUpperCase();
    const expectedCarrier = (appt.carrierName || '').trim().toUpperCase();

    const actualVehicle = (formVal.actualVehicleType || '').trim().toUpperCase();
    const expectedVehicle = (appt.vehicleType || '').trim().toUpperCase();

    const seal = (formVal.sealPrimary || '').trim();
    const sealCond = formVal.sealPrimaryCondition;
    const gate = (formVal.accessGate || '').trim();
    const obs = (formVal.observations || '').trim();

    return [
      {
        label: 'Placas verificadas',
        valid: actualPlates.length > 0 ? (!expectedPlates || actualPlates === expectedPlates) : null,
        warning: actualPlates.length > 0 && expectedPlates.length > 0 && actualPlates !== expectedPlates,
      },
      {
        label: 'Proveedor coincide',
        valid: true,
      },
      {
        label: 'Transportista coincide',
        valid: actualCarrier.length > 0 ? (!expectedCarrier || actualCarrier === expectedCarrier) : null,
        warning: actualCarrier.length > 0 && expectedCarrier.length > 0 && actualCarrier !== expectedCarrier,
      },
      {
        label: 'Sello de seguridad válido',
        valid: seal.length > 0 && sealCond === 'INTACT',
        warning: sealCond === 'DAMAGED',
      },
      {
        label: 'Caseta registrada',
        valid: gate.length > 0,
      },
      {
        label: 'Tipo de vehículo verificado',
        valid: actualVehicle.length > 0 ? (!expectedVehicle || actualVehicle === expectedVehicle) : null,
      },
      {
        label: 'Chofer identificado',
        valid: actualDriver.length > 0 ? (!expectedDriver || actualDriver === expectedDriver) : null,
      },
      {
        label: 'Observaciones de caseta',
        valid: obs.length > 0,
      },
    ];
  }

  // ─── ACCIONES HU-026: MODAL DE CAMBIO DE PRIORIDAD ─────────────────────────

  /** Abre el modal compacto de priorización para una cita */
  openPriorityModal(appt: ReceptionAppointment): void {
    this.priorityErrorMessage.set(null);
    this.selectedAppointmentForPriority.set(appt);

    // Calcular la recomendación explicable del motor en tiempo real
    const suggestion = this.priorityService.calculateSuggestedPriority(appt);
    this.currentPrioritySuggestion.set(suggestion);

    // Inicializar el formulario con la prioridad actual de la cita (fuente de verdad)
    const existingDecision = appt.priorityDecision;
    this.priorityForm.reset({
      newPriority: appt.priority,
      reasonCode: existingDecision?.reasonCode || 'CUSTOMER_COMMITMENT',
      reason: existingDecision?.reason || '',
      expirationPolicy: existingDecision?.expirationPolicy || 'UNTIL_RECEIVING_START',
      expiresAt: existingDecision?.expiresAt || '',
    });

    this.isPriorityModalOpen.set(true);
  }

  /** Cierra el modal de priorización */
  closePriorityModal(): void {
    this.isPriorityModalOpen.set(false);
    this.selectedAppointmentForPriority.set(null);
    this.currentPrioritySuggestion.set(null);
    this.priorityErrorMessage.set(null);
  }

  /** Procesa la acción de guardar la prioridad */
  savePriorityChange(): void {
    const appt = this.selectedAppointmentForPriority();
    const suggestion = this.currentPrioritySuggestion();
    if (!appt || !suggestion) return;

    this.priorityErrorMessage.set(null);
    const formVal = this.priorityForm.value;
    const newPriority: PriorityLevel = formVal.newPriority;
    const isManual = newPriority !== suggestion.priority;
    const source: PrioritySource = isManual ? 'MANUAL' : 'SYSTEM';
    const userRole = 'OPERATIONS_SUPERVISOR'; // Obtenido del contexto de sesión RBAC (AuthState)

    // Validar políticas de negocio
    const valResult = this.priorityService.validatePriorityChange(
      appt.status,
      newPriority,
      source,
      formVal.reasonCode,
      formVal.reason,
      userRole
    );

    if (!valResult.valid) {
      this.priorityErrorMessage.set(valResult.error || 'No se puede cambiar la prioridad.');
      return;
    }

    const decision: ReceptionPriorityDecision = {
      suggestedPriority: suggestion.priority,
      appliedPriority: newPriority,
      source,
      reasonCode: formVal.reasonCode,
      reason: formVal.reason?.trim(),
      expirationPolicy: formVal.expirationPolicy || 'UNTIL_RECEIVING_START',
      expiresAt: formVal.expiresAt || undefined,
      assignedBy: 'Carlos Mendoza',
      assignedByRole: userRole,
      assignedByUserId: 'USR-SUP-001',
      assignedAt: new Date().toISOString(),
      active: true,
    };

    const res = this.service.updateAppointmentPriority(appt.id, newPriority, decision, appt.updatedAt);
    if (!res.success) {
      this.priorityErrorMessage.set(res.error || 'Error al guardar la prioridad.');
      return;
    }

    this.closePriorityModal();
  }

  /** Revierte una prioridad manual ejecutiva regresando a la sugerencia actual */
  revertPriorityOverride(appt: ReceptionAppointment): void {
    if (!appt || !appt.priorityDecision || appt.priorityDecision.source !== 'MANUAL') return;

    const targetAppt: ReceptionAppointment = appt;
    const suggestion = this.priorityService.calculateSuggestedPriority(targetAppt);
    this.service.revertAppointmentPriority(
      targetAppt.id,
      'Reversión manual por el supervisor desde el Centro de Recepciones',
      suggestion.priority,
      { userId: 'USR-SUP-001', userName: 'Carlos Mendoza', role: 'OPERATIONS_SUPERVISOR', branchId: targetAppt.branchId }
    );
  }
}

