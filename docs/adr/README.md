# 🏛️ Architecture Decision Records (ADR) — 4GUARD WMS

> Registros inmutables de decisiones arquitectónicas y técnicas para garantizar coherencia, trazabilidad e impedir rediscusiones repetitivas.

---

## 📌 Guía de Uso

1. **Antes de proponer un cambio estructural:** Revisa esta lista para asegurarte de que no contradice un ADR existente.
2. **Si requieres proponer una nueva decisión:** Copia [`template.md`](./template.md), numéralo en secuencia (ej. `ADR-016-nombre.md`) y solicita revisión del equipo.

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
| **ADR-012** | Arquitectura Offline-First, Protocolo Zone Lease, Impresión ZPL y UX Industrial para Terminal RF PWA | ✅ Aceptado | 2026-09 | RF Terminal / PWA / Hardware | [`ADR-012-rf-terminal-pwa-offline-first.md`](./ADR-012-rf-terminal-pwa-offline-first.md) |
| **ADR-013** | Estándar Universal de Homologación de Componentes de UI (Data Tables, Selects Dinámicos, Datepickers, Modales y Hero Header) | ✅ Aceptado | 2026-09 | Design System / UI Standards | [`ADR-013-homologacion-componentes-ui.md`](./ADR-013-homologacion-componentes-ui.md) |
| **ADR-014** | Arquitectura Backend Hexagonal (Ports & Adapters), Aislamiento Multi-tenant por Organización y Motor de Auditoría con Deltas | ✅ Aceptado | 2026-09 | Backend Architecture / DDD | [`ADR-014-arquitectura-backend-hexagonal-multitenant-audit.md`](./ADR-014-arquitectura-backend-hexagonal-multitenant-audit.md) |
| **ADR-015** | Motor Documental para Generación de Boletas de Recepción, Traspasos, Despachos Outbound y Códigos Industriales (PDF & ZPL) | ✅ Aceptado | 2026-09 | Export Engine / Hardware | [`ADR-015-motor-documental-pdf-zpl-export.md`](./ADR-015-motor-documental-pdf-zpl-export.md) |
| **ADR-016** | Despacho Multi-Producto, Manifiesto Acumulativo de Tarimas (UAs) y Trazabilidad de Ciclo de Vida en Salidas | ✅ Aceptado | 2026-09 | Outbound / Inventory | [`ADR-016-outbound-multiproduct-pallet-traceability-and-lifecycle.md`](./ADR-016-outbound-multiproduct-pallet-traceability-and-lifecycle.md) |
| **ADR-017** | Centro de Control Bimodal de Caseta de Seguridad y Auto-Registro QR Chofer | ✅ Aceptado | 2026-09 | Security Gate / Mobile PWA | [`ADR-017-bimodal-security-gate-qr-driver-self-registration.md`](./ADR-017-bimodal-security-gate-qr-driver-self-registration.md) |
| **ADR-018** | Homologación del Ciclo de Salida (Check-Out) en Caseta y Formato Oficial F01-PO-CP-7.1.3-03 | ✅ Aceptado | 2026-09 | Security Gate / Compliance | [`ADR-018-security-gate-checkout-and-f01-transport-checklist-homologation.md`](./ADR-018-security-gate-checkout-and-f01-transport-checklist-homologation.md) |
| **ADR-019** | Flujo Operativo Integral Unificado de Salidas de Almacén (Carga / Despacho Outbound), Mesa de Control WMS y Check-Out en Caseta | ✅ Aceptado | 2026-09 | Outbound / Security Gate | [`ADR-019-flujo-integral-salidas-almacen-caseta-y-despacho.md`](./ADR-019-flujo-integral-salidas-almacen-caseta-y-despacho.md) |
| **ADR-020** | Flujo Operativo Integral Unificado de Recepción de Almacén (Descarga / Inbound), Mesa de Control WMS y Check-Out en Caseta | ✅ Aceptado | 2026-09 | Inbound / Security Gate | [`ADR-020-flujo-integral-recepcion-almacen-caseta-y-descarga.md`](./ADR-020-flujo-integral-recepcion-almacen-caseta-y-descarga.md) |