/**
 * @file app.component.ts
 * @description Componente raíz de la Consola Administrativa 4GUARD.
 * Actúa como host del router outlet y del diseño global.
 */

import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthState } from './core/auth/auth.state';

@Component({
  selector: 'fg-admin-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  title = '4GUARD WMS — Consola Administrativa';

  private readonly authState = inject(AuthState);
  private inactivityTimer: any;
  private readonly TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

  ngOnInit(): void {
    this.resetTimer();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  @HostListener('window:mousemove')
  @HostListener('window:keydown')
  @HostListener('window:click')
  @HostListener('window:scroll')
  onUserActivity(): void {
    if (this.authState.isAuthenticated()) {
      this.resetTimer();
    }
  }

  private resetTimer(): void {
    this.clearTimer();
    this.inactivityTimer = setTimeout(() => {
      if (this.authState.isAuthenticated()) {
        this.authState.logout('inactivity');
      }
    }, this.TIMEOUT_MS);
  }

  private clearTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }
}
