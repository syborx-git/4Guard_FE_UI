# 4GUARD WMS — Specs de Componentes por Pantalla

> Referencia homologada de los patrones visuales y estructurales de las 4 pantallas de referencia del sistema.

---

## 1. Gestión de Transportistas (`/carriers`)

**HU-128 | Componente:** `carrier-management.component`

### Layout Pattern: Split View (30% / 70%)

```
┌──────────────────────────────────────────────────────────┐
│  HEADER: Icon + Eyebrow + Title + Subtitle + Actions     │
├──────────────────────────────────────────────────────────┤
│  KPI CARDS GRID (4 columnas)                             │
│  [Total] [Activos] [Suspendidos] [Inactivos]             │
├──────────────┬───────────────────────────────────────────┤
│  DIRECTORIO  │  DETALLE / FORMULARIO                     │
│  (320px fix) │  (flex: 1)                                │
│              │                                           │
│  [Search]    │  Form Header (sticky top)                 │
│  [Filters]   │  ─────────────────────────                │
│  ─────────── │  Section 1: Identidad Legal               │
│  Carrier 1 ● │  Section 2: Datos de Operación            │
│  Carrier 2   │  Section 3: Servicios (checkboxes)        │
│  Carrier 3   │  Section 4: Auditoría (readonly)          │
│  ─────────── │  ─────────────────────────                │
│  Footer:     │  Form Actions (sticky bottom)             │
│  N results   │  [Status Btn] [Cancel] [Save]             │
└──────────────┴───────────────────────────────────────────┘
```

### Variables Locales del Componente

```css
:host {
  --navy:        #172033;
  --navy-mid:    #25324a;
  --gold:        #c5a86b;
  --gold-light:  #e0c87a;
  --gold-bg:     rgba(197, 168, 107, 0.10);
  --gold-border: rgba(197, 168, 107, 0.28);
  --bg-page:     #f5f4f0;
  --bg-card:     rgba(255, 255, 255, 0.92);
  --radius-card: 18px;
  --radius-input:10px;
  --radius-badge:99px;
  --radius-btn:  10px;
}
```

### Spec: Header de Pantalla

```
┌─────────────────────────────────────────────┐
│ [Icon 54x54 Navy Gradient]                  │
│   [HU-128] · GESTIÓN WMS · ≡ (eyebrow)      │
│   Gestión de Transportistas  (h1: 1.7rem)   │
│   Registro y control de...   (subtitle)     │
└─────────────────────────────────────────────┘
```

- **Icon Wrap:** `54×54px`, `border-radius: 14px`, `bg: linear-gradient(145deg, #172033, #25324a)`, `box-shadow: 0 8px 20px rgba(23,32,51,0.22)`
- **Eyebrow:** `0.68rem`, `700 weight`, `0.06em spacing`, `uppercase`, color `#9b7626` (gold texto)
- **Eyebrow Tag:** `font-mono`, gold-bg, gold-border, `border-radius: 5px`, `padding: 1px 7px`
- **Título:** `Outfit/Inter`, `1.7rem`, `weight 500`, `letter-spacing: -0.025em`

### Spec: KPI Cards

```css
.kpi-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.95rem 1.1rem;
  border: 1px solid var(--border-card);
  border-radius: 14px;
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  transition: transform 0.15s, box-shadow 0.15s;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 40px rgba(36,44,58,0.12);
}

/* Value */
font-family: Outfit; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.04em;

/* Label */
font-size: 0.7rem; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase;

/* Bottom bar: 3px de color semántico */
```

### Spec: Carrier Item (Lista)

```css
.carrier-item {
  padding: 0.75rem 1rem;
  border-left: 3px solid transparent;
  /* Hover: gold-bg muy sutil */
  /* Selected: gold-bg + border-left: gold */
}

/* Avatar: 38px circle, gradiente por tipo */
.avatar--external: linear-gradient(135deg, #172033, #25324a)
.avatar--client:   linear-gradient(135deg, #1e6e8c, #2490b5)
.avatar--own:      linear-gradient(135deg, #c5a86b, #a47c24)
.avatar--3pl:      linear-gradient(135deg, #5a3e8a, #7952b3)
.avatar--parcel:   linear-gradient(135deg, #208457, #29a86d)
```

