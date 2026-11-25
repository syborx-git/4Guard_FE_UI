/**
 * @file rf-shell.component.ts
 * @description Shell layout maestro del RF Terminal PWA.
 * Incluye header industrial con reloj en vivo (Fecha & Hora), semáforo de red,
 * indicador Zone Lease, switcher Dark/Light, simulador de escaneo, menú de perfil de usuario
 * con detalles de sesión/turno y cierre seguro de cuenta.
 */

import { Component, inject, signal, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthState, SyncState, UserRole } from '@4guard/shared-core';
import { RfThemeService } from '../../../core/services/rf-theme.service';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

import { OfflineBannerComponent } from '../offline-banner/offline-banner.component';
import { ToastContainerComponent } from '../toast-container/toast-container.component';
import { RfNotificationsComponent } from '../rf-notifications/rf-notifications.component';
import { RfForbotModalComponent } from '../forbot/rf-forbot-modal.component';
import { RfChatModalComponent } from '../chat/rf-chat-modal.component';
import { ToastService } from '@4guard/shared-core';
import { PwaService } from '../../../core/services/pwa.service';
import { HardwareMonitorService } from '../../../core/services/hardware-monitor.service';
import { RfChatService } from '../../../core/services/rf-chat.service';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badge?: number;
}

@Component({
  selector: 'fg-rf-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    OfflineBannerComponent,
    ToastContainerComponent,
    RfNotificationsComponent,
    RfForbotModalComponent,
    RfChatModalComponent
  ],
  templateUrl: './rf-shell.component.html',
  styleUrl: './rf-shell.component.css',
})

