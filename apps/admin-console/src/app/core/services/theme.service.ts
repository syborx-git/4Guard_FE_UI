import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ForbotEngineService } from '../forbot/services/forbot-engine.service';

const THEME_STORAGE_KEY = 'synexia-theme';

/**
 * Servicio global de tema (Modo Oscuro / Modo Claro) para admin-console.
 * Sincroniza la preferencia en localStorage ('synexia-theme') tanto dentro
 * del Shell principal como en vistas independientes (/chat).
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly forbotEngine = inject(ForbotEngineService);

  private readonly _isDarkMode = signal<boolean>(false);
  readonly isDarkMode = this._isDarkMode.asReadonly();

  readonly themeIcon = computed(() => (this._isDarkMode() ? 'light_mode' : 'dark_mode'));
  readonly themeLabel = computed(() =>
    this._isDarkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.restoreTheme();
    }
  }

  restoreTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;

    this._isDarkMode.set(shouldUseDark);
    this.applyTheme(shouldUseDark);
  }

  toggleTheme(): void {
    const nextTheme = !this._isDarkMode();
    this._isDarkMode.set(nextTheme);
    this.applyTheme(nextTheme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme ? 'dark' : 'light');
    }
  }

  private applyTheme(isDark: boolean): void {
    const root = this.document.documentElement;
    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('dark', isDark);
    root.classList.toggle('theme-light', !isDark);
    this.forbotEngine.checkTheme();
  }
}
