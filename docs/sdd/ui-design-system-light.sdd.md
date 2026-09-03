# SDD — Estándar de Diseño Visual & UI/UX (SynexIA Light Mode)

**Proyecto:** 4GUARD WMS  
**Documento:** Especificación Técnica de Diseño Visual Homologado (Light Mode)  
**Tipo:** Estándar de Arquitectura UI/UX & Design Tokens  
**Estado:** Activo & Obligatorio para Nuevos Módulos  
**Versión:** 1.0 (Light Edition)  
**Ámbito de Aplicación:** Exclusivamente Modo Claro (*Light Mode*). El modo oscuro no se encuentra en desarrollo activo de momento.  
**Control de Versiones:** Trabajo estructurado por ramas (`feature branches` integradas hacia `develop` / rama activa de entrega).  

---

## 1. Objetivo y Filosofía Visual

Este documento define la **norma gráfica y de experiencia de usuario (UI/UX)** para todos los módulos actuales y futuros de **4GUARD WMS**. Su propósito es garantizar una experiencia visual ejecutiva, pulcra, moderna y de alta gama (*Enterprise Luxury / Minimalist Industrial*), eliminando fondos blancos planos y estandarizando la tipografía, colores, tarjetas de métricas KPI y paneles de trabajo.

### Principios Fundamentales:
1. **Cero Fondos Planos:** Todo el sistema se monta sobre un canvas cálido degradado (Lino / Marfil), aportando profundidad visual.
2. **Jerarquía Tipográfica Impecable:** Contraste armónico entre el dorado institucional (*Prestige Gold*), azul marino profundo (*Midnight Navy*) y grises de soporte.
3. **Métricas KPI Horizontales y Compactas:** Sin barras toscas inferiores; disposición horizontal balanceada con iconos pastel redondeados.
4. **Patrón Master-Detail en 12 Columnas:** Directorio lateral en `col-span-4` y área de trabajo / formularios en `col-span-8`.
5. **Aislamiento de Clases CSS:** Utilizar selectores específicos para evitar colisiones con utilidades globales.

---

## 2. Paleta de Colores & Design Tokens (Light Mode)

### 2.1 Fondo de Pantalla (Canvas Lino / Marfil Cálido)
Todo componente o contenedor principal (`:host`, `.page-container`, `.shell-wrapper`) debe implementar este fondo de canvas:

```css
background:
  radial-gradient(circle at top right, rgba(197, 157, 67, 0.09), transparent 30rem),
  linear-gradient(180deg, #f8f6f1 0%, #f2efe8 100%);
```

### 2.2 Tokens Tipográficos y Textos

| Elemento | Color Hex | Familia Tipográfica | Tamaño / Peso | Uso / Aplicación |
| :--- | :--- | :--- | :--- | :--- |
| **Eyebrow / Tag Superior** | `#b8860b` / `#9b7626` | `'DM Sans', sans-serif` | `0.72rem` · 700 Bold | Encabezado institucional superior con icono |
| **Título Principal (H1 / H2)** | `#172033` (*Midnight Navy*) | `'DM Sans', sans-serif` | `clamp(1.85rem, 2.4vw, 2.35rem)` · 400 Regular | Título principal de módulo o pantalla |
| **Subtítulo Descriptivo** | `#718096` (*Slate*) | `'DM Sans', sans-serif` | `0.82rem` · 450 Regular | Descripción funcional de la vista |
| **KPI Valor Numérico** | `#172033` (*Midnight Navy*) | `'DM Sans', sans-serif` | `1.85rem` · 700 Bold | Cifra central de tarjetas de métricas |
| **KPI Etiqueta Superior** | `#718096` (*Slate*) | `'DM Sans', sans-serif` | `0.68rem` · 700 Bold | Mayúsculas con espaciado (`letter-spacing: 0.08em`) |
| **KPI Subtítulo Inferior** | `#94a3b8` (*Muted*) | `'DM Sans', sans-serif` | `0.72rem` · 500 Medium | Explicación breve bajo el valor |
| **Identificadores Técnicos** | `#9b7626` / `#172033` | `'JetBrains Mono', monospace` | `0.75rem` · 700 Bold | Folios (`SAL-`, `REC-`), SSCC, Lotes, UAs, Rampas |

