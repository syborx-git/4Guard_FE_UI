/**
 * @file public-mobile-redirect.guard.ts
 * @description Guard para detectar dispositivos móviles sin sesión activa
 * y canalizarlos automáticamente al portal de Auto-Registro de Transporte (/carrier-checkin).
 * 
 * Evita que choferes que escanean el QR en caseta caigan a la pantalla de login institucional
 * si la URL raíz o de redirección de túneles (ej. ngrok) es invocada sin ruta explícita.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const publicMobileRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si el usuario ya tiene sesión válida en el WMS, permitir continuar al dashboard
  if (authService.isAuthenticated() && !authService.isTokenExpired()) {
    return true;
  }

  // Detectar dispositivo móvil (smartphone o tablet)
  const isMobile = typeof navigator !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    // Preservar query params existentes si el QR incluía org o branch
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryParams: Record<string, string> = {};
    if (searchParams) {
      searchParams.forEach((v, k) => { queryParams[k] = v; });
    }
    return router.createUrlTree(['/carrier-checkin'], { queryParams });
  }

  // Dispositivos de escritorio sin sesión: canalizar a login
  return router.createUrlTree(['/login']);
};
