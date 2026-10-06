const target = process.env.BACKEND_URL || 'http://localhost:8080';

const PROXY_CONFIG = {
  "/api": {
    "target": target,
    "secure": false,
    "changeOrigin": true,
    "logLevel": "info",
    "headers": {
      "Origin": "http://localhost:4200"
    },
    "onError": (err, req, res) => {
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Backend no disponible en ${target}. Verifica que Spring Boot este corriendo en el puerto 8080.`, details: err.message }));
      }
    }
  }
};

module.exports = PROXY_CONFIG;

