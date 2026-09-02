# 🏛️ Architecture Decision Records (ADR) — 4GUARD WMS

> Registros inmutables de decisiones arquitectónicas y técnicas para garantizar coherencia, trazabilidad e impedir rediscusiones repetitivas.

---

## 📌 Guía de Uso

1. **Antes de proponer un cambio estructural:** Revisa esta lista para asegurarte de que no contradice un ADR existente.
2. **Si requieres proponer una nueva decisión:** Copia [`template.md`](./template.md), numéralo en secuencia (ej. `ADR-011-nombre.md`) y solicita revisión del equipo.

---

## 📋 Catálogo Maestro de Decisiones Arquitectónicas

| ID | Título | Estado | Fecha | Ámbito | Archivo |
|---|---|---|---|---|---|
| **ADR-001** | Arquitectura Nx Monorepo (`apps/` + `shared-core`) | ✅ Aceptado | 2026-07 | Arquitectura Monorepo | [`ADR-001-nx-monorepo.md`](./ADR-001-nx-monorepo.md) |
| **ADR-002** | Componentes Standalone (Eliminación de NgModules) | ✅ Aceptado | 2026-07 | Angular Core | [`ADR-002-standalone-components.md`](./ADR-002-standalone-components.md) |
| **ADR-003** | Synexia Theme Engine (`.theme-dark` / `.theme-light`) | ✅ Aceptado | 2026-07 | Design System / CSS | [`ADR-003-synexia-theme-engine.md`](./ADR-003-synexia-theme-engine.md) |
| **ADR-004** | Guard RBAC Centralizado basado en Rutas | ✅ Aceptado | 2026-07 | Seguridad & Router | [`ADR-004-rbac-guard.md`](./ADR-004-rbac-guard.md) |
| **ADR-005** | Encapsulamiento de Estilos per-Componente con Variables `:host` | ✅ Aceptado | 2026-07 | CSS / UI Components | [`ADR-005-component-isolated-styles.md`](./ADR-005-component-isolated-styles.md) |
| **ADR-006** | Angular Signals como Estándar de Estado Reactivo | ✅ Aceptado | 2026-07 | State Management | [`ADR-006-angular-signals-state.md`](./ADR-006-angular-signals-state.md) |
| **ADR-007** | Directiva Estricta Cero Mocks y Consumo BD Backend | ✅ Aceptado | 2026-07 | API & Data Integrity | [`ADR-007-zero-mock-database-rule.md`](./ADR-007-zero-mock-database-rule.md) |
| **ADR-008** | Estándar de Contratos API (`ApiResponse<T>`, UUID, ISO-8601 UTC) | ✅ Aceptado | 2026-07 | Backend Contracts | [`ADR-008-api-contracts-uuid-utc.md`](./ADR-008-api-contracts-uuid-utc.md) |
| **ADR-009** | Intercepción HTTP Transparente para Refresh Token JWT | ✅ Aceptado | 2026-07 | Auth & HTTP Client | [`ADR-009-http-auth-refresh-token.md`](./ADR-009-http-auth-refresh-token.md) |
| **ADR-010** | Adopción del Flujo Spec-Driven Development (SDD) | ✅ Aceptado | 2026-07 | Metodología & AI | [`ADR-010-spec-driven-development.md`](./ADR-010-spec-driven-development.md) |
| **ADR-011** | Consolidación de Navegación y Vistas Transaccionales en Movimientos | ✅ Aceptado | 2026-08 | Warehouse Movements | [`ADR-011-consolidacion-movimientos-almacen.md`](./ADR-011-consolidacion-movimientos-almacen.md) |