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
import { AuthState, SyncState } from '@4guard/shared-core';
import { RfThemeService } from '../../../core/services/rf-theme.service';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

import { OfflineBannerComponent } from '../offline-banner/offline-banner.component';
import { ToastContainerComponent } from '../toast-container/toast-container.component';
import { ToastService } from '@4guard/shared-core';

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
    ToastContainerComponent
  ],
  templateUrl: './rf-shell.component.html',
  styleUrl: './rf-shell.component.css',
})
export class RfShellComponent implements OnInit, OnDestroy {
  private readonly router       = inject(Router);
  protected readonly themeService = inject(RfThemeService);
  protected readonly authState    = inject(AuthState);
  protected readonly syncState    = inject(SyncState);
  protected readonly audioService = inject(AudioFeedbackService);
  protected readonly toast        = inject(ToastService);

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

  // ─── Datos Computados del Perfil ──────────────────────────────────────────
  protected readonly displayUserName = computed(() => {
    return this.authState.userFullName() || this.authState.user()?.fullName || 'Roberto Sánchez';
  });

  protected readonly displayUserInitials = computed(() => {
    const initials = this.authState.userInitials();
    return initials || 'RS';
  });

  protected readonly displayRole = computed(() => {
    return this.authState.roleLabel() || 'Operario de Almacén';
  });

  protected readonly displayUsername = computed(() => {
    const u = this.authState.user();
    if (!u) return 'roberto.sanchez';
    return u.email ? u.email.split('@')[0] : 'roberto.sanchez';
  });

  protected readonly displayBranch = computed(() => {
    const u = this.authState.user();
    return u?.branchName || this.authState.branchId() || 'CEDIS Central Monterrey';
  });

  // ─── Estado del Zone Lease (HU-155) ──────────────────────────────────────────
  protected readonly activeZoneName = signal('Pasillo 04');
  protected readonly leaseMinutesLeft = signal(28);
  protected readonly isLeaseWarning = computed(() => this.leaseMinutesLeft() <= 5);

  // ─── Modal Simulador de Escaneo ──────────────────────────────────────────────
  protected readonly showScanModal = signal(false);
  protected readonly simulatedBarcode = signal('SSCC-175012345000000018');

  // ─── Navegación Inferior (Accesos Rápidos de Piso Unificados) ───────────────
  protected readonly navItems: NavItem[] = [
    { path: '/menu',      icon: 'grid_view',     label: 'Menú'       },
    { path: '/cockpit',   icon: 'forklift',      label: 'Cockpit'    },
    { path: '/counting',  icon: 'checklist_rtl', label: 'Conteo'     },
    { path: '/quality',   icon: 'verified_user', label: 'Calidad'    },
    { path: '/security',  icon: 'local_police',  label: 'Seguridad'  },
    { path: '/sync',      icon: 'sync',          label: 'Sync'       },
  ];

  ngOnInit(): void {
    // Actualizar reloj en tiempo real cada segundo
    this.clockIntervalId = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);

    // ── Notificaciones de Inicio de Sesión & Solicitudes Asignadas ──
    setTimeout(() => {
      const userName = this.displayUserName();
      const roleName = this.displayRole();
      this.toast.info(
        `Bienvenido, ${userName} (${roleName}). Tienes solicitudes de inventario asignadas y listas para operar.`,
        'SESIÓN INICIADA'
      );
    }, 500);

    setTimeout(() => {
      this.toast.success(
        'Zone Lease asignado: Pasillo 04 (Zona A) — 28 min de concesión exclusiva para maniobras.',
        'PASILLO ASIGNADO'
      );
    }, 1400);

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
}
