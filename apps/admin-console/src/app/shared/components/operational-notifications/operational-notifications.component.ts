import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ElementRef,
  HostListener,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState } from '../../../core/auth/auth.state';
import { SmartNotificationService } from '../../../core/services/smart-notification.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { QualityStateService } from '../../../features/quality/services/quality-state.service';

export type NotificationTab = 'ALL' | 'RECEIVING' | 'SECURITY' | 'QUALITY';

@Component({
  selector: 'fg-operational-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './operational-notifications.component.html',
  styleUrl: './operational-notifications.component.css'
})
export class OperationalNotificationsComponent implements OnInit, OnDestroy {
  private readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly smartNotification = inject(SmartNotificationService);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly qualityService = inject(QualityStateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);

  // ── Estado de apertura del dropdown ──
  public readonly isOpen = signal<boolean>(false);
  protected readonly selectedTab = signal<NotificationTab>('ALL');

  // ── Almacén / Pre-Recepciones ──
  public readonly pendingReceptions = this.movementsService.pendingReceptions;
  public readonly pendingReceptionsCount = this.movementsService.pendingReceptionsCount;
  public readonly hasNewUnseenPreReception = signal<boolean>(false);

  // ── Caseta / Seguridad (Choferes QR + Rampas Asignadas) ──
  public readonly pendingDriverPasses = this.smartNotification.pendingDriverPasses;
  public readonly pendingDriverPassesCount = this.smartNotification.pendingDriverPassesCount;
  public readonly hasNewUnseenDriverPass = this.smartNotification.hasNewDriverSubmission;

  public readonly pendingRampAssignments = this.smartNotification.pendingRampAssignments;
  public readonly pendingRampAssignmentsCount = this.smartNotification.pendingRampAssignmentsCount;
  public readonly hasNewRampAssignment = this.smartNotification.hasNewRampAssignment;

  public readonly totalSecurityAlertsCount = computed(() =>
    this.pendingDriverPassesCount() + this.pendingRampAssignmentsCount()
  );

  // ── Calidad / Bloqueos QM ──
  public readonly blockedQualityItems = computed(() =>
    this.qualityService.blocks().filter(b => b.status === 'BLOCKED')
  );
  public readonly blockedQualityCount = computed(() => this.blockedQualityItems().length);

  // ── Roles y Contexto Activo (Supervisor Global enfocado 100% en Recepción) ──
  public readonly isSecurityUser = computed(() => {
    const role = (this.authState.role() || '').toUpperCase();
    const url = this.router.url;
    return (
      (role.includes('SECURITY') ||
       role.includes('VIGILAN') ||
       role.includes('GUARD') ||
       role.includes('CASETA')) &&
      !role.includes('ADMIN') &&
      !role.includes('MANAGER')
    ) || url.startsWith('/security');
  });

  public readonly isQualityUser = computed(() => {
    const role = (this.authState.role() || '').toUpperCase();
    const url = this.router.url;
    return (
      (role.includes('QM') ||
       role.includes('QUALIT') ||
       role.includes('CALIDAD') ||
       role.includes('INSPECT') ||
       role.includes('AUDIT')) &&
      !role.includes('ADMIN') &&
      !role.includes('MANAGER')
    ) || url.startsWith('/quality');
  });

  // Por defecto, Supervisor Global, Administrador y Almacén están en contexto Recepción
  public readonly isReceivingContext = computed(() => {
    return !this.isSecurityUser() && !this.isQualityUser();
  });

  public readonly isSecurityContext = computed(() => this.isSecurityUser());
  public readonly isQualityContext = computed(() => this.isQualityUser());

  public readonly isCurrentlyOnSecurityPage = computed(() => {
    return this.router.url.startsWith('/security');
  });

  public readonly isCurrentlyOnReceivingPage = computed(() => {
    return this.router.url.startsWith('/warehouse-movements') || this.router.url.startsWith('/receiving');
  });

  public readonly isCurrentlyOnQualityPage = computed(() => {
    return this.router.url.startsWith('/quality');
  });

  public readonly showFooterButton = computed(() => {
    if (this.isSecurityContext()) {
      return !this.isCurrentlyOnSecurityPage();
    }
    if (this.isQualityContext()) {
      return !this.isCurrentlyOnQualityPage();
    }
    return !this.isCurrentlyOnReceivingPage();
  });

