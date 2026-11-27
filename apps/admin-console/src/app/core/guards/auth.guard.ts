/**
 * @file auth.guard.ts
 * @description Guard de ruta principal para 4GUARD WMS.
 *
 * Valida tres condiciones antes de activar cualquier ruta protegida:
 *  1. Que exista una sesión activa en localStorage (usuario logueado).
 *  2. Que el token JWT NO haya expirado (valida 4g_expires_at).
 *  3. Si la sesión es válida, inicia el temporizador proactivo de renovación.
 *
 * Al rechazar el acceso:
 *  - Preserva la URL solicitada en localStorage (4g_return_url) para reanudar
 *    el proceso después del login (flujo HU-005).
 *  - Preserva el nombre del proceso activo (4g_pending_process_name) si aplica.
 *  - Redirige a /login con el query param ?reason=session_expired si el token
 *    expiró, o sin él si simplemente no hay sesión.
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/** Rutas que el guard NO debe guardar como returnUrl (evitar loops de redireccion). */
const EXCLUDED_RETURN_PATHS = ['/login', '/forgot-password', '/change-password', '/carrier-checkin', '/driver-checkin', '/security/check-in', '/'];

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const hasToken      = !!authService.getAccessToken();
  const isExpired     = authService.isTokenExpired();
  const isLogged      = authService.isAuthenticated();
  const requestedUrl  = state.url;

  // ─ CASO 1: Sesión válida y token vigente ───────────────────────────────────
  if (isLogged && !isExpired) {
    if (authService.getCurrentUser()?.changePasswordRequired) {
      return router.createUrlTree(['/change-password']);
    }
    return true;
  }

  // ─ CASO 1B: Access token expirado pero existe refresh token (sesión 7 días, exclusivo CHAT_ONLY) ─
  const currentRole = (authService.getCurrentUser()?.role || '').toUpperCase();
  const isChatOnlyUser = currentRole.includes('CHAT_ONLY');
  if (isChatOnlyUser && hasToken && isExpired && authService.getRefreshToken()) {
    return authService.refreshToken().pipe(
      map(() =>
        authService.getCurrentUser()?.changePasswordRequired
          ? router.createUrlTree(['/change-password'])
          : true
      ),
      catchError(() => {
        authService.clearSessionAndRedirect('session_expired');
        return of(false);
      })
    );
  }

  // ─ CASO 2 / 3: Sesión expirada o inexistente ────────────────────────────────
  // Detección de dispositivo móvil (smartphone o tablet de chofer en caseta):
  // Los choferes jamás deben ver la pantalla de login institucional del WMS,
  // pero si el usuario solicita explícitamente /chat (perfil Solo Chat), debe ir a /login.
  const isChatRoute = requestedUrl?.startsWith('/chat');
  const isMobile = typeof navigator !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile && !isChatRoute) {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const queryParams: Record<string, string> = {};
    if (searchParams) {
      searchParams.forEach((v, k) => { queryParams[k] = v; });
    }
    return router.createUrlTree(['/carrier-checkin'], { queryParams });
  }

  const shouldSaveReturnUrl =
    requestedUrl &&
    !EXCLUDED_RETURN_PATHS.some((p) => requestedUrl.startsWith(p));

  if (shouldSaveReturnUrl) {
    localStorage.setItem('4g_return_url', requestedUrl);
    const processName = inferProcessName(requestedUrl);
    if (processName) {
      localStorage.setItem('4g_pending_process_name', processName);
    }
  }

  // Si había un token guardado pero ya expiró: limpiar y redirigir con razón de expiración
  if (hasToken && isExpired) {
    authService.clearSessionAndRedirect('session_expired');
    return false;
  }

  // Sin sesión en escritorio: redirigir directamente al login.
  return router.createUrlTree(['/login']);
};

/**
 * Deriva un nombre legible del proceso a partir de la URL para el mensaje de bienvenida
 * al reanudar la sesión (HU-005: Reanudación de Proceso).
 */
function inferProcessName(url: string): string {
  if (url.includes('/warehouse-movements/receiving'))  return 'Recepción de Mercancía';
  if (url.includes('/warehouse-movements/transfers'))  return 'Cambio de Almacén';
  if (url.includes('/warehouse-movements/outbound'))   return 'Salida de Almacén';
  if (url.includes('/warehouse-movements'))            return 'Movimientos de Almacén';
  if (url.includes('/inventory-query'))                return 'Consulta de Inventarios';
  if (url.includes('/inventory'))                      return 'Gestión de Inventario';
  if (url.includes('/quality'))                        return 'Control de Calidad';
  if (url.includes('/shipping'))                       return 'Despacho y Embarques';
  if (url.includes('/layout'))                         return 'Gestión de Layout';
  if (url.includes('/performance'))                    return 'Rendimiento Operativo';
  if (url.includes('/users'))                          return 'Control de Usuarios';
  if (url.includes('/roles'))                          return 'Roles y Permisos';
  if (url.includes('/carriers'))                       return 'Transportistas';
  if (url.includes('/suppliers'))                      return 'Proveedores';
  if (url.includes('/business-rules'))                 return 'Reglas de Negocio';
  if (url.includes('/admin'))                          return 'Administración';
  if (url.includes('/dashboard'))                      return '';
  return 'Consola Operativa 4GUARD';
}
