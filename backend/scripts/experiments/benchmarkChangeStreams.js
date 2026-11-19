import fs from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../../src/app.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';
import { validateEnv } from '../../src/config/env.js';
import { FoodItem, Notification, Order, Payment, Restaurant } from '../../src/models/index.js';
import { startChangeStreams, stopChangeStreams } from '../../src/realtime/changeStreamManager.js';
import { closeSocketServer, initSocketServer } from '../../src/realtime/socketServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPERIMENTS_DIR = path.resolve(__dirname, '../../../docs/experiments');
const FRONTEND_ROOT = path.resolve(__dirname, '../../../frontend');

const feRequire = createRequire(path.join(FRONTEND_ROOT, 'package.json'));
const { io: ioClient } = feRequire('socket.io-client');

function httpReq(port, method, reqPath, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = http.request({ hostname: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[idx];
}

function summarizeLatencies(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    sampleCount: samples.length,
    minMs: Number((sorted[0] || 0).toFixed(1)),
    avgMs: Number((sum / Math.max(samples.length, 1)).toFixed(1)),
    p95Ms: Number(percentile(sorted, 95).toFixed(1)),
    maxMs: Number((sorted[sorted.length - 1] || 0).toFixed(1)),
  };
}

function buildExp2Svg(report) {
  const csAvg = report.changeStreams.latencyMs.avgMs;
  const poll1sAvg = report.pollingBaselines.interval1000ms_15Clients.estimatedAvgDetectLagMs;
  const poll2sAvg = report.pollingBaselines.interval2000ms_15Clients.estimatedAvgDetectLagMs;

  const maxLag = Math.max(poll2sAvg, poll1sAvg, csAvg, 100);
  const maxQueries = Math.max(
    report.pollingBaselines.interval1000ms_15Clients.measuredDbQueries,
    report.pollingBaselines.interval2000ms_15Clients.measuredDbQueries,
    report.changeStreams.dbPollQueriesExecuted,
    10
  );

  const bar = (x, val, maxVal, color, unit) => {
    const h = Math.max(6, Math.round((val / maxVal) * 155));
    const y = 260 - h;
    return `<rect x="${x}" y="${y}" width="64" height="${h}" rx="5" fill="${color}" />
      <text x="${x + 32}" y="${y - 8}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a">${val}${unit}</text>`;
  };

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="360" viewBox="0 0 900 360" font-family="Segoe UI, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#ffffff" rx="14" stroke="#e2e8f0" />
  <text x="32" y="34" font-size="17" font-weight="800" fill="#0f172a">Experiment 2: MongoDB Change Streams (Push) vs Traditional HTTP Polling (4s Window, 15 Clients)</text>
  <text x="32" y="54" font-size="12" fill="#475569">Measured live against MongoDB Atlas replica set with real Order updates and HTTP/Socket.IO observers</text>

  <!-- Left chart: Average Event Detection Delay (ms) -->
  <text x="215" y="88" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">Avg Event Detection Delay (ms) — Lower is Better</text>
  <line x1="60" y1="260" x2="390" y2="260" stroke="#cbd5e1" stroke-width="1.5" />
  ${bar(85, csAvg, maxLag, '#059669', 'ms')}
  <text x="117" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#059669">Change Stream</text>
  ${bar(185, poll1sAvg, maxLag, '#0284c7', 'ms')}
  <text x="217" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#0284c7">Polling 1s</text>
  ${bar(285, poll2sAvg, maxLag, '#e11d48', 'ms')}
  <text x="317" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#e11d48">Polling 2s</text>

  <!-- Right chart: DB Read Queries Issued Over 4s Test -->
  <text x="665" y="88" text-anchor="middle" font-size="13" font-weight="700" fill="#1e293b">HTTP/DB Polling Reads Issued (15 Clients / 4s Window)</text>
  <line x1="490" y1="260" x2="840" y2="260" stroke="#cbd5e1" stroke-width="1.5" />
  ${bar(520, report.changeStreams.dbPollQueriesExecuted, maxQueries, '#059669', '')}
  <text x="552" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#059669">Change Stream</text>
  ${bar(630, report.pollingBaselines.interval1000ms_15Clients.measuredDbQueries, maxQueries, '#0284c7', '')}
  <text x="662" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#0284c7">Polling 1s</text>
  ${bar(740, report.pollingBaselines.interval2000ms_15Clients.measuredDbQueries, maxQueries, '#e11d48', '')}
  <text x="772" y="280" text-anchor="middle" font-size="11" font-weight="700" fill="#e11d48">Polling 2s</text>

  <rect x="60" y="302" width="780" height="38" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
  <text x="450" y="325" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">Summary: Change Streams cut detection delay by ${report.comparison.latencyReductionVs1sPollPct}% vs 1s polling and eliminated ${report.pollingBaselines.interval1000ms_15Clients.redundantEmptyReadsPct}% redundant DB reads</text>
</svg>`;
}

async function measurePollingRun({ port, orderId, token, clients, intervalMs, durationMs }) {
  let completedQueries = 0;
  let lastSeenStamp = '';
  let stateChangeReads = 0;
  const rttLatencies = [];

  const startedAt = Date.now();
  const pollLoop = async () => {
    while (Date.now() - startedAt < durationMs) {
      const t0 = performance.now();
      const res = await httpReq(port, 'GET', `/api/orders/${orderId}`, null, token);
      const rtt = performance.now() - t0;
      if (res.status === 200) {
        completedQueries += 1;
        rttLatencies.push(rtt);
        const stamp = res.body?.data?.order?.updatedAt || '';
        if (stamp !== lastSeenStamp) {
          lastSeenStamp = stamp;
          stateChangeReads += 1;
        }
      }
      const remaining = intervalMs - (performance.now() - t0);
      if (remaining > 0 && Date.now() - startedAt < durationMs) {
        await new Promise((r) => setTimeout(r, Math.min(remaining, Math.max(0, durationMs - (Date.now() - startedAt)))));
      }
    }
  };

  // Trigger 3 real status mutations during the polling window so state-change vs redundant ratio is real
  const mutator = (async () => {
    for (let m = 0; m < 3; m += 1) {
      await new Promise((r) => setTimeout(r, Math.round(durationMs / 4)));
      await Order.findByIdAndUpdate(orderId, {
        $set: { cancellationReason: `exp2-poll-tick-${m}` },
      });
    }
  })();

  await Promise.all([...Array.from({ length: clients }, () => pollLoop()), mutator]);

  const queryRtt = summarizeLatencies(rttLatencies);
  const redundantReads = Math.max(0, completedQueries - stateChangeReads);
  const redundantEmptyReadsPct = completedQueries
    ? Number(((redundantReads / completedQueries) * 100).toFixed(1))
    : 0;
  const estimatedAvgDetectLagMs = Number(((intervalMs / 2) + queryRtt.avgMs).toFixed(1));

  return {
    clients,
    intervalMs,
    windowMs: durationMs,
    measuredDbQueries: completedQueries,
    stateChangesDetected: stateChangeReads,
    redundantEmptyReads: redundantReads,
    redundantEmptyReadsPct,
    httpQueryRttMs: queryRtt,
    estimatedAvgDetectLagMs,
  };
}

async function runBenchmark() {
  validateEnv();
  await connectDatabase();
  await Promise.all([Order.syncIndexes(), Notification.syncIndexes()]);

  const httpServer = http.createServer(app);
  initSocketServer(httpServer);
  await startChangeStreams();
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = httpServer.address().port;

  let socket;
  let benchOrderId = null;

  try {
    const loginRes = await httpReq(port, 'POST', '/api/auth/login', {
      email: 'ananya@bitestream.dev',
      password: 'SeedPass@2026',
    });
    const custAuth = loginRes.body.data;
    const mylari = await Restaurant.findOne({ name: 'Mylari Heritage Kitchen' }).lean();
    const mylariDosa = await FoodItem.findOne({ restaurantId: mylari._id, availability: true }).lean();

    socket = ioClient(`http://127.0.0.1:${port}`, {
      auth: { token: custAuth.token },
      transports: ['websocket'],
    });
    await new Promise((resolve, reject) => {
      socket.once('SOCKET_READY', resolve);
      socket.once('connect_error', reject);
    });

    const createRes = await httpReq(
      port,
      'POST',
      '/api/orders',
      {
        restaurantId: mylari._id.toString(),
        items: [{ foodItemId: mylariDosa._id.toString(), quantity: 1 }],
        deliveryAddress: { label: 'Exp2', street: 'Benchmark Street', area: 'Gokulam', city: 'Mysuru' },
        deliveryLocation: { type: 'Point', coordinates: [76.6258, 12.3282] },
        paymentMethod: 'COD',
      },
      custAuth.token
    );
    benchOrderId = createRes.body.data.order._id;

    // 1. Measure real MongoDB Change Streams -> Socket.IO push across 12 live DB mutations
    const csLatencies = [];
    for (let i = 0; i < 12; i += 1) {
      const marker = `EXP2-CS-${i}-${Date.now()}`;
      const waitEvent = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Change stream event timeout')), 8000);
        const handler = (payload) => {
          if (
            payload?.order?._id === benchOrderId &&
            payload?.order?.cancellationReason === marker
          ) {
            clearTimeout(timer);
            socket.off('ORDER_STATUS_UPDATED', handler);
            resolve();
          }
        };
        socket.on('ORDER_STATUS_UPDATED', handler);
      });

      const t0 = performance.now();
      await Order.findByIdAndUpdate(benchOrderId, {
        $set: { status: i % 2 === 0 ? 'ACCEPTED' : 'PREPARING', cancellationReason: marker },
      });
      await waitEvent;
      csLatencies.push(performance.now() - t0);
    }

    const csStats = summarizeLatencies(csLatencies);

    // 2. Measure actual HTTP Polling baselines against the same Atlas instance over 4s
    const poll1s15 = await measurePollingRun({
      port,
      orderId: benchOrderId,
      token: custAuth.token,
      clients: 15,
      intervalMs: 1000,
      durationMs: 4000,
    });

    const poll2s15 = await measurePollingRun({
      port,
      orderId: benchOrderId,
      token: custAuth.token,
      clients: 15,
      intervalMs: 2000,
      durationMs: 4000,
    });

    const latencyReductionVs1sPct = Number(
      (((poll1s15.estimatedAvgDetectLagMs - csStats.avgMs) / poll1s15.estimatedAvgDetectLagMs) * 100).toFixed(1)
    );

    const report = {
      generatedAt: new Date().toISOString(),
      environment: 'MongoDB Atlas M0/Replica Set + Express + Socket.IO WebSocket',
      changeStreams: {
        mutationsMeasured: 12,
        dbPollQueriesExecuted: 0,
        latencyMs: csStats,
      },
      pollingBaselines: {
        interval1000ms_15Clients: poll1s15,
        interval2000ms_15Clients: poll2s15,
      },
      comparison: {
        latencyReductionVs1sPollPct: latencyReductionVs1sPct,
        speedupFactorVs1sPoll: Number((poll1s15.estimatedAvgDetectLagMs / Math.max(csStats.avgMs, 1)).toFixed(2)),
        zeroPollingDbReads: true,
      },
    };

    await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(EXPERIMENTS_DIR, 'exp2_changestreams_results.json'),
      JSON.stringify(report, null, 2)
    );
    await fs.writeFile(
      path.join(EXPERIMENTS_DIR, 'exp2_changestreams_vs_polling.svg'),
      buildExp2Svg(report)
    );

    console.log('CHANGESTREAMS_BENCHMARK_RESULTS:');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (socket) socket.disconnect();
    await stopChangeStreams();
    await closeSocketServer();
    if (benchOrderId) {
      await Notification.deleteMany({ orderId: benchOrderId });
      await Payment.deleteMany({ orderId: benchOrderId });
      await Order.deleteMany({ _id: benchOrderId });
    }
    await new Promise((resolve) => httpServer.close(resolve));
    await disconnectDatabase();
  }
}

runBenchmark().catch((err) => {
  console.error('EXP2_BENCHMARK_FAILED:', err);
  process.exit(1);
});
