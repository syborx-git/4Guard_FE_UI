/**
 * @file rf-theme.service.ts
 * @description Servicio reactivo para gestión de temas (Modo Oscuro / Modo Claro) en RF Terminal.
 * Controla las clases .theme-dark y .theme-light en document.documentElement.
 */

import { Injectable, signal, effect } from '@angular/core';

export type RfTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class RfThemeService {
  private readonly THEME_KEY = '4guard_rf_theme';

  /** Señal que almacena el tema activo ('dark' por defecto para entornos industriales) */
  readonly currentTheme = signal<RfTheme>(this.getInitialTheme());

  constructor() {
    // Sincronizar el DOM y localStorage reactivamente
    effect(() => {
      const theme = this.currentTheme();
      const root = document.documentElement;

      if (theme === 'dark') {
        root.classList.add('theme-dark', 'dark');
        root.classList.remove('theme-light', 'light');
      } else {
        root.classList.add('theme-light', 'light');
        root.classList.remove('theme-dark', 'dark');
      }

      try {
        localStorage.setItem(this.THEME_KEY, theme);
      } catch {
        // Fallback si localStorage no está disponible
      }
    });
  }

  /** Alterna entre modo oscuro y claro */
  toggleTheme(): void {
    this.currentTheme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Establece un tema específico */
  setTheme(theme: RfTheme): void {
    this.currentTheme.set(theme);
  }

  private getInitialTheme(): RfTheme {
    try {
      const saved = localStorage.getItem(this.THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark'; // Por defecto industrial
  }
}
