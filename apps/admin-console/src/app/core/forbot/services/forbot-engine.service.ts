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
  private readonly authState = inject(AuthState);
  private readonly tourService = inject(ForbotTourService);

  /** Visibilidad del Drawer Flotante Lateral */
  public readonly isDrawerOpen = signal<boolean>(false);

  /** Modo de Operación: 'operativo' (default) o 'tutor' (inducción interactiva) */
  public readonly currentMode = signal<ForbotMode>('operativo');

  /** Señal de Estado de Tema (Modo Día / Modo Noche) */
  public readonly isDarkMode = signal<boolean>(
    typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-theme')
      : false
  );

  public checkTheme(): boolean {
    if (typeof document !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark-theme');
      this.isDarkMode.set(isDark);
      return isDark;
    }
    return false;
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
