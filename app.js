/* 우미 점메추 — 앱 로직 (빌드 도구 없이 그대로 배포) */
(() => {
'use strict';

// ───────────────────────── 설정 · 상수
const CFG = window.JMC_CONFIG || {};
const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseKey);
const TAU = Math.PI * 2;
const FONT = "'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MAX_MENUS = 40;
const MAX_NAME = 24;
const PINBALL_MAX = 20;

const PRESETS = {
  lunch:     { label: '점심', items: ['김치찌개', '된장찌개', '제육볶음', '돈까스', '비빔밥', '국밥', '칼국수', '냉면', '짜장면', '초밥', '쌀국수', '햄버거'] },
  breakfast: { label: '아침', items: ['김밥', '토스트', '샌드위치', '전복죽', '베이글', '샐러드', '시리얼', '편의점 도시락'] },
  dinner:    { label: '저녁', items: ['삼겹살', '치킨', '족발', '회', '곱창', '피자', '닭갈비', '소고기', '부대찌개', '중식'] },
  cafe:      { label: '카페', items: ['아메리카노', '카페라떼', '바닐라라떼', '콜드브루', '아이스티', '레몬에이드', '스무디', '녹차라떼'] },
};
const MODES = {
  roulette: { label: '룰렛', icon: '🎡', hint: '바늘이 멈춘 칸이 당첨입니다' },
  slot:     { label: '슬롯', icon: '🎰', hint: '가운데 줄에 멈춘 메뉴가 당첨입니다' },
  pinball:  { label: '핀볼', icon: '🔴', hint: '공이 떨어진 칸이 당첨입니다 · 칸 순서는 매번 섞입니다' },
};
const PALETTE = ['#F25C3B', '#F7A531', '#3BB273', '#2D8CF0', '#8B5CF6', '#EC4899', '#14B8A6', '#F2C94C', '#6366F1', '#84CC16'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];

// ───────────────────────── 유틸
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutQuart = p => 1 - Math.pow(1 - p, 4);
const easeOutQuint = p => 1 - Math.pow(1 - p, 5);
const easeInOut = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseDate(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
function shortDate(s) { const d = parseDate(s); return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} (${WD[d.getDay()]})`; }
function longDate(s) { const d = parseDate(s); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; }
function hhmm(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function randInt(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function rand() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function cleanTeam(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30); }
function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME); }
function segColor(i, n) { let c = i % PALETTE.length; if (n > 1 && i === n - 1 && c === 0) c = 3; return PALETTE[c]; }
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.66 ? '#1F2430' : '#FFFFFF';
}
function animate(dur, onFrame) {
  return new Promise(res => {
    const t0 = performance.now();
    const f = now => { const p = Math.min(1, (now - t0) / dur); onFrame(p); if (p < 1) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
}
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}

// ───────────────────────── 저장소: 로컬 (이 브라우저)
const LocalStore = {
  _get(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } },
  _put(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  async listRooms() { return this._get('jmc.rooms').sort((a, b) => b.date.localeCompare(a.date) || a.team.localeCompare(b.team)); },
  async getRoom(id) { return this._get('jmc.rooms').find(r => r.id === id) || null; },
  async findRoom(date, team) { return this._get('jmc.rooms').find(r => r.date === date && r.team === team) || null; },
  async createRoom({ date, team, menus }) {
    const rooms = this._get('jmc.rooms');
    if (rooms.some(r => r.date === date && r.team === team)) { const e = new Error('이미 있는 파일'); e.code = 'exists'; throw e; }
    const now = new Date().toISOString();
    const row = { id: uuid(), date, team, menus, created_at: now, updated_at: now };
    rooms.push(row); this._put('jmc.rooms', rooms); return row;
  },
  async updateMenus(id, menus) {
    const rooms = this._get('jmc.rooms'); const r = rooms.find(x => x.id === id);
    if (!r) throw new Error('파일이 없습니다');
    r.menus = menus; r.updated_at = new Date().toISOString(); this._put('jmc.rooms', rooms);
  },
  async deleteRoom(id) {
    this._put('jmc.rooms', this._get('jmc.rooms').filter(r => r.id !== id));
    this._put('jmc.spins', this._get('jmc.spins').filter(s => s.room_id !== id));
  },
  async listSpins({ roomId, limit = 1000 } = {}) {
    let s = this._get('jmc.spins'); if (roomId) s = s.filter(x => x.room_id === roomId);
    return s.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  },
  async addSpin(sp) {
    const s = this._get('jmc.spins'); const row = { id: uuid(), created_at: new Date().toISOString(), ...sp };
    s.push(row); this._put('jmc.spins', s); return row;
  },
  async listLists() { return sortLists(this._get('jmc.lists')); },
  async createList({ name, items }) {
    const ls = this._get('jmc.lists');
    if (ls.some(l => l.name === name)) { const e = new Error('같은 이름의 목록이 있습니다'); e.code = 'exists'; throw e; }
    const now = new Date().toISOString(), row = { id: uuid(), name, items, created_at: now, updated_at: now };
    ls.push(row); this._put('jmc.lists', ls); return row;
  },
  async updateList(id, patch) {
    const ls = this._get('jmc.lists'), l = ls.find(x => x.id === id);
    if (!l) throw new Error('목록이 없습니다');
    if (patch.name && ls.some(x => x.name === patch.name && x.id !== id)) { const e = new Error('같은 이름의 목록이 있습니다'); e.code = 'exists'; throw e; }
    Object.assign(l, patch, { updated_at: new Date().toISOString() }); this._put('jmc.lists', ls);
  },
  async deleteList(id) { this._put('jmc.lists', this._get('jmc.lists').filter(l => l.id !== id)); },
};
function sortLists(ls) { return ls.sort((a, b) => a.name.localeCompare(b.name, 'ko')); }

// ───────────────────────── 저장소: Supabase (공유 DB, REST 직접 호출)
const RemoteStore = {
  base: REMOTE ? CFG.supabaseUrl.trim().replace(/\/+$/, '') + '/rest/v1/' : '',
  headers(extra) {
    const key = CFG.supabaseKey.trim();
    const h = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key; // 예전 방식 anon 키(JWT)
    return Object.assign(h, extra || {});
  },
  async req(path, opts = {}) {
    let res;
    try { res = await fetch(this.base + path, { ...opts, headers: this.headers(opts.headers) }); }
    catch (e) { throw new Error('서버에 연결하지 못했습니다 (인터넷·주소 확인)'); }
    if (!res.ok) {
      let body = ''; try { body = await res.text(); } catch (e) { /* 무시 */ }
      const e = new Error(`DB 오류 ${res.status}`); e.status = res.status; e.body = body;
      if (res.status === 409 || body.includes('23505')) e.code = 'exists';
      if (res.status === 401 || res.status === 403) e.message = `DB 권한 오류 ${res.status} (키·SQL 설정 확인)`;
      if (res.status === 404 && body.includes('PGRST205')) e.message = '테이블이 없습니다 (supabase_setup.sql 실행 필요)';
      throw e;
    }
    const t = await res.text(); return t ? JSON.parse(t) : null;
  },
  listRooms() { return this.req('rooms?select=*&order=date.desc,team.asc&limit=500'); },
  async getRoom(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const r = await this.req(`rooms?id=eq.${id}&select=*`); return r[0] || null;
  },
  async findRoom(date, team) { const r = await this.req(`rooms?date=eq.${date}&team=eq.${encodeURIComponent(team)}&select=*`); return r[0] || null; },
  async createRoom(row) {
    const r = await this.req('rooms', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    return r[0];
  },
  async updateMenus(id, menus) {
    await this.req(`rooms?id=eq.${id}`, { method: 'PATCH', keepalive: true, headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ menus, updated_at: new Date().toISOString() }) });
  },
  async deleteRoom(id) { await this.req(`rooms?id=eq.${id}`, { method: 'DELETE' }); },
  listSpins({ roomId, limit = 1000 } = {}) {
    return this.req(`spins?select=*${roomId ? `&room_id=eq.${roomId}` : ''}&order=created_at.desc&limit=${limit}`);
  },
  async addSpin(sp) {
    const r = await this.req('spins', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(sp) });
    return r[0];
  },
  async listLists() { return sortLists(await this.req('lists?select=*&order=name.asc&limit=500')); },
  async createList(row) {
    const r = await this.req('lists', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) });
    return r[0];
  },
  async updateList(id, patch) {
    await this.req(`lists?id=eq.${id}`, { method: 'PATCH', keepalive: true, headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
  },
  async deleteList(id) { await this.req(`lists?id=eq.${id}`, { method: 'DELETE' }); },
};
const Store = REMOTE ? RemoteStore : LocalStore;

// ───────────────────────── 소리
const Sound = {
  muted: store('jmc.muted') === '1',
  ctx: null,
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type = 'square', vol = 0.05, when = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  tick() { this.tone(1150 + rand() * 80, 0.025, 'square', 0.03); },
  peg() { this.tone(650 + rand() * 600, 0.045, 'triangle', 0.05); },
  thunk() { this.tone(180, 0.12, 'sine', 0.12); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.4 : 0.15, 'triangle', 0.08, i * 0.1)); },
};
const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';

// ───────────────────────── 테마 색 (캔버스용)
const Theme = {
  v: {},
  read() {
    const cs = getComputedStyle(document.documentElement);
    ['bg', 'card', 'ink', 'muted', 'line', 'accent', 'accent-soft', 'stage', 'peg', 'rim'].forEach(k => { this.v[k] = cs.getPropertyValue('--' + k).trim(); });
  },
};

// ───────────────────────── 캔버스 공통
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

const Stage = {
  canvas: null, ctx: null, game: null, items: [], w: 0, h: 0,
  mount(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); },
  setGame(g) { this.game = g; this.resize(); this.draw(); },
  resize() {
    if (!this.canvas || !this.game) return;
    const [w, h] = this.game.size, dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.aspectRatio = `${w} / ${h}`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  draw() {
    if (!this.canvas || !this.game || !this.canvas.isConnected) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.game.draw(this.ctx, this.items, Theme.v);
  },
};
function drawEmpty(ctx, w, h, th, msg) {
  ctx.fillStyle = th.muted; ctx.font = `600 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
}

// ───────────────────────── 게임 1: 룰렛
const Roulette = {
  size: [560, 580], angle: 0,
  current(n) { return Math.floor(mod(-this.angle, TAU) / (TAU / n)) % n; },
  draw(ctx, items, th) {
    const cx = 280, cy = 300, R = 250, n = items.length;
    // 바깥 테두리 + 전구
    ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, TAU); ctx.fillStyle = th.rim; ctx.fill();
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8), 3, 0, TAU);
      ctx.fillStyle = (k + Math.floor(this.angle * 2)) % 2 ? '#FFE7A3' : '#7A6A4A'; ctx.fill();
    }
    if (n === 0) {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fillStyle = th.card; ctx.fill();
      drawEmpty(ctx, 560, 600, th, '메뉴를 넣어 주세요');
    } else {
      const seg = TAU / n;
      for (let i = 0; i < n; i++) {
        const a0 = this.angle + i * seg - Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a0 + seg); ctx.closePath();
        ctx.fillStyle = segColor(i, n); ctx.fill();
        if (n > 1) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      const fs = n <= 6 ? 26 : n <= 10 ? 22 : n <= 16 ? 18 : n <= 24 ? 15 : 12;
      ctx.font = `750 ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const mid = this.angle + (i + 0.5) * seg - Math.PI / 2;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(mid);
        ctx.fillStyle = textOn(segColor(i, n));
        ctx.fillText(fitText(ctx, items[i], R - 78), R - 20, 1);
        ctx.restore();
      }
    }
    // 가운데 허브
    ctx.beginPath(); ctx.arc(cx, cy, 44, 0, TAU); ctx.fillStyle = th.rim; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 36, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.fillStyle = '#E8542F'; ctx.font = `850 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('점메추', cx, cy + 1);
    // 바늘 (위쪽)
    const ty = cy - R - 30;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.moveTo(cx - 20, ty); ctx.lineTo(cx + 20, ty); ctx.lineTo(cx, ty + 46); ctx.closePath();
    ctx.fillStyle = '#E8542F'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, ty + 6, 6, 0, TAU); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  },
  async spin(items) {
    const n = items.length, seg = TAU / n, target = randInt(n);
    const jitter = (rand() - 0.5) * seg * 0.72;
    const start = this.angle;
    let fin = -(target + 0.5) * seg + jitter;
    fin += TAU * Math.ceil((start + TAU * (6 + rand() * 2) - fin) / TAU);
    let last = this.current(n);
    await animate(reduceMotion ? 900 : 5200, p => {
      this.angle = start + (fin - start) * easeOutQuart(p);
      const c = this.current(n); if (c !== last) { last = c; Sound.tick(); }
      Stage.draw();
    });
    this.angle = mod(fin, TAU);
    return target;
  },
};

