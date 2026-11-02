import type { Balance, FxEvent, Province, ProvincesFile, Snapshot } from '@srace/engine';
import { assets } from '../assets.ts';
import { textOn } from '../color.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** <img> icon Fluent (hoặc ảnh người dùng ghi đè). */
function ico(name: string, cls = 'ico'): string {
  const url = assets.iconUrl(name);
  return url ? `<img class="${cls}" src="${url}" alt="">` : '';
}

const CTA_ROTATION: [string, string][] = [
  ['speech-balloon', 'Gõ tên tỉnh (HN, SG, Nghệ An…) để vào đội'],
  ['red-heart', 'Thả tim để xe tỉnh bạn chạy nhanh hơn'],
  ['rocket', 'Quà nhỏ tăng tốc · quà vừa bật nitro'],
  ['bomb', 'Quà lớn phá đội dẫn đầu · follow = khiên'],
];

/** Loại toast → màu thanh bên trái (một kiểu toast duy nhất, chỉ khác điểm nhấn). */
type ToastKind = 'info' | 'gift' | 'attack' | 'storm' | 'shield' | 'gold';

/** HUD bằng DOM: thanh trạng thái, giờ vàng, CTA, bảng đua, toast, podium. */
export class Hud {
  private provinces = new Map<string, Province>();
  private provincesFile?: ProvincesFile;
  private balance?: Balance;
  private rows = new Map<string, HTMLElement>();
  private lastJoinToast = 0;
  private ctaIdx = 0;
  private ctaSwitchAt = 0;
  private lastSecond = -1;
  onSecond?: (phase: string, remaining: number) => void;

  setConfig(p: ProvincesFile, b: Balance) {
    this.provincesFile = p;
    this.provinces = new Map(p.provinces.map((x) => [x.id, x]));
    this.balance = b;
    $('stat-viewers').innerHTML = `${ico('eyes')}<span>0</span>`;
    $('stat-likes').innerHTML = `${ico('red-heart')}<span>0</span>`;
    $('stat-diamonds').innerHTML = `${ico('gem-stone')}<span>0</span>`;
    const credit = document.querySelector('#corner .credit');
    if (credit) credit.textContent = `Bản đồ: svg-maps (CC BY 4.0) · Icon: Fluent Emoji${assets.usingPack ? ' · Xe: Kenney' : ''}`;
    this.rows.clear();
    $('board-rows').innerHTML = '';
  }

  setBalance(b: Balance) {
    this.balance = b;
  }

  name(id: string) {
    return this.provinces.get(id)?.short ?? id;
  }
  private color(id: string) {
    return this.provinces.get(id)?.color ?? '#fff';
  }
  private code(id: string) {
    return this.provinces.get(id)?.code ?? '??';
  }
  private chip(id: string) {
    return `<span class="chip" style="background:${this.color(id)}"></span>`;
  }

  setConnected(ok: boolean) {
    $('conn').classList.toggle('hidden', ok);
  }

  setSafeZone(on: boolean) {
    $('safezone').classList.toggle('hidden', !on);
  }

  update(s: Snapshot, now: number) {
    if (!this.provincesFile) return; // chờ setConfig (sau khi nạp manifest ảnh)
    const remainingMs = Math.max(0, s.phaseEndsAt - now);
    const remaining = Math.ceil(remainingMs / 1000);
    const goldenSec = this.balance?.round.goldenSec ?? 45;

    // ── thanh trạng thái
    $('round-no').textContent = String(s.round);
    const timer = $('timer');
    const chip = $('phase-chip');
    chip.className = `phase-chip ${s.phase}`;
    let shown = remaining;
    if (s.phase === 'racing') shown = remaining + goldenSec;
    // giờ vàng: đồng hồ to màu vàng ngay trên thanh trạng thái (không đè bản đồ)
    const timerHtml = s.paused ? '⏸' : s.phase === 'golden' ? `${ico('high-voltage', 'ico big')}${remaining}` : fmt(shown);
    if (timer.innerHTML !== timerHtml) timer.innerHTML = timerHtml;
    timer.classList.toggle('gold', s.phase === 'golden');
    timer.classList.toggle('urgent', s.phase === 'golden' && remaining <= 10);
    const chipHtml = { lobby: 'CHUẨN BỊ', racing: 'ĐANG ĐUA', golden: 'QUÀ ×2', podium: 'KẾT QUẢ' }[s.phase];
    if (chip.textContent !== chipHtml) chip.textContent = chipHtml;

    // nhịp giây (cho âm thanh đếm ngược)
    if (remaining !== this.lastSecond) {
      this.lastSecond = remaining;
      this.onSecond?.(s.phase, remaining);
    }

    // ── CTA
    const cta = $('cta');
    const ctaText = $('cta-text');
    const ctaIco = $<HTMLImageElement>('cta-ico');
    let cls = 'cta';
    let icon = 'speech-balloon';
    let text: string;
    if (s.phase === 'golden') {
      cls += ' golden';
      icon = 'high-voltage';
      text = `Quà nhân đôi còn ${remaining}s – tặng cho tỉnh mình!`;
    } else if (s.lastSabotage && now - s.lastSabotage.at < 20000 && s.phase === 'racing') {
      cls += ' revenge';
      icon = 'collision';
      text = `${this.name(s.lastSabotage.toTeamId)} bị phá! Tặng quà để trả đũa`;
    } else if (s.phase === 'lobby') {
      text = 'Gõ tên tỉnh (HN, SG, Nghệ An…) để vào đội';
    } else if (s.phase === 'podium') {
      icon = 'chequered-flag';
      text = 'Ván mới sắp bắt đầu – gõ tên tỉnh để vào đội';
    } else {
      if (now > this.ctaSwitchAt) {
        this.ctaSwitchAt = now + 6000;
        this.ctaIdx = (this.ctaIdx + 1) % CTA_ROTATION.length;
      }
      [icon, text] = CTA_ROTATION[this.ctaIdx];
    }
    if (cta.className !== cls) cta.className = cls;
    if (ctaText.textContent !== text) ctaText.textContent = text;
    const url = assets.iconUrl(icon) ?? '';
    if (ctaIco.getAttribute('src') !== url) ctaIco.src = url;

    this.renderBoard(s, now);
    this.renderCenter(s, remaining);

    $('stat-viewers').querySelector('span')!.textContent = String(s.viewers);
    $('stat-likes').querySelector('span')!.textContent = fmtNum(s.totalLikes);
    $('stat-diamonds').querySelector('span')!.textContent = fmtNum(s.totalDiamonds);
  }

