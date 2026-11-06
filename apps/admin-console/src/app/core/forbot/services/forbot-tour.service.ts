import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { driver, Driver, DriveStep } from 'driver.js';

export interface TourStage {
  stageId: string;
  stageName: string;
  targetRoute: string;
  getSteps: () => DriveStep[];
}

@Injectable({
  providedIn: 'root'
})
export class ForbotTourService {
  private readonly router = inject(Router);
  private activeDriver: Driver | null = null;

  // Control de estado para orquestación multi-etapa
  private currentStages: TourStage[] = [];
  private currentStageIndex = 0;
  private isMultiStageActive = false;
  private isTransitioningStage = false;

  /** Resuelve si el selector existe en el DOM activo; si no existe devuelve undefined para modal centrado */
  private resolveElement(selector: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const el = document.querySelector(selector);
    return el ? selector : undefined;
  }

  /**
   * Asegura que el usuario se encuentre en la ruta adecuada antes de iniciar la etapa del tour
   */
  private ensureRouteAndStart(targetRoute: string, tourFn: () => void): void {
    if (typeof window === 'undefined') return;
    const currentUrl = this.router.url;
    if (currentUrl.startsWith(targetRoute) || (targetRoute === '/dashboard' && (currentUrl === '/' || currentUrl === '/dashboard'))) {
      setTimeout(() => tourFn(), 120);
    } else {
      this.router.navigateByUrl(targetRoute).then(() => {
        setTimeout(() => tourFn(), 450);
      });
    }
  }

  /**
   * Ejecuta el tour especializado según el rol del usuario autenticado de forma multi-módulo completa.
   */
  startTourForRole(role: string, onComplete?: () => void): void {
    const normalizedRole = role.replace(/^ROLE_/, '').toUpperCase();

    switch (normalizedRole) {
      case 'SECURITY_GUARD':
      case 'GUARD':
      case 'CASETA':
      case 'VIGILANCIA':
        this.runMultiStageTour(this.getSecurityStages(), onComplete);
        break;

      case 'OPERATIONS_MANAGER':
      case 'WAREHOUSE_MANAGER':
      case 'OPERATIONS_COORDINATOR':
      case 'OPERATIONS_SUPERVISOR':
        this.runMultiStageTour(this.getOperationsManagerStages(), onComplete);
        break;

      case 'CONTROL_DESK':
      case 'MESA_DE_CONTROL':
      case 'MESA':
        this.runMultiStageTour(this.getControlDeskStages(), onComplete);
        break;

      case 'ADMIN':
      case 'SUPER_ADMIN':
      case 'CEO':
      case 'DIRECTOR_GENERAL':
      case 'GENERAL_DIRECTOR':
      case 'DIRECTOR':
        this.runMultiStageTour(this.getGeneralDirectorStages(), onComplete);
        break;

      case 'WAREHOUSE_OPERATOR':
      case 'MANEUVER_OPERATOR':
      case 'FORKLIFT_OPERATOR':
        this.runMultiStageTour(this.getWarehouseOperatorStages(), onComplete);
        break;

      default:
        this.startInterfaceTour(onComplete);
        break;
    }
  }

