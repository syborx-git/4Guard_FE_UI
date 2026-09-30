/**
 * @file task-menu.component.ts
 * @description Menú de Operaciones Maestro para Terminal RF PWA con Arquitectura RBAC Dinámica.
 * Soporta personalización en tiempo real del Hero Banner, Terminal Header y Módulos Visibles
 * según el rol del usuario autenticado (Montacarguista, Guardia Caseta, Calidad QM, Supervisor, Auditor).
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthState, SyncState, UserRole } from '@4guard/shared-core';
import { AudioFeedbackService } from '../../../core/services/audio-feedback.service';

export interface RfOperationalModule {
  id: string;
  icon: string;
  title: string;
  description: string;
  badgeText: string;
  badgeType: 'amber' | 'sky' | 'purple' | 'emerald' | 'orange' | 'rose' | 'gold';
  actionLabel: string;
  route: string;
}

export interface ActiveTaskSummary {
  folio: string;
  statusBadge: string;
  title: string;
  subtitle: string;
  operatorName: string;
  elapsedMinutes: number;
  icon: string;
  actionLabel: string;
  route: string;
  bannerTheme: 'inbound' | 'security' | 'quality' | 'supervisor' | 'audit';
}

export interface RoleProfileConfig {
  role: UserRole;
  roleLabel: string;
  terminalBadge: string;
  terminalTitle: string;
  terminalDesc: string;
  priorityTag: string;
  leaseTag: string;
  activeTask: ActiveTaskSummary;
  allowedModuleIds: string[];
}

export const ROLE_PROFILES: Record<UserRole, RoleProfileConfig> = {
  [UserRole.WAREHOUSE_OPERATOR]: {
    role: UserRole.WAREHOUSE_OPERATOR,
    roleLabel: 'Operario de Montacargas',
    terminalBadge: 'Terminal Montacarguista #07',
    terminalTitle: 'Menú de Operaciones',
    terminalDesc: 'Selecciona un módulo de trabajo o continúa con tu asignación activa en andén.',
    priorityTag: 'Nivel 4G: Máxima Prioridad',
    leaseTag: 'Arrendamiento Activo',
    activeTask: {
      folio: 'MIS-INB-2026-081',
      statusBadge: 'En Progreso',
      title: 'Descarga Inbound • Tarima 1 de 6 • Rampa 03',
      subtitle: 'Asignado a: Roberto Sánchez • 8 min SLA restante',
      operatorName: 'Roberto Sánchez',
      elapsedMinutes: 4,
      icon: 'forklift',
      actionLabel: 'REANUDAR TAREA',
      route: '/cockpit',
      bannerTheme: 'inbound',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-counting', 'mod-quality', 'mod-print'],
  },

  [UserRole.SECURITY_GUARD]: {
    role: UserRole.SECURITY_GUARD,
    roleLabel: 'Guardia de Seguridad (Caseta)',
    terminalBadge: 'Caseta de Seguridad & Vigilancia',
    terminalTitle: 'Control de Accesos & Patio',
    terminalDesc: 'Registro de ingresos y salidas de transporte, validación de sellos y emisión de checklist F01.',
    priorityTag: 'Control Perimetral Activo',
    leaseTag: 'Caseta Principal Norte',
    activeTask: {
      folio: 'TRK-2026-904',
      statusBadge: 'En Inspección F01',
      title: 'Inspección de Ingreso • Tráiler Express (44-BB-9K)',
      subtitle: 'Conductor: Carlos Mendoza • Asignar Rampa de Descarga',
      operatorName: 'Carlos Mendoza',
      elapsedMinutes: 2,
      icon: 'local_police',
      actionLabel: 'CONTINUAR INSPECCIÓN F01',
      route: '/security',
      bannerTheme: 'security',
    },
    allowedModuleIds: ['mod-security', 'mod-cockpit', 'mod-quality'],
  },

  [UserRole.QM_INSPECTOR]: {
    role: UserRole.QM_INSPECTOR,
    roleLabel: 'Inspector de Calidad QM',
    terminalBadge: 'Estación Técnica de Calidad QM',
    terminalTitle: 'Inspección & Dictamen',
    terminalDesc: 'Auditoría de empaques, muestreo técnico de lotes retenidos y liberación oficial de producto.',
    priorityTag: 'Protocolo QM Obligatorio',
    leaseTag: 'Laboratorio & Buffer 01',
    activeTask: {
      folio: 'QM-2026-042',
      statusBadge: 'Muestreo en Proceso',
      title: 'Dictamen de Cuarentena • Aceite Sintético 5W-30',
      subtitle: 'Tarima #03 • Discrepancia de empaque reportada en andén',
      operatorName: 'Dra. Elena Ramos',
      elapsedMinutes: 6,
      icon: 'verified_user',
      actionLabel: 'REANUDAR AUDITORÍA QM',
      route: '/quality',
      bannerTheme: 'quality',
    },
    allowedModuleIds: ['mod-quality', 'mod-counting', 'mod-cockpit', 'mod-print'],
  },

  [UserRole.DOCK_SUPERVISOR]: {
    role: UserRole.DOCK_SUPERVISOR,
    roleLabel: 'Supervisor de Andén',
    terminalBadge: 'Consola de Supervisión Andenes',
    terminalTitle: 'Monitoreo Táctico de Operaciones',
    terminalDesc: 'Supervisión integral de cuadrillas, flujo de andenes, SLAs de descarga y balanceo de carga.',
    priorityTag: 'Supervisión en Tiempo Real',
    leaseTag: 'Patio & Andenes 01-10',
    activeTask: {
      folio: 'SUP-2026-LIVE',
      statusBadge: 'Supervisión en Vivo',
      title: 'Operación Global • 6 Misiones en Andenes (2 Críticas)',
      subtitle: 'Eficiencia de Cuadrilla: 94% • 0 Bloqueos en Patio',
      operatorName: 'Miguel Torres',
      elapsedMinutes: 12,
      icon: 'admin_panel_settings',
      actionLabel: 'SUPERVISAR COCKPIT',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.WAREHOUSE_MANAGER]: {
    role: UserRole.WAREHOUSE_MANAGER,
    roleLabel: 'Gerente de Almacén',
    terminalBadge: 'Gestión Operacional Central',
    terminalTitle: 'Consola Gerencial de Turno',
    terminalDesc: 'Monitoreo general de KPIs, capacidad de almacenamiento, rendimiento de personal y auditorías.',
    priorityTag: 'Control Operativo Total',
    leaseTag: 'CEDIS Central',
    activeTask: {
      folio: 'MGR-2026-CTRL',
      statusBadge: 'KPIs Operativos',
      title: 'Capacidad de CEDIS: 87% • Flujo Normal',
      subtitle: '12 Operarios Activos • 3 Recepciones en Curso',
      operatorName: 'Sofía Ramírez',
      elapsedMinutes: 15,
      icon: 'dashboard',
      actionLabel: 'VER OPERACIONES',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.AUDITOR]: {
    role: UserRole.AUDITOR,
    roleLabel: 'Auditor de Inventario',
    terminalBadge: 'Terminal de Auditoría e Inventarios',
    terminalTitle: 'Conteo Cíclico & Conciliación',
    terminalDesc: 'Validación física ciega de posiciones en rack, conteo de piezas y conciliación de discrepancias.',
    priorityTag: 'Auditoría Ciega Activa',
    leaseTag: 'Pasillo 04 - Racks B',
    activeTask: {
      folio: 'AUD-2026-019',
      statusBadge: 'Conteo en Curso',
      title: 'Conteo Cíclico Ciego • Pasillo 04 (Racks B01-B08)',
      subtitle: 'Avance: 8 de 14 ubicaciones auditadas',
      operatorName: 'Lic. David Morales',
      elapsedMinutes: 5,
      icon: 'checklist_rtl',
      actionLabel: 'CONTINUAR CONTEO',
      route: '/counting',
      bannerTheme: 'audit',
    },
    allowedModuleIds: ['mod-counting', 'mod-quality', 'mod-cockpit'],
  },

  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    roleLabel: 'Administrador del Sistema',
    terminalBadge: 'Terminal de Administración RF',
    terminalTitle: 'Acceso Total al Sistema',
    terminalDesc: 'Control de todos los módulos operacionales y de soporte de la terminal RF.',
    priorityTag: 'Superusuario Root',
    leaseTag: 'Acceso Global',
    activeTask: {
      folio: 'ADM-2026-ROOT',
      statusBadge: 'Sistema Activo',
      title: 'Módulos Operativos Sincronizados al 100%',
      subtitle: 'Todos los servicios en línea • WMS 4Guard 2.0',
      operatorName: 'Ing. Carlos Herrera',
      elapsedMinutes: 1,
      icon: 'shield',
      actionLabel: 'PANEL COCKPIT',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.CLIENT]: {
    role: UserRole.CLIENT,
    roleLabel: 'Cliente 3PL',
    terminalBadge: 'Portal de Consulta 3PL',
    terminalTitle: 'Consulta de Inventario Cliente',
    terminalDesc: 'Seguimiento en tiempo real del stock y misiones de recepción y despacho de su mercancía.',
    priorityTag: 'Consulta Exclusiva',
    leaseTag: 'Vista Externa',
    activeTask: {
      folio: 'CLI-2026-3PL',
      statusBadge: 'Monitoreo 3PL',
      title: 'Mercancía en Almacén: 1,240 Pallets',
      subtitle: 'Último Despacho: MIS-OUT-2026-015 (En Ruta)',
      operatorName: 'Representante Nestlé',
      elapsedMinutes: 3,
      icon: 'visibility',
      actionLabel: 'VER INVENTARIO',
      route: '/counting',
      bannerTheme: 'inbound',
    },
    allowedModuleIds: ['mod-counting', 'mod-quality'],
  },
};

@Component({
  selector: 'fg-task-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-menu.component.html',
  styleUrl: './task-menu.component.css',
})
export class TaskMenuComponent {
  protected readonly authState    = inject(AuthState);
  protected readonly syncState    = inject(SyncState);
  protected readonly audioService = inject(AudioFeedbackService);
  private readonly router         = inject(Router);

  // ─── Modal de Reportar Incidencia ────────────────────────────────────────────
  protected readonly showIncidentModal = signal(false);

  // ─── Catálogo Maestro de Módulos Operativos ──────────────────────────────────
  protected readonly allModules: RfOperationalModule[] = [
    {
      id: 'mod-cockpit',
      icon: 'forklift',
      title: 'Cockpit Montacarguista (Unificado)',
      description: 'Gestión integral de movimientos: Descargas Inbound, Reubicaciones Putaway y Cargas de Salida en cola FIFO dinámica.',
      badgeText: '5 en Cola (2 Urgentes)',
      badgeType: 'amber',
      actionLabel: 'Abrir Cockpit',
      route: '/cockpit',
    },
    {
      id: 'mod-security',
      icon: 'local_police',
      title: 'Seguridad & Caseta de Vigilancia',
      description: 'Control de accesos de transporte, captura de placas, fotos de sellos y liberación de patio con checklist F01.',
      badgeText: '4 en Patio',
      badgeType: 'gold',
      actionLabel: 'Acceso Caseta',
      route: '/security',
    },
    {
      id: 'mod-quality',
      icon: 'verified_user',
      title: 'Calidad & Cuarentena QM',
      description: 'Inspección técnica, reporte de empaque dañado, retenciones y liberación de producto por supervisor.',
      badgeText: '2 en Cuarentena',
      badgeType: 'rose',
      actionLabel: 'Ver Calidad',
      route: '/quality',
    },
    {
      id: 'mod-counting',
      icon: 'checklist_rtl',
      title: 'Conteo Cíclico e Inventario',
      description: 'Auditoría física de posiciones en rack, validación ciega de lotes y resolución de discrepancias.',
      badgeText: 'Sin tareas urgentes',
      badgeType: 'emerald',
      actionLabel: 'Auditoría',
      route: '/counting',
    },
    {
      id: 'mod-print',
      icon: 'print',
      title: 'Impresión de Etiquetas Zebra SSCC',
      description: 'Generar, duplicar y reimprimir identificadores GS1-128 de tarima completa y máster.',
      badgeText: 'Zebra ZT411 OK',
      badgeType: 'orange',
      actionLabel: 'Imprimir Etiquetas',
      route: '/receiving',
    },
  ];

  // ─── Roles Disponibles para el Simulador Demo ──────────────────────────────
  protected readonly demoRoles = [
    { role: UserRole.WAREHOUSE_OPERATOR, label: 'Montacarguista', icon: 'forklift' },
    { role: UserRole.SECURITY_GUARD,     label: 'Seguridad Caseta', icon: 'local_police' },
    { role: UserRole.QM_INSPECTOR,        label: 'Calidad QM', icon: 'verified_user' },
    { role: UserRole.DOCK_SUPERVISOR,    label: 'Supervisor Andén', icon: 'admin_panel_settings' },
    { role: UserRole.AUDITOR,            label: 'Auditor Inventario', icon: 'checklist_rtl' },
  ];

  // ─── Perfil y Tareas Derivadas del Rol Activo ───────────────────────────────
  protected readonly currentRole = computed<UserRole>(() => {
    return this.authState.role() ?? UserRole.WAREHOUSE_OPERATOR;
  });

  protected readonly currentProfile = computed<RoleProfileConfig>(() => {
    const role = this.currentRole();
    return ROLE_PROFILES[role] || ROLE_PROFILES[UserRole.WAREHOUSE_OPERATOR];
  });

  protected readonly activeTask = computed<ActiveTaskSummary>(() => {
    return this.currentProfile().activeTask;
  });

  protected readonly visibleModules = computed<RfOperationalModule[]>(() => {
    const allowed = this.currentProfile().allowedModuleIds;
    return this.allModules.filter(m => allowed.includes(m.id));
  });

  // ─── Métodos de Interacción ─────────────────────────────────────────────────

  /** Cambiar rol en vivo para pruebas del selector dinámico */
  protected switchDemoRole(role: UserRole): void {
    this.authState.switchRoleForTesting(role);
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate(25);
    }
  }

  /** Navegación táctil con feedback sonoro y háptico */
  protected navigate(route: string): void {
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    this.router.navigate([route]);
  }

  /** Reanudar directamente la tarea activa */
  protected resumeActiveTask(): void {
    const task = this.activeTask();
    if (task) {
      this.navigate(task.route);
    }
  }

  /** Sincronizar datos manualmente */
  protected manualSync(): void {
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
    this.router.navigate(['/sync']);
  }

  /** Abrir modal de reporte de incidencia */
  protected openIncidentModal(): void {
    this.audioService.playWarning();
    this.showIncidentModal.set(true);
  }

  /** Cerrar modal de incidencia */
  protected closeIncidentModal(): void {
    this.showIncidentModal.set(false);
  }

  /** Confirmar y redirigir al formulario de anomalía */
  protected confirmIncidentRedirect(): void {
    this.showIncidentModal.set(false);
    this.navigate('/anomaly');
  }
}