### 2.3 Superficies y Tarjetas

```css
/* Tarjeta estándar de contenido / contenedor */
.card-surface {
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03);
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-surface:hover {
  transform: translateY(-2px);
  border-color: rgba(197, 168, 107, 0.4);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
}
```

### 2.4 Paleta de Estados y Semáforos (Badges e Iconos)

* **Neutral / General (`--primary`):**
  - Icono / Badge: Fondo `#f1f5f9` · Texto `#1e293b` · Borde `#e2e8f0`
* **Precaución / Cuarentena / En Espera (`--warning`):**
  - Icono / Badge: Fondo `#fefce8` · Texto `#b45309` · Borde `#fef08a`
* **Éxito / Aprobado / Completado (`--success`):**
  - Icono / Badge: Fondo `#ecfdf5` · Texto `#059669` · Borde `#a7f3d0`
* **Peligro / Bloqueado / Cancelado (`--danger`):**
  - Icono / Badge: Fondo `#fef2f2` · Texto `#dc2626` · Borde `#fecaca`
* **Informativo / En Proceso (`--info`):**
  - Icono / Badge: Fondo `#eff6ff` · Texto `#2563eb` · Borde `#bfdbfe`

---

## 3. Componentes Estándar Reutilizables

### 3.1 Cabecera de Módulo (Header)

```html
<div class="flex items-center justify-between gap-4 flex-wrap pb-1">
  <div>
    <div class="module-header__eyebrow">
      <span class="material-symbols-outlined icon-glow">verified_user</span>
      <span>4GUARD WMS · [NOMBRE DE SUB-ÁREA]</span>
    </div>
    <h2 class="module-header__title">[Nombre del Módulo]</h2>
    <p class="module-header__subtitle">[Descripción breve y concisa de la operación en tiempo real].</p>
  </div>
  
  <!-- Botón de acción principal institucional -->
  <button
    type="button"
    class="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all hover:scale-102 cursor-pointer"
  >
    <span class="material-symbols-outlined text-base">add</span>
    <span>[Texto de Acción Principal]</span>
  </button>
</div>
```

```css
.module-header__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #b8860b;
  margin-bottom: 4px;
}

.module-header__eyebrow .material-symbols-outlined {
  font-size: 16px !important;
  color: #b8860b;
}

.module-header__title {
  margin: 0;
  color: #172033;
  font-family: 'DM Sans', sans-serif !important;
  font-size: clamp(1.85rem, 2.4vw, 2.35rem) !important;
  font-weight: 400 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.035em !important;
}

.module-header__subtitle {
  margin: 4px 0 0;
  color: #718096;
  font-size: 0.82rem;
  font-weight: 450;
  line-height: 1.5;
}
```

---

### 3.2 Tarjetas KPI Horizontales (`.movement-kpi-grid` & `.movement-kpi-card`)

```html
<div class="movement-kpi-grid">

  <!-- KPI 1: General -->
  <div class="movement-kpi-card movement-kpi-card--primary">
    <div class="movement-kpi-card__icon">
      <span class="material-symbols-outlined">inventory_2</span>
    </div>
    <div class="movement-kpi-card__info">
      <span class="movement-kpi-card__label">TOTAL OPERACIONES</span>
      <strong class="movement-kpi-card__value">{{ totalCount() }}</strong>
      <span class="movement-kpi-card__sub">En sistema / General</span>
    </div>
  </div>

  <!-- KPI 2: En Proceso / Alerta -->
  <div class="movement-kpi-card movement-kpi-card--warning">
    <div class="movement-kpi-card__icon">
      <span class="material-symbols-outlined">hourglass_top</span>
    </div>
    <div class="movement-kpi-card__info">
      <span class="movement-kpi-card__label">PENDIENTES</span>
      <strong class="movement-kpi-card__value">{{ pendingCount() }}</strong>
      <span class="movement-kpi-card__sub">En andén / Proceso</span>
    </div>
  </div>

  <!-- KPI 3: Exitoso / Completado -->
  <div class="movement-kpi-card movement-kpi-card--success">
    <div class="movement-kpi-card__icon">
      <span class="material-symbols-outlined">check_circle</span>
    </div>
    <div class="movement-kpi-card__info">
      <span class="movement-kpi-card__label">LIBERADOS</span>
      <strong class="movement-kpi-card__value">{{ completedCount() }}</strong>
      <span class="movement-kpi-card__sub">Inspección finalizada</span>
    </div>
  </div>

  <!-- KPI 4: No conforme / Cancelado -->
  <div class="movement-kpi-card movement-kpi-card--danger">
    <div class="movement-kpi-card__icon">
      <span class="material-symbols-outlined">block</span>
    </div>
    <div class="movement-kpi-card__info">
      <span class="movement-kpi-card__label">BLOQUEADOS</span>
      <strong class="movement-kpi-card__value">{{ blockedCount() }}</strong>
      <span class="movement-kpi-card__sub">No conformidades</span>
    </div>
  </div>

</div>
```

