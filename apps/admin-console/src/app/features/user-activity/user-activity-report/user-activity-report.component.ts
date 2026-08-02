/**
 * @file user-activity-report.component.ts
 * @description Componente principal HU-146 — Reporte de Actividad por Usuario.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROLES AUTORIZADOS (simulado en frontend para evaluación de UX)
 * ═══════════════════════════════════════════════════════════════════════════
 *  - OPERATIONS_SUPERVISOR
 *  - SHIFT_LEADER
 *  - OPERATIONS_MANAGER
 *
 * La validación definitiva de RLS, permisos y alcance de datos DEBE ejecutarse
 * en backend y base de datos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTA DE AUDITORÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * El frontend NO escribe directamente en audit_logs.
 * audit.service.ts NO fue modificado.
 * Las acciones de exportar y manipular perfiles deben ser registradas por
 * el backend dentro de la misma transacción.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGINACIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * - pageIndex: índice 0-based de la página actual
 * - pageSize: eventos por página (predeterminado: 10)
 * - totalPages: calculado como computed
 * - Al aplicar/limpiar filtros se reinicia a la primera página
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA TIMELINE
 * ═══════════════════════════════════════════════════════════════════════════
 * Requiere un usuario seleccionado explícitamente.
 * Si no hay usuario seleccionado, muestra un estado guía.
 * Nunca mezcla actividades de distintos usuarios.
 */

import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

import { UserActivityService } from '../user-activity.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthState } from '../../../core/auth/auth.state';

import { ActivityDetailDrawerComponent } from '../components/activity-detail-drawer/activity-detail-drawer.component';
import { ReportProfileManagerComponent } from '../components/report-profile-manager/report-profile-manager.component';

import {
  UserActivityEvent,
  ActivityFilters,
  ActiveView,
  ActivityResult,
  ActivitySeverity,
  ActivityReportProfile,
  WMS_MODULES,
  WMS_ACTIONS,
} from '../user-activity.models';

// ─── Validadores personalizados ───────────────────────────────────────────────

/** Valida que dateFrom no sea posterior a dateTo */
function dateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const from = control.get('dateFrom')?.value;
  const to = control.get('dateTo')?.value;
  if (from && to && new Date(from) > new Date(to)) {
    return { dateRangeInvalid: true };
  }
  return null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

import { RouterLink } from '@angular/router';

const PAGE_SIZE_DEFAULT = 10;

