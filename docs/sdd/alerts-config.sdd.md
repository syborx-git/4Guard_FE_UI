# SDD — Frontend: Módulo Configuración de Alertas (`4Guard_FE_UI`)

> **Módulo:** `alerts-config`  
> **Repositorio:** `4Guard_FE_UI` · **Ruta:** `apps/admin-console/src/app/features/alerts-config/`  
> **Framework:** Angular 17+ (Standalone Components, Signals Reactivos, Reactive Forms)  
> **Rol / Permiso:** `WMS_ADMIN`, `SYSTEM_CONFIG`, `ALERTS_MANAGE`  
> **Estado:** 🟢 Golden Standard de Referencia — Conectado a Spring Boot 3 REST Real  

---

## 1. Objetivo y Alcance

Permitir a los administradores del sistema y supervisores de almacén configurar las **Reglas, Canales y Plantillas de Notificación** que disparan alertas automáticas ante eventos operativos críticos (ej. Rupturas de stock, retrasos en andén, mercancía dañada en recepción, sobreocupación de bahías y discrepancias de inventario).

Capacidades clave:
1. **Matriz Multicanal:** Habilitación por regla de múltiples canales simultáneos: In-App (Toast y Centro de Notificaciones), Email, SMS, WhatsApp y Webhooks externos.
2. **Priorización Operativa:** Niveles `INFO`, `WARNING`, `CRITICAL` y `EMERGENCY` con códigos cromáticos diferenciados.
3. **Plantillas con Variables Dinámicas:** Editor de mensajes con soporte de interpolación de variables (`{sku}`, `{location}`, `{user}`, `{quantity}`, `{threshold}`).
4. **Live Toast Signals & Simulador:** Prueba en vivo del disparo de alertas sin persistencia en base de datos.
5. **Auditoría de Cambios en Reglas:** Registro detallado de modificaciones en umbrales de activación y destinatarios.

---

## 2. Estructura de Archivos del Módulo

```
apps/admin-console/src/app/features/alerts-config/
├── alerts-config-management/
│   ├── alerts-config-management.component.ts    ← Lógica reactiva y gestión de canales
│   ├── alerts-config-management.component.html  ← Template Split-View con vista previa
│   └── alerts-config-management.component.css   ← Estilos con tokens Synexia
├── alerts-config.models.ts                      ← DTOs e interfaces de alertas
├── alerts-config.routes.ts                      ← Rutas del módulo
├── alerts-config.service.ts                     ← Servicio HTTP REST hacia /api/v1/alert-configs
└── alerts-config.validators.ts                  ← Validadores reactivos de destinatarios y umbrales
```

---

## 3. Normativa de Homologación de Componentes (ADR-013)

| Componente | Implementación en este Módulo | Requisitos de Cumplimiento |
|---|---|---|
| **Hero Header** | `.hero-header` | Icono navy 52x52px (`notifications_active`), breadcrumb `.btn-back-admin` hacia `/admin`, eyebrow `CONFIGURACIÓN WMS` en monospace dorado, H1 `Reglas y Alertas del Sistema`. |
| **KPI Cards Grid** | `.carriers-kpi-grid` | Total de Reglas, Alertas Activas (verde), Críticas/Emergencia (rojo), Canales Habilitados (dorado). |
| **Directorio Lateral** | `.carriers-directory` (35%) | Buscador por nombre de regla o evento, filtro por severidad y chips de estado activo/inactivo. |
| **Selectores & Dropdowns** | `.form-select` | Selectores para `eventTrigger` (evento origen) y `priority` (nivel de criticidad) con borde dorado en foco. |
| **Data Table / Matriz** | `.table-container`, `.data-table` | Tabla de destinatarios y roles suscritos con ordenamiento, badge de rol y botón de remover fila. |
| **Datepickers / Horarios** | `.fg-datepicker` | Selector de ventana de silencio (Quiet Hours) con validación de horas operativas. |
| **Live Preview Box** | `.live-preview-box` | Caja flotante con simulación reactiva en tiempo real del toast o correo generado. |

