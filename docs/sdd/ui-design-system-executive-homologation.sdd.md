# SDD — Estándar de Diseño Visual & Homologación Ejecutiva (4GUARD RF Terminal)

**Proyecto:** 4GUARD Logistics WMS  
**Documento:** Especificación de Diseño Visual Homologado Dual-Theme (Light Mode Luxury & Dark Mode Obsidian)  
**Tipo:** Estándar de Arquitectura UI/UX, Design Tokens & Tarjetas Ejecutivas  
**Estado:** Activo & Obligatorio  
**Versión:** 3.0 (Homologación Integral: Shell + Menú + Montacargas + Calidad + Seguridad)  
**Ámbito:** PWA RF Terminal Tablet & Desktop Web (Dual Theme).  

---

## 1. Filosofía de Diseño Ejecutivo & Identidad Institucional

El diseño del **4GUARD RF Terminal** está diseñado para ofrecer una experiencia operativa de grado industrial sin sacrificar la elegancia de una suite corporativa de alta gama:

1. **Dual Theme Simétrico:**
   - **Light Mode (Linen / Ivory & Midnight Navy):** Fondo `#f5f4f0` con tarjetas de degradado dorado suave, bordes con barra superior Prestige Gold `#c5a86b`, y tipografía oscura de máximo contraste `#1c2940` (WCAG AAA).
   - **Dark Mode (Midnight Obsidian & Platinum White):** Fondo `#0b1119` con superficies de cristal oscuro con reflejo champagne `linear-gradient(145deg, rgba(23, 33, 48, 0.96), rgba(36, 31, 22, 0.95))`, acentos dorados `#d0af67` y tipografía `#edf1f5`.
2. **Cero Fondos Planos en Tarjetas Ejecutivas:** Toda tarjeta principal o panel operativo utiliza un degradado satinado sutil combinado con una **barra superior de acento dorado institucional** (`border-top: 3.5px solid var(--gold)`).
3. **Resplandor Ambiental Dorado (`.rf-card-gold-glow`):** Destello radial difuminado en la esquina superior de las tarjetas que reacciona con microinteracciones al hover o toque táctil.
4. **Header con Presencia Dinámica:**
   - **Al tope (`scroll = 0`):** Fondo 100% sólido y estructurado (`#ffffff` / `#0b1119`) con borde inferior de 2px y sombra nítida.
   - **Al desplazarse (`scroll > 0`):** Transición automática a *Floating Liquid Glass* (`backdrop-filter: blur(16px)`, `background: rgba(255, 255, 255, 0.88)` / `rgba(11, 17, 25, 0.85)`).
5. **Popovers y Modales 100% Opacos:** Los menús emergentes (como el perfil del operador y confirmaciones de salida) cuentan con un fondo 100% sólido sin transparencias confusas, enmarcados por un backdrop oscuro (`rgba(15, 23, 42, 0.65)`) con desenfoque de profundidad.

---

## 2. Paleta de Tokens de Diseño Dual-Theme

