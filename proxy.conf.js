const target = process.env.BACKEND_URL || 'http://127.0.0.1:8080';

const PROXY_CONFIG = {
  "/api": {
    "target": target,
    "secure": false,
    "changeOrigin": true,
    "logLevel": "silent",
    "onError": (err, req, res) => {
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Backend no disponible en ${target}. Verifica que Spring Boot esté corriendo en el puerto 8080.`, details: err.message }));
      }
    }
  }
};

module.exports = PROXY_CONFIG;

