# 4GUARD WMS — Convenciones de Código

> **Stack:** Angular 17+ Standalone | **Linting:** ESLint + Prettier | **Estilo CSS:** SCSS 7-1 pattern  
> 🚨 **REGLA DE ORO DE VERIFICACIÓN:** Ningún cambio de código o plantilla HTML se considera completo sin ejecutar la verificación de compilación (`ng build admin-console`) para garantizar 0 errores de sintaxis o de compilador.  
> ⛔ **PROHIBICIÓN NATIVA `alert()` / `confirm()`:** Queda estrictamente prohibido usar `window.confirm()` o `window.alert()` nativos del navegador. Todo diálogo de confirmación debe implementarse mediante `<fg-confirm-dialog>` (`ConfirmDialogComponent`).

---

## 🏗️ Estructura de un Feature Module

Cada módulo de feature sigue esta estructura consistente:

```
features/
└── admin/
    └── [feature-name]/
        ├── [feature-name]-management/
        │   ├── [feature-name]-management.component.ts    ← Standalone
        │   ├── [feature-name]-management.component.html
        │   └── [feature-name]-management.component.css  ← Estilos aislados
        ├── models/
        │   └── [feature-name].model.ts                  ← Interfaces/DTOs
        ├── services/
        │   └── [feature-name].service.ts                ← HttpClient calls
        └── [feature-name].routes.ts                     ← Lazy routes
```

---

## 📝 Naming Conventions

### TypeScript
```typescript
// Componentes: PascalCase
export class CarrierManagementComponent {}

// Servicios: PascalCase + Service
export class CarrierService {}

// Interfaces/Modelos: PascalCase
export interface Carrier {}
export interface CarrierDto {}

// Routes: camelCase + Routes suffix
export const carriersRoutes: Routes = []

// Guards: camelCase + Guard suffix
export const authGuard = ...
export const rbacGuard = ...

// Signals: camelCase
signal<CarrierDto | null>(null)
computed(() => ...)
```

### CSS / Clases

El sistema usa **BEM** a nivel de módulo, con el nombre del módulo como prefijo:

```css
/* Bloque */
.carriers-page {}
.carriers-header {}
.carriers-kpi-card {}

/* Elemento */
.carriers-kpi-card__icon-wrap {}
.carriers-kpi-card__value {}
.carriers-kpi-card__label {}

/* Modificador */
.carriers-kpi-card--active {}
.carriers-kpi-card--suspended {}
.carriers-btn--primary {}
.carriers-btn--ghost {}
```

### Variables CSS locales (`:host`)

```css
/* Siempre definir en :host para encapsulamiento */
:host {
  --navy:        #172033;
  --gold:        #c5a86b;
  --radius-card: 18px;
}
```

---

## 🛡️ Guards y RBAC

```typescript
// Aplicar guard a nivel de ruta, no de componente
{
  path: 'carriers',
  canActivate: [rbacGuard],
  data: { module: 'carriers' },  // ← el rbacGuard usa este valor
  loadChildren: () => import('./carriers.routes')
}
```

### Módulos RBAC disponibles

```typescript
'admin' | 'inventory' | 'receiving' | 'quality' | 'shipping' |
'layout' | 'carriers' | 'sections' | 'suppliers' | 'performance' |
'shifts' | 'user-activity' | 'business-rules' | 'currency-exchange' |
'alerts-config' | 'license-management'
```

---

## 📡 Servicios HTTP

```typescript
// Patrón estándar de servicio
@Injectable({ providedIn: 'root' })
export class CarrierService {
  private http = inject(HttpClient);
  private env = inject(EnvironmentService);

  getAll(): Observable<CarrierDto[]> {
    return this.http.get<CarrierDto[]>(`${this.env.apiUrl}/carriers`);
  }

  create(payload: CreateCarrierDto): Observable<CarrierDto> {
    return this.http.post<CarrierDto>(`${this.env.apiUrl}/carriers`, payload);
  }
}
```

---

## 🚫 Regla Estricta: Cero Datos Hardcodeados (Directiva BD Obligatoria)

