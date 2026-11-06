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
      case 'GUARD':
      case 'CASETA':
      case 'VIGILANCIA':
        this.ensureRouteAndStart('/security', () => this.startSecurityTour(onComplete));
        break;

      case 'OPERATIONS_MANAGER':
      case 'WAREHOUSE_MANAGER':
      case 'OPERATIONS_COORDINATOR':
      case 'OPERATIONS_SUPERVISOR':
        this.ensureRouteAndStart('/dashboard', () => this.startOperationsManagerTour(onComplete));
        break;

      case 'CONTROL_DESK':
      case 'MESA_DE_CONTROL':
      case 'MESA':
        this.ensureRouteAndStart('/dashboard', () => this.startControlDeskTour(onComplete));
        break;

      case 'ADMIN':
      case 'SUPER_ADMIN':
      case 'CEO':
      case 'DIRECTOR_GENERAL':
      case 'GENERAL_DIRECTOR':
      case 'DIRECTOR':
        this.ensureRouteAndStart('/dashboard', () => this.startGeneralDirectorTour(onComplete));
        break;

      case 'WAREHOUSE_OPERATOR':
      case 'MANEUVER_OPERATOR':
      case 'FORKLIFT_OPERATOR':
        this.ensureRouteAndStart('/inventory-query', () => this.startWarehouseOperatorTour(onComplete));
        break;

      default:
        this.ensureRouteAndStart('/dashboard', () => this.startInterfaceTour(onComplete));
        break;
    }
  }

  /**
   * Tour Especializado: Guardia de Caseta de Seguridad (14 Pasos)
   */
  startSecurityTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
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
        element: this.resolveElement('.security-tabs-bar'),
        popover: {
          title: '📋 6. Pestañas de Gestión Operativa',
          description: 'Control de flujo: "1. Nuevo Registro & Pases QR" para autorizar transportistas entrantes, "2. Unidades en Planta & Salidas" para vehículos en maniobra y check-out, y "3. Historial del Turno" para auditorías.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#sec-kpi-grid') || this.resolveElement('.module-kpi-grid'),
        popover: {
          title: '🚛 7. Telemetría de Patio en Tiempo Real',
          description: 'Supervisa al instante: Unidades actualmente en Planta, Choferes en Espera con QR pendiente de revisión, Unidades con maniobra autorizada listas para salida y total de egresos del turno.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#sec-queue-column') || this.resolveElement('aside.lg\:col-span-4') || this.resolveElement('.sidebar-collapsed-handle'),
        popover: {
          title: '⏳ 8. Choferes en Espera & Solicitudes Móviles',
          description: 'Panel en vivo: cuando un transportista envía su formulario desde su teléfono, aparece aquí con estatus "✓ Enviado". Al hacer clic en "Cargar en Caseta", sus datos se vuelcan automáticamente al formulario oficial F01.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#sec-form-stepper') || this.resolveElement('.form-stepper-bar'),
        popover: {
          title: '📝 9. Formulario Oficial F01 (Check List de Transporte)',
          description: 'Formato normativo de 4 pasos para inspección física rigurosa antes de autorizar el acceso del tractocamión a andén o patio.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#form-step-1'),
        popover: {
          title: '📥 10. Paso 1: Tipo de Operación',
          description: 'Selecciona el tipo de movimiento: Descarga (Inbound), Carga (Outbound) o Maniobra interna. Vincula el número de orden de compra o remisión de proveedor.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#form-step-2'),
        popover: {
          title: '🚛 11. Paso 2: Transporte & Identidad de la Unidad',
          description: 'Verifica la línea transportista, nombre completo del chofer, placas de tractocamión, placas de caja/remolque y número de sellos fiscales de origen.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#form-step-3'),
        popover: {
          title: '🔍 12. Paso 3: Criterios de Inspección Física F01',
          description: 'Verificación obligatoria de inocuidad: caja seca limpia, libre de humedad, sin olores extraños, sin evidencia de plagas y sellos intactos. Un solo criterio no conforme genera rechazo inmediato.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#form-step-4'),
        popover: {
          title: '✍️ 13. Paso 4: Firmas Digitales & Asignación de Rampa/Patio',
          description: 'Captura de firma digital del chofer y del guardia de caseta. Autoriza el acceso asignando patio de espera o rampa designada para inicio de maniobra.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 14. Copiloto ForBot Caseta (Ctrl + K)',
          description: 'Tu asesor de seguridad inteligente. Consúltale motivos de rechazo normativo (humedad, plagas, sellos alterados), protocolos de patio o dudas operativas de turno.',
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
          description: 'Monitorea el flujo de tractocamiones en patio y rampas activas. Si la saturación supera el 80%, el indicador cambia a advertencia para evitar cuellos de botella.',
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
          description: 'Detección proactiva de cuellos de botella: retrasos en descarga (>45 min), saturación de pasillos o mermas con vencimiento <30 días.',
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
   * Tour Especializado: Mesa de Control (15 Pasos Operativos Exhaustivos)
   */
  startControlDeskTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard__header'),
        popover: {
          title: '🎛️ 1. Mesa de Control: Torre de Monitoreo',
          description: 'Bienvenido a Mesa de Control. Como operador de Mesa de Control, eres el cerebro coordinador del CEDIS: orquestas la recepción Inbound, asignas tareas prioritarias a montacarguistas en Terminal RF y coordinas despachos Outbound bajo criterio FEFO.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-branch-selector') || this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '📍 2. Sede Operativa Activa',
          description: 'Contexto de sucursal BR-TOL-01 Toluca. Todas las órdenes de compra, citas de transporte, existencias y despachos están sincronizados para esta sede.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-live-clock') || this.resolveElement('.shell__live-clock'),
        popover: {
          title: '⏱️ 3. Reloj Operacional Sincronizado',
          description: 'Marca la hora oficial del sistema. Crucial para monitorear ventanas de citas de proveedores, tiempos de estadía en rampa y corte de turnos.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#risk-gauge-card'),
        popover: {
          title: '🚛 4. Ocupación de Andenes & Rampas',
          description: 'Supervisa en tiempo real qué rampas están ocupadas, en maniobra activa o libres para recibir tractocamiones autorizados por Caseta de Seguridad.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#saturation-card'),
        popover: {
          title: '📦 5. Saturación Volumétrica del Almacén',
          description: 'Capacidad de las 1,714 bahías. Te indica si hay espacio suficiente para ubicar pallets de compras entrantes o si se requiere consolidación previa de racks.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-available'),
        popover: {
          title: '🟢 6. Pallets Disponibles para Surtido',
          description: 'Inventario disponible de inmediato para asignar a pedidos y transferencias de salida.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-quarantine'),
        popover: {
          title: '🟡 7. Mercancía en Cuarentena & Retenida',
          description: 'Tarimas en andén pendientes de validación técnica o dictamen de Calidad. Mesa de Control no puede despachar producto en este estado.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#alerts-panel'),
        popover: {
          title: '🚨 8. Alertas Operativas en Tiempo Real',
          description: 'Notificaciones de descargas retrasadas (>45 min) o mermas con vencimiento próximo para coordinar acciones correctivas con montacarguistas.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📥 9. Recepción & Pre-Recepción Inbound',
          description: 'Módulo central de movimientos: valida remisiones de proveedores y aplica la Regla Crítica de Vida Útil: rechazo estricto si el lote tiene caducidad menor a 365 días.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '⚡ 10. Asignación de Misiones a Montacarguistas (RF)',
          description: 'Asigna tareas de descarga y almacenamiento (Putaway). Marca con Prioridad URGENTE las tarimas críticas para alertar a los operadores en su Terminal RF.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📤 11. Despachos Outbound bajo Norma FEFO',
          description: 'Coordinación de pedidos de salida. El sistema selecciona automáticamente los lotes más próximos a vencer (FEFO) para garantizar una rotación perfecta de producto.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-catalogs') || this.resolveElement('a[href*="/catalogs"]'),
        popover: {
          title: '🗺️ 12. Topología 2D & Semáforo de Bahías',
          description: 'Mapa visual de naves, pasillos y racks. Permite a Mesa de Control ubicar slots de estiba disponibles para optimizar los recorridos del montacargas.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-inventory-query') || this.resolveElement('a[href*="/inventory-query"]'),
        popover: {
          title: '🔍 13. Consulta Global de Inventario Multi-Criterio',
          description: 'Buscador avanzado: rastrea cualquier pallet por SKU, lote o código SSCC de 18 dígitos, con trazabilidad histórica completa de movimientos.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#profile-trigger-btn'),
        popover: {
          title: '👤 14. Perfil Operativo & Relevo por PIN',
          description: 'Relevo rápido de turno entre operadores de Mesa de Control mediante PIN de 4 dígitos, sin cerrar sesión en el navegador.',
          side: 'right',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 15. Copiloto Operativo ForBot AI (Ctrl + K)',
          description: 'Tu asistente inteligente en vivo. Pregúntale: "¿Cómo asignar misiones urgentes?", "¿Cuál es el ciclo de 8 estados FSM?" o solicita auditoría de andenes.',
          side: 'left',
          align: 'end'
        }
      }
    ];

    this.launchDriver(steps, onComplete);
  }

  /**
   * Tour Especializado: Dirección General / Administrador Ejecutivo (19 Pasos Estratégicos)
   */
  startGeneralDirectorTour(onComplete?: () => void): void {
    const steps: DriveStep[] = [
      {
        element: this.resolveElement('#tour-dashboard-header') || this.resolveElement('.dashboard__header'),
        popover: {
          title: '🏛️ 1. Dirección General: Torre de Control Estratégica',
          description: 'Bienvenido, Director General. Desde este panel tienes la máxima visibilidad ejecutiva del ecosistema 4GUARD WMS: supervisión integral de Throughput, cumplimiento de SLAs de clientes, saturación del CEDIS y gobernanza global de la operación.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-branch-selector') || this.resolveElement('.shell__branch-selector'),
        popover: {
          title: '📍 2. Gobernanza Multisede & Sucursales',
          description: 'Control de sedes activas (BR-TOL-01 Toluca). Te permite auditar el desempeño de cada centro de distribución del grupo empresarial de forma centralizada.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-live-clock') || this.resolveElement('.shell__live-clock'),
        popover: {
          title: '⏱️ 3. Reloj Operacional Oficial & Telemetría',
          description: 'Sincronización en tiempo real con el servidor central para auditoría forense de tiempos de ciclo, cortes de turno y registro de eventos.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#risk-gauge-card'),
        popover: {
          title: '🚛 4. Ocupación de Andenes & Eficiencia Logística',
          description: 'Monitoreo del flujo de transporte en patio y rampas. Permite identificar cuellos de botella en la operación y prevenir penalizaciones por sobre-estadía de camiones.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#saturation-card'),
        popover: {
          title: '📦 5. Saturación Volumétrica Global (1,714 Bahías)',
          description: 'Supervisa la ocupación del CEDIS para planificar expansiones de capacidad, transferencias entre naves y optimización del costo por tarima almacenada.',
          side: 'bottom',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-breakdown-btn') || this.resolveElement('.dash-card__breakdown-btn'),
        popover: {
          title: '📊 6. Auditoría Analítica: Bodega A vs Bodega APC',
          description: 'Desglose de capacidad entre Bodega A (almacenamiento masivo) y Bodega APC (acondicionamiento, empaque y valor agregado).',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#kpi-available'),
        popover: {
          title: '🟢 7. Valor del Inventario Disponible',
          description: 'Pallets listos para surtido inmediato y facturación a clientes corporativos.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-quarantine'),
        popover: {
          title: '🟡 8. Mercancía en Cuarentena & Retenida',
          description: 'Capital inmovilizado temporalmente en andén o bahía de inspección por validación de lote y caducidad.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#kpi-blocked'),
        popover: {
          title: '🟣 9. Bloqueos de Calidad QM & Merma',
          description: 'Monitoreo de material restringido por no conformidades NOM-251, mermas o daños físicos, asegurando cero fugas de producto no conforme.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#alerts-panel'),
        popover: {
          title: '🚨 10. Centro de Alertas Críticas & SLAs',
          description: 'Detección proactiva de riesgos operacionales: retrasos en descarga (>45 min), saturación de pasillos o lotes con vencimiento <30 días.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-security') || this.resolveElement('a[href*="/security"]'),
        popover: {
          title: '👮 11. Módulo de Seguridad Patrimonial & Caseta',
          description: 'Auditoría integral de accesos: registro de transportistas por QR móvil, cumplimiento de formato F01, inspección física y trazabilidad de patio.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-warehouse-movements') || this.resolveElement('a[href*="/warehouse-movements"]') || this.resolveElement('.sidebar__nav'),
        popover: {
          title: '📥 12. Movimientos de Almacén (Inbound, Putaway, Outbound)',
          description: 'Supervisión de la cadena de suministro interna: recepción estricta (vida útil ≥ 365 días), traspasos entre naves y despachos bajo norma FEFO.',
          side: 'right',
          align: 'start'
        }
      },
      {
        element: this.resolveElement('#tour-nav-quality') || this.resolveElement('a[href*="/quality"]'),
        popover: {
          title: '🔬 13. Módulo de Control de Calidad (QM)',
          description: 'Gobernanza de inocuidad alimentaria conforme a NOM-251: planes de muestreo militar estándar, inspección organoléptica y dictámenes de liberación.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-performance') || this.resolveElement('a[href*="/performance"]'),
        popover: {
          title: '📈 14. Rendimiento Operativo & Productividad',
          description: 'Telemetría de cuadrillas por turno, horas efectivas trabajadas por montacarguistas, tiempos de ciclo por rampa y auditoría de inactividad.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-admin') || this.resolveElement('a[href*="/admin"]'),
        popover: {
          title: '⚙️ 15. Administración del Sistema & Gobernanza RBAC',
          description: 'Gestión de turnos de trabajo, horarios de comida con ventana de anticipación para montacarguistas (5 a 20 min), roles, casetas y seguridad de sesiones.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-catalogs') || this.resolveElement('a[href*="/catalogs"]'),
        popover: {
          title: '🗺️ 16. Topología 2D & Plano Arquitectónico',
          description: 'Blueprint interactivo en SVG con semaforización de bahías y visualización espacial de naves y pasillos en tiempo real.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#tour-nav-inventory-query') || this.resolveElement('a[href*="/inventory-query"]'),
        popover: {
          title: '🔍 17. Consulta Universal de Inventario',
          description: 'Buscador global con trazabilidad de punta a punta: rastreo forense por SKU, lote, fecha y código SSCC de 18 dígitos.',
          side: 'right',
          align: 'center'
        }
      },
      {
        element: this.resolveElement('#waffle-menu-btn'),
        popover: {
          title: '📦 18. Ecosistema SyborX & Manuales Ejecutivos',
          description: 'Acceso centralizado al ecosistema corporativo: Manuales Oficiales de Usuario por Perfil, Bitácora Digital F02 y herramientas Google Workspace.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: this.resolveElement('#forbot-fab-btn') || this.resolveElement('#tour-forbot-trigger'),
        popover: {
          title: '🤖 19. ForBot AI: Asesor Estratégico Ejecutivo (Ctrl + K)',
          description: 'Tu copiloto de IA directivo. Pídele consolidados en lenguaje natural: "¿Cuál es el throughput semanal?", "Reporte de mermas críticas" o activa el Modo Tutor en cualquier momento.',
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
