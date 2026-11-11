/**
 * @file backend-keep-alive.service.ts
 * @description Mantiene activo el backend de Render.com (evita la hibernación / spin-down de 15 minutos).
 * Envía un latido (heartbeat) silencioso cada 3 minutos mientras la aplicación esté abierta en cualquier navegador.
 */

import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class BackendKeepAliveService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);
  private pingIntervalId: any = null;

  constructor() {
    // Solo se requiere en servidores serverless/free-tier con hibernación (Render develop).
    // En Hetzner (producción) y Local, los contenedores Docker se mantienen siempre activos.
    if (isPlatformBrowser(this.platformId) && environment.envName === 'develop') {
      this.startHeartbeat();
    }
  }

  private get pingUrl(): string {
    const apiBase = environment.apiBaseUrl ?? '';
    return `${apiBase}/api/v1/warehouse-receptions?organizationId=a53f0907-9fa5-4bdf-87db-2eb5e7683935&limit=1`;
  }

  public startHeartbeat(): void {
    if (this.pingIntervalId) return;

    // Solo enviar latidos si el usuario ya inició sesión para evitar 401 Unauthorized
    this.sendPing();

    // Latido continuo cada 3 minutos (180,000 ms) para que Render nunca hiberne
    this.pingIntervalId = setInterval(() => {
      this.sendPing();
    }, 180000);
  }

  private sendPing(): void {
    // Si no hay token de sesión, no enviar la petición para no disparar 401 innecesarios
    if (!this.authService.getAccessToken()) {
      return;
    }
    try {
      this.http.get(this.pingUrl).subscribe({
        next: () => {},
        error: () => {}
      });
    } catch (_) {}
  }
}

