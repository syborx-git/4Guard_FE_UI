# 🎨 Catálogo de Patrones de UI y Arquitectura — 4GUARD WMS

> **Guía de Patrones de Diseño:** Este catálogo define la estructura esquelética, la maquetación HTML/SCSS y el estado reactivo con Signals para cada tipo de solución en el sistema.

---

## 🎯 ¿Cómo usar este catálogo?

Al solicitar a una Inteligencia Artificial o al equipo la construcción de una nueva pantalla, especifica en el prompt el **patrón exacto a reutilizar**:

```text
"Crea el nuevo módulo [Nombre] utilizando el patrón docs/patterns/split-view-master-detail.md"
```

> 🤖 **Si no especificas un patrón en el prompt:**  
> La IA evaluará automáticamente tu requerimiento utilizando las **Reglas de Auto-Detección de Intención** detalladas abajo, seleccionará el patrón óptimo y te informará su decisión antes de generar código.

---

## 🤖 Motor de Auto-Detección de Patrones para la IA

Cuando el usuario solicita crear o refactorizar un módulo **sin indicar un patrón explícito**, la IA analiza las palabras clave del requerimiento y mapea automáticamente la solución según este algoritmo de intención:

```
¿Qué busca el usuario en esta pantalla?
│
├── 🔑 "catálogo", "tabla de gestión", "alta/edición", "crud", "mantenimiento"
│   └── ➔ SELECCIONAR: Patrón 1 (split-view-master-detail.md)
│
├── 🔑 "dashboard", "torre de control", "KPIs", "resumen ejecutivo", "hub de navegación"
│   └── ➔ SELECCIONAR: Patrón 2 (dashboard-kpi-bento.md)
│
├── 🔑 "historial", "trazabilidad", "bitácora", "quién hizo qué", "log", "diff JSON"
│   └── ➔ SELECCIONAR: Patrón 3 (audit-log-drawer.md)
│
├── 🔑 "pasos", "paso 1, paso 2", "asistente", "proceso guiado", "orden de recepción multipaso"
│   └── ➔ SELECCIONAR: Patrón 4 (wizard-multi-step.md)
│
└── 🔑 "mapa cromático", "racks", "layout gráfico", "ubicaciones por color", "estados FSM"
    └── ➔ SELECCIONAR: Patrón 5 (fsm-chromatic-grid.md)
```

---

## 📊 Matriz de Decisión de Patrones

| Patrón | Archivo | Caso de Uso Principal | Componentes / Vistas de Referencia |
|---|---|---|---|
| **1. Split View 30/70** | [`split-view-master-detail.md`](./split-view-master-detail.md) | CRUDs estándar de catálogos y gestión operativa. | Transportistas (`/carriers`), Proveedores (`/suppliers`), Sucursales (`/branches`) |
| **2. Dashboard & Bento Grid** | [`dashboard-kpi-bento.md`](./dashboard-kpi-bento.md) | Torres de Control, dashboards ejecutivos y hubs de navegación. | Dashboard Principal (`/dashboard`), Admin Hub (`/admin`) |
| **3. Audit Log & Drawer** | [`audit-log-drawer.md`](./audit-log-drawer.md) | Bitácoras de trazabilidad, historial forense y visualización de Diffs JSON. | Actividad de Usuario (`/user-activity`), Sesiones Activas (`/sessions`) |
| **4. Wizard Multi-Paso** | [`wizard-multi-step.md`](./wizard-multi-step.md) | Procesos complejos secuenciales que requieren varios pasos de validación. | Alta de Almacén Completo, Recepción de ASN, Conteo Físico |
| **5. Topología Cromática FSM** | [`fsm-chromatic-grid.md`](./fsm-chromatic-grid.md) | Visualización cromática de estados de máquina finita (Racks, Ubicaciones). | Ubicaciones Físicas (`/layout`), Mapa de Andenes |

---

## 📐 Principios Comunes a Todos los Patrones

1. **Standalone Components:** Todos los componentes se implementan como Standalone (`standalone: true`).
2. **Signals Native:** El estado local y derivado usa Angular Signals (`signal`, `computed`, `inject`).
3. **Synexia Theme:** Paleta Midnight Navy (`#172033`) y Prestige Gold (`#c5a86b`) con soporte Dark Mode obligatorio (`:host-context(.theme-dark)`).
4. **Cero Mocks:** Consumo estricto desde los servicios HTTP conectados a la BD de `4Guard_BEAPI`.
