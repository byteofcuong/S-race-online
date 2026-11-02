import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import path from 'node:path';
import { LOG_DIR } from './config.ts';

/** Ghi mọi sự kiện ra logs/YYYY-MM-DD.jsonl để cân bằng game sau buổi live. */
export class JsonlLogger {
  private stream?: WriteStream;
  private day = '';

  constructor(private enabled = true) {
    if (enabled) mkdirSync(LOG_DIR, { recursive: true });
  }

  private ensure() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) {
      this.stream?.end();
      this.day = day;
      this.stream = createWriteStream(path.join(LOG_DIR, `${day}.jsonl`), { flags: 'a' });
    }
    return this.stream!;
  }

  log(kind: string, data: unknown) {
    if (!this.enabled) return;
    try {
      this.ensure().write(JSON.stringify({ ts: Date.now(), kind, ...(data as object) }) + '\n');
    } catch {
      /* không để log làm chết game */
    }
  }
}
