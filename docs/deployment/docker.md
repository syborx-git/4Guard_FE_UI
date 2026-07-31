# 4GUARD WMS — Despliegue y Configuración

---

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar admin-console (puerto 4200)
npm run start:admin

# Iniciar rf-terminal (puerto 4201)
npm run start:rf

# Build de producción
npm run build:admin
npm run build:rf
```

---

## Variables de Entorno

```typescript
// apps/admin-console/src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
};
```

Para producción, actualizar `apiUrl` en `environment.prod.ts` antes del build.

---

## Docker

Ver [`docker/`](../docker/) para configuraciones de contenedores.

```dockerfile
# Build de la app Angular
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:admin

# Servidor Nginx
FROM nginx:alpine
COPY --from=builder /app/dist/apps/admin-console /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

---

## Nginx Config (SPA Routing)

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback — siempre retornar index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API proxy al backend
  location /api/ {
    proxy_pass http://4guard-backend:8080/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

---

## Checklist de Despliegue

```markdown
- [ ] Actualizar `environment.prod.ts` con URL real del backend
- [ ] Ejecutar `npm run build:admin`
- [ ] Verificar que el bundle esté en `dist/apps/admin-console`
- [ ] Configurar Nginx con SPA fallback
- [ ] Verificar HTTPS en producción
- [ ] Verificar CORS en el backend (4Guard_BEAPI)
- [ ] Probar login en producción
- [ ] Verificar que las rutas lazy-loaded funcionen
```
