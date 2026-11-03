/**
 * @file proxy.conf.js
 * @description Proxy dinámico para Angular Dev Server.
 * Enruta llamadas de /api hacia el backend en Render (https://fourguard-be-huzh.onrender.com).
 * Incluye puente compartido basado en archivo local (.proxy-shared-state.json) para conectar
 * instantáneamente la Caseta de Seguridad (puerto 4200) con la Terminal RF de Operaciones (puerto 4201),
 * manteniendo sincronizados pases QR, unidades en planta, recepciones y misiones de montacargas.
 */

const path = require('path');
const fs = require('fs');

const target = process.env.BACKEND_URL || 'https://fourguard-be-huzh.onrender.com';
const SHARED_STATE_FILE = path.join(__dirname, '.proxy-shared-state.json');

function loadState() {
  try {
    if (fs.existsSync(SHARED_STATE_FILE)) {
      const content = fs.readFileSync(SHARED_STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[Proxy] Error loading state from disk:', e.message);
  }
  return {
    receptions: {},
    outbounds: {},
    passes: {},
    nextReceptionFolioSeq: 26515,
    nextOutboundFolioSeq: 5
  };
}

function saveState(state) {
  try {
    fs.writeFileSync(SHARED_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[Proxy] Error saving state to disk:', e.message);
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-branch-id'
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
      const cleanUrl = url.split('?')[0];

      // Manejar preflight CORS
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-branch-id'
        });
        res.end();
        return true;
      }

      // 1.1 POST /api/v1/warehouse-receptions/check-in
      if (req.method === 'POST' && url.includes('/warehouse-receptions/check-in')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const state = loadState();
            const folio = data.docNumber ? String(data.docNumber).trim() : String(state.nextReceptionFolioSeq++);
            const recId = data.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const clientName = data.clientName || data.client || 'Cliente General';
            const carrierLine = data.carrierLine || data.carrierName || 'Transportista';
            const rampNum = Number(data.rampNumber || 1);
            const rampCode = data.rampCode || `LOC-RAMP-${String(rampNum).padStart(2, '0')}`;
            const driverName = data.driverName || 'Chofer Transportista';
            const tractorPlates = (data.tractorPlates || '').toUpperCase();
            const boxPlates = (data.boxPlates || '').toUpperCase();
            const sealNumbers = Array.isArray(data.sealNumbers) ? data.sealNumbers : (data.sealNumber ? [data.sealNumber] : []);

            const reception = {
              id: recId,
              folio: folio,
              status: 'REGISTERED',
              clientName: clientName,
              client: clientName,
              carrierName: carrierLine,
              carrierLine: carrierLine,
              rampNumber: rampNum,
              rampCode: rampCode,
              driverName: driverName,
              tractorPlates: tractorPlates,
              boxPlates: boxPlates,
              docNumber: folio,
              remisionNo: folio,
              remision: folio,
              sealNumbers: sealNumbers,
              sealNumber: sealNumbers.join(', '),
              sku: data.sku || 'SKU-INBOUND',
              productName: data.productName || `${clientName} - Carga Inbound`,
              lotNumber: data.lotNumber || `LOT-${new Date().getFullYear()}-01`,
              totalPieces: Number(data.totalPieces || data.pieces || 48),
              palletsExpected: Number(data.palletsExpected || data.totalPallets || 24),
              totalPallets: Number(data.totalPallets || data.palletsExpected || 24),
              totalWeight: Number(data.totalWeight || (48 * 17.5)),
              observations: data.observations || '',
              pallets: data.pallets || [],
              checkIn: {
                ...data,
                client: clientName,
                clientName: clientName,
                carrierLine: carrierLine,
                carrierName: carrierLine,
                docNumber: folio,
                rampNumber: rampNum,
                rampCode: rampCode,
                driverName: driverName,
                tractorPlates: tractorPlates,
                boxPlates: boxPlates,
                sealNumbers: sealNumbers,
                receptionTime: data.receptionTime || new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              },
              createdAt: new Date().toISOString(),
              capturedBy: data.capturedBy || 'Caseta de Seguridad',
              organizationId: data.organizationId || 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
              branchId: data.branchId || 'b73f0907-9fa5-4bdf-87db-2eb5e7683936'
            };

            state.receptions[folio] = reception;
            state.receptions[recId] = reception;
            saveState(state);

            sendJson(res, 201, { success: true, message: 'Check-in recibido en Almacén', data: reception });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.2 GET /api/v1/warehouse-receptions (Listado de recepciones para Operaciones y Terminal RF)
      if (req.method === 'GET' && (url === '/api/v1/warehouse-receptions' || url.startsWith('/api/v1/warehouse-receptions?'))) {
        const state = loadState();
        const unique = [];
        const seen = new Set();
        for (const item of Object.values(state.receptions || {})) {
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
        const state = loadState();
        let targetRec = state.receptions[id];
        if (!targetRec) {
          for (const item of Object.values(state.receptions || {})) {
            if (item.id === id || item.folio === id) {
              targetRec = item;
              break;
            }
          }
        }
        if (targetRec) {
          targetRec.status = 'COMPLETED';
          targetRec.completedAt = new Date().toISOString();
          saveState(state);
        }
        sendJson(res, 200, { success: true, message: 'Recepción completada', data: targetRec });
        return true;
      }

      // 1.4 POST /api/v1/warehouse-receptions/:id/cancel
      if (req.method === 'POST' && url.includes('/warehouse-receptions/') && url.endsWith('/cancel')) {
        const parts = url.split('/');
        const id = parts[parts.length - 2];
        const state = loadState();
        let targetRec = state.receptions[id];
        if (!targetRec) {
          for (const item of Object.values(state.receptions || {})) {
            if (item.id === id || item.folio === id) {
              targetRec = item;
              break;
            }
          }
        }
        if (targetRec) {
          targetRec.status = 'CANCELLED';
          targetRec.cancelledAt = new Date().toISOString();
          saveState(state);
        }
        sendJson(res, 200, { success: true, message: 'Recepción cancelada', data: targetRec });
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
            const state = loadState();
            let targetRec = state.receptions[id];
            if (!targetRec) {
              for (const item of Object.values(state.receptions || {})) {
                if (item.id === id || item.folio === id) {
                  targetRec = item;
                  break;
                }
              }
            }
            if (targetRec) {
              Object.assign(targetRec, data);
              saveState(state);
            }
            sendJson(res, 200, { success: true, message: 'Parámetros actualizados', data: targetRec || data });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.5.1 GET /api/v1/warehouse-receptions/next-pallet-number
      if (req.method === 'GET' && url.includes('/warehouse-receptions/next-pallet-number')) {
        sendJson(res, 200, {
          success: true,
          message: 'Siguiente número de pallet generado',
          data: { nextPalletNumber: 1 }
        });
        return true;
      }

      // 1.6 GET /api/v1/warehouse-receptions/:id (Detalle individual)
      if (req.method === 'GET' && url.includes('/warehouse-receptions/') && !url.includes('/detect-return') && !url.includes('/next-pallet-number')) {
        const parts = url.split('/');
        const id = parts[parts.length - 1].split('?')[0];
        const state = loadState();
        let rec = state.receptions[id];
        if (!rec) {
          for (const item of Object.values(state.receptions || {})) {
            if (item.id === id || item.folio === id) {
              rec = item;
              break;
            }
          }
        }
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
            const state = loadState();
            const seqStr = String(state.nextOutboundFolioSeq++).padStart(6, '0');
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
            state.outbounds[folio] = outbound;
            state.outbounds[outId] = outbound;
            saveState(state);

            sendJson(res, 201, { success: true, message: 'Pre-salida registrada en Caseta', data: outbound });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 2.2 GET /api/v1/warehouse-outbounds (Listado)
      if (req.method === 'GET' && (url === '/api/v1/warehouse-outbounds' || url.startsWith('/api/v1/warehouse-outbounds?'))) {
        const state = loadState();
        const unique = [];
        const seen = new Set();
        for (const item of Object.values(state.outbounds || {})) {
          const key = item.folio || item.id;
          if (key && !seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        sendJson(res, 200, { success: true, message: 'Listado de salidas', data: unique });
        return true;
      }

      // ─── 3. INTERCEPTAR PASES DE CASETA (CHOFERES QR Y CONTROL DE PATIO) ──────
      // 3.0a GET catálogos públicos para auto-registro móvil: /api/v1/security-gate/public/catalogs
      if (req.method === 'GET' && cleanUrl.includes('/security-gate/public/catalogs')) {
        sendJson(res, 200, {
          success: true,
          data: {
            clients: [
              { id: '87c07cb2-61c3-4006-a88c-265bd1eee2df', code: '87c07cb2-61c3-4006-a88c-265bd1eee2df', name: 'MARCAS NESTLE S.A. DE C.V.' },
              { id: 'c083251b-e210-494e-80f3-38814eaba992', code: 'c083251b-e210-494e-80f3-38814eaba992', name: 'NESTLE MEXICO S.A. DE C.V.' },
              { id: 'edc885c6-0216-405a-84cc-841f47f30f48', code: 'edc885c6-0216-405a-84cc-841f47f30f48', name: 'QUALAMEX S.A. DE C.V.' }
            ],
            carriers: [
              { id: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', code: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', name: 'TRANSPORTE GOLA', tradeName: 'TRANSPORTE GOLA' },
              { id: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', code: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', name: 'TRANSPORTE DIAZ', tradeName: 'TRANSPORTE DIAZ' },
              { id: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', code: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', name: 'TRANSPORTE TUM', tradeName: 'TRANSPORTE TUM' },
              { id: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', code: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', name: 'TRANSPORTE EBEN EZER', tradeName: 'TRANSPORTE EBEN EZER' },
              { id: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', code: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', name: 'TRANSPORTE MONCHO', tradeName: 'TRANSPORTE MONCHO' }
            ],
            carrierLines: [
              { id: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', code: 'b811e3c8-ec2f-43b0-9bea-70acbcfc15af', name: 'TRANSPORTE GOLA', tradeName: 'TRANSPORTE GOLA' },
              { id: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', code: '0142ab81-1d79-4c2b-a513-b5454b7f38f0', name: 'TRANSPORTE DIAZ', tradeName: 'TRANSPORTE DIAZ' },
              { id: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', code: '9be19da3-a0fe-475a-9ddb-a19e98c4324f', name: 'TRANSPORTE TUM', tradeName: 'TRANSPORTE TUM' },
              { id: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', code: '3df5cf16-8fc1-428f-bfe5-e24c3e7efff4', name: 'TRANSPORTE EBEN EZER', tradeName: 'TRANSPORTE EBEN EZER' },
              { id: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', code: '57135442-04c1-42b5-9ecb-e6b2b1289a7b', name: 'TRANSPORTE MONCHO', tradeName: 'TRANSPORTE MONCHO' }
            ],
            transportTypes: ['Tortón', 'Tráiler', 'Camioneta', 'Otro (Especificar)'],
            boxDimensions: ['53 Pies', '48 Pies', '40 Pies', '20 Pies', 'Tortón', 'Rabón', '3.5 Toneladas', 'N/A - Plataforma', 'Otra Medida']
          }
        });
        return true;
      }

      // 3.0 POST /api/v1/security-gate/passes/generate
      if (req.method === 'POST' && cleanUrl.includes('/security-gate/passes/generate')) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const state = loadState();
            const token = `PASS-4G-${Date.now().toString().slice(-6)}`;
            const pass = {
              id: token,
              token: token,
              generatedFolio: token,
              status: 'PENDING_DRIVER',
              createdAt: new Date().toISOString(),
              ...data
            };
            state.passes[token] = pass;
            saveState(state);
            sendJson(res, 201, { success: true, message: 'Pase QR generado', data: pass });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 3.1 POST auto-registro del chofer: /api/v1/security-gate/public/passes/:token/submit
      if (req.method === 'POST' && cleanUrl.includes('/public/passes/') && cleanUrl.endsWith('/submit')) {
        const parts = cleanUrl.split('/');
        const submitIdx = parts.indexOf('submit');
        const token = submitIdx > 0 ? parts[submitIdx - 1] : parts[parts.length - 2];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const state = loadState();
            const existing = state.passes[token] || {};
            const passObj = {
              id: token,
              token: token,
              generatedFolio: token,
              status: data.status || 'SUBMITTED',
              createdAt: existing.createdAt || new Date().toISOString(),
              submittedAt: new Date().toISOString(),
              driverName: (data.driverName || data.nombreOperador || 'Transportista').trim().toUpperCase(),
              nombreOperador: (data.driverName || data.nombreOperador || 'Transportista').trim().toUpperCase(),
              carrierLine: (data.carrierLine || 'Transporte General').trim().toUpperCase(),
              carrierLineCode: data.carrierLineCode || '',
              clientName: (data.clientName || 'General').trim().toUpperCase(),
              clientCode: data.clientCode || '',
              tractorPlates: (data.tractorPlates || data.placasTracto || '').trim().toUpperCase(),
              placasTracto: (data.tractorPlates || data.placasTracto || '').trim().toUpperCase(),
              noEcoTractor: (data.noEcoTractor || data.tractorPlates || data.placasTracto || 'S/N').trim().toUpperCase(),
              boxPlates: (data.boxPlates || data.placasCaja || '').trim().toUpperCase(),
              placasCaja: (data.boxPlates || data.placasCaja || '').trim().toUpperCase(),
              noEcoCaja: (data.noEcoCaja || 'S/N').trim().toUpperCase(),
              docNumber: (data.docNumber || data.remision || data.noCartaPorte || '').trim().toUpperCase(),
              remision: (data.remision || data.docNumber || '').trim().toUpperCase(),
              noCartaPorte: (data.noCartaPorte || '').trim().toUpperCase(),
              operationType: (data.operationType || data.operacion || 'DESCARGA').trim().toUpperCase(),
              operacion: (data.operationType || data.operacion || 'DESCARGA').trim().toUpperCase(),
              driverPhone: (data.driverPhone || '').trim(),
              driverSignature: data.driverSignature || '',
              sealNumbers: Array.isArray(data.sealNumbers) ? data.sealNumbers : (data.sealNumber ? [data.sealNumber] : []),
              observations: (data.observations || 'REGISTRO COMPLETADO POR CHOFER VÍA SMARTPHONE').trim().toUpperCase(),
              boxDimensions: (data.boxDimensions || data.medidasCaja || '53 Pies').trim(),
              medidasCaja: (data.boxDimensions || data.medidasCaja || '53 Pies').trim(),
              transportType: (data.transportType || data.tipoTransporte || 'Tráiler').trim(),
              tipoTransporte: (data.transportType || data.tipoTransporte || 'Tráiler').trim(),
              ...data,
              // Asegurar que el status sea el correcto
              status: data.status || 'SUBMITTED'
            };
            state.passes[token] = passObj;
            saveState(state);
            sendJson(res, 200, { success: true, message: 'Check-in recibido en Caseta', data: passObj });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 3.2 GET de pase público: /api/v1/security-gate/public/passes/:token
      if (req.method === 'GET' && cleanUrl.includes('/public/passes/')) {
        const parts = cleanUrl.split('/');
        const token = parts[parts.length - 1].split('?')[0];
        const state = loadState();
        let pass = state.passes[token];
        if (!pass) {
          for (const item of Object.values(state.passes || {})) {
            if (item.token === token || item.id === token || item.generatedFolio === token) {
              pass = item;
              break;
            }
          }
        }
        if (!pass) {
          pass = {
            id: token,
            token: token,
            status: 'PENDING_DRIVER',
            createdAt: new Date().toISOString()
          };
        }
        sendJson(res, 200, { success: true, data: pass });
        return true;
      }

      // 3.3 GET de pases activos para Caseta: /api/v1/security-gate/passes/active
      if (req.method === 'GET' && cleanUrl.includes('/security-gate/passes/active')) {
        const state = loadState();
        const localList = Object.values(state.passes || {}).filter(p => p.status === 'SUBMITTED' || p.status === 'PENDING_DRIVER');
        sendJson(res, 200, {
          success: true,
          message: 'Pases activos de Caseta',
          data: localList
        });
        return true;
      }

      // 3.4 GET Unidades en Planta (Patio): /api/v1/security-gate/passes/in-yard
      if (req.method === 'GET' && url.includes('/security-gate/passes/in-yard')) {
        const state = loadState();
        const inYardList = [];
        const seen = new Set();

        // Recepciones activas en planta
        for (const r of Object.values(state.receptions || {})) {
          const key = (r.folio || r.id || '').trim().toUpperCase();
          if (key && !seen.has(key) && r.status !== 'COMPLETED_EXIT' && r.status !== 'CANCELLED') {
            seen.add(key);
            inYardList.push({
              id: r.id,
              token: r.folio,
              generatedFolio: r.folio,
              status: r.status === 'COMPLETED' ? 'READY_FOR_EXIT' : 'IN_YARD',
              warehouseStatus: r.status,
              isReadyForExit: r.status === 'COMPLETED',
              operationType: 'DESCARGA',
              driverName: r.driverName || r.checkIn?.driverName || 'Operador Chofer',
              carrierLine: r.carrierName || r.carrierLine || 'Transportista',
              clientName: r.clientName || r.client || 'Cliente General',
              tractorPlates: r.tractorPlates || r.checkIn?.tractorPlates || '',
              boxPlates: r.boxPlates || r.checkIn?.boxPlates || '',
              docNumber: r.docNumber || r.folio,
              rampNumber: r.rampNumber,
              rampCode: r.rampCode,
              receptionTime: r.checkIn?.receptionTime || new Date(r.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              createdAt: r.createdAt,
              sealNumbers: r.sealNumbers || []
            });
          }
        }

        // Salidas activas en planta
        for (const o of Object.values(state.outbounds || {})) {
          const key = (o.folio || o.id || '').trim().toUpperCase();
          if (key && !seen.has(key) && o.status !== 'COMPLETED_EXIT') {
            seen.add(key);
            inYardList.push({
              id: o.id,
              token: o.folio,
              generatedFolio: o.folio,
              status: o.status === 'COMPLETED' ? 'READY_FOR_EXIT' : 'IN_YARD',
              warehouseStatus: o.status,
              isReadyForExit: o.status === 'COMPLETED',
              operationType: 'CARGA',
              driverName: o.driverName || 'Operador Chofer',
              carrierLine: o.carrierName || 'Transportista',
              clientName: o.clientName || 'Cliente General',
              tractorPlates: o.tractorPlates || '',
              boxPlates: o.boxPlates || '',
              docNumber: o.remisionNo || o.folio,
              rampNumber: o.rampNumber,
              rampCode: o.rampCode,
              receptionTime: o.timestamp || new Date(o.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              createdAt: o.createdAt
            });
          }
        }

        sendJson(res, 200, { success: true, message: 'Unidades activas en patio', data: inYardList });
        return true;
      }

      // 3.5 GET Historial de Salidas: /api/v1/security-gate/passes/history
      if (req.method === 'GET' && url.includes('/security-gate/passes/history')) {
        const state = loadState();
        const historyList = [];
        const seen = new Set();
        for (const r of Object.values(state.receptions || {})) {
          const key = (r.folio || r.id || '').trim().toUpperCase();
          if (key && !seen.has(key) && (r.status === 'COMPLETED_EXIT' || r.status === 'CANCELLED')) {
            seen.add(key);
            historyList.push({
              id: r.id,
              token: r.folio,
              generatedFolio: r.folio,
              status: r.status,
              warehouseStatus: r.status,
              operationType: 'DESCARGA',
              driverName: r.driverName || r.checkIn?.driverName,
              carrierLine: r.carrierName || r.carrierLine,
              clientName: r.clientName || r.client,
              tractorPlates: r.tractorPlates || r.checkIn?.tractorPlates,
              boxPlates: r.boxPlates || r.checkIn?.boxPlates,
              docNumber: r.docNumber || r.folio,
              rampNumber: r.rampNumber,
              rampCode: r.rampCode,
              receptionTime: r.checkIn?.receptionTime,
              exitTime: r.exitTime || r.completedAt,
              createdAt: r.createdAt
            });
          }
        }
        sendJson(res, 200, { success: true, message: 'Historial de pases', data: historyList });
        return true;
      }

      // 3.6 POST Salida de Planta (Check-Out): /api/v1/security-gate/passes/:token/exit o /checkout
      if (req.method === 'POST' && url.includes('/security-gate/passes/') && (url.endsWith('/exit') || url.endsWith('/checkout'))) {
        const parts = url.split('/');
        const token = parts[parts.length - 2];
        const state = loadState();
        let targetItem = null;
        for (const item of Object.values(state.receptions || {})) {
          if (item.id === token || item.folio === token) {
            item.status = 'COMPLETED_EXIT';
            item.exitTime = new Date().toISOString();
            targetItem = item;
            break;
          }
        }
        if (!targetItem) {
          for (const item of Object.values(state.outbounds || {})) {
            if (item.id === token || item.folio === token) {
              item.status = 'COMPLETED_EXIT';
              item.exitTime = new Date().toISOString();
              targetItem = item;
              break;
            }
          }
        }
        saveState(state);
        sendJson(res, 200, { success: true, message: 'Salida de planta registrada', data: targetItem || { token, status: 'COMPLETED_EXIT' } });
        return true;
      }

      // 3.7 POST complete de pases: /api/v1/security-gate/passes/:token/complete
      if (req.method === 'POST' && cleanUrl.includes('/security-gate/passes/') && cleanUrl.endsWith('/complete')) {
        const parts = cleanUrl.split('/');
        const compIdx = parts.indexOf('complete');
        const token = compIdx > 0 ? parts[compIdx - 1] : parts[parts.length - 2];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            const state = loadState();
            let targetPass = state.passes[token];
            if (!targetPass) {
              for (const [k, v] of Object.entries(state.passes || {})) {
                if (v.id === token || v.token === token || v.generatedFolio === token) {
                  targetPass = v;
                  break;
                }
              }
            }
            const updated = {
              ...(targetPass || { id: token, token }),
              status: 'AUTHORIZED',
              assignedRamp: data.assignedRamp || data.rampCode || (data.rampNumber ? `RAMPA ${data.rampNumber}` : 'ASIGNADA'),
              rampCode: data.rampCode || data.assignedRamp || '',
              rampNumber: data.rampNumber || null,
              receptionFolio: data.receptionFolio || '',
              authorizedAt: data.authorizedAt || new Date().toISOString()
            };
            state.passes[token] = updated;
            if (targetPass && targetPass.token && targetPass.token !== token) {
              state.passes[targetPass.token] = updated;
            }
            saveState(state);
            sendJson(res, 200, { success: true, message: 'Pase autorizado con rampa', data: updated });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'Error procesando pase completado' });
          }
        });
        return true;
      }

      // 3.8 DELETE de pases: /api/v1/security-gate/passes/:token
      if (req.method === 'DELETE' && url.includes('/security-gate/passes/')) {
        const parts = url.split('/');
        const idOrToken = parts[parts.length - 1].split('?')[0];
        const state = loadState();
        delete state.passes[idOrToken];
        for (const [k, v] of Object.entries(state.passes || {})) {
          if (v.id === idOrToken || v.token === idOrToken) {
            delete state.passes[k];
          }
        }
        saveState(state);
        sendJson(res, 200, { success: true, message: 'Pase eliminado' });
        return true;
      }

      // 3.6 Interceptar PURGE / RESET TOTAL de entorno (Dev & QA): POST o DELETE /api/v1/dev/purge-all
      if ((req.method === 'POST' || req.method === 'DELETE') && (url.includes('/dev/purge-all') || url.includes('/security-gate/purge-all'))) {
        inMemoryPasses.clear();
        inMemoryReceptions.clear();
        inMemoryOutbounds.clear();
        nextReceptionFolioSeq = 26510;
        nextOutboundFolioSeq = 1;
        sendJson(res, 200, { success: true, message: 'Entorno de pruebas y pases reiniciados en ceros' });
        return true;
      }

      // Para el resto de peticiones (catálogos, auth, etc.), retornar undefined para que el proxy continúe hacia target
      return undefined;
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
