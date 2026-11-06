import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { driver, Driver, DriveStep } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class ForbotTourService {
  private readonly router = inject(Router);
  private activeDriver: Driver | null = null;

  /** Resuelve si el selector existe en el DOM activo; si no existe devuelve undefined para modal centrado */
  private resolveElement(selector: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const el = document.querySelector(selector);
    return el ? selector : undefined;
  }

  /**
   * Asegura que el usuario se encuentre en la ruta adecuada antes de iniciar el tour
   */
  private ensureRouteAndStart(targetRoute: string, tourFn: () => void): void {
    if (typeof window === 'undefined') return;
    const currentUrl = this.router.url;
    if (currentUrl.startsWith(targetRoute) || (targetRoute === '/dashboard' && (currentUrl === '/' || currentUrl === '/dashboard'))) {
      setTimeout(() => tourFn(), 60);
    } else {
      this.router.navigateByUrl(targetRoute).then(() => {
        setTimeout(() => tourFn(), 350);
      });
    }
  }

  /**
   * Ejecuta el tour especializado según el rol del usuario autenticado.
   */
  startTourForRole(role: string, onComplete?: () => void): void {
    const normalizedRole = role.replace(/^ROLE_/, '').toUpperCase();

    switch (normalizedRole) {
      case 'SECURITY_GUARD':
        this.ensureRouteAndStart('/security', () => this.startSecurityTour(onComplete));
        break;
      case 'OPERATIONS_MANAGER':
        this.ensureRouteAndStart('/dashboard', () => this.startOperationsManagerTour(onComplete));
        break;
      case 'CONTROL_DESK':
        this.ensureRouteAndStart('/warehouse-movements/receiving', () => this.startControlDeskTour(onComplete));
        break;
      case 'WAREHOUSE_OPERATOR':
        this.ensureRouteAndStart('/inventory-query', () => this.startWarehouseOperatorTour(onComplete));
        break;
      default:
        this.ensureRouteAndStart('/dashboard', () => this.startInterfaceTour(onComplete));
        break;
    }
  }

  /**
   * Tour Especializado: Guardia de Caseta de Seguridad
   */
  startSecurityTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('.security-header') || this.resolveElement('#tour-dashboard-header') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '👮 1. Caseta de Vigilancia & Control de Accesos',
          description: 'Bienvenido al Centro de Control de Vigilancia. Aquí gestionas el flujo integral de tractocamiones, validación de transportistas y registro de entradas y salidas.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('button[aria-label="Imprimir Cartel QR de Entrada"]'),
        popover: {
          title: '📄 2. Cartel QR Oficial para Choferes',
          description: 'Imprime en tamaño Carta el cartel con código QR oficial. El transportista lo escanea desde su teléfono móvil para completar su Check List F01.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('.security-tabs-bar'),
        popover: {
          title: '📋 3. Pestañas de Gestión Operativa',
          description: 'Control en vivo: "1. Nuevo Registro & Pases QR" para unidades recién llegadas con solicitud, y "2. Unidades en Planta & Salidas" para vehículos en descarga o listos para salir.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('button[aria-label="Ver Código QR o Configurar Túnel"]'),
        popover: {
          title: '📲 4. Visualización QR & Túnel Ngrok',
          description: 'Abre el código QR directo en pantalla para que el chofer lo escanee en la ventanilla si no puede leer el cartel exterior.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn'),
        popover: {
          title: '👤 5. Perfil, Guardia & Cambio por PIN',
          description: 'Verifica tu turno activo y realiza cambio rápido de guardia de seguridad usando tu PIN de 4 dígitos para una bitácora de auditoría segura.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 6. Copiloto ForBot Caseta (Ctrl + K)',
          description: 'Consulta en cualquier momento los criterios de inspección F01, motivos de rechazo de transporte (olores, plagas, sellos rotos) o protocolo de patio.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Especializado: Gerente de Operaciones (19 Pasos Exhaustivos)
   */
  startOperationsManagerTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard__header'),
        popover: {
          title: '🏢 1. Torre de Control Gerencial',
          description: 'Bienvenido a tu panel de mando principal. Como Gerente de Operaciones, aquí supervisas en tiempo real el Throughput de planta, la saturación volumétrica del CEDIS, la operación de andenes y el cumplimiento de SLAs de clientes.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-branch-selector') || this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '📍 2. Sucursal Activa & Contexto Operativo',
          description: 'Identifica la sede operativa activa (BR-TOL-01 Toluca). Todas las existencias, bahías, cuadrillas y movimientos se contextualizan automáticamente para esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-live-clock') || this.resolveElement('.shell__live-clock'),
        popover: {
          title: '⏱️ 3. Reloj Operacional Sincronizado',
          description: 'Reloj en tiempo real conectado con el servidor central. Marca la hora oficial para tiempos de estadía en rampa, corte de turnos y citas de transporte.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#risk-gauge-card'),
        popover: {
          title: '🚛 4. Ocupación de Andenes (Smart Docks)',
          description: 'Monitorea el flujo de tractocamiones en patio y rampas activas. Si la saturación supera el 80%, el indicador cambia a advertencia para evitar cuellos de botella. Puedes hacer clic en "Ver andenes" para ingresar directo al módulo.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#saturation-card'),
        popover: {
          title: '📦 5. Saturación Volumétrica del Almacén',
          description: 'Supervisa el porcentaje global de ocupación de las 1,714 bahías del CEDIS. Te permite anticipar la saturación crítica y planificar traspasos preventivos entre naves.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-breakdown-btn') || this.resolveElement('.dash-card__breakdown-btn'),
        popover: {
          title: '📊 6. Desglose por Bodega & Empaque',
          description: 'Acceso directo a la auditoría analítica entre Bodega A (almacenamiento masivo) y Bodega APC (acondicionamiento y empaque) para balancear la carga física.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#kpi-available'),
        popover: {
          title: '🟢 7. Tarimas Disponibles para Surtido',
          description: 'Pallets autorizados y ubicados en bahías fijas, listos para surtido inmediato y asignación de despachos Outbound.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-quarantine'),
        popover: {
          title: '🟡 8. Mercancía en Cuarentena',
          description: 'Tarimas retenidas temporalmente en andén o bahía de inspección. Requieren validación de lote y caducidad antes de autorizarse su estiba definitiva.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-blocked'),
        popover: {
          title: '🟣 9. Bloqueos de Calidad (QM)',
          description: 'Producto restringido por dictamen de Calidad debido a merma, no conformidad con la norma NOM-251 o daño físico. El sistema bloquea su movilización.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-picking'),
        popover: {
          title: '🛒 10. Tarimas en Picking / Maniobra',
          description: 'Pallets en tránsito activo dentro de andenes o pasillos siendo surtidos por montacarguistas hacia bahías de consolidación de salida.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#alerts-panel'),
        popover: {
          title: '🚨 11. Centro de Alertas Críticas',
          description: 'Detección proactiva de cuellos de botella: retrasos en descarga (>45 min), saturación de pasillos o mermas con vencimiento <30 días. Cada alerta cuenta con botón de acción directa.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📥 12. Recepción & Movimientos de Almacén',
          description: 'Corazón logístico: supervisa Recepción (Inbound), Cambio de Almacén (Putaway/Traspasos) y Salidas (Outbound FEFO). Como Gerente, puedes conmutar tareas a Prioridad URGENTE para alertar a los montacarguistas en su Terminal RF.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-performance') || this.resolveElement('a[href*="/performance"]'),
        popover: {
          title: '📈 13. Rendimiento & Auditoría de Horas',
          description: 'Monitorea las horas trabajadas por operador, productividad de cuadrillas por turno, historial de pausas activas y auditoría de inactividad de sesiones.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-admin') || this.resolveElement('a[href*="/admin"]'),
        popover: {
          title: '⚙️ 14. Administración de Turnos & Usuarios',
          description: 'Gobernanza de turnos operativos, horarios de comida programados con ventana de anticipación para montacarguistas (5 a 20 min), catálogos maestros y permisos.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-catalogs') || this.resolveElement('a[href*="/catalogs"]'),
        popover: {
          title: '🗺️ 15. Topología 2D & Semáforo de Bahías',
          description: 'Blueprint interactivo en SVG: plano arquitectónico de naves y pasillos con semáforo por bahía (verde disponible, ámbar parcial, rojo saturada, morado QM) y zoom espacial.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-inventory-query') || this.resolveElement('a[href*="/inventory-query"]'),
        popover: {
          title: '🔍 16. Consulta Global de Inventario',
          description: 'Buscador universal de existencias: localiza cualquier pallet al instante por código SKU, lote o etiqueta SSCC de 18 dígitos, con trazabilidad histórica completa.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📦 17. Ecosistema 4GUARD & Manuales',
          description: 'Lanzador corporativo: accede a los Manuales Oficiales por Perfil, Bitácora Digital F02, reglas operativas y aplicaciones satélite de Google Suite.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn'),
        popover: {
          title: '👤 18. Perfil & Cambio Rápido por PIN',
          description: 'Pausa y bloquea tu estación de trabajo en segundos o realiza cambio rápido de usuario por PIN de 4 dígitos para auditoría de relevos y turnos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 19. Copiloto Inteligente ForBot AI',
          description: 'Tu asistente de IA en vivo (Ctrl + K). Pídele análisis ejecutivos en lenguaje natural: "¿Qué productos vencen en <30 días?", "¿Cómo está la saturación de andenes?" o activa el Modo Tutor cuando lo necesites.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Especializado: Mesa de Control
   */
  startControlDeskTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('#tour-branch-selector') || this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '📍 1. Sede Operativa & Sincronización',
          description: 'Verifica la sucursal activa. Todas las órdenes de compra, citas de transporte y transferencias se filtran según esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📥 2. Pre-Recepción Inbound & Remisiones',
          description: 'Valida documentos de entrada y aplica la Regla Crítica: rechazo estricto si el lote tiene vida útil restante menor a 365 días.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '⚡ 3. Asignación de Tareas a Montacarguistas',
          description: 'Asigna misiones de descarga (Inbound) y almacenamiento (Putaway). Marca con Prioridad Urgente las transferencias críticas para liberar andén.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📤 4. Despachos Outbound bajo Norma FEFO',
          description: 'Coordina la salida de producto terminado. El sistema prioriza automáticamente los lotes más próximos a caducar para una rotación óptima.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-inventory-query') || this.resolveElement('a[href*="/inventory-query"]'),
        popover: {
          title: '🔍 5. Consulta de Stock & Trazabilidad',
          description: 'Localiza cualquier pallet por SKU, lote o código SSCC. Consulta el historial de movimientos y bloqueos de Calidad (QM).',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-catalogs') || this.resolveElement('a[href*="/catalogs"]'),
        popover: {
          title: '🗺️ 6. Topología 2D & Ocupación de Bahías',
          description: 'Visualiza la disponibilidad de racks para asignar slots óptimos de estiba evitando sobrecargar pasillos.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📦 7. Ecosistema de Herramientas & Manuales',
          description: 'Accede a la Bitácora Oficial F02, manual operativo de Mesa de Control y herramientas complementarias.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn'),
        popover: {
          title: '👤 8. Sesión & Relevo de Turno por PIN',
          description: 'Realiza el cambio de operador al término de tu jornada usando tu PIN sin cerrar sesión en el navegador.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 9. Copiloto Operativo ForBot (Ctrl + K)',
          description: 'Consulta en segundos el estado de rampas en andén, la Regla de Pablo y el ciclo de vida de 8 estados (FSM).',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Especializado: Operador de Almacén / Montacarguista en Consola Web
   */
  startWarehouseOperatorTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('#tour-nav-inventory-query') || this.resolveElement('a[href*="/inventory-query"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📦 1. Consulta Rápida de Inventario',
          description: 'Consulta existencias, ubicaciones de rack disponibles y estatus de tarimas antes de iniciar maniobras.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn') || this.resolveElement('.sidebar__user'),
        popover: {
          title: '👤 2. Sesión, Turno & Cambio por PIN',
          description: 'Verifica tu turno activo y realiza cambio rápido de operador usando tu PIN de 4 dígitos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📱 3. Terminal RF para Tablet',
          description: 'Recuerda que para operar en piso debes usar la aplicación Terminal RF, diseñada con botones táctiles grandes y lector láser.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 4. Asistente ForBot Almacén',
          description: 'Consulta dudas sobre ubicaciones de rack, reglas de estiba y protocolos de seguridad.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Guiado e Interactivo de la Interfaz General 4GUARD WMS usando Driver.js.
   */
  startInterfaceTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('.sidebar__nav'),
        popover: {
          title: '🧭 1. Menú Principal de Navegación',
          description: 'Accede rápidamente a todos los módulos operativos: Caseta de Seguridad, Recepción en Andén, Calidad QM, Topología de Almacén y Consulta de Inventario.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-branch-selector') || this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '🏢 2. Centro de Distribución & Sucursal',
          description: 'Identifica la sucursal activa (Toluca BR-TOL-01). Todas las transacciones, andenes y existencias se filtran según esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-live-clock') || this.resolveElement('.shell__live-clock'),
        popover: {
          title: '⏱️ 3. Sincronización en Tiempo Real',
          description: 'Reloj operacional sincronizado al segundo. Marca el tiempo oficial de entrada a caseta, estadía en rampa y corte de turnos.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📦 4. Ecosistema 4GUARD & Google Suite',
          description: 'Acceso directo a herramientas complementarias: tutoriales interactivos, reglas de negocio, Bitácora F02 y manuales operativos.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#theme-toggle-btn'),
        popover: {
          title: '🌓 5. Modo Día / Modo Noche',
          description: 'Alterna al instante entre la interfaz de alto contraste para exteriores de andén y el modo nocturno para reducción de fatiga visual.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn') || this.resolveElement('.sidebar__user'),
        popover: {
          title: '👤 6. Perfil, Turno & Bloqueo por PIN',
          description: 'Consulta tu rol asignado, pausa tu estación de trabajo y realiza cambio rápido de operador por PIN de 4 dígitos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 7. ForBot AI — Copiloto WMS (Ctrl + K)',
          description: 'Tu asistente inteligente en vivo. Presiona Ctrl + K en cualquier momento para consultar mermas, caducidades FEFO, normas NOM-251 y dictámenes de calidad.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  private launchDriver(steps: DriveStep[], onComplete?: () => void): void {
    this.destroyTour();

    this.activeDriver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: 'rgba(15, 23, 42, 0.82)',
      stagePadding: 8,
      stageRadius: 12,
      nextBtnText: 'Siguiente ➔',
      prevBtnText: '⬅ Anterior',
      doneBtnText: '¡Entendido! 🎉',
      progressText: 'Paso {{current}} de {{total}}',
      steps: steps,
      onDestroyed: () => {
        if (onComplete) {
          onComplete();
        }
      }
    });

    this.activeDriver.drive();
  }

  destroyTour(): void {
    if (this.activeDriver) {
      this.activeDriver.destroy();
      this.activeDriver = null;
    }
  }
}
