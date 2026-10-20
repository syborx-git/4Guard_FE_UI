/**
 * @file proxy.conf.js
 * @description Proxy dinámico para Angular Dev Server.
 * Enruta llamadas de /api hacia el backend en Render (https://fourguard-be-huzh.onrender.com).
 * Incluye puente en memoria (Shared Bridge) para el registro de choferes vía Cartel QR público
 * sincronizando instantáneamente el móvil con la pantalla de Caseta de Seguridad.
 */

const target = process.env.BACKEND_URL || 'https://fourguard-be-huzh.onrender.com';

const inMemoryPasses = new Map();
const inMemoryReceptions = new Map();
const inMemoryOutbounds = new Map();

let nextReceptionFolioSeq = 26510;
let nextOutboundFolioSeq = 1;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

const PROXY_CONFIG = {
  "/api": {
    "target": target,
    "secure": false,
    "changeOrigin": true,
    "logLevel": "info",
    "bypass": function(req, res, proxyOptions) {
      const url = req.url || '';

      // ─── 1. INTERCEPTAR RECEPTIONS (RECEPCIONES DE ALMACÉN) ───────────────────
      // 1.1 POST /api/v1/warehouse-receptions/check-in
      if (req.method === 'POST' && url.includes('/warehouse-receptions/check-in')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const folio = data.docNumber ? String(data.docNumber).trim() : String(nextReceptionFolioSeq++);
            const recId = data.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const reception = {
              id: recId,
              folio: folio,
              status: 'REGISTERED',
              checkIn: {
                ...data,
                client: data.clientName || data.client || 'Cliente General',
                carrierLine: data.carrierLine || 'Transportista',
                docNumber: data.docNumber || folio,
                receptionTime: data.receptionTime || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                sealNumbers: data.sealNumbers || [],
              },
              clientName: data.clientName || data.client || 'Cliente General',
              carrierName: data.carrierLine || 'Transportista',
              rampNumber: data.rampNumber || 1,
              rampCode: data.rampCode || `LOC-RAMP-${String(data.rampNumber || 1).padStart(2, '0')}`,
              docNumber: data.docNumber || folio,
              observations: data.observations || '',
              pallets: [],
              createdAt: new Date().toISOString(),
              capturedBy: 'Caseta de Seguridad',
              organizationId: data.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
              branchId: data.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936'
            };
            inMemoryReceptions.set(folio, reception);
            inMemoryReceptions.set(recId, reception);

            sendJson(res, 201, { success: true, message: 'Check-in recibido en Almacén', data: reception });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.2 GET /api/v1/warehouse-receptions (Listado)
      if (req.method === 'GET' && (url === '/api/v1/warehouse-receptions' || url.startsWith('/api/v1/warehouse-receptions?'))) {
        const unique = [];
        const seen = new Set();
        for (const item of inMemoryReceptions.values()) {
          const key = item.folio || item.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        sendJson(res, 200, { success: true, message: 'Listado de recepciones', data: unique });
        return true;
      }

      // 1.3 POST /api/v1/warehouse-receptions/:id/complete
      if (req.method === 'POST' && url.includes('/warehouse-receptions/') && url.endsWith('/complete')) {
        const parts = url.split('/');
        const id = parts[parts.length - 2];
        const rec = inMemoryReceptions.get(id);
        if (rec) {
          rec.status = 'COMPLETED';
          rec.completedAt = new Date().toISOString();
        }
        sendJson(res, 200, { success: true, message: 'Recepción completada', data: rec });
        return true;
      }

      // 1.4 POST /api/v1/warehouse-receptions/:id/cancel
      if (req.method === 'POST' && url.includes('/warehouse-receptions/') && url.endsWith('/cancel')) {
        const parts = url.split('/');
        const id = parts[parts.length - 2];
        const rec = inMemoryReceptions.get(id);
        if (rec) {
          rec.status = 'CANCELLED';
        }
        sendJson(res, 200, { success: true, message: 'Recepción cancelada', data: rec });
        return true;
      }

      // 1.5 PUT /api/v1/warehouse-receptions/:id/parameters
      if (req.method === 'PUT' && url.includes('/warehouse-receptions/') && url.endsWith('/parameters')) {
        const parts = url.split('/');
        const id = parts[parts.length - 2];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const rec = inMemoryReceptions.get(id);
            if (rec) {
              Object.assign(rec, data);
            }
            sendJson(res, 200, { success: true, message: 'Parámetros actualizados', data: rec || data });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.6 GET /api/v1/warehouse-receptions/:id (Detalle individual)
      if (req.method === 'GET' && url.includes('/warehouse-receptions/') && !url.includes('/detect-return') && !url.includes('/next-pallet-number')) {
        const parts = url.split('/');
        const id = parts[parts.length - 1].split('?')[0];
        const rec = inMemoryReceptions.get(id) || null;
        if (rec) {
          sendJson(res, 200, { success: true, data: rec });
          return true;
        }
      }

      // ─── 2. INTERCEPTAR OUTBOUNDS (SALIDAS DE ALMACÉN) ─────────────────────────
      // 2.1 POST /api/v1/warehouse-outbounds/check-in o POST /api/v1/warehouse-outbounds
      if (req.method === 'POST' && (url.includes('/warehouse-outbounds/check-in') || url === '/api/v1/warehouse-outbounds' || url.startsWith('/api/v1/warehouse-outbounds?'))) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const seqStr = String(nextOutboundFolioSeq++).padStart(6, '0');
            const folio = data.remisionNo || data.docNumber ? `OUT-${data.remisionNo || data.docNumber}` : `SAL-2026-${seqStr}`;
            const outId = data.id || `out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const outbound = {
              id: outId,
              folio: folio,
              status: 'REGISTERED',
              clientName: data.clientName || data.client || 'Cliente General',
              carrierName: data.carrierName || data.carrierLine || 'Transportista',
              rampNumber: data.rampNumber || 1,
              rampCode: data.rampCode || `LOC-RAMP-${String(data.rampNumber || 1).padStart(2, '0')}`,
              driverName: data.driverName || 'Chofer Transportista',
              tractorPlates: data.tractorPlates || '',
              boxPlates: data.boxPlates || '',
              remisionNo: data.remisionNo || data.docNumber || folio,
              observations: data.observations || '',
              items: [],
              totalPallets: 0,
              totalPieces: 0,
              createdAt: new Date().toISOString(),
              timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              organizationId: data.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
              branchId: data.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936'
            };
            inMemoryOutbounds.set(folio, outbound);
            inMemoryOutbounds.set(outId, outbound);

            sendJson(res, 201, { success: true, message: 'Pre-salida registrada en Caseta', data: outbound });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 2.2 GET /api/v1/warehouse-outbounds (Listado)
      if (req.method === 'GET' && (url === '/api/v1/warehouse-outbounds' || url.startsWith('/api/v1/warehouse-outbounds?'))) {
        const unique = [];
        const seen = new Set();
        for (const item of inMemoryOutbounds.values()) {
          const key = item.folio || item.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        sendJson(res, 200, { success: true, message: 'Listado de salidas', data: unique });
        return true;
      }

      // ─── 3. INTERCEPTAR PASES DE CASETA (CHOFERES QR) ──────────────────────────
      // 3.1 Interceptar POST de auto-registro del chofer: /api/v1/security-gate/public/passes/:token/submit
      if (req.method === 'POST' && url.includes('/public/passes/') && url.endsWith('/submit')) {
        const parts = url.split('/');
        const token = parts[parts.length - 2];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const passObj = {
              id: token,
              token: token,
              generatedFolio: token,
              status: 'SUBMITTED',
              createdAt: new Date().toISOString(),
              submittedAt: new Date().toISOString(),
              driverName: data.driverName || data.nombreOperador || 'Transportista',
              nombreOperador: data.driverName || data.nombreOperador || 'Transportista',
              carrierLine: data.carrierLine || 'Transporte General',
              clientName: data.clientName || 'General',
              tractorPlates: data.tractorPlates || data.placasTracto || '',
              placasTracto: data.tractorPlates || data.placasTracto || '',
              boxPlates: data.boxPlates || data.placasCaja || '',
              placasCaja: data.boxPlates || data.placasCaja || '',
              docNumber: data.docNumber || data.remision || data.noCartaPorte || '',
              remision: data.remision || '',
              noCartaPorte: data.noCartaPorte || '',
              operationType: data.operationType || data.operacion || 'DESCARGA',
              driverPhone: data.driverPhone || '',
              driverSignature: data.driverSignature || '',
              sealNumbers: data.sealNumbers || [],
              observations: data.observations || '',
              boxDimensions: data.boxDimensions || '53 Pies',
              transportType: data.transportType || 'Tráiler',
              ...data
            };
            inMemoryPasses.set(token, passObj);
            sendJson(res, 200, { success: true, message: 'Check-in recibido en Caseta', data: passObj });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 3.2 Interceptar GET de pase público: /api/v1/security-gate/public/passes/:token
      if (req.method === 'GET' && url.includes('/public/passes/')) {
        const parts = url.split('/');
        const token = parts[parts.length - 1].split('?')[0];
        const pass = inMemoryPasses.get(token) || {
          id: token,
          token: token,
          status: 'PENDING_DRIVER',
          createdAt: new Date().toISOString()
        };
        sendJson(res, 200, { success: true, data: pass });
        return true;
      }

      // 3.3 Interceptar GET de pases activos para Caseta: /api/v1/security-gate/passes/active
      if (req.method === 'GET' && url.includes('/security-gate/passes/active')) {
        const localList = Array.from(inMemoryPasses.values());
        sendJson(res, 200, {
          success: true,
          message: 'Pases activos de Caseta',
          data: localList
        });
        return true;
      }

      // 3.4 Interceptar POST complete de pases: /api/v1/security-gate/passes/:token/complete
      if (req.method === 'POST' && url.includes('/security-gate/passes/') && url.endsWith('/complete')) {
        const parts = url.split('/');
        const token = parts[parts.length - 2];
        inMemoryPasses.delete(token);
        for (const [k, v] of inMemoryPasses.entries()) {
          if (v.id === token || v.token === token) {
            inMemoryPasses.delete(k);
          }
        }
        sendJson(res, 200, { success: true, message: 'Pase completado', data: { folio: token, token } });
        return true;
      }

      // 3.5 Interceptar DELETE de pases: /api/v1/security-gate/passes/:token
      if (req.method === 'DELETE' && url.includes('/security-gate/passes/')) {
        const parts = url.split('/');
        const idOrToken = parts[parts.length - 1].split('?')[0];
        inMemoryPasses.delete(idOrToken);
        for (const [k, v] of inMemoryPasses.entries()) {
          if (v.id === idOrToken || v.token === idOrToken) {
            inMemoryPasses.delete(k);
          }
        }
        sendJson(res, 200, { success: true, message: 'Pase eliminado' });
        return true;
      }

      // Para el resto de peticiones (catálogos, auth, etc.), continuar al backend de Render
      return false;
    },
    "onError": (err, req, res) => {
      if (res && res.writeHead && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Backend no disponible en ${target}.`, details: err.message }));
      }
    }
  }
};

module.exports = PROXY_CONFIG;
