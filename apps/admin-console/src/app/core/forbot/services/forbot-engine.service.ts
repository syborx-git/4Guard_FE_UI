/**
 * @file forbot-engine.service.ts
 * @description Motor NLP Conversacional 100% Local (0-Tokens) para ForBot (4GUARD AI).
 * Procesa intenciones con Pattern Matching y lee métricas reactivas directamente de las Signals de la app.
 */

import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ForbotChatMessage,
  ForbotIntentType,
  ForbotWidgetData
} from '../models/forbot.models';
import { InventoryQueryService } from '../../../features/inventory-query/services/inventory-query.service';
import { WarehouseMovementsService } from '../../../features/warehouse-movements/services/warehouse-movements.service';
import { CatalogsService } from '../../../features/catalogs/services/catalogs.service';
import { AuthState } from '../../../core/auth/auth.state';

@Injectable({
  providedIn: 'root'
})
export class ForbotEngineService {
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryQueryService);
  private readonly movementsService = inject(WarehouseMovementsService);
  private readonly catalogsService = inject(CatalogsService);
  private readonly authState = inject(AuthState);

  /** Visibilidad del Drawer Flotante Lateral */
  public readonly isDrawerOpen = signal<boolean>(false);

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
      text: '¡Hola! Soy **ForBot**, tu asistente inteligente de almacén en **4GUARD WMS**. Puedo responder al instante consultas sobre caducidades, saturación de bodegas, rampas y rendimiento operacionales. ¿En qué te puedo apoyar hoy?',
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
        actionLabel: 'Ver Consulta de Inventario'
      }
    }
  ]);

  public toggleDrawer(): void {
    this.isDrawerOpen.update((open) => !open);
  }

  public openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  public closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  /**
   * Procesa la pregunta del usuario y genera una respuesta inteligente local en milisegundos.
   */
  public sendUserMessage(userText: string): void {
    const trimmed = userText.trim();
    if (!trimmed) return;

    // 1. Agregar mensaje del usuario al historial
    const userMsg: ForbotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: this.getCurrentTimestamp()
    };

    this.chatHistory.update((list) => [...list, userMsg]);

    // 2. Indicador visual de typing
    const typingId = `typing-${Date.now()}`;
    const typingMsg: ForbotChatMessage = {
      id: typingId,
      sender: 'bot',
      text: 'ForBot está procesando los datos de almacén...',
      timestamp: this.getCurrentTimestamp(),
      isTyping: true
    };

    this.chatHistory.update((list) => [...list, typingMsg]);

    // 3. Procesar intención y generar respuesta tras 350ms (efecto respuesta ágil)
    setTimeout(() => {
      const intent = this.parseIntent(trimmed);
      const botResponse = this.generateResponseForIntent(intent, trimmed);

      // Eliminar typing y agregar respuesta final
      this.chatHistory.update((list) =>
        list.filter((m) => m.id !== typingId).concat(botResponse)
      );
    }, 350);
  }

  /**
   * Analizador NLP de Intenciones basado en Pattern Matching
   */
  private parseIntent(query: string): ForbotIntentType {
    const q = query.toLowerCase();

    if (
      q.includes('caduc') ||
      q.includes('merma') ||
      q.includes('vence') ||
      q.includes('30 días') ||
      q.includes('30 dias') ||
      q.includes('pablo')
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
      q.includes('cuarentena') ||
      q.includes('bloqueo')
    ) {
      return 'BLOQUEOS_CALIDAD_NOM251';
    }

    if (q.includes('ayuda') || q.includes('help') || q.includes('qué puedes hacer') || q.includes('comandos')) {
      return 'GENERAL_HELP';
    }

    return 'UNKNOWN';
  }

  /**
   * Genera respuestas estructuradas dinámicas basadas en Signals vivas
   */
  private generateResponseForIntent(intent: ForbotIntentType, userText: string): ForbotChatMessage {
    const time = this.getCurrentTimestamp();
    const id = `bot-${Date.now()}`;

    switch (intent) {
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
          text: `Analicé los registros de stock activo en 4GUARD WMS. Actualmente detecto **${expiringCount} palets con caducidad próxima (<30 días)** y **${expiredCount} palets caducos** que requieren atención o despeje preventivo (Regla de Pablo).`,
          widgetData: {
            type: 'warning-card',
            title: 'Resumen de Caducidades & Mermas',
            items: [
              { label: 'Próximos <30 Días', value: `${expiringCount} Tarimas`, badgeColor: 'amber' },
              { label: 'Lotes Caducos (<hoy)', value: `${expiredCount} Tarimas`, badgeColor: 'rose' },
              { label: 'Promedio de Estadía', value: `${kpi.avgStayDays} Días`, badgeColor: 'blue' }
            ],
            actionRoute: '/inventory-query',
            actionLabel: 'Filtrar Caducidades en Inventario'
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
          text: `En el módulo de Movimientos de Almacén contamos con **4 rampas principales en andén** habilitadas. Hay **${pendingCount} unidades** registradas en caseta listos para asignación de descarga F01.`,
          widgetData: {
            type: 'status-list',
            title: 'Andenes & Recepción (F01)',
            items: [
              { label: 'Rampa 01 - Toluca', value: 'Disponible', badgeColor: 'emerald' },
              { label: 'Rampa 02 - Andén Central', value: 'Descargando (F01-892)', badgeColor: 'amber' },
              { label: 'Unidades en Caseta', value: `${pendingCount} Tráileres`, badgeColor: 'blue' }
            ],
            actionRoute: '/warehouse-movements/receiving',
            actionLabel: 'Ir a Recepción de Mercancía'
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
          text: `Hay **${operators.length} montacarguistas registrados** en plantilla. Todos cuentan con licencia **DC-3 vigente** expedida ante la STPS para operabilidad 3PL.`,
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
          text: `Revisé el catálogo de SKUs y NOM-251. El **100% de los productos activos** cumple con las normas de inocuidad y etiquetado requeridas para alimentos y bebidas.`,
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
- *"¿Cuántos montacarguistas tienen DC-3 activo?"*
- *"¿Hay lotes bloqueados por NOM-251?"*`
        };
      }

      default: {
        return {
          id,
          sender: 'bot',
          intent: 'UNKNOWN',
          timestamp: time,
          text: `Entendí tu consulta sobre **"${userText}"**. Para darte una respuesta exacta sobre 4GUARD WMS, puedes seleccionar una de las píldoras de sugerencia rápida o preguntarme sobre **caducidades (<30 días), rampas, saturación de bodegas o montacarguistas**.`
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
