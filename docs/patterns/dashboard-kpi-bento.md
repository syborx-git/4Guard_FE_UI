# Patrón 2: Dashboard & Bento Grid (Torres de Control y Hubs Executivos)

> **Ubicación:** `docs/patterns/dashboard-kpi-bento.md`  
> **Aplica a:** Torre de Control (`/dashboard`), Consola Administrativa (`/admin`), Monitores Ejecutivos.

---

## 📐 Wireframe del Patrón

```
+---------------------------------------------------------------------------------+
| HERO HEADER (Título + Saludo + Quick Refresh + Reloj UTC)                      |
+---------------------------------------------------------------------------------+
| KPI METRICS GRID (4 Columnas)                                                   |
| [ KPI 1: Operaciones ] [ KPI 2: Ocupación ] [ KPI 3: Alertas ] [ KPI 4: SLAs ]  |
+---------------------------------------------------------------------------------+
| BENTO GRID DISPOSITION (3 Columnas de tarjetas de acceso o gráficas)           |
| +-------------------------+ +-------------------------+ +---------------------+ |
| | Card 1: Estructura      | | Card 2: Mercancía       | | Card 3: Seguridad   | |
| | PASILLOS / SECCIONES    | | SKUs / CLIENTES 3PL     | | USUARIOS / ROLES  | |
| +-------------------------+ +-------------------------+ +---------------------+ |
| +-----------------------------------------------------+ +---------------------+ |
| | Monitor de Actividad y Gráfico en Tiempo Real        | | Card 4: Soporte    | |
| +-----------------------------------------------------+ +---------------------+ |
+---------------------------------------------------------------------------------+
```

---

## 🧱 Estructura Esquelética HTML (`dashboard.component.html`)

```html
<div class="dashboard-page">

  <!-- 1. HERO BAR -->
  <header class="dash-hero">
    <div class="dash-hero__title-wrap">
      <span class="material-symbols-outlined dash-hero__icon">dashboard</span>
      <div>
        <h1 class="dash-hero__title">Torre de Control WMS</h1>
        <p class="dash-hero__sub">Monitoreo operacional y métricas en tiempo real</p>
      </div>
    </div>
    <div class="dash-hero__status">
      <span class="live-dot"></span>
      <span>Actualizado: {{ lastUpdated() | date:'HH:mm:ss' }}</span>
      <button class="btn-refresh" (click)="refresh()"><span class="material-symbols-outlined">refresh</span></button>
    </div>
  </header>

  <!-- 2. KPI METRICS (4 COLUMNAS) -->
  <section class="kpi-grid">
    <article class="kpi-card kpi-card--gold">
      <div class="kpi-card__icon"><span class="material-symbols-outlined">shelves</span></div>
      <div class="kpi-card__content">
        <span class="kpi-card__value">{{ totalCapacity() }}%</span>
        <span class="kpi-card__label">OCUPACIÓN DE ALMACÉN</span>
      </div>
    </article>

    <article class="kpi-card kpi-card--blue">
      <div class="kpi-card__icon"><span class="material-symbols-outlined">move_to_inbox</span></div>
      <div class="kpi-card__content">
        <span class="kpi-card__value">{{ activeReceipts() }}</span>
        <span class="kpi-card__label">RECEPCIONES ACTIVAS</span>
      </div>
    </article>

    <article class="kpi-card kpi-card--danger">
      <div class="kpi-card__icon"><span class="material-symbols-outlined">warning</span></div>
      <div class="kpi-card__content">
        <span class="kpi-card__value">{{ activeIncidences() }}</span>
        <span class="kpi-card__label">INCIDENCIAS DE CALIDAD</span>
      </div>
    </article>

    <article class="kpi-card kpi-card--green">
      <div class="kpi-card__icon"><span class="material-symbols-outlined">verified</span></div>
      <div class="kpi-card__content">
        <span class="kpi-card__value">99.4%</span>
        <span class="kpi-card__label">ACCURACY DE INVENTARIO</span>
      </div>
    </article>
  </section>

  <!-- 3. BENTO GRID DE TARJETAS ACCESIBLES -->
  <section class="bento-grid">
    @for (card of bentoCards(); track card.id) {
      <article class="bento-card" (click)="navigateTo(card.route)">
        <div class="bento-card__header">
          <span class="material-symbols-outlined bento-card__icon">{{ card.icon }}</span>
          <span class="bento-card__badge" *ngIf="card.badge">{{ card.badge }}</span>
        </div>
        <h3 class="bento-card__title">{{ card.title }}</h3>
        <p class="bento-card__desc">{{ card.description }}</p>
        <div class="bento-card__action">
          <span>Ingresar</span>
          <span class="material-symbols-outlined">arrow_forward</span>
        </div>
      </article>
    }
  </section>

</div>
```

---

## ⚙️ TypeScript con Signals (`dashboard.component.ts`)

```typescript
@Component({
  selector: 'fg-dashboard-pattern',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dashboard-pattern.component.html',
  styleUrl: './dashboard-pattern.component.css'
})
export class DashboardPatternComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly lastUpdated = signal(new Date());
  readonly totalCapacity = signal(84);
  readonly activeReceipts = signal(12);
  readonly activeIncidences = signal(3);

  readonly bentoCards = signal([
    { id: '1', title: 'Estructura de Almacén', icon: 'warehouse', description: 'Configurar zonas, sucursales y ubicaciones físicas.', route: '/layout' },
    { id: '2', title: 'Catálogo de Mercancía', icon: 'inventory_2', description: 'SKUs, clientes 3PL y depositantes logísticos.', route: '/skus' },
    { id: '3', title: 'Seguridad y Permisos', icon: 'shield_lock', description: 'Usuarios, roles y matriz de permisos RBAC.', route: '/roles' },
    { id: '4', title: 'Auditoría y Monitoreo', icon: 'find_in_page', description: 'Historial forense y logs de actividad por usuario.', route: '/user-activity' }
  ]);

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.lastUpdated.set(new Date());
    // Peticiones HTTP a BE para actualizar KPIs
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
```
