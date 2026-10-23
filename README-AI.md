# 🤖 4GUARD WMS — Guía de Desarrollo Asistido por IA & SDD (Nivel 5)

> **Manual Operativo Oficial:** Este documento explica cómo está configurada la arquitectura de IA del proyecto y cuál es el flujo de trabajo paso a paso que **humanos y asistentes de IA** deben seguir para crear o modificar cualquier módulo o funcionalidad.

---

## 🏛️ 1. ¿Cómo está integrado nuestro ecosistema?

Nuestro proyecto opera bajo la metodología **Spec-Driven Development (SDD) Nivel 5 (Ecosistema Autónomo)**. El sistema se compone de 5 capas integradas:

```
4Guard_FE_UI/
│
├── 🧠 1. DIRECTIVAS & PROMPTS ────────► docs/ai/context.md & prompt-library.md
│   (Reglas globales de diseño Gold/Navy, Signals, 0-Mocks y plantillas de prompts)
│
├── 🏛️ 2. DECISIONES ARQUITECTÓNICAS ─► docs/adr/ (ADR-001 al ADR-010 en estándar MADR)
│   (Reglas inmutables: Nx Monorepo, Standalone, Signals, Cero Mocks, Theme Engine)
│
├── 🎨 3. PATRONES & AUTO-INFERENCIA ──► docs/patterns/ (5 Patrones Maestros + Motor IA)
│   (Split View, Dashboard Bento, Audit Drawer, Wizard Multi-Paso, Topología FSM)
│
├── 🔌 4. CONTRATOS API REALES ────────► docs/api/modules/ (Especificación del Backend)
│   (Formatos ApiResponse<T>, DTOs, UUIDs e ISO-8601 UTC sin datos simulados)
│
└── 🛡️ 5. AUDITORÍA & QUALITY GATES ──► scripts/sdd-linter.js & docs/ai/reviewer.md
    (Script npm run sdd:review, AI Reviewer Prompt y GitHub Pull Request Template)
```

---

## 🚀 2. Flujo de Trabajo Paso a Paso para Crear o Modificar un Módulo

Cada vez que vayas a construir una nueva pantalla, User Story (HU) o funcionalidad, **debes seguir estrictamente estos 7 pasos**:

```
[Paso 1: Especificar Contrato] ──► [Paso 2: Registrar en Matriz] ──► [Paso 3: Auto-Detectar Patrón]
                                                                                │
[Paso 6: Auditar con AI Reviewer] ◄── [Paso 5: Correr Linter npm] ◄── [Paso 4: Generar Código IA]
               │
               ▼
[Paso 7: Actualizar Matriz & Abrir PR GitHub] ──► 🟢 LISTO PARA PRODUCCIÓN
```

---

### 📌 Paso 1: Especificar el Contrato API de Backend
- Revisa o crea el archivo de especificación en `docs/api/modules/[nombre-modulo].md`.
- Define los endpoints HTTP (`GET`, `POST`, `PUT`, `DELETE`), query params y la interfaz DTO.
- *Regla Obligatoria (ADR-007):* Todo módulo consumirá datos reales de la BD vía HTTP.

---

### 📌 Paso 2: Registrar el Módulo en la Matriz de Estado
- Abre `docs/architecture/module-status.md`.
- Cambia o agrega el módulo con el estado `🔧 En Desarrollo`.

---

### 📌 Paso 3: Selección o Auto-Detección del Patrón UI
- Consulta la matriz en `docs/patterns/README.md`.
- **Si ya sabes qué patrón usar:** Elige uno de los 5 patrones masters:
  - `split-view-master-detail.md` (CRUDs estándar 30/70)
  - `dashboard-kpi-bento.md` (Torres de control y Bento Grid)
  - `audit-log-drawer.md` (Trazabilidad y Diffs JSON)
  - `wizard-multi-step.md` (Asistente secuencial multi-paso)
  - `fsm-chromatic-grid.md` (Visualización de estados cromáticos)
- **Si NO sabes qué patrón usar:** No te preocupes. La IA leerá la intención de tu requerimiento y **auto-seleccionará el patrón adecuado** por ti.

---

### 📌 Paso 4: Generar Código con Prompts Homologados
- Copia la plantilla correspondiente de `docs/ai/prompt-library.md` o solicita a la IA:
  ```text
  "Crea la pantalla para el módulo [Nombre] siguiendo las especificaciones de docs/api/modules/[nombre].md y aplicando el patrón de docs/patterns/[patron].md"
  ```
- La IA generará:
  - Componente Standalone (`standalone: true`).
  - Reactividad con Signals (`signal()`, `computed()`).
  - Estilos encapsulados con paleta Gold/Navy y Dark Mode (`:host-context(.theme-dark)`).
  - Servicio HTTP conectado al Backend con `ToastService` para manejo de errores.

---

### 📌 Paso 5: Ejecutar la Auditoría Linter Local (Script Físico)
En tu consola o terminal, ejecuta el script de verificación del SDD:

```bash
npm run sdd:review
```

- **Si lanza 🔴 ERRORES CRÍTICOS:** Revisa el reporte en consola y corrige la presencia de arreglos `MOCK_*` o componentes no-standalone.
- **Si responde 🟢 AUDITORÍA IMPECABLE:** Avanza al siguiente paso.

---

### 📌 Paso 6: Solicitar Auditoría al AI Reviewer
Pídele a la IA en el chat:

```text
"Ejecuta el AI Reviewer para auditar el módulo [Nombre]"
```

La IA ejecutará el protocolo de `docs/ai/reviewer.md` evaluando los **10 Puntos Dorados de Calidad** y te entregará el reporte `🟢 APPROVED` o `🔴 REJECTED`.

---

### 📌 Paso 7: Actualizar Matriz y Crear Pull Request
1. Actualiza `docs/architecture/module-status.md` marcando el módulo como `✅ Completo`.
2. Al abrir el PR en GitHub, la plantilla `.github/PULL_REQUEST_TEMPLATE.md` se cargará automáticamente. Marca todos los checkboxes de la auditoría y adjunta las capturas en modo claro y oscuro.

---

## 🛠️ Comandos Útiles

| Comando | Acción |
|---|---|
| `npm run sdd:review` | Ejecuta la auditoría estática del AI Reviewer sobre todo el proyecto. |
| `npm run start:admin:dev` | Inicia el servidor de desarrollo local de la Consola de Administración. |
| `npm run build:admin` | Compila el bundle de producción para validación de tipos Angular. |

---

## 💡 Cheatsheet de Prompts para la IA

### 1. Crear nuevo módulo:
> *"Analiza la spec de `docs/api/modules/[modulo].md` y genera el módulo Standalone en `apps/admin-console/src/app/features/[modulo]/` aplicando Signals, consumo real de BD y soporte Dark Mode."*

### 2. Homologar pantalla existente:
> *"Homologa la pantalla [Nombre] según el Design System de `docs/design/design-system.md` con la paleta Midnight Navy / Prestige Gold y agrégale el botón de retorno `← Administrar`."*

### 3. Auditar antes de PR:
> *"Ejecuta el AI Reviewer según `docs/ai/reviewer.md` sobre los archivos modificados y entrega el reporte de auditoría."*