### Spec: Status Badges

```css
/* Active */   color: #208457; bg: rgba(32,132,87,0.09);  border: rgba(32,132,87,0.20)
/* Suspended */color: #c07520; bg: rgba(192,117,32,0.09); border: rgba(192,117,32,0.22)
/* Inactive */ color: #6f7785; bg: rgba(111,119,133,0.09);border: rgba(111,119,133,0.14)
/* All badges: border-radius: 99px, font-size: 0.65rem, weight: 700 */
```

### Dark Mode

```css
:host-context(.theme-dark) {
  --bg-page:        #0d0b12;
  --bg-card:        rgba(33, 29, 42, 0.90);
  --border-card:    rgba(255,255,255,0.07);
  --text-primary:   #eceaf1;
  --text-gold:      #d6b667;
  --gold-bg:        rgba(214, 182, 103, 0.08);
  --gold-border:    rgba(214, 182, 103, 0.20);
}
```

---

## 2. Gestión de Ubicaciones Físicas (`/layout`)

**HU-127 | Componente:** `layout-management.component`

### Layout Pattern: Tree Explorer + Editor (35% / 65%)

```
┌──────────────────────────────────────────────────────────┐
│  HEADER (idéntico al de Transportistas)                  │
├──────────────────────────────────────────────────────────┤
│  KPI CARDS (Total / Activas / Bloqueadas / Mantenimiento)│
├──────────────┬───────────────────────────────────────────┤
│  EXPLORADOR  │  EDITOR / FORMULARIO                      │
│  (340px fix) │  (flex: 1)                                │
│              │                                           │
│  [Search]    │  Form Header (sticky, blurred)            │
│  [Filters]   │  [Tag] [Title] [Code chip] [Status chip]  │
│  ─────────── │  ─────────────────────────────────────    │
│  ▶ ZONA A    │  Section: Datos Generales                 │
│    ▶ Pasillo │  Section: Dimensiones & Capacidad         │
│      └ Bay   │  Section: Ocupación (bar chart inline)    │
│        └ Ub  │  Section: Acciones FSM                    │
│  ─────────── │  Section: Auditoría / Timeline            │
│  Footer      │  ─────────────────────────────────────    │
└──────────────┴───────────────────────────────────────────┘
```

### Spec: Árbol Jerárquico

```css
/* Zona (nivel 0) */
.lm-tree-node--zone {
  font-weight: 700;
  font-size: 0.82rem;
  text-transform: uppercase;
  color: var(--navy);
  border-top: 1px solid rgba(76,86,105,0.06);
}

/* Ícono zona: color gold */
/* Pasillo (nivel 1): text-secondary, 0.78rem */
/* Bay (nivel 2): text-muted, 0.75rem */
/* Ubicación (leaf): border-left: 3px gold cuando selected */

/* Dot de estado en leaf */
.lm-leaf-dot--active:      background: var(--c-success)
.lm-leaf-dot--blocked:     background: var(--c-danger)
.lm-leaf-dot--maintenance: background: var(--c-warning)
.lm-leaf-dot--inactive:    background: var(--c-inactive)
```

### Spec: Status Chips en Editor

```css
.status--active      { color: #208457; bg: rgba(32,132,87,0.09);   border: rgba(32,132,87,0.20)   }
.status--blocked     { color: #c84949; bg: rgba(200,73,73,0.09);   border: rgba(200,73,73,0.20)   }
.status--maintenance { color: #a96b13; bg: rgba(213,145,39,0.10);  border: rgba(213,145,39,0.22)  }
.status--inactive    { color: #6f7785; bg: rgba(111,119,133,0.09); border: rgba(111,119,133,0.18) }
```

### Spec: Panel de Ocupación

