# ADR-022: Sistema de Mensajería Empresarial (Estilo Google Chat) y Acceso Exclusivo Chat-Only

- **Estado:** Aceptado
- **Fecha:** 2026-11-25
- **Autores:** Equipo 4Guard WMS (Frontend & Backend)
- **Módulos Afectados:** `admin-console`, `4guard_be`, `shared-core`

---

## Contexto y Problema

La operación diaria del WMS 4GUARD requiere comunicación inmediata y trazable entre áreas (Caseta de Seguridad, Recepción, Calidad/PNC, Embarques, Supervisión y Gerencia). Actualmente no existe un canal interno unificado dentro del ecosistema, lo que obliga a usar herramientas externas sin trazabilidad operativa ni aislamiento multi-tenant.

Adicionalmente, existen colaboradores o personal de apoyo que **no deben tener acceso a los módulos operativos ni administrativos del WMS**, pero sí requieren una cuenta de usuario para comunicarse desde **escritorio o dispositivo móvil (celular)** únicamente a través del sistema de chat.

---

## Opciones Evaluadas

1. **Opción 1 (Externa):** Seguir usando mensajería externa (WhatsApp / grupos informales).
   - *Pros:* Cero desarrollo.
   - *Contras:* Sin auditoría, sin aislamiento por `organizationId`, sin vínculo a folios/incidencias, riesgo de fuga de información.
2. **Opción 2 (Chat acoplado solo al Shell Admin):** Integrar el chat únicamente como un widget o ruta dentro del panel administrativo completo.
   - *Pros:* Rápido de montar para admins.
   - *Contras:* No resuelve el acceso limpio para usuarios sin permisos operativos (`CHAT_ONLY`) ni la experiencia móvil dedicada.
3. **Opción 3 (Elegida — Módulo Dedicado + Modo Chat-Only Multi-Dispositivo):** Sistema de mensajería persistente en BD (`4guard_be` + WebSocket/STOMP) con interfaz estilo Google Chat, accesible tanto dentro del WMS como en modo aislado **Escritorio / Móvil** para usuarios `CHAT_ONLY`.

---

## Decisión Tomada

Se adopta la **Opción 3** como estándar oficial de mensajería en 4GUARD bajo las siguientes **Reglas de Negocio y Arquitectura**:

### 1. Alcance y Multi-Tenancy (`RN-01`)
- Aislamiento estricto por `organizationId`: un usuario solo puede ver, buscar e iniciar conversaciones con usuarios activos de su misma organización.
- Filtro opcional por sucursal (`branchId`), priorizando por defecto la sucursal activa.
- Sin acceso a clientes ni transportistas externos.

### 2. Tipos de Conversación (`RN-02`)
- **Mensajes Directos (`DM` 1:1):** Conversación privada única por pareja de usuarios dentro de la organización.
- **Espacios / Canales (`SPACE`):** Salas persistentes por área o propósito (ej. `#Caseta`, `#Recepción`, `#Calidad`, `#Embarques`).
- **Hilos Operativos (`THREAD`):** Respuestas en hilo dentro de un Espacio o vinculadas a una entidad operativa (`FOLIO`, `REMISION`, `INCIDENCE`, `SSCC`).

### 3. Roles, Permisos y Modo `CHAT_ONLY` (`RN-03`)
- **Creación de Espacios:** Solo roles `ADMIN` o `SUPERVISOR` pueden crear/configurar Espacios y gestionar miembros.
- **Inicio de DMs:** Cualquier usuario interno autenticado puede iniciar un DM 1:1.
- **Usuarios Exclusivos de Chat (`CHAT_ONLY`):**
  - Se permite crear usuarios cuyo perfil/permiso esté restringido exclusivamente al módulo de Chat (`CHAT_ONLY` / permiso `CHAT_ACCESS` sin permisos operativos del WMS).
  - Al iniciar sesión, el sistema detecta que es un usuario `CHAT_ONLY` y lo redirige automáticamente a la vista dedicada de Chat (`/chat`), ocultando el menú lateral y bloqueando mediante `rbacGuard` cualquier ruta operativa (`/receiving`, `/security`, `/admin`, `/quality`, `/shipping`, etc.).
  - La vista `/chat` debe ser **100% responsive (Escritorio y Móvil)** con diseño adaptativo (lista de conversaciones ↔ vista de conversación en pantallas pequeñas).

### 4. Contenido, Adjuntos y Referencias (`RN-04`)
- Mensajes de texto con `@menciones`, emojis/reacciones agrupadas y referencias rápidas a entidades operativas (ej. `#26516`).
- Soporte para adjuntar **imágenes** (evidencias) y **documentos PDF** con validación de tipo y tamaño.

### 5. Edición, Borrado Lógico y Auditoría (`RN-05`)
- Solo el autor puede editar sus propios mensajes (mostrando etiqueta `(editado)` y registrando `updatedAt`).
- El borrado es **lógico** (`isDeleted = true`, `deletedAt`), nunca físico, mostrando `"Mensaje eliminado"` en UI y preservando la trazabilidad en BD (`ADR-007` / `ADR-014`).

### 6. Lectura, Presencia y Tiempo Real (`RN-06`, `RN-07`, `RN-08`)
- Puntero `lastReadAt` / `lastReadMessageId` por participante para calcular no leídos y separador *"Mensajes nuevos"*.
- Presencia (`ONLINE`, `AWAY`, `DND`, `OFFLINE`) y configuración de notificaciones por sala (`ALL`, `MENTIONS`, `MUTED`).
- Transmisión en tiempo real vía **WebSocket / STOMP** + paginación por cursor en REST (`beforeMessageId` / `beforeTimestamp`).

---

## Consecuencias

### Positivas
- Comunicación operativa centralizada, auditable y aislada por organización (`organizationId`).
- Personal sin acceso al WMS puede colaborar de forma segura desde celular o escritorio sin exponer pantallas ni datos operativos.
- Arquitectura desacoplada lista para escalar con notificaciones push y vínculos directos a folios.

### Negativas / Compromisos
- Requiere mantener tablas dedicadas en `4guard_be` (conversaciones, participantes, mensajes, reacciones, adjuntos) y sus tópicos STOMP.
- Exige diseño responsive estricto en `4Guard_FE_UI` para garantizar usabilidad fluida tanto en móvil como en escritorio.

---

## Notas de Auditoría y Verificación

- **Cumplimiento:** Todo endpoint y entidad debe cumplir `ADR-007` (cero mocks), `ADR-008` (UUID + UTC) y `ADR-014` (multi-tenant).
- **Seguridad `CHAT_ONLY`:** Verificar mediante pruebas de rutas y guards que un usuario `CHAT_ONLY` no pueda acceder a ningún endpoint ni ruta operativa del WMS, y que su sesión redirija siempre a `/chat`.