```css
.movement-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1024px) {
  .movement-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .movement-kpi-grid {
    grid-template-columns: 1fr;
  }
}

.movement-kpi-card {
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03);
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  min-height: 84px;
  box-sizing: border-box;
}

.movement-kpi-card:hover {
  transform: translateY(-2px);
  border-color: rgba(197, 168, 107, 0.4);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.06);
}

.movement-kpi-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.movement-kpi-card__icon .material-symbols-outlined {
  font-size: 24px !important;
  line-height: 1 !important;
}

.movement-kpi-card--primary .movement-kpi-card__icon {
  background: #f1f5f9; color: #1e293b; border: 1px solid #e2e8f0;
}
.movement-kpi-card--warning .movement-kpi-card__icon {
  background: #fefce8; color: #b45309; border: 1px solid #fef08a;
}
.movement-kpi-card--success .movement-kpi-card__icon {
  background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;
}
.movement-kpi-card--danger .movement-kpi-card__icon {
  background: #fef2f2; color: #dc2626; border: 1px solid #fecaca;
}
.movement-kpi-card--info .movement-kpi-card__icon {
  background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;
}

.movement-kpi-card__info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.movement-kpi-card__label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #718096;
  line-height: 1.2;
}

.movement-kpi-card__value {
  font-size: 1.85rem;
  font-weight: 700;
  font-family: 'DM Sans', sans-serif !important;
  line-height: 1.1;
  color: #172033;
  margin: 2px 0;
}

.movement-kpi-card__sub {
  font-size: 0.72rem;
  color: #94a3b8;
  font-weight: 500;
  line-height: 1.2;
}
```

---

### 3.3 Estructura Master-Detail (Workbench de 12 Columnas)

```html
<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
  <!-- Columna Izquierda: Directorio (4 columnas) -->
  <aside class="carriers-directory lg:col-span-4" aria-label="Directorio">
    <div class="carriers-directory__filters">
      <!-- Buscador -->
    </div>
    <div class="carriers-directory__list">
      <!-- Items -->
    </div>
    <div class="carriers-directory__footer">
      <!-- Conteo -->
    </div>
  </aside>

  <!-- Columna Derecha: Panel de Detalle o Formulario (8 columnas) -->
  <main class="lg:col-span-8 space-y-4">
    <!-- Estado Idle (Sin selección) / Create (Captura) / Detail (Consulta) -->
  </main>
</div>
```

---

## 4. Guía de Trabajo por Ramas (Git Workflow)

1. **Creación de Rama de Característica:**  
   Cada módulo nuevo o ajuste se trabaja en su rama dedicada (ejemplo: `feature/modulo-embarques`, `fix/calidad-tabla`, `edgar_remision`).
2. **Preservar la Lógica Funcional:**  
   Las tareas de homologación visual **nunca** deben alterar `Signals`, `Forms`, `Services`, `Events` o validaciones operativas.
3. **Validación de Compilación Obligatoria:**  
   Antes de dar por concluida una rama o preparar un merge:
   ```bash
   npm run build:admin
   ```
   El bundle de producción de Angular debe finalizar con **Exit code: 0** y sin errores de typescript o css.
4. **Verificación de Reglas CSS:**  
   - Verificar que no existan reglas globales sobreescritas (`.kpi-card` genérico).
   - Verificar que el contenedor de módulo no fuerce `grid-template-columns` sobre el workbench completo.
