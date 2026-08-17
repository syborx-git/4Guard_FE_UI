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
import { AuthService } from '../services/auth.service';

/** Rutas que el guard NO debe guardar como returnUrl (evitar loops de redireccion). */
const EXCLUDED_RETURN_PATHS = ['/login', '/forgot-password', '/change-password', '/'];

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const isLogged      = authService.isAuthenticated();
  const isExpired     = authService.isTokenExpired();
  const requestedUrl  = state.url;

  // ─ CASO 1: Sesión válida y token vigente ───────────────────────────────────
  if (isLogged && !isExpired) {
    // El temporizador proactivo de renovación fue iniciado en handleAuthentication().
    // No hay nada más que hacer: dejar pasar la navegación.
    return true;
  }

  // ─ CASO 2: Sesión presente pero token expirado (refresco proactivo falló) ────
  // ─ CASO 3: Sin sesión (primer acceso o sesión limpiada) ────────────────

  // Preservar la URL actual como returnUrl para reanudar el proceso post-login.
  // No guardar rutas excluidas (evitar redirigir a /login después del login).
  const shouldSaveReturnUrl =
    requestedUrl &&
    !EXCLUDED_RETURN_PATHS.some((p) => requestedUrl.startsWith(p));

  if (shouldSaveReturnUrl) {
    localStorage.setItem('4g_return_url', requestedUrl);
    // Inferir el nombre del proceso desde la URL para el mensaje de reanudación.
    const processName = inferProcessName(requestedUrl);
    if (processName) {
      localStorage.setItem('4g_pending_process_name', processName);
    }
  }

  // Limpiar la sesión local si el token expiró (estado inconsistente).
  if (isLogged && isExpired) {
    authService.clearSessionAndRedirect('session_expired');
    return false; // clearSessionAndRedirect ya navega a /login
  }

  // Sin sesión: redirigir directamente al login.
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
