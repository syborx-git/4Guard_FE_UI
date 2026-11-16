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

const target = process.env.BACKEND_URL || 'http://localhost:8080';
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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-organization-id, x-branch-id, ngrok-skip-browser-warning'
};

function sendJson(res, statusCode, payload) {
  if (!res || res.writableEnded || res.headersSent) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(payload));
}

function readBody(req, callback) {
  if (req.body) {
    return callback(typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body));
  }
  if (req.readableEnded) {
    return callback('{}');
  }
  let body = '';
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      callback(body || '{}');
    }
  };
  req.on('data', chunk => { body += chunk; });
  req.on('end', finish);
  req.on('error', finish);
  if (typeof req.resume === 'function') {
    req.resume();
  }
  setTimeout(finish, 800);
}

/**
 * Maneja los endpoints interceptados para el puente compartido Caseta <-> Admin <-> Terminal RF.
 * Se invoca dentro de proxy.web (antes de que Vite/http-proxy toque el stream o envíe a Render),
 * evitando que Vite ignore el bypass y asegurando lectura íntegra del body y respuestas asíncronas limpias.
 * @returns {boolean} true si la petición fue atendida localmente; false si debe reenviarse al backend remoto.
 */
function handleSharedBridge(req, res) {
  const url = req.url || '';
  const cleanUrl = url.split('?')[0];

  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return true;
  }

  // 0.0 SSE Keep-Alive para Terminal RF (evita spam de reconexión si el backend remoto está fuera de línea)
  if (req.method === 'GET' && cleanUrl.includes('/notifications/rf-stream')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': 4guard-rf-stream-connected\n\n');
    const hb = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': keepalive\n\n');
      } else {
        clearInterval(hb);
      }
    }, 25000);
    req.on('close', () => clearInterval(hb));
    return true;
  }

  // 0. AUTH LOGIN INTERCEPTOR (Garantiza login instantáneo en Dev / Tablet)
  if (req.method === 'POST' && (cleanUrl.endsWith('/auth/login') || cleanUrl.includes('/auth/login'))) {
    readBody(req, (body) => {
          try {
            const data = JSON.parse(body || '{}');
            const identifier = (data.identifier || data.email || data.username || 'enrique@4guard.com').trim().toLowerCase();
            const localPart = identifier.split('@')[0] || identifier;

            let role = 'ROLE_ADMIN';
            let fullName = 'Enrique Archite (Gerente de Operaciones)';

            if (localPart.includes('enrique')) {
              role = 'ROLE_ADMIN';
              fullName = 'Enrique Archite (Gerente de Operaciones)';
            } else if (localPart.includes('admin') || localPart.includes('carlos') || localPart.includes('ceo') || localPart.includes('director')) {
              role = 'ROLE_ADMIN';
              fullName = 'Carlos Herrera (Director General)';
            } else if (localPart.includes('guard') || localPart.includes('caseta') || localPart.includes('seguridad') || localPart.includes('vigilancia')) {
              role = 'ROLE_SECURITY_GUARD';
              fullName = 'Oficial Vigilancia Caseta';
            } else if (localPart.includes('supervisor') || localPart.includes('lider')) {
              role = 'ROLE_SUPERVISOR';
              fullName = 'Supervisor de Patio y Andén';
            } else if (
              localPart.includes('mc-') ||
              localPart.includes('montacarga') ||
              localPart.includes('oper') ||
              !identifier.includes('@')
            ) {
              role = 'ROLE_OPERATOR';
              fullName = 'Alex Gabriel Perez Garduño (Montacargas)';
            }

            const nowSec = Math.floor(Date.now() / 1000);
            const expSec = nowSec + (30 * 24 * 3600);
            const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
            const payloadB64 = Buffer.from(JSON.stringify({
              sub: identifier || 'enrique@4guard.com',
              userId: role === 'ROLE_OPERATOR' ? 'u-operator-01' : 'u-admin-01',
              email: identifier.includes('@') ? identifier : `${identifier}@4guard.mx`,
              fullName: fullName,
              role: role,
              permissions: ['*'],
              iat: nowSec,
              exp: expSec
            })).toString('base64url');
            const token = `${headerB64}.${payloadB64}.mock-signature-4guard`;
            const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

            const userPayload = {
              id: role === 'ROLE_OPERATOR' ? 'u-operator-01' : 'u-admin-01',
              fullName: fullName,
              name: fullName,
              email: identifier.includes('@') ? identifier : `${identifier}@4guard.mx`,
              username: identifier || 'enrique@4guard.com',
              role: role,
              roleLevel: 1,
              employeeCode: role === 'ROLE_OPERATOR' ? 'MC-001' : 'ADM-001',
              forkliftOperatorId: role === 'ROLE_OPERATOR' ? 'op-alex-01' : undefined,
              organizationId: 'a53f0907-9fa5-4bdf-87db-2eb5e7683935',
              branchId: 'b73f0907-9fa5-4bdf-87db-2eb5e7683936',
              branchName: 'CENTRO DE DISTRIBUCION CDMX',
              organizationName: '4GUARD LOGISTICS CORP',
              changePasswordRequired: false,
              active: true
            };

            sendJson(res, 200, {
              success: true,
              message: 'Sesión iniciada con éxito',
              data: {
                token: token,
                accessToken: token,
                refreshToken: token,
                expiresIn: 2592000,
                expiresAt: expiresAt,
                user: userPayload
              }
            });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 0.1 AUTH REFRESH INTERCEPTOR
      if (req.method === 'POST' && (cleanUrl.endsWith('/auth/refresh') || cleanUrl.includes('/auth/refresh'))) {
        const nowSec = Math.floor(Date.now() / 1000);
        const expSec = nowSec + (30 * 24 * 3600);
        const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payloadB64 = Buffer.from(JSON.stringify({
          sub: 'enrique@4guard.com',
          userId: 'u-admin-01',
          email: 'enrique@4guard.com',
          fullName: 'Enrique Archite (Gerente de Operaciones)',
          role: 'ROLE_ADMIN',
          permissions: ['*'],
          iat: nowSec,
          exp: expSec
        })).toString('base64url');
        const token = `${headerB64}.${payloadB64}.mock-signature-4guard`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

        sendJson(res, 200, {
          success: true,
          message: 'Token refrescado con éxito',
          data: {
            token: token,
            accessToken: token,
            refreshToken: token,
            expiresIn: 2592000,
            expiresAt: expiresAt
          }
        });
        return true;
      }

      // 0.2 AUTH LOGOUT INTERCEPTOR
      if (req.method === 'POST' && (cleanUrl.endsWith('/auth/logout') || cleanUrl.includes('/auth/logout'))) {
        sendJson(res, 200, { success: true, message: 'Sesión cerrada exitosamente' });
        return true;
      }

      // 1.1 POST /api/v1/warehouse-receptions/check-in
      if (req.method === 'POST' && url.includes('/warehouse-receptions/check-in')) {
        readBody(req, (body) => {
          try {
            const data = JSON.parse(body || '{}');
            const state = loadState();
            const folio = data.docNumber ? String(data.docNumber).trim() : String(state.nextReceptionFolioSeq++);
            const recId = data.id || `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const clientName = data.clientName || data.client || 'Cliente General';
            const carrierLine = data.carrierLine || data.carrierName || 'Transportista';
            const rampNum = Number(data.rampNumber) > 0 ? Number(data.rampNumber) : null;
            const rampCode = data.rampCode || (rampNum ? `LOC-RAMP-${String(rampNum).padStart(2, '0')}` : null);
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
        const uniqueMap = new Map();
        for (const item of Object.values(state.receptions || {})) {
          const key = (item.folio || item.id || '').trim();
          if (!key) continue;
          const existing = uniqueMap.get(key);
          if (!existing) {
            uniqueMap.set(key, item);
          } else {
            if (item.status === 'DISCHARGED' || item.status === 'COMPLETED' || (item.pallets && item.pallets.length > (existing.pallets?.length || 0))) {
              uniqueMap.set(key, item);
            }
          }
        }
        const unique = Array.from(uniqueMap.values());
        sendJson(res, 200, { success: true, message: 'Listado de recepciones', data: unique });
        return true;
      }

      // 1.3 POST /api/v1/warehouse-receptions/:id/complete
      if (req.method === 'POST' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.endsWith('/complete')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 2] || '');
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
          if (targetRec.id) state.receptions[targetRec.id] = targetRec;
          if (targetRec.folio) state.receptions[targetRec.folio] = targetRec;
          saveState(state);
        }
        sendJson(res, 200, { success: true, message: 'Recepción completada', data: targetRec });
        return true;
      }

      // 1.4 POST /api/v1/warehouse-receptions/:id/cancel
      if (req.method === 'POST' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.endsWith('/cancel')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 2] || '');
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
          if (targetRec.id) state.receptions[targetRec.id] = targetRec;
          if (targetRec.folio) state.receptions[targetRec.folio] = targetRec;
          saveState(state);
        }
        sendJson(res, 200, { success: true, message: 'Recepción cancelada', data: targetRec });
        return true;
      }

      // 1.5 PUT /api/v1/warehouse-receptions/:id/parameters
      if (req.method === 'PUT' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.endsWith('/parameters')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 2] || '');
        readBody(req, (body) => {
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
              if (data.forkliftOperator) {
                targetRec.forkliftOperator = data.forkliftOperator;
                targetRec.forkliftOperatorName = data.forkliftOperator;
                if (!targetRec.checkIn) targetRec.checkIn = {};
                targetRec.checkIn.forkliftOperator = data.forkliftOperator;
              }
              if (Array.isArray(data.pallets)) {
                targetRec.pallets = data.pallets;
                targetRec.totalPallets = data.pallets.length;
                targetRec.totalPieces = data.pallets.reduce((s, p) => s + Number(p.pieces || 0), 0);
              }
              if (targetRec.id) state.receptions[targetRec.id] = targetRec;
              if (targetRec.folio) state.receptions[targetRec.folio] = targetRec;
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
      if (req.method === 'GET' && cleanUrl.includes('/warehouse-receptions/next-pallet-number')) {
        sendJson(res, 200, {
          success: true,
          message: 'Siguiente número de pallet generado',
          data: { nextPalletNumber: 1 }
        });
        return true;
      }

      // 1.5.2 POST /api/v1/warehouse-receptions/:id/pallets
      if (req.method === 'POST' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.endsWith('/pallets')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 2] || '');
        readBody(req, (body) => {
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
              if (!Array.isArray(targetRec.pallets)) {
                targetRec.pallets = [];
              }
              const newPallets = Array.isArray(data.pallets) ? data.pallets : [data];
              for (const p of newPallets) {
                const key = p.uaCode || p.sscc || p.palletCode || p.id;
                const existingIdx = key
                  ? targetRec.pallets.findIndex(ep => (ep.uaCode || ep.sscc || ep.palletCode || ep.id) === key)
                  : -1;
                if (existingIdx >= 0) {
                  targetRec.pallets[existingIdx] = { ...targetRec.pallets[existingIdx], ...p };
                } else {
                  targetRec.pallets.push(p);
                }
              }
              targetRec.totalPallets = targetRec.pallets.length;
              targetRec.totalPieces = targetRec.pallets.reduce((s, p) => s + Number(p.pieces || 0), 0);
              if (targetRec.id) state.receptions[targetRec.id] = targetRec;
              if (targetRec.folio) state.receptions[targetRec.folio] = targetRec;
              saveState(state);
            }
            sendJson(res, 200, { success: true, message: 'Pallets guardados', data: targetRec?.pallets || [] });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.5.3 PUT /api/v1/warehouse-receptions/:id/pallets/:palletId
      if (req.method === 'PUT' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.includes('/pallets/')) {
        const parts = cleanUrl.split('/');
        const palletsIdx = parts.indexOf('pallets');
        const id = palletsIdx > 0 ? decodeURIComponent(parts[palletsIdx - 1] || '') : '';
        const palletId = decodeURIComponent(parts[palletsIdx + 1] || '');
        readBody(req, (body) => {
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
            if (targetRec && Array.isArray(targetRec.pallets)) {
              const idx = targetRec.pallets.findIndex(p => p.id === palletId || p.palletCode === palletId || p.uaCode === palletId || p.sscc === palletId);
              if (idx >= 0) {
                targetRec.pallets[idx] = { ...targetRec.pallets[idx], ...data };
                targetRec.totalPieces = targetRec.pallets.reduce((s, p) => s + Number(p.pieces || 0), 0);
                if (targetRec.id) state.receptions[targetRec.id] = targetRec;
                if (targetRec.folio) state.receptions[targetRec.folio] = targetRec;
                saveState(state);
              }
            }
            sendJson(res, 200, { success: true, message: 'Pallet actualizado', data: data });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.5.4 POST /api/v1/warehouse-receptions/:id/lots
      if (req.method === 'POST' && cleanUrl.includes('/warehouse-receptions/') && cleanUrl.endsWith('/lots')) {
        readBody(req, (body) => {
          try {
            const data = JSON.parse(body || '{}');
            sendJson(res, 200, { success: true, message: 'Lote registrado', data });
          } catch (e) {
            sendJson(res, 400, { success: false, message: 'JSON malformado' });
          }
        });
        return true;
      }

      // 1.6 GET /api/v1/warehouse-receptions/:id (Detalle individual)
      if (req.method === 'GET' && cleanUrl.includes('/warehouse-receptions/') && !cleanUrl.includes('/detect-return') && !cleanUrl.includes('/next-pallet-number')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 1] || '');
        const state = loadState();
        let rec = state.receptions[id];
        for (const item of Object.values(state.receptions || {})) {
          if (item.id === id || item.folio === id) {
            if (!rec || item.status === 'DISCHARGED' || item.status === 'COMPLETED' || (item.pallets && item.pallets.length > (rec.pallets?.length || 0))) {
              rec = item;
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
      if (req.method === 'POST' && (cleanUrl.includes('/warehouse-outbounds/check-in') || cleanUrl === '/api/v1/warehouse-outbounds')) {
        readBody(req, (body) => {
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
              rampNumber: Number(data.rampNumber) > 0 ? Number(data.rampNumber) : null,
              rampCode: data.rampCode || (Number(data.rampNumber) > 0 ? `LOC-RAMP-${String(data.rampNumber).padStart(2, '0')}` : null),
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
      if (req.method === 'GET' && cleanUrl === '/api/v1/warehouse-outbounds') {
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

      // 2.3 GET y PUT /api/v1/warehouse-outbounds/:id
      if (cleanUrl.includes('/warehouse-outbounds/') && !cleanUrl.endsWith('/check-in')) {
        const parts = cleanUrl.split('/');
        const id = decodeURIComponent(parts[parts.length - 1] || '');
        if (req.method === 'GET') {
          const state = loadState();
          let out = state.outbounds[id];
          if (!out) {
            for (const item of Object.values(state.outbounds || {})) {
              if (item.id === id || item.folio === id) {
                out = item;
                break;
              }
            }
          }
          if (out) {
            sendJson(res, 200, { success: true, data: out });
            return true;
          }
        } else if (req.method === 'PUT') {
          readBody(req, (body) => {
            try {
              const data = JSON.parse(body || '{}');
              const state = loadState();
              let targetOut = state.outbounds[id];
              if (!targetOut) {
                for (const item of Object.values(state.outbounds || {})) {
                  if (item.id === id || item.folio === id) {
                    targetOut = item;
                    break;
                  }
                }
              }
              if (targetOut) {
                Object.assign(targetOut, data);
                if (targetOut.id) state.outbounds[targetOut.id] = targetOut;
                if (targetOut.folio) state.outbounds[targetOut.folio] = targetOut;
                saveState(state);
              }
              sendJson(res, 200, { success: true, message: 'Salida actualizada', data: targetOut || data });
            } catch (e) {
              sendJson(res, 400, { success: false, message: 'JSON malformado' });
            }
          });
          return true;
        }
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
        readBody(req, (body) => {
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
        readBody(req, (body) => {
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
      if (req.method === 'POST' && cleanUrl.includes('/security-gate/passes/') && (cleanUrl.endsWith('/exit') || cleanUrl.endsWith('/checkout'))) {
        const parts = cleanUrl.split('/');
        const token = decodeURIComponent(parts[parts.length - 2] || '');
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
        const token = decodeURIComponent((compIdx > 0 ? parts[compIdx - 1] : parts[parts.length - 2]) || '');
        readBody(req, (body) => {
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
      if (req.method === 'DELETE' && cleanUrl.includes('/security-gate/passes/')) {
        const parts = cleanUrl.split('/');
        const idOrToken = decodeURIComponent(parts[parts.length - 1] || '');
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

      // 3.9 PURGE / RESET TOTAL de entorno (Dev & QA): POST o DELETE /api/v1/dev/purge-all
      if ((req.method === 'POST' || req.method === 'DELETE') && (cleanUrl.includes('/dev/purge-all') || cleanUrl.includes('/security-gate/purge-all'))) {
        saveState({
          receptions: {},
          outbounds: {},
          passes: {},
          nextReceptionFolioSeq: 26510,
          nextOutboundFolioSeq: 1
        });
        sendJson(res, 200, { success: true, message: 'Entorno de pruebas y pases reiniciados en ceros' });
        return true;
      }

      // No interceptado por el puente local -> reenviar al backend remoto
      return false;
}

const PROXY_CONFIG = {
  "/ws-wms": {
    "target": target,
    "pathRewrite": { "^/ws-wms": "/api/v1/ws-wms" },
    "secure": false,
    "ws": true,
    "changeOrigin": true,
    "logLevel": "info"
  },
  "/api/v1/ws-wms": {
    "target": target,
    "secure": false,
    "ws": true,
    "changeOrigin": true,
    "logLevel": "info"
  },
  "/api": {
    "target": target,
    "secure": false,
    "changeOrigin": true,
    "logLevel": "info",
    "configure": function(proxy) {
      const originalWeb = proxy.web.bind(proxy);
      proxy.web = function(req, res, options, callback) {
        if (handleSharedBridge(req, res)) {
          return;
        }
        return originalWeb(req, res, options, callback);
      };
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
