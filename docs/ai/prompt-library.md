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

## 🏛️ Agregar Header Hero Golden Standard con Navegación `/admin`

```
Homologa la cabecera (Header Hero) del módulo [Módulo] con la barra de navegación Golden Standard de 4GUARD WMS.

Referencia visual: Turnos y Horarios (shift-management.component.html)

Estructura requerida:
<div class="hero-header__breadcrumb">
  <a routerLink="/admin" class="btn-back-admin" title="Regresar a Administración WMS">
    <span class="back-arrow">←</span> ADMINISTRACIÓN WMS
  </a>
  <span class="breadcrumb-dot">·</span>
  <span class="hero-header__eyebrow">[CATEGORÍA EN MONOSPACE GOLD]</span>
</div>

Requisitos:
1. Importar RouterLink en el componente Standalone.
2. Botón .btn-back-admin con fondo --gold-bg, borde --gold-border y hover animado.
3. Eyebrow en texto monospace dorado con uppercase.
```

---

## ⚡ Implementar Carga Perezosa (Lazy Loading) de Módulos Operativos

```
Asegura la carga perezosa (Lazy Loading) en el servicio y componente del módulo [Módulo].

Requisitos (ADR-008 / SDD Level 5):
1. Remover cualquier llamada HTTP ansiosa de los constructores (constructor()) en los servicios HTTP.
2. Trasladar la invocación this.[service].loadData() al método ngOnInit() del componente Standalone.
3. Asegurar que las peticiones a la API REST de Spring Boot se ejecuten ÚNICA Y EXCLUSIVAMENTE cuando el usuario navegue hacia la pantalla del módulo.
4. Validar que la compilación de TypeScript no reporte errores (npx tsc --noEmit).
```

---

## 📜 Integrar Auditoría con Diff de Cambios Remotos (GET /{id}/audit)

```
Integra la sección de Auditoría y Trazabilidad en Tiempo Real para el módulo [Módulo].

Endpoint BE: GET /api/v1/[entidad]/{id}/audit

Requisitos:
1. Definir el método getAuditApi(id) en el servicio inyectando HttpClient.
2. Manejar la respuesta con la estructura AlertConfigAuditResponse / ShiftAuditLogResponse:
   - logId, username, createdAt, action, ipAddress
   - changes: [{ field, oldValue, newValue }]
3. En la UI: renderizar una línea de tiempo / tabla con chips de cambios diff (campo: anterior ➔ nuevo).
4. Incluir un botón de Refrescar Auditoría (refresh) con spinner de carga.
5. Invocar la recarga de auditoría automáticamente al seleccionar un ícono de lista o al realizar un guardar/mutación exitosa.
```

---

## 🔔 Sincronización Reactiva de Formularios con Signals (`formValuesSignal`)

```
Implementa una Vista Previa en Tiempo Real (Live Preview) para el formulario reactivo de [Módulo].

Requisitos (Angular Signals / SDD Level 5):
1. Declarar un signal interno `formValuesSignal = signal<any>(null)` en el componente.
2. En `initForm()`, suscribir `this.form.valueChanges` para emitir `this.formValuesSignal.set(this.form.getRawValue())`.
3. Actualizar `this.formValuesSignal.set(...)` al resetear el formulario (`selectItem`, `createNewItem`).
4. Definir la propiedad computada `livePreview = computed(() => ...)` que lea `formValuesSignal()`.
5. Asegurar que cada pulsación de tecla o cambio en los campos (ej. messageTemplate, priority) actualice de inmediato la vista previa o simulador en pantalla sin requerir guardar.
```

---

## 🛡️ Modales Emergentes Desacoplados (Prevención de Refresco HTML)

```
Implementa un modal emergente desacoplado para la acción [Acción/Revocar/Eliminar] en el módulo [Módulo].

Requisitos (SDD Level 5 / ADR-002):
1. Usar un contenedor <div class="carriers-dialog__form"> en lugar de <form> en la plantilla del modal para evitar que el navegador envíe el formulario padre.
2. En el handler TS, aceptar event?: Event e invocar event?.preventDefault(); event?.stopPropagation(); como primera instrucción.
3. El botón de confirmación debe ser <button type="button" (click)="confirmAction($event)"> con estado [disabled]="isSaving()".
4. Soportar estados de feedback visual: Spinner ("Procesando...") y notificaciones exclusivas con ToastService.
```

---

## 🔓 Modo Consulta Solo Lectura con Acciones Habilitadas

```
Implementa la protección de solo lectura para el estado [REVOKED/CLOSED] en el módulo [Módulo].

Requisitos (SDD Level 5):
1. Definir una propiedad computada `isReadOnly = computed(() => this.selectedItem()?.status === '[ESTADO_FINAL]')`.
2. Aplicar [disabled]="isReadOnly()" en los contenedores <fieldset> de los campos del formulario para que todos los inputs/selects queden deshabilitados automáticamente en modo consulta.
3. Mantener la barra de acciones (.carriers-form-actions) fuera de los fieldsets deshabilitados.
4. Asegurar que los botones de reactivación/reapertura (ej. Activar o Reabrir) permanezcan 100% habilitados y cliqueables.
```

