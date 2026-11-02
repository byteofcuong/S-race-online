import type { Balance, FxEvent, Province, ProvincesFile, Snapshot } from '@srace/engine';
import { assets } from '../assets.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** <img> icon Fluent (hoặc ảnh người dùng ghi đè). */
function ico(name: string, cls = 'ico'): string {
  const url = assets.iconUrl(name);
  return url ? `<img class="${cls}" src="${url}" alt="">` : '';
}

const CTA_ROTATION: [string, string][] = [
  ['speech-balloon', 'Gõ tên tỉnh (HN, SG, Nghệ An…) để vào đội!'],
  ['red-heart', 'Thả tim = xe tỉnh bạn chạy nhanh hơn'],
  ['rocket', 'Quà nhỏ tăng tốc · quà vừa bật NITRO'],
  ['bomb', 'Quà lớn phá đội dẫn đầu · Follow/Share = khiên'],
];

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
  private vehicleImg(id: string, cls = 'veh'): string {
    if (!this.provincesFile) return '';
    const { url } = assets.vehicle(this.provincesFile, id);
    return url ? `<img class="${cls}" src="${url}" alt="">` : '';
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
    timer.innerHTML = s.paused ? '⏸' : s.phase === 'golden' ? `${ico('high-voltage', 'ico big')}${remaining}` : fmt(shown);
    timer.classList.toggle('gold', s.phase === 'golden');
    timer.classList.toggle('urgent', s.phase === 'golden' && remaining <= 10);
    chip.innerHTML = {
      lobby: `${ico('vertical-traffic-light')}CHUẨN BỊ`,
      racing: `${ico('chequered-flag')}ĐANG ĐUA`,
      golden: `${ico('gem-stone')}QUÀ ×2`,
      podium: `${ico('trophy')}KẾT QUẢ`,
    }[s.phase];

    // nhịp giây (cho âm thanh đếm ngược)
    if (remaining !== this.lastSecond) {
      this.lastSecond = remaining;
      this.onSecond?.(s.phase, remaining);
    }

    // ── CTA
    const cta = $('cta');
    const ctaText = $('cta-text');
    const ctaIco = $<HTMLImageElement>('cta-ico');
    cta.className = 'cta';
    let icon = 'speech-balloon';
    if (s.phase === 'golden') {
      cta.classList.add('golden');
      icon = 'high-voltage';
      ctaText.textContent = `QUÀ NHÂN ĐÔI còn ${remaining}s – tặng ngay cho tỉnh mình!`;
    } else if (s.lastSabotage && now - s.lastSabotage.at < 20000 && s.phase === 'racing') {
      cta.classList.add('revenge');
      icon = 'collision';
      ctaText.textContent = `${this.name(s.lastSabotage.toTeamId)} bị ${this.name(s.lastSabotage.fromTeamId)} phá! Tặng quà để trả đũa`;
    } else if (s.phase === 'lobby') {
      ctaText.textContent = 'Gõ tên tỉnh (HN, SG, Nghệ An…) để vào đội ngay!';
    } else if (s.phase === 'podium') {
      icon = 'chequered-flag';
      ctaText.textContent = 'Ván mới bắt đầu ngay – gõ tên tỉnh để đổi/vào đội';
    } else {
      if (now > this.ctaSwitchAt) {
        this.ctaSwitchAt = now + 6000;
        this.ctaIdx = (this.ctaIdx + 1) % CTA_ROTATION.length;
      }
      [icon, ctaText.textContent] = CTA_ROTATION[this.ctaIdx];
    }
    const url = assets.iconUrl(icon) ?? '';
    if (ctaIco.getAttribute('src') !== url) ctaIco.src = url;

    // ── bảng đua
    this.renderBoard(s, now);

    // ── bảng giữa (lobby / podium)
    this.renderCenter(s, remaining);

    // ── góc thống kê
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
        host.innerHTML = `<div class="board-empty">${ico('speech-balloon', 'ico big')}<br>Chưa có đội nào.<br>Gõ tên tỉnh để mở đường đua!</div>`;
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
        el.innerHTML = `<div class="bar"></div><div class="rank"></div>${this.vehicleImg(t.id)}<div class="code"></div><div class="name"></div><div class="icons"></div><div class="meta"></div>`;
        (el.querySelector('.bar') as HTMLElement).style.background = this.color(t.id);
        (el.querySelector('.code') as HTMLElement).style.background = this.color(t.id);
        el.querySelector('.code')!.textContent = this.code(t.id);
        el.querySelector('.name')!.textContent = this.name(t.id);
        host.appendChild(el);
        this.rows.set(t.id, el);
      }
      el.style.order = String(i);
      el.classList.toggle('leader', i === 0 && s.phase !== 'lobby');
      el.classList.toggle('slowed', t.slowUntil > now);
      (el.querySelector('.bar') as HTMLElement).style.width = `${Math.round(t.progress * 100)}%`;
      el.querySelector('.rank')!.textContent = String(i + 1);
      const icons: string[] = [];
      if (t.shields > 0) icons.push(ico('shield', 'ico sm'));
      if (t.winStreak > 0) icons.push(ico('crown', 'ico sm') + (t.winStreak > 1 ? `<b>${t.winStreak}</b>` : ''));
      if (t.nitroUntil > now) icons.push(ico('fire', 'ico sm'));
      if (t.slowUntil > now) icons.push(ico('collision', 'ico sm'));
      const html = icons.join('');
      const ie = el.querySelector('.icons')!;
      if (ie.innerHTML !== html) ie.innerHTML = html;
      el.querySelector('.meta')!.innerHTML = `${ico('busts-in-silhouette', 'ico xs')}${t.members}<br>${ico('gem-stone', 'ico xs')}${fmtNum(t.diamondsRound)}`;
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
    if (s.phase === 'lobby') {
      title.textContent = `VÁN ${s.round} SẮP BẮT ĐẦU`;
      sub.textContent = s.teamCount === 0 ? 'Gõ tên tỉnh của bạn để mở đường đua!' : `${s.teamCount} tỉnh đã sẵn sàng · Gõ tên tỉnh để vào đội`;
      const w = s.lastResult?.winnerTeamId ? s.teams.find((t) => t.id === s.lastResult!.winnerTeamId) : undefined;
      const streak = w && w.winStreak > 1 ? ` · thắng ${w.winStreak} ván liên tiếp` : '';
      const html = s.lastResult?.winnerTeamId
        ? `<div class="row">${ico('trophy', 'ico medal')}${this.vehicleImg(s.lastResult.winnerTeamId)}<span>Vô địch ván trước: ${this.name(s.lastResult.winnerTeamId)}${streak}</span></div>`
        : '';
      if (list.innerHTML !== html) list.innerHTML = html;
      foot.innerHTML = `${ico('vertical-traffic-light')}Xuất phát sau ${remaining}s`;
      return;
    }
    // podium
    const r = s.lastResult;
    if (!r || !r.winnerTeamId) {
      title.textContent = 'HẾT VÁN';
      sub.textContent = 'Chưa có đội nào về đích';
      list.innerHTML = '';
      foot.textContent = `Ván mới sau ${remaining}s`;
      return;
    }
    const w = s.teams.find((t) => t.id === r.winnerTeamId);
    title.innerHTML = `${ico('trophy', 'ico big')}${this.name(r.winnerTeamId).toUpperCase()} VÔ ĐỊCH VÁN ${r.round}`;
    sub.textContent = r.finishedEarly ? 'Về đích Lũng Cú trước giờ!' : w && w.winStreak > 1 ? `Thắng ${w.winStreak} ván liên tiếp!` : 'Cả nước ơi, ván sau lật kèo nhé!';
    const medals = ['1st-place-medal', '2nd-place-medal', '3rd-place-medal'];
    let html = r.podium
      .map(
        (p, i) =>
          `<div class="row">${ico(medals[i], 'ico medal')}${this.vehicleImg(p.teamId)}<span class="chip" style="background:${this.color(p.teamId)}"></span><span>${this.name(p.teamId)}</span><span class="pct">${Math.round(p.progress * 100)}%</span></div>`,
      )
      .join('');
    if (r.mvp) html += `<div class="row">${ico('glowing-star', 'ico medal')}<span>MVP: ${esc(r.mvp.nickname)} (${this.name(r.mvp.teamId)}) · ${fmtNum(r.mvp.diamonds)}</span>${ico('gem-stone', 'ico sm')}</div>`;
    if (list.innerHTML !== html) list.innerHTML = html;
    foot.textContent = `Ván ${r.round + 1} bắt đầu sau ${remaining}s`;
  }

  toast(text: string, cls = '', ms = 3200, icon?: string) {
    const host = $('toasts');
    while (host.childElementCount >= 3) host.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.innerHTML = `${icon ? ico(icon) : ''}<span>${esc(text, 120)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }

  handleFx(f: FxEvent, now: number) {
    switch (f.kind) {
      case 'join': {
        if (now - this.lastJoinToast < 2500) return;
        this.lastJoinToast = now;
        const via = f.viaOldName ? ` (${f.viaOldName})` : '';
        this.toast(
          f.switched ? `${esc(f.nickname)} chuyển sang đội ${this.name(f.teamId)}` : `${esc(f.nickname)} vào đội ${this.name(f.teamId)}${via}`,
          'join',
          2200,
          f.switched ? 'repeat-button' : f.auto ? 'game-die' : 'speech-balloon',
        );
        break;
      }
      case 'nitro':
        if (f.tier === 'small') return;
        this.toast(
          f.tier === 'super'
            ? `${esc(f.nickname)} tặng ${f.diamonds} kim cương – BÃO cho ${this.name(f.teamId)}!`
            : f.tier === 'large'
              ? `${esc(f.nickname)} (${this.name(f.teamId)}) tặng ${f.diamonds} kim cương – PHÁ ĐỘI DẪN ĐẦU!`
              : `${esc(f.nickname)} bật nitro cho ${this.name(f.teamId)} +${f.diamonds}${f.golden ? ' ×2' : ''}`,
          'nitro',
          3200,
          f.tier === 'super' ? 'tornado' : f.tier === 'large' ? 'bomb' : 'rocket',
        );
        break;
      case 'sabotage':
        this.toast(`${this.name(f.fromTeamId)} thả ổ gà cho ${this.name(f.toTeamId)}! ${this.name(f.toTeamId)} ơi, trả đũa đi!`, 'sabotage', 4000, 'collision');
        break;
      case 'storm':
        this.toast(`BÃO từ ${this.name(f.teamId)} quét sạch ${f.hitTeamIds.length} đội!`, 'storm', 4500, 'tornado');
        break;
      case 'shieldGain':
        this.toast(`${esc(f.nickname)} ${f.source === 'follow' ? 'follow' : 'share'} – ${this.name(f.teamId)} có KHIÊN chống phá!`, 'shield', 3200, 'shield');
        break;
      case 'shieldBreak':
        this.toast(`Khiên của ${this.name(f.teamId)} đỡ được cú phá từ ${this.name(f.attackerTeamId)}!`, 'shield', 3200, 'shield');
        break;
      case 'combo':
        this.toast(`COMBO ${this.name(f.teamId)}! Quà tiếp theo +25% trong 10s`, 'combo', 3200, 'fire');
        break;
      case 'overtake':
        this.toast(`${this.name(f.teamId)} vượt lên dẫn đầu!`, 'overtake', 2500, 'high-voltage');
        break;
      case 'finish':
        this.toast(`${this.name(f.teamId)} VỀ ĐÍCH LŨNG CÚ!`, 'overtake', 5000, 'chequered-flag');
        break;
      case 'phase':
        if (f.phase === 'racing') this.toast('XUẤT PHÁT! Từ Cà Mau ra Hà Giang!', 'overtake', 3000, 'vertical-traffic-light');
        if (f.phase === 'golden') this.toast('GIỜ VÀNG – mọi quà nhân đôi!', 'combo', 4000, 'high-voltage');
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
