/**
 * @file shell.component.ts
 * @description Layout Shell de admin-console: Sidebar + Header + Content.
 * Todos los modulos protegidos renderizan dentro de este componente.
 * Rediseno premium: sidebar oscuro, Material Symbols, branch selector.
 */

import {
  Component,
  inject,
  signal,
  computed,
  HostListener,
  OnInit,
  OnDestroy,
  PLATFORM_ID
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { SyncState, UserRole } from '@4guard/shared-core';
import { AuthState } from '../../../core/auth/auth.state';
import { UsersService } from '../../../core/services/users.service';
import { UserProfileDto } from '../../../core/models/user.models';

export interface WaffleItem {
  id: string;
  name: string;
  category: 'google' | 'wms';
  icon: string;
  iconBg: string;
  route?: string;
  url?: string;
  badge?: string;
  badgeBg?: string;
}

/** Valida que confirmPassword coincida con newPassword. */
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPwd = control.get('newPassword')?.value;
  const confirmPwd = control.get('confirmPassword')?.value;
  if (newPwd && confirmPwd && newPwd !== confirmPwd) {
    return { passwordsMismatch: true };
  }
  return null;
}

interface NavItem {
  label: string;
  route: string;
  icon: string;   // Material Symbols name
  module: string;
  badge?: () => number;
}

import { PasswordCollapseComponent } from '../password-collapse/password-collapse.component';