---

## 💱 Integración de Cotizaciones en Vivo desde API de Banco Central (Banxico SIE REST)

```
Integra la consulta de cotizaciones en tiempo real desde el servicio oficial de Banco Central (Banxico SIE REST) en el módulo de [Módulo/Divisas].

Endpoint BE: GET /api/v1/exchange-rates/banxico/live/{seriesId}

Requisitos (HU-148 / SDD Level 5):
1. Definir la interfaz BanxicoLiveRateData (seriesId, currencyCode, rate, publicationDate, sourceType).
2. Crear el método getBanxicoLiveRate(seriesId) en el servicio con fallback resiliente en caso de interrupción.
3. En la UI del formulario de registro de tipo de cambio:
   - Agregar el botón "Obtener de Banxico (Live)" con estado de carga (isFetchingBanxico).
   - Mapear el código ISO a la serie correspondiente (USD -> SF57805, EUR -> SF46410).
   - Auto-poblar los campos rate, sourceType ('CENTRAL_BANK') y notes sin bloquear la edición del usuario.
   - Mostrar un Banner Informativo dorado que confirme la tasa recuperada y recuerde al usuario que puede editar el valor libremente antes de guardar.
4. Notificar mediante ToastService la confirmación de la cotización recibida.
```

```

---

## 📊 Crear Data Table Homologada 4GUARD WMS (ADR-013)

```
Crea una tabla de datos (Data Table) homologada para la entidad [Entidad] en el módulo [Módulo].

Cumplimiento estricto (ADR-013 / component-specs.md):
1. Estructura HTML:
   - Contenedor <div class="table-container"> envolviendo la tabla.
   - Tabla <table class="data-table"> con thead y tbody.
   - Cabecera con columnas ordenables (th.sortable) e icono de dirección sort-icon (arrow_upward/arrow_downward/unfold_more).
   - Columnas especializadas:
     * Código / Identificador: td.td-mono (fuente JetBrains Mono)
     * Título / Descripción: td.td-primary (con título y subtítulo en 2 líneas)
     * Estatus: td.td-center con <span class="carrier-status-badge carrier-status-badge--[status]">
     * Acciones: td.td-actions con botones de 32x32px (.btn-icon) para editar y eliminar
2. Estados de tabla:
   - Carga: 5 filas esqueleto con shimmer (.table-skeleton-row > .skeleton-cell) cuando isLoading() es true.
   - Vacío: .table-empty con icono Material ('inbox'), título y descripción cuando la lista esté vacía.
3. Barra de paginación (.table-pagination):
   - Texto informativo: "Mostrando X a Y de Z registros"
   - Selector de tamaño de página (.form-select .pagination-size__select con opciones 10, 25, 50, 100)
   - Botón anterior (.pagination-btn con chevron_left, disabled en página 1)
   - Páginas numeradas con estado .is-active dorado
   - Botón siguiente (.pagination-btn con chevron_right, disabled en última página)
4. Reactividad con Signals:
   - page = signal(1), pageSize = signal(10), sortField = signal('[campo]'), sortAsc = signal(true)
   - pagedItems = computed(() => ...) aplicando ordenamiento y paginación en memoria o conectando con API Pageable.
```

---

## 🔽 Crear Selector / Searchable Dropdown Homologado (ADR-013)

```
Implementa un selector dinámico homologado para [Entidad / Catálogo] en el formulario de [Módulo].

Requisitos (ADR-013 / Synexia Design System):
1. Si el catálogo tiene <= 8 opciones:
   - Usar <select class="form-select"> dentro de un <div class="form-group">
   - Label superior <label class="form-label form-label--required">
   - Opción inicial deshabilitada <option value="" disabled selected>Selecciona una opción…</option>
   - Enfoque con resplandor dorado (box-shadow: 0 0 0 3px rgba(234, 195, 73, 0.12))
   - Mensaje de validación .form-error con icono Material 'error' si el control es inválido y touched
2. Si el catálogo tiene > 8 opciones (Searchable Dropdown / Typeahead):
   - Contenedor .fg-searchable-select con clase .is-open condicional
   - Input de búsqueda interactiva con icono de lupa (search) y chevron (expand_more)
   - Menú flotante con glassmorphism (.fg-searchable-select__menu) con lista de opciones
   - Opción con código en mono (.option-code) y nombre (.option-label), e icono check si está seleccionada
   - Estado vacío .fg-searchable-select__empty cuando no haya coincidencias
   - Soporte para navegación con teclado y cierre al hacer clic fuera (click-outside)
