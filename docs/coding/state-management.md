# 4GUARD WMS — Manejo de Estado en Componentes (Angular Signals)

> Patrón estándar para todos los componentes CRUD del `admin-console`.  
> Extraído del patrón establecido en `carrier-management` y `users-list`.

---

## 1. Signals obligatorias en todo componente CRUD

```typescript
@Component({ standalone: true, ... })
export class MyFeatureManagementComponent {

  // ── Servicios ────────────────────────────────────────────
  private readonly service  = inject(MyFeatureService);
  private readonly toast    = inject(ToastService);

  // ── Estado de lista ──────────────────────────────────────
  readonly items      = signal<MyFeatureDto[]>([]);
  readonly isLoading  = signal(false);
  readonly error      = signal<string | null>(null);

  // ── Estado de selección / detalle ────────────────────────
  readonly selected   = signal<MyFeatureDto | null>(null);
  readonly isEditing  = signal(false);   // false = nuevo | true = editando existente

  // ── Estado de operaciones ────────────────────────────────
  readonly isSaving   = signal(false);
  readonly isDeleting = signal(false);

  // ── Estado de UI ─────────────────────────────────────────
  readonly searchTerm        = signal('');
  readonly activeStatusFilter= signal<string>('');

  // ── Computeds derivados ──────────────────────────────────
  readonly filteredItems = computed(() => {
    const term   = this.searchTerm().toLowerCase();
    const status = this.activeStatusFilter();
    return this.items().filter(item => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      return matchesSearch && matchesStatus;
    });
  });

  readonly totalCount    = computed(() => this.items().length);
  readonly activeCount   = computed(() => this.items().filter(i => i.status === 'ACTIVE').length);
  readonly inactiveCount = computed(() => this.items().filter(i => i.status === 'INACTIVE').length);

  // ── KPI signals (para header cards) ─────────────────────
  readonly kpiTotal    = computed(() => this.totalCount());
  readonly kpiActive   = computed(() => this.activeCount());
  // Agregar más según el módulo
}
```

---

## 2. Ciclo de vida: carga inicial

```typescript
readonly destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.loadItems();
}

private loadItems(): void {
  this.isLoading.set(true);
  this.error.set(null);

  this.service.getAll()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (data) => {
        this.items.set(data);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(err.error?.message ?? 'Error al cargar los datos');
        this.isLoading.set(false);
      }
    });
}
```

---

## 3. Selección de item (abrir detalle)

```typescript
onSelectItem(item: MyFeatureDto): void {
  this.selected.set(item);
  this.isEditing.set(true);
}

onCreateNew(): void {
  this.selected.set(null);
  this.isEditing.set(false);
}

onClearSelection(): void {
  this.selected.set(null);
  this.isEditing.set(false);
}
```

---

## 4. Guardar (crear o editar)

```typescript
onSave(formValue: CreateOrUpdateDto): void {
  this.isSaving.set(true);

  const operation$ = this.isEditing()
    ? this.service.update({ id: this.selected()!.id, ...formValue })
    : this.service.create(formValue);

  operation$
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (saved) => {
        this.toast.success(this.isEditing() ? 'Actualizado con éxito' : 'Creado con éxito');
        this.loadItems(); // Refrescar lista
        this.selected.set(saved);
        this.isSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.message ?? 'Error al guardar';
        this.toast.error(msg);
        this.isSaving.set(false);
      }
    });
}
```

---

## 5. Eliminar (con confirmación)

```typescript
// El modal de confirmación es responsabilidad del template HTML.
// El componente solo ejecuta el delete cuando el usuario confirma.
showDeleteDialog = signal(false);

onRequestDelete(): void {
  this.showDeleteDialog.set(true);
}

onConfirmDelete(): void {
  const item = this.selected();
  if (!item) return;

  this.isDeleting.set(true);
  this.showDeleteDialog.set(false);

  this.service.delete(item.id)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: () => {
        this.toast.success('Eliminado con éxito');
        this.items.update(list => list.filter(i => i.id !== item.id));
        this.selected.set(null);
        this.isDeleting.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar');
        this.isDeleting.set(false);
      }
    });
}

onCancelDelete(): void {
  this.showDeleteDialog.set(false);
}
```

---

## 6. Cambio de estado FSM

```typescript
onChangeStatus(newStatus: string, reason?: string): void {
  const item = this.selected();
  if (!item) return;

  this.isSaving.set(true);

  this.service.changeStatus(item.id, { status: newStatus, reason })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (updated) => {
        this.toast.success(`Estado cambiado a ${newStatus}`);
        this.selected.set(updated);
        // Actualizar el item en la lista también
        this.items.update(list => list.map(i => i.id === updated.id ? updated : i));
        this.isSaving.set(false);
      },
      error: (err) => {
        this.toast.error(err.error?.message ?? 'Error al cambiar estado');
        this.isSaving.set(false);
      }
    });
}
```

---

## 7. Cuándo usar signals de shared-core

```typescript
// ✅ Para leer datos del usuario autenticado en un componente
private authState = inject(AuthState);
readonly currentUser = this.authState.user;       // Signal<User|null>
readonly isAdmin     = computed(() => this.authState.hasRole(UserRole.ADMIN));
readonly userName    = this.authState.userFullName; // Signal<string>

// ❌ No re-crear lógica de auth en el componente directamente
```

---

## 8. Anti-patrones a evitar

```typescript
// ❌ Usar BehaviorSubject cuando hay signals disponibles
private _items$ = new BehaviorSubject<Item[]>([]);

// ❌ subscribe en subscribe (callback hell)
this.service.getAll().subscribe(items => {
  this.service.getById(items[0].id).subscribe(...); // ❌
});

// ❌ Mutar signals directamente desde el template
// El template solo llama métodos del componente

// ❌ Usar any en signals
readonly items = signal<any[]>([]); // ❌
readonly items = signal<MyFeatureDto[]>([]); // ✅
```

---

## 9. Search con debounce

```typescript
// En el template: (input)="onSearch($event.target.value)"
onSearch(term: string): void {
  this.searchTerm.set(term);
  // El computed filteredItems() se actualiza automáticamente
}
```

Sin `debounceTime` en signals — el computed es lazy y eficiente.  
Si necesitas debounce para llamadas HTTP (search server-side), usar `fromEvent` + `debounceTime`.
