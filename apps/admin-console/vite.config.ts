const inMemoryPasses = new Map<string, any>();

const securityGatePlugin = () => ({
  name: 'security-gate-local-bridge',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (!req.url || !req.url.includes('/api/v1/security-gate/')) {
        return next();
      }

      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const path = parsedUrl.pathname;

      // 1. GET /api/v1/security-gate/passes/active
      if (req.method === 'GET' && path.endsWith('/passes/active')) {
        res.setHeader('Content-Type', 'application/json');
        const passes = Array.from(inMemoryPasses.values());
        res.end(JSON.stringify({ success: true, message: 'OK', data: passes }));
        return;
      }

      // 2. POST /api/v1/security-gate/passes/generate
      if (req.method === 'POST' && path.endsWith('/passes/generate')) {
        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const token = data.token || ('PASS-4G-' + Date.now());
            const passObj = {
              id: 'pass-' + Date.now(),
              token: token,
              status: 'PENDING_DRIVER',
              operationType: data.operationType || 'DESCARGA',
              operacion: data.operationType || 'DESCARGA',
              clientCode: data.clientCode || '',
              clientName: data.clientName || '',
              carrierLineCode: data.carrierLineCode || '',
              carrierLine: data.carrierLine || '',
              driverName: data.driverName || '',
              nombreOperador: data.driverName || '',
              tractorPlates: data.tractorPlates || '',
              placasTracto: data.tractorPlates || '',
              docNumber: data.docNumber || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            inMemoryPasses.set(token, passObj);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Pase generado', data: passObj }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
          }
        });
        return;
      }

      // 3. GET /api/v1/security-gate/public/passes/:token
      if (req.method === 'GET' && path.includes('/public/passes/')) {
        const token = path.split('/').pop() || '';
        const pass = inMemoryPasses.get(token);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'OK', data: pass || null }));
        return;
      }

      // 4. POST /api/v1/security-gate/public/passes/:token/submit
      if (req.method === 'POST' && path.includes('/public/passes/') && path.endsWith('/submit')) {
        const parts = path.split('/');
        const token = parts[parts.length - 2];
        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const existing = inMemoryPasses.get(token) || {};
            const updated = {
              ...existing,
              token: token,
              status: 'SUBMITTED',
              operationType: data.operationType || data.operacion || existing.operationType || existing.operacion || 'DESCARGA',
              operacion: data.operationType || data.operacion || existing.operationType || existing.operacion || 'DESCARGA',
              docNumber: data.docNumber || data.noCartaPorte || data.remision || existing.docNumber || '',
              noCartaPorte: data.noCartaPorte || '',
              remision: data.remision || '',
              clientCode: data.clientCode || existing.clientCode || '',
              clientName: data.clientName || existing.clientName || '',
              carrierLineCode: data.carrierLineCode || existing.carrierLineCode || '',
              carrierLine: data.carrierLine || existing.carrierLine || '',
              driverName: data.driverName || data.nombreOperador || existing.driverName || existing.nombreOperador || '',
              nombreOperador: data.driverName || data.nombreOperador || existing.driverName || existing.nombreOperador || '',
              driverLicense: data.driverLicense || '',
              tractorPlates: data.tractorPlates || data.placasTracto || existing.tractorPlates || existing.placasTracto || '',
              placasTracto: data.tractorPlates || data.placasTracto || existing.tractorPlates || existing.placasTracto || '',
              noEcoTractor: data.noEcoTractor || '',
              boxPlates: data.boxPlates || data.placasCaja || '',
              placasCaja: data.boxPlates || data.placasCaja || '',
              boxDimensions: data.boxDimensions || data.medidasCaja || '53 Pies',
              medidasCaja: data.boxDimensions || data.medidasCaja || '53 Pies',
              transportType: data.transportType || data.tipoTransporte || 'Caja Seca',
              tipoTransporte: data.transportType || data.tipoTransporte || 'Caja Seca',
              sealNumbers: data.sealNumbers || [],
              observations: data.observations || '',
              driverSignature: data.driverSignature || '',
              checklistData: data.checklistData || '',
              submittedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            inMemoryPasses.set(token, updated);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Check-in recibido', data: updated }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, message: 'Error de payload' }));
          }
        });
        return;
      }

      // 5. DELETE /api/v1/security-gate/passes/:idOrToken
      if (req.method === 'DELETE' && path.includes('/passes/')) {
        const idOrToken = path.split('/').pop() || '';
        inMemoryPasses.delete(idOrToken);
        for (const [k, v] of inMemoryPasses.entries()) {
          if (v.id === idOrToken || v.token === idOrToken) {
            inMemoryPasses.delete(k);
          }
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, message: 'Pase eliminado' }));
        return;
      }

      next();
    });
  }
});

export default {
  plugins: [securityGatePlugin()],
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    cors: true,
    proxy: {
      '/api': {
        target: 'https://fourguard-be-huzh.onrender.com',
        changeOrigin: true,
        secure: false,
      }
    }
  },
};
