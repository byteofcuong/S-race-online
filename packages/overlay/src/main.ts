import type { Balance, FxEvent, ProvincesFile, Snapshot } from '@srace/engine';
import { Sfx } from './audio.ts';
import { Hud } from './hud/Hud.ts';
import { H, W } from './layout.ts';
import { Net, type OverlaySettings } from './net.ts';
import { Scene } from './scene/Scene.ts';

const params = new URLSearchParams(location.search);

function fitStage() {
  const stage = document.getElementById('stage')!;
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(window.innerWidth - W * s) / 2}px`;
  stage.style.top = `${(window.innerHeight - H * s) / 2}px`;
}

async function boot() {
  fitStage();
  window.addEventListener('resize', fitStage);
  try {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* font fallback */
  }

  const scene = new Scene();
  await scene.init(document.getElementById('canvas-host')!);
  const hud = new Hud();
  const sfx = new Sfx();
  sfx.muted = params.get('mute') === '1';
  let safeZone = params.get('safezone') === '1';
  hud.setSafeZone(safeZone);

  let snapshot: Snapshot | undefined;
  const pendingFx: FxEvent[] = [];

  const net = new Net({
    onHello(p: ProvincesFile, b: Balance, s: OverlaySettings) {
      scene.setProvinces(p, b.display.maxCars);
      hud.setConfig(p, b);
      applySettings(s);
    },
    onSnapshot(s) {
      snapshot = s;
      scene.applySnapshot(s, Date.now());
      for (const f of pendingFx.splice(0)) route(f);
    },
    onFx(fx) {
      // fx có thể đến trước snapshot đầu tiên → giữ lại
      if (!snapshot) pendingFx.push(...fx);
      else fx.forEach(route);
    },
    onSettings: applySettings,
    onBalance(b) {
      hud.setBalance(b);
    },
    onConnection(ok) {
      hud.setConnected(ok);
    },
  });

  function applySettings(s: OverlaySettings) {
    if (params.get('mute') !== '1') sfx.muted = s.muted;
    sfx.volume = s.volume ?? 0.8;
    if (params.get('safezone') !== '1') {
      safeZone = s.safeZone;
      hud.setSafeZone(safeZone);
    }
  }

  function route(f: FxEvent) {
    const now = net.now();
    scene.handleFx(f, now);
    hud.handleFx(f, now);
    switch (f.kind) {
      case 'nitro':
        sfx.nitro(f.tier === 'large' || f.tier === 'super');
        break;
      case 'sabotage':
        sfx.crash();
        break;
      case 'storm':
        sfx.storm();
        break;
      case 'shieldGain':
        sfx.shieldGain();
        break;
      case 'shieldBreak':
        sfx.shieldBreak();
        break;
      case 'combo':
        sfx.combo();
        break;
      case 'overtake':
        sfx.overtake();
        break;
      case 'join':
        sfx.join();
        break;
      case 'finish':
        sfx.finish();
        break;
      case 'phase':
        if (f.phase === 'racing') sfx.start();
        else if (f.phase === 'golden') sfx.golden();
        else if (f.phase === 'podium') sfx.finish();
        break;
    }
  }

  hud.onSecond = (phase, remaining) => {
    if ((phase === 'golden' || phase === 'lobby') && remaining <= 5 && remaining >= 1) sfx.countdown(remaining === 1);
  };

  // HUD cập nhật ~20 lần/giây là đủ
  setInterval(() => {
    if (snapshot) hud.update(snapshot, net.now());
  }, 50);

  // phím tắt khi test trong trình duyệt
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      safeZone = !safeZone;
      hud.setSafeZone(safeZone);
    }
    if (e.key === 'm' || e.key === 'M') sfx.muted = !sfx.muted;
    sfx.unlock();
  });
  window.addEventListener('pointerdown', () => sfx.unlock());

  net.connect();
}

void boot();
