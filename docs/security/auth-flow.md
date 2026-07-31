# 4GUARD WMS — Seguridad y Autenticación

---

## Flujo de Autenticación

```
Usuario → Login Form → POST /auth/login → JWT Token
                                              ↓
                                    localStorage (token + refreshToken)
                                              ↓
                                    AuthInterceptor adjunta token
                                              ↓
                                    rbacGuard verifica módulo
                                              ↓
                                    Componente renderiza
```

---

## JWT y Roles

### Roles disponibles (UserRole enum)
```typescript
enum UserRole {
  SYSADMIN   = 'SYSADMIN',   // Acceso total
  ADMIN      = 'ADMIN',      // Gestión completa del WMS
  SUPERVISOR = 'SUPERVISOR', // Supervisión de operaciones
  OPERATOR   = 'OPERATOR',   // Operaciones RF Terminal
  VIEWER     = 'VIEWER',     // Solo lectura
}
```

### Matrix de acceso por módulo

| Módulo | SYSADMIN | ADMIN | SUPERVISOR | OPERATOR | VIEWER |
|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `carriers` | ✅ | ✅ | ✅ | ❌ | 👁️ |
| `layout` | ✅ | ✅ | ✅ | ❌ | 👁️ |
| `inventory` | ✅ | ✅ | ✅ | ✅ | 👁️ |
| `receiving` | ✅ | ✅ | ✅ | ✅ | 👁️ |
| `shipping` | ✅ | ✅ | ✅ | ✅ | 👁️ |
| `performance` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `license-management` | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Guards

### `authGuard`
Verifica que exista un JWT válido en el store de sesión. Si no hay token, redirige a `/login`.

### `rbacGuard`
Lee `data.module` de la ruta activa y verifica que el usuario tenga permiso. Redirige a `/dashboard` si no tiene acceso.

### `changePasswordGuard`
Verifica `changePasswordRequired === true` en el JWT. Solo permite acceso a `/change-password`. Si el flag es `false`, redirige al dashboard.

### `lockoutGuard` (HU-010)
Intercepta `/login` ANTES de renderizar. Si el usuario está en estado de lockout (demasiados intentos fallidos), muestra pantalla de bloqueo temporal.

---

## Políticas de Seguridad

### Sesiones Activas (HU-011)
- El backend mantiene registro de todas las sesiones JWT activas
- El admin puede forzar cierre de sesión remoto
- Vista: `/sessions` — `ActiveSessionsMonitorComponent`

### Auditoría (HU-146)
- Todas las acciones de creación/modificación/eliminación se registran en el backend
- La UI muestra un timeline de auditoría en los formularios de detalle

---

## Lockout por intentos fallidos (HU-010)

- Máximo 5 intentos fallidos → bloqueo temporal
- El `lockoutGuard` revisa el estado antes de mostrar el form de login
- El unlock puede hacerse desde el Admin Panel

---

## HTTPS en producción

```nginx
# Configuración Nginx para producción
server {
  listen 443 ssl;
  ssl_certificate /etc/ssl/4guard.crt;
  ssl_certificate_key /etc/ssl/4guard.key;

  # Security headers
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
  add_header Content-Security-Policy "default-src 'self'";
}
```
