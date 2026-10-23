/**
 * @file alerts-config-management.component.ts
 * @description Componente principal HU-134 — Configuración de Alertas y Notificaciones.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DISEÑO & ARQUITECTURA
 * ═══════════════════════════════════════════════════════════════════════════
 * - Layout Master-Detail (35% izquierda / 65% derecha)
 * - Hero compacto + 4 KPI cards superiores
 * - Buscador + Chips de Estado + Selector de Categoría
 * - Formulario Reactivo con validaciones estrictas
 * - Vista Previa en Tiempo Real (Live Toast System Preview)
 * - Historial por regla + Drawer de auditoría global
 * - ChangeDetectionStrategy.OnPush + Signals para máximo rendimiento
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { ToastService } from '../../../core/services/toast.service';
import { AuthState } from '../../../core/auth/auth.state';
import { AlertsConfigService } from '../alerts-config.service';

import {
  AlertConfiguration,
  CreateAlertConfigRequest,
  AlertCategory,
  AlertEvent,
  AlertPriority,
  AlertStatus,
  AlertChannel,
  AlertRecipientRole,
  AlertCondition,
  AlertUnit,
  AlertRecurrence,
  AlertEscalationTime,
  AlertAuditEntry,
  AlertHistoryEntry,
  AlertConfigAuditResponse,
  ToastPreviewData,
  ALERT_CATEGORY_LABELS,
  ALERT_EVENT_LABELS,
  ALERT_PRIORITY_LABELS,
  ALERT_CONDITION_LABELS,
  ALERT_UNIT_LABELS,
  ALERT_RECURRENCE_LABELS,
  ALERT_ESCALATION_LABELS,
  RECIPIENT_ROLE_LABELS,
} from '../alerts-config.models';

import {
  positiveNumberValidator,
  noWhitespaceOnlyValidator,
  uniqueAlertNameValidator,
} from '../alerts-config.validators';

type StatusFilter = 'ALL' | AlertStatus | 'CRITICAL';
type FormMode = 'CREATE' | 'EDIT';

@Component({
  selector: 'fg-alerts-config-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, RouterLink],
  templateUrl: './alerts-config-management.component.html',
  styleUrl: './alerts-config-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsConfigManagementComponent implements OnInit, OnDestroy {
  // ─── Servicios Inyectados ────────────────────────────────────────────────
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly toast = inject(ToastService);
  private readonly authState = inject(AuthState);
  protected readonly alertsService = inject(AlertsConfigService);

  private readonly destroy$ = new Subject<void>();

  // ─── Catálogos expuestos al template ────────────────────────────────────
  protected readonly categoryLabels = ALERT_CATEGORY_LABELS;
  protected readonly eventLabels = ALERT_EVENT_LABELS;
  protected readonly priorityLabels = ALERT_PRIORITY_LABELS;
  protected readonly conditionLabels = ALERT_CONDITION_LABELS;
  protected readonly unitLabels = ALERT_UNIT_LABELS;
  protected readonly recurrenceLabels = ALERT_RECURRENCE_LABELS;
  protected readonly escalationLabels = ALERT_ESCALATION_LABELS;
  protected readonly recipientRoleLabels = RECIPIENT_ROLE_LABELS;

  // ─── Estado de UI en Signals ──────────────────────────────────────────────
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isLoadingAudit = signal(false);
  protected readonly formMode = signal<FormMode>('CREATE');
  protected readonly selectedAlert = signal<AlertConfiguration | null>(null);
  protected readonly remoteAuditLogs = signal<AlertConfigAuditResponse[]>([]);

  // Filtros
  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly categoryFilter = signal<'ALL' | AlertCategory>('ALL');

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.categoryFilter.set('ALL');
  }

  // Overlays
  protected readonly showConfirmModal = signal(false);
  protected readonly confirmModalConfig = signal<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => void;
  } | null>(null);
  protected readonly showAuditDrawer = signal(false);

  // ─── Formulario Reactivo ─────────────────────────────────────────────────
  protected form!: FormGroup;
  protected formValuesSignal = signal<any>(null);

  // ─── Signals Computadas ─────────────────────────────────────────────────

  /** Alertas filtradas por búsqueda, estado y categoría */
  protected readonly filteredAlerts = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const stFilter = this.statusFilter();
    const catFilter = this.categoryFilter();
    const allAlerts = this.alertsService.alerts();

    return allAlerts.filter((alert) => {
      // Filtro por texto
      const matchesText =
        !query ||
        alert.name.toLowerCase().includes(query) ||
        (alert.description && alert.description.toLowerCase().includes(query)) ||
        (ALERT_EVENT_LABELS[alert.event as AlertEvent] || alert.event).toLowerCase().includes(query);

      // Filtro por estado / críticas
      let matchesStatus = true;
      if (stFilter === 'ACTIVE') matchesStatus = alert.status === 'ACTIVE';
      else if (stFilter === 'INACTIVE') matchesStatus = alert.status === 'INACTIVE';
      else if (stFilter === 'CRITICAL') matchesStatus = alert.priority === 'CRITICAL';

      // Filtro por categoría
      const matchesCategory = catFilter === 'ALL' || alert.category === catFilter;

      return matchesText && matchesStatus && matchesCategory;
    });
  });

  /** KPIs superiores computados */
  protected readonly kpis = computed(() => {
    const all = this.alertsService.alerts();
    const active = all.filter((a) => a.status === 'ACTIVE').length;
    const critical = all.filter((a) => a.priority === 'CRITICAL' && a.status === 'ACTIVE').length;
    const escalations = all.filter((a) => a.escalation !== 'NONE' && a.status === 'ACTIVE').length;

    return {
      activeAlerts: active,
      criticalAlerts: critical,
      configuredChannels: 1, // Notificación del sistema activa
      escalationsConfigured: escalations,
    };
  });

  /** Historial de la regla de alerta seleccionada actualmente */
  protected readonly selectedAlertHistory = computed(() => {
    const current = this.selectedAlert();
    if (!current) return [];
    return this.alertsService.getAlertHistory(current.id);
  });

  /** Computado para la Vista Previa del Toast del Sistema en tiempo real */
  protected readonly toastPreview = computed<ToastPreviewData>(() => {
    const alert = this.selectedAlert();
    const formVals = this.formValuesSignal() || (this.form ? this.form.getRawValue() : null);

    const name = formVals?.name || alert?.name || 'Inventario Bajo';
    const category = formVals?.category || alert?.category || 'INVENTORY';
    const priority = (formVals?.priority || alert?.priority || 'HIGH') as AlertPriority;
    const rawTemplate =
      formVals?.messageTemplate ||
      alert?.messageTemplate ||
      'El SKU NESCAFÉ-001 alcanzó el stock mínimo permitido.';
    const val = formVals?.value ?? alert?.value ?? 30;

    // Sustitución básica de variables de muestra para la vista previa
    let formattedMsg = rawTemplate
      .replace(/\{\{\s*truck\s*\}\}/g, 'TRK-9042')
      .replace(/\{\{\s*ramp\s*\}\}/g, 'Rampa-04')
      .replace(/\{\{\s*supplier\s*\}\}/g, 'Logística Bimbo S.A.')
      .replace(/\{\{\s*sku\s*\}\}/g, 'NESCAFÉ-001-Caja')
      .replace(/\{\{\s*zone\s*\}\}/g, 'Aisle-03-Bay-12')
      .replace(/\{\{\s*qty\s*\}\}/g, String(val))
      .replace(/\{\{\s*lot\s*\}\}/g, 'LOT-202607-X')
      .replace(/\{\{\s*date\s*\}\}/g, '15/08/2026')
      .replace(/\{\{\s*waveId\s*\}\}/g, 'WAVE-1084')
      .replace(/\{\{\s*aisle\s*\}\}/g, 'Pasillo 08')
      .replace(/\{\{\s*username\s*\}\}/g, 'carlos.lopez')
      .replace(/\{\{\s*interfaceId\s*\}\}/g, 'SAP-WMS-ORDERS')
      .replace(/\{\{\s*code\s*\}\}/g, '504 Gateway Timeout')
      .replace(/\{\{\s*routeId\s*\}\}/g, 'RT-TOL-042')
      .replace(/\{\{\s*value\s*\}\}/g, String(val));

    // Mapeo de ícono según prioridad
    let iconName = 'notifications';
    if (priority === 'CRITICAL') iconName = 'error';
    else if (priority === 'HIGH') iconName = 'warning';
    else if (priority === 'MEDIUM') iconName = 'report_problem';
    else if (priority === 'INFO') iconName = 'info';

    const now = new Date();
    const formattedTimestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} hrs`;

    return {
      title: name,
      categoryLabel: ALERT_CATEGORY_LABELS[category as AlertCategory] || 'Sistema',
      message: formattedMsg,
      priority,
      iconName,
      formattedTimestamp,
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CICLO DE VIDA
  // ═══════════════════════════════════════════════════════════════════════════

  ngOnInit(): void {
    this.initForm();
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN DE FORMULARIO
  // ═══════════════════════════════════════════════════════════════════════════

  private initForm(): void {
    this.form = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.maxLength(80),
          noWhitespaceOnlyValidator(),
          uniqueAlertNameValidator(
            () => this.alertsService.alerts(),
            () => this.selectedAlert()?.id || null
          ),
        ],
      ],
      category: ['INVENTORY', [Validators.required]],
      event: ['LOW_INVENTORY', [Validators.required]],
      priority: ['HIGH', [Validators.required]],
      status: ['ACTIVE', [Validators.required]],

      // Canales — Notificación del sistema fija en true, los demás deshabilitados
      channelSystem: [{ value: true, disabled: false }],
      channelEmail: [{ value: false, disabled: true }],
      channelPush: [{ value: false, disabled: true }],
      channelSms: [{ value: false, disabled: true }],
      channelWebhook: [{ value: false, disabled: true }],

      // Destinatarios — Roles
      recipientSupervisor: [true],
      recipientManager: [true],
      recipientAdmin: [false],
      recipientOperator: [false],
      recipientClient: [false],

      // Condición y Regla
      condition: ['LESS_THAN', [Validators.required]],
      value: [100, [Validators.required, positiveNumberValidator()]],
      unit: ['PIECES', [Validators.required]],
      recurrence: ['EVERY_30_MIN', [Validators.required]],
      escalation: ['AFTER_30_MIN', [Validators.required]],

      // Plantilla de mensaje
      messageTemplate: [
        'El SKU {{sku}} en zona {{zone}} alcanzó el stock crítico de {{qty}} pzas.',
        [Validators.required, Validators.maxLength(250), noWhitespaceOnlyValidator()],
      ],
      description: ['', [Validators.maxLength(300)]],
    });

    this.formValuesSignal.set(this.form.getRawValue());
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.formValuesSignal.set(this.form.getRawValue());
      this.cdr.markForCheck();
    });
  }

  private loadAlerts(): void {
    this.isLoading.set(true);
    this.alertsService
      .getAlerts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.data.length > 0) {
            this.selectAlert(res.data[0]);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading.set(false);
          this.toast.error('Error al cargar la lista de alertas.');
          this.cdr.markForCheck();
        },
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECCIÓN Y FORMULARIO
  // ═══════════════════════════════════════════════════════════════════════════

  protected selectAlert(alert: AlertConfiguration): void {
    this.selectedAlert.set(alert);
    this.formMode.set('EDIT');
    this.loadAuditLogs(alert.id);

    this.form.reset({
      name: alert.name,
      category: alert.category,
      event: alert.event,
      priority: alert.priority,
      status: alert.status,
      channelSystem: alert.channels ? alert.channels.includes('SYSTEM') : true,
      channelPush: alert.channels ? alert.channels.includes('PUSH') : false,
      recipientSupervisor: alert.recipients.includes('SUPERVISOR'),
      recipientManager: alert.recipients.includes('MANAGER'),
      recipientAdmin: alert.recipients.includes('ADMIN'),
      recipientOperator: alert.recipients.includes('OPERATOR'),
      recipientClient: alert.recipients.includes('CLIENT'),
      condition: alert.condition,
      value: alert.value,
      unit: alert.unit,
      recurrence: alert.recurrence,
      escalation: alert.escalation,
      messageTemplate: alert.messageTemplate,
      description: alert.description || '',
    });

    this.formValuesSignal.set(this.form.getRawValue());
    this.cdr.markForCheck();
  }

  /** Consulta el historial de auditoría real del backend para la regla seleccionada */
  protected loadAuditLogs(alertId: string): void {
    this.isLoadingAudit.set(true);
    this.alertsService
      .getAlertAuditApi(alertId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAudit.set(false);
          this.remoteAuditLogs.set(res.data || []);
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingAudit.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  protected createNewAlert(): void {
    this.selectedAlert.set(null);
    this.formMode.set('CREATE');

    this.form.reset({
      name: '',
      category: 'RECEIVING',
      event: 'WAIT_TIME_EXCEEDED',
      priority: 'HIGH',
      status: 'ACTIVE',
      channelSystem: true,
      channelEmail: false,
      channelPush: false,
      channelSms: false,
      channelWebhook: false,
      recipientSupervisor: true,
      recipientManager: true,
      recipientAdmin: false,
      recipientOperator: false,
      recipientClient: false,
      condition: 'TIME_EXCEEDED',
      value: 30,
      unit: 'MINUTES',
      recurrence: 'EVERY_15_MIN',
      messageTemplate:
        'La unidad {{truck}} ha superado el tiempo máximo de espera de {{value}} minutos.',
      description: '',
    });

    this.formValuesSignal.set(this.form.getRawValue());
    this.cdr.markForCheck();
  }

  /**
   * Inserta un tag de variable dinámica (ej. {{truck}}) directamente en el control messageTemplate del formulario.
   */
  protected insertVariableTag(tagName: string): void {
    const currentVal = this.form.get('messageTemplate')?.value || '';
    const tagToInsert = `{{${tagName}}}`;
    const newVal = currentVal ? `${currentVal} ${tagToInsert}` : tagToInsert;

    this.form.get('messageTemplate')?.setValue(newVal);
    this.form.get('messageTemplate')?.markAsDirty();
    this.form.get('messageTemplate')?.markAsTouched();
    this.cdr.markForCheck();
  }

  /**
   * Dispara una prueba simulada de la notificación mostrando el Toast real del sistema con los datos actuales sin guardar.
   */
  protected testAlertNotification(): void {
    const preview = this.toastPreview();
    const message = `${preview.title}: ${preview.message}`;

    switch (preview.priority) {
      case 'CRITICAL':
        this.toast.error(message);
        break;
      case 'HIGH':
        this.toast.warning(message);
        break;
      case 'MEDIUM':
        this.toast.info(message);
        break;
      default:
        this.toast.info(message);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDADO Y ACCIONES
  // ═══════════════════════════════════════════════════════════════════════════

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Por favor corrige las validaciones del formulario.');
      return;
    }

    const raw = this.form.getRawValue();

    // Extraer roles destinatarios seleccionados
    const recipients: AlertRecipientRole[] = [];
    if (raw.recipientSupervisor) recipients.push('SUPERVISOR');
    if (raw.recipientManager) recipients.push('MANAGER');
    if (raw.recipientAdmin) recipients.push('ADMIN');
    if (raw.recipientOperator) recipients.push('OPERATOR');
    if (raw.recipientClient) recipients.push('CLIENT');

    if (recipients.length === 0) {
      this.toast.error('Debes seleccionar al menos un rol destinatario.');
      return;
    }

    const currentUser =
      this.authState.currentUser()?.email || 'gerente.operaciones@4guard.mx';

    const channels: AlertChannel[] = [];
    if (raw.channelSystem) channels.push('SYSTEM');
    if (raw.channelPush) channels.push('PUSH');
    if (channels.length === 0) channels.push('SYSTEM');

    const payload: CreateAlertConfigRequest = {
      name: raw.name.trim(),
      category: raw.category,
      event: raw.event,
      priority: raw.priority,
      status: raw.status,
      channels,
      recipients,
      condition: raw.condition,
      value: parseFloat(raw.value),
      unit: raw.unit,
      recurrence: raw.recurrence,
      escalation: raw.escalation,
      messageTemplate: raw.messageTemplate.trim(),
      description: raw.description ? raw.description.trim() : '',
      updatedBy: currentUser,
    };

    this.isSaving.set(true);

    if (this.formMode() === 'CREATE') {
      this.alertsService
        .createAlert(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.isSaving.set(false);
            this.toast.success(res.message);
            this.selectAlert(res.data);
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isSaving.set(false);
            this.toast.error(err.message || 'Error al crear la regla.');
            this.cdr.markForCheck();
          },
        });
    } else {
      const currentId = this.selectedAlert()!.id;
      this.alertsService
        .updateAlert(currentId, payload, currentUser)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.isSaving.set(false);
            this.toast.success(res.message);
            this.selectAlert(res.data);
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isSaving.set(false);
            this.toast.error(err.message || 'Error al actualizar la regla.');
            this.cdr.markForCheck();
          },
        });
    }
  }

  protected confirmToggleStatus(alert: AlertConfiguration, event: MouseEvent): void {
    event.stopPropagation();
    const newStatus: AlertStatus = alert.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? 'Activar' : 'Inactivar';

    this.confirmModalConfig.set({
      title: `${actionLabel} Regla de Alerta`,
      message: `¿Estás seguro de que deseas ${actionLabel.toLowerCase()} la regla "${alert.name}"? ${
        newStatus === 'INACTIVE'
          ? 'El backend dejará de generar notificaciones automáticas para este evento.'
          : 'La regla comenzará a evaluarse activamente.'
      }`,
      confirmLabel: actionLabel,
      action: () => this.executeToggleStatus(alert.id, newStatus),
    });
    this.showConfirmModal.set(true);
  }

  private executeToggleStatus(id: string, newStatus: AlertStatus): void {
    const currentUser =
      this.authState.currentUser()?.email || 'gerente.operaciones@4guard.mx';

    this.alertsService
      .toggleAlertStatus(id, newStatus, currentUser)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.closeConfirmModal();
          this.toast.success(res.message);
          if (this.selectedAlert()?.id === id) {
            this.selectAlert(res.data);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.closeConfirmModal();
          this.toast.error(err.message || 'Error al cambiar estado.');
          this.cdr.markForCheck();
        },
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODALES Y DRAWERS
  // ═══════════════════════════════════════════════════════════════════════════

  protected closeConfirmModal(): void {
    this.showConfirmModal.set(false);
    this.confirmModalConfig.set(null);
  }

  protected openAudit(): void {
    this.showAuditDrawer.set(true);
  }

  protected closeAudit(): void {
    this.showAuditDrawer.set(false);
  }

  // Helper trackBy para rendimineto de listas
  protected trackByAlertId(_: number, alert: AlertConfiguration): string {
    return alert.id;
  }
}