export class RfShellComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly themeService = inject(RfThemeService);
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly toast = inject(ToastService);
  protected readonly pwaService = inject(PwaService);
  protected readonly hardwareMonitor = inject(HardwareMonitorService);
  protected readonly rfChat = inject(RfChatService);

  protected readonly userRoles = UserRole;
  protected readonly showIosModal = signal(false);

  private clockIntervalId: any = null;

  // ─── Reloj en Vivo Global (Fecha y Hora) ──────────────────────────────────
  protected readonly currentTime = signal(new Date());

  protected readonly formattedDate = computed(() => {
    const d = this.currentTime();
    return d.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();
  });

  protected readonly formattedTime = computed(() => {
    const d = this.currentTime();
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  });

  // ─── Estado de Scroll del Banner Superior ─────────────────────────────────
  protected readonly isScrolled = signal(false);

  // ─── Menú de Perfil de Usuario & Cierre de Sesión ─────────────────────────
  protected readonly showProfileMenu = signal(false);
  protected readonly showLogoutConfirmModal = signal(false);

  // ─── Estado de Conectividad en Tiempo Real ───────────────────────────────
  protected readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  private readonly handleOnline = () => this.isOnline.set(true);
  private readonly handleOffline = () => this.isOnline.set(false);

  // ─── Datos Computados del Perfil ──────────────────────────────────────────
  protected readonly displayUserName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Usuario 4GUARD';
  });

  protected readonly displayUserInitials = computed(() => {
    const initials = this.authState.userInitials();
    return initials || '4G';
  });

  protected readonly displayRole = computed(() => {
    return this.authState.roleLabel() || 'Operador de Almacén';
  });

  protected readonly displayUsername = computed(() => {
    const u = this.authState.user();
    if (!u) return 'usuario';
    return (u as any)?.username || (u.email ? u.email.split('@')[0] : 'usuario');
  });

  protected readonly displayBranch = computed(() => {
    const u = this.authState.user();
    return u?.branchName || (u as any)?.organizationName || '4GUARD LOGISTICS CORP';
  });

  protected readonly deviceInfo = computed(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) return 'Terminal Móvil Android (RF)';
    if (/iPhone|iPad/i.test(ua)) return 'Dispositivo Móvil iOS';
    if (/Windows/i.test(ua)) return 'Estación de Trabajo (Windows)';
    return 'Terminal RF Web';
  });

  protected readonly currentUrl = signal<string>(this.router.url);

  // ─── Área / Módulo Asignado (Módulo Activo en Header) ────────────────────
  protected readonly activeZoneName = computed(() => {
    const url = this.currentUrl();
    const role = this.authState.role();

    if (url.includes('/security')) return 'Caseta de Vigilancia';
    if (url.includes('/quality')) return 'Control de Calidad';
    if (url.includes('/receiving')) return 'Descarga en Andén';
    if (url.includes('/picking')) return 'Carga en Andén';
    if (url.includes('/putaway')) return 'Acomodo en Racks';
    if (url.includes('/cockpit')) return 'Mis Maniobras';
    if (url.includes('/counting')) return 'Revisión de Inventario';
    if (url.includes('/sync')) return 'Sincronización';

    // Si está en /menu o inicio, mostrar área acorde al rol activo
    if (role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_ASSISTANT) {
      return 'Caseta de Vigilancia';
    }
    if (role === UserRole.QM_INSPECTOR || role === UserRole.QUALITY_ASSISTANT) {
      return 'Estación de Calidad';
    }
    return 'Terminal Montacargas';
  });

  protected readonly leaseIcon = computed(() => {
    const url = this.currentUrl();
    const role = this.authState.role();

    if (url.includes('/security')) return 'local_police';
    if (url.includes('/quality')) return 'verified_user';
    if (url.includes('/receiving')) return 'move_to_inbox';
    if (url.includes('/picking')) return 'local_shipping';
    if (url.includes('/putaway')) return 'inventory_2';
    if (url.includes('/cockpit')) return 'forklift';
    if (url.includes('/counting')) return 'checklist_rtl';
    if (url.includes('/sync')) return 'sync';

    if (role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_ASSISTANT) {
      return 'local_police';
    }
    if (role === UserRole.QM_INSPECTOR || role === UserRole.QUALITY_ASSISTANT) {
      return 'verified_user';
    }
    return 'forklift';
  });

  protected readonly leaseBadgeTooltip = computed(() => {
    return `Módulo Activo: ${this.activeZoneName()}`;
  });

  // ─── Modal Simulador de Escaneo ──────────────────────────────────────────────
  protected readonly showScanModal = signal(false);
  protected readonly simulatedBarcode = signal('SSCC-175012345000000018');

  // ─── Catálogo Maestro de Accesos de Piso ─────────────────────────────────────
  private readonly allNavItems: NavItem[] = [
    { path: '/menu', icon: 'grid_view', label: 'Inicio' },
    { path: '/receiving', icon: 'move_to_inbox', label: 'Descargar' },
    { path: '/picking', icon: 'local_shipping', label: 'Cargar' },
    { path: '/putaway', icon: 'inventory_2', label: 'Acomodar' },
    { path: '/cockpit', icon: 'forklift', label: 'Maniobras' },
    { path: '/counting', icon: 'checklist_rtl', label: 'Inventario' },
    { path: '/quality', icon: 'verified_user', label: 'Calidad' },
    { path: '/security', icon: 'local_police', label: 'Caseta' },
    { path: '/sync', icon: 'sync', label: 'Sync' },
  ];

  // ─── Navegación Inferior Dinámica según Perfil RBAC ──────────────────────────
  protected readonly navItems = computed<NavItem[]>(() => {
    const role = this.authState.role();
    if (!role) return this.allNavItems;

    // Regla 1: Guardia y Ayudante de Seguridad -> Inicio y Caseta
    if (role === UserRole.SECURITY_GUARD || role === UserRole.SECURITY_ASSISTANT) {
      return [
        { path: '/menu', icon: 'grid_view', label: 'Inicio' },
        { path: '/security', icon: 'local_police', label: 'Caseta' },
      ];
    }

    // Regla 2: Calidad QM y Ayudante -> Inicio y Calidad
    if (role === UserRole.QM_INSPECTOR || role === UserRole.QUALITY_ASSISTANT) {
      return [
        { path: '/menu', icon: 'grid_view', label: 'Inicio' },
        { path: '/quality', icon: 'verified_user', label: 'Calidad' },
      ];
    }

    // Regla 3: Montacarguista -> Acciones directas y claras de almacén
    if (role === UserRole.WAREHOUSE_OPERATOR) {
      return [
        { path: '/menu', icon: 'grid_view', label: 'Inicio' },
        { path: '/receiving', icon: 'move_to_inbox', label: 'Descargar' },
        { path: '/picking', icon: 'local_shipping', label: 'Cargar' },
        { path: '/putaway', icon: 'inventory_2', label: 'Acomodar' },
      ];
    }

    // Regla 4: Líder de Turno (LT)
    if (role === UserRole.SHIFT_LEADER) {
      return [
        { path: '/menu', icon: 'grid_view', label: 'Inicio' },
        { path: '/receiving', icon: 'move_to_inbox', label: 'Descargar' },
        { path: '/picking', icon: 'local_shipping', label: 'Cargar' },
        { path: '/putaway', icon: 'inventory_2', label: 'Acomodar' },
      ];
    }

    // Mesa de Control, Supervisores y Admins: Navegación completa
    return this.allNavItems;
  });

  ngOnInit(): void {
    // Sincronizar URL activa para contexto dinámico del header
    this.router.events.subscribe(() => {
      this.currentUrl.set(this.router.url);
    });

    // Actualizar reloj en tiempo real cada segundo
    this.clockIntervalId = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // Escuchar eventos reales de conexión y desconexión de red
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Iniciar polling de Mensajería 4GUARD cada 5s
    if (this.authState.isAuthenticated()) {
      this.rfChat.startPolling();
    }

    // Bienvenida contextual al operador activo
    setTimeout(() => {
      const userName = this.displayUserName();
      const roleName = this.displayRole();
      if (this.authState.isAuthenticated()) {
        this.toast.info(
          `Sesión activa: ${userName} (${roleName}).`,
          'SISTEMA WMS'
        );
      }
    }, 500);

    if (this.syncState.hasPending()) {
      setTimeout(() => {
        this.toast.warning(
          `Tienes ${this.syncState.pendingCount()} transacciones en cola local pendiente de sincronización.`,
          'COLA OFFLINE'
        );
      }, 2300);
    }
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
    this.rfChat.stopPolling();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // ─── Control de Scroll del Banner Superior ───────────────────────────────
  onMainScroll(event: Event): void {
    const target = event.target as HTMLElement;
    if (target) {
      this.isScrolled.set(target.scrollTop > 8);
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY > 8) {
      this.isScrolled.set(true);
    }
  }

  // ─── Evento ESC para cerrar modales flotantes ─────────────────────────────
  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    if (this.showProfileMenu()) {
      this.closeProfileMenu();
    }
    if (this.showLogoutConfirmModal()) {
      this.closeLogoutConfirmModal();
    }
    if (this.showScanModal()) {
      this.closeScanSimulator();
    }
    if (this.showChatModal()) {
      this.closeChatModal();
    }
  }

  // ─── Métodos del Perfil de Usuario ────────────────────────────────────────
  toggleProfileMenu(): void {
    this.showProfileMenu.update((v) => !v);
    this.audioService.playSuccess();
  }

  closeProfileMenu(): void {
    this.showProfileMenu.set(false);
  }

  openLogoutConfirm(): void {
    this.showProfileMenu.set(false);
    this.showLogoutConfirmModal.set(true);
    this.audioService.playWarning();
  }

  closeLogoutConfirmModal(): void {
    this.showLogoutConfirmModal.set(false);
  }

  confirmLogout(): void {
    this.showLogoutConfirmModal.set(false);
    this.audioService.playSuccess();

    if (navigator.vibrate) {
      navigator.vibrate([40, 80, 40]);
    }

    // Ejecuta cierre de sesión y redirección
    this.authState.logout('Cierre de turno por el operador');
    this.router.navigate(['/login']);
  }

  navigateTo(path: string): void {
    this.closeProfileMenu();
    this.router.navigate([path]);
    this.audioService.playSuccess();
  }


  /** Alterna el tema Dark/Light */
  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.audioService.playSuccess();
  }

  /** Abre el simulador de escaneo */
  openScanSimulator(): void {
    this.showScanModal.set(true);
  }

  /** Cierra el simulador */
  closeScanSimulator(): void {
    this.showScanModal.set(false);
  }

  /** Dispara un escaneo simulado emitiendo eventos de teclado a la ventana */
  triggerSimulatedScan(code: string): void {
    this.audioService.playSuccess();
    this.closeScanSimulator();

    // Despachar evento KeyboardEvent como si fuera el láser
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    // Inyectar en inputs activos o en window
    const activeEl = document.activeElement as HTMLInputElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      activeEl.value = code;
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      activeEl.dispatchEvent(enterEvent);
    } else {
      window.dispatchEvent(new CustomEvent('rf:barcode-scanned', { detail: code }));
    }

    this.toast.success(`Código ${code} capturado y validado.`, 'ESCÁNER LÁSER');
  }

  // ─── PWA & Hardware Methods ───────────────────────────────────────────────

  /** Lanza el prompt nativo de instalación de la PWA */
  async promptInstallPwa(): Promise<void> {
    const outcome = await this.pwaService.promptInstall();
    if (outcome === 'accepted') {
      this.toast.success('4GUARD Terminal instalada correctamente en el dispositivo.', 'PWA INSTALADA');
    }
  }

  /** Abre instrucciones de instalación para iPad / iPhone */
  openIosInstallModal(): void {
    this.showIosModal.set(true);
  }

  /** Cierra instrucciones de instalación para iPad / iPhone */
  closeIosInstallModal(): void {
    this.showIosModal.set(false);
  }

  /** Alterna el bloqueo de suspensión de pantalla */
  async toggleWakeLock(): Promise<void> {
    if (this.pwaService.wakeLockActive()) {
      await this.pwaService.releaseWakeLock();
      this.toast.info('Bloqueo de pantalla desactivado.', 'PANTALLA');
    } else {
      const ok = await this.pwaService.requestWakeLock();
      if (ok) {
        this.toast.success('Pantalla configurada siempre activa para escaneo continuo.', 'WAKE LOCK ACTIVO');
      } else {
        this.toast.warning('Wake Lock no soportado en este navegador.', 'PANTALLA');
      }
    }
  }

  // ─── Modal Asistente ForBot AI ──────────────────────────────────────────────
  protected readonly showForbotModal = signal(false);

  openForbotModal(): void {
    this.showForbotModal.set(true);
  }

  closeForbotModal(): void {
    this.showForbotModal.set(false);
  }

  // ─── Modal Mensajería 4GUARD ────────────────────────────────────────────────
  protected readonly showChatModal = signal(false);

  openChatModal(): void {
    this.showChatModal.set(true);
    this.rfChat.setModalOpen(true);
  }

  closeChatModal(): void {
    this.showChatModal.set(false);
    this.rfChat.setModalOpen(false);
  }
}

