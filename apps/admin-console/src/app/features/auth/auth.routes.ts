/**
 * @file auth.routes.ts
 * @description Rutas del módulo de autenticación en admin-console.
 */
import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
    title: '4GUARD WMS — Iniciar Sesión',
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
    title: '4GUARD WMS — Recuperar Contraseña',
  },
];
