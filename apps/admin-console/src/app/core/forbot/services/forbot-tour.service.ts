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
   * Ejecuta el tour especializado según el rol del usuario autenticado.
   */
  startTourForRole(role: string, onComplete?: () => void): void {
    const normalizedRole = role.replace(/^ROLE_/, '').toUpperCase();

    switch (normalizedRole) {
      case 'SECURITY_GUARD':
        this.startSecurityTour(onComplete);
        break;
      case 'OPERATIONS_MANAGER':
        this.startOperationsManagerTour(onComplete);
        break;
      case 'CONTROL_DESK':
        this.startControlDeskTour(onComplete);
        break;
      case 'WAREHOUSE_OPERATOR':
        this.startWarehouseOperatorTour(onComplete);
        break;
      default:
        this.startInterfaceTour(onComplete);
        break;
    }
  }

  /**
   * Tour Especializado: Guardia de Caseta de Seguridad
   */
  startSecurityTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('.security-header') || this.resolveElement('.sidebar__nav'),
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
        element: this.resolveElement('fg-forbot-trigger-button'),
        popover: {
          title: '🤖 5. Copiloto ForBot Caseta',
          description: 'Haz clic aquí o presiona Ctrl + K para consultar criterios de inspección F01, motivos de rechazo de transporte (olores, plagas, sellos rotos) o protocolo de patio.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Especializado: Gerente de Operaciones
   */
  startOperationsManagerTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('.sidebar__nav') || this.resolveElement('.sidebar'),
        popover: {
          title: '📊 1. Panel de Control & Rendimiento',
          description: 'Supervisa el Throughput general del CEDIS: total de pallets recibidos, saturation de bodegas (Bodega A vs APC) y cumplimiento de metas por turno.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '🗺️ 2. Topología 2D & Torre de Control',
          description: 'Visualiza la distribución de racks, andenes y bahías en vivo. Identifica cuellos de botella y balancea la carga entre rampas operativas.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('a[href*="/performance"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '⏱️ 3. Horas Trabajadas & Productividad',
          description: 'Audita el tiempo de conexión de montacarguistas, horas laboradas por turno, pausas activas y métricas de desempeño por operador.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📦 4. Ecosistema de Administración',
          description: 'Acceso a la configuración de reglas de negocio, manuales operativos, Bitácora Oficial F02 y herramientas de soporte.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('fg-forbot-trigger-button'),
        popover: {
          title: '🤖 5. ForBot AI — Análisis Gerencial',
          description: 'Solicita análisis instantáneos de inventario crítico, mermas con vencimiento <30 días y saturación de bahías en lenguaje natural.',
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
        element: this.resolveElement('a[href*="/reception"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📥 1. Pre-Recepción Inbound & Remisiones',
          description: 'Valida documentos de entrada y aplica la Regla Crítica: rechazo estricto si el lote tiene vida útil restante menor a 365 días.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '⚡ 2. Asignación de Tareas a Montacarguistas',
          description: 'Asigna misiones de descarga (Inbound) y almacenamiento (Putaway). Marca con Prioridad Urgente las transferencias críticas para liberar andén.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('a[href*="/outbound"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📤 3. Despachos Outbound bajo Norma FEFO',
          description: 'Coordina la salida de producto terminado. El sistema prioriza automáticamente los lotes más próximos a caducar para una rotación óptima.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('a[href*="/inventory-query"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '🔍 4. Consulta de Stock & Trazabilidad',
          description: 'Localiza cualquier pallet por SKU, lote o código SSCC. Consulta el historial de movimientos y bloqueos de Calidad (QM).',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('fg-forbot-trigger-button'),
        popover: {
          title: '🤖 5. Copiloto Operativo ForBot',
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
        element: this.resolveElement('a[href*="/inventory-query"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📦 1. Consulta Rápida de Inventario',
          description: 'Consulta existencias, ubicaciones de rack disponibles y estatus de tarimas antes de iniciar maniobras.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('.sidebar__user'),
        popover: {
          title: '👤 2. Sesión, Turno & Cambio por PIN',
          description: 'Verifica tu turno activo y realiza cambio rápido de operador usando tu PIN de 4 dígitos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('fg-forbot-trigger-button'),
        popover: {
          title: '📱 3. Terminal RF para Tablet',
          description: 'Recuerda que para operar en piso debes usar la aplicación Terminal RF, diseñada con botones táctiles grandes y lector láser.',
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
        element: this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '🏢 2. Centro de Distribución & Sucursal',
          description: 'Identifica la sucursal activa (Toluca BR-TOL-01). Todas las transacciones, andenes y existencias se filtran según esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('.shell__live-clock'),
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
        element: this.resolveElement('.sidebar__user'),
        popover: {
          title: '👤 6. Perfil, Turno & Bloqueo por PIN',
          description: 'Consulta tu rol asignado, pausa tu estación de trabajo y realiza cambio rápido de operador por PIN de 4 dígitos.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('fg-forbot-trigger-button'),
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
