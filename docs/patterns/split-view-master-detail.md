# Patrón 1: Split View 30/70 (Maestro-Detalle Estándar)

> **Ubicación:** `docs/patterns/split-view-master-detail.md`  
> **Aplica a:** Módulos CRUD de gestión (Transportistas, Proveedores, Sucursales, Clientes, SKUs, Roles).

---

## 📐 Wireframe del Patrón

```
+---------------------------------------------------------------------------------+
| [HEADER HERO / KPI CARDS GRID (4 Cards)]                                        |
+------------------------------------+--------------------------------------------+
| PANEL MAESTRO (30-35% ancho)       | PANEL DETALLE (65-70% ancho)               |
| - Barra de búsqueda e input        | - Sticky Form Header (Título + Acciones)   |
| - Lista / Tabla con scroll         | - Formulario Reactivo (Grid 2/3 columnas)  |
| - Badges de estado coloreados      | - Campos de lectura / edición              |
| - Paginador inferior               | - Sticky Form Footer (Guardar / Cancelar)  |
+------------------------------------+--------------------------------------------+
```

---

## 🧱 Estructura Esquelética HTML (`[modulo]-management.component.html`)

```html
<div class="split-page">

  <!-- 1. HEADER / KPI CARDS -->
  <header class="split-header">
    <div class="split-hero">
      <div class="split-hero__icon"><span class="material-symbols-outlined">dataset</span></div>
      <div class="split-hero__copy">
        <h1>Gestión de {{ entityName }}</h1>
        <p>Administración y catálogo maestro del módulo {{ entityName }}.</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-card__value">{{ totalItems() }}</span>
        <span class="kpi-card__label">TOTAL REGISTROS</span>
      </div>
      <div class="kpi-card kpi-card--success">
        <span class="kpi-card__value">{{ activeItemsCount() }}</span>
        <span class="kpi-card__label">ACTIVOS</span>
      </div>
    </div>
  </header>

  <!-- 2. LAYOUT SPLIT DUAL PANE -->
  <div class="split-body">

    <!-- LADO IZQUIERDO: LISTA MAESTRA (30%) -->
    <aside class="split-master">
      <div class="split-master__search">
        <span class="material-symbols-outlined">search</span>
        <input type="text" placeholder="Buscar..." [value]="searchTerm()" (input)="onSearch($event)" />
      </div>

      <div class="split-master__list">
        @if (isLoading()) {
          <div class="skeleton-list">Cargando...</div>
        } @else if (items().length === 0) {
          <div class="empty-state">No hay registros</div>
        } @else {
          @for (item of items(); track item.id) {
            <div
              class="master-item"
              [class.master-item--selected]="selectedItem()?.id === item.id"
              (click)="selectItem(item)"
            >
              <div class="master-item__title">{{ item.name }}</div>
              <span class="status-badge" [class]="'status-badge--' + item.status.toLowerCase()">
                {{ item.status }}
              </span>
            </div>
          }
        }
      </div>
    </aside>

    <!-- LADO DERECHO: FORMULARIO DETALLE (70%) -->
    <main class="split-detail">
      @if (selectedItem() || isCreating()) {
        <form [formGroup]="form" (ngSubmit)="save()" class="detail-form">
          <header class="detail-form__header">
            <h2>{{ isCreating() ? 'Nuevo Registro' : 'Editar Registro' }}</h2>
            <div class="detail-form__actions">
              <button type="button" class="btn btn--ghost" (click)="cancel()">Cancelar</button>
              <button type="submit" class="btn btn--primary" [disabled]="form.invalid || isSaving()">
                Guardar Cambios
              </button>
            </div>
          </header>

          <div class="detail-form__body form-grid--2">
            <div class="form-field">
              <label>Código / ID</label>
              <input type="text" formControlName="code" />
            </div>
            <div class="form-field">
              <label>Nombre Comercial</label>
              <input type="text" formControlName="name" />
            </div>
          </div>
        </form>
      } @else {
        <div class="detail-placeholder">
          <span class="material-symbols-outlined">touch_app</span>
          <p>Selecciona un elemento de la lista para ver su detalle</p>
        </div>
      }
    </main>

  </div>
</div>
```

---

## ⚙️ Estructura de Signals en TypeScript (`[modulo]-management.component.ts`)

```typescript
@Component({
  selector: 'fg-example-split-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './example-split-view.component.html',
  styleUrl: './example-split-view.component.css'
})
export class ExampleSplitViewComponent implements OnInit {
  private readonly service = inject(ExampleService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  // Signals de estado
  readonly items = signal<ExampleDto[]>([]);
  readonly selectedItem = signal<ExampleDto | null>(null);
  readonly isCreating = signal(false);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly searchTerm = signal('');

  // Computed signals
  readonly totalItems = computed(() => this.items().length);
  readonly activeItemsCount = computed(() => this.items().filter(i => i.status === 'ACTIVE').length);

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.service.getAll().subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.message ?? 'Error al cargar registros');
        this.isLoading.set(false);
      }
    });
  }

  selectItem(item: ExampleDto): void {
    this.isCreating.set(false);
    this.selectedItem.set(item);
    this.form.patchValue(item);
  }

  save(): void {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    // Petición HTTP al Backend (Cero Mocks)
  }
}
```

---

## 🎨 Estilos CSS Clave (`[modulo]-management.component.css`)

```css
:host {
  --navy: #172033;
  --gold: #c5a86b;
  display: block;
}

.split-body {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1.2rem;
  height: calc(100vh - 210px);
}

.split-master {
  background: var(--bg-card);
  border-radius: 18px;
  border: 1px solid var(--border);
  overflow-y: auto;
}

.split-detail {
  background: var(--bg-card);
  border-radius: 18px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

:host-context(.theme-dark) .split-master,
:host-context(.theme-dark) .split-detail {
  background: #151f35;
  border-color: rgba(255, 255, 255, 0.08);
}
```