@Component({
  selector: 'fg-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ReactiveFormsModule, CommonModule],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit, OnDestroy {
  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  private readonly usersService = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private clockIntervalId: ReturnType<typeof setInterval> | null = null;
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private refreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected isSidebarCollapsed = signal(false);

  // ── Premium Live UI ─────────────────────────────────────────
  protected readonly currentTime = signal('');
  protected readonly currentDate = signal('');
  protected readonly isDarkMode = signal(false);
  protected readonly isHeaderRefreshing = signal(false);

  protected readonly themeIcon = computed(() =>
    this.isDarkMode() ? 'light_mode' : 'dark_mode'
  );

  protected readonly themeLabel = computed(() =>
    this.isDarkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  );

  // ── Profile dropdown & Change Password modal ──────────────
  protected readonly showProfileMenu = signal(false);
  protected readonly showChangePasswordModal = signal(false);
  protected readonly isChangingPassword = signal(false);
  protected readonly changePasswordError = signal<string | null>(null);
  protected readonly changePasswordSuccess = signal(false);
  protected readonly showNewPwd = signal(false);
  protected readonly showConfirmPwd = signal(false);

  // ── User profile modal ────────────────────────────────────
  protected readonly showProfileModal = signal(false);
  protected readonly userProfileData = signal<UserProfileDto | null>(null);
  protected readonly isLoadingProfile = signal(false);
  protected readonly profileError = signal<string | null>(null);

  protected readonly cpForm = this.fb.group(
    {
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Z])(?=.*[0-9!@#$%^&*]).{8,}$/)
      ]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator }
  );

  get newPwdCtrl() { return this.cpForm.controls.newPassword; }
  get confirmPwdCtrl() { return this.cpForm.controls.confirmPassword; }

  protected readonly newPwdValue = toSignal(this.cpForm.controls.newPassword.valueChanges, { initialValue: '' });

  /** Fortaleza de la contraseña: 0–3 */
  protected readonly passwordStrength = computed(() => {
    const pwd = this.newPwdValue() ?? '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9!@#$%^&*]/.test(pwd)) score++;
    return score;
  });

  /** Indica si la contraseña cumple al 100% con todos los requisitos de seguridad (3 de 3) */
  protected readonly isPasswordFullyValid = computed(() => this.passwordStrength() === 3);

  protected readonly strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s === 0) return '';
    if (s === 1) return 'Débil';
    if (s === 2) return 'Moderada';
    return 'Fuerte';
  });

  protected readonly strengthClass = computed(() => {
    const s = this.passwordStrength();
    if (s === 1) return 'cp-modal__strength--weak';
    if (s === 2) return 'cp-modal__strength--medium';
    if (s === 3) return 'cp-modal__strength--strong';
    return '';
  });

  // ── Requisitos individuales (para la checklist en el template) ────────────
  protected readonly reqMinLength = computed(() => (this.newPwdValue()?.length ?? 0) >= 8);
  protected readonly reqUpperCase = computed(() => /[A-Z]/.test(this.newPwdValue() ?? ''));
  protected readonly reqNumberOrSymbol = computed(() => /[0-9!@#$%^&*]/.test(this.newPwdValue() ?? ''));


  // ── Waffle Menu (Ecosistema de Aplicaciones) ─────────────────────
  protected readonly showWaffleMenu = signal(false);
  protected readonly waffleSearchQuery = signal('');
  protected readonly waffleActiveTab = signal<'all' | 'google' | 'wms'>('all');

  protected readonly waffleItems: WaffleItem[] = [
    {
      id: 'gmail',
      name: 'GMAIL',
      category: 'google',
      icon: 'mail',
      iconBg: 'linear-gradient(135deg, #ea4335 0%, #c5221f 100%)',
      url: 'https://mail.google.com',
    },
    {
      id: 'drive',
      name: 'DRIVE',
      category: 'google',
      icon: 'folder_shared',
      iconBg: 'linear-gradient(135deg, #34a853 0%, #1e8e3e 100%)',
      url: 'https://drive.google.com',
    },
    {
      id: 'calendar',
      name: 'CALENDAR',
      category: 'google',
      icon: 'calendar_month',
      iconBg: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
      badge: 'HOY',
      badgeBg: '#f59e0b',
      url: 'https://calendar.google.com',
    },
    {
      id: 'maps',
      name: 'MAPS WMS',
      category: 'wms',
      icon: 'pin_drop',
      iconBg: 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
      route: '/layout',
    },
    {
      id: 'gemini',
      name: 'GEMINI IA',
      category: 'google',
      icon: 'auto_awesome',
      iconBg: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
      badge: 'IA',
      badgeBg: '#d4af37',
      url: 'https://gemini.google.com',
    },
    {
      id: 'meet',
      name: 'MEET',
      category: 'google',
      icon: 'videocam',
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      url: 'https://meet.google.com',
    },
    {
      id: 'evidencia',
      name: 'EVIDENCIA',
      category: 'wms',
      icon: 'photo_camera',
      iconBg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
      route: '/receiving',
    },
    {
      id: 'traductor',
      name: 'TRADUCTOR',
      category: 'google',
      icon: 'translate',
      iconBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      url: 'https://translate.google.com',
    },
    {
      id: 'tutoriales',
      name: 'TUTORIALES',
      category: 'wms',
      icon: 'play_circle',
      iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      route: '/dashboard',
    },
    {
      id: 'reglas',
      name: 'REGLAS',
      category: 'wms',
      icon: 'tune',
      iconBg: 'linear-gradient(135deg, #d4af37 0%, #85581a 100%)',
      badge: 'HU-131',
      badgeBg: '#b8860b',
      route: '/business-rules',
    },
    {
      id: 'divisas',
      name: 'DIVISAS',
      category: 'wms',
      icon: 'currency_exchange',
      iconBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      route: '/currency-exchange',
    },
  ];

  protected readonly filteredWaffleItems = computed(() => {
    const query = this.waffleSearchQuery().toLowerCase().trim();
    const tab = this.waffleActiveTab();

    return this.waffleItems.filter((item) => {
      const matchesTab = tab === 'all' || item.category === tab;
      const matchesQuery = !query || item.name.toLowerCase().includes(query);
      return matchesTab && matchesQuery;
    });
  });

  /** Cierra el menú de perfil y Waffle menu al hacer click fuera */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.sidebar__user-trigger') && !target.closest('.profile-menu')) {
      this.showProfileMenu.set(false);
    }
    if (!target.closest('.shell__waffle-container')) {
      this.showWaffleMenu.set(false);
    }
  }

  protected toggleWaffleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showProfileMenu.set(false);
    this.showWaffleMenu.update((v) => !v);
  }

  protected setWaffleTab(tab: 'all' | 'google' | 'wms'): void {
    this.waffleActiveTab.set(tab);
  }

  protected onWaffleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.waffleSearchQuery.set(target.value);
  }

  protected clearWaffleSearch(): void {
    this.waffleSearchQuery.set('');
  }

  protected onEditFavorites(): void {
    alert('Modo edición de accesos directos activado.');
  }

  protected onWaffleItemClick(item: WaffleItem): void {
    this.showWaffleMenu.set(false);
    if (item.route) {
      this.router.navigate([item.route]);
    } else if (item.url) {
      window.open(item.url, '_blank');
    }
  }

  protected toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showWaffleMenu.set(false);
    this.showProfileMenu.update((v) => !v);
  }

  protected openChangePassword(): void {
    this.showProfileMenu.set(false);
    this.cpForm.reset();
    this.changePasswordError.set(null);
    this.changePasswordSuccess.set(false);
    this.showNewPwd.set(false);
    this.showConfirmPwd.set(false);
    this.showChangePasswordModal.set(true);
  }

  protected closeChangePassword(): void {
    if (this.isChangingPassword()) return;
    this.showChangePasswordModal.set(false);
  }

  protected toggleNewPwd(): void { this.showNewPwd.update(v => !v); }
  protected toggleConfirmPwd(): void { this.showConfirmPwd.update(v => !v); }

  protected submitChangePassword(): void {
    if (this.cpForm.invalid || !this.isPasswordFullyValid() || this.isChangingPassword()) return;

    this.changePasswordError.set(null);
    this.isChangingPassword.set(true);

    const newPassword = this.newPwdCtrl.value!;

    this.usersService.changePassword(newPassword).subscribe({
      next: (response) => {
        this.isChangingPassword.set(false);
        if (response.success) {
          this.changePasswordSuccess.set(true);
          setTimeout(() => this.closeChangePassword(), 2000);
        } else {
          this.changePasswordError.set(response.message || 'No se pudo actualizar la contraseña.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isChangingPassword.set(false);
        const msg = err.error?.message;
        if (err.status === 400) {
          this.changePasswordError.set(msg || 'La contraseña no cumple los requisitos mínimos.');
        } else if (err.status === 0) {
          this.changePasswordError.set('Sin conexión al servidor. Verifica la red.');
        } else {
          this.changePasswordError.set(msg || 'Ocurrió un error. Inténtalo nuevamente.');
        }
      },
    });
  }



  /** Conteo de alertas criticas (demo: 2) */
  protected readonly criticalCount = signal(2);

  /** Texto de ultima actualizacion */
  protected readonly lastUpdated = signal('ahora');

  protected readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', module: 'dashboard' },
    { label: 'Inventario', route: '/inventory', icon: 'inventory_2', module: 'inventory' },
    { label: 'Recepcion', route: '/receiving', icon: 'move_to_inbox', module: 'receiving' },
    { label: 'Calidad', route: '/quality', icon: 'fact_check', module: 'quality' },
    { label: 'Despacho', route: '/shipping', icon: 'local_shipping', module: 'shipping' },
    { label: 'Rendimiento', route: '/performance', icon: 'monitoring', module: 'performance' },
    { label: 'Administrar', route: '/admin', icon: 'manage_accounts', module: 'admin' },
    // HU-131: Motor de Reglas de Negocio Enterprise
    { label: 'Reglas de negocio', route: '/business-rules', icon: 'gavel', module: 'business-rules' },
    // HU-148: Divisas y Tipos de Cambio — Módulo Financiero
    { label: 'Divisas y cambio', route: '/currency-exchange', icon: 'currency_exchange', module: 'currency-exchange' },
    // HU-139: Gestión de Licencias del WMS
    { label: 'Gestión de licencias', route: '/licenses', icon: 'workspace_premium', module: 'license-management' },
  ];


  /** Filtra los nav items segun el rol del usuario */
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => this.authState.canAccessModule(item.module)),
  );

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.restoreTheme();
    this.updateClock();

    this.clockIntervalId = setInterval(() => {
      this.updateClock();
    }, 1000);

    this.refreshIntervalId = setInterval(() => {
      this.runHeaderRefreshAnimation();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }

    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }

    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
    }
  }

  private updateClock(): void {
    const now = new Date();

    this.currentTime.set(
      now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    );

    this.currentDate.set(
      now.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    );
  }

  private runHeaderRefreshAnimation(): void {
    this.isHeaderRefreshing.set(true);
    this.lastUpdated.set('actualizando...');

    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
    }

    this.refreshTimeoutId = setTimeout(() => {
      this.isHeaderRefreshing.set(false);
      this.lastUpdated.set('ahora');
    }, 1400);
  }

  private restoreTheme(): void {
    const savedTheme = localStorage.getItem('synexia-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    this.isDarkMode.set(shouldUseDark);
    this.applyTheme(shouldUseDark);
  }

  protected toggleTheme(): void {
    const nextTheme = !this.isDarkMode();

    this.isDarkMode.set(nextTheme);
    this.applyTheme(nextTheme);

    localStorage.setItem(
      'synexia-theme',
      nextTheme ? 'dark' : 'light'
    );
  }

  private applyTheme(isDark: boolean): void {
    const root = this.document.documentElement;

    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('theme-light', !isDark);
  }

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  protected openProfileModal(): void {
    this.showProfileMenu.set(false);
    this.profileError.set(null);
    this.userProfileData.set(null);
    this.isLoadingProfile.set(true);
    this.showProfileModal.set(true);

    const currentUser = this.authState.currentUser();
    if (!currentUser || !currentUser.id) {
      this.isLoadingProfile.set(false);
      this.profileError.set('No se pudo determinar el usuario actual.');
      return;
    }

    this.usersService.getUserProfile(currentUser.id).subscribe({
      next: (response) => {
        this.isLoadingProfile.set(false);
        if (response.success && response.data) {
          this.userProfileData.set(response.data);
        } else {
          this.profileError.set(response.message || 'No se pudo obtener el perfil del usuario.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoadingProfile.set(false);
        const msg = err.error?.message;
        if (err.status === 0) {
          this.profileError.set('Sin conexión al servidor. Verifica la red.');
        } else {
          this.profileError.set(msg || 'Ocurrió un error al cargar el perfil.');
        }
      }
    });
  }

  protected closeProfileModal(): void {
    this.showProfileModal.set(false);
  }

  protected logout(): void {
    this.authState.logout();
  }
}
