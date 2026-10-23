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

---

## 5. Normativa Contractual de Homologación por Componentes (ADR-013)

> **REGLA DE ORO:** Todo nuevo módulo o refactorización de pantalla en 4GUARD WMS DEBE cumplir de manera estricta con estas especificaciones para garantizar coherencia visual, accesibilidad y cero degradación estética entre temas (`.theme-dark` y `.theme-light`).

---

### 5.1 Data Table Homologada (`.table-container`, `.data-table`)

La tabla de datos de 4GUARD WMS está diseñada para ofrecer alta densidad informativa, legibilidad industrial y ordenamiento ágil sin sobrecargar la vista.

#### A) Estructura HTML Requerida
```html
<div class="table-container" role="region" aria-label="Tabla de Registros">
  <table class="data-table">
    <!-- 1. Cabecera con Columnas Ordenables -->
    <thead>
      <tr>
        <th class="sortable" (click)="sortBy('code')">
          <div class="th-content">
            <span>CÓDIGO</span>
            <span class="material-symbols-outlined sort-icon">
              {{ sortField === 'code' ? (sortAsc ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
            </span>
          </div>
        </th>
        <th class="sortable" (click)="sortBy('name')">
          <div class="th-content">
            <span>NOMBRE / DESCRIPCIÓN</span>
            <span class="material-symbols-outlined sort-icon">
              {{ sortField === 'name' ? (sortAsc ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}
            </span>
          </div>
        </th>
        <th>CATEGORÍA</th>
        <th class="td-center">ESTADO</th>
        <th class="td-actions">ACCIONES</th>
      </tr>
    </thead>

    <!-- 2. Cuerpo de la Tabla -->
    <tbody>
      <!-- Estado de Carga: Skeleton Rows -->
      @if (isLoading()) {
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <tr class="table-skeleton-row">
            <td><div class="skeleton-cell skeleton-cell--short"></div></td>
            <td><div class="skeleton-cell skeleton-cell--wide"></div></td>
            <td><div class="skeleton-cell"></div></td>
            <td class="td-center"><div class="skeleton-cell skeleton-cell--short" style="margin: 0 auto;"></div></td>
            <td class="td-actions"><div class="skeleton-cell skeleton-cell--short"></div></td>
          </tr>
        }
      } @else if (items().length === 0) {
        <!-- Estado Vacío -->
        <tr>
          <td colspan="5">
            <div class="table-empty">
              <span class="material-symbols-outlined">inbox</span>
              <p class="table-empty__title">No se encontraron registros</p>
              <p class="table-empty__desc">Prueba ajustando los filtros o añade un nuevo registro.</p>
            </div>
          </td>
        </tr>
      } @else {
        <!-- Filas de Datos -->
        @for (item of pagedItems(); track item.id) {
          <tr [class.is-selected]="selectedId() === item.id" (click)="selectItem(item)">
            <!-- Celda Monospace (Códigos, IDs, RFC) -->
            <td class="td-mono">{{ item.code }}</td>

            <!-- Celda Primaria -->
            <td class="td-primary">
              <span class="row-title">{{ item.name }}</span>
              <span class="row-subtitle">{{ item.subtitle }}</span>
            </td>

            <!-- Celda Estándar -->
            <td>{{ item.category }}</td>

            <!-- Celda de Estatus con Badge -->
            <td class="td-center">
              <span class="carrier-status-badge carrier-status-badge--{{ item.status.toLowerCase() }}">
                {{ item.statusLabel }}
              </span>
            </td>

            <!-- Celda de Acciones Rápidas -->
            <td class="td-actions" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="btn-icon"
                title="Editar registro"
                (click)="editItem(item)">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button
                type="button"
                class="btn-icon btn-icon--danger"
                title="Eliminar registro"
                (click)="deleteItem(item)">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </td>
          </tr>
        }
      }
    </tbody>
  </table>

  <!-- 3. Barra de Paginación Integrada -->
  <div class="table-pagination">
    <!-- Información de conteo -->
    <div class="pagination-info">
      Mostrando <strong>{{ pageStart() }}</strong> a <strong>{{ pageEnd() }}</strong> de <strong>{{ totalItems() }}</strong> registros
    </div>

    <!-- Controles de navegación y tamaño -->
    <div class="pagination-controls">
      <!-- Selector de Tamaño de Página -->
      <div class="pagination-size">
        <label for="page-size" class="sr-only">Filas por página</label>
        <select
          id="page-size"
          class="form-select pagination-size__select"
          [value]="pageSize()"
          (change)="onPageSizeChange($event)">
          <option [value]="10">10 / pág</option>
          <option [value]="25">25 / pág</option>
          <option [value]="50">50 / pág</option>
          <option [value]="100">100 / pág</option>
        </select>
      </div>

      <!-- Botón Página Anterior -->
      <button
        type="button"
        class="pagination-btn"
        [disabled]="currentPage() === 1"
        (click)="goToPage(currentPage() - 1)"
        aria-label="Página anterior">
        <span class="material-symbols-outlined">chevron_left</span>
      </button>

      <!-- Páginas Numeradas -->
      @for (page of visiblePages(); track page) {
        <button
          type="button"
          class="pagination-btn"
          [class.is-active]="currentPage() === page"
          (click)="goToPage(page)">
          {{ page }}
        </button>
      }

      <!-- Botón Página Siguiente -->
      <button
        type="button"
        class="pagination-btn"
        [disabled]="currentPage() === totalPages()"
        (click)="goToPage(currentPage() + 1)"
        aria-label="Página siguiente">
        <span class="material-symbols-outlined">chevron_right</span>
      </button>
    </div>
  </div>
</div>
```

