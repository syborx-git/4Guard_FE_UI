/**
 * @file dock-assignment-drawer.component.ts
 * @description Drawer Enterprise para la Asignación Operativa de Muelle de Descarga [HU-030].
 * Consume DockAssignmentOrchestratorService como única vía transaccional con rollback lógico.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  inject,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReceptionAppointment } from '../../models/reception-appointment.models';
import {
  DockItem,
  DockAssignmentStatus,
  DockOperationalStatus,
  DockEligibilityCheck,
  DockRecommendation,
  DOCK_OVERRIDE_REASONS,
  DOCK_ASSIGNMENT_STATUS_LABELS,
  DOCK_ASSIGNMENT_STATUS_CLASSES,
} from '../../models/dock-assignment.models';
import { DockAssignmentOrchestratorService } from '../../services/dock-assignment-orchestrator.service';

@Component({
  selector: 'app-dock-assignment-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dock-assignment-drawer.component.html',
  styleUrl: './dock-assignment-drawer.component.css',
})
export class DockAssignmentDrawerComponent implements OnChanges, OnDestroy {
  private readonly orchestrator = inject(DockAssignmentOrchestratorService);

  @Input() appointment: ReceptionAppointment | null = null;
  @Input() isOpen = false;

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() dockStatusUpdated = new EventEmitter<{ appointmentId: string; dockCode: string; status: DockAssignmentStatus }>();

  // Signals de Formulario y Estado Interno
  readonly selectedDockCode = signal<string>('');
  readonly overrideReasonCode = signal<string>('');
  readonly overrideReasonNotes = signal<string>('');

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  // Motivos predefinidos para la UI
  readonly overrideReasonOptions = Object.entries(DOCK_OVERRIDE_REASONS).map(([key, label]) => ({ key, label }));

  // Usuario y Capacidades RBAC resueltas dinámicamente
  readonly userContext = computed(() => {
    try {
      return this.orchestrator.resolveDockUserContext();
    } catch {
      return null;
    }
  });

  readonly userRole = computed(() => this.userContext()?.role || 'SIN_SESION');
  readonly userName = computed(() => this.userContext()?.userName || 'Sin Sesión Activa');

  // Evaluadores Granulares de Capacidades RBAC
  readonly canAssign = computed(() => !!this.userContext()?.capabilities.has('DOCK_ASSIGN'));
  readonly canReassign = computed(() => !!this.userContext()?.capabilities.has('DOCK_REASSIGN'));
  readonly canConfirmPositioning = computed(() => !!this.userContext()?.capabilities.has('DOCK_CONFIRM_POSITIONING'));
  readonly canConfirmOccupancy = computed(() => !!this.userContext()?.capabilities.has('DOCK_CONFIRM_OCCUPANCY'));
  readonly canRelease = computed(() => !!this.userContext()?.capabilities.has('DOCK_RELEASE'));

  // 1. HARD GATE: Elegibilidad Operativa
  readonly eligibility = computed<DockEligibilityCheck>(() => {
    return this.orchestrator.evaluateEligibility(this.appointment);
  });

  // 2. RANKING ENGINE: Recomendación Operativa
  readonly recommendation = computed<DockRecommendation | null>(() => {
    const appt = this.appointment;
    if (!appt || !this.eligibility().isEligible) return null;
    return this.orchestrator.recommendDock(appt);
  });

  // Muelles Físicos de la Sucursal Activa
  readonly branchDocks = computed<DockItem[]>(() => {
    if (!this.userContext()) return [];
    return this.orchestrator.getDocksForActiveBranch();
  });

  // Muelle sugerido por el engine
  readonly suggestedDockCode = computed(() => this.recommendation()?.suggestedDockCode || '');

  // Determinar si la selección del usuario difiere de la recomendada
  readonly isManualOverride = computed(() => {
    const selected = this.selectedDockCode();
    const suggested = this.suggestedDockCode();
    return selected !== '' && suggested !== '' && selected !== suggested;
  });

  // Muelle actualmente asignado en la cita
  readonly currentAssignedDockCode = computed(() => this.appointment?.dockNumber || '');

  // Helpers de Labels
  readonly dockAssignmentStatusLabels = DOCK_ASSIGNMENT_STATUS_LABELS;
  readonly dockAssignmentStatusClasses = DOCK_ASSIGNMENT_STATUS_CLASSES;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.errorMessage.set(null);
        this.successMessage.set(null);
        this.overrideReasonCode.set('');
        this.overrideReasonNotes.set('');

        // Inicializar selección con el muelle actual de la cita o la sugerencia del engine
        if (this.appointment?.dockNumber) {
          this.selectedDockCode.set(this.appointment.dockNumber);
        } else {
          const rec = this.recommendation();
          if (rec && rec.suggestedDockCode) {
            this.selectedDockCode.set(rec.suggestedDockCode);
          } else {
            this.selectedDockCode.set('');
          }
        }

        this._lockScroll();
      } else {
        this._unlockScroll();
      }
    }
  }

  ngOnDestroy(): void {
    this._unlockScroll();
  }

  @HostListener('window:keydown.escape', ['$event'])
  handleEscape(event: KeyboardEvent): void {
    if (this.isOpen) {
      event.preventDefault();
      this.onClose();
    }
  }

  onClose(): void {
    this._unlockScroll();
    this.closeDrawer.emit();
  }

  /**
   * Helper Visual (Categoría B): Evalúa el estado de reserva de un muelle diferenciando propietario, expiración y deshabilitado visual.
   */
  protected getDockReservationStatusInfo(dock: DockItem): { label: string; isSelectable: boolean; isCurrentAppointment: boolean; isExpired: boolean } {
    const currentApptId = this.appointment?.id;

    if (dock.operationalStatus !== 'RESERVED') {
      return {
        label: dock.operationalStatus === 'AVAILABLE' ? 'Disponible para selección' : `Estado: ${dock.operationalStatus}`,
        isSelectable: dock.operationalStatus === 'AVAILABLE',
        isCurrentAppointment: false,
        isExpired: false,
      };
    }

    const isOwner = dock.reservedAppointmentId === currentApptId;
    const expiresAt = dock.reservationExpiresAt;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

    if (isOwner) {
      return {
        label: isExpired ? 'Reservado para esta recepción (Reserva vencida)' : 'Reservado para esta recepción',
        isSelectable: true,
        isCurrentAppointment: true,
        isExpired,
      };
    }

    if (!dock.reservedAppointmentId) {
      return {
        label: 'Reservado (Propietario no verificado)',
        isSelectable: false,
        isCurrentAppointment: false,
        isExpired,
      };
    }

    if (isExpired) {
      return {
        label: `Reservado por ${dock.reservedAppointmentId} (Reserva vencida - Pendiente de liberación)`,
        isSelectable: false,
        isCurrentAppointment: false,
        isExpired: true,
      };
    }

    return {
      label: `Reservado por la recepción ${dock.reservedAppointmentId}`,
      isSelectable: false,
      isCurrentAppointment: false,
      isExpired: false,
    };
  }

  selectDock(code: string, status: DockOperationalStatus, reservedApptId?: string): void {
    const currentApptId = this.appointment?.id;

    // Regla de Selección: Permitir AVAILABLE o RESERVED por la misma cita
    if (status === 'RESERVED' && reservedApptId === currentApptId) {
      this.errorMessage.set(null);
      this.selectedDockCode.set(code);
      return;
    }

    if (status === 'OCCUPIED' || status === 'MAINTENANCE' || status === 'BLOCKED' || status === 'OUT_OF_SERVICE' || status === 'RESERVED') {
      const detail = status === 'RESERVED' ? `reservado por otra recepción (${reservedApptId})` : `en estado ${status}`;
      this.errorMessage.set(`El muelle ${code} se encuentra ${detail} (No disponible para selección).`);
      return;
    }

    this.errorMessage.set(null);
    this.selectedDockCode.set(code);
  }

  acceptRecommendation(): void {
    const sug = this.suggestedDockCode();
    if (sug) {
      this.selectedDockCode.set(sug);
      this.confirmAssignment();
    }
  }

  async confirmAssignment(): Promise<void> {
    const appt = this.appointment;
    const selectedCode = this.selectedDockCode();

    if (!appt) return;
    if (!selectedCode) {
      this.errorMessage.set('Debe seleccionar un muelle para proceder.');
      return;
    }

    // Excepción Manual: exigir motivo obligatorio
    if (this.isManualOverride()) {
      const reasonCode = this.overrideReasonCode();
      if (!reasonCode) {
        this.errorMessage.set('Ha seleccionado un muelle distinto al recomendado. Seleccione un motivo de excepción obligatoriamente.');
        return;
      }
      if (reasonCode === 'OTHER') {
        const notes = this.overrideReasonNotes().trim();
        if (notes.length < 10) {
          this.errorMessage.set('Para el motivo "Otro", ingrese observaciones de al menos 10 caracteres.');
          return;
        }
      }
    }

    try {
      this.isSubmitting.set(true);
      this.errorMessage.set(null);

      // Si ya tenía un muelle asignado y se está cambiando por otro -> Reasignación Segura
      if (appt.dockNumber && appt.dockNumber !== selectedCode) {
        const result = await this.orchestrator.reassignDock({
          appointmentId: appt.id,
          oldDockCode: appt.dockNumber,
          newDockCode: selectedCode,
          overrideReasonCode: this.overrideReasonCode() || 'OPERATIONAL_REORGANIZATION',
          overrideReasonNotes: this.overrideReasonNotes(),
        });
        this.successMessage.set(result.message);
        this.dockStatusUpdated.emit({ appointmentId: appt.id, dockCode: selectedCode, status: 'REASSIGNED' });
      } else {
        // Reserva / Asignación directa
        const result = await this.orchestrator.reserveDock({
          appointmentId: appt.id,
          dockCode: selectedCode,
          overrideReasonCode: this.isManualOverride() ? this.overrideReasonCode() : undefined,
          overrideReasonNotes: this.isManualOverride() ? this.overrideReasonNotes() : undefined,
        });
        this.successMessage.set(result.message);
        this.dockStatusUpdated.emit({ appointmentId: appt.id, dockCode: selectedCode, status: 'RESERVED' });
      }

      setTimeout(() => {
        this.isSubmitting.set(false);
        this.onClose();
      }, 700);
    } catch (e: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(e?.message || 'Error al asignar el muelle.');
    }
  }

  async confirmPositioning(): Promise<void> {
    const appt = this.appointment;
    if (!appt || !appt.dockNumber) return;

    try {
      this.isSubmitting.set(true);
      this.errorMessage.set(null);

      const result = await this.orchestrator.startPositioning({
        appointmentId: appt.id,
        dockCode: appt.dockNumber,
      });

      this.successMessage.set(result.message);
      this.dockStatusUpdated.emit({ appointmentId: appt.id, dockCode: appt.dockNumber, status: 'POSITIONING' });

      setTimeout(() => {
        this.isSubmitting.set(false);
        this.onClose();
      }, 700);
    } catch (e: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(e?.message || 'Error al iniciar posicionamiento.');
    }
  }

  async confirmOccupancy(): Promise<void> {
    const appt = this.appointment;
    if (!appt || !appt.dockNumber) return;

    try {
      this.isSubmitting.set(true);
      this.errorMessage.set(null);

      const result = await this.orchestrator.confirmOccupancy({
        appointmentId: appt.id,
        dockCode: appt.dockNumber,
      });

      this.successMessage.set(result.message);
      this.dockStatusUpdated.emit({ appointmentId: appt.id, dockCode: appt.dockNumber, status: 'OCCUPIED' });

      setTimeout(() => {
        this.isSubmitting.set(false);
        this.onClose();
      }, 700);
    } catch (e: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(e?.message || 'Error al confirmar ocupación.');
    }
  }

  async releaseDock(): Promise<void> {
    const appt = this.appointment;
    if (!appt || !appt.dockNumber) return;

    try {
      this.isSubmitting.set(true);
      this.errorMessage.set(null);

      const result = await this.orchestrator.releaseDock({
        appointmentId: appt.id,
        dockCode: appt.dockNumber,
      });

      this.successMessage.set(result.message);
      this.dockStatusUpdated.emit({ appointmentId: appt.id, dockCode: appt.dockNumber, status: 'RELEASED' });

      setTimeout(() => {
        this.isSubmitting.set(false);
        this.onClose();
      }, 700);
    } catch (e: any) {
      this.isSubmitting.set(false);
      this.errorMessage.set(e?.message || 'Error al liberar el muelle.');
    }
  }

  private _lockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private _unlockScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }
}
