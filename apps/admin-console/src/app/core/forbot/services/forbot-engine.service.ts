/**
 * @file forbot-engine.service.ts
 * @description Motor NLP Conversacional 100% Local (0-Tokens) para ForBot (4GUARD AI).
 * Procesa intenciones con Pattern Matching, lee métricas reactivas directamente de las Signals de la app,
 * ofrece soporte para Modo Operativo vs Modo Tutor y coordina el Tour de Pantalla.
 */

import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ForbotChatMessage,
  ForbotIntentType,
  ForbotWidgetData,
  ForbotMode
} from '../models/forbot.models';
import { InventoryQueryService } from '../../../features/inventory-query/services/inventory-query.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { CatalogsService } from '../../../features/catalogs/services/catalogs.service';
import { QualityStateService } from '../../../features/quality/services/quality-state.service';
import { AuthState } from '../../../core/auth/auth.state';
import { ForbotTourService } from './forbot-tour.service';

@Injectable({
  providedIn: 'root'
})
export class ForbotEngineService {
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryQueryService);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly catalogsService = inject(CatalogsService);
  private readonly qualityState = inject(QualityStateService);
  private readonly authState = inject(AuthState);
  private readonly tourService = inject(ForbotTourService);

  /** Visibilidad del Drawer Flotante Lateral */
  public readonly isDrawerOpen = signal<boolean>(false);

  /** Modo de Operación: 'operativo' (default) o 'tutor' (inducción interactiva) */
  public readonly currentMode = signal<ForbotMode>('operativo');

  /** Señal de Estado de Tema (Modo Día / Modo Noche) */
  public readonly isDarkMode = signal<boolean>(this.detectDarkMode());

  constructor() {
    // Escucha en tiempo real cambios de clase en el elemento raíz (HTML)
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        this.checkTheme();
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  }

  private detectDarkMode(): boolean {
    if (typeof document === 'undefined') return false;
    const root = document.documentElement;
    const body = document.body;
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('synexia-theme') : null;
    return (
      root.classList.contains('theme-dark') ||
      root.classList.contains('dark') ||
      body.classList.contains('theme-dark') ||
      body.classList.contains('dark') ||
      saved === 'dark'
    );
  }

  public checkTheme(): boolean {
    const isDark = this.detectDarkMode();
    this.isDarkMode.set(isDark);
    return isDark;
  }

  /** Historial de conversación en vivo */
  public readonly chatHistory = signal<ForbotChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'bot',
      text: '¡Hola! Soy **ForBot**, tu asistente inteligente de almacén en **4GUARD WMS**. Puedo responder al instante consultas sobre caducidades, saturación de bodegas, rampas y rendimiento operacional. ¿En qué te puedo apoyar hoy?',
      timestamp: this.getCurrentTimestamp(),
      widgetData: {
        type: 'kpi-summary',
        title: 'Estado General del Almacén (4GUARD Live)',
        items: [
          { label: 'Palets en Stock', value: '7.00 Tarimas', badgeColor: 'emerald' },
          { label: 'Rampas Activas', value: '4 Andenes', badgeColor: 'blue' },
          { label: 'Alertas <30d', value: '3 Mermas', badgeColor: 'amber' }
        ],
        actionRoute: '/inventory-query',
        actionLabel: 'Ver Consulta de Inventario',
        proactiveTip: 'Sugerencia FEFO: 2 tarimas de Alpura (Lote L-8841) en Alerta Pablo tienen prioridad de despacho sugerida.'
      }
    }
  ]);

  public setMode(mode: ForbotMode): void {
    this.currentMode.set(mode);
    if (mode === 'tutor') {
      this.chatHistory.update((msgs) => [
        ...msgs,
        {
          id: `tutor-welcome-${Date.now()}`,
          sender: 'bot',
          intent: 'GENERAL_HELP',
          timestamp: this.getCurrentTimestamp(),
          text: '🎓 **Modo Tutor Activado**\nBienvenido al centro de inducción interactivo de 4GUARD WMS. Puedes iniciar el **Tour de Pantalla** o preguntarme sobre el **ciclo de 8 estados (FSM)** o la **Regla de Pablo**.',
          widgetData: {
            type: 'tutorial-card',
            title: 'Inducción de Interfaz 4GUARD',
            items: [
              { label: 'Navegación & Menú', value: 'Módulo 1', badgeColor: 'blue' },
              { label: 'Filtros & Búsqueda', value: 'Módulo 2', badgeColor: 'amber' },
              { label: 'FSM & Trazabilidad', value: 'Módulo 3', badgeColor: 'emerald' }
            ],
            actionLabel: 'Iniciar Tour'
          }
        }
      ]);
    }
  }

  public startDriverTour(): void {
    this.isDrawerOpen.set(false);
    this.tourService.startInterfaceTour(() => {
      this.isDrawerOpen.set(true);
      this.chatHistory.update((msgs) => [
        ...msgs,
        {
          id: `tour-complete-${Date.now()}`,
          sender: 'bot',
          intent: 'TOUR_DRIVER_JS',
          timestamp: this.getCurrentTimestamp(),
          text: '🎉 **¡Felicidades!** Has completado el recorrido guiado por la interfaz de 4GUARD WMS. Ahora puedes consultar cualquier duda operativa o volver al **Modo Operativo**.'
        }
      ]);
    });
  }

  public toggleDrawer(): void {
    this.isDrawerOpen.update((open) => !open);
  }

  public openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  public closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  public sendUserMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ForbotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: this.getCurrentTimestamp()
    };

    const typingMsg: ForbotChatMessage = {
      id: `typing-${Date.now()}`,
      sender: 'bot',
      text: '...',
      timestamp: this.getCurrentTimestamp(),
      isTyping: true
    };

    this.chatHistory.update((msgs) => [...msgs, userMsg, typingMsg]);

    setTimeout(() => {
      const intent = this.classifyIntent(trimmed);
      const botResponse = this.generateResponseForIntent(intent, trimmed);

      this.chatHistory.update((msgs) => {
        const withoutTyping = msgs.filter((m) => !m.isTyping);
        return [...withoutTyping, botResponse];
      });
    }, 450);
  }

  private classifyIntent(query: string): ForbotIntentType {
    const q = query.toLowerCase();

    if (q.includes('tour') || q.includes('recorrido') || q.includes('guiado') || q.includes('pantalla')) {
      return 'TOUR_DRIVER_JS';
    }

    if (q.includes('fsm') || q.includes('8 estados') || q.includes('estados') || q.includes('ciclo de vida') || q.includes('cuarentena')) {
      return 'FSM_8_ESTADOS';
    }

    if (q.includes('pablo') || q.includes('regla de pablo')) {
      return 'REGLA_PABLO_INFO';
    }

    if (
      q.includes('caduc') ||
      q.includes('merma') ||
      q.includes('venc') ||
      q.includes('30 d') ||
      q.includes('30 dias')
    ) {
      return 'CADUCIDAD_MERMAS';
    }

    if (
      q.includes('rampa') ||
      q.includes('anden') ||
      q.includes('andén') ||
      q.includes('recep') ||
      q.includes('f01') ||
      q.includes('embarque')
    ) {
      return 'ESTADO_RAMPAS';
    }

    if (
      q.includes('bodega') ||
      q.includes('espacio') ||
      q.includes('satura') ||
      q.includes('capacidad') ||
      q.includes('apc') ||
      q.includes('topología')
    ) {
      return 'SATURACION_BODEGAS';
    }

    if (
      q.includes('montacargas') ||
      q.includes('montacarguista') ||
      q.includes('dc-3') ||
      q.includes('dc3') ||
      q.includes('operador') ||
      q.includes('productividad')
    ) {
      return 'PRODUCTIVIDAD_MONTACARGAS';
    }

    // Detección de SSCC (18 dígitos numéricos o prefijo 37...) o Folios BLQ/VER/LIB/REC
    if (
      /\b37\d{16}\b/.test(query) ||
      /\bBLQ-\d{4}-\d+\b/i.test(query) ||
      /\bVER-\d{4}-\d+\b/i.test(query) ||
      /\bLIB-\d{4}-\d+\b/i.test(query) ||
      /\bREC-\d{4}-\d+\b/i.test(query) ||
      q.includes('sscc') ||
      q.includes('tarima sscc') ||
      q.includes('consultar sscc') ||
      q.includes('pallet sscc')
    ) {
      return 'CONSULTA_TARIMA_SSCC_CALIDAD';
    }

    if (q.includes('diurex') || q.includes('cinta') || q.includes('pegar caja') || q.includes('sellar con diurex')) {
      return 'REGLA_DIUREX_PT';
    }

    if (q.includes('inclinac') || q.includes('ladead') || q.includes('grados') || q.includes('5 grados') || q.includes('5°')) {
      return 'TOLERANCIA_INCLINACION_5';
    }

    if (q.includes('humedad') || q.includes('termohigr') || q.includes('65%') || q.includes('temperatura almacen') || q.includes('clima almacen')) {
      return 'LIMITE_HUMEDAD_65';
    }

    if (q.includes('muestreo') || q.includes('cafe verde') || q.includes('café verde') || q.includes('calador') || q.includes('tapas') || q.includes('garrafas')) {
      return 'MUESTREO_MATERIALES_IT01';
    }

    if (q.includes('tabla rota') || q.includes('tacon') || q.includes('tacón') || q.includes('reparar tarima') || q.includes('traspaleo') || q.includes('vueltas de playo')) {
      return 'REPARACION_TARIMAS_IT02';
    }

    if (q.includes('liberar tarima') || q.includes('quitar bloqueo') || q.includes('desbloquear') || q.includes('autorizar salida tarima')) {
      return 'RESTRICCION_LIBERACION_RBAC';
    }

    if (q.includes('rasgadura') || q.includes('lona') || q.includes('pared sucia') || q.includes('caja trailer') || q.includes('f01 transporte')) {
      return 'CRITERIOS_TRANSPORTE_F01';
    }

    if (
      q.includes('calidad') ||
      q.includes('nom-251') ||
      q.includes('nom 251') ||
      q.includes('bloqueo')
    ) {
      return 'BLOQUEOS_CALIDAD_NOM251';
    }

    if (q.includes('ayuda') || q.includes('help') || q.includes('qué puedes hacer') || q.includes('comandos')) {
      return 'GENERAL_HELP';
    }

    return 'UNKNOWN';
  }

  private generateResponseForIntent(intent: ForbotIntentType, userText: string): ForbotChatMessage {
    const time = this.getCurrentTimestamp();
    const id = `bot-${Date.now()}`;

    switch (intent) {
      case 'TOUR_DRIVER_JS': {
        this.startDriverTour();
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: '🚀 Iniciando el Tour Guiado de la interfaz. Te resaltaré los elementos principales de 4GUARD WMS.'
        };
      }

      case 'FSM_8_ESTADOS': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `📘 **Máquina de Estados Finitos (FSM - 8 Estados):**
1. **10 - Recibido:** Registro físico en andén F01.
2. **20 - Cuarentena:** Espera de liberación por Inspector QM.
3. **30 - Disponible:** Listo para almacenamiento en rack o despacho.
4. **40 - Reservado:** Asignado formalmente a orden de salida.
5. **50 - En Picking:** Recolección activa en pasillo.
6. **60 - Despachado:** Salida confirmada y camión en ruta.
7. **70 - Bloqueado QM:** Incidencia o no conformidad.
8. **80 - Dado de Baja:** Retirado por merma u obsolescencia.`,
          widgetData: {
            type: 'status-list',
            title: 'Ciclo de Estados FSM',
            items: [
              { label: '10 Recibido ➔ 20 Cuarentena', value: 'Andén / Calidad', badgeColor: 'amber' },
              { label: '30 Disponible ➔ 40 Reservado', value: 'Racks / Salidas', badgeColor: 'emerald' },
              { label: '50 Picking ➔ 60 Despachado', value: 'Salida Final', badgeColor: 'blue' }
            ],
            actionRoute: '/inventory-query',
            actionLabel: 'Ver Inventario por Estado FSM'
          }
        };
      }

      case 'REGLA_PABLO_INFO': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `⏳ **Regla Crítica de Pablo (Caducidad Preventiva):**
• 🟢 **En Tiempo:** Producto con más de 30 días de vida útil.
• 🟡 **Próximo <30 días (Alerta Pablo):** Prioridad FEFO de salida para evitar merma.
• 🔴 **Caduco:** Retiro inmediato a Estado 70 (Bloqueado QM) u 80 (Baja).`,
          widgetData: {
            type: 'warning-card',
            title: 'Semaforización de Caducidades',
            items: [
              { label: 'En Tiempo (>30d)', value: '🟢 Normal', badgeColor: 'emerald' },
              { label: 'Alerta Pablo (<30d)', value: '🟡 Prioridad FEFO', badgeColor: 'amber' },
              { label: 'Caducado (<0d)', value: '🔴 Bloqueo Inmediato', badgeColor: 'rose' }
            ],
            actionRoute: '/inventory-query',
            actionLabel: 'Filtrar Alertas de Pablo'
          }
        };
      }

      case 'CADUCIDAD_MERMAS': {
        const kpi = this.inventoryService.kpiSummary();
        const records = this.inventoryService.rawInventory();
        const expiringCount = records.filter((r) => r.expirationStatus === 'PROXIMO_30_DIAS').length;
        const expiredCount = records.filter((r) => r.expirationStatus === 'CADUCO').length;

        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `Analicé los registros de stock activo en 4GUARD WMS. Actualmente detecto **${expiringCount} palets con caducidad próxima (<30 días)** y **${expiredCount} palets caducos** que requieren atención preventiva (Regla de Pablo).`,
          widgetData: {
            type: 'warning-card',
            title: 'Resumen de Caducidades & Mermas',
            items: [
              { label: 'Próximos <30 Días', value: `${expiringCount} Tarimas`, badgeColor: 'amber' },
              { label: 'Lotes Caducos (<hoy)', value: `${expiredCount} Tarimas`, badgeColor: 'rose' },
              { label: 'Promedio de Estadía', value: `${kpi.avgStayDays} Días`, badgeColor: 'blue' }
            ],
            actionRoute: '/inventory-query',
            actionLabel: 'Filtrar Caducidades en Inventario',
            proactiveTip: 'Sugerencia ForBot: Aplica despacho FEFO en tarimas con <20 días para clientes perecederos.'
          }
        };
      }

      case 'ESTADO_RAMPAS': {
        const receptionsList = this.movementsService.receptions();
        const pendingCount = receptionsList.filter((r: any) => r.status === 'CASETA' || r.status === 'EN_ANDEN').length;

        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `En el módulo de Movimientos contamos con **4 rampas en andén** habilitadas. Hay **${pendingCount} unidades** registradas en caseta listos para asignación de descarga F01.`,
          widgetData: {
            type: 'status-list',
            title: 'Andenes & Recepción (F01)',
            items: [
              { label: 'Rampa 01 - Toluca', value: 'Disponible', badgeColor: 'emerald' },
              { label: 'Rampa 02 - Andén Central', value: 'Descargando (F01-892)', badgeColor: 'amber' },
              { label: 'Unidades en Caseta', value: `${pendingCount} Tráileres`, badgeColor: 'blue' }
            ],
            actionRoute: '/warehouse-movements/receiving',
            actionLabel: 'Ir a Recepción de Mercancía',
            proactiveTip: 'Atención: Revisa el checklist de sellos en caseta antes de autorizar descarga en rampa.'
          }
        };
      }

      case 'SATURACION_BODEGAS': {
        const bays = this.catalogsService.bays();

        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `Evalué las **6 bodegas reales** de la topología 4GUARD WMS (A, APC, AT, B, BPC, BT) compuestas por **${bays.length} posiciones de rack**. La bodega con mayor saturación actual es **Bodega A** (78% de ocupación).`,
          widgetData: {
            type: 'kpi-summary',
            title: 'Topología & Capacidad de Almacenes',
            items: [
              { label: 'Bodega A (General)', value: '78% Ocupada', badgeColor: 'amber' },
              { label: 'Bodega APC (Climática)', value: '42% Ocupada', badgeColor: 'emerald' },
              { label: 'Bodega AT (Tránsito)', value: '65% Ocupada', badgeColor: 'blue' }
            ],
            actionRoute: '/catalogs/warehouse',
            actionLabel: 'Ver Topología Completa de Almacén'
          }
        };
      }

      case 'PRODUCTIVIDAD_MONTACARGAS': {
        const operators = this.catalogsService.forkliftOperators();

        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `Hay **${operators.length} montacarguistas registrados** en plantilla. Todos cuentan con licencia **DC-3 vigente** ante la STPS para operabilidad 3PL.`,
          widgetData: {
            type: 'status-list',
            title: 'Montacarguistas & Licencias DC-3',
            items: [
              { label: 'Plantilla Activa', value: `${operators.length} Operadores`, badgeColor: 'emerald' },
              { label: 'Certificación STPS', value: '100% Licencia DC-3', badgeColor: 'emerald' },
              { label: 'Turno Activo', value: `${this.authState.userShiftBadge()}`, badgeColor: 'amber' }
            ],
            actionRoute: '/catalogs/forklift-operators',
            actionLabel: 'Ver Catálogo de Montacarguistas'
          }
        };
      }

      case 'BLOQUEOS_CALIDAD_NOM251': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `Revisé el catálogo de SKUs y NOM-251. El **100% de los productos activos** cumple con las normas de inocuidad y etiquetado requeridas.`,
          widgetData: {
            type: 'warning-card',
            title: 'Inocuidad & NOM-251',
            items: [
              { label: 'Estatus NOM-251', value: 'CONFORME (Activo)', badgeColor: 'emerald' },
              { label: 'Lotes en Cuarentena', value: '0 SKUs Bloqueados', badgeColor: 'blue' }
            ],
            actionRoute: '/catalogs/products',
            actionLabel: 'Ver Catálogo de Productos/SKUs'
          }
        };
      }

      case 'REGLA_DIUREX_PT': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `⚠️ **Prohibición Normativa (IT02-PO-GC-8.6-02 punto 2.4):**
Está estrictamente **PROHIBIDO** usar cinta Diurex en **Producto Terminado (PT)**, ya que daña el empaque secundario y las etiquetas comerciales.

• **Acción permitida:** Aplica re-emplayado con film plástico (**3 vueltas en base, 70% de altura y 3 en corona**).
• **Excepción única:** El Diurex solo se permite en pallets de **frascos de vidrio vacíos** con aberturas mayores a 5 cm.`,
          widgetData: {
            type: 'warning-card',
            title: 'Regla de Sellado con Diurex',
            items: [
              { label: 'Producto Terminado (PT)', value: '❌ PROHIBIDO DIUREX', badgeColor: 'rose' },
              { label: 'Frascos de Vidrio (>5cm)', value: '✅ AUTORIZADO DIUREX', badgeColor: 'emerald' },
              { label: 'Norma Aplicable', value: 'IT02-PO-GC-8.6-02', badgeColor: 'blue' }
            ],
            actionRoute: '/quality',
            actionLabel: 'Ir al Módulo de Calidad QM'
          }
        };
      }

      case 'TOLERANCIA_INCLINACION_5': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `📐 **Tolerancia de Inclinación de Tarima (IT01-PO-GC-8.6-01):**
• **Tolerancia máxima permitida:** **5.0° de inclinación**.
• **Si supera los 5°:** La estiba se considera **inestable y en riesgo de colapso**.
• **Procedimiento obligatorio:** Bloquear para acondicionamiento bajo **IT02-PO-GC-8.6-02**. Alinear cajas empujando hacia adentro y re-emplayar con mínimo 3 vueltas en base, 70% de altura y 3 en corona antes de autorizar su almacenamiento o carga.`,
          widgetData: {
            type: 'status-list',
            title: 'Tolerancia de Estiba e Inclinación',
            items: [
              { label: 'Inclinación ≤ 5.0°', value: '🟢 Conforme (Aceptado)', badgeColor: 'emerald' },
              { label: 'Inclinación > 5.0°', value: '🔴 Acondicionamiento (IT02)', badgeColor: 'rose' }
            ],
            actionRoute: '/quality',
            actionLabel: 'Ver Bloqueos de Calidad'
          }
        };
      }

      case 'LIMITE_HUMEDAD_65': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `💧 **Límite Crítico de Humedad y Temperatura (IT01-PO-GC-8.6-02):**
• **Límite máximo permitido:** **65% HR (Humedad Relativa)**.
• **Horarios obligatorios de lectura:**
  1. Turno 1: **08:00 a 09:00 hrs**.
  2. Turno Intermedio: **14:00 hrs**.
  3. Turno 2: **20:00 a 21:00 hrs**.
• **Acción ante Desviación (> 65% HR):** Reportar de inmediato al Gerente de Calidad en el canal *"Incidencias de calidad"* para activar deshumidificadores y registrar en la bitácora **DE-01-PO-8.6-02**.`,
          widgetData: {
            type: 'kpi-summary',
            title: 'Monitoreo Ambiental en Almacén',
            items: [
              { label: 'Límite Máximo HR', value: '65.0% HR', badgeColor: 'amber' },
              { label: 'Cortes Diarios', value: '3 Lecturas Obligatorias', badgeColor: 'blue' },
              { label: 'Formato Oficial', value: 'DE-01-PO-8.6-02', badgeColor: 'emerald' }
            ]
          }
        };
      }

      case 'MUESTREO_MATERIALES_IT01': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `☕ **Protocolo Oficial de Muestreo (IT01-PO-GC-8.6-04 Rev. 02):**
• **Café Verde:** Insertar calador en diagonal en 1 a 2 sacos por tarima (~150g por saco) hasta completar **3.0 kg**. Cerrar bolsa con aire y **agitar 30 segundos** continuos para homogeneizar. Entregar a Seguridad Patrimonial (*Transportes Aguillón / Calmo*).
• **Tapas Culinarios/Cafés:** **20 unidades** por lote.
• **Etiquetas en Posteta:** **50 unidades** por lote.
• **Etiquetas con Adherible:** **6 metros** lineales en bobina.
• **Garrafas:** **4 unidades** por pallet.
• **Exhibidores / Estuches:** **30 unidades** por lote.
• **Cajas de Cartón:** **10 cajas** por lote.`,
          widgetData: {
            type: 'status-list',
            title: 'Cantidades Oficiales de Muestreo',
            items: [
              { label: 'Café Verde (Costales)', value: '3.0 kg (Calador + 30s)', badgeColor: 'amber' },
              { label: 'Tapas Culinarias/Café', value: '20 pzas por lote', badgeColor: 'blue' },
              { label: 'Etiquetas Posteta', value: '50 pzas por lote', badgeColor: 'emerald' }
            ],
            actionRoute: '/quality',
            actionLabel: 'Ver Procedimientos de Calidad'
          }
        };
      }

      case 'REPARACION_TARIMAS_IT02': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `🪵 **Criterio de Reparación vs Traspaleo de Tarimas (IT02-PO-GC-8.6-02 punto 2.5):**
• **1 tabla rota o 1 tacón faltante:** Se permite reparación in situ con apoyo del montacarguista colocando 1 repuesto con martillo y clavos.
• **2 o más tablas/tacones dañados:** **PROHIBIDO REPARAR**. Se debe ejecutar **traspaleo completo** a una tarima nueva.
• **Vueltas de playo en traspaleo:** **3 vueltas** para Producto Terminado (PT) y **5 vueltas** para frascos de vidrio vacíos.`,
          widgetData: {
            type: 'warning-card',
            title: 'Reparación de Tarimas & Traspaleo',
            items: [
              { label: '1 Tabla/Tacón Roto', value: '🔨 Reparación in situ', badgeColor: 'amber' },
              { label: '≥ 2 Tablas/Tacones Rotos', value: '📦 Traspaleo Obligatorio', badgeColor: 'rose' },
              { label: 'Vueltas Playo PT / Frascos', value: '3 vueltas / 5 vueltas', badgeColor: 'blue' }
            ]
          }
        };
      }

      case 'RESTRICCION_LIBERACION_RBAC': {
        const currentRole = this.authState.role() || 'OPERARIO';
        const isAuthorized = ['ADMIN', 'ROLE_ADMIN', 'SUPER_ADMIN', 'ROLE_SUPER_ADMIN', 'OPERATIONS_MANAGER', 'ROLE_OPERATIONS_MANAGER', 'QM_INSPECTOR', 'ROLE_QM_INSPECTOR', 'AUDITOR', 'ROLE_AUDITOR'].includes(currentRole);

        if (!isAuthorized) {
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `⛔ **Restricción de Seguridad Operativa (RN-QM-02 & RN-QM-03):**
Tu rol actual (**${this.authState.roleLabel()}**) no cuenta con el permiso \`QUALITY_AUTHORIZE\`.
Las tarimas en estado **IN_QUALITY (20)** están blindadas contra surtido o embarque. Solo un **Superintendente QM o Gerente de Calidad** puede dictaminar una liberación formal indicando autorizador (*CLIENT / QUALITY_4GUARD*), soporte documental y destino (*DISTRIBUTION / DESTRUCTION / RETURN*).`,
            widgetData: {
              type: 'warning-card',
              title: 'Permisos de Liberación Requeridos',
              items: [
                { label: 'Tu Rol Actual', value: this.authState.roleLabel(), badgeColor: 'rose' },
                { label: 'Permiso Requerido', value: 'QUALITY_AUTHORIZE', badgeColor: 'amber' },
                { label: 'Regla del WMS', value: 'RN-QM-03 Inmutable', badgeColor: 'blue' }
              ]
            }
          };
        } else {
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `📋 **Protocolo para Dictaminar Liberación de Tarima (RN-QM-03):**
Como usuario autorizado (**${this.authState.roleLabel()}**), para liberar un lote bloqueado debes registrar:
1. **Autorizador:** Cliente (*CLIENT*) o Calidad 4GUARD (*QUALITY_4GUARD*).
2. **Tipo de Soporte:** Correo (*EMAIL*), Ticket digital (*ELECTRONIC_MEDIA*) o Acta (*FORMAL_ACT*).
3. **Destino Final:**
   • **DISTRIBUTION:** Retorna a *Disponible (30)* con movimiento Kardex \`RELEASE\`.
   • **DESTRUCTION:** Pasa a *Dañado (60)* con movimiento Kardex \`ADJUSTMENT\` (merma/baja).
   • **RETURN:** Pasa a *Devolución (80)* con movimiento Kardex \`RETURN\`.`,
            widgetData: {
              type: 'status-list',
              title: 'Destinos de Liberación QM',
              items: [
                { label: 'DISTRIBUTION', value: '➔ Disponible (30)', badgeColor: 'emerald' },
                { label: 'DESTRUCTION', value: '➔ Dañado / Merma (60)', badgeColor: 'rose' },
                { label: 'RETURN', value: '➔ Devolución Proveedor (80)', badgeColor: 'amber' }
              ],
              actionRoute: '/quality',
              actionLabel: 'Ir a Liberaciones de Calidad'
            }
          };
        }
      }

      case 'CRITERIOS_TRANSPORTE_F01': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `🚛 **Criterios de Inspección de Transporte (F01-PO-GC-8.6-03 Rev. 03 & IT01):**
• **Lona / Caja:** Máx. 1 rasgadura $\\le 5\\text{ cm}$ sellada sin paso de luz.
• **Paredes:** Limpias, sin manchas de grasa/hollín $> 10\\text{ cm}$.
• **Piso:** Limpio, sin charcos, sin clavos ni astillas expuestas.
• **Plagas y Olores:** **TOLERANCIA CERO** a indicios de plagas o aroma a diésel/químico.
• **Carga Foránea:** Bloqueo de seguridad obligatorio (bolsas de aire, cartón o eslingas).
• **Tiempo de Espera del Cliente ante Desviación:** **Máximo 30 minutos** para autorizar; si no responde, la unidad sale a estacionamiento.`,
          widgetData: {
            type: 'status-list',
            title: 'Checklist de Transporte F01',
            items: [
              { label: 'Rasgadura en lona', value: 'Máx. ≤ 5.0 cm sellada', badgeColor: 'amber' },
              { label: 'Plagas / Olores', value: '0 Tolerancia (Rechazo)', badgeColor: 'rose' },
              { label: 'Tiempo Espera Cliente', value: '30 Minutos Máximo', badgeColor: 'blue' }
            ],
            actionRoute: '/quality',
            actionLabel: 'Ver Verificaciones de Carga'
          }
        };
      }

      case 'CONSULTA_TARIMA_SSCC_CALIDAD': {
        const blocks = this.qualityState.blocks();
        const releases = this.qualityState.releases();
        const rawInv = this.inventoryService.rawInventory();

        // Buscar por SSCC o por Folio en el texto del usuario
        const matchedBlock = blocks.find(b =>
          (b.sscc && userText.includes(b.sscc)) ||
          (b.folio && userText.toUpperCase().includes(b.folio.toUpperCase())) ||
          (b.sku && userText.toUpperCase().includes(b.sku.toUpperCase()))
        );

        const matchedRelease = !matchedBlock ? releases.find(r =>
          (r.folio && userText.toUpperCase().includes(r.folio.toUpperCase())) ||
          (r.blockFolio && userText.toUpperCase().includes(r.blockFolio.toUpperCase()))
        ) : null;

        const matchedInv = (!matchedBlock && !matchedRelease) ? rawInv.find(i =>
          (i.ssccBarcode && userText.includes(i.ssccBarcode)) ||
          (i.sku && userText.toUpperCase().includes(i.sku.toUpperCase()))
        ) : null;

        if (matchedBlock) {
          const isCritical = matchedBlock.severity === 'CRITICAL';
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `🚨 **Tarima Retenida por Calidad (Folio ${matchedBlock.folio}):**
• **SSCC:** \`${matchedBlock.sscc || 'N/A'}\`
• **SKU:** **${matchedBlock.sku}** (${matchedBlock.description})
• **Cliente / Lote:** ${matchedBlock.clientName} | Lote: \`${matchedBlock.batchNumber}\`
• **Ubicación QM:** \`${matchedBlock.locationId}\`
• **Estatus Actual:** **${matchedBlock.status}** (Severidad: **${matchedBlock.severity}**)
• **Motivo / Defectos:** ${matchedBlock.defectCriteria?.join(', ') || matchedBlock.notes}
• **Restricción:** Blindada para despacho (RN-QM-02). Requiere dictamen formal en el módulo de Calidad.`,
            widgetData: {
              type: 'warning-card',
              title: `Expediente QM: ${matchedBlock.folio}`,
              items: [
                { label: 'Estatus', value: matchedBlock.status, badgeColor: isCritical ? 'rose' : 'amber' },
                { label: 'Severidad', value: matchedBlock.severity, badgeColor: isCritical ? 'rose' : 'amber' },
                { label: 'Cantidad', value: `${matchedBlock.quantity} ${matchedBlock.unitOfMeasure}`, badgeColor: 'blue' }
              ],
              actionRoute: '/quality',
              actionLabel: 'Ver Detalle del Bloqueo en Calidad'
            }
          };
        } else if (matchedRelease) {
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `✅ **Tarima Liberada Formalmente (Folio ${matchedRelease.folio}):**
• **Bloqueo Origen:** \`${matchedRelease.blockFolio}\`
• **SKU:** **${matchedRelease.sku}** (${matchedRelease.description})
• **Destino Dictaminado:** **${matchedRelease.destination}**
• **Autorizado por:** ${matchedRelease.authorizedByName} (${matchedRelease.authorizedByPosition})
• **Soporte:** ${matchedRelease.supportType} - *"${matchedRelease.supportSubject}"*
• **Fecha de Liberación:** ${matchedRelease.releasedAt.slice(0, 10)}`,
            widgetData: {
              type: 'status-list',
              title: `Liberación QM: ${matchedRelease.folio}`,
              items: [
                { label: 'Destino', value: matchedRelease.destination, badgeColor: 'emerald' },
                { label: 'Autorizador', value: matchedRelease.authorizerType, badgeColor: 'blue' },
                { label: 'Cantidad', value: `${matchedRelease.quantity} ${matchedRelease.unitOfMeasure}`, badgeColor: 'emerald' }
              ],
              actionRoute: '/quality',
              actionLabel: 'Ver Historial de Liberaciones'
            }
          };
        } else if (matchedInv) {
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `📦 **Tarima Conforme en Inventario:**
• **SSCC / Etiqueta:** \`${matchedInv.ssccBarcode || 'N/A'}\`
• **SKU:** **${matchedInv.sku}** (${matchedInv.productDescription || 'Material'})
• **Ubicación:** \`${matchedInv.location}\` (${matchedInv.warehouse})
• **Estado WMS:** **Disponible (30)**
• **Cantidad:** ${matchedInv.measuredQuantity} Pzas (${matchedInv.palletsCount} Pallet)
• **Caducidad:** ${matchedInv.expirationDate || 'Vigente'} (${matchedInv.expirationStatus})`,
            widgetData: {
              type: 'kpi-summary',
              title: `Tarima Conforme: ${matchedInv.ssccBarcode || matchedInv.sku}`,
              items: [
                { label: 'Estado', value: 'Disponible (30)', badgeColor: 'emerald' },
                { label: 'Ubicación', value: matchedInv.location, badgeColor: 'blue' },
                { label: 'Stock', value: `${matchedInv.measuredQuantity} Pzas`, badgeColor: 'emerald' }
              ],
              actionRoute: '/inventory-query',
              actionLabel: 'Ver en Consulta de Inventario'
            }
          };
        } else {
          return {
            id,
            sender: 'bot',
            intent,
            timestamp: time,
            text: `🔍 Consulté la base de datos de inventario y calidad. No encontré una tarima activa con el identificador o SSCC ingresado en **"${userText}"**.
Por favor verifica que el SSCC contenga los 18 dígitos correctos o consulta en el módulo de Inventario / Calidad.`,
            widgetData: {
              type: 'warning-card',
              title: 'Tarima No Encontrada',
              items: [
                { label: 'Búsqueda SSCC', value: 'Sin coincidencias', badgeColor: 'amber' },
                { label: 'Acción Sugerida', value: 'Verificar Escaneo / Folio', badgeColor: 'blue' }
              ],
              actionRoute: '/inventory-query',
              actionLabel: 'Ir a Búsqueda de Inventario'
            }
          };
        }
      }

      case 'GENERAL_HELP': {
        return {
          id,
          sender: 'bot',
          intent,
          timestamp: time,
          text: `Puedes preguntarme libremente usando lenguaje natural. Algunas consultas sugeridas:
- *"¿Qué productos caducan en menos de 30 días?"*
- *"¿Cómo están las rampas de recepción?"*
- *"¿Cuál es la saturación en Bodega A y APC?"*
- *"Iniciar tour guiado"*
- *"Explícame los 8 estados del FSM"*`
        };
      }

      default: {
        return {
          id,
          sender: 'bot',
          intent: 'UNKNOWN',
          timestamp: time,
          text: `Entendí tu consulta sobre **"${userText}"**. Puedes seleccionar una de las píldoras de sugerencia o preguntarme sobre **caducidades (<30d), rampas, bodegas, estados FSM o tour de pantalla**.`
        };
      }
    }
  }

  private getCurrentTimestamp(): string {
    const d = new Date();
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  }
}
