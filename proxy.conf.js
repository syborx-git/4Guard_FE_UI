const PROXY_CONFIG = {
  "/api": {
    "target": "https://fourguard-be-huzh.onrender.com",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "info",
    "headers": {
      "Origin": "http://localhost:4200"
    },
    "onProxyReq": (proxyReq, req, res) => {
      // Forzar cabeceras de origen para el backend de Render
      proxyReq.setHeader('Origin', 'http://localhost:4200');
      proxyReq.setHeader('Host', 'fourguard-be-huzh.onrender.com');
    },
    "onError": (err, req, res) => {
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Servidor Render iniciando o reconectando', details: err.message }));
      }
    }
  }
};

module.exports = PROXY_CONFIG;