1. **Cero Mocks en Producción:** Queda estrictamente prohibido mantener datos simulados (`MOCK_*`) o arreglos hardcodeados en memoria dentro de los servicios de `admin-console`.
2. **Fuente Única de Verdad (BD Backend):** Todos los componentes, dropdowns, tablas y KPI cards deben consumir sus datos desde los endpoints HTTP reales conectados a la base de datos de `4Guard_BEAPI`.
3. **Manejo de Errores Sin Mock Fallback:** Si un servicio falla o la base de datos responde vacía/error, el frontend **NUNCA** debe recurrir a datos mock fijos como fallback silencioso. Debe emitir una notificación discreta vía `ToastService.error()` y mostrar el estado de error/pantalla vacía (`empty state`).

---

## 🎨 Estilos — Reglas de Oro

1. **Nunca hard-codear colores en HTML.** Siempre usar variables CSS (`var(--gold)`, `var(--text-primary)`).

2. **Variables locales en `:host`.** Cada componente define sus propias variables que extienden el sistema global.

3. **Dark mode siempre.** Cada componente con estilos propios DEBE tener sección `:host-context(.theme-dark)`.

4. **Fonts disponibles:**
   - Display: `'Outfit'` (screens) / `'Bodoni Moda'` (global h1-h3)
   - Body: `'Inter'` (screens) / `'DM Sans'` (global)
   - Mono: `'JetBrains Mono'`

5. **Radios de tarjeta:** Usar `--radius-card: 18px` en contenedores principales. `--radius-input: 10px` para inputs.

6. **Hover en cards:** Siempre `translateY(-2px)` con transición `0.15s`.

7. **Formularios:** Headers y footers SIEMPRE sticky con `backdrop-filter: blur(10px)`.

---

## 🗂️ Imports SCSS

```scss
// En archivos de estilo, usar @use en lugar de @import
@use '../abstracts/variables' as *;
@use '../abstracts/typography' as *;
@use '../abstracts/spacing' as *;
@use '../abstracts/mixins' as *;

// Los componentes globales se registran en styles.scss
// NO importar manualmente en cada componente
```

---

## 📐 Patrones de Grid

```scss
// KPI Grid (4 columnas)
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.9rem;
}

// Form Grid
.form-grid--2 { grid-template-columns: repeat(2, 1fr); }
.form-grid--3 { grid-template-columns: repeat(3, 1fr); }
.form-grid--4 { grid-template-columns: repeat(4, 1fr); }

// Bento Grid (auto-fill)
@mixin bento-grid($min-col: 280px, $gap: $gap-md) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax($min-col, 1fr));
  gap: $gap;
}
```

---

## 🧩 Standalone Components

```typescript
@Component({
  selector: 'app-carrier-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    // Angular Material si aplica
  ],
  templateUrl: './carrier-management.component.html',
  styleUrl: './carrier-management.component.css',
})
export class CarrierManagementComponent {
  // Usar signals de Angular 17+
  carriers = signal<CarrierDto[]>([]);
  selectedCarrier = signal<CarrierDto | null>(null);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
}
```

---

## 🔤 Nx Path Aliases

```typescript
// tsconfig.base.json
{
  "paths": {
    "@4guard/shared-core": ["libs/shared-core/src/index.ts"]
  }
}

// Uso en código
import { UserRole, CarrierModel } from '@4guard/shared-core';
```

---

## 📋 Responsividad

```css
/* Breakpoints estándar */
@media (max-width: 1200px) { /* Tableta: KPI grid 2 columnas */ }
@media (max-width: 1050px) { /* Split → stack vertical */ }
@media (max-width: 720px)  { /* Móvil: padding reducido, ocultar sidebar form */ }
```

---

## ✅ Checklist para nueva pantalla

```markdown
- [ ] Componente standalone con `styleUrl` dedicado
- [ ] Variables locales definidas en `:host`
- [ ] Sección `:host-context(.theme-dark)` implementada
- [ ] Header con icon-wrap + eyebrow + title + subtitle
- [ ] KPI cards si aplica (mínimo 3, máximo 5)
- [ ] Split view con sticky header/footer en formulario
- [ ] Status badges semánticos (no colores hardcoded)
- [ ] Responsive: tableta + móvil
- [ ] Empty state con icon + title + desc
- [ ] Skeleton loading en listas y KPIs
- [ ] Ruta con `rbacGuard` y `data: { module: '...' }`
- [ ] Lazy loading en routes
- [ ] Title de ruta: `'4GUARD WMS — [Nombre de Pantalla]'`
```
