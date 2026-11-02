import type { GameEvent } from '@srace/engine';

export type EventHandler = (ev: GameEvent, source: string) => void;

export interface SourceStatus {
  name: string;
  connected: boolean;
  detail?: string;
}

/** Nguồn sự kiện: TikTok thật hoặc giả lập. Engine không biết nguồn nào đang chạy. */
export interface EventSource {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  status(): SourceStatus;
}
