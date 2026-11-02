import type { Balance, FxEvent, ProvincesFile, Snapshot } from '@srace/engine';

export interface OverlaySettings {
  muted: boolean;
  safeZone: boolean;
  volume: number;
  /** timestamp: đổi giá trị → overlay nạp lại manifest ảnh */
  reloadAssets?: number;
}

export interface NetHandlers {
  onHello(p: ProvincesFile, b: Balance, s: OverlaySettings): void;
  onSnapshot(s: Snapshot): void;
  onFx(fx: FxEvent[]): void;
  onSettings(s: OverlaySettings): void;
  onBalance(b: Balance): void;
  onConnection(ok: boolean): void;
}

/** WebSocket client có tự kết nối lại + ước lượng lệch giờ server. */
export class Net {
  private ws?: WebSocket;
  private offset = 0; // serverTime - clientTime
  private hasOffset = false;
  private retry = 1000;

  constructor(private h: NetHandlers) {}

  /** Giờ server ước lượng. */
  now(): number {
    return Date.now() + this.offset;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 1000;
      this.h.onConnection(true);
    };
    ws.onclose = () => {
      this.h.onConnection(false);
      setTimeout(() => this.connect(), this.retry);
      this.retry = Math.min(8000, this.retry * 1.6);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (m) => {
      let msg: { type: string; [k: string]: unknown };
      try {
        msg = JSON.parse(String(m.data));
      } catch {
        return;
      }
      switch (msg.type) {
        case 'hello':
          this.h.onHello(msg.provinces as ProvincesFile, msg.balance as Balance, msg.settings as OverlaySettings);
          break;
        case 'snapshot': {
          const s = msg.data as Snapshot;
          const sample = s.t - Date.now();
          this.offset = this.hasOffset ? this.offset * 0.8 + sample * 0.2 : sample;
          this.hasOffset = true;
          this.h.onSnapshot(s);
          break;
        }
        case 'fx':
          this.h.onFx(msg.data as FxEvent[]);
          break;
        case 'settings':
          this.h.onSettings(msg.data as OverlaySettings);
          break;
        case 'balance':
          this.h.onBalance(msg.data as Balance);
          break;
      }
    };
  }
}