  private renderBoard(s: Snapshot, now: number) {
    const max = this.balance?.display.maxCars ?? 8;
    const host = $('board-rows');
    const shown = s.teams.slice(0, max);
    $('board-count').textContent = `${s.teamCount} tỉnh`;
    if (shown.length === 0) {
      if (!host.querySelector('.board-empty')) {
        host.innerHTML = `<div class="board-empty">Chưa có đội nào<br><b>Gõ tên tỉnh để mở đường đua</b></div>`;
        this.rows.clear();
      }
      return;
    }
    host.querySelector('.board-empty')?.remove();
    const ids = new Set(shown.map((t) => t.id));
    for (const [id, el] of this.rows) {
      if (!ids.has(id)) {
        el.remove();
        this.rows.delete(id);
      }
    }
    shown.forEach((t, i) => {
      let el = this.rows.get(t.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'brow';
        el.innerHTML = `<div class="rank"></div><div class="code"></div><div class="name"></div><div class="icons"></div><div class="meta"></div><div class="bar"></div>`;
        const code = el.querySelector('.code') as HTMLElement;
        code.style.background = this.color(t.id);
        code.style.color = textOn(this.color(t.id));
        code.textContent = this.code(t.id);
        el.querySelector('.name')!.textContent = this.name(t.id);
        (el.querySelector('.bar') as HTMLElement).style.background = this.color(t.id);
        host.appendChild(el);
        this.rows.set(t.id, el);
      }
      el.style.order = String(i);
      el.classList.toggle('leader', i === 0 && s.phase !== 'lobby');
      el.classList.toggle('slowed', t.slowUntil > now);
      (el.querySelector('.bar') as HTMLElement).style.width = `${Math.round(t.progress * 100)}%`;
      el.querySelector('.rank')!.textContent = String(i + 1);
      // tối đa 2 icon trạng thái, ưu tiên cái quan trọng nhất
      const icons: string[] = [];
      if (t.slowUntil > now) icons.push(ico('collision', 'ico sm'));
      else if (t.nitroUntil > now) icons.push(ico('fire', 'ico sm'));
      if (t.shields > 0) icons.push(ico('shield', 'ico sm'));
      else if (t.winStreak > 0) icons.push(ico('crown', 'ico sm'));
      const html = icons.slice(0, 2).join('');
      const ie = el.querySelector('.icons')!;
      if (ie.innerHTML !== html) ie.innerHTML = html;
      const meta = `${t.members}<span class="dot">·</span>${fmtNum(t.diamondsRound)}${ico('gem-stone', 'ico xs')}`;
      const me = el.querySelector('.meta')!;
      if (me.innerHTML !== meta) me.innerHTML = meta;
    });
  }

