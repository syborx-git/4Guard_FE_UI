# API Contract — Módulo: Usuarios

**Controller:** `UserController.java`  
**Base path:** `/api/v1/users`  
**RBAC Module (FE):** `admin`  
**ID Type:** `UUID` (string en TypeScript)

---

## Endpoints

| Método | Ruta | Permission | Descripción |
|---|---|---|---|
| `GET` | `/users` | `USERS_READ` | Lista todos los usuarios |
| `GET` | `/users/{id}` | `USERS_READ` | Obtener usuario por UUID |
| `GET` | `/users/{id}/audit` | `USERS_READ` o `AUDIT_READ` | Historial de cambios |
| `POST` | `/users` | `USERS_CREATE` | Crear nuevo usuario |
| `PUT` | `/users` | `USERS_UPDATE` | Actualizar usuario (id en body) |
| `DELETE` | `/users/{id}` | `USERS_DELETE` | Eliminar físicamente |
| `PUT` | `/users/{id}/reset-password-temp` | auth requerido | Reset pass por UUID (admin) |
| `PUT` | `/users/reset-password-temp?usernameOrEmail=` | público | Reset pass por username/email |
| `PUT` | `/users/change-password` | JWT (propio) | Cambiar pass temporal → permanente |

---

## Request DTOs → TypeScript

### `UserCreateRequest` → `CreateUserRequest`

```typescript
interface CreateUserRequest {
  username: string;       // requerido, 3-50 chars
  email: string;          // requerido, válido, max 100 chars
  password: string;       // requerido, mínimo 8 chars
  firstName: string;      // requerido, max 50 chars
  lastName: string;       // requerido, max 50 chars
  organizationId: string; // UUID requerido
  branchId: string;       // UUID requerido
  roleId: string;         // UUID requerido
  status?: UserStatus;    // opcional
  isEnabled?: boolean;    // opcional, default true en BE
}
```

### `UserUpdateRequest` → `UpdateUserRequest`

```typescript
interface UpdateUserRequest {
  id: string;             // UUID REQUERIDO (va en body, NO en path)
  username?: string;      // 3-50 chars
  email?: string;         // email válido, max 100 chars
  password?: string;      // mínimo 8 chars (se hashea en BE)
  firstName?: string;     // max 50 chars
  lastName?: string;      // max 50 chars
  organizationId?: string;
  branchId?: string;
  roleId?: string;
  status?: UserStatus;
  isEnabled?: boolean;
}
```

### `ChangePasswordRequest`

```typescript
interface ChangePasswordRequest {
  newPassword: string;    // nueva contraseña permanente
}
```

---

## Response DTOs

### `UserResponse`

```typescript
interface UserResponse {
  id: string;               // UUID
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;   // UUID
  organizationName: string; // ✅ ya resuelto por BE
  branchId: string;         // UUID
  branchName: string;       // ✅ ya resuelto por BE
  roleId: string;           // UUID
  roleName: string;         // ✅ ya resuelto por BE
  status: UserStatus;
  isEnabled: boolean;
  lastLogin: string | null; // OffsetDateTime → ISO 8601
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
```

### `UserAuditResponse`

```typescript
interface UserAuditResponse {
  // Historial cronológico de cambios del usuario
  // (campos específicos a confirmar con BE según implementación)
  action: string;
  performedBy: string;
  performedAt: string;
  details: string;
}
```

---

## Enums

### `UserStatus`

```typescript
enum UserStatus {
  ACTIVE    = 'ACTIVE',
  INACTIVE  = 'INACTIVE',
  PENDING   = 'PENDING',
  SUSPENDED = 'SUSPENDED'
}
```

---

## ApiResponse Wrapper

Todo response del BE viene envuelto:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
// Acceder: response.data
```

---

## ⚠️ Quirks Importantes (no obvios)

1. **`PUT /users` tiene el `id` en el BODY**, no en el path. No usar `PUT /users/{id}`.
2. **`organizationName`, `branchName`, `roleName`** ya vienen resueltos en `UserResponse`. No necesitas hacer joins o calls adicionales en el FE.
3. **`PUT /users/reset-password-temp?usernameOrEmail=`** es **público** (sin auth JWT). Ruta de recuperación de contraseña.
4. **`PUT /users/{id}/reset-password-temp`** requiere auth. Es para que el admin resetee el pass de otro usuario.
5. El campo `id` es `UUID` → en TypeScript usar `string`, no `number`.

---

## TypeScript Service (patrón)

```typescript
// users.service.ts
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getAll(): Observable<UserResponse[]> {
    return this.http.get<ApiResponse<UserResponse[]>>(this.apiUrl)
      .pipe(map(r => r.data));
  }

  getById(id: string): Observable<UserResponse> {
    return this.http.get<ApiResponse<UserResponse>>(`${this.apiUrl}/${id}`)
      .pipe(map(r => r.data));
  }

  create(payload: CreateUserRequest): Observable<UserResponse> {
    return this.http.post<ApiResponse<UserResponse>>(this.apiUrl, payload)
      .pipe(map(r => r.data));
  }

  update(payload: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<ApiResponse<UserResponse>>(this.apiUrl, payload)
      .pipe(map(r => r.data));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`)
      .pipe(map(() => void 0));
  }

  getAuditLogs(id: string): Observable<UserAuditResponse[]> {
    return this.http.get<ApiResponse<UserAuditResponse[]>>(`${this.apiUrl}/${id}/audit`)
      .pipe(map(r => r.data));
  }

  resetPasswordById(id: string): Observable<string> {
    return this.http.put<ApiResponse<string>>(`${this.apiUrl}/${id}/reset-password-temp`, {})
      .pipe(map(r => r.data));
  }

  changePassword(newPassword: string): Observable<void> {
    return this.http.put<ApiResponse<void>>(`${this.apiUrl}/change-password`, { newPassword })
      .pipe(map(() => void 0));
  }
}
```

---

## KPI Cards sugeridas

| KPI | Campo | Ícono | Color |
|---|---|---|---|
| Total Usuarios | `users.length` | `group` | Navy |
| Activos | `filter(status=ACTIVE)` | `check_circle` | Success |
| Inactivos | `filter(status=INACTIVE)` | `cancel` | Muted |
| Pendientes | `filter(status=PENDING)` | `schedule` | Warning |
