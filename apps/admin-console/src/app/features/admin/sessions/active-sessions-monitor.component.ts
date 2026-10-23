/**
 * @file active-sessions-monitor.component.ts
 * @description HU-011 — Visualización de sesiones activas.
 * Rol: Gerente de Operaciones.
 * Consume GET /api/v1/audit/active-sessions con Bearer Token automático.
 */

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ActiveSessionsService, ActiveSession } from '../../../core/services/active-sessions.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../users/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'fg-active-sessions-monitor',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './active-sessions-monitor.component.html',
  styleUrls: ['./active-sessions-monitor.component.css']
})
export class ActiveSessionsMonitorComponent implements OnInit {
  private readonly sessionsService = inject(ActiveSessionsService);
  protected readonly authState = inject(AuthState);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  // Estado reactivo
  sessions = signal<ActiveSession[]>([]);
  isLoading = signal(true);
  errorState = signal<'forbidden' | 'error' | null>(null);
  errorMessage = signal<string>('');

  // Modal de confirmación homologado (ConfirmDialogComponent)
  sessionToRevoke = signal<ActiveSession | null>(null);
  isRevoking = signal<boolean>(false);

  ngOnInit(): void {
    // Log de auditoría local (HU-011)
    console.log(JSON.stringify({ event: 'active_sessions_view', status: 'initiated' }));
    this.loadSessions();
  }

  /** Navega de regreso al panel de administración */
  goToAdmin(): void {
    this.router.navigate(['/admin']);
  }

  loadSessions(): void {
    this.isLoading.set(true);
    this.errorState.set(null);
    this.errorMessage.set('');

    this.sessionsService.getActiveSessions().subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success && response.data) {
          this.sessions.set(response.data);
          console.log(JSON.stringify({ event: 'active_sessions_view', status: 'success', count: response.data.length }));
        } else {
          this.sessions.set([]);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading.set(false);
        if (err.status === 403) {
          this.errorState.set('forbidden');
          this.errorMessage.set(err.error?.message || 'No tienes permisos para visualizar las sesiones activas.');
        } else if (err.status !== 401) {
          // Backend no disponible: cargar datos demo y mostrar banner informativo
          this.errorState.set(null); // null para que la lista se renderice
          this.errorMessage.set('Servidor no disponible. Mostrando datos de demostración.');
          this.loadDemoSessions();
        }
      }
    });
  }

  /** Genera iniciales a partir de un fullName */
  getInitials(fullName: string): string {
    if (!fullName) return '??';
    return fullName
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  }

  /** Transforma el userAgent técnico en texto amigable para el operador */
  parseUserAgent(ua: string): string {
    if (!ua) return 'Desconocido';

    let browser = 'Navegador';
    let os = 'Sistema';

    // Detectar navegador
    if (ua.includes('Edg/') || ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
    else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

    // Detectar sistema operativo
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} en ${os}`;
  }

  /** Formatea la fecha ISO a formato legible */
  formatDate(isoDate: string): string {
    if (!isoDate) return '—';
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoDate;
    }
  }

  /** Abre el modal de confirmación de revocación */
  revokeSession(session: ActiveSession): void {
    this.sessionToRevoke.set(session);
  }

  /** Ejecuta la revocación real al confirmar en el modal */
  confirmRevoke(): void {
    const session = this.sessionToRevoke();
    if (!session) return;

    this.isRevoking.set(true);
    this.sessionsService.revokeSession(session.userId).subscribe({
      next: (res) => {
        this.isRevoking.set(false);
        this.sessionToRevoke.set(null);
        this.toast.success(res.message || `Sesión de ${session.fullName} revocada correctamente.`);
        this.sessions.update(list => list.filter(s => s.userId !== session.userId));
      },
      error: (err) => {
        this.isRevoking.set(false);
        this.sessionToRevoke.set(null);
        if (err.status !== 401 && err.status !== 403) {
          this.toast.info(`Demostración: Sesión de ${session.fullName} revocada localmente.`);
          this.sessions.update(list => list.filter(s => s.userId !== session.userId));
        }
      }
    });
  }

  /** Cancela la revocación y cierra el modal */
  cancelRevoke(): void {
    if (!this.isRevoking()) {
      this.sessionToRevoke.set(null);
    }
  }

  /** Datos de demostración cuando el backend no está disponible */
  private loadDemoSessions(): void {
    const demoSessions: ActiveSession[] = [
      {
        userId: 'usr-001',
        username: 'enrique.garcia',
        fullName: 'Enrique García López',
        email: 'enrique@4guard.com',
        organizationId: 'org-001',
        organizationName: 'SynexIA Industrial',
        branchId: 'branch-001',
        branchName: 'Centro de Distribución CDMX',
        ipAddress: '192.168.1.15',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        role: 'ROLE_OPERATIONS_MANAGER'
      },
      {
        userId: 'usr-002',
        username: 'maria.rodriguez',
        fullName: 'María Rodríguez Sánchez',
        email: 'maria@4guard.com',
        organizationId: 'org-001',
        organizationName: 'SynexIA Industrial',
        branchId: 'branch-002',
        branchName: 'Almacén Norte MTY',
        ipAddress: '10.0.0.45',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        role: 'ROLE_WAREHOUSE_MANAGER'
      },
      {
        userId: 'usr-003',
        username: 'jorge.rojas',
        fullName: 'Jorge Rojas Mendoza',
        email: 'jorge@4guard.com',
        organizationId: 'org-001',
        organizationName: 'SynexIA Industrial',
        branchId: 'branch-003',
        branchName: 'Planta Querétaro',
        ipAddress: '172.16.0.88',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        role: 'ROLE_DOCK_SUPERVISOR'
      },
      {
        userId: 'usr-004',
        username: 'ana.martinez',
        fullName: 'Ana Martínez Flores',
        email: 'ana@4guard.com',
        organizationId: 'org-001',
        organizationName: 'SynexIA Industrial',
        branchId: 'branch-001',
        branchName: 'Centro de Distribución CDMX',
        ipAddress: '192.168.1.22',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        role: 'ROLE_QM_INSPECTOR'
      },
      {
        userId: 'usr-005',
        username: 'carlos.vega',
        fullName: 'Carlos Vega Díaz',
        email: 'carlos@4guard.com',
        organizationId: 'org-001',
        organizationName: 'SynexIA Industrial',
        branchId: 'branch-004',
        branchName: 'Almacén Sur GDL',
        ipAddress: '10.10.5.33',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        lastLoginAt: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
        role: 'ROLE_WAREHOUSE_OPERATOR'
      }
    ];
    this.sessions.set(demoSessions);
  }

  /** Traduce el rol técnico a etiqueta legible */
  getRoleLabel(role?: string): string {
    if (!role) return 'Operario';
    const labels: Record<string, string> = {
      'ROLE_ADMIN': 'Administrador',
      'ROLE_OPERATIONS_MANAGER': 'Gerente de Operaciones',
      'ROLE_WAREHOUSE_MANAGER': 'Gerente de Almacén',
      'ROLE_DOCK_SUPERVISOR': 'Supervisor de Andén',
      'ROLE_WAREHOUSE_OPERATOR': 'Operario',
      'ROLE_QM_INSPECTOR': 'Inspector de Calidad',
      'ROLE_AUDITOR': 'Auditor',
      'ROLE_CLIENT': 'Cliente 3PL',
    };
    return labels[role] ?? role.replace('ROLE_', '').replace(/_/g, ' ');
  }
}