#### B) Tokens CSS de la Tabla
```css
/* Altura de fila: 44px */
/* Cabecera: background: var(--bg-card); font-family: Outfit; font-size: 0.72rem; text-transform: uppercase; font-weight: 700 */
/* Hover de fila: background: rgba(197, 168, 107, 0.06) en light, rgba(214, 182, 103, 0.08) en dark */
/* Fila seleccionada: border-left: 3px solid var(--gold); background: rgba(197, 168, 107, 0.12) */
```

---

### 5.2 Selectores y Dropdowns Homologados (`.form-select`, `.fg-select-searchable`)

Los selectores deben presentar bordes precisos, flechas sutiles en SVG y anillo de foco dorado.

#### A) Selector Estándar (Single Select)
```html
<div class="form-group">
  <label for="select-branch" class="form-label form-label--required">Sucursal Operativa</label>
  <select
    id="select-branch"
    formControlName="branchId"
    class="form-select"
    [class.is-error]="branchControl.invalid && branchControl.touched">
    <option value="" disabled selected>Selecciona una sucursal…</option>
    @for (branch of branches(); track branch.id) {
      <option [value]="branch.id">{{ branch.code }} — {{ branch.name }}</option>
    }
  </select>
  @if (branchControl.invalid && branchControl.touched) {
    <span class="form-error">
      <span class="material-symbols-outlined">error</span>
      Debes seleccionar una sucursal válida
    </span>
  }
</div>
```

#### B) Searchable Select / Typeahead (Catálogos > 8 Elementos)
Para entidades como SKUs, Clientes u Operadores, se implementa el patrón con filtro instantáneo:
```html
<div class="fg-searchable-select" [class.is-open]="isDropdownOpen()">
  <!-- Input Visible con Icono -->
  <div class="fg-searchable-select__trigger" (click)="toggleDropdown()">
    <span class="material-symbols-outlined fg-searchable-select__icon">search</span>
    <input
      type="text"
      class="fg-searchable-select__input"
      [placeholder]="selectedLabel() || 'Buscar o seleccionar…'"
      [value]="searchTerm()"
      (input)="onSearchInput($event)"
      (focus)="openDropdown()"
    />
    <span class="material-symbols-outlined fg-searchable-select__chevron">expand_more</span>
  </div>

  <!-- Menú Flotante con Glassmorphism -->
  @if (isDropdownOpen()) {
    <ul class="fg-searchable-select__menu" role="listbox">
      @for (opt of filteredOptions(); track opt.value) {
        <li
          class="fg-searchable-select__option"
          [class.is-selected]="opt.value === selectedValue()"
          (click)="selectOption(opt)">
          <div class="option-content">
            <span class="option-code">{{ opt.code }}</span>
            <span class="option-label">{{ opt.label }}</span>
          </div>
          @if (opt.value === selectedValue()) {
            <span class="material-symbols-outlined option-check">check</span>
          }
        </li>
      }
      @if (filteredOptions().length === 0) {
        <li class="fg-searchable-select__empty">No hay coincidencias</li>
      }
    </ul>
  }
</div>
```

