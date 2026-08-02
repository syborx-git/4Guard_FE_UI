# 4GUARD WMS — Estado de Módulos del Sistema

> **Actualizar este archivo** cada vez que se complete, inicie o modifique un módulo.  
> Es la fuente de verdad sobre qué existe, qué está en progreso y qué falta.

---

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Completo y homologado al design system |
| 🔶 | Existe pero necesita homologar al design system |
| 🔧 | En desarrollo activo |
| ⬜ | Pendiente de implementar |

---

## Admin Console — Pantallas de Gestión

| Módulo | Ruta | Estado | Componente principal | Notas |
|---|---|---|---|---|
| **Transportistas** | `/carriers` | ✅ | `carrier-management` | Pantalla de referencia dorada |
| **Ubicaciones Físicas** | `/layout` | ✅ | `layout-management` | Topología Cromática incluida |
| **Usuarios** | `/users` | ✅ | `users-list` | Con auditoría y reset password |
| **Sucursales** | `/branches` | 🔶 | `branches` | Verificar homologación visual |
| **Dashboard / Torre de Control** | `/dashboard` | 🔶 | `dashboard` | KPIs en tiempo real |
| **Proveedores** | `/suppliers` | 🔶 | (verificar) | HU-125, con paginación BE |
| **Organizaciones** | `/organizations` | ⬜ | — | Multi-tenant admin |
| **Clientes** | `/clients` | 🔶 | (verificar) | Dueños de inventario |
| **Roles y Permisos** | `/roles` | 🔶 | (verificar) | RBAC admin |
| **SKUs / Catálogo** | `/product-skus` | ⬜ | — | Catálogo de productos |
| **Secciones de Almacén** | `/sections` | ⬜ | — | Áreas del almacén |
| **Inventario** | `/inventory` | 🔶 | (verificar) | Epic 3 |
| **Recepción** | `/receiving` | 🔶 | (verificar) | Epic 2 |
| **Control de Calidad** | `/quality` | 🔶 | (verificar) | Epic 2 |
| **Despacho** | `/shipping` | ⬜ | — | Epic 4 |
| **Rendimiento** | `/performance` | ⬜ | — | HU-138 |
| **Turnos** | `/shifts` | ✅ | `shift-management` | HU-140 con spec `docs/api/modules/shifts.md` |
| **Sesiones Activas** | `/sessions` | ✅ | `active-sessions` | Con monitor en tiempo real |
| **Actividad de Usuario** | `/user-activity` | ✅ | `user-activity-report` | HU-146 completo y conectado a API |
| **Motor de Reglas** | `/business-rules` | ⬜ | — | HU-131 |
| **Divisas** | `/currency-exchange` | ⬜ | — | HU-148 |
| **Alertas** | `/alerts-config` | ✅ | `alerts-config-management` | HU-134 completo y conectado a API /api/v1/alerts-config |
| **Licencias** | `/license-management` | ⬜ | — | HU-139 |

---

## Pantallas de Referencia (Golden Standard)

Cuando crees un nuevo módulo, homológalo con estas 2 pantallas:

| Pantalla | Ruta del componente | Por qué es referencia |
|---|---|---|
| Gestión de Transportistas | `features/admin/carriers/carrier-management/` | Variables locales, dark mode, split view, KPI cards, badges |
| Configuración de Alertas | `features/alerts-config/alerts-config-management/` | Golden Standard: Live Toast Signals, Multi-tenant JWT, auditoría diff real y canales V1 |
| Gestión de Ubicaciones | `features/layout/layout-management/` | Árbol jerárquico, FSM colors, ocupación panel |

---

## Instrucción para IA

> Antes de implementar cualquier módulo, **verificar su estado en esta tabla**.
> - Si está ✅: No recrear, solo modificar si hay un bug o requerimiento nuevo.
> - Si está 🔶: Homologar visualmente al design system sin cambiar la lógica.
> - Si está ⬜: Implementar desde cero con el feature-template.md.
> - Si está 🔧: Preguntar al usuario antes de continuar.
