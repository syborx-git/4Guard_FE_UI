# 4GUARD WMS — Documentación del Sistema

> **Spec-Driven Development (SDD)** — Todo cambio importante en el sistema comienza aquí.

---

## 📂 Estructura completa

```
docs/
├── adr/                    # Architecture Decision Records
│   └── ADR-001-to-005.md
├── architecture/           # Arquitectura general del sistema
│   ├── overview.md
│   ├── module-status.md    ← ⭐ Estado de cada módulo (✅🔶⬜)
│   └── shared-core.md      ← ⭐ Librería @4guard/shared-core documentada
├── design/                 # Design System & Component Specs
│   ├── design-system.md    ← Tokens, colores, tipografía, animaciones
│   └── component-specs.md  ← Specs de las 4 pantallas de referencia
├── coding/                 # Convenciones de código
│   ├── conventions.md      ← Checklist de implementación
│   ├── state-management.md ← ⭐ Patrón de Angular Signals por módulo
│   ├── error-handling.md   ← ⭐ Manejo de errores HTTP
│   └── notifications.md    ← ⭐ ToastService — cuándo y cómo usarlo
├── business/               # Glosario y contexto de negocio
│   └── glossary.md
├── api/                    # Contrato con 4Guard_BEAPI
│   ├── contracts.md        ← Patrones globales: wrapper, IDs, errores
│   ├── endpoints.md        ← Overview de endpoints
│   └── modules/            ← ⭐ Un archivo por módulo del BE
│       ├── users.md
│       ├── carriers.md
│       ├── locations.md
│       ├── branches.md
│       ├── organizations.md
│       ├── clients.md
│       ├── roles-permissions.md
│       ├── suppliers.md
│       └── skus-sections-auth-audit.md
├── ai/                     # Contexto para IA
│   ├── context.md          ← LEER PRIMERO si eres una IA
│   └── prompt-library.md   ← ⭐ Prompts probados para generación de módulos
├── testing/                # Estrategia de testing
│   └── strategy.md
├── deployment/             # Guías de despliegue
│   └── docker.md
├── security/               # Autenticación y RBAC
│   └── auth-flow.md
└── examples/               # Templates
    └── feature-template.md ← Template SDD para nuevas features
```

---

## 🤖 Quick Start para IA — Leer en este orden

1. [`ai/context.md`](./ai/context.md) — diseño global, paleta, convenciones
2. [`api/contracts.md`](./api/contracts.md) — patrón ApiResponse, IDs UUID, errores
3. [`api/modules/[modulo].md`](./api/modules/) — contrato exacto del BE
4. [`architecture/module-status.md`](./architecture/module-status.md) — verificar si ya existe
5. [`coding/state-management.md`](./coding/state-management.md) — signals pattern
6. [`design/component-specs.md`](./design/component-specs.md) — split view, KPI cards

> Para prompts listos para usar: [`ai/prompt-library.md`](./ai/prompt-library.md)

---

## 🚀 Quick Start para desarrolladores humanos

1. Leer [`design/component-specs.md`](./design/component-specs.md) — patrones de las 4 pantallas de referencia
2. Leer [`coding/conventions.md`](./coding/conventions.md) — checklist de implementación
3. Verificar estado del módulo en [`architecture/module-status.md`](./architecture/module-status.md)
4. Leer el contrato BE en [`api/modules/[modulo].md`](./api/modules/)
5. Implementar siguiendo [`examples/feature-template.md`](./examples/feature-template.md)

---

## 🎨 Referencias de Estilo (Golden Standard)

| Pantalla | Ruta | Componente |
|---|---|---|
| Gestión de Transportistas | `/carriers` | `carrier-management.component` |
| Gestión de Ubicaciones Físicas | `/layout` | `layout-management.component` |
| Torre de Control | `/dashboard` | `dashboard.*` |
| Topología Cromática | `/layout` (grid view) | FSM color map |

---

## 📐 Principios de Diseño

1. **Consistencia sobre creatividad** — nuevas pantallas siguen los patrones establecidos
2. **Dark mode siempre** — ningún componente se entrega sin `:host-context(.theme-dark)`
3. **Glassmorphism sutil** — `backdrop-filter: blur(20px)` en todas las tarjetas principales
4. **Gold es el acento** — CTAs, foco, headers, labels de sección → siempre dorado
5. **Navy es la estructura** — botones primarios, headers de página → siempre navy
6. **Responsive desde el inicio** — 1200px → 1050px → 720px

---

## 🔗 Archivos clave del proyecto

| Archivo | Propósito |
|---|---|
| [`styles/themes/_dark.scss`](../apps/admin-console/src/styles/themes/_dark.scss) | Tokens light + dark |
| [`styles/abstracts/_variables.scss`](../apps/admin-console/src/styles/abstracts/_variables.scss) | Variables SCSS base |
| [`app/app.routes.ts`](../apps/admin-console/src/app/app.routes.ts) | Todas las rutas |
| [`carrier-management.component.css`](../apps/admin-console/src/app/features/admin/carriers/carrier-management/carrier-management.component.css) | Referencia de estilos |
| [`libs/shared-core/src/index.ts`](../libs/shared-core/src/index.ts) | Exports de @4guard/shared-core |