---

### 5.3 Datepicker Industrial y Selector de Rango (`.fg-datepicker`)

Toda captura de fechas DEBE usar formato `DD/MM/YYYY` en vista y emitir `ISO-8601 UTC` al backend.

#### A) Datepicker de Fecha Única
```html
<div class="form-group">
  <label for="input-expiration-date" class="form-label form-label--required">Fecha de Expiración</label>
  <div class="fg-datepicker-wrap">
    <span class="material-symbols-outlined fg-datepicker__icon">calendar_today</span>
    <input
      id="input-expiration-date"
      type="date"
      class="form-input fg-datepicker__input"
      formControlName="expirationDate"
      [min]="todayIsoString"
    />
  </div>
  <span class="form-hint">Formato legal: DD/MM/AAAA. Vigencia mínima requerida.</span>
</div>
```

#### B) Selector de Rango de Fechas con Chips de Acceso Rápido
```html
<div class="fg-daterange-container">
  <!-- Chips de Accesos Directos -->
  <div class="fg-daterange-chips">
    <button type="button" class="ce-chip" [class.ce-chip--active]="activeRangeChip() === 'TODAY'" (click)="setRangePreset('TODAY')">Hoy</button>
    <button type="button" class="ce-chip" [class.ce-chip--active]="activeRangeChip() === 'YESTERDAY'" (click)="setRangePreset('YESTERDAY')">Ayer</button>
    <button type="button" class="ce-chip" [class.ce-chip--active]="activeRangeChip() === 'LAST_7_DAYS'" (click)="setRangePreset('LAST_7_DAYS')">Últimos 7 días</button>
    <button type="button" class="ce-chip" [class.ce-chip--active]="activeRangeChip() === 'THIS_MONTH'" (click)="setRangePreset('THIS_MONTH')">Este mes</button>
  </div>

  <!-- Inputs Inicio / Fin -->
  <div class="fg-daterange-inputs">
    <div class="form-group">
      <label class="form-label" for="date-start">Fecha Inicial</label>
      <input id="date-start" type="date" class="form-input" [(ngModel)]="startDate" (change)="onRangeChange()" />
    </div>
    <span class="fg-daterange-sep">➔</span>
    <div class="form-group">
      <label class="form-label" for="date-end">Fecha Final</label>
      <input id="date-end" type="date" class="form-input" [(ngModel)]="endDate" (change)="onRangeChange()" />
    </div>
  </div>
</div>
```

---

### 5.4 Diálogos y Modales Desacoplados (`<fg-confirm-dialog>`, `.dialog`)

Para evitar recargas o envíos accidentales del formulario padre, los modales se declaran sin etiqueta `<form>` envolvente y controlan el evento con `preventDefault()`.

#### Estructura Canónica del Modal
```html
@if (isModalOpen()) {
  <div class="overlay" (click)="closeModalOnBackdrop($event)" (keydown.escape)="closeModal()">
    <div class="dialog dialog--medium" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <!-- Cabecera -->
      <div class="dialog__header">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span class="material-symbols-outlined dialog__icon" style="color: var(--gold);">warning</span>
          <h2 class="dialog__title">{{ modalTitle }}</h2>
        </div>
        <button type="button" class="btn-icon" (click)="closeModal()" aria-label="Cerrar modal">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Cuerpo Scrollable (sin tag <form>) -->
      <div class="dialog__body">
        <p class="dialog__message">{{ modalMessage }}</p>
        <div class="form-group" style="margin-top: 1rem;">
          <label for="input-reason" class="form-label form-label--required">Motivo / Justificación</label>
          <textarea id="input-reason" class="form-textarea" [(ngModel)]="actionReason" placeholder="Describe la causa operativa…"></textarea>
        </div>
      </div>

      <!-- Barra de Acciones Sticky -->
      <div class="dialog__footer">
        <button type="button" class="carriers-btn carriers-btn--ghost" (click)="closeModal()" [disabled]="isSaving()">
          Cancelar
        </button>
        <button type="button" class="carriers-btn carriers-btn--danger" (click)="confirmAction($event)" [disabled]="isSaving() || !actionReason.trim()">
          @if (isSaving()) {
            <span class="material-symbols-outlined spinner">sync</span>
            Procesando…
          } @else {
            <span class="material-symbols-outlined">check</span>
            Confirmar Acción
          }
        </button>
      </div>
    </div>
  </div>
}
```

