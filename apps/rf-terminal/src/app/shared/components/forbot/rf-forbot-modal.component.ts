/**
 * @file rf-forbot-modal.component.ts
 * @description Modal Táctil de Asistencia Operativa ForBot AI para Tablets Industriales (RF Terminal).
 * Optimizado para landscape, botones de mínimo 48px, entrada de voz por micrófono (Web Speech API)
 * y consultas de campo (NOM-251, rampas, ubicaciones, sync offline y anomalías).
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AuthState,
  SyncState,
  ZoneLeaseService,
  ForbotVoiceService,
  ForbotChatMessage,
  ForbotWidgetItem
} from '@4guard/shared-core';

@Component({
  selector: 'fg-rf-forbot-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rf-forbot-modal.component.html',
  styleUrl: './rf-forbot-modal.component.css'
})
export class RfForbotModalComponent {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef;

  protected readonly authState = inject(AuthState);
  protected readonly syncState = inject(SyncState);
  protected readonly zoneLease = inject(ZoneLeaseService);
  protected readonly voiceService = inject(ForbotVoiceService);
  private readonly router = inject(Router);

  protected userQueryText = signal<string>('');

  /** Píldoras de consulta rápida para operarios de almacén */
  protected readonly warehousePills = [
    { label: '🚛 Rampa Asignada', query: '¿Qué rampa tengo asignada para descarga?' },
    { label: '📍 Ubicación Rack', query: '¿Cuál es la regla de ubicación en rack para este producto?' },
    { label: '🪵 Tarimas & Daños', query: '¿Cuándo se debe rechazar una tarima por daño o inclinación?' },
    { label: '📦 Sincronización', query: '¿Cómo está mi cola de transacciones offline?' },
    { label: '🔬 Norma NOM-251', query: '¿Cuáles son los puntos críticos NOM-251 en recepción?' }
  ];

  /** Historial de conversación local de la terminal */
  public readonly chatMessages = signal<ForbotChatMessage[]>([
    {
      id: 'rf-welcome',
      sender: 'bot',
      text: '👷 **¡Hola, Operador!** Soy **ForBot**, tu copiloto en piso de almacén. Puedes escribir tu duda o presionar el botón de **micrófono** 🎙️ para dictar mientras operas.',
      timestamp: this.getCurrentTime(),
      widgetData: {
        type: 'status-list',
        title: 'Estado Operativo Actual de la Terminal',
        items: [
          { label: 'Modo de Red', value: 'En Línea', badgeColor: 'emerald' },
          { label: 'Cola Offline', value: '0 pendientes', badgeColor: 'blue' },
          { label: 'Arrendamiento', value: 'Zona Andenes', badgeColor: 'purple' }
        ]
      }
    }
  ]);

  constructor() {
    // Scroll automático al agregar mensajes o abrir el modal
    effect(() => {
      const msgs = this.chatMessages();
      if (this.isOpen && msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 60);
      }
    });

    // Sincronizar actualización reactiva del estado de red
    effect(() => {
      const isOff = this.syncState.isOffline();
      const pending = this.syncState.pendingCount();
      this.chatMessages.update(msgs => {
        const first = msgs[0];
        if (first && first.widgetData) {
          first.widgetData.items = [
            { label: 'Modo de Red', value: isOff ? 'Sin Conexión (Offline)' : 'En Línea', badgeColor: isOff ? 'rose' : 'emerald' },
            { label: 'Cola Offline', value: `${pending}/500 ops`, badgeColor: pending > 10 ? 'amber' : 'blue' },
            { label: 'Zona', value: this.zoneLease.activeLease()?.zoneName || 'Almacén General', badgeColor: 'purple' }
          ];
        }
        return [...msgs];
      });
    });

  }

  private getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().substring(0, 8);
  }

  private scrollToBottom(): void {
    if (this.chatScrollContainer?.nativeElement) {
      this.chatScrollContainer.nativeElement.scrollTop =
        this.chatScrollContainer.nativeElement.scrollHeight;
    }
  }

  public onClose(): void {
    this.voiceService.stopListening();
    this.closeModal.emit();
  }

  public sendPillQuery(query: string): void {
    this.userQueryText.set(query);
    this.onSendMessage();
  }

  public toggleVoice(): void {
    this.voiceService.toggleListening((finalText: string) => {
      this.userQueryText.set(finalText);
      this.onSendMessage();
    });
  }

  public onSendMessage(): void {
    const query = this.userQueryText().trim();
    if (!query) return;

    const userMsg: ForbotChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: this.getCurrentTime()
    };

    const typingMsg: ForbotChatMessage = {
      id: `typing-${Date.now()}`,
      sender: 'bot',
      text: '...',
      timestamp: this.getCurrentTime(),
      isTyping: true
    };

    this.chatMessages.update(msgs => [...msgs, userMsg, typingMsg]);
    this.userQueryText.set('');

    setTimeout(() => {
      const botResponse = this.processOperationalQuery(query);
      this.chatMessages.update(msgs => {
        const filtered = msgs.filter(m => !m.isTyping);
        return [...filtered, botResponse];
      });
    }, 400);
  }

  /** Procesa consultas operativas de campo en la terminal RF */
  private processOperationalQuery(query: string): ForbotChatMessage {
    const q = query.toLowerCase();

    // 1. Rampas y Andenes
    if (q.includes('rampa') || q.includes('anden') || q.includes('andén') || q.includes('descarga')) {
      return {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: '🚛 **Rampas de Recepción en Andén**\nLas rampas 01 a 06 están habilitadas para descarga seca. La Rampa 11 está reservada para unidades refrigeradas Nestlé.',
        timestamp: this.getCurrentTime(),
        widgetData: {
          type: 'kpi-summary',
          title: 'Disponibilidad de Rampas',
          items: [
            { label: 'Rampas Activas', value: '4 Operando', badgeColor: 'emerald' },
            { label: 'En Descarga', value: 'Rampa 02, 11', badgeColor: 'blue' },
            { label: 'Disponibles', value: 'Rampa 03, 05', badgeColor: 'amber' }
          ],
          actionLabel: 'Ir a Recepción',
          actionRoute: '/receiving'
        }
      };
    }

    // 2. Ubicación en Rack / Putaway
    if (q.includes('ubicacion') || q.includes('ubicación') || q.includes('rack') || q.includes('putaway')) {
      return {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: '📍 **Regla de Ubicación en Rack (Putaway)**\n1. Escanea primero el código de barras de la tarima (SSCC).\n2. El sistema sugerirá la bahía con menor saturación.\n3. Confirma escaneando el código físico del rack.',
        timestamp: this.getCurrentTime(),
        widgetData: {
          type: 'action-card',
          title: 'Módulo de Ubicación',
          items: [
            { label: 'Bahía A', value: '42% libre', badgeColor: 'emerald' },
            { label: 'Bahía APC', value: '88% ocupada', badgeColor: 'amber' }
          ],
          actionLabel: 'Abrir Escáner Putaway',
          actionRoute: '/putaway'
        }
      };
    }

    // 3. Tarimas dañadas, inclinación y NOM-251
    if (q.includes('tarima') || q.includes('daño') || q.includes('inclin') || q.includes('nom') || q.includes('diurex')) {
      return {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: '🪵 **Criterios de Calidad NOM-251 en Piso**\n- **Tolerancia de inclinación máxima:** 5 grados. Si excede, se rechaza o traspalea.\n- **Cinta Diurex:** Estrictamente prohibida en Producto Terminado.\n- **Tarima CHEP rota:** Máximo 1 tabla astillada sin afectar soporte.',
        timestamp: this.getCurrentTime(),
        widgetData: {
          type: 'warning-card',
          title: 'Protocolo de Calidad',
          items: [
            { label: 'Inclinación Máx', value: '5°', badgeColor: 'rose' },
            { label: 'Uso de Diurex', value: 'PROHIBIDO', badgeColor: 'rose' },
            { label: 'Inspección', value: 'Checklist F01', badgeColor: 'amber' }
          ],
          actionLabel: 'Reportar Anomalía',
          actionRoute: '/anomaly'
        }
      };
    }

    // 4. Cola Offline e IndexedDB
    if (q.includes('offline') || q.includes('sync') || q.includes('cola') || q.includes('red') || q.includes('internet')) {
      const isOff = this.syncState.isOffline();
      const count = this.syncState.pendingCount();
      return {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: `📶 **Estado de Sincronización Local**\nActualmente el dispositivo se encuentra **${isOff ? 'OFFLINE (Sin WiFi)' : 'EN LÍNEA'}** con **${count} transacciones** en la cola IndexedDB. Las operaciones se transmitirán automáticamente en orden FIFO al restablecer conexión.`,
        timestamp: this.getCurrentTime(),
        widgetData: {
          type: 'status-list',
          title: 'Métricas de Red & Cola',
          items: [
            { label: 'Conectividad', value: isOff ? 'Offline' : 'Online', badgeColor: isOff ? 'rose' : 'emerald' },
            { label: 'Capacidad Cola', value: `${count}/500 ops`, badgeColor: 'blue' }
          ],
          actionLabel: 'Ver Monitor de Sincronización',
          actionRoute: '/sync'
        }
      };
    }

    // Fallback con respuesta estructurada de ayuda
    return {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: `Entendido: **"${query}"**.\nPuedes consultarme sobre **rampas de descarga**, **reglas de ubicación en rack**, **criterios de calidad NOM-251** o el **estado de sincronización offline**. ¿Deseas navegar a alguna pantalla operativa?`,
      timestamp: this.getCurrentTime(),
      widgetData: {
        type: 'action-card',
        title: 'Accesos Rápidos en Terminal',
        items: [
          { label: 'Cockpit Montacarguista', value: 'Descarga / Carga', badgeColor: 'emerald' },
          { label: 'Conteo Físico', value: 'Inventario', badgeColor: 'blue' }
        ],
        actionLabel: 'Ir al Menú Principal',
        actionRoute: '/menu'
      }
    };
  }

  public executeAction(route?: string): void {
    if (route) {
      this.onClose();
      this.router.navigateByUrl(route);
    }
  }
}