```

---

## 📅 Crear Datepicker Industrial con Rangos y Presets Rápidos (ADR-013)

```
Implementa un selector de fechas / selector de rango homologado para [Fecha / Operación] en [Módulo].

Requisitos (ADR-008 / ADR-013):
1. Presentación en UI:
   - Formato visible estricto: DD/MM/YYYY
   - Contenedor .fg-datepicker-wrap con icono Material 'calendar_today'
   - Input accesible con placeholder "DD/MM/AAAA"
2. Persistencia en Backend:
   - Al emitir el DTO hacia la API REST, formatear a ISO-8601 UTC (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ)
3. Si es selector de rango (.fg-daterange-container):
   - Barra superior con chips de acceso rápido (.ce-chip): "Hoy", "Ayer", "Últimos 7 días", "Este mes"
   - Dos inputs: Fecha Inicial y Fecha Final con separador visual (➔)
   - Validación reactiva: startDate <= endDate. Mostrar .form-error si la fecha final es menor que la inicial.
4. Soporte temático:
   - Popover de calendario adaptable a .theme-dark y .theme-light con colores de acento dorado en el día seleccionado.
```

---

## 📝 Generar Documento de Diseño de Software (SDD) Completo

```
Genera el documento SDD completo y estandarizado para el módulo de [Módulo / Entidad].

Ubicación del archivo: docs/sdd/[modulo].sdd.md (y docs/sdd/[modulo].sdd.md en backend si aplica).

El SDD debe incluir OBLIGATORIAMENTE las siguientes 7 secciones estructuradas:
1. Objetivo y Alcance (Propósito de negocio, usuarios beneficiados, capacidades operativas).
2. Estructura de Archivos del Módulo (Árbol de componentes, servicios, modelos y rutas).
3. Normativa de Homologación de Componentes (ADR-013) (Tabla detallada con: Hero Header con /admin, KPI Cards Grid, Split-View 35/65, Data Tables, Selectores, Datepickers y Diálogos de Confirmación).
4. Estado Reactivo del Componente (Tabla de Signals: WritableSignal, ComputedSignal, tipos y descripciones).
5. Modelos de Datos TypeScript (Interfaces completas homologadas 1:1 con DTOs de Java).
6. Contrato HTTP REST (Tabla de verbos, endpoints /api/v1/..., DTOs de petición y respuesta).
7. Validaciones, Notificaciones (ToastService) y Auditoría (Timeline con deltas campo: anterior ➔ nuevo).
```

---

## ✨ Homologación Completa de Pantalla Existente al Estándar Golden (Split-View 35/65)

```
Homologa integralmente la pantalla del módulo [Módulo] al estándar Golden Standard (Transportistas / Alertas).

Ruta del componente: apps/admin-console/src/app/features/[feature]/

Aplica la arquitectura Split-View 35/65 y el Design System Synexia:
1. Hero Header (.hero-header):
   - Icono Midnight Navy en caja de 52x52px con esquinas redondeadas
   - Breadcrumb con botón .btn-back-admin (enlace a /admin) y eyebrow de categoría en monospace dorado
   - Título H1 (1.7rem - 2.1rem) y subtítulo descriptivo
   - Botón primario de acción (ej. "Nuevo registro")
2. KPI Cards Grid (.carriers-kpi-grid):
   - 4 tarjetas con métricas operativas (Total, Activos, Pendientes/Alerta, Inactivos)
   - Barra semántica inferior de 3px y animación hover
3. Columna Izquierda — Directorio (35% / ~340px):
   - Buscador interactivo con debounce
   - Chips de filtrado rápido por estatus (Todas / Activas / Inactivas)
   - Lista con scroll independiente, badges de estado y estados de carga esqueleto
4. Columna Derecha — Detalle / Formulario (65%):
   - Cabecera sticky con migas de pan internas
   - Agrupación por secciones con leyendas doradas (.section-legend)
   - Controles de formulario (inputs de 40px, selects y datepickers homologados)
   - Acordeón de trazabilidad de auditoría en tiempo real con deltas
   - Barra de acciones sticky inferior (.carriers-form-actions) con botones Descartar y Guardar
5. Diálogo Desacoplado:
   - Todo flujo destructivo debe usar <fg-confirm-dialog> sin etiquetas <form> envolventes
6. Cero degradación: Mantener intacta la lógica de negocio y los servicios HTTP.
```

---

## 💡 Tips de uso

1. **Siempre especifica el módulo objetivo** — "en el módulo de Sucursales" es más preciso que "en el sistema".
2. **Menciona la pantalla de referencia** — "homologado con carrier-management o alerts-config" activa el design system correcto.
3. **Cita el archivo del contrato BE** — "Lee docs/api/modules/alerts-config.md" evita que se inventen endpoints.
4. **Para bugs**, incluir la ruta exacta del archivo y una descripción del comportamiento esperado vs actual.

