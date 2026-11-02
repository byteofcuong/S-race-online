import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

export type OutMsg =
  | { type: 'hello'; provinces: unknown; balance: unknown; settings: OverlaySettings; status: unknown }
  | { type: 'snapshot'; data: unknown }
  | { type: 'fx'; data: unknown[] }
  | { type: 'settings'; data: OverlaySettings }
  | { type: 'status'; data: unknown }
  | { type: 'balance'; data: unknown };

export interface OverlaySettings {
  muted: boolean;
  safeZone: boolean;
  volume: number;
  /** timestamp: đổi giá trị → overlay nạp lại manifest ảnh */
  reloadAssets?: number;
}

export class Hub {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();

  constructor(
    server: Server,
    private hello: () => OutMsg,
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify(this.hello()));
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
  }

  get size() {
    return this.clients.size;
  }

  broadcast(msg: OutMsg) {
    if (this.clients.size === 0) return;
    const data = JSON.stringify(msg);
    for (const c of this.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(data);
    }
  }
}
