# 4GUARD WMS — Design System

> Motor visual: **Synexia Theme Engine** | Soporte: Dark Mode + Light Mode | Sistema: Glassmorphism suave

---

## 🎨 Identidad Visual

| Token | Valor | Descripción |
|---|---|---|
| **Midnight Navy** | `#172033` | Color estructural primario (headers, íconos) |
| **Prestige Gold** | `#c5a86b` / `#EAC349` | Acento corporativo, CTA, foco |
| **Corporate Purple** | `#2D1B44` | Estado activo en sidebar |
| **Cream/Bone** | `#f5f4f0` | Fondo de página en modo claro |

---

## 🌗 Temas: Light & Dark

El sistema usa **CSS Custom Properties** en `:root` y `.theme-dark`, controladas por el **Synexia Theme Engine**.

### Modo Claro (`:root` / `.theme-light`)

```css
/* Fondos */
--app-bg:         #f3f0e9;     /* Crema/hueso */
--app-bg-start:   #f8f6f1;
--app-bg-end:     #f1eee7;
--surface:        #ffffff;
--surface-card:   rgba(255, 255, 255, 0.86);

/* Texto */
--text-primary:   #17243d;    /* Navy oscuro */
--text-secondary: #748094;
--text-tertiary:  #969fac;
--text-muted:     #a0a8b4;

/* Dorado corporativo */
--gold:           #ad8129;
--gold-light:     #c6a255;
--gold-subtle:    #fff5dc;
--gold-border:    rgba(174, 129, 37, 0.2);
--gold-hover-bg:  rgba(174, 129, 37, 0.1);

/* Azul marino */
--navy:           #17243d;
--navy-hover:     #0f1b31;
--navy-soft:      #eef1f6;

/* Bordes */
--border:         rgba(23, 36, 61, 0.12);
--border-subtle:  rgba(23, 36, 61, 0.07);
--border-gold:    rgba(174, 129, 37, 0.22);

/* Sombras */
--shadow-xs:   0 4px 12px rgba(31, 42, 68, 0.035);
--shadow-sm:   0 10px 25px rgba(31, 42, 68, 0.055);
--shadow-md:   0 18px 42px rgba(31, 42, 68, 0.08);
--shadow-lg:   0 28px 65px rgba(31, 42, 68, 0.12);
--shadow-card: 0 18px 42px rgba(31, 42, 68, 0.075);

/* Tablas */
--table-header-bg:  rgba(245, 243, 237, 0.92);
--table-row-hover:  rgba(247, 244, 237, 0.72);

/* Formularios */
--input-bg:          #fbfbfa;
--input-bg-focus:    #ffffff;
--input-placeholder: #a1a8b3;
```

### Modo Oscuro (`.theme-dark`)

```css
/* Fondos */
--app-bg:         #0b1119;    /* Azul marino profundo */
--app-bg-start:   #101722;
--app-bg-end:     #0c121b;
--surface:        #111a26;
--surface-card:   rgba(17, 26, 38, 0.82);

/* Texto */
--text-primary:   #edf1f5;
--text-secondary: #9aa6b4;
--text-tertiary:  #748292;
--text-muted:     #667585;

/* Dorado oscuro */
--gold:           #d0af67;
--gold-light:     #e1c47c;
--gold-subtle:    rgba(208, 175, 103, 0.1);
--gold-border:    rgba(208, 175, 103, 0.23);
--gold-hover-bg:  rgba(208, 175, 103, 0.12);

/* Bordes */
--border:         rgba(255, 255, 255, 0.1);
--border-subtle:  rgba(255, 255, 255, 0.06);
--border-gold:    rgba(208, 175, 103, 0.23);

/* Sombras */
--shadow-xs:   0 5px 14px rgba(0, 0, 0, 0.12);
--shadow-sm:   0 12px 28px rgba(0, 0, 0, 0.18);
--shadow-md:   0 20px 48px rgba(0, 0, 0, 0.24);
--shadow-lg:   0 32px 75px rgba(0, 0, 0, 0.34);
--shadow-card: 0 22px 50px rgba(0, 0, 0, 0.25);

/* Tablas */
--table-header-bg: rgba(255, 255, 255, 0.035);
--table-row-hover: rgba(255, 255, 255, 0.028);

/* Formularios */
--input-bg:          rgba(255, 255, 255, 0.035);
--input-bg-focus:    rgba(255, 255, 255, 0.055);
--input-placeholder: #647383;
```

