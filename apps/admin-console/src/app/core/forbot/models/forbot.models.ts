/**
 * @file forbot.models.ts
 * @description Modelos de datos para el asistente conversacional inteligente ForBot (4GUARD AI).
 */

export type ForbotIntentType =
  | 'CADUCIDAD_MERMAS'
  | 'ESTADO_RAMPAS'
  | 'SATURACION_BODEGAS'
  | 'PRODUCTIVIDAD_MONTACARGAS'
  | 'BLOQUEOS_CALIDAD_NOM251'
  | 'GENERAL_HELP'
  | 'UNKNOWN';

export interface ForbotWidgetItem {
  label: string;
  value: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
}

export interface ForbotWidgetData {
  type: 'kpi-summary' | 'status-list' | 'warning-card';
  title: string;
  items: ForbotWidgetItem[];
  actionRoute?: string;
  actionLabel?: string;
}

export interface ForbotChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string; // Formato HH:MM:SS
  intent?: ForbotIntentType;
  widgetData?: ForbotWidgetData;
  isTyping?: boolean;
}
