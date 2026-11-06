/**
 * @file forbot.model.ts
 * @description Modelos de datos del ecosistema conversacional inteligente ForBot (4GUARD AI)
 * compartidos entre admin-console y rf-terminal.
 */

export type ForbotMode = 'operativo' | 'tutor' | 'terminal';

export type ForbotIntentType =
  | 'CADUCIDAD_MERMAS'
  | 'ESTADO_RAMPAS'
  | 'SATURACION_BODEGAS'
  | 'PRODUCTIVIDAD_MONTACARGAS'
  | 'BLOQUEOS_CALIDAD_NOM251'
  | 'REGLA_DIUREX_PT'
  | 'TOLERANCIA_INCLINACION_5'
  | 'LIMITE_HUMEDAD_65'
  | 'MUESTREO_MATERIALES_IT01'
  | 'REPARACION_TARIMAS_IT02'
  | 'RESTRICCION_LIBERACION_RBAC'
  | 'CRITERIOS_TRANSPORTE_F01'
  | 'CONSULTA_TARIMA_SSCC_CALIDAD'
  | 'UBICACION_SUGERIDA_PUTAWAY'
  | 'PRE_RECEPCION_INFO'
  | 'ESTADO_SINCRONIZACION_OFFLINE'
  | 'NAVEGACION_SISTEMA'
  | 'ACCION_OPERATIVA'
  | 'GENERAL_HELP'
  | 'TOUR_DRIVER_JS'
  | 'FSM_8_ESTADOS'
  | 'REGLA_PABLO_INFO'
  | 'TUTOR_SECURITY_QR'
  | 'TUTOR_SECURITY_F01'
  | 'TUTOR_SECURITY_RAMPA'
  | 'TUTOR_SECURITY_SALIDA'
  | 'EXPORTAR_BITACORA_F02'
  | 'TUTOR_MGR_THROUGHPUT'
  | 'TUTOR_MGR_HOURS'
  | 'TUTOR_MGR_TOPOLOGY'
  | 'TURNO_COMIDA_ANTICIPACION'
  | 'TUTOR_DESK_365_DAYS'
  | 'TUTOR_DESK_ASSIGN_RF'
  | 'TUTOR_DESK_FEFO'
  | 'TUTOR_DIR_SLAS'
  | 'TUTOR_DIR_GOVERNANCE'
  | 'TUTOR_DIR_CAPACITY'
  | 'TUTOR_DIR_MERMAS'
  | 'TUTOR_RF_MISSION'
  | 'IA_GENERATIVA_QUERY'
  | 'UNKNOWN';

export interface ForbotWidgetItem {
  label: string;
  value: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
}

export interface ForbotActionPayload {
  actionType: 'NAVIGATE' | 'OPEN_MODAL' | 'FILTER_TABLE' | 'TRIGGER_SYNC' | 'SCAN_TARIMA';
  route?: string;
  targetId?: string;
  parameters?: Record<string, any>;
  confirmationRequired?: boolean;
  confirmLabel?: string;
}

export interface ForbotWidgetData {
  type: 'kpi-summary' | 'status-list' | 'warning-card' | 'tutorial-card' | 'action-card';
  title: string;
  items: ForbotWidgetItem[];
  actionRoute?: string;
  actionLabel?: string;
  actionPayload?: ForbotActionPayload;
  proactiveTip?: string;
}

export interface ForbotChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string; // Formato HH:MM:SS
  intent?: ForbotIntentType;
  widgetData?: ForbotWidgetData;
  isTyping?: boolean;
  voiceInput?: boolean;
}

export interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error?: string | null;
}