### Dark Mode en componentes (patrón host-context)

Cada componente standalone usa `:host-context(.theme-dark)` para adaptar sus variables locales:

```css
/* Ejemplo extraído de carrier-management / layout-management */
:host-context(.theme-dark) {
  --bg-page:       #0d0b12;
  --bg-card:       rgba(33, 29, 42, 0.90);
  --border-card:   rgba(255, 255, 255, 0.07);
  --text-primary:  #eceaf1;
  --text-secondary:#9d99a8;
  --text-muted:    #6a6577;
  --text-gold:     #d6b667;
  --gold-bg:       rgba(214, 182, 103, 0.08);
  --gold-border:   rgba(214, 182, 103, 0.20);
}
```

---

## ✒️ Tipografía

| Uso | Fuente | Peso | Tamaño |
|---|---|---|---|
| **Display / Títulos H1-H3** | Bodoni Moda (serif) | 700 | 2.25rem – 1.5rem |
| **UI / Body / H4-H6** | DM Sans (sans-serif) | 400/600 | 1.25rem – 0.875rem |
| **Código / IDs / RFC** | JetBrains Mono | 500 | 0.75rem |
| **Eyebrows / Labels tabla** | DM Sans | 700 | 0.68rem – 0.625rem |

### Escala tipográfica

```scss
$text-xs:   0.625rem;  // 10px  — Labels muy pequeños, badges
$text-sm:   0.75rem;   // 12px  — Captions, table headers
$text-base: 0.875rem;  // 14px  — Body por defecto
$text-md:   1rem;      // 16px  — Body prominente
$text-lg:   1.125rem;  // 18px  — Subtítulos
$text-xl:   1.25rem;   // 20px  — H4
$text-2xl:  1.5rem;    // 24px  — H3
$text-3xl:  1.875rem;  // 30px  — H2
$text-4xl:  2.25rem;   // 36px  — H1
$text-5xl:  3rem;      // 48px  — Hero / Dashboard
```

### Mixins tipográficos

```scss
@mixin table-header {
  font-family: $font-ui;
  font-size: $text-xs;
  font-weight: $fw-semibold;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: $gold-primary;  // Headers siempre en dorado
}

@mixin gold-gradient-text {
  background: linear-gradient(135deg, #EAC349 0%, #FFE088 60%, #EAC349 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 📐 Espaciado

Sistema basado en **múltiplos de 8px**:

```scss
$space-1:  8px;    // Padding badges, gaps mínimos
$space-2:  16px;   // Padding botones, gaps estándar
$space-3:  24px;   // Padding cards, secciones
$space-4:  32px;   // Padding páginas, secciones grandes
$space-6:  48px;   // Secciones hero
$space-8:  64px;   // Empty states, max-heights header
```

---

## 🔘 Radio de bordes

```scss
$radius-xs:   2px;    // Code snippets
$radius-sm:   4px;    // Badges, chips
$radius-md:   8px;    // Inputs, cards estándar
$radius-lg:   12px;   // Modales, cards grandes
$radius-full: 9999px; // Badges pill, avatares
--radius-card: 18px;  // Cards de pantalla principales
```

---

## 🎯 Estados de Color (Semánticos)

### Modo Claro
| Estado | Color | Background | Borde |
|---|---|---|---|
| **Success** | `#318153` | `#e5f5eb` | `rgba(32,132,87,0.20)` |
| **Warning** | `#a86d16` | `#fff0cf` | `rgba(213,145,39,0.22)` |
| **Danger** | `#b9413c` | `#fff0ef` | `rgba(200,73,73,0.20)` |
| **Info** | `#416ca8` | `#e9f1fc` | `rgba(45,125,210,0.18)` |
| **Inactive** | `#6f7785` | `rgba(111,119,133,0.09)` | `rgba(111,119,133,0.14)` |