---

## 4. Estado Reactivo del Componente (`Signals`)

| Signal | Tipo | Descripción |
|---|---|---|
| `alertConfigs` | `WritableSignal<AlertConfig[]>` | Lista de configuraciones de alerta cargadas del backend |
| `selectedConfig` | `WritableSignal<AlertConfig \| null>` | Regla seleccionada actualmente en el formulario |
| `filterSeverity` | `WritableSignal<string>` | Filtro reactivo por criticidad (`ALL`, `CRITICAL`, etc.) |
| `searchFilter` | `WritableSignal<string>` | Filtro de texto por nombre de regla |
| `filteredConfigs` | `ComputedSignal<AlertConfig[]>` | Lista filtrada automáticamente según búsqueda y severidad |
| `formValuesSignal` | `WritableSignal<any>` | Signal interno sincronizado con `form.valueChanges` para Live Preview |
| `livePreviewHtml` | `ComputedSignal<string>` | Previsualización renderizada del mensaje de alerta |
| `isTestingChannel`| `WritableSignal<boolean>` | Indicador de emisión de alerta de prueba |

---

## 5. Modelos de Datos TypeScript (`alerts-config.models.ts`)

```typescript
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'WEBHOOK';

export interface AlertRecipient {
  id?: string;
  type: 'USER' | 'ROLE' | 'EMAIL' | 'PHONE';
  target: string;                  // UUID de usuario, nombre de rol o email/teléfono
  label?: string;
}

export interface AlertConfig {
  id: string;                      // UUID v4
  organizationId: string;
  code: string;                    // ALT-001
  name: string;
  description: string;
  eventType: string;               // 'LOW_STOCK', 'BAY_OVERFILL', etc.
  severity: AlertSeverity;
  channels: NotificationChannel[];
  recipients: AlertRecipient[];
  messageTemplate: string;
  throttleMinutes: number;         // Tiempo mínimo entre disparos repetidos
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertConfigRequest {
  name: string;
  description: string;
  eventType: string;
  severity: AlertSeverity;
  channels: NotificationChannel[];
  recipients: AlertRecipient[];
  messageTemplate: string;
  throttleMinutes: number;
  isActive: boolean;
}
```

---

## 6. Contrato HTTP REST (`AlertConfigService`)

| Método | Verbo | Endpoint | Descripción |
|---|---|---|---|
| `getAlertConfigs()` | `GET` | `/api/v1/alert-configs` | Lista todas las reglas de alerta de la organización |
| `getAlertConfig(id)` | `GET` | `/api/v1/alert-configs/{id}` | Recupera la regla de alerta especificada |
| `createAlertConfig(dto)` | `POST` | `/api/v1/alert-configs` | Registra una nueva regla de notificación |
| `updateAlertConfig(id, dto)` | `PUT` | `/api/v1/alert-configs/{id}` | Modifica canales, destinatarios y plantillas |
| `toggleActive(id)` | `PATCH` | `/api/v1/alert-configs/{id}/toggle` | Activa o desactiva la regla |
| `testAlert(id, channel)` | `POST` | `/api/v1/alert-configs/{id}/test` | Emite una alerta de prueba en vivo al canal solicitado |
| `getAudit(id)` | `GET` | `/api/v1/alert-configs/{id}/audit` | Obtiene el historial de deltas de la regla |

---

## 7. Manejo de Notificaciones y Pruebas en Vivo

1. **Test en Vivo:** Al pulsar *"Probar Notificación"*, se dispara `POST /api/v1/alert-configs/{id}/test`, mostrando un `ToastService.info('Prueba de alerta enviada al canal solicitado')` y renderizando el toast de prueba con la severidad configurada.
2. **Validación de Variables:** El componente valida mediante `alerts-config.validators.ts` que las variables entre llaves `{variable}` coincidan con los campos autorizados para el `eventType`.
