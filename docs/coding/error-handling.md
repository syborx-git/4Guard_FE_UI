# 4GUARD WMS — Manejo de Errores HTTP

> Patrón estándar para admin-console.  
> El `authInterceptor` ya maneja el 401 automáticamente.

---

## Flujo de errores por código HTTP

```
HTTP Error
    │
    ├─ 401 Unauthorized
    │    └── authInterceptor → intenta refreshToken()
    │         ├── Éxito: reintenta la petición original transparentemente
    │         └── Falla: clearSessionAndRedirect('session_expired') → /login
    │
    ├─ 403 Forbidden
    │    └── El componente maneja con toast.error('Sin permisos suficientes')
    │
    ├─ 404 Not Found
    │    └── El componente maneja con error signal + UI vacía
    │
    ├─ 400 Bad Request
    │    └── El componente extrae err.error?.message → toast.error()
    │
    ├─ 409 Conflict
    │    └── El componente extrae err.error?.message → toast.warning()
    │
    ├─ 422 Unprocessable Entity (FSM inválido)
    │    └── toast.warning('Transición de estado no permitida')
    │
    └─ 500+ Server Error
         └── toast.error('Error en el servidor. Intenta de nuevo.')
```

---

## Patrón en servicios HTTP

Los servicios **no manejan** el error, lo propagan hacia el componente:

```typescript
// ✅ Patrón correcto en todos los servicios del admin-console
// (ver UsersService para el ejemplo canónico)

getAll(): Observable<ApiResponse<MyDto[]>> {
  return this.http
    .get<ApiResponse<MyDto[]>>(this.API_URL)
    .pipe(
      catchError((error: HttpErrorResponse) => throwError(() => error))
    );
}
```

---

## Patrón en componentes

```typescript
// ── 1. Para carga de datos (ngOnInit / loadItems) ──────────
private loadItems(): void {
  this.isLoading.set(true);
  this.error.set(null);

  this.service.getAll()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (response) => {
        this.items.set(response.data);   // ← extraer .data del ApiResponse
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = this.extractMessage(err);
        this.error.set(msg);             // ← para mostrar en UI vacía
        this.isLoading.set(false);
      }
    });
}

// ── 2. Para operaciones de escritura (save, delete, status) ─
onSave(payload: CreateDto): void {
  this.isSaving.set(true);

  this.service.create(payload)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (response) => {
        this.toast.success('Creado con éxito');
        this.isSaving.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const msg = this.extractMessage(err);
        this.toast.error(msg);           // ← siempre toast para escrituras
        this.isSaving.set(false);
      }
    });
}

// ── Helper privado ────────────────────────────────────────
private extractMessage(err: HttpErrorResponse): string {
  // El BE devuelve: { success: false, message: '...', data: null }
  return err.error?.message
    ?? err.message
    ?? 'Ocurrió un error inesperado';
}
```

---

## `ToastService` — API completa

```typescript
// Ubicación: apps/admin-console/src/app/core/services/toast.service.ts
// Import: inject(ToastService)

toast.success('Transportista creado con éxito');   // verde, 3000ms
toast.error('Error al eliminar el registro');      // rojo, 3000ms
toast.warning('El RFC ya existe para otro transportista'); // amarillo
toast.info('Cargando datos...');                    // azul
toast.dismiss(toastId);                            // dismiss manual

// Duraciones personalizadas
toast.success('Guardado', 5000);
toast.error('Error crítico', 6000);
```

### `ToastContainerComponent`

El `ToastContainerComponent` ya está montado en el `AppComponent`. No necesitas agregarlo por módulo.

---

## Errores de validación de formularios

Para errores 400 de validación de campos, el BE devuelve:

```json
{
  "success": false,
  "message": "Datos de entrada inválidos",
  "data": null
}
```

**No hay lista de errores por campo** — el mensaje es global.  
Mostrar: `toast.error(err.error?.message ?? 'Verifica los datos del formulario')`.

---

## Tabla de mensajes estándar

| Código | Cuándo | Acción en FE |
|---|---|---|
| 400 | Validación fallida | `toast.error(message)` |
| 401 | Token expirado | Automático (interceptor) |
| 403 | Sin permiso | `toast.error('Sin permisos suficientes')` |
| 404 | Entidad no encontrada | `this.error.set(message)` + UI vacía |
| 409 | Duplicado / conflicto | `toast.warning(message)` |
| 422 | FSM inválido | `toast.warning('Transición no permitida')` |
| 500 | Error servidor | `toast.error('Error en el servidor')` |
