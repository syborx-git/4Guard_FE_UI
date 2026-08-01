# 4GUARD WMS — Biblioteca de Prompts

> Prompts optimizados y probados para generar módulos, componentes y correcciones.  
> **Pegar tal cual en la conversación** (reemplazar solo los valores en `[corchetes]`).

---

## 🟢 Crear módulo CRUD completo

**Úsalo cuando:** El módulo está marcado ⬜ en `docs/architecture/module-status.md`

```
Crea el módulo CRUD de [Entidad] para el admin-console de 4GUARD WMS.

Requisitos:
- Lee docs/api/modules/[modulo].md para el contrato exacto del BE
- Homologa visualmente con el módulo de Transportistas (carrier-management)
- Patrón de state: docs/coding/state-management.md
- Manejo de errores: docs/coding/error-handling.md
- Notificaciones: Usar exclusivamente ToastService (toast.success / toast.error). Cero banners estáticos de éxito/error en HTML (docs/coding/notifications.md)
- Design system: docs/design/design-system.md (dark mode con CSS variables)

Estructura de archivos a generar:
apps/admin-console/src/app/features/[feature]/
  ├── [feature].routes.ts
  ├── [entity]-management/
  │   ├── [entity]-management.component.ts
  │   ├── [entity]-management.component.html
  │   └── [entity]-management.component.scss
  ├── [entity]-form/
  │   ├── [entity]-form.component.ts
  │   └── [entity]-form.component.html
  └── services/
      └── [entity].service.ts

El módulo debe incluir:
- Split view 30/70 (lista izquierda, detalle derecho)
- 4 KPI cards en el header
- Tabla con badges de status coloreados
- Formulario reactivo con validaciones
- Confirmación modal para eliminar
- FSM de estado si aplica (ver contrato BE)
- Dark mode completo con :host-context(.theme-dark)
- RBAC: guard de módulo con canActivate
```

---

## 🟡 Homologar pantalla existente

**Úsalo cuando:** El módulo está marcado 🔶 (existe pero no está homologado)

```
Homologa visualmente el módulo de [Entidad] al estándar de diseño 4GUARD WMS.

Pantalla de referencia: carrier-management (Gestión de Transportistas)

Analiza el componente actual en:
apps/admin-console/src/app/features/[feature]/

Mantén TODA la lógica existente. Solo actualiza:
1. CSS variables de dark/light mode (docs/design/design-system.md)
2. Layout split view 30/70 si no lo tiene
3. KPI cards header si no las tiene
4. Badges de status con colores del design system
5. Tipografía (Inter, sistema de tamaños)
6. Glassmorphism en paneles y modales

NO cambiar: servicios HTTP, signals, lógica de negocio, permisos RBAC
```

---

## 🔵 Agregar campo a formulario existente

```
Agrega el campo [campo] al formulario de [Módulo] en 4GUARD WMS.

Specs del campo:
- Nombre TS: [nombreCamelCase]
- Tipo: [string | number | boolean | UUID | enum]
- Validación: [required | maxLength(X) | email | pattern]
- Nombre en BE (DTO): [nombreEnJava]
- Endpoint afectado: [POST/PUT /api/v1/entidad]

Actualiza:
1. El tipo/interface en [entity].service.ts o models
2. El ReactiveForm en [entity]-form.component.ts (agregar FormControl)
3. El template HTML del formulario (nueva fila en la section correcta)
4. El mapping en el submit handler
```

---

## 🔴 Agregar FSM de estado a módulo existente

```
Agrega la funcionalidad de cambio de estado (FSM) al módulo de [Entidad].

Contrato del BE: docs/api/modules/[modulo].md (sección FSM / UpdateStatusRequest)
Referencia visual: Gestión de Transportistas (modal de cambio de estado)

Lo que necesitas agregar:
1. Botón "Cambiar Estado" en el panel de detalle (derecha)
2. Modal de cambio de estado con:
   - Selector de nuevo estado (opciones según FSM)
   - Campo reason (condicional: requerido según el estado destino)
   - Campo observations (opcional)
3. Llamada HTTP: PATCH /api/v1/[entidad]/{id}/status
4. Toast de éxito/error
5. Actualización de signals (selected + items list)
```

---

## 🟣 Agregar historial de auditoría

```
Agrega la tab/panel de auditoría al módulo de [Entidad] en 4GUARD WMS.

Endpoint: GET /api/v1/[entidad]/{id}/audit

Referencia visual: Panel de auditoría en Gestión de Usuarios (users-list)

Implementa:
1. AuditPanelComponent (reutilizable) o sección dentro del detalle
2. Timeline vertical cronológico (más reciente primero)
3. Iconos de acción (CREATE=plus, UPDATE=edit, DELETE=trash, STATUS=swap)
4. Formato de fecha: DD/MM/YYYY HH:mm
5. Performer: nombre del usuario que hizo el cambio
6. Carga lazy: solo llamar GET /audit cuando el usuario selecciona la tab
```

---

## ⚙️ Crear servicio HTTP para nuevo módulo

```
Crea el servicio HTTP para el módulo de [Entidad] siguiendo el patrón de UsersService.

Contrato del BE: docs/api/modules/[modulo].md

Patrón base: apps/admin-console/src/app/core/services/users.service.ts

El servicio debe:
1. Usar inject(HttpClient) y inject en el constructor
2. Definir API_URL con environment.apiBaseUrl
3. Exponer Observables tipados (nunca Promises)
4. Usar catchError((err) => throwError(() => err)) en cada método
5. Tipar cada método con los DTOs del módulo
6. Documentar quirks del endpoint (si hay id en body, etc.)

Nombre del archivo: apps/admin-console/src/app/features/[feature]/services/[entity].service.ts
```

---

## 🐛 Corregir bug de alineación / estilos

```
Corrige el estilo de [descripción del problema] en el componente:
[ruta/al/componente.scss o .html]

El componente debe verse igual que [componente de referencia].
Usa SOLO las CSS variables del design system (docs/design/design-system.md).
No añadir colores hardcoded (hex, rgb, hsl directos).
Verificar que el fix aplique en dark mode (:host-context(.theme-dark)).
```

---

## 📝 Generar DTOs / interfaces TypeScript desde BE

```
Genera las interfaces TypeScript para el módulo de [Entidad].

Fuente: docs/api/modules/[modulo].md (sección Request DTOs y Response DTOs)

Convenciones:
- Archivo: apps/admin-console/src/app/features/[feature]/models/[entity].models.ts
- Prefijo: ninguno (ej: CarrierResponse, CreateCarrierRequest)
- Campos opcionales: usar ? (no | undefined)
- Fechas: string (ISO 8601, no Date object)
- IDs: string (UUID, no number)
- Enums: separados del modelo, en el mismo archivo con sufijo Status/Type

También generar el helper type:
  type CreateOrUpdate[Entity]Request = Create[Entity]Request | Update[Entity]Request
```

---

## 💡 Tips de uso

1. **Siempre especifica el módulo objetivo** — "en el módulo de Sucursales" es más preciso que "en el sistema".
2. **Menciona la pantalla de referencia** — "homologado con carrier-management" activa el design system correcto.
3. **Cita el archivo del contrato BE** — "Lee docs/api/modules/branches.md" evita que se inventen endpoints.
4. **Para bugs**, incluir la ruta exacta del archivo y una descripción del comportamiento esperado vs actual.