  private renderCenter(s: Snapshot, remaining: number) {
    const box = $('center');
    if (s.phase === 'racing' || s.phase === 'golden') {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    const title = $('center-title');
    const sub = $('center-sub');
    const list = $('center-list');
    const foot = $('center-foot');
    const setHtml = (el: HTMLElement, html: string) => {
      if (el.innerHTML !== html) el.innerHTML = html;
    };
    if (s.phase === 'lobby') {
      setHtml(title, `VÁN ${s.round} SẮP BẮT ĐẦU`);
      sub.textContent = s.teamCount === 0 ? 'Gõ tên tỉnh của bạn để mở đường đua' : `${s.teamCount} tỉnh đã sẵn sàng · gõ tên tỉnh để vào đội`;
      const w = s.lastResult?.winnerTeamId ? s.teams.find((t) => t.id === s.lastResult!.winnerTeamId) : undefined;
      const streak = w && w.winStreak > 1 ? ` · thắng ${w.winStreak} ván liền` : '';
      setHtml(
        list,
        s.lastResult?.winnerTeamId
          ? `<div class="row">${ico('trophy', 'ico medal')}${this.chip(s.lastResult.winnerTeamId)}<span>Vô địch ván trước: ${this.name(s.lastResult.winnerTeamId)}${streak}</span></div>`
          : '',
      );
      setHtml(foot, `Xuất phát sau ${remaining}s`);
      return;
    }
    // podium
    const r = s.lastResult;
    if (!r || !r.winnerTeamId) {
      setHtml(title, 'HẾT VÁN');
      sub.textContent = 'Chưa có đội nào về đích';
      setHtml(list, '');
      setHtml(foot, `Ván mới sau ${remaining}s`);
      return;
    }
    const w = s.teams.find((t) => t.id === r.winnerTeamId);
    setHtml(title, `${ico('trophy', 'ico big')}${this.name(r.winnerTeamId).toUpperCase()} VÔ ĐỊCH`);
    sub.textContent = r.finishedEarly ? 'Về đích Lũng Cú trước giờ!' : w && w.winStreak > 1 ? `Thắng ${w.winStreak} ván liền!` : `Ván ${r.round} · ván sau lật kèo nhé!`;
    const medals = ['1st-place-medal', '2nd-place-medal', '3rd-place-medal'];
    let html = r.podium
      .map((p, i) => `<div class="row">${ico(medals[i], 'ico medal')}${this.chip(p.teamId)}<span>${this.name(p.teamId)}</span><span class="pct">${Math.round(p.progress * 100)}%</span></div>`)
      .join('');
    if (r.mvp) html += `<div class="row mvp">${ico('glowing-star', 'ico medal')}<span>MVP ${esc(r.mvp.nickname)} · ${this.name(r.mvp.teamId)}</span><span class="pct">${fmtNum(r.mvp.diamonds)}${ico('gem-stone', 'ico sm')}</span></div>`;
    setHtml(list, html);
    setHtml(foot, `Ván ${r.round + 1} bắt đầu sau ${remaining}s`);
  }

  toast(text: string, kind: ToastKind = 'info', ms = 3200, icon?: string) {
    const host = $('toasts');
    while (host.childElementCount >= 2) host.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon ? ico(icon) : ''}<span>${esc(text, 90)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  handleFx(f: FxEvent, now: number) {
    switch (f.kind) {
      case 'join': {
        if (now - this.lastJoinToast < 4000) return;
        this.lastJoinToast = now;
        const via = f.viaOldName ? ` (${f.viaOldName})` : '';
        this.toast(f.switched ? `${esc(f.nickname)} sang đội ${this.name(f.teamId)}` : `${esc(f.nickname)} vào đội ${this.name(f.teamId)}${via}`, 'info', 2200, 'speech-balloon');
        break;
      }
      case 'nitro':
        if (f.tier === 'small' || f.tier === 'medium') return; // quà nhỏ/vừa chỉ hiện chữ nổi trên xe
        this.toast(
          f.tier === 'super' ? `${esc(f.nickname)} gọi BÃO cho ${this.name(f.teamId)}` : `${esc(f.nickname)} tặng ${f.diamonds} – ${this.name(f.teamId)} phá đội dẫn đầu`,
          'gift',
          3200,
          f.tier === 'super' ? 'tornado' : 'bomb',
        );
        break;
      case 'sabotage':
        this.toast(`${this.name(f.fromTeamId)} thả ổ gà cho ${this.name(f.toTeamId)}`, 'attack', 3600, 'collision');
        break;
      case 'storm':
        break; // đã có toast từ nitro bậc siêu
      case 'shieldGain':
        this.toast(`${this.name(f.teamId)} có khiên chống phá`, 'shield', 2600, 'shield');
        break;
      case 'shieldBreak':
        this.toast(`Khiên ${this.name(f.teamId)} đỡ được cú phá`, 'shield', 2600, 'shield');
        break;
      case 'combo':
        this.toast(`Combo ${this.name(f.teamId)}! Quà +25% trong 10s`, 'gold', 2600, 'fire');
        break;
      case 'overtake':
        this.toast(`${this.name(f.teamId)} vượt lên dẫn đầu`, 'info', 2200, 'high-voltage');
        break;
      case 'finish':
        this.toast(`${this.name(f.teamId)} về đích Lũng Cú!`, 'gold', 4000, 'chequered-flag');
        break;
      case 'phase':
        if (f.phase === 'racing') this.toast('Xuất phát! Cà Mau → Lũng Cú', 'info', 2600, 'vertical-traffic-light');
        if (f.phase === 'golden') this.toast('Giờ vàng – mọi quà nhân đôi', 'gold', 3600, 'high-voltage');
        break;
    }
  }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}
function esc(s: string, max = 24) {
  return s.replace(/[<>&]/g, '').slice(0, max);
}
