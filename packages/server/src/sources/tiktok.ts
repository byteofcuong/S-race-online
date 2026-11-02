import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import type { EventHandler, EventSource, SourceStatus } from './types.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyMsg = any;

export interface TikTokSourceOptions {
  username: string;
  signApiKey?: string;
  /** giây chờ trước khi kết nối lại */
  reconnectDelaySec?: number;
}

/**
 * Bọc tiktok-live-connector thành nguồn sự kiện chuẩn.
 * Thư viện này là reverse-engineering, có thể hỏng khi TikTok đổi; mọi thứ liên quan gom ở đây.
 */
export class TikTokSource implements EventSource {
  readonly name = 'tiktok';
  private conn?: TikTokLiveConnection;
  private stopped = false;
  private connected = false;
  private detail = 'chưa kết nối';
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private opts: TikTokSourceOptions,
    private onEvent: EventHandler,
  ) {}

  status(): SourceStatus {
    return { name: this.name, connected: this.connected, detail: `${this.opts.username}: ${this.detail}` };
  }

  async start() {
    this.stopped = false;
    await this.connect();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    if (this.conn) {
      try {
        await this.conn.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.connected = false;
    this.detail = 'đã ngắt';
  }

  private scheduleReconnect(reason: string) {
    if (this.stopped) return;
    const delay = (this.opts.reconnectDelaySec ?? 10) * 1000;
    this.detail = `${reason} – thử lại sau ${delay / 1000}s`;
    console.warn(`[tiktok] ${this.detail}`);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }

  private async connect() {
    if (this.stopped) return;
    const username = this.opts.username.replace(/^@/, '');
    const conn = new TikTokLiveConnection(username, {
      signApiKey: this.opts.signApiKey || undefined,
      processInitialData: false,
      enableExtendedGiftInfo: true,
    });
    this.conn = conn;
    this.detail = 'đang kết nối…';
    // typing của typed-emitter không resolve được dưới NodeNext → dùng kiểu tối giản
    const on = (conn as unknown as { on(ev: string, cb: (d: AnyMsg) => void): void }).on.bind(conn);

    const user = (d: AnyMsg) => ({
      userId: String(d?.user?.userId ?? d?.user?.uniqueId ?? 'unknown'),
      nickname: String(d?.user?.nickname ?? d?.user?.uniqueId ?? 'ẩn danh'),
    });

    on(WebcastEvent.CHAT, (d: AnyMsg) => {
      this.onEvent({ type: 'comment', ...user(d), text: String(d?.comment ?? '') }, this.name);
    });
    on(WebcastEvent.LIKE, (d: AnyMsg) => {
      this.onEvent({ type: 'like', ...user(d), count: Number(d?.likeCount ?? 1) }, this.name);
    });
    on(WebcastEvent.GIFT, (d: AnyMsg) => {
      const details = d?.giftDetails ?? {};
      const ext = d?.extendedGiftInfo ?? {};
      const diamonds = Number(details.diamondCount ?? ext.diamond_count ?? ext.diamondCount ?? 0);
      const giftType = Number(details.giftType ?? ext.type ?? 1);
      const repeatEndRaw = d?.repeatEnd;
      const repeatEnd = giftType !== 1 || repeatEndRaw === true || repeatEndRaw === 1;
      this.onEvent(
        {
          type: 'gift',
          ...user(d),
          giftId: String(d?.giftId ?? 'unknown'),
          giftName: String(details.giftName ?? ext.name ?? 'Quà'),
          diamonds,
          repeatCount: Number(d?.repeatCount ?? 1),
          repeatEnd,
        },
        this.name,
      );
    });
    on(WebcastEvent.FOLLOW, (d: AnyMsg) => this.onEvent({ type: 'follow', ...user(d) }, this.name));
    on(WebcastEvent.SHARE, (d: AnyMsg) => this.onEvent({ type: 'share', ...user(d) }, this.name));
    on(WebcastEvent.MEMBER, (d: AnyMsg) => this.onEvent({ type: 'join', ...user(d) }, this.name));
    on(WebcastEvent.ROOM_USER, (d: AnyMsg) => {
      const n = Number(d?.viewerCount ?? 0);
      if (n > 0) this.onEvent({ type: 'viewers', count: n }, this.name);
    });
    on(WebcastEvent.STREAM_END, () => {
      this.connected = false;
      this.scheduleReconnect('live đã kết thúc');
    });
    on(ControlEvent.DISCONNECTED, () => {
      if (!this.connected) return;
      this.connected = false;
      this.scheduleReconnect('mất kết nối');
    });
    on(ControlEvent.ERROR, (err: AnyMsg) => {
      console.warn('[tiktok] lỗi:', err?.info ?? err);
    });

    try {
      const state = await conn.connect();
      this.connected = true;
      this.detail = `đã kết nối room ${state.roomId}`;
      console.log(`[tiktok] ${this.detail}`);
    } catch (e) {
      this.connected = false;
      const msg = (e as Error)?.message ?? String(e);
      // chưa live → chờ lâu hơn
      const offline = /offline|not live|LIVE_HAS_ENDED/i.test(msg);
      this.opts.reconnectDelaySec = offline ? 30 : this.opts.reconnectDelaySec ?? 10;
      this.scheduleReconnect(offline ? 'kênh chưa live' : `kết nối thất bại: ${msg.slice(0, 120)}`);
    }
  }
}