// ───────────────────────── 게임 2: 슬롯
const Slot = {
  size: [560, 580], offset: 0, lights: 0, lever: 0,
  draw(ctx, items, th) {
    const n = items.length;
    // 몸체
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    rrect(ctx, 20, 30, 470, 520, 34); ctx.fillStyle = '#E8542F'; ctx.fill(); ctx.restore();
    rrect(ctx, 34, 44, 442, 492, 26); ctx.fillStyle = '#C9431F'; ctx.fill();
    // 전구
    for (let k = 0; k < 13; k++) {
      const x = 62 + k * 32;
      [[x, 64], [x, 516]].forEach(([bx, by], j) => {
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, TAU);
        ctx.fillStyle = (k + j + this.lights) % 2 ? '#FFE7A3' : '#8E3216'; ctx.fill();
      });
    }
    ctx.fillStyle = '#FFFFFF'; ctx.font = `850 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('오늘의 메뉴', 255, 108);
    // 창
    const wx = 62, wy = 140, ww = 386, wh = 330, rowH = 92, cy = wy + wh / 2;
    rrect(ctx, wx - 6, wy - 6, ww + 12, wh + 12, 20); ctx.fillStyle = '#2A2F3C'; ctx.fill();
    ctx.save(); rrect(ctx, wx, wy, ww, wh, 15); ctx.clip();
    ctx.fillStyle = th.card; ctx.fillRect(wx, wy, ww, wh);
    if (n === 0) {
      ctx.fillStyle = th.muted; ctx.font = `600 20px ${FONT}`; ctx.fillText('메뉴를 넣어 주세요', wx + ww / 2, cy);
    } else {
      const base = Math.floor(this.offset);
      for (let k = base - 3; k <= base + 3; k++) {
        const idx = mod(k, n), y = cy + (k - this.offset) * rowH;
        ctx.beginPath(); ctx.arc(wx + 34, y, 9, 0, TAU); ctx.fillStyle = segColor(idx, n); ctx.fill();
        ctx.fillStyle = th.ink; ctx.font = `800 38px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(fitText(ctx, items[idx], ww - 110), wx + ww / 2 + 10, y + 2);
      }
      const g1 = ctx.createLinearGradient(0, wy, 0, wy + 90), g2 = ctx.createLinearGradient(0, wy + wh - 90, 0, wy + wh);
      const clear = /^#[0-9a-f]{6}$/i.test(th.card) ? th.card + '00' : 'rgba(255,255,255,0)';
      g1.addColorStop(0, th.card); g1.addColorStop(1, clear);
      g2.addColorStop(0, clear); g2.addColorStop(1, th.card);
      ctx.fillStyle = g1; ctx.fillRect(wx, wy, ww, 90); ctx.fillStyle = g2; ctx.fillRect(wx, wy + wh - 90, ww, 90);
    }
    ctx.restore();
    // 당첨 줄
    ctx.strokeStyle = '#F7A531'; ctx.lineWidth = 3;
    ctx.strokeRect(wx - 2, cy - rowH / 2, ww + 4, rowH);
    ctx.fillStyle = '#F7A531';
    ctx.beginPath(); ctx.moveTo(wx - 18, cy - 12); ctx.lineTo(wx - 4, cy); ctx.lineTo(wx - 18, cy + 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(wx + ww + 18, cy - 12); ctx.lineTo(wx + ww + 4, cy); ctx.lineTo(wx + ww + 18, cy + 12); ctx.fill();
    // 레버
    const lx = 518, top = 150, bottom = 330, ky = top + (bottom - top) * this.lever;
    rrect(ctx, 490, 250, 22, 70, 8); ctx.fillStyle = '#2A2F3C'; ctx.fill();
    ctx.strokeStyle = '#9AA2AF'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(505, 285); ctx.lineTo(lx, ky); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, ky, 20, 0, TAU); ctx.fillStyle = '#E8542F'; ctx.fill();
    ctx.beginPath(); ctx.arc(lx - 6, ky - 6, 6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
  },
  async spin(items) {
    const n = items.length, target = randInt(n);
    await animate(260, p => { this.lever = Math.sin(p * Math.PI); Stage.draw(); });
    Sound.thunk();
    const start = this.offset;
    let fin = Math.ceil(start) + n * Math.max(3, Math.ceil(36 / n));
    fin += mod(target - fin, n);
    let last = Math.round(start);
    await animate(reduceMotion ? 900 : 4300, p => {
      this.offset = start + (fin - start) * easeOutQuint(p);
      this.lights = Math.floor(p * 24);
      const c = Math.round(this.offset); if (c !== last) { last = c; Sound.tick(); }
      Stage.draw();
    });
    await animate(220, p => { this.offset = fin + 0.16 * Math.sin(p * Math.PI); Stage.draw(); });
    this.offset = mod(fin, n); Stage.draw();
    return target;
  },
};

