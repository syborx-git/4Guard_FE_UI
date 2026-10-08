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
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthState } from '../../../core/auth/auth.state';
import { SmartNotificationService } from '../../../core/services/smart-notification.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { QualityStateService } from '../../../features/quality/services/quality-state.service';

export type NotificationTab = 'ALL' | 'RECEIVING' | 'OUTBOUND' | 'SECURITY' | 'QUALITY';

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

  // ── URL Activa como Señal Reactiva ──
  public readonly currentUrl = signal<string>(this.router.url);
  private routerSub?: Subscription;

  // ── Estado de apertura del dropdown ──
  public readonly isOpen = signal<boolean>(false);
  protected readonly selectedTab = signal<NotificationTab>('ALL');

  // ── Almacén / Pre-Recepciones (Inbound) ──
  public readonly pendingReceptions = this.movementsService.pendingReceptions;
  public readonly pendingReceptionsCount = this.movementsService.pendingReceptionsCount;
  public readonly hasNewUnseenPreReception = signal<boolean>(false);

  // ── Almacén / Pre-Salidas (Outbound) ──
  public readonly pendingOutbounds = this.movementsService.pendingOutbounds;
  public readonly pendingOutboundsCount = this.movementsService.pendingOutboundsCount;
  public readonly hasNewUnseenOutbound = signal<boolean>(false);

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

  // ── Roles y Contexto Activo Reactivo ──
  public readonly isCurrentlyOnSecurityPage = computed(() => {
    return this.currentUrl().startsWith('/security');
  });

  public readonly isCurrentlyOnOutboundPage = computed(() => {
    return this.currentUrl().includes('/warehouse-movements/outbound') || this.currentUrl().includes('/outbound');
  });

  public readonly isCurrentlyOnReceivingPage = computed(() => {
    const url = this.currentUrl();
    return url.includes('/warehouse-movements/receiving') || 
           url.includes('/receiving') || 
           (url.startsWith('/warehouse-movements') && !url.includes('/outbound') && !url.includes('/transfers'));
  });

  public readonly isCurrentlyOnQualityPage = computed(() => {
    return this.currentUrl().startsWith('/quality');
  });

  public readonly isSecurityUser = computed(() => {
    const role = (this.authState.role() || '').toUpperCase();
    return (
      (role.includes('SECURITY') ||
       role.includes('VIGILAN') ||
       role.includes('GUARD') ||
       role.includes('CASETA')) &&
      !role.includes('ADMIN') &&
      !role.includes('MANAGER')
    ) || this.isCurrentlyOnSecurityPage();
  });

  public readonly isQualityUser = computed(() => {
    const role = (this.authState.role() || '').toUpperCase();
    return (
      (role.includes('QM') ||
       role.includes('QUALIT') ||
       role.includes('CALIDAD') ||
       role.includes('INSPECT') ||
       role.includes('AUDIT')) &&
      !role.includes('ADMIN') &&
      !role.includes('MANAGER')
    ) || this.isCurrentlyOnQualityPage();
  });

  public readonly isSecurityContext = computed(() => this.isCurrentlyOnSecurityPage() || (this.isSecurityUser() && !this.isCurrentlyOnReceivingPage() && !this.isCurrentlyOnOutboundPage()));
  public readonly isQualityContext = computed(() => this.isCurrentlyOnQualityPage() || (this.isQualityUser() && !this.isCurrentlyOnReceivingPage() && !this.isCurrentlyOnOutboundPage()));
  public readonly isOutboundContext = computed(() => this.isCurrentlyOnOutboundPage());
  public readonly isReceivingContext = computed(() => this.isCurrentlyOnReceivingPage() || (!this.isSecurityContext() && !this.isQualityContext() && !this.isOutboundContext()));

  public readonly showFooterButton = computed(() => {
    if (this.isSecurityContext()) {
      return !this.isCurrentlyOnSecurityPage();
    }
    if (this.isQualityContext()) {
      return !this.isCurrentlyOnQualityPage();
    }
    if (this.isOutboundContext()) {
      return !this.isCurrentlyOnOutboundPage();
    }
    return !this.isCurrentlyOnReceivingPage();
  });

  // ── Total de Notificaciones Visibles según Contexto del Usuario ──
  public readonly totalVisibleCount = computed(() => {
    if (this.isSecurityContext()) return this.totalSecurityAlertsCount();
    if (this.isQualityContext()) return this.blockedQualityCount();
    if (this.isOutboundContext()) return this.pendingOutboundsCount();
    if (this.isReceivingContext()) return this.pendingReceptionsCount();
    
    // Fallback general si está en dashboard u otra ruta neutra
    if (this.pendingReceptionsCount() > 0) return this.pendingReceptionsCount();
    if (this.pendingOutboundsCount() > 0) return this.pendingOutboundsCount();
    return 0;
  });

  public readonly hasNewArrivalBeacon = computed(() => {
    if (this.isSecurityContext()) return this.hasNewUnseenDriverPass() || this.hasNewRampAssignment();
    if (this.isQualityContext()) return false;
    if (this.isOutboundContext()) return this.hasNewUnseenOutbound();
    return this.hasNewUnseenPreReception();
  });

  private autoCloseTimeoutId: any = null;

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      this.currentUrl.set(e.urlAfterRedirects || e.url);
    });
  }

  ngOnDestroy(): void {
    if (this.autoCloseTimeoutId) {
      clearTimeout(this.autoCloseTimeoutId);
    }
    this.routerSub?.unsubscribe();
  }

  // ── Disparador de Llegadas en Vivo ──
  public triggerArrival(category: 'RECEIVING' | 'OUTBOUND' | 'SECURITY' | 'QUALITY'): void {
    if (category === 'RECEIVING' && this.isReceivingContext()) {
      this.hasNewUnseenPreReception.set(true);
      this.isOpen.set(true);
      this.playChime();
    } else if (category === 'OUTBOUND' && this.isOutboundContext()) {
      this.hasNewUnseenOutbound.set(true);
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
      this.hasNewUnseenOutbound.set(false);
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

  // ── Acciones de Salidas / Outbound ──
  public openOutbound(folio: string): void {
    this.closeDropdown();
    this.router.navigate(['/warehouse-movements/outbound'], { queryParams: { folio } });
  }

  public goToOutboundModule(): void {
    this.closeDropdown();
    this.router.navigate(['/warehouse-movements/outbound']);
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
