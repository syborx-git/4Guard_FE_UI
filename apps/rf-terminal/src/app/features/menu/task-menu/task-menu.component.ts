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
    roleLabel: 'Montacarguista',
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
    allowedModuleIds: ['mod-cockpit', 'mod-counting', 'mod-print'],
  },

  [UserRole.SECURITY_GUARD]: {
    role: UserRole.SECURITY_GUARD,
    roleLabel: 'Guardia de Seguridad (Caseta)',
    terminalBadge: 'Caseta de Seguridad & Vigilancia',
    terminalTitle: 'Centro de Mando de Caseta y Patio',
    terminalDesc: 'Registro expedito de ingresos y salidas de transporte, inspección visual de sellos y control de patio.',
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
      route: '/security?tab=REGISTRATION',
      bannerTheme: 'security',
    },
    allowedModuleIds: ['mod-sec-entry', 'mod-sec-yard', 'mod-sec-checkout', 'mod-sec-qr'],
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
    allowedModuleIds: ['mod-quality', 'mod-counting'],
  },

  [UserRole.CONTROL_DESK]: {
    role: UserRole.CONTROL_DESK,
    roleLabel: 'Mesa de Control',
    terminalBadge: 'Terminal de Mesa de Control',
    terminalTitle: 'Control de Tráfico y Pautas F01',
    terminalDesc: 'Autorización de descargas, asignación de rampas y dictamen de pauta de recibo.',
    priorityTag: 'Mesa de Control Activa',
    leaseTag: 'Control Central',
    activeTask: {
      folio: 'CTRL-2026-F01',
      statusBadge: 'Pautas en Curso',
      title: 'Recepción Tráiler F-92 • Rampa 03',
      subtitle: '48 Cajas • Validando Lotes y Pauta F01',
      operatorName: 'Lic. Patricia Gómez',
      elapsedMinutes: 2,
      icon: 'desktop_windows',
      actionLabel: 'VER OPERACIONES',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.SHIFT_LEADER]: {
    role: UserRole.SHIFT_LEADER,
    roleLabel: 'Líder de Turno',
    terminalBadge: 'Consola Líder de Turno',
    terminalTitle: 'Coordinación Táctica de Piso',
    terminalDesc: 'Balanceo de cuadrillas de montacargas, supervisión de andenes y resolución de excepciones.',
    priorityTag: 'Liderazgo en Piso',
    leaseTag: 'Nave Central',
    activeTask: {
      folio: 'LID-2026-T1',
      statusBadge: 'Turno Activo',
      title: 'Cuadrilla Andén Norte • 3 Tráilers',
      subtitle: 'Rendimiento: 92% • 0 Demoras',
      operatorName: 'Ricardo Peña',
      elapsedMinutes: 7,
      icon: 'groups',
      actionLabel: 'COORDINAR PISO',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.OPERATIONS_SUPERVISOR]: {
    role: UserRole.OPERATIONS_SUPERVISOR,
    roleLabel: 'Supervisor de Operaciones',
    terminalBadge: 'Supervisión General Operativa',
    terminalTitle: 'Monitoreo Global de Maniobras',
    terminalDesc: 'Supervisión de patio, andenes y almacén con facultades de autorización de excepciones.',
    priorityTag: 'Supervisión 4G',
    leaseTag: 'CEDIS General',
    activeTask: {
      folio: 'OPS-2026-SUP',
      statusBadge: 'Operación Integral',
      title: 'Flujo Patio & Andenes • 8 Unidades',
      subtitle: 'Tiempo promedio de descarga: 38 min',
      operatorName: 'Ing. Héctor Salinas',
      elapsedMinutes: 10,
      icon: 'manage_accounts',
      actionLabel: 'SUPERVISIÓN GLOBAL',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.OPERATIONS_COORDINATOR]: {
    role: UserRole.OPERATIONS_COORDINATOR,
    roleLabel: 'Coordinador de Operaciones',
    terminalBadge: 'Coordinación de Almacenes',
    terminalTitle: 'Coordinación Operativa y Rendimiento',
    terminalDesc: 'Enlace táctico entre gerencia y supervisión de turnos para el cumplimiento de SLAs de CEDIS.',
    priorityTag: 'Coordinación General',
    leaseTag: 'CEDIS Central',
    activeTask: {
      folio: 'COO-2026-08',
      statusBadge: 'SLAs de Turno',
      title: 'Balanceo de Turno • 4 Cuadrillas',
      subtitle: 'Eficiencia global: 95% • 18 Descargas concluidas',
      operatorName: 'Lic. Fernando Lozano',
      elapsedMinutes: 12,
      icon: 'hub',
      actionLabel: 'VER COORDINACIÓN',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.OPERATIONS_MANAGER]: {
    role: UserRole.OPERATIONS_MANAGER,
    roleLabel: 'Gerente de Operaciones',
    terminalBadge: 'Dirección de Operaciones',
    terminalTitle: 'Mando Operativo y Autorización MRP',
    terminalDesc: 'Control de directrices operativas, facultades de excepción de vida útil y gobierno del CEDIS.',
    priorityTag: 'Mando Operativo',
    leaseTag: 'CEDIS Corporativo',
    activeTask: {
      folio: 'DIR-2026-OPS',
      statusBadge: 'Dirección Activa',
      title: 'Eficiencia CEDIS: 96% • 0 Cuellos de Botella',
      subtitle: 'Operaciones en tiempo y forma',
      operatorName: 'Ing. Roberto Garza',
      elapsedMinutes: 14,
      icon: 'shield_person',
      actionLabel: 'PANEL DE CONTROL',
      route: '/cockpit',
      bannerTheme: 'supervisor',
    },
    allowedModuleIds: ['mod-cockpit', 'mod-security', 'mod-quality', 'mod-counting', 'mod-print'],
  },

  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    roleLabel: 'Director General (Admin)',
    terminalBadge: 'Dirección General & Administración',
    terminalTitle: 'Acceso Total al Sistema',
    terminalDesc: 'Control de todos los módulos operacionales y de soporte del ecosistema 4GUARD.',
    priorityTag: 'Director General Root',
    leaseTag: 'Acceso Global',
    activeTask: {
      folio: 'DG-2026-ROOT',
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
    // Submódulos Tácticos Especializados para Guardia de Caseta
    {
      id: 'mod-sec-entry',
      icon: 'input',
      title: 'Registrar Entrada F01',
      description: 'Nuevo ingreso de tractocamión o caja, captura bimodal (descarga/embarque), cotejo de sellos y checklist F01.',
      badgeText: 'Ingreso Inmediato',
      badgeType: 'amber',
      actionLabel: 'Nueva Entrada',
      route: '/security?tab=REGISTRATION',
    },
    {
      id: 'mod-sec-yard',
      icon: 'rv_hookup',
      title: 'Patio & Andenes Activos',
      description: 'Monitoreo de tiempos de estancia en patio, semáforo SLA de permanencia y asignación de rampas en vivo.',
      badgeText: '4 en Patio (1 Alerta)',
      badgeType: 'gold',
      actionLabel: 'Monitorear Patio',
      route: '/security?tab=IN_YARD',
    },
    {
      id: 'mod-sec-checkout',
      icon: 'output',
      title: 'Salida & Check-Out',
      description: 'Cotejo final de sellos de seguridad, validación de documentación y liberación oficial de transporte.',
      badgeText: '1 Listo para Salida',
      badgeType: 'emerald',
      actionLabel: 'Autorizar Salida',
      route: '/security?tab=CHECKOUT',
    },
    {
      id: 'mod-sec-qr',
      icon: 'how_to_reg',
      title: 'Control de Caseta & Registro',
      description: 'Bandeja de solicitudes de acceso enviadas por choferes, inspección F01 y autorización directa a patio.',
      badgeText: 'Pases en Espera',
      badgeType: 'sky',
      actionLabel: 'Ver Solicitudes',
      route: '/security?tab=REGISTRATION',
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

  /** Navegación táctil con feedback sonoro y háptico */
  protected navigate(route: string): void {
    this.audioService.playSuccess();
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    this.router.navigateByUrl(route);
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
