# ===============================================================
# Etapa 1: Compilación de ambas aplicaciones (Node 20 Alpine)
# ===============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Limitar el uso de memoria de Node para no competir con apps de producción
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Copiar configuración de dependencias y .npmrc (legacy-peer-deps para Angular 17)
COPY package*.json .npmrc ./

# Instalación optimizada y limpia de dependencias
RUN npm ci --prefer-offline --no-audit

# Copiar el código fuente completo
COPY . .

# Compilar ambas aplicaciones (rutas relativas apiBaseUrl="" para que Nginx las dirija al backend)
RUN npm run build:admin && npm run build:rf

# ===============================================================
# Etapa 2: Servidor Web Ultra-Ligero (Nginx Alpine < 25 MB)
# Consumo en tiempo de ejecución: ~15 MB de RAM
# ===============================================================
FROM nginx:alpine

# Limpiar archivos por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar bundles compilados desde la etapa anterior
COPY --from=builder /app/dist/admin-console/browser /usr/share/nginx/html/admin-console
COPY --from=builder /app/dist/rf-terminal/browser /usr/share/nginx/html/rf-terminal

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer puertos internos (8080: Admin, 8081: Tablet RF)
EXPOSE 8080 8081

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