```css
/* ── LIGHT MODE (Linen Warm Canvas + Midnight Navy + Prestige Gold) ── */
:root,
.theme-light,
[data-theme='light'] {
  --bg-page:             #f5f4f0;
  --bg-page-gradient:    radial-gradient(circle at 90% 5%, rgba(197, 168, 107, 0.07), transparent 30rem), #f5f4f0;
  
  /* Superficie Ejecutiva Dorada */
  --bg-card-exec:        linear-gradient(145deg, #ffffff 0%, #fdfbf7 40%, #f7f0e1 100%);
  --bg-card:             #ffffff;
  --bg-card-subtle:      #f8f9fa;
  --bg-card-hover:       #f1f5f9;
  
  --border-card:         rgba(76, 86, 105, 0.12);
  --border-card-gold:    rgba(197, 168, 107, 0.32);
  --border-card-strong:  rgba(76, 86, 105, 0.22);
  
  --shadow-card:         0 8px 24px rgba(36, 44, 58, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  --shadow-hover:        0 16px 36px rgba(197, 168, 107, 0.24), 0 4px 12px rgba(23, 32, 51, 0.08);
  
  /* Tipografía (WCAG AAA) */
  --text-primary:        #1c2940;
  --text-secondary:      #5a6477;
  --text-muted:          #718096;
  --text-gold:           #9b7626;

  /* Marca */
  --navy:                #172033;
  --navy-mid:            #25324a;
  --gold:                #c5a86b;
  --gold-light:          #e0c87a;
  --gold-bg:             rgba(197, 168, 107, 0.10);
  --gold-border:         rgba(197, 168, 107, 0.28);

  /* Estados */
  --c-success:           #208457;
  --c-success-bg:        rgba(32, 132, 87, 0.09);
  --c-warning:           #a96b13;
  --c-warning-bg:        rgba(213, 145, 39, 0.10);
  --c-danger:            #c84949;
  --c-danger-bg:         rgba(200, 73, 73, 0.09);
  --c-info:              #2d7dd2;
  --c-info-bg:           rgba(45, 125, 210, 0.08);
}

/* ── DARK MODE (Midnight Obsidian + Platinum White + Prestige Gold) ── */
.theme-dark,
.dark,
[data-theme='dark'] {
  --bg-page:             #0b1119;
  --bg-page-gradient:    radial-gradient(circle at 90% 5%, rgba(208, 175, 103, 0.05), transparent 30rem), #0b1119;
  
  /* Superficie Ejecutiva Dorada Obsidian */
  --bg-card-exec:        linear-gradient(145deg, rgba(23, 33, 48, 0.96) 0%, rgba(17, 26, 38, 0.98) 50%, rgba(36, 31, 22, 0.95) 100%);
  --bg-card:             rgba(17, 26, 38, 0.94);
  --bg-card-subtle:      rgba(255, 255, 255, 0.04);
  --bg-card-hover:       rgba(23, 35, 50, 0.98);
  
  --border-card:         rgba(255, 255, 255, 0.08);
  --border-card-gold:    rgba(208, 175, 103, 0.24);
  --border-card-strong:  rgba(255, 255, 255, 0.16);
  
  --shadow-card:         0 16px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(208, 175, 103, 0.15);
  --shadow-hover:        0 20px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(208, 175, 103, 0.22);
  
  /* Tipografía */
  --text-primary:        #edf1f5;
  --text-secondary:      #9aa6b4;
  --text-muted:          #667585;
  --text-gold:           #d0af67;

  /* Marca */
  --navy:                #dfe7ef;
  --navy-mid:            #16212f;
  --gold:                #d0af67;
  --gold-light:          #e1c47c;
  --gold-bg:             rgba(208, 175, 103, 0.12);
  --gold-border:         rgba(208, 175, 103, 0.25);

  /* Estados */
  --c-success:           #67c78b;
  --c-success-bg:        rgba(76, 175, 112, 0.12);
  --c-warning:           #e0aa4f;
  --c-warning-bg:        rgba(224, 170, 79, 0.12);
  --c-danger:            #ef7773;
  --c-danger-bg:         rgba(239, 83, 80, 0.12);
  --c-info:              #77a8df;
  --c-info-bg:           rgba(96, 165, 250, 0.12);
}
```

---

## 3. Patrones de Componentes Homologados

### A. Tarjeta Ejecutiva Estándar (`.rf-module-card`, `.hero-active-card`, `.qm-card`, `.security-panel-card`)
Toda tarjeta principal de módulo debe adoptar la estructura:

```css
.card-executive {
  background: linear-gradient(145deg, #ffffff 0%, #fdfbf7 40%, #f7f0e1 100%);
  border: 1.5px solid rgba(197, 168, 107, 0.32);
  border-top: 3.5px solid var(--gold);
  border-radius: 18px;
  padding: 1.35rem 1.5rem;
  box-shadow: 0 8px 24px rgba(36, 44, 58, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all 220ms cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
}

:host-context(.theme-dark) .card-executive {
  background: linear-gradient(145deg, rgba(23, 33, 48, 0.96) 0%, rgba(17, 26, 38, 0.98) 50%, rgba(36, 31, 22, 0.95) 100%);
  border: 1.5px solid rgba(208, 175, 103, 0.24);
  border-top: 3.5px solid var(--gold);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(208, 175, 103, 0.15);
}

.card-executive:hover {
  transform: translateY(-4px);
  border-color: var(--gold);
  background: linear-gradient(145deg, #ffffff 0%, #fbf6ec 35%, #f2e5cb 100%);
  box-shadow: 0 16px 36px rgba(197, 168, 107, 0.24), 0 4px 12px rgba(23, 32, 51, 0.08);
}
```

### B. Barra de Filtros Pill Nav (`.filter-pill`, `.qm-filter-pill`, `.security-tab-btn`)
- **Inactivo:** Fondo `#ffffff` con borde `rgba(76, 86, 105, 0.18)` y texto `#5a6477`.
- **Activo (Light Mode):** `background: linear-gradient(145deg, #172033, #25324a); color: #e0c87a; border: 1px solid rgba(197, 168, 107, 0.35); box-shadow: 0 4px 14px rgba(23, 32, 51, 0.22);`
- **Activo (Dark Mode):** `background: rgba(208, 175, 103, 0.15); color: #d0af67; border: 1px solid rgba(208, 175, 103, 0.35); box-shadow: 0 0 12px rgba(208, 175, 103, 0.18);`