---

### 5.5 Hero Header Golden Standard con Navegación `/admin` (`.hero-header`)

```html
<header class="hero-header">
  <!-- 1. Icon Box Navy (52x52px) -->
  <div class="hero-header__icon-box">
    <span class="material-symbols-outlined">{{ iconName }}</span>
  </div>

  <!-- 2. Contenido -->
  <div class="hero-header__content">
    <div class="hero-header__breadcrumb">
      <a routerLink="/admin" class="btn-back-admin" title="Regresar a Administración WMS">
        <span class="back-arrow">←</span> ADMINISTRACIÓN WMS
      </a>
      <span class="breadcrumb-dot">·</span>
      <span class="hero-header__eyebrow">{{ categoryEyebrow }}</span>
    </div>

    <h1 class="hero-header__title">{{ screenTitle }}</h1>
    <p class="hero-header__subtitle">{{ screenSubtitle }}</p>
  </div>

  <!-- 3. Acciones Primarias de Pantalla -->
  <div class="hero-header__actions">
    @if (canCreate()) {
      <button type="button" class="carriers-btn carriers-btn--primary" (click)="onCreateNew()">
        <span class="material-symbols-outlined">add</span>
        {{ createButtonLabel }}
      </button>
    }
  </div>
</header>
```

---

### 5.6 KPI Metric Cards Grid (`.carriers-kpi-grid`, `.kpi-card`)

Cuadrícula responsiva de 4 columnas para métricas clave:
```html
<div class="carriers-kpi-grid" role="region" aria-label="Métricas Principales">
  <!-- 1. Total (Midnight Navy) -->
  <div class="carriers-kpi-card carriers-kpi-card--total">
    <div class="carriers-kpi-card__icon-wrap">
      <span class="material-symbols-outlined">inventory_2</span>
    </div>
    <div class="carriers-kpi-card__body">
      <span class="carriers-kpi-card__value">{{ totalMetric() }}</span>
      <span class="carriers-kpi-card__label">Total Registrados</span>
    </div>
    <div class="carriers-kpi-card__bar carriers-kpi-card__bar--total"></div>
  </div>

  <!-- 2. Activos (Verde Éxito) -->
  <div class="carriers-kpi-card carriers-kpi-card--active">
    <div class="carriers-kpi-card__icon-wrap">
      <span class="material-symbols-outlined">check_circle</span>
    </div>
    <div class="carriers-kpi-card__body">
      <span class="carriers-kpi-card__value">{{ activeMetric() }}</span>
      <span class="carriers-kpi-card__label">Activos / Operativos</span>
    </div>
    <div class="carriers-kpi-card__bar carriers-kpi-card__bar--active"></div>
  </div>

  <!-- 3. En Espera / Suspendidos (Dorado / Ámbar) -->
  <div class="carriers-kpi-card carriers-kpi-card--suspended">
    <div class="carriers-kpi-card__icon-wrap">
      <span class="material-symbols-outlined">hourglass_top</span>
    </div>
    <div class="carriers-kpi-card__body">
      <span class="carriers-kpi-card__value">{{ pendingMetric() }}</span>
      <span class="carriers-kpi-card__label">Pendientes / Alerta</span>
    </div>
    <div class="carriers-kpi-card__bar carriers-kpi-card__bar--suspended"></div>
  </div>

  <!-- 4. Inactivos / Bloqueados (Gris Muted / Rojo) -->
  <div class="carriers-kpi-card carriers-kpi-card--inactive">
    <div class="carriers-kpi-card__icon-wrap">
      <span class="material-symbols-outlined">cancel</span>
    </div>
    <div class="carriers-kpi-card__body">
      <span class="carriers-kpi-card__value">{{ inactiveMetric() }}</span>
      <span class="carriers-kpi-card__label">Inactivos / Bajas</span>
    </div>
    <div class="carriers-kpi-card__bar carriers-kpi-card__bar--inactive"></div>
  </div>
</div>
```

```