// ───────────────────────── 게임 3: 핀볼 (공이 핀에 튕기며 떨어짐)
const Pinball = {
  size: [560, 700], order: null, pegs: [], ball: null, hit: -1, dropX: 280,
  L: 22, R: 538, binTop: 590, floor: 680, br: 9, pr: 5,
  layout() {
    if (this.pegs.length) return;
    let row = 0;
    for (let y = 150; y <= this.binTop - 36; y += 42, row++) {
      for (let x = this.L + (row % 2 ? 24 : 48); x <= this.R - 14; x += 48) this.pegs.push({ x, y, hitAt: 0 });
    }
  },
  ensureOrder(n) { if (!this.order || this.order.length !== n) { this.order = [...Array(n).keys()]; this.hit = -1; } },
  draw(ctx, items, th) {
    this.layout();
    const n = items.length, W = this.size[0];
    rrect(ctx, 6, 6, W - 12, this.size[1] - 12, 26); ctx.fillStyle = th.stage; ctx.fill();
    ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.stroke();
    // 투하기 레일
    ctx.strokeStyle = th.line; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.L + 10, 60); ctx.lineTo(this.R - 10, 60); ctx.stroke();
    rrect(ctx, this.dropX - 22, 46, 44, 28, 8); ctx.fillStyle = th.rim; ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DROP', this.dropX, 61);
    // 핀
    const now = performance.now();
    for (const p of this.pegs) {
      const glow = Math.max(0, 1 - (now - p.hitAt) / 260);
      if (glow > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, this.pr + 7 * glow, 0, TAU); ctx.fillStyle = `rgba(247,165,49,${0.45 * glow})`; ctx.fill(); }
      ctx.beginPath(); ctx.arc(p.x, p.y, this.pr, 0, TAU); ctx.fillStyle = glow > 0 ? '#F7A531' : th.peg; ctx.fill();
    }
    // 칸
    if (n === 0) {
      ctx.fillStyle = th.muted; ctx.font = `600 18px ${FONT}`; ctx.fillText('메뉴를 넣어 주세요', W / 2, (this.binTop + this.floor) / 2);
    } else {
      this.ensureOrder(n);
      const bw = (this.R - this.L) / n, bh = this.floor - this.binTop;
      for (let j = 0; j < n; j++) {
        const idx = this.order[j], x0 = this.L + j * bw, col = segColor(idx, n), won = this.hit === j;
        ctx.globalAlpha = won ? 1 : 0.22; ctx.fillStyle = col; ctx.fillRect(x0, this.binTop, bw, bh); ctx.globalAlpha = 1;
        ctx.fillStyle = won ? textOn(col) : th.ink;
        if (bw >= 64) {
          ctx.font = `750 ${bw >= 100 ? 16 : 14}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(fitText(ctx, items[idx], bw - 10), x0 + bw / 2, this.binTop + bh / 2 + 8);
        } else {
          ctx.save(); ctx.translate(x0 + bw / 2, this.floor - 8); ctx.rotate(-Math.PI / 2);
          ctx.font = `750 ${bw >= 34 ? 14 : 12}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(fitText(ctx, items[idx], bh - 22), 0, 0); ctx.restore();
        }
      }
      ctx.strokeStyle = th.peg; ctx.lineWidth = 3;
      for (let j = 0; j <= n; j++) {
        const x = this.L + j * bw; ctx.beginPath(); ctx.moveTo(x, this.binTop); ctx.lineTo(x, this.floor); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(this.L, this.floor); ctx.lineTo(this.R, this.floor); ctx.stroke();
    }
    // 공
    if (this.ball) {
      const b = this.ball;
      ctx.beginPath(); ctx.arc(b.x, b.y, this.br, 0, TAU); ctx.fillStyle = '#E8542F'; ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 3, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
    }
  },
  collide(b, px, py, rad, E) {
    const dx = b.x - px, dy = b.y - py, min = this.br + rad, d2 = dx * dx + dy * dy;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d;
    b.x += nx * (min - d); b.y += ny * (min - d);
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + E) * vn * nx; b.vy -= (1 + E) * vn * ny; }
    return vn < -30;
  },
  async spin(items) {
    const n = items.length;
    this.layout(); this.order = shuffle([...Array(n).keys()]); this.hit = -1; this.ball = null; Stage.draw();
    // 투하 위치를 무작위로 정하고 이동
    const x0 = this.dropX, tx = this.L + 14 + rand() * (this.R - this.L - 28);
    await animate(reduceMotion ? 200 : 750, p => { this.dropX = x0 + (tx - x0) * easeInOut(p); Stage.draw(); });
    const b = this.ball = { x: tx, y: 80, vx: (rand() - 0.5) * 60, vy: 0 };
    const G = 1500, H = 1 / 240, bw = (this.R - this.L) / n;
    const divs = []; for (let j = 1; j < n; j++) divs.push(this.L + j * bw);
    let still = 0, elapsed = 0, lastPeg = 0, done = false;
    const step = () => {
      elapsed += H;
      b.vy += G * H; b.x += b.vx * H; b.y += b.vy * H;
      const sp = Math.hypot(b.vx, b.vy); if (sp > 900) { b.vx *= 900 / sp; b.vy *= 900 / sp; }
      if (b.x < this.L + this.br) { b.x = this.L + this.br; b.vx = Math.abs(b.vx) * 0.55; }
      if (b.x > this.R - this.br) { b.x = this.R - this.br; b.vx = -Math.abs(b.vx) * 0.55; }
      if (b.y < this.binTop) {
        for (const p of this.pegs) {
          if (Math.abs(p.y - b.y) > 16 || Math.abs(p.x - b.x) > 16) continue;
          if (this.collide(b, p.x, p.y, this.pr, 0.5)) {
            b.vx += (rand() - 0.5) * 70; // 한쪽으로 쏠리지 않게 살짝 흔들기
            const now = performance.now(); p.hitAt = now;
            if (now - lastPeg > 55) { lastPeg = now; Sound.peg(); }
          }
        }
      }
      if (b.y + this.br > this.binTop) {
        for (const x of divs) this.collide(b, x, clamp(b.y, this.binTop, this.floor), 1.5, 0.35);
      }
      if (b.y > this.floor - this.br) { b.y = this.floor - this.br; if (b.vy > 0) b.vy = -b.vy * 0.3; b.vx *= 0.9; }
      const speed = Math.hypot(b.vx, b.vy);
      if (b.y > this.binTop && speed < 25) still += H; else still = 0;
      if (b.y < this.binTop && elapsed > 10 && speed < 15) { b.vx = (rand() - 0.5) * 300; b.vy = -120; } // 걸렸을 때
      if (still > 0.35 || elapsed > 30) done = true;
    };
    await new Promise(res => {
      let lastT = performance.now(), acc = 0;
      const frame = now => {
        acc += Math.min(0.05, (now - lastT) / 1000); lastT = now;
        while (acc >= H && !done) { step(); acc -= H; }
        Stage.draw();
        if (done) res(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    this.hit = clamp(Math.floor((b.x - this.L) / bw), 0, n - 1);
    Stage.draw();
    return this.order[this.hit];
  },
};
const GAMES = { roulette: Roulette, slot: Slot, pinball: Pinball };

// ───────────────────────── 꽃가루
function confetti() {
  if (reduceMotion) return;
  const c = $('#confetti'), ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = innerWidth, Hh = innerHeight;
  c.width = W * dpr; c.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const parts = Array.from({ length: 160 }, () => ({
    x: W / 2 + (rand() - 0.5) * 120, y: Hh * 0.4, vx: (rand() - 0.5) * 1100, vy: -250 - rand() * 750,
    r: rand() * TAU, vr: (rand() - 0.5) * 14, w: 6 + rand() * 6, h: 8 + rand() * 8, col: PALETTE[randInt(PALETTE.length)],
  }));
  const t0 = performance.now(); let last = t0;
  const f = now => {
    const dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
    ctx.clearRect(0, 0, W, Hh);
    for (const p of parts) {
      p.vy += 1300 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      ctx.save(); ctx.globalAlpha = clamp(2.6 - t, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (t < 2.6) requestAnimationFrame(f); else ctx.clearRect(0, 0, W, Hh);
  };
  requestAnimationFrame(f);
}

// ───────────────────────── 화면 상태
const app = $('#app');
const S = {
  token: 0, room: null, spins: [], rooms: [], allSpins: [],
  mode: GAMES[store('jmc.mode')] ? store('jmc.mode') : 'roulette',
  spinning: false, saveTimer: null, lastResult: null,
  lists: [], listSel: null, listTimer: null, listDirty: null,
};

function route() {
  flushSave(); flushListSave();
  S.token++;
  $('#result').hidden = true;
  const m = location.hash.match(/^#\/r\/([\w-]+)/), isLists = /^#\/lists/.test(location.hash);
  $('#navLists').classList.toggle('on', isLists);
  if (m) renderRoom(m[1]); else if (isLists) renderLists(); else renderHome();
  window.scrollTo(0, 0);
}

// ───────────────────────── 후보 목록 공통 (선택 상자 · 꺼내기)
function listOptions() {
  const custom = S.lists.map(l => `<option value="l:${l.id}">${esc(l.name)} (${l.items.length})</option>`).join('');
  const base = Object.entries(PRESETS).map(([k, p]) => `<option value="p:${k}">기본 ${p.label} (${p.items.length})</option>`).join('');
  return (custom ? `<optgroup label="저장한 목록">${custom}</optgroup>` : '') + `<optgroup label="기본 목록">${base}</optgroup>`;
}
function pickItems(v) {
  if (!v) return null;
  if (v.startsWith('p:')) { const p = PRESETS[v.slice(2)]; return p ? { name: '기본 ' + p.label, items: p.items } : null; }
  if (v.startsWith('l:')) { const l = S.lists.find(x => x.id === v.slice(2)); return l ? { name: l.name, items: l.items || [] } : null; }
  return null;
}
function setSelect(sel, html, preferred) {
  const prev = sel.value; sel.innerHTML = html;
  for (const v of [prev, preferred]) if (v && [...sel.options].some(o => o.value === v)) { sel.value = v; return; }
}
function splitNames(text) { return String(text).split(/[,\n\t]/).map(cleanName).filter(Boolean); }

// ───────────────────────── 홈: 파일 목록
async function renderHome() {
  const token = S.token;
  S.room = null; document.title = '우미 점메추';
  app.innerHTML = `
    ${REMOTE ? '' : `<div class="notice"><span>💡</span><div><b>로컬 모드</b>입니다. 지금은 이 브라우저에만 저장되어 다른 사람과 공유되지 않습니다.
      팀원과 함께 쓰려면 <code>SETUP.md</code>대로 Supabase를 연결하세요.</div></div>`}
    <section class="card hero">
      <div>
        <h1>오늘 뭐 먹지?</h1>
        <p class="sub">날짜·팀별 파일에 메뉴를 넣고 돌리면, 결과가 파일에 기록됩니다.</p>
      </div>
      <form id="newForm" class="new-form" autocomplete="off">
        <label>날짜<input type="date" name="date" required></label>
        <label>팀<input name="team" list="teamList" placeholder="예: 개발영업팀" maxlength="30" required></label>
        <label>메뉴 시작
          <select name="seed" id="seedSel"></select>
        </label>
        <button class="btn primary" type="submit">파일 만들기</button>
        <datalist id="teamList"></datalist>
      </form>
    </section>
    <div class="home-grid">
      <section class="card">
        <div class="sec-head"><h2>파일</h2><input id="filter" class="filter" placeholder="팀 이름으로 찾기" aria-label="팀 이름으로 찾기"></div>
        <div id="roomList"><div class="loading">불러오는 중…</div></div>
      </section>
      <aside class="card">
        <div class="sec-head"><h2>최근 당첨</h2></div>
        <ol id="recent" class="recent"><li class="loading">불러오는 중…</li></ol>
      </aside>
    </div>`;

  const form = $('#newForm');
  form.date.value = todayStr();
  form.team.value = store('jmc.team') || '';
  const seedHtml = () => `<option value="last">우리 팀 지난 메뉴</option>${listOptions()}<option value="empty">빈 상태로 시작</option>`;
  setSelect($('#seedSel'), seedHtml(), store('jmc.seed'));
  form.addEventListener('submit', onCreate);
  $('#filter').addEventListener('input', () => drawRoomList());

  try {
    const [rooms, spins, lists] = await Promise.all([Store.listRooms(), Store.listSpins({ limit: 1000 }), Store.listLists().catch(() => null)]);
    if (token !== S.token) return;
    S.rooms = rooms; S.allSpins = spins;
    if (lists) { S.lists = lists; setSelect($('#seedSel'), seedHtml(), store('jmc.seed')); }
    const teams = [...new Set(rooms.map(r => r.team))].sort();
    $('#teamList').innerHTML = teams.map(t => `<option value="${esc(t)}">`).join('');
    drawRoomList(); drawRecent();
  } catch (e) {
    if (token !== S.token) return;
    $('#roomList').innerHTML = `<div class="notice err"><span>⚠️</span><div><b>목록을 불러오지 못했습니다.</b><br>${esc(e.message)}</div></div>`;
    $('#recent').innerHTML = '';
  }
}

function roomStats() {
  const st = {};
  for (const s of S.allSpins) { // 최신순
    const o = st[s.room_id] || (st[s.room_id] = { n: 0, last: null });
    o.n++; if (!o.last) o.last = s;
  }
  return st;
}

function drawRoomList() {
  const box = $('#roomList'); if (!box) return;
  const q = ($('#filter').value || '').trim().toLowerCase();
  const rooms = S.rooms.filter(r => !q || r.team.toLowerCase().includes(q));
  if (!rooms.length) {
    box.innerHTML = `<div class="empty">${S.rooms.length ? '찾는 팀의 파일이 없습니다' : '아직 파일이 없습니다. 위에서 첫 파일을 만들어 보세요.'}</div>`;
    return;
  }
  const st = roomStats(), today = todayStr(), groups = new Map();
  for (const r of rooms) { if (!groups.has(r.date)) groups.set(r.date, []); groups.get(r.date).push(r); }
  box.innerHTML = [...groups].map(([date, list]) => `
    <div class="date-group">
      <h3 class="date-head">${longDate(date)}${date === today ? '<span class="today">오늘</span>' : ''}</h3>
      <div class="room-cards">${list.map(r => {
        const s = st[r.id] || { n: 0, last: null }, on = (r.menus || []).filter(m => m.on).length;
        return `<a class="room-card" href="#/r/${r.id}">
          <div class="rc-title"><span class="d">${shortDate(r.date).slice(0, 5)} /</span> ${esc(r.team)}</div>
          <div class="rc-meta">메뉴 ${on}개 · ${s.n}판</div>
          <div class="rc-last">${s.last ? `${MODES[s.last.mode]?.icon || '🎯'} ${esc(s.last.result)}` : '<span class="lbl">아직 안 돌림</span>'}</div>
        </a>`;
      }).join('')}</div>
    </div>`).join('');
}

function drawRecent() {
  const box = $('#recent'); if (!box) return;
  const byId = Object.fromEntries(S.rooms.map(r => [r.id, r]));
  const list = S.allSpins.filter(s => byId[s.room_id]).slice(0, 10);
  box.innerHTML = list.length ? list.map(s => {
    const r = byId[s.room_id];
    return `<li><a href="#/r/${r.id}"><span class="ic">${MODES[s.mode]?.icon || '🎯'}</span>
      <span class="nm">${esc(s.result)}</span>
      <span class="mt">${shortDate(r.date).slice(0, 5)} / ${esc(r.team)} · ${hhmm(s.created_at)}</span></a></li>`;
  }).join('') : '<li class="empty">아직 기록이 없습니다</li>';
}

async function onCreate(ev) {
  ev.preventDefault();
  const f = ev.target, date = f.date.value, team = cleanTeam(f.team.value), seed = f.seed.value;
  if (!date || !team) { toast('날짜와 팀을 입력해 주세요'); return; }
  store('jmc.team', team); store('jmc.seed', seed);
  const btn = f.querySelector('button'); btn.disabled = true;
  try {
    const exist = await Store.findRoom(date, team);
    if (exist) { toast('이미 있는 파일을 열었습니다'); location.hash = `#/r/${exist.id}`; return; }
    let names;
    if (seed === 'last') {
      const prev = S.rooms.filter(r => r.team === team && (r.menus || []).length).sort((a, b) => b.date.localeCompare(a.date))[0];
      names = prev ? prev.menus.map(m => m.name) : PRESETS.lunch.items;
      if (!prev) toast('이 팀의 지난 파일이 없어 기본 점심 메뉴로 시작합니다');
    } else names = seed === 'empty' ? [] : (pickItems(seed) || PRESETS.lunch).items;
    const room = await Store.createRoom({ date, team, menus: names.slice(0, MAX_MENUS).map(name => ({ name, on: true })) });
    location.hash = `#/r/${room.id}`;
  } catch (e) {
    if (e.code === 'exists') {
      const r = await Store.findRoom(date, team).catch(() => null);
      if (r) { location.hash = `#/r/${r.id}`; return; }
    }
    toast('파일을 만들지 못했습니다: ' + e.message, 4000);
  } finally { btn.disabled = false; }
}

// ───────────────────────── 파일 화면: 메뉴 + 게임 + 기록
async function renderRoom(id) {
  const token = S.token;
  app.innerHTML = '<div class="loading">불러오는 중…</div>';
  let room, spins, lists;
  try {
    [room, spins, lists] = await Promise.all([Store.getRoom(id), Store.listSpins({ roomId: id, limit: 300 }), Store.listLists().catch(() => null)]);
    if (lists) S.lists = lists;
  } catch (e) {
    if (token !== S.token) return;
    app.innerHTML = `<div class="notice err"><span>⚠️</span><div><b>파일을 불러오지 못했습니다.</b><br>${esc(e.message)}</div></div><a class="btn" href="#/">← 파일 목록</a>`;
    return;
  }
  if (token !== S.token) return;
  if (!room) {
    app.innerHTML = '<div class="empty">파일을 찾을 수 없습니다. 삭제되었거나 주소가 잘못되었습니다.<br><br><a class="btn" href="#/">← 파일 목록</a></div>';
    return;
  }
  room.menus = Array.isArray(room.menus) ? room.menus : [];
  S.room = room; S.spins = spins || [];
  document.title = `${shortDate(room.date).slice(0, 5)} / ${room.team} · 우미 점메추`;

  app.innerHTML = `
    <div class="room-head">
      <a href="#/" class="back">← 파일 목록</a>
      <h1><span class="d">${shortDate(room.date)}</span><span class="sl">/</span>${esc(room.team)}</h1>
      <div class="actions">
        <button id="copyLink" class="btn sm" type="button">링크 복사</button>
        <button id="delRoom" class="btn sm ghost danger" type="button">파일 삭제</button>
      </div>
    </div>
    <div class="room-grid" id="roomGrid">
      <section class="card stage-card">
        <div class="tabs" role="tablist" aria-label="게임 종류">
          ${Object.entries(MODES).map(([k, m]) => `<button class="tab" role="tab" type="button" data-mode="${k}" aria-selected="${k === S.mode}">${m.icon} ${m.label}</button>`).join('')}
        </div>
        <div class="stage"><canvas id="stage" role="img" aria-label="게임 화면"></canvas></div>
        <button id="spinBtn" class="btn primary spin-btn" type="button">돌리기</button>
        <p class="hint" id="stageHint"></p>
      </section>
      <section class="card menu-card">
        <div class="sec-head"><h2>메뉴 후보 <span class="muted" id="menuCount"></span></h2><span class="save-state" id="saveState"></span></div>
        <form id="addForm" class="add-form" autocomplete="off">
          <input id="addInput" placeholder="메뉴 입력 (쉼표로 여러 개)" aria-label="메뉴 추가" maxlength="400">
          <button class="btn" type="submit">추가</button>
        </form>
        <div id="chips" class="chips"></div>
        <div class="picker">
          <div class="pick-head"><label class="lbl" for="listPick">후보 불러오기</label><a class="link" href="#/lists">목록 관리 →</a></div>
          <div class="pick-row">
            <select id="listPick" aria-label="불러올 후보 목록"></select>
            <button class="btn sm" type="button" id="pickReplace" title="지금 메뉴를 지우고 이 목록으로 바꿉니다">바꾸기</button>
            <button class="btn sm" type="button" id="pickAdd" title="지금 메뉴 뒤에 이 목록을 더합니다">더하기</button>
          </div>
        </div>
        <div class="presets">
          <button class="btn sm" type="button" id="saveAsList">지금 메뉴를 목록으로 저장</button>
          <span class="sep"></span>
          <button class="btn sm ghost" type="button" id="allOn">모두 켜기</button>
          <button class="btn sm ghost danger" type="button" id="clearAll">비우기</button>
        </div>
        <p class="hint">메뉴를 누르면 이번 판에서 빠지고(줄 긋기), 다시 누르면 들어갑니다. 저장은 자동입니다.</p>
      </section>
      <section class="card hist-card">
        <div class="sec-head"><h2>기록</h2><span class="muted" id="spinCount"></span></div>
        <div id="tally" class="tally"></div>
        <ol id="history" class="history"></ol>
      </section>
    </div>`;

  Stage.mount($('#stage'));
  setMode(S.mode);
  drawChips(); drawHistory();

  $('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b && !S.spinning) setMode(b.dataset.mode); });
  $('#spinBtn').addEventListener('click', spin);
  $('#addForm').addEventListener('submit', e => { e.preventDefault(); addMenus($('#addInput').value); $('#addInput').value = ''; });
  $('#chips').addEventListener('click', e => {
    const t = e.target.closest('[data-t]'), x = e.target.closest('[data-x]');
    if (x) mutate(ms => ms.splice(+x.dataset.x, 1));
    else if (t) mutate(ms => { ms[+t.dataset.t].on = !ms[+t.dataset.t].on; });
  });
  drawPicker();
  $('#pickReplace').addEventListener('click', () => applyPick(true));
  $('#pickAdd').addEventListener('click', () => applyPick(false));
  $('#saveAsList').addEventListener('click', saveMenusAsList);
  $('#allOn').addEventListener('click', () => mutate(ms => ms.forEach(m => { m.on = true; })));
  $('#clearAll').addEventListener('click', () => { if (S.room.menus.length && confirm('메뉴 후보를 모두 지울까요?')) mutate(ms => ms.splice(0)); });
  $('#copyLink').addEventListener('click', copyLink);
  $('#delRoom').addEventListener('click', deleteRoom);
}

function activeItems() { return S.room ? S.room.menus.filter(m => m.on).map(m => m.name) : []; }

function setMode(m) {
  S.mode = m; store('jmc.mode', m);
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  Stage.items = activeItems();
  Stage.setGame(GAMES[m]);
  updateSpinBtn();
}

function updateSpinBtn() {
  const btn = $('#spinBtn'), hint = $('#stageHint'); if (!btn) return;
  const n = activeItems().length;
  let msg = MODES[S.mode].hint, ok = true;
  if (n < 2) { ok = false; msg = '메뉴를 2개 이상 켜 주세요'; }
  else if (S.mode === 'pinball' && n > PINBALL_MAX) { ok = false; msg = `핀볼은 메뉴 ${PINBALL_MAX}개까지 됩니다 (지금 ${n}개) · 몇 개를 빼거나 룰렛을 쓰세요`; }
  btn.disabled = !ok || S.spinning;
  btn.textContent = S.spinning ? '두근두근…' : `${MODES[S.mode].icon} ${MODES[S.mode].label} 돌리기`;
  hint.textContent = msg;
}

function drawChips() {
  const ms = S.room.menus, on = ms.filter(m => m.on).length;
  let ai = 0;
  $('#chips').innerHTML = ms.length ? ms.map((m, i) => {
    const color = m.on ? segColor(ai++, on) : '';
    return `<span class="chip${m.on ? '' : ' off'}"><button type="button" class="t" data-t="${i}" aria-pressed="${m.on}" title="${m.on ? '이번 판에서 빼기' : '다시 넣기'}">
      <span class="dot" style="background:${color}"></span>${esc(m.name)}</button><button type="button" class="x" data-x="${i}" aria-label="${esc(m.name)} 삭제">×</button></span>`;
  }).join('') : '<span class="muted">아직 메뉴가 없습니다. 위에 입력하거나 아래 버튼으로 추가하세요.</span>';
  $('#menuCount').textContent = ms.length ? `${on} / ${ms.length}` : '';
}

function mutate(fn) {
  if (S.spinning) return;
  fn(S.room.menus);
  drawChips();
  Pinball.order = null; Pinball.hit = -1; Pinball.ball = null;
  Stage.items = activeItems(); Stage.draw(); updateSpinBtn();
  scheduleSave();
}

function drawPicker() {
  const sel = $('#listPick'); if (!sel) return;
  setSelect(sel, listOptions(), store('jmc.pick'));
}

function applyPick(replace) {
  const v = $('#listPick').value, p = pickItems(v); if (!p) return;
  store('jmc.pick', v);
  if (!p.items.length) { toast(`'${p.name}' 목록이 비어 있습니다`); return; }
  if (!replace) { addMenus(p.items.join('\n')); return; }
  const n = S.room.menus.length;
  if (n && !confirm(`지금 메뉴 ${n}개를 지우고 '${p.name}' (${p.items.length}개)로 바꿀까요?`)) return;
  mutate(ms => { ms.splice(0); p.items.slice(0, MAX_MENUS).forEach(name => ms.push({ name, on: true })); });
  toast(`'${p.name}' 목록으로 바꿨습니다`);
}

async function saveMenusAsList() {
  const items = S.room.menus.map(m => m.name);
  if (!items.length) { toast('저장할 메뉴가 없습니다'); return; }
  const name = cleanTeam(prompt(`지금 메뉴 ${items.length}개를 목록으로 저장합니다.\n목록 이름을 정해 주세요.`, `${S.room.team} 추천`) || '');
  if (!name) return;
  const exist = S.lists.find(l => l.name === name);
  try {
    if (exist) {
      if (!confirm(`'${name}' 목록이 이미 있습니다 (${(exist.items || []).length}개).\n지금 메뉴 ${items.length}개로 덮어쓸까요?`)) return;
      await Store.updateList(exist.id, { items }); exist.items = items;
      store('jmc.pick', 'l:' + exist.id);
    } else {
      const row = await Store.createList({ name, items }); S.lists.push(row); sortLists(S.lists);
      store('jmc.pick', 'l:' + row.id);
    }
    $('#listPick').value = store('jmc.pick'); drawPicker();
    toast(`'${name}' 목록에 저장했습니다`);
  } catch (e) { toast('목록 저장 실패: ' + e.message, 4000); }
}

function addMenus(text) {
  const have = new Set(S.room.menus.map(m => m.name));
  const add = splitNames(text).filter(n => !have.has(n) && have.add(n));
  if (!add.length) { if (String(text).trim()) toast('이미 있는 메뉴입니다'); return; }
  const room = S.room.menus.length, space = MAX_MENUS - room;
  if (space <= 0) { toast(`메뉴는 ${MAX_MENUS}개까지 넣을 수 있습니다`); return; }
  if (add.length > space) toast(`메뉴는 ${MAX_MENUS}개까지라 ${space}개만 추가했습니다`);
  mutate(ms => add.slice(0, space).forEach(name => ms.push({ name, on: true })));
}

function setSaveState(s, sel = '#saveState') {
  const el = $(sel); if (!el) return;
  el.className = 'save-state' + (s === 'saved' ? ' ok' : s === 'error' ? ' err' : '');
  el.textContent = { pending: '수정됨', saving: '저장 중…', saved: '저장됨', error: '저장 실패' }[s] || '';
}
function scheduleSave() { setSaveState('pending'); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(doSave, 600); }
async function doSave() {
  S.saveTimer = null;
  const room = S.room; if (!room) return;
  const menus = room.menus.map(m => ({ name: m.name, on: !!m.on }));
  setSaveState('saving');
  try { await Store.updateMenus(room.id, menus); if (room === S.room) setSaveState('saved'); }
  catch (e) { if (room === S.room) setSaveState('error'); toast('메뉴 저장 실패: ' + e.message, 4000); }
}
function flushSave() { if (S.saveTimer) { clearTimeout(S.saveTimer); doSave(); } }

async function spin() {
  if (S.spinning || !S.room) return;
  const items = activeItems();
  if (items.length < 2 || (S.mode === 'pinball' && items.length > PINBALL_MAX)) return;
  Sound.unlock();
  const room = S.room, mode = S.mode, token = S.token;
  S.spinning = true; $('#roomGrid').classList.add('busy');
  document.querySelectorAll('.tab').forEach(b => { b.disabled = true; });
  Stage.items = items; updateSpinBtn();
  let idx;
  try { idx = await GAMES[mode].spin(items); }
  finally {
    S.spinning = false;
    if (token === S.token) {
      $('#roomGrid').classList.remove('busy');
      document.querySelectorAll('.tab').forEach(b => { b.disabled = false; });
      updateSpinBtn();
    }
  }
  const result = items[idx];
  if (token === S.token) { Sound.fanfare(); showResult(result, mode, room); }
  try {
    const row = await Store.addSpin({ room_id: room.id, mode, result, candidates: items });
    if (token === S.token) { S.spins.unshift(row); drawHistory(true); setResMeta(room, '기록에 저장됨'); }
  } catch (e) {
    if (token === S.token) setResMeta(room, '⚠️ 기록 저장 실패');
    toast('기록 저장 실패: ' + e.message, 4000);
  }
}

function showResult(result, mode, room) {
  S.lastResult = result;
  $('#resMode').textContent = `${MODES[mode].icon} ${MODES[mode].label} 결과`;
  $('#resName').textContent = result;
  setResMeta(room, '기록 저장 중…');
  $('#result').hidden = false;
  $('#resOk').focus();
  confetti();
}
function setResMeta(room, status) {
  $('#resMeta').textContent = `${shortDate(room.date).slice(0, 5)} / ${room.team} · ${status}`;
}
function closeResult() { $('#result').hidden = true; $('#spinBtn')?.focus(); }

function drawHistory(fresh) {
  const sp = S.spins, cnt = {};
  sp.forEach(s => { cnt[s.result] = (cnt[s.result] || 0) + 1; });
  const tally = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  $('#spinCount').textContent = sp.length ? `${sp.length}판` : '';
  $('#tally').innerHTML = tally.length > 1 || (tally[0] && tally[0][1] > 1)
    ? tally.slice(0, 8).map(([n, c]) => `<span>${esc(n)}<b>${c}</b></span>`).join('') : '';
  $('#history').innerHTML = sp.length ? sp.map((s, i) => `
    <li class="${fresh && i === 0 ? 'fresh' : ''}"><span class="tm">${hhmm(s.created_at)}</span>
      <span class="md">${MODES[s.mode]?.icon || ''} ${MODES[s.mode]?.label || s.mode}</span>
      <span class="rs">${esc(s.result)}</span><span class="nn">${(s.candidates || []).length}개 중</span></li>`).join('')
    : '<li class="empty">아직 돌린 기록이 없습니다</li>';
}

async function copyLink() {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('링크를 복사했습니다'); }
  catch (e) { prompt('아래 링크를 복사하세요', url); }
}

async function deleteRoom() {
  const r = S.room; if (!r || S.spinning) return;
  if (!confirm(`'${shortDate(r.date).slice(0, 5)} / ${r.team}' 파일과 기록 ${S.spins.length}건을 삭제할까요?\n되돌릴 수 없습니다.`)) return;
  clearTimeout(S.saveTimer); S.saveTimer = null;
  try { await Store.deleteRoom(r.id); toast('삭제했습니다'); location.hash = '#/'; }
  catch (e) { toast('삭제 실패: ' + e.message, 4000); }
}

// ───────────────────────── 후보 목록 화면: 만들기 · 고치기 · 지우기
async function renderLists() {
  const token = S.token;
  S.room = null; document.title = '후보 목록 · 우미 점메추';
  app.innerHTML = `
    <div class="room-head"><a href="#/" class="back">← 파일 목록</a><h1>후보 목록</h1></div>
    <p class="lead">"개발영업팀 추천 맛집"처럼 자주 쓰는 후보를 목록으로 저장해 두세요.
      파일 화면의 <b>후보 불러오기</b>와 새 파일의 <b>메뉴 시작</b>에서 바로 꺼내 쓸 수 있습니다.</p>
    <div class="lists-grid">
      <section class="card">
        <form id="newList" class="add-form" autocomplete="off">
          <input name="name" placeholder="새 목록 이름 (예: 개발영업팀 추천 맛집)" maxlength="30" aria-label="새 목록 이름">
          <button class="btn primary" type="submit">만들기</button>
        </form>
        <div id="listNav" class="list-nav"><div class="loading">불러오는 중…</div></div>
      </section>
      <section class="card" id="listEditor"></section>
    </div>`;
  $('#newList').addEventListener('submit', onCreateList);
  $('#listNav').addEventListener('click', e => {
    const b = e.target.closest('[data-id]'); if (!b || b.dataset.id === S.listSel) return;
    flushListSave(); S.listSel = b.dataset.id; drawListNav(); drawListEditor();
  });
  try {
    const lists = await Store.listLists();
    if (token !== S.token) return;
    S.lists = lists;
  } catch (e) {
    if (token !== S.token) return;
    $('#listNav').innerHTML = `<div class="notice err"><span>⚠️</span><div><b>목록을 불러오지 못했습니다.</b><br>${esc(e.message)}</div></div>`;
    $('#listEditor').hidden = true; return;
  }
  if (!S.lists.some(l => l.id === S.listSel)) S.listSel = S.lists[0] ? S.lists[0].id : null;
  drawListNav(); drawListEditor();
}

function curList() { return S.lists.find(l => l.id === S.listSel) || null; }

function drawListNav() {
  const box = $('#listNav'); if (!box) return;
  box.innerHTML = S.lists.length ? S.lists.map(l => `
    <button type="button" class="nav-item${l.id === S.listSel ? ' on' : ''}" data-id="${l.id}">
      <span class="nm">${esc(l.name)}</span><span class="ct">${(l.items || []).length}</span></button>`).join('')
    : '<div class="empty">아직 저장한 목록이 없습니다.<br>위에 이름을 넣고 만들어 보세요.</div>';
}

function drawListEditor() {
  const box = $('#listEditor'); if (!box) return;
  const l = curList();
  if (!l) { box.innerHTML = '<div class="empty">왼쪽에서 목록을 고르거나 새로 만드세요.</div>'; return; }
  box.innerHTML = `
    <div class="sec-head"><input id="lName" class="name-input" value="${esc(l.name)}" maxlength="30" aria-label="목록 이름 (눌러서 바꾸기)" title="눌러서 이름 바꾸기"><span class="save-state" id="listSave"></span></div>
    <form id="lAdd" class="add-form" autocomplete="off">
      <textarea id="lInput" rows="1" placeholder="가게·메뉴 입력 (쉼표·줄바꿈으로 여러 개, 엑셀 열 붙여넣기 가능)" aria-label="항목 추가"></textarea>
      <button class="btn" type="submit">추가</button>
    </form>
    <div id="lChips" class="chips"></div>
    <div class="presets"><span class="muted small" id="lCount"></span><span class="grow"></span>
      <button id="lDelete" class="btn sm ghost danger" type="button">목록 삭제</button></div>
    <p class="hint">Enter로 추가, Shift+Enter로 줄바꿈합니다. 고친 내용은 자동 저장됩니다.</p>`;
  l._savedName = l.name;
  drawListChips();
  const input = $('#lInput');
  $('#lAdd').addEventListener('submit', e => { e.preventDefault(); addListItems(input.value); input.value = ''; input.focus(); });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    e.preventDefault(); $('#lAdd').requestSubmit();
  });
  $('#lChips').addEventListener('click', e => {
    const x = e.target.closest('[data-x]'); if (x) mutateList(l => l.items.splice(+x.dataset.x, 1));
  });
  $('#lName').addEventListener('change', e => {
    const name = cleanTeam(e.target.value);
    if (!name) { e.target.value = curList().name; return; }
    if (S.lists.some(x => x.name === name && x.id !== S.listSel)) { toast('같은 이름의 목록이 있습니다'); e.target.value = curList().name; return; }
    mutateList(l => { l.name = name; }); sortLists(S.lists); drawListNav();
  });
  $('#lDelete').addEventListener('click', deleteList);
}

function drawListChips() {
  const l = curList(); if (!l) return;
  const items = l.items || (l.items = []);
  $('#lChips').innerHTML = items.length ? items.map((n, i) => `
    <span class="chip plain"><span class="t"><span class="dot" style="background:${segColor(i, items.length)}"></span>${esc(n)}</span><button type="button" class="x" data-x="${i}" aria-label="${esc(n)} 삭제">×</button></span>`).join('')
    : '<span class="muted">아직 항목이 없습니다. 위에 가게나 메뉴 이름을 넣어 주세요.</span>';
  $('#lCount').textContent = `${items.length}개 / 최대 ${MAX_MENUS}개`;
}

function mutateList(fn) {
  const l = curList(); if (!l) return;
  fn(l); drawListChips(); drawListNav();
  S.listDirty = l.id; setSaveState('pending', '#listSave');
  clearTimeout(S.listTimer); S.listTimer = setTimeout(doListSave, 600);
}

async function doListSave() {
  S.listTimer = null;
  const l = S.lists.find(x => x.id === S.listDirty); if (!l) return;
  S.listDirty = null;
  setSaveState('saving', '#listSave');
  try {
    await Store.updateList(l.id, { name: l.name, items: l.items.slice() });
    l._savedName = l.name;
    if (l.id === S.listSel) setSaveState('saved', '#listSave');
  } catch (e) {
    if (e.code === 'exists' && l._savedName) { l.name = l._savedName; sortLists(S.lists); drawListNav(); if (l.id === S.listSel) $('#lName').value = l.name; }
    if (l.id === S.listSel) setSaveState('error', '#listSave');
    toast('목록 저장 실패: ' + (e.code === 'exists' ? '같은 이름의 목록이 있습니다' : e.message), 4000);
  }
}
function flushListSave() { if (S.listTimer) { clearTimeout(S.listTimer); doListSave(); } }

function addListItems(text) {
  const l = curList(); if (!l) return;
  const have = new Set(l.items);
  const add = splitNames(text).filter(n => !have.has(n) && have.add(n));
  if (!add.length) { if (String(text).trim()) toast('이미 있는 항목입니다'); return; }
  const space = MAX_MENUS - l.items.length;
  if (space <= 0) { toast(`목록에는 ${MAX_MENUS}개까지 넣을 수 있습니다`); return; }
  if (add.length > space) toast(`목록은 ${MAX_MENUS}개까지라 ${space}개만 추가했습니다`);
  mutateList(x => x.items.push(...add.slice(0, space)));
}

async function onCreateList(ev) {
  ev.preventDefault();
  const f = ev.target, name = cleanTeam(f.name.value);
  if (!name) { toast('목록 이름을 입력해 주세요'); f.name.focus(); return; }
  const exist = S.lists.find(l => l.name === name);
  if (exist) { flushListSave(); S.listSel = exist.id; drawListNav(); drawListEditor(); toast('같은 이름의 목록이 있어 열었습니다'); return; }
  const btn = f.querySelector('button'); btn.disabled = true;
  try {
    flushListSave();
    const row = await Store.createList({ name, items: [] });
    row.items = row.items || [];
    S.lists.push(row); sortLists(S.lists); S.listSel = row.id; f.reset();
    drawListNav(); drawListEditor(); $('#lInput').focus();
  } catch (e) { toast('목록을 만들지 못했습니다: ' + e.message, 4000); }
  finally { btn.disabled = false; }
}

async function deleteList() {
  const l = curList(); if (!l) return;
  if (!confirm(`'${l.name}' 목록 (${l.items.length}개)을 삭제할까요?\n이미 만든 파일의 메뉴는 그대로 남습니다.`)) return;
  clearTimeout(S.listTimer); S.listTimer = null; S.listDirty = null;
  try {
    await Store.deleteList(l.id);
    S.lists = S.lists.filter(x => x.id !== l.id);
    S.listSel = S.lists[0] ? S.lists[0].id : null;
    drawListNav(); drawListEditor(); toast('삭제했습니다');
  } catch (e) { toast('삭제 실패: ' + e.message, 4000); }
}

// 다른 탭·사람이 고친 내용 반영 (창으로 돌아왔을 때)
async function refreshRoom() {
  if (!S.room || S.spinning || S.saveTimer || !$('#result').hidden) return;
  const token = S.token, id = S.room.id;
  try {
    const [room, spins, lists] = await Promise.all([Store.getRoom(id), Store.listSpins({ roomId: id, limit: 300 }), Store.listLists().catch(() => null)]);
    if (token !== S.token || S.spinning || S.saveTimer || !room) return;
    if (lists) { S.lists = lists; drawPicker(); }
    const changed = JSON.stringify(room.menus) !== JSON.stringify(S.room.menus);
    S.room = { ...room, menus: Array.isArray(room.menus) ? room.menus : [] }; S.spins = spins || [];
    if (changed) { drawChips(); Pinball.order = null; Stage.items = activeItems(); Stage.draw(); updateSpinBtn(); }
    drawHistory();
  } catch (e) { /* 조용히 무시 */ }
}

// ───────────────────────── 시작
function init() {
  Theme.read();
  const badge = $('#dbBadge');
  badge.textContent = REMOTE ? '● 공유 DB' : '● 로컬 모드';
  badge.className = 'badge ' + (REMOTE ? 'remote' : 'local');
  badge.title = REMOTE ? 'Supabase에 저장되어 링크를 가진 사람과 공유됩니다' : '이 브라우저에만 저장됩니다';

  const mute = $('#muteBtn');
  const drawMute = () => { mute.innerHTML = Sound.muted ? ICON_SOUND_OFF : ICON_SOUND_ON; mute.title = Sound.muted ? '소리 켜기' : '소리 끄기'; };
  drawMute();
  mute.addEventListener('click', () => { Sound.muted = !Sound.muted; store('jmc.muted', Sound.muted ? '1' : '0'); drawMute(); if (!Sound.muted) { Sound.unlock(); Sound.tick(); } });

  $('#resOk').addEventListener('click', closeResult);
  $('#resAgain').addEventListener('click', () => {
    const name = S.lastResult; closeResult();
    const m = S.room && S.room.menus.find(x => x.name === name && x.on);
    if (!m) return;
    mutate(() => { m.on = false; });
    if (activeItems().length >= 2) setTimeout(spin, 250);
  });
  $('#result').addEventListener('click', e => { if (e.target.id === 'result') closeResult(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#result').hidden) closeResult(); });

  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { Theme.read(); Stage.draw(); });
  document.fonts?.ready.then(() => Stage.draw());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshRoom(); });
  window.addEventListener('pagehide', () => { flushSave(); flushListSave(); });
  window.addEventListener('hashchange', route);
  route();
}
init();
})();