### Modo Oscuro
| Estado | Color | Background | Borde |
|---|---|---|---|
| **Success** | `#67c78b` | `rgba(76,175,112,0.11)` | `rgba(76,175,112,0.25)` |
| **Warning** | `#e0aa4f` | `rgba(224,170,79,0.11)` | `rgba(213,145,39,0.22)` |
| **Danger** | `#ef7773` | `rgba(239,83,80,0.11)` | `rgba(200,73,73,0.20)` |
| **Info** | `#77a8df` | `rgba(96,165,250,0.11)` | `rgba(45,125,210,0.18)` |

---

## 🏷️ FSM Colors (Finite State Machine)

Los estados de ubicaciones y entidades siguen un mapa de colores semánticos:

```scss
$fsm-colors: (
  10: (text: #6B9EE8, bg: rgba(107,158,232,0.10), border: rgba(107,158,232,0.25)),  // Pendiente
  20: (text: #FFA726, bg: rgba(255,167,38,0.10),  border: rgba(255,167,38,0.30)),   // En proceso
  30: (text: #66BB6A, bg: rgba(102,187,106,0.10), border: rgba(102,187,106,0.30)),  // Completado
  40: (text: $text-primary, bg: rgba(255,255,255,0.05), border: $border-subtle),    // Neutro
  50: (text: #FF8A65, bg: rgba(255,138,101,0.10), border: rgba(255,138,101,0.25)),  // Advertencia
  60: (text: #4CAF50, bg: rgba(76,175,80,0.08),   border: rgba(76,175,80,0.20)),   // Disponible
  70: (text: #EF5350, bg: rgba(239,83,80,0.10),   border: rgba(239,83,80,0.35)),   // Error/Bloqueado
  80: (text: $text-tertiary, bg: rgba(149,142,152,0.08), border: $border-subtle),  // Inactivo
);
```

---

## 🪟 Glassmorphism

Clases utilitarias globales para superficies de vidrio:

```css
/* Superficies */
.synexia-surface {
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

/* Glass estándar */
.synexia-glass, .liquid-glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(20px) saturate(145%);
}

/* Glass fuerte */
.synexia-glass--strong {
  background: var(--glass-bg-strong);
}

/* Cards de pantalla (modo claro) */
--bg-card: rgba(255, 255, 255, 0.92);
--shadow-card: 0 12px 32px rgba(36,44,58,0.08), inset 0 1px 0 rgba(255,255,255,0.85);

/* Cards de pantalla (modo oscuro) */
--bg-card: rgba(33, 29, 42, 0.90);
--shadow-card: 0 18px 42px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04);
```

---

## 🎬 Animaciones

```css
/* Entrada de página */
.animate-fade-up   { animation: synexia-fade-up 320ms cubic-bezier(0.22,1,0.36,1) both; }
.animate-fade-in   { animation: synexia-fade-in 260ms ease both; }
.animate-soft-pulse{ animation: synexia-soft-pulse 2.2s ease-in-out infinite; }
.animate-float     { animation: synexia-float 4s ease-in-out infinite; }
.animate-shimmer   { /* shimmer sweep en skeletons */ }

/* Micro-interacciones */
.hover-lift:hover {
  transform: translateY(-3px);
  border-color: var(--gold-border);
  box-shadow: var(--shadow-md);
}

/* Durations */
$duration-fast:   150ms;
$duration-normal: 300ms;
$duration-slow:   500ms;
$ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 📏 Layout del Shell

```scss
$sidebar-width:           256px;
$sidebar-collapsed-width:  64px;
$header-height:            64px;
$content-max-width:       1440px;
```

El shell usa CSS Grid:
```css
.shell { grid-template-columns: 256px 1fr; }
.shell--collapsed { grid-template-columns: 64px 1fr; }
```

---

## 🔡 Íconos

Sistema: **Material Symbols Outlined** (Google)

```css
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' -25, 'opsz' 24;
}
```

Tamaños estándar por contexto:
- `14px` — Dentro de badges/chips inline
- `16px` — Leyendas de sección
- `18px` — Botones, nav links
- `22px` — KPI cards
- `26px` — Headers de página
- `34–40px` — Empty states
- `48px` — Tabla vacía