  // ── Total de Notificaciones Visibles según Contexto del Usuario ──
  public readonly totalVisibleCount = computed(() => {
    if (this.isSecurityContext()) return this.totalSecurityAlertsCount();
    if (this.isQualityContext()) return this.blockedQualityCount();
    // Supervisor Global / Almacén: Estrictamente Pre-Recepciones
    return this.pendingReceptionsCount();
  });

  public readonly hasNewArrivalBeacon = computed(() => {
    if (this.isSecurityContext()) return this.hasNewUnseenDriverPass() || this.hasNewRampAssignment();
    if (this.isQualityContext()) return false;
    return this.hasNewUnseenPreReception();
  });

  private autoCloseTimeoutId: any = null;

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.autoCloseTimeoutId) {
      clearTimeout(this.autoCloseTimeoutId);
    }
  }

  // ── Disparador de Llegadas en Vivo ──
  public triggerArrival(category: 'RECEIVING' | 'SECURITY' | 'QUALITY'): void {
    if (category === 'RECEIVING' && this.isReceivingContext()) {
      this.hasNewUnseenPreReception.set(true);
      this.isOpen.set(true);
      this.playChime();
    } else if (category === 'SECURITY' && this.isSecurityContext()) {
      this.isOpen.set(true);
      this.playChime();
    }

    if (this.autoCloseTimeoutId) clearTimeout(this.autoCloseTimeoutId);
    this.autoCloseTimeoutId = setTimeout(() => {
      this.isOpen.set(false);
      this.hasNewUnseenPreReception.set(false);
      this.smartNotification.hasNewDriverSubmission.set(false);
      this.smartNotification.hasNewRampAssignment.set(false);
    }, 12000);
  }

  // ── Control de Apertura y Cierre ──
  public toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.hasNewUnseenPreReception.set(false);
    this.smartNotification.hasNewDriverSubmission.set(false);
    this.smartNotification.hasNewRampAssignment.set(false);
    if (this.autoCloseTimeoutId) clearTimeout(this.autoCloseTimeoutId);
    this.isOpen.update(v => !v);
  }

  public closeDropdown(): void {
    this.isOpen.set(false);
    this.hasNewUnseenPreReception.set(false);
    this.smartNotification.hasNewDriverSubmission.set(false);
    this.smartNotification.hasNewRampAssignment.set(false);
    if (this.autoCloseTimeoutId) clearTimeout(this.autoCloseTimeoutId);
  }

  public setTab(tab: NotificationTab): void {
    this.selectedTab.set(tab);
  }

  // ── Acciones de Recepción ──
  public openReception(folio: string): void {
    this.closeDropdown();
    this.router.navigate(['/warehouse-movements/receiving'], { queryParams: { folio } });
  }

  public goToReceptionsModule(): void {
    this.closeDropdown();
    this.router.navigate(['/warehouse-movements/receiving']);
  }

  // ── Acciones de Caseta ──
  public openDriverPass(pass: any): void {
    this.closeDropdown();
    const token = pass.token || pass.id || pass.qrCode;
    this.smartNotification.requestLoadDriverPass(pass);
    this.router.navigate(['/security'], { queryParams: { token } });
  }

  public openRampAlert(ramp: any): void {
    this.closeDropdown();
    this.smartNotification.dismissRampAssignment(ramp.folio);
    this.router.navigate(['/security'], { queryParams: { folio: ramp.folio } });
  }

  public dismissRamp(event: MouseEvent, folio: string): void {
    event.stopPropagation();
    this.smartNotification.dismissRampAssignment(folio);
  }

  public goToSecurityModule(): void {
    this.closeDropdown();
    this.router.navigate(['/security']);
  }

  // ── Acciones de Calidad ──
  public openQualityBlock(block: any): void {
    this.closeDropdown();
    this.router.navigate(['/quality/blocks'], { queryParams: { folio: block.folio || block.id } });
  }

  public goToQualityModule(): void {
    this.closeDropdown();
    this.router.navigate(['/quality']);
  }

  // ── Cierre al hacer click fuera del componente ──
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside && this.isOpen()) {
      this.closeDropdown();
    }
  }

  // ── Sonido de Notificación ──
  public playChime(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }
}