### C. Botones de Acción Primarios & Secundarios
- **Botón Primario Dorado (`.btn-primary`, `.btn-resume-task`):**
  - Light: `background: linear-gradient(135deg, #c5a86b 0%, #b3924f 100%); color: #172033; border: 1px solid #e0c87a; font-weight: 900;`
  - Dark: `background: linear-gradient(135deg, #d0af67 0%, #b89547 100%); color: #0b1119; border: 1px solid #e1c47c; font-weight: 900;`
- **Botón de Módulo (`.btn-module-action`):**
  - Default: Fondo `#ffffff` con borde `rgba(197, 168, 107, 0.35)` y texto `#172033`.
  - Hover: `background: linear-gradient(135deg, #172033 0%, #25324a 100%); color: #ffffff; border-color: var(--gold);`

---

## 4. Módulos Homologados en el Sistema

| Módulo | Ruta | Elementos con Degradado Dorado Ejecutivo |
|---|---|---|
| **Menú Principal** | `/menu` | 7 Tarjetas Operativas + Card Informativa + Modal de Incidencias |
| **Cockpit Montacarguista** | `/cockpit` | Topbar + Hero Card + Cola FIFO + Modal Plan Concreto + Laser HUD + Modal Celebración |
| **Control de Calidad (QM)** | `/quality` | Header + Tarjeta Hero + Cola Cuarentena + Modal Dictamen + Modal Cámara Evidencia + Acta Certificado |
| **Seguridad & Caseta** | `/security` | Cabecera Táctica + 4 Cards KPI + Panel F01 + Bandeja Entrantes + Modal Preview F01 + Modal Cotejo Salida + Modal Rampas |
| **Shell Maestro PWA** | Global | Header Dinámico + Popover Perfil 100% Opaco + Modal Simulador Escáner + Modal Confirmación Salida |

---

## 5. Arquitectura de Modales, Pop-Ups & Diálogos Emergentes (Executive Dialog Standard)

Todos los modales y ventanas emergentes del ecosistema 4GUARD siguen estrictamente el estándar de diseño visual y ergonomía táctil UI/UX:

```css
/* ── Backdrop con Desenfoque de Profundidad (Ambient Blur) ── */
.rf-modal-backdrop,
.qm-modal-overlay,
.scan-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
  animation: modalFadeIn 180ms ease-out;
}

/* ── Tarjeta Modal Ejecutiva (100% Opaca con Acento Dorado) ── */
.rf-modal-card,
.qm-modal-card,
.scan-modal {
  width: 100%;
  max-width: 580px;
  background: linear-gradient(145deg, #ffffff 0%, #fdfbf7 40%, #f7f0e1 100%) !important;
  border: 1.5px solid rgba(197, 168, 107, 0.35);
  border-top: 4px solid var(--gold);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(197, 168, 107, 0.12);
  color: var(--text-primary);
  animation: modalPopIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

:host-context(.theme-dark) .rf-modal-card,
:host-context(.dark) .rf-modal-card,
:host-context([data-theme='dark']) .rf-modal-card {
  background: linear-gradient(145deg, rgba(23, 33, 48, 0.98) 0%, rgba(17, 26, 38, 0.98) 50%, rgba(36, 31, 22, 0.98) 100%) !important;
  border: 1.5px solid rgba(208, 175, 103, 0.28);
  border-top: 4px solid var(--gold);
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.85), 0 0 24px rgba(208, 175, 103, 0.15);
}

/* ── Botón de Cierre de Alta Precisión [✕] ── */
.btn-modal-close,
.qm-modal-close,
.modal-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-card-subtle);
  border: 1px solid var(--border-card);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 180ms ease;
}

.btn-modal-close:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: #ef4444;
}
```

---

## 6. Criterios de Aceptación & Verificación

1. **Cero Texto Blanco sobre Fondo Claro:** Todo texto sobre tarjetas doradas/claras debe tener color `#1c2940` (primario), `#5a6477` (secundario) o `#9b7626` (dorado oscuro).
2. **Cero Transparencia Confusa en Popovers y Modales:** Todos los modales y menús de perfil son 100% opacos con degradado satinado dorado o cristal oscuro Obsidian.
3. **Ergonomía Táctil Industrial:** Botones y disparadores táctiles con altura mínima de 44px para operarios con guantes o pantallas de montacargas/tabletas.
4. **Compilación Limpia:** Ejecución de `npx ng build rf-terminal` con **0 errores de compilación**.