```css
.lm-occupancy-panel {
  padding: 1rem;
  border: 1px solid var(--border-card);
  border-radius: 12px;
  background: rgba(255,255,255,0.6);
}

/* Bar de ocupación */
.lm-occ-bar        { height: 5px; background: rgba(88,98,116,0.12); border-radius: 99px; }
.lm-occ-bar__fill  { background: var(--c-success); transition: width 0.4s ease; }

/* Colores según umbral */
.occ--ok:       color: var(--c-success)  /* < 80% */
.occ--warning:  color: var(--c-warning)  /* 80-95% */
.occ--critical: color: var(--c-danger)   /* > 95% */
```

---

## 3. Torre de Control (`/dashboard`)

> Vista de KPIs de alto nivel con indicadores en tiempo real.

### Layout Pattern: Bento Grid

```
┌───────────────────────────────────────────────────┐
│  Inventario   │  Ubicaciones  │  Recepción hoy    │
├───────────────┴───────────────┴───────────────────┤
│  Alertas activas (ancho completo)                 │
├───────────────┬───────────────────────────────────┤
│  Pedidos      │  Gráfico de tendencia             │
│  Pendientes   │                                   │
└───────────────┴───────────────────────────────────┘
```

### Indicador Live

```css
.live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #3dbb6c;
  animation: pulseSoft 2s infinite;
}
```

---

## 4. Topología Cromática (`/layout` — Vista Grid Cromática)

> Visualización del mapa de ubicaciones del almacén con código de color FSM.

### Concepto

Cada ubicación es una celda en un grid 2D. El color de la celda representa su estado FSM actual. El usuario puede ver de un vistazo el estado del almacén completo.

### Paleta Cromática por Estado FSM

| Estado | Color Celda | Borde |
|---|---|---|
| **Disponible (60)** | `rgba(76,175,80,0.15)` | `rgba(76,175,80,0.35)` |
| **Activo/Ocupado (30)** | `rgba(102,187,106,0.10)` | `rgba(102,187,106,0.30)` |
| **En proceso (20)** | `rgba(255,167,38,0.12)` | `rgba(255,167,38,0.30)` |
| **Bloqueado (70)** | `rgba(239,83,80,0.12)` | `rgba(239,83,80,0.35)` |
| **Mantenimiento (50)** | `rgba(255,138,101,0.12)` | `rgba(255,138,101,0.25)` |
| **Inactivo (80)** | `rgba(149,142,152,0.08)` | `$border-subtle` |

### Grid de Topología

```css
.topology-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 4px;
}

.topology-cell {
  aspect-ratio: 1;
  border-radius: 6px;
  border: 1px solid;
  transition: transform 0.12s, box-shadow 0.12s;
  cursor: pointer;
}

.topology-cell:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 10;
}
```

---

## 📋 Resumen de Patrones Transversales

### Patrón: Header de Pantalla Golden Standard (Hero Header con Retorno a Administrar)

Todas las pantallas de gestión y monitoreo implementan el **Header de Pantalla Golden Standard** oficial:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ [Icon Box Navy 52x52]  [ ← ADMINISTRACIÓN WMS ] · CATEGORÍA DEL MÓDULO            │
│                        Título de la Pantalla (h1: 1.7rem - 2.1rem)               │
│                        Subtítulo descriptivo de la operación (0.84rem)           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Estructura HTML Estándar
```html
<header class="hero-header">
  <!-- 1. Ícono Navy Rectangular Redondeado (52x52px) -->
  <div class="hero-header__icon-box">
    <span class="material-symbols-outlined">domain</span>
  </div>

  <!-- 2. Contenido Principal -->
  <div class="hero-header__content">
    <!-- Breadcrumb: Botón Badge de Retorno + Categoría -->
    <div class="hero-header__breadcrumb">
      <a routerLink="/admin" class="btn-back-admin" title="Regresar al Hub de Administración">
        <span class="back-arrow">←</span> ADMINISTRACIÓN WMS
      </a>
      <span class="breadcrumb-dot">·</span>
      <span class="hero-header__eyebrow">ESTRUCTURA DE ALMACÉN</span>
    </div>

    <!-- Título Principal & Subtítulo -->
    <h1 class="hero-header__title">Gestión de Sucursales</h1>
    <p class="hero-header__subtitle">Administra los centros logísticos, bodegas físicas y sucursales operativas</p>
  </div>
</header>
```