  /**
   * Orquestador multi-etapa: Navega sucesivamente por todos los módulos a los que el rol tiene acceso.
   */
  public runMultiStageTour(stages: TourStage[], onComplete?: () => void): void {
    this.destroyTour();
    if (!stages || stages.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.currentStages = stages;
    this.currentStageIndex = 0;
    this.isMultiStageActive = true;
    this.isTransitioningStage = false;

    this.executeCurrentStage(onComplete);
  }

  private executeCurrentStage(onComplete?: () => void): void {
    if (!this.isMultiStageActive || this.currentStageIndex >= this.currentStages.length) {
      this.isMultiStageActive = false;
      this.currentStages = [];
      if (onComplete) onComplete();
      return;
    }

    const stageIndex = this.currentStageIndex;
    const stage = this.currentStages[stageIndex];
    const isLastStage = stageIndex === this.currentStages.length - 1;
    const nextStage = !isLastStage ? this.currentStages[stageIndex + 1] : null;

    this.ensureRouteAndStart(stage.targetRoute, () => {
      if (!this.isMultiStageActive) return;

      this.destroyTour();

      const stageSteps = stage.getSteps();
      const stageTotal = this.currentStages.length;
      const stageNumber = stageIndex + 1;

      this.activeDriver = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayColor: 'rgba(15, 23, 42, 0.82)',
        stagePadding: 8,
        stageRadius: 12,
        nextBtnText: 'Siguiente ➔',
        prevBtnText: '⬅ Anterior',
        doneBtnText: isLastStage ? '¡Finalizar Tour Completo! 🎉' : `Ir a ${nextStage?.stageName} ➔`,
        progressText: `Módulo ${stageNumber} de ${stageTotal} (${stage.stageName}) · Paso {{current}} de {{total}}`,
        steps: stageSteps,
        onDoneClick: (el, step, { driver }) => {
          if (!isLastStage) {
            this.isTransitioningStage = true;
            driver.destroy();
            this.currentStageIndex++;
            setTimeout(() => {
              this.isTransitioningStage = false;
              this.executeCurrentStage(onComplete);
            }, 250);
          } else {
            this.isMultiStageActive = false;
            driver.destroy();
            if (onComplete) onComplete();
          }
        },
        onCloseClick: (el, step, { driver }) => {
          this.isMultiStageActive = false;
          this.currentStages = [];
          driver.destroy();
        },
        onDestroyed: () => {
          if (!this.isTransitioningStage) {
            this.isMultiStageActive = false;
            this.activeDriver = null;
          }
        }
      });

      this.activeDriver.drive();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DEFINICIÓN DE ETAPAS POR ROL OPERATIVO Y DIRECTIVO
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GERENTE DE OPERACIONES: Tour por los 6 módulos a los que tiene acceso.
   * Dashboard -> Movimientos (Recepción) -> Rendimiento -> Administración/Turnos -> Topología 2D -> Consulta Inventario -> Conclusión
   */
  public getOperationsManagerStages(): TourStage[] {
    return [
      {
        stageId: 'ops-dashboard',
        stageName: 'Torre de Control',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard-header') || this.resolveElement('.sidebar__nav'),
            popover: {
              title: '🏢 1. Torre de Control & Monitoreo del CEDIS',
              description: 'Bienvenido a la Torre de Control de 4GUARD WMS. Como Gerente de Operaciones, aquí supervisas en vivo el Throughput de la planta, la saturación volumétrica del almacén, la ocupación de andenes y el cumplimiento de SLAs de clientes.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#risk-gauge-card') || this.resolveElement('.perf-dock-card') || this.resolveElement('#tour-docks-card') || this.resolveElement('.card-docks'),
            popover: {
              title: '🚛 2. Ocupación de Andenes (Smart Docks)',
              description: 'Monitoreo en vivo de los 12 andenes. Detecta maniobras activas, rampas libres y demoras en patio para evitar penalizaciones por sobre-estadía de tractocamiones.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#saturation-card') || this.resolveElement('.perf-warehouse-saturation') || this.resolveElement('#tour-wh-saturation') || this.resolveElement('.card-saturation'),
            popover: {
              title: '📦 3. Saturación Volumétrica del Almacén',
              description: 'Supervisa la ocupación física de las 1,714 bahías del CEDIS frente al límite contratado. Te permite anticipar la saturación crítica y ordenar reubicaciones entre naves.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#tour-breakdown-btn') || this.resolveElement('.btn-breakdown') || this.resolveElement('.dashboard-actions'),
            popover: {
              title: '⚖️ 4. Balanceo: Bodega A vs Bodega APC',
              description: 'Desglose de capacidad entre almacenamiento masivo en racks altos (Bodega A) y naves de acondicionamiento, maquila y empaque (Bodega APC).',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#alerts-panel') || this.resolveElement('.system-alerts-card') || this.resolveElement('#tour-system-alerts'),
            popover: {
              title: '🚨 5. Centro de Alertas Críticas & ForBot Copiloto',
              description: 'Detección proactiva de cuellos de botella: descargas demoradas (>45 min) y alertas de caducidad crítica con la Regla de Pablo (<30 días). Haz clic en el botón siguiente para viajar a Recepción de Mercancía.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'ops-receiving',
        stageName: 'Recepción & Movimientos',
        targetRoute: '/warehouse-movements/receiving',
        getSteps: () => [
          {
            element: this.resolveElement('#tour-movements-tabs') || this.resolveElement('.movements-tabs-nav') || this.resolveElement('#rec-header'),
            popover: {
              title: '🔄 6. Ejes de Movimientos de Almacén',
              description: 'Coordinación integral del flujo físico dividido en tres procesos: 1. Recepción (Inbound), 2. Cambio de Almacén (Putaway/Traspasos) y 3. Salidas (Outbound FEFO).',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#tour-dock-summary-pill') || this.resolveElement('.dock-summary-pill'),
            popover: {
              title: '🚪 7. Telemetría y Plano Interactivo de Andenes',
              description: 'Acceso al mapa interactivo de 12 andenes: identifica qué rampa está bloqueada por descarga activa, cuál está reservada y cuáles están libres para asignación inmediata.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#rec-kpi-grid') || this.resolveElement('.movement-kpi-grid'),
            popover: {
              title: '📊 8. Throughput del Turno en Recepción',
              description: 'Supervisión de órdenes en caseta esperando andén, maniobras activas en descarga y recepciones cerradas puestas en stock.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-search-input') || this.resolveElement('.directory-search-input'),
            popover: {
              title: '🔍 9. Trazabilidad Universal de Remisiones (⌘K)',
              description: 'Localiza cualquier remisión o factura por folio, proveedor, placas de tracto o precinto fiscal. Utiliza el atajo ⌘K / Ctrl+K en cualquier momento.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-lot-hub') || this.resolveElement('.lot-hub') || this.resolveElement('#rec-directory-card-grid') || this.resolveElement('.executive-directory-card'),
            popover: {
              title: '🛡️ 10. Gobernanza de Inocuidad y Lotes (NOM-251)',
              description: 'Evaluación de vida útil según la regla del tercio (Shelf Life ≥ 33%). El WMS bloquea automáticamente la descarga de lotes no conformes salvo excepción autorizada.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-switch-urgent') || this.resolveElement('.receiving-breadcrumb-bar') || this.resolveElement('.movements-toolbar-row'),
            popover: {
              title: '⚡ 11. Prioridad Preemptiva URGENTE (Alerta RF)',
              description: 'Al activar Prioridad Urgente en una orden crítica, el sistema emite una alarma sonora y visual en las terminales RF de los montacarguistas para atenderla de inmediato.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'ops-performance',
        stageName: 'Rendimiento & Cuadrillas',
        targetRoute: '/performance/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#perf-kpi-grid') || this.resolveElement('.perf-kpi-grid'),
            popover: {
              title: '📈 12. Cuadro de Mando de Rendimiento & SLAs',
              description: 'Supervisa los 5 Macro KPIs: Ocupación, Exactitud de Inventario (IRA por conteos cíclicos), Nivel de Servicio OTIF, Ciclo Dock-to-Stock y Ciclo de Pedido.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#perf-chart-throughput') || this.resolveElement('.perf-chart-surface'),
            popover: {
              title: '⏱️ 13. Throughput en Vivo de 24 Horas',
              description: 'Curva horaria interactiva de movimientos vs meta. Alterna entre curva spline y barras Inbound/Outbound para detectar caídas de ritmo en andenes.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#perf-tab-operators') || this.resolveElement('a[routerLink="/performance/operators"]') || this.resolveElement('#perf-shifts-grid'),
            popover: {
              title: '⏰ 14. Productividad de Cuadrillas por Turno',
              description: 'Monitorea operadores activos y PPH promedio por turno (Matutino, Vespertino, Nocturno). Haz clic en un turno para filtrar el ranking de cuadrillas.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#perf-operator-bars-grid') || this.resolveElement('.perf-operator-bars-grid') || this.resolveElement('#perf-personnel-kpis'),
            popover: {
              title: '🚜 15. Pallets Por Hora (PPH) & Licencias STPS DC-3',
              description: 'Ranking de productividad de montacarguistas vs meta (≥ 25 PPH). Verifica la vigencia de la acreditación DC-3 de manejo seguro de maquinaria pesada.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'ops-shifts',
        stageName: 'Turnos & Administración',
        targetRoute: '/shifts',
        getSteps: () => [
          {
            element: this.resolveElement('#shift-code') || this.resolveElement('.shift-search-input') || this.resolveElement('#admin-hero-header') || this.resolveElement('.admin-hero'),
            popover: {
              title: '🕒 16. Catálogo de Turnos y Jornadas Laborales',
              description: 'Definición de jornadas oficiales del CEDIS, días laborables y prevención de solapamientos con detección de cruce de medianoche (Overnight).',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#shift-meal-early-pause') || this.resolveElement('#shift-has-meal') || this.resolveElement('.shift-detail-view'),
            popover: {
              title: '🍽️ 17. Horario de Comida & Ventana de Anticipación RF (5 a 20 min)',
              description: 'Regla de Seguridad Crítica: configura la ventana de anticipación para que los montacarguistas pausen ordenadamente su misión activa en la Terminal RF, trasladen la unidad a bahía de resguardo y bajen las uñas a piso sin penalizar su PPH.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'ops-topology',
        stageName: 'Topología 2D',
        targetRoute: '/catalogs/warehouse',
        getSteps: () => [
          {
            element: this.resolveElement('#topo-blueprint-svg') || this.resolveElement('.wmap__blueprint-pan') || this.resolveElement('.wmap__svg'),
            popover: {
              title: '🗺️ 18. Blueprint 2D SVG del CEDIS en Vivo',
              description: 'Plano interactivo a escala de las 12 naves masivas y de empaque con navegación espacial (Pan & Zoom de 85% a 220%).',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#topo-legend') || this.resolveElement('.wmap__legend') || this.resolveElement('.cad__bay-slot'),
            popover: {
              title: '🚦 19. Semáforo Térmico de Bahías (1,714 Posiciones)',
              description: 'Codificación por color en tiempo real: verde (disponible), azul (ocupada), rojo (bloqueada por Calidad QM) y ámbar/púrpura (precarga y buffer temporal).',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'ops-inventory',
        stageName: 'Consulta de Inventario',
        targetRoute: '/inventory-query',
        getSteps: () => [
          {
            element: this.resolveElement('#iq-kpi-grid') || this.resolveElement('.iq-kpi-grid'),
            popover: {
              title: '📦 20. Resumen de Existencias & Días de Estadía',
              description: 'Total de tarimas registradas, piezas en stock, promedio de rotación y conteo de pallets en alerta crítica de vencimiento.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#iq-search-input') || this.resolveElement('.iq-search-input'),
            popover: {
              title: '🔍 21. Búsqueda Predictiva Omnicanal',
              description: 'Búsqueda multi-token por SKU, lote, remisión o proveedor con sugerencias inteligentes agrupadas.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#iq-btn-advanced-filters') || this.resolveElement('.iq-btn-secondary'),
            popover: {
              title: '⏳ 22. Filtros Multicriterio & Regla de Pablo (<30 Días)',
              description: 'Aplica la regla de caducidad crítica para aislar mermas inmediatas y priorizar su despacho preventivo antes de que generen pérdida económica.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#iq-btn-export-excel') || this.resolveElement('.iq-btn-emerald') || this.resolveElement('.iq-table-wrap'),
            popover: {
              title: '📊 23. Exportación Oficial a Excel (21 Columnas)',
              description: 'Genera el libro contable de existencias con los 21 campos normativos de 4GUARD WMS, fórmulas vivas y trazabilidad completa de lotes.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'ops-conclusion',
        stageName: 'Conclusión en Torre de Control',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger') || this.resolveElement('.dashboard-header'),
            popover: {
              title: '🤖 24. ForBot AI — Copiloto WMS (Ctrl + K)',
              description: '¡Tour Gerencial Concluido con Éxito! Has recorrido los 6 módulos a los que tienes acceso como Gerente de Operaciones. Presiona Ctrl + K en cualquier momento para consultar indicadores en lenguaje natural.',
              side: 'left',
              align: 'end'
            }
          }
        ]
      }
    ];
  }

  /**
   * MESA DE CONTROL: Tour por los 4 módulos a los que tiene acceso.
   * Dashboard -> Movimientos (Recepción Inbound, Traspasos, Salidas) -> Topología 2D -> Consulta Inventario -> Conclusión
   */
  public getControlDeskStages(): TourStage[] {
    return [
      {
        stageId: 'cd-dashboard',
        stageName: 'Torre de Monitoreo',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard-header') || this.resolveElement('.sidebar__nav'),
            popover: {
              title: '🎛️ 1. Mesa de Control: Torre de Monitoreo',
              description: 'Bienvenido a Mesa de Control. Eres el cerebro coordinador del CEDIS: orquestas la recepción Inbound, asignas tareas prioritarias a montacarguistas en Terminal RF y coordinas despachos Outbound bajo criterio FEFO.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#risk-gauge-card') || this.resolveElement('.perf-dock-card'),
            popover: {
              title: '🚛 2. Ocupación de Andenes & Rampas',
              description: 'Supervisa qué andenes están ocupados, en maniobra o libres para recibir transportes autorizados por Caseta de Seguridad.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#saturation-card') || this.resolveElement('.perf-warehouse-saturation'),
            popover: {
              title: '📦 3. Saturación de Bodegas & Capacidad',
              description: 'Verifica si hay espacio disponible en las 1,714 bahías para asignar slots de estiba (Putaway) a compras entrantes.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'cd-receiving',
        stageName: 'Recepción & Asignación de Andenes',
        targetRoute: '/warehouse-movements/receiving',
        getSteps: () => [
          {
            element: this.resolveElement('#rec-status-filter-pills') || this.resolveElement('.directory-filter-pills'),
            popover: {
              title: '⏳ 4. Bandeja de Unidades "En Caseta"',
              description: 'Filtra las unidades que ya concluyeron la inspección física F01 en caseta y están en patio esperando asignación de andén.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-btn-assign-ramp') || this.resolveElement('button[title*="Plano"]') || this.resolveElement('#tour-dock-summary-pill'),
            popover: {
              title: '🚪 5. Asignación de Rampa Inteligente (R-01 a R-12)',
              description: 'Asigna una rampa libre del catálogo. Al confirmar, el andén se bloquea en patio para prevenir colisiones entre camiones.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-lot-hub') || this.resolveElement('.lot-hub') || this.resolveElement('#rec-directory-card-grid'),
            popover: {
              title: '📦 6. Validación de Lote & Vida Útil (≥ 365 Días)',
              description: 'Regla crítica de inocuidad: rechazo estricto si el lote de origen cuenta con una vida útil menor a 365 días en materias primas.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-switch-urgent') || this.resolveElement('.receiving-breadcrumb-bar') || this.resolveElement('#rec-logistics-command-panel'),
            popover: {
              title: '⚡ 7. Despacho Preemptivo a Terminal RF',
              description: 'Asigna al montacarguista en turno y activa Prioridad Urgente para alertarlo en su tableta montada en maquinaria.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-btn-complete-f01') || this.resolveElement('button:has-text("Aprobar e Imprimir F01")') || this.resolveElement('.receiving-header'),
            popover: {
              title: '🖨️ 8. Aprobación y Emisión de Formato F01 Oficial',
              description: 'Al terminar la descarga física en andén, aprueba el folio F01 para ingresar el inventario formalmente al WMS e imprimir el comprobante legal.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'cd-transfers',
        stageName: 'Traspasos Internos & Despacho FEFO',
        targetRoute: '/warehouse-movements/transfers',
        getSteps: () => [
          {
            element: this.resolveElement('#trf-header') || this.resolveElement('.transfer-header'),
            popover: {
              title: '🔄 9. Cambio de Almacén: Bodega A ➔ Bodega APC',
              description: 'Reubicación de inventario desde almacenamiento masivo a nave de empaque, o putaway de bahías temporales a definitivas.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#trf-dest-bay-input') || this.resolveElement('.movements-tabs-nav') || this.resolveElement('#tour-movements-tabs'),
            popover: {
              title: '🎯 10. Validación de Capacidad Destino (Máx 5 UAs)',
              description: 'El sistema valida si la bahía está vacía (En Ceros) o permite consolidación de mismo SKU, bloqueando cualquier sobrecapacidad.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('a[routerLink="/warehouse-movements/outbound"]') || this.resolveElement('.movements-tabs-nav'),
            popover: {
              title: '📤 11. Despachos Outbound & Motor FEFO',
              description: 'En el submódulo de salidas, el motor automatizado selecciona los pallets con menor fecha de vencimiento (First Expired, First Out) y emite la pauta F03.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'cd-topology',
        stageName: 'Topología 2D de Bahías',
        targetRoute: '/catalogs/warehouse',
        getSteps: () => [
          {
            element: this.resolveElement('#topo-blueprint-svg') || this.resolveElement('.wmap__blueprint-pan'),
            popover: {
              title: '🗺️ 12. Monitoreo Espacial de Racks y Bahías',
              description: 'Consulta posiciones libres para putaway, identifica bahías bloqueadas por Calidad QM y zonas de buffer temporal.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#topo-legend') || this.resolveElement('.wmap__legend'),
            popover: {
              title: '🚦 13. Semáforo Térmico de Ocupación',
              description: 'Simbología oficial: verde libre, azul ocupada, rojo bloqueada por dictamen técnico de Calidad.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'cd-inventory',
        stageName: 'Consulta de Inventario',
        targetRoute: '/inventory-query',
        getSteps: () => [
          {
            element: this.resolveElement('#iq-search-input') || this.resolveElement('.iq-search-input'),
            popover: {
              title: '🔍 14. Rastreo Rápido por SKU / Lote / SSCC',
              description: 'Localización inmediata de pallets con conteo de piezas y días de estadía acumulados en almacén.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#iq-btn-export-excel') || this.resolveElement('.iq-btn-emerald'),
            popover: {
              title: '📊 15. Exportación de Existencias a Excel',
              description: 'Descarga el reporte de 21 columnas para conciliación de existencias con proveedores y clientes corporativos.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'cd-conclusion',
        stageName: 'Conclusión en Torre de Monitoreo',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('.dashboard-header'),
            popover: {
              title: '🤖 16. Mesa de Control: Inducción Concluida',
              description: '¡Felicidades! Has completado el tour por los 4 módulos de Mesa de Control. Presiona Ctrl + K en cualquier momento para interactuar con ForBot AI.',
              side: 'left',
              align: 'end'
            }
          }
        ]
      }
    ];
  }

  /**
   * CASETA DE SEGURIDAD: Tour por Caseta, Patio, Pases QR y Dashboard de Tráfico exterior.
   */
  public getSecurityStages(): TourStage[] {
    return [
      {
        stageId: 'sec-main',
        stageName: 'Caseta de Vigilancia & Registro F01',
        targetRoute: '/security',
        getSteps: () => [
          {
            element: this.resolveElement('.security-header') || this.resolveElement('#tour-dashboard-header') || this.resolveElement('.sidebar__nav'),
            popover: {
              title: '👮 1. Caseta de Vigilancia & Control de Accesos',
              description: 'Bienvenido a la Caseta de Seguridad de 4GUARD WMS. Como Guardia de Caseta, eres el primer filtro patrimonial y de inocuidad: registras el ingreso de tractocamiones, validas transportistas, realizas la inspección física F01 y autorizas salidas.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('.security-status-badge'),
            popover: {
              title: '🟢 2. Estatus Operativo de Caseta',
              description: 'Indicador en vivo de Caseta en Servicio. Confirma que tu estación de trabajo está sincronizada en tiempo real con el servidor central para registrar arribos y salidas.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#sec-btn-print-poster') || this.resolveElement('button[aria-label="Imprimir Cartel QR de Entrada"]'),
            popover: {
              title: '📄 3. Cartel QR Oficial para Choferes',
              description: 'Genera e imprime el cartel tamaño Carta con el código QR oficial. Los transportistas que llegan a la bahía de espera lo escanean con su teléfono para iniciar su auto-registro F01 sin descender de la cabina.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#sec-btn-view-qr') || this.resolveElement('button[aria-label="Ver Código QR o Configurar Túnel"]'),
            popover: {
              title: '📲 4. Escáner QR en Pantalla & Enlace Público',
              description: 'Despliega el código QR en tu monitor para que el chofer lo escanee en la ventanilla en caso de lluvia, noche o falla en la lectura del cartel impreso.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#sec-btn-export-f02') || this.resolveElement('button[title*="F02"]'),
            popover: {
              title: '📊 5. Exportar Bitácora Oficial Excel F02',
              description: 'Descarga el formato oficial F02-PO-CP-7.1.3-03 con el tracking completo de unidades en patio, tiempos de permanencia, estatus de inspección y folios de registro.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#sec-queue-column') || this.resolveElement('aside.lg\:col-span-4') || this.resolveElement('.sidebar-collapsed-handle'),
            popover: {
              title: '⏳ 6. Choferes en Espera & Solicitudes Móviles',
              description: 'Panel en vivo: cuando un transportista envía su formulario desde su teléfono, aparece aquí con estatus "✓ Enviado". Al hacer clic en "Cargar en Caseta", sus datos se vuelcan automáticamente al formulario oficial F01.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#sec-form-stepper') || this.resolveElement('.form-stepper-bar'),
            popover: {
              title: '📝 7. Formulario Oficial F01 (Check List de Transporte)',
              description: 'Formato normativo de 4 pasos para inspección física rigurosa antes de autorizar el acceso del tractocamión a andén o patio: 1. Operación, 2. Transporte y Sellos, 3. Inocuidad NOM-251 / C-TPAT, y 4. Firmas Digitales con Rampa/Patio.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'sec-yard',
        stageName: 'Unidades en Planta & Salidas',
        targetRoute: '/security',
        getSteps: () => [
          {
            element: this.resolveElement('#sec-tab-in-yard') || this.resolveElement('.security-tabs-bar'),
            popover: {
              title: '🚛 8. Mesa de Control de Patio en Vivo',
              description: 'Pasa a la pestaña "2. Unidades en Planta & Salidas" para auditar tractocamiones que se encuentran actualmente en patio o andén de maniobra.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#sec-kpi-grid') || this.resolveElement('.module-kpi-grid'),
            popover: {
              title: '⏱️ 9. Telemetría de Patio & Tiempos de Permanencia',
              description: 'Supervisa unidades en maniobra y vehículos listos para check-out con su pauta F03 emitida por Almacén.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#sec-tab-history') || this.resolveElement('.security-tabs-bar'),
            popover: {
              title: '📜 10. Historial del Turno y Auditoría',
              description: 'Bitácora histórica del turno para entrega de guardia y auditorías patrimoniales.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'sec-traffic',
        stageName: 'Dashboard de Andenes Externos',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#risk-gauge-card') || this.resolveElement('.perf-dock-card') || this.resolveElement('#tour-docks-card'),
            popover: {
              title: '🚪 11. Monitoreo de Andenes y Rampas Externas',
              description: 'Supervisa qué andenes están en descarga activa y cuáles están libres para dar paso a las unidades desde el patio de espera.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('.dashboard-header') || this.resolveElement('#tour-dashboard-header'),
            popover: {
              title: '🚦 12. Coordinación de Flujo Patio-Andén',
              description: 'Monitorea el tráfico de unidades en tiempo real para evitar congestionamiento en la bahía de maniobras exterior.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'sec-conclusion',
        stageName: 'Retorno a Caseta & Protocolo',
        targetRoute: '/security',
        getSteps: () => [
          {
            element: this.resolveElement('.security-header') || this.resolveElement('#profile-trigger-btn'),
            popover: {
              title: '🎉 13. Inducción de Caseta Concluida',
              description: '¡Has completado el tour! Recuerda bloquear tu estación de trabajo con tu PIN de 4 dígitos al entregar el turno o al salir de caseta.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      }
    ];
  }

  /**
   * DIRECCIÓN GENERAL: Acceso Total y Estratégico a los 8 módulos clave del WMS.
   * Dashboard -> Seguridad -> Recepción -> Calidad QM -> Rendimiento -> Administración -> Topología 2D -> Consulta Inventario -> Conclusión
   */
  public getGeneralDirectorStages(): TourStage[] {
    return [
      {
        stageId: 'dir-dashboard',
        stageName: 'Torre de Control Estratégica',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard-header'),
            popover: {
              title: '🏛️ 1. Torre de Control Estratégica: Visión Macro',
              description: 'Bienvenido, Director General. Desde este panel tienes la máxima visibilidad ejecutiva del ecosistema 4GUARD WMS: supervisión integral de Throughput, cumplimiento de SLAs de clientes, saturación del CEDIS y gobernanza global de la operación.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#risk-gauge-card') || this.resolveElement('.perf-dock-card') || this.resolveElement('#tour-docks-card'),
            popover: {
              title: '🚛 2. Ocupación de Andenes & Riesgo de Estadía (Gate-to-Gate)',
              description: 'Monitoreo del ciclo puerta a puerta de transportes en planta (meta ≤ 73 min). Elimina el costo por sobre-estadías y maximiza la rotación de rampas.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#saturation-card') || this.resolveElement('.perf-warehouse-saturation') || this.resolveElement('#tour-wh-saturation'),
            popover: {
              title: '📦 3. Saturación Volumétrica y Límite Contratado',
              description: 'Monitoreo frente al límite contratado de 13,500 o 18,000 pallets. Toda posición que supere el 95% detona tarifas de sobrecupo y alerta sobre expansión.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#kpi-available') || this.resolveElement('.inventory-status-row'),
            popover: {
              title: '💰 4. Balance de Existencias: Disponible vs Cuarentena vs QM',
              description: 'Valuación del inventario: existencias disponibles para surtido inmediato frente a capital retenido temporalmente en inspección o bloqueo.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-security',
        stageName: 'Seguridad Patrimonial',
        targetRoute: '/security',
        getSteps: () => [
          {
            element: this.resolveElement('.security-header') || this.resolveElement('#sec-btn-export-f02'),
            popover: {
              title: '👮 5. Gobernanza de Accesos & Bitácora F02',
              description: 'Auditoría forense de transportistas: auto-registro por QR sin bajar de cabina y bitácora oficial F02-PO-CP-7.1.3-03 en Excel.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#sec-form-stepper') || this.resolveElement('#sec-kpi-grid'),
            popover: {
              title: '📝 6. Auditoría de Inspección Física F01 y Sellos Fiscales',
              description: 'Inspección rigurosa de 12 criterios de inocuidad y verificación de sellos de origen para blindaje patrimonial y aduanal.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-movements',
        stageName: 'Recepción & Cadena de Suministro',
        targetRoute: '/warehouse-movements/receiving',
        getSteps: () => [
          {
            element: this.resolveElement('#rec-header') || this.resolveElement('#tour-dock-summary-pill'),
            popover: {
              title: '📥 7. Cadena de Suministro Inbound & Outbound',
              description: 'Eficiencia de descarga en andenes 1-12, balanceo de naves masivas y trazabilidad universal de órdenes de compra con atajo ⌘K.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-lot-hub') || this.resolveElement('#rec-directory-card-grid'),
            popover: {
              title: '🛡️ 8. Candados de Calidad, Vida Útil (≥ 365 Días) y Báscula (±2%)',
              description: 'El sistema congela el tiempo nodal T1 únicamente cuando el lote cumple la regla de vida útil y tolerancia de peso en báscula de ±2%.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#rec-switch-urgent') || this.resolveElement('.movements-toolbar-row'),
            popover: {
              title: '⚡ 9. Despachos con Prioridad Preemptiva y Rotación FEFO',
              description: 'Capacidad de priorización de órdenes críticas sobre terminales RF y surtido estricto por caducidad para evitar mermas financieras.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'dir-quality',
        stageName: 'Calidad QM & NOM-251',
        targetRoute: '/quality',
        getSteps: () => [
          {
            element: this.resolveElement('#qm-header') || this.resolveElement('.quality-header'),
            popover: {
              title: '🔬 10. Aseguramiento de Calidad & Normatividad NOM-251',
              description: 'Gobernanza sanitaria y control físico-químico del producto almacenado conforme a normas de inocuidad alimentaria y farmacéutica.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#qm-kpi-grid') || this.resolveElement('.quality-kpi-grid'),
            popover: {
              title: '📋 11. Cuarentena, Bloqueos por PNC y 3 Destinos de Liberación',
              description: 'Monitoreo de material restringido y dictámenes formales de liberación con 3 destinos controlados: Distribución, Destrucción con acta o Devolución.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-performance',
        stageName: 'Productividad & Semáforo WMS',
        targetRoute: '/performance/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#perf-chart-throughput') || this.resolveElement('.perf-chart-surface'),
            popover: {
              title: '📈 12. Throughput de 24 Horas vs Metas Corporativas',
              description: 'Evaluación del ritmo operativo de planta hora por hora para garantizar el cumplimiento de SLAs y absorción de costos fijos.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#perf-shifts-grid') || this.resolveElement('#perf-kpi-grid'),
            popover: {
              title: '🚦 13. Semáforo Oficial de Montacarguistas (211-233+ vs Estándar)',
              description: 'Distribución de cuadrillas: personal en franja de Alta Eficiencia (211 a 233+ tarimas/turno) vs Estándar (100 a 200) para optimización laboral.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#perf-operator-bars-grid') || this.resolveElement('#perf-personnel-kpis'),
            popover: {
              title: '🚜 14. Productividad PPH & Cumplimiento Normativo STPS DC-3',
              description: 'Auditoría de acreditaciones DC-3 de manejo seguro de maquinaria pesada: cero tolerancia a operadores con certificación vencida.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-admin',
        stageName: 'Gobernanza RBAC & Turnos',
        targetRoute: '/admin',
        getSteps: () => [
          {
            element: this.resolveElement('#admin-card-roles') || this.resolveElement('#admin-hero-header') || this.resolveElement('.admin-hero'),
            popover: {
              title: '🛡️ 15. Matriz de Permisos RBAC en 7 Niveles Jerárquicos',
              description: 'Segregación estricta de funciones desde Nivel 1 Administrador hasta Nivel 7 Consulta Básica, garantizando integridad patrimonial.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#admin-card-shifts') || this.resolveElement('.admin-category'),
            popover: {
              title: '⚖️ 16. Gobernanza de Turnos y Ventana de Anticipación RF',
              description: 'Cumplimiento normativo laboral: horario de comida con ventana de anticipación (5 a 20 min) para resguardo seguro de maquinaria con uñas a piso.',
              side: 'top',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-topology',
        stageName: 'Capacidad Espacial 2D',
        targetRoute: '/catalogs/warehouse',
        getSteps: () => [
          {
            element: this.resolveElement('#topo-blueprint-svg') || this.resolveElement('.wmap__blueprint-pan'),
            popover: {
              title: '🗺️ 17. Blueprint 2D SVG y Zonificación Masiva / APC',
              description: 'Representación técnica del CEDIS en vector SVG para análisis de densidad de estiba y optimización de rutas de montacargas.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#topo-legend') || this.resolveElement('.wmap__legend'),
            popover: {
              title: '⚠️ 18. Prevención de Sobrecupo y Alertas de Capacidad Crítica',
              description: 'Detección visual de naves saturadas (>80%) para prevenir desbordes a pasillos de tránsito o bloqueos de rutas de evacuación.',
              side: 'bottom',
              align: 'start'
            }
          }
        ]
      },
      {
        stageId: 'dir-inventory',
        stageName: 'Auditoría Forense de Inventario',
        targetRoute: '/inventory-query',
        getSteps: () => [
          {
            element: this.resolveElement('#iq-kpi-grid') || this.resolveElement('.iq-kpi-grid'),
            popover: {
              title: '📦 19. Valuación de Existencias & Días de Estadía',
              description: 'Control de stock auditado: conteo de piezas, tarimas físicas y promedio de días de permanencia para cálculo de rentabilidad 3PL.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#iq-btn-advanced-filters') || this.resolveElement('.iq-btn-secondary'),
            popover: {
              title: '⏳ 20. Alerta Crítica de Caducidad de Pablo (<30 Días)',
              description: 'Aislamiento de producto próximo a caducar para negociar devoluciones con proveedores o remates comerciales con clientes.',
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: this.resolveElement('#iq-btn-export-excel') || this.resolveElement('.iq-btn-emerald'),
            popover: {
              title: '📊 21. Exportación Forense a Excel (21 Columnas Oficiales)',
              description: 'Descarga de la bitácora total de existencias con los 21 campos normativos de 4GUARD WMS para dictamen de auditoría contable.',
              side: 'bottom',
              align: 'end'
            }
          }
        ]
      },
      {
        stageId: 'dir-conclusion',
        stageName: 'Cierre Estratégico',
        targetRoute: '/dashboard',
        getSteps: () => [
          {
            element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger') || this.resolveElement('.dashboard-header'),
            popover: {
              title: '🤖 22. ForBot AI: Asesor Estratégico Ejecutivo (Ctrl + K)',
              description: '¡Tour de Dirección General Concluido! Cuentas con dominio integral de los 8 módulos del ecosistema WMS. Presiona Ctrl + K en cualquier momento para solicitar análisis con inteligencia artificial.',
              side: 'left',
              align: 'end'
            }
          }
        ]
      }
    ];
  }

  /**
   * OPERADOR DE ALMACÉN / MONTACARGUISTA: Tour enfocado en Terminal RF, Consulta y Ubicaciones.
   */
  public getWarehouseOperatorStages(): TourStage[] {
    return [
      {
        stageId: 'op-inventory',
        stageName: 'Consulta de Ubicaciones',
        targetRoute: '/inventory-query',
        getSteps: () => [
          {
            element: this.resolveElement('#iq-search-input') || this.resolveElement('.iq-search-input'),
            popover: {
              title: '🔍 1. Búsqueda de Productos & Bahías',
              description: 'Localiza al instante el código de bahía (ej. A-02-14) donde debes almacenar o recoger una tarima.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#iq-btn-advanced-filters') || this.resolveElement('.iq-btn-secondary'),
            popover: {
              title: '⏳ 2. Alerta de Caducidades FEFO',
              description: 'Identifica lotes con prioridad de salida para respetar la rotación de producto.',
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
            popover: {
              title: '🤖 3. Asistente ForBot Almacén',
              description: 'Consulta dudas sobre ubicaciones de rack, reglas de estiba y protocolos de seguridad.',
              side: 'left',
              align: 'end'
            }
          }
        ]
      }
    ];
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

  // Compatibilidad con tours de un solo módulo
  public startSecurityTour(onComplete?: () => void): void {
    this.runMultiStageTour(this.getSecurityStages(), onComplete);
  }

  public startOperationsManagerTour(onComplete?: () => void): void {
    this.runMultiStageTour(this.getOperationsManagerStages(), onComplete);
  }

  public startControlDeskTour(onComplete?: () => void): void {
    this.runMultiStageTour(this.getControlDeskStages(), onComplete);
  }

  public startGeneralDirectorTour(onComplete?: () => void): void {
    this.runMultiStageTour(this.getGeneralDirectorStages(), onComplete);
  }

  public startWarehouseOperatorTour(onComplete?: () => void): void {
    this.runMultiStageTour(this.getWarehouseOperatorStages(), onComplete);
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
