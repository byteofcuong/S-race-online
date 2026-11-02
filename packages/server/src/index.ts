import { createServer } from 'node:http';
import { ProvinceIndex, RaceEngine, type FxEvent, type GameEvent } from '@srace/engine';
import { CONTROL_DIR, OVERLAY_DIST, loadBalance, loadEnv, loadProvinces, watchBalance } from './config.ts';
import { JsonlLogger } from './logger.ts';
import { json, readJson, serveStatic } from './http.ts';
import { Hub, type OverlaySettings } from './ws.ts';
import { SimulatorSource } from './sources/simulator.ts';
import { TikTokSource } from './sources/tiktok.ts';
import type { EventSource } from './sources/types.ts';

loadEnv();
const PORT = Number(process.env.PORT ?? 8787);
const provincesFile = loadProvinces();
const provinces = new ProvinceIndex(provincesFile);
let balance = loadBalance();
const engine = new RaceEngine(provinces, balance, Date.now());
const logger = new JsonlLogger(process.env.LOG !== '0');
const settings: OverlaySettings = { muted: false, safeZone: false, volume: 0.8 };

// ───────────── nguồn sự kiện ─────────────
const pendingFx: FxEvent[] = [];
function handleEvent(ev: GameEvent, source: string) {
  const fx = engine.applyEvent(ev, Date.now());
  pendingFx.push(...fx);
  logger.log('event', { source, ev });
  for (const f of fx) logger.log('fx', f);
}

const simulator = new SimulatorSource(provincesFile, handleEvent);
let tiktok: TikTokSource | undefined;
const sources: EventSource[] = [simulator];
void simulator.start();

async function connectTikTok(username: string) {
  await disconnectTikTok();
  tiktok = new TikTokSource({ username, signApiKey: process.env.EULER_API_KEY }, handleEvent);
  sources.push(tiktok);
  await tiktok.start();
  hub.broadcast({ type: 'status', data: status() });
}
async function disconnectTikTok() {
  if (!tiktok) return;
  await tiktok.stop();
  sources.splice(sources.indexOf(tiktok), 1);
  tiktok = undefined;
  hub.broadcast({ type: 'status', data: status() });
}

interface ServerStatus {
  sources: ReturnType<EventSource['status']>[];
  crowd: ReturnType<SimulatorSource['getCrowd']>;
  clients: number;
  tiktokUsername: string;
}
function status(): ServerStatus {
  return {
    sources: sources.map((s) => s.status()),
    crowd: simulator.getCrowd(),
    clients: hub.size,
    tiktokUsername: process.env.TIKTOK_USERNAME ?? '',
  };
}

// ───────────── HTTP + WS ─────────────
const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';
  try {
    if (url.startsWith('/api/')) {
      if (method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
        return res.end();
      }
      const body = method === 'POST' ? await readJson(req) : {};
      const route = url.split('?')[0];
      const now = Date.now();
      switch (`${method} ${route}`) {
        case 'GET /api/state':
          return json(res, 200, { snapshot: engine.snapshot(), status: status(), settings });
        case 'GET /api/config':
          return json(res, 200, { provinces: provincesFile, balance });
        case 'POST /api/round/skip':
          pendingFx.push(...engine.skipPhase(now));
          return json(res, 200, { ok: true, phase: engine.state.phase });
        case 'POST /api/round/restart':
          pendingFx.push(...engine.restartRound(now));
          return json(res, 200, { ok: true });
        case 'POST /api/round/pause':
          engine.setPaused(Boolean(body.paused));
          return json(res, 200, { ok: true, paused: engine.state.paused });
        case 'POST /api/reset':
          pendingFx.push(...engine.resetAll(now));
          return json(res, 200, { ok: true });
        case 'POST /api/settings':
          Object.assign(settings, body);
          hub.broadcast({ type: 'settings', data: settings });
          return json(res, 200, { ok: true, settings });
        case 'POST /api/sim/event':
          simulator.emit(body as unknown as GameEvent);
          return json(res, 200, { ok: true });
        case 'POST /api/sim/crowd':
          simulator.setCrowd(body as Record<string, never>);
          hub.broadcast({ type: 'status', data: status() });
          return json(res, 200, { ok: true, crowd: simulator.getCrowd() });
        case 'POST /api/sim/scenario':
          return json(res, 200, { ok: true, message: simulator.scenario(String(body.name ?? '')) });
        case 'POST /api/tiktok/connect':
          void connectTikTok(String(body.username || process.env.TIKTOK_USERNAME || ''));
          return json(res, 200, { ok: true });
        case 'POST /api/tiktok/disconnect':
          void disconnectTikTok();
          return json(res, 200, { ok: true });
        default:
          return json(res, 404, { error: 'not found' });
      }
    }
    if (url === '/control' || url.startsWith('/control/')) {
      const sub = url.replace(/^\/control/, '') || '/';
      if (serveStatic(res, CONTROL_DIR, sub)) return;
    }
    if (serveStatic(res, OVERLAY_DIST, url)) return;
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(
        `<meta charset="utf-8"><body style="font-family:sans-serif;padding:24px"><h2>Đường Đua Chữ S – server đang chạy</h2>
        <p>Overlay chưa build. Chạy <code>npm run build</code> rồi tải lại, hoặc dùng <code>npm run dev</code> và mở <a href="http://localhost:5173">http://localhost:5173</a>.</p>
        <p>Bảng điều khiển: <a href="/control/">/control/</a></p></body>`,
      );
    }
    res.writeHead(404);
    res.end('not found');
  } catch (e) {
    json(res, 500, { error: (e as Error).message });
  }
});

const hub: Hub = new Hub(server, () => ({ type: 'hello', provinces: provincesFile, balance, settings, status: status() }));

// ───────────── vòng lặp game ─────────────
const TICK_MS = 33;
const SNAPSHOT_MS = 100;
let lastSnapshot = 0;
setInterval(() => {
  const now = Date.now();
  const fx = engine.tick(now);
  if (fx.length) {
    pendingFx.push(...fx);
    for (const f of fx) logger.log('fx', f);
  }
  if (pendingFx.length) {
    hub.broadcast({ type: 'fx', data: pendingFx.splice(0, pendingFx.length) });
  }
  if (now - lastSnapshot >= SNAPSHOT_MS) {
    lastSnapshot = now;
    hub.broadcast({ type: 'snapshot', data: engine.snapshot() });
  }
}, TICK_MS);

watchBalance((b) => {
  balance = b;
  engine.setBalance(b);
  hub.broadcast({ type: 'balance', data: b });
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (overlay: / , control: /control/ , ws: /ws)`);
  if ((process.env.SOURCE ?? 'simulator') === 'tiktok' && process.env.TIKTOK_USERNAME) {
    void connectTikTok(process.env.TIKTOK_USERNAME);
  } else {
    console.log('[server] nguồn: simulator. Mở /control/ để bắn sự kiện giả hoặc kết nối TikTok.');
  }
});
