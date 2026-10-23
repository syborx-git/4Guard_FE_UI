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

| Módulo | Ruta | Estado | Componente principal | Documento SDD | Notas |
|---|---|---|---|---|---|
| **Transportistas** | `/carriers` | ✅ | `carrier-management` | [`carrier-management.sdd.md`](../sdd/carrier-management.sdd.md) | Pantalla de referencia dorada (ADR-013) |
| **Configuración de Alertas** | `/alerts-config` | ✅ | `alerts-config-management` | [`alerts-config.sdd.md`](../sdd/alerts-config.sdd.md) | Golden Standard: multicanal, live preview, diffs |
| **Ubicaciones Físicas** | `/layout` | ✅ | `layout-management` | [`layout-management.sdd.md`](../sdd/layout-management.sdd.md) | Árbol jerárquico y Topología Cromática FSM |
| **Usuarios** | `/users` | ✅ | `users-list` | [`user-management.sdd.md`](../sdd/user-management.sdd.md) | RBAC, auditoría forense, reset password |
| **Clientes Depositantes** | `/clients` | ✅ | `client-management` | [`clients-management.sdd.md`](../sdd/clients-management.sdd.md) | Multi-bodega, matriz de contactos y deltas |
| **Montacarguistas** | `/forklift-operators`| ✅ | `forklift-operators` | [`forklift-operators.sdd.md`](../sdd/forklift-operators.sdd.md) | Certificaciones DC-3 y turnos asignados |
| **Turnos y Horarios** | `/shifts` | ✅ | `shift-management` | [`shift-management.sdd.md`](../sdd/shift-management.sdd.md) | Jornadas, descansos y validación horaria |
| **Sucursales y CEDIS** | `/branches` | ✅ | `branch-management` | [`branch-management.sdd.md`](../sdd/branch-management.sdd.md) | Geocercas, capacidad instalada y andenes |
| **Proveedores** | `/suppliers` | ✅ | `supplier-management` | [`supplier-management.sdd.md`](../sdd/supplier-management.sdd.md) | Catálogo comercial, RFC SAT y contactos |
| **Roles y Permisos** | `/roles` | ✅ | `role-management` | [`role-management.sdd.md`](../sdd/role-management.sdd.md) | Matriz RBAC, claims atómicos por módulo |
| **Licencias WMS** | `/licenses` | ✅ | `license-management` | [`license-management.sdd.md`](../sdd/license-management.sdd.md) | HU-139, validación criptográfica y cuotas RF |
| **Divisas y Paridades** | `/currency-exchange` | ✅ | `currency-exchange-management`| [`currency-exchange.sdd.md`](../sdd/currency-exchange.sdd.md) | HU-148, Banxico SIE REST en vivo y cálculo inverso |
| **Movimientos de Almacén** | `/warehouse-movements` | 🔧 | `warehouse-movements-shell` | [`warehouse-receiving.sdd.md`](../sdd/warehouse-receiving.sdd.md) | Recepción, Traspasos y Despacho Outbound |
| **Dashboard / Torre de Control** | `/dashboard` | 🔶 | `dashboard` | — | KPIs en tiempo real |
| **SKUs / Catálogo** | `/product-skus` | ⬜ | — | — | Catálogo maestro de productos |
| **Secciones de Almacén** | `/sections` | ⬜ | — | — | Áreas físicas secundarias |
| **Organizaciones** | `/organizations` | ⬜ | — | — | Multi-tenant admin raíz |

---

## Pantallas de Referencia (Golden Standard)

Cuando crees un nuevo módulo, homológalo con estas pantallas:

| Pantalla | Ruta del componente | Por qué es referencia |
|---|---|---|
| Gestión de Transportistas | `features/admin/carriers/carrier-management/` | Variables locales, dark mode, split view, KPI cards, badges |
| Configuración de Alertas | `features/alerts-config/alerts-config-management/` | Golden Standard: Live Toast Signals, Multi-tenant JWT, auditoría diff real y canales V1 |
| Turnos y Horarios | `features/admin/shifts/shift-management/` | Hero Header con retorno `/admin`, selectores y matriz de días |
| Gestión de Ubicaciones | `features/layout/layout-management/` | Árbol jerárquico, FSM colors, ocupación panel |
| Divisas y Tipos de Cambio | `features/currency-exchange/currency-exchange-management/` | Integración API externa Banxico Live, tablas financieras y drawer de auditoría |

---

## Instrucción para IA

> Antes de implementar cualquier módulo, **verificar su estado en esta tabla**.
> - Si está ✅: No recrear, solo modificar si hay un bug o requerimiento nuevo.
> - Si está 🔶: Homologar visualmente al design system sin cambiar la lógica.
> - Si está ⬜: Implementar desde cero con el feature-template.md y el SDD correspondiente.
> - Si está 🔧: Preguntar al usuario antes de continuar.