#### Estilos CSS Estándar
```css
.hero-header {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  margin-bottom: 1.75rem;
}

.hero-header__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 14px;
  background: #172033;
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(23, 32, 51, 0.15);
}

.btn-back-admin {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.65rem;
  border: 1px solid rgba(197, 168, 107, 0.38);
  border-radius: 7px;
  background: rgba(197, 168, 107, 0.09);
  color: #b58b37;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  transition: all 180ms ease;
}

.btn-back-admin:hover {
  background: rgba(197, 168, 107, 0.2);
  color: #8c671b;
  border-color: rgba(197, 168, 107, 0.6);
  transform: translateX(-2px);
}
```

### Patrón: Diálogo de Confirmación Homologado (`ConfirmDialogComponent`)

Queda **estrictamente prohibido** utilizar `window.confirm()` o `window.alert()` del navegador. Todo flujo destructivo (eliminar, revocar, suspender, cambiar estado) DEBE usar el componente `<fg-confirm-dialog>`:

```html
@if (targetItem(); as item) {
  <fg-confirm-dialog
    [title]="'Revocar Sesión Activa'"
    [message]="'¿Estás seguro de que deseas revocar la sesión de ' + item.name + '?'"
    [confirmLabel]="'Revocar Sesión'"
    [isLoading]="isProcessing()"
    (confirmed)="confirmAction()"
    (cancelled)="cancelAction()"
  ></fg-confirm-dialog>
}
```

### Patrón: Form Section

```css
.section-legend {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-gold);  /* #9b7626 light / #d6b667 dark */
  margin-bottom: 1.1rem;
}
```

### Patrón: Empty State

```
[Icon Wrap 72x72 gold gradient border]
[Title: font-display 1.15rem]
[Desc: 0.84rem secondary max-width 320px]
```

### Patrón: Form Inputs

```css
/* Height estándar: 40px */
.form-input {
  border: 1px solid rgba(88,98,116,0.18);
  border-radius: 10px;
  background: rgba(255,255,255,0.85);
  font-size: 0.85rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus {
  border-color: var(--gold);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(197,168,107,0.12);
}
```

### Patrón: Botones

| Variante | Descripción |
|---|---|
| `--primary` | Navy sólido, hover +translateY(-1px) |
| `--save` | Gold gradient, texto navy |
| `--ghost` | Transparente, borde sutil |
| `--success/warning/danger` | Semántico con bg sutil |

```css
.btn--primary {
  background: var(--navy);  /* #172033 */
  color: #fff;
  box-shadow: 0 6px 16px rgba(23,32,51,0.18);
}

.btn--save {
  background: linear-gradient(135deg, #d6ae3d, #edc74e);
  color: var(--navy);
  box-shadow: 0 6px 16px rgba(197,147,24,0.20);
}
```

### Patrón: RFC / Código Mono

```css
.rfc-chip {
  font-family: 'JetBrains Mono';
  font-size: 0.65rem;
  color: var(--text-gold);
  background: var(--gold-bg);
  border: 1px solid var(--gold-border);
  border-radius: 4px;
  padding: 1px 5px;
}
```

### Patrón: Sticky Header/Footer del Formulario

```css
.form-header {
  position: sticky; top: 0; z-index: 2;
  backdrop-filter: blur(10px);
  background: rgba(255,255,255,0.5);  /* light */
  /* dark: rgba(24,21,30,0.7) */
}

.form-footer {
  position: sticky; bottom: 0; z-index: 2;
  background: rgba(23,32,51,0.022);  /* light */
  /* dark: rgba(255,255,255,0.025) */
}
```