@Component({
  selector: 'fg-user-activity-report',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ActivityDetailDrawerComponent,
    ReportProfileManagerComponent,
  ],
  templateUrl: './user-activity-report.component.html',
  styleUrl: './user-activity-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserActivityReportComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly activityService = inject(UserActivityService);
  private readonly toastService = inject(ToastService);
  protected readonly authState = inject(AuthState);
  private readonly destroy$ = new Subject<void>();

  // ─── Datos expuestos ─────────────────────────────────────────────────────

  readonly kpis = this.activityService.kpis;
  readonly filteredEvents = this.activityService.filteredEvents;
  readonly isLoading = this.activityService.isLoading;

  // ─── Vista activa: TABLE | TIMELINE ──────────────────────────────────────

  protected readonly activeView = signal<ActiveView>('TABLE');

  // ─── Panel de filtros (acordeón — estado UI únicamente) ──────────────────

  /** Controla el acordeón del panel de filtros. Sin efecto en la lógica. */
  protected readonly filtersOpen = signal(true);

  protected toggleFilters(): void {
    this.filtersOpen.update((v) => !v);
  }

  // ─── Filtros avanzados visibles ───────────────────────────────────────────

  protected readonly showAdvancedFilters = signal(false);

  // ─── Constantes para templates ────────────────────────────────────────────

  protected readonly allModules = WMS_MODULES;
  protected readonly allActions = WMS_ACTIONS;
  protected readonly allRoles = ['OPERATIONS_SUPERVISOR', 'SHIFT_LEADER', 'OPERATIONS_MANAGER'];
  protected readonly allWarehouses = [
    { id: 'wh-01', name: 'Toluca' },
    { id: 'wh-02', name: 'Monterrey' },
    { id: 'wh-03', name: 'Guadalajara' },
  ];
  protected readonly allResults: ActivityResult[] = ['SUCCESS', 'WARNING', 'REJECTED', 'ERROR'];
  protected readonly allSeverities: ActivitySeverity[] = ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'];

  // ─── Paginación ───────────────────────────────────────────────────────────

  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(PAGE_SIZE_DEFAULT);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredEvents().length / this.pageSize()))
  );

  /**
   * Eventos de la página actual.
   * Se calcula sobre filteredEvents del servicio (que ya aplicó los filtros).
   */
  protected readonly pagedEvents = computed<UserActivityEvent[]>(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredEvents().slice(start, start + this.pageSize());
  });

  protected readonly pageNumbers = computed<number[]>(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i);
  });

  // ─── Drawer de detalle ────────────────────────────────────────────────────

  protected readonly selectedEvent = signal<UserActivityEvent | null>(null);

  // ─── Panel de perfiles ────────────────────────────────────────────────────

  protected readonly showProfileManager = signal(false);

  // ─── Exportación ─────────────────────────────────────────────────────────

  protected readonly isExporting = signal(false);

  // ─── Timeline — usuario seleccionado ─────────────────────────────────────

  /**
   * Usuario seleccionado para la vista Timeline.
   * null significa "no se ha seleccionado usuario" → muestra estado guía.
   */
  protected readonly timelineUserId = signal<string | null>(null);
  protected readonly timelineUserName = signal<string | null>(null);

  protected readonly timelineEvents = computed(() => {
    const uid = this.timelineUserId();
    if (!uid) return [];
    return this.activityService.getEventsForUser(uid);
  });

  protected readonly uniqueUsers = computed(() => this.activityService.getUniqueUsers());

  // ─── Última actualización ─────────────────────────────────────────────────

  protected readonly lastRefreshed = signal<Date>(new Date());

  // ─── Formulario de filtros ────────────────────────────────────────────────

  protected filterForm!: FormGroup;

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.filterForm = this.fb.group(
      {
        dateFrom: [null, Validators.required],
        dateTo: [null, Validators.required],
        userName: [null],
        userRole: [null],
        warehouse: [null],
        client: [null],
        module: [null],
        action: [null],
        result: [null],
        severity: [null],
        searchText: [null],
        outsideShiftOnly: [false],
        // Filtros avanzados
        sku: [null],
        lot: [null],
        location: [null],
        order: [null],
        shipment: [null],
        ipAddress: [null],
        deviceType: [null],
        sessionId: [null],
      },
      { validators: dateRangeValidator }
    );

    // Precarga: última semana
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    this.filterForm.patchValue({
      dateFrom: this.formatDate(weekAgo),
      dateTo: this.formatDate(today),
    });

    // Carga inicial automática de datos desde el backend al entrar a la pantalla
    this.applyFilters();
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Acciones de filtros ──────────────────────────────────────────────────

  protected applyFilters(): void {
    this.filterForm.markAllAsTouched();
    if (this.filterForm.invalid) return;

    const raw = this.filterForm.value;
    const filters: ActivityFilters = {
      dateFrom: raw.dateFrom || null,
      dateTo: raw.dateTo || null,
      userName: raw.userName || null,
      userRole: raw.userRole || null,
      warehouse: raw.warehouse || null,
      client: raw.client || null,
      module: raw.module || null,
      action: raw.action || null,
      result: raw.result || null,
      severity: raw.severity || null,
      searchText: raw.searchText || null,
      outsideShiftOnly: raw.outsideShiftOnly ?? false,
      sku: raw.sku || null,
      lot: raw.lot || null,
      location: raw.location || null,
      order: raw.order || null,
      shipment: raw.shipment || null,
      ipAddress: raw.ipAddress || null,
      deviceType: raw.deviceType || null,
      sessionId: raw.sessionId || null,
    };

    this.activityService.applyFilters(filters);
    this.resetPagination();
    this.lastRefreshed.set(new Date());
  }

  protected clearFilters(): void {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    this.filterForm.reset({
      dateFrom: this.formatDate(weekAgo),
      dateTo: this.formatDate(today),
      outsideShiftOnly: false,
    });

    this.activityService.clearFilters();
    this.resetPagination();
    this.lastRefreshed.set(new Date());
  }

  protected toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v) => !v);
  }

  // ─── Acciones de la vista ─────────────────────────────────────────────────

  protected setView(view: ActiveView): void {
    this.activeView.set(view);
    if (view === 'TIMELINE') {
      // Reiniciar usuario seleccionado al cambiar de vista
      this.timelineUserId.set(null);
      this.timelineUserName.set(null);
    }
  }

  protected selectTimelineUser(userId: string, userName: string): void {
    this.timelineUserId.set(userId);
    this.timelineUserName.set(userName);
  }

  protected clearTimelineUser(): void {
    this.timelineUserId.set(null);
    this.timelineUserName.set(null);
  }

  // ─── Detalle de evento ────────────────────────────────────────────────────

  protected openDetail(event: UserActivityEvent): void {
    this.selectedEvent.set(event);
  }

  protected closeDetail(): void {
    this.selectedEvent.set(null);
  }

  // ─── Perfiles ────────────────────────────────────────────────────────────

  protected openProfileManager(): void {
    this.showProfileManager.set(true);
  }

  protected closeProfileManager(): void {
    this.showProfileManager.set(false);
  }

  protected applyProfile(profile: ActivityReportProfile): void {
    this.closeProfileManager();

    // Aplicar filtros del perfil al formulario
    this.filterForm.patchValue({
      module: profile.modules.length === 1 ? profile.modules[0] : null,
    });

    this.toastService.info(`Perfil "${profile.name}" aplicado.`);
  }

  // ─── Exportación ─────────────────────────────────────────────────────────

  // ─── Exportación ─────────────────────────────────────────────────────────

  protected export(format: 'XLSX' | 'PDF'): void {
    if (this.isExporting()) return;
    this.isExporting.set(true);

    const events = this.filteredEvents();
    const timestamp = new Date().toISOString().slice(0, 10);

    setTimeout(() => {
      try {
        if (format === 'XLSX') {
          this.downloadExcelFile(events, timestamp);
          this.toastService.success(`Reporte Excel generado correctamente (${events.length} registros).`, 4000);
        } else if (format === 'PDF') {
          this.downloadPdfFile(events, timestamp);
          this.toastService.success(`Reporte PDF generado correctamente (${events.length} registros).`, 4000);
        }
      } catch (err) {
        this.toastService.error('Error al generar la exportación.', 4000);
      } finally {
        this.isExporting.set(false);
      }
    }, 500);
  }

  private downloadExcelFile(events: UserActivityEvent[], timestamp: string): void {
    const headers = [
      'Fecha y Hora',
      'Usuario',
      'Email',
      'Rol',
      'Almacen',
      'Modulo',
      'Accion',
      'Tipo Entidad',
      'ID Entidad',
      'Resultado',
      'Criticidad',
      'Fuera de Horario',
      'Descripcion',
      'Direccion IP',
    ];

    const rows = events.map((e) => [
      `"${new Date(e.occurredAt).toLocaleString('es-MX')}"`,
      `"${e.userName.replace(/"/g, '""')}"`,
      `"${e.userEmail}"`,
      `"${e.userRole}"`,
      `"${e.warehouseName}"`,
      `"${e.module}"`,
      `"${e.action}"`,
      `"${e.entityType}"`,
      `"${e.entityId || ''}"`,
      `"${e.result}"`,
      `"${e.severity}"`,
      `"${e.outsideShift ? 'SI' : 'NO'}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.ipAddress}"`,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Actividad_Usuarios_${timestamp}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private downloadPdfFile(events: UserActivityEvent[], timestamp: string): void {
    const htmlDoc = this.generatePdfHtmlReport(events, timestamp);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback a descarga directa de archivo PDF estructurado
      const blob = new Blob([htmlDoc], { type: 'application/pdf' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Reporte_Actividad_Usuarios_${timestamp}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    printWindow.document.write(htmlDoc);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  private generatePdfHtmlReport(events: UserActivityEvent[], timestamp: string): string {
    const rowsHtml = events
      .map(
        (e) => `
      <tr>
        <td>${new Date(e.occurredAt).toLocaleString('es-MX')}</td>
        <td><strong>${e.userName}</strong><br><small style="color: #64748b;">${e.userEmail}</small></td>
        <td><span style="font-size: 10px; background: #eff6ff; color: #1d4ed8; padding: 2px 5px; border-radius: 4px;">${e.userRole}</span></td>
        <td>${e.module}</td>
        <td><code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-weight: bold;">${e.action}</code></td>
        <td>${e.entityType} ${e.entityId ? '<br><strong style="color: #c5a86b;">#' + e.entityId + '</strong>' : ''}</td>
        <td><span class="badge ${e.result.toLowerCase()}">${e.result}</span></td>
        <td><span class="severity ${e.severity.toLowerCase()}">${e.severity}</span></td>
      </tr>
    `
      )
      .join('');

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Actividad por Usuario - 4GUARD WMS</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #172033; background: #ffffff; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #c5a86b; padding-bottom: 14px; margin-bottom: 20px; }
        .brand { font-size: 22px; font-weight: 800; color: #172033; letter-spacing: -0.5px; }
        .brand span { color: #c5a86b; }
        .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 11px; display: flex; gap: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #172033; color: #ffffff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 9px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        tr:nth-child(even) { background: #f8fafc; }
        .badge { padding: 3px 7px; border-radius: 99px; font-weight: bold; font-size: 9px; text-transform: uppercase; }
        .badge.success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .badge.warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .badge.rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .badge.error { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .severity { font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .severity.info { color: #64748b; }
        .severity.medium { color: #d97706; }
        .severity.high { color: #ea580c; }
        .severity.critical { color: #dc2626; font-weight: 900; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">4GUARD <span>WMS</span> — HU-146</div>
          <div class="subtitle">Consola de Consulta y Trazabilidad de Actividad por Usuario</div>
        </div>
      </div>
      <div class="meta-box">
        <div><strong>Fecha de emisión:</strong> ${new Date().toLocaleString('es-MX')}</div>
        <div><strong>Eventos incluidos:</strong> ${events.length}</div>
        <div><strong>Filtro aplicado:</strong> Rango actual en pantalla</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Fecha / Hora</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Módulo</th>
            <th>Acción</th>
            <th>Entidad</th>
            <th>Resultado</th>
            <th>Criticidad</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="footer">Documento auditable de solo lectura generado por el sistema 4GUARD WMS.</div>
    </body>
    </html>`;
  }

  // ─── Actualizar datos ─────────────────────────────────────────────────────

  protected refresh(): void {
    this.activityService.isLoading.set(true);
    this.activityService
      .refreshEvents()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.activityService.completeLoad();
        this.lastRefreshed.set(new Date());
        this.toastService.success('Datos actualizados.', 2500);
      });
  }

  // ─── Paginación ───────────────────────────────────────────────────────────

  protected goToPage(page: number): void {
    const total = this.totalPages();
    if (page < 0 || page >= total) return;
    this.pageIndex.set(page);
  }

  protected prevPage(): void {
    this.goToPage(this.pageIndex() - 1);
  }

  protected nextPage(): void {
    this.goToPage(this.pageIndex() + 1);
  }

  private resetPagination(): void {
    this.pageIndex.set(0);
  }

  // ─── Helpers de presentación ──────────────────────────────────────────────

  protected resultIcon(result: ActivityResult): string {
    const map: Record<ActivityResult, string> = {
      SUCCESS: 'check_circle',
      WARNING: 'warning',
      REJECTED: 'cancel',
      ERROR: 'error',
    };
    return map[result] ?? 'info';
  }

  protected severityIcon(severity: ActivitySeverity): string {
    const map: Record<ActivitySeverity, string> = {
      INFO: 'info',
      MEDIUM: 'priority_high',
      HIGH: 'error_outline',
      CRITICAL: 'dangerous',
    };
    return map[severity] ?? 'info';
  }

  protected timelineIcon(action: string): string {
    const map: Record<string, string> = {
      LOGIN: 'login',
      LOGOUT: 'logout',
      LOGIN_FAILED: 'no_accounts',
      CREATE_RECEIPT: 'inventory',
      MOVE_STOCK: 'swap_horiz',
      ADJUST_INVENTORY: 'tune',
      BLOCK_LOT: 'block',
      UPDATE_SUPPLIER: 'business',
      CONFIRM_PICKING: 'done_all',
      CANCEL_SHIPMENT: 'cancel',
      EXPORT_REPORT: 'download',
      AUTHORIZATION_ERROR: 'gpp_bad',
      CHANGE_LOCATION: 'shelves',
      CHANGE_ROLE: 'manage_accounts',
      CRITICAL_ACTION: 'warning',
    };
    return map[action] ?? 'circle';
  }

  protected get dateFromCtrl() { return this.filterForm.get('dateFrom')!; }
  protected get dateToCtrl() { return this.filterForm.get('dateTo')!; }

  protected isDateRangeInvalid(): boolean {
    return this.filterForm.hasError('dateRangeInvalid') &&
      (this.dateFromCtrl.touched || this.dateToCtrl.touched);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  /** Retorna una clase CSS semántica por módulo para las pills de color */
  protected moduleClass(module: string): string {
    const map: Record<string, string> = {
      'Autenticación': 'auth',
      'Recepción': 'receiving',
      'Calidad': 'quality',
      'Inventario': 'inventory',
      'Picking': 'picking',
      'Embarques': 'shipping',
      'Proveedores': 'suppliers',
      'Usuarios': 'users',
      'Layout': 'layout',
      'Reportes': 'reports',
    };
    return map[module] ?? 'default';
  }
}
