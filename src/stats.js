'use strict';
// Oʻyinchilar samaradorligi (Durak): har bir yurish tahlil qilinadi (toʻgʻri / xato),
// oʻyin natijalari (durak boʻldimi, nechanchi boʻlib chiqdi) yigʻiladi. Faqat odamlar hisoblanadi (botlar emas).
//
// Samaradorlik (0–100%) = 50% toʻgʻri yurishlar ulushi
//                       + 25% durak boʻlmagan oʻyinlar ulushi
//                       + 25% chiqish oʻrni (birinchi chiqqan — 100%, durak — 0%)

const fs = require('fs');
const path = require('path');
const E = require('./engine');

const MIN_ROUNDS = 3; // reytingda koʻrinish uchun

function isTrump(c, tr) { return E.suitOf(c) === tr; }

// Yurish oldidan holatni tahlil qilish. Natija: true — toʻgʻri, false — xato, null — baholanmaydi
// st — yurishdan oldingi holat nusxasi: { phase, trump, stock, table, hands, defender }
function judge(st, seat, a, auto) {
  if (auto) return false; // vaqt tugadi — kompyuter yurdi
  if (!a || !st) return null;
  const tr = st.trump, hand = (st.hands && st.hands[seat]) || [];
  const cards = a.cards || [];
  const stockLeft = st.stock > 0;
  if (a.type === 'attack') {
    if (!cards.length) return null;
    if (st.phase === 'attack') {
      // koloda hali bor: oddiy karta boʻla turib koʻzir bilan yurish — isrof
      if (stockLeft && cards.some(function (c) { return isTrump(c, tr); }) && hand.some(function (c) { return !isTrump(c, tr); })) return false;
      return true;
    }
    // tashlash: koloda bor paytda koʻzir yoki katta karta (tuz, korol) tashlash — isrof
    if (stockLeft && cards.some(function (c) { return isTrump(c, tr) || E.strength(c) >= 7; })) return false;
    return true;
  }
  if (a.type === 'beat') {
    if (cards.length !== 1 || !st.table) return null;
    const slot = st.table[Number.isInteger(a.on) ? a.on : -1] || st.table.find(function (x) { return !x.d && E.beats(x.a, cards[0], tr); });
    if (!slot) return null;
    const used = cards[0];
    const opts = hand.filter(function (c) { return c !== used && E.beats(slot.a, c, tr); });
    // arzonroq karta bilan urish mumkin edi (masalan, koʻzir oʻrniga oʻsha mast)
    if (opts.some(function (c) { return E.cost(c, tr) < E.cost(used, tr); })) return false;
    return true;
  }
  if (a.type === 'take') {
    if (!st.table) return null;
    // hamma urilmagan kartani koʻzirsiz urish mumkin edi — olish xato
    const open = st.table.filter(function (x) { return !x.d; }).map(function (x) { return x.a; });
    if (!open.length) return null;
    const left = hand.filter(function (c) { return !isTrump(c, tr); });
    for (const a0 of open) {
      const k = left.findIndex(function (c) { return E.beats(a0, c, tr); });
      if (k < 0) return null; // koʻzir kerak edi — olish oʻrinli boʻlishi mumkin
      left.splice(k, 1);
    }
    return false;
  }
  return null; // pas / bito — baholanmaydi
}

function Stats(opts) {
  opts = opts || {};
  this.file = opts.file || null;
  this.now = opts.now || Date.now;
  this.users = new Map();
  this.timer = null;
  this.remote = opts.remote || null;   // Yandex Disk (read/write)
  this.remoteMs = opts.remoteMs || 30000;
  this.remoteOk = !this.remote;        // masofadagi fayl oʻqilmaguncha unga yozmaymiz (ustidan yozib yubormaslik uchun)
  this.rtimer = null;
  this.dirty = false;
  this.load();
}
const P = Stats.prototype;

P.load = function () {
  if (!this.file) return;
  let data;
  try { data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (_) { return; }
  if (data && Array.isArray(data.users)) {
    for (const u of data.users) if (u && u.id) this.users.set(String(u.id), u);
  }
};

P.serialize = function () {
  return JSON.stringify({ v: 1, users: Array.from(this.users.values()) });
};

// Masofadagi fayldan yuklash: koʻproq oʻynalgan yozuv ustun
P.loadRemote = async function () {
  if (!this.remote) return;
  const text = await this.remote.read();
  if (text) {
    const data = JSON.parse(text);
    for (const u of (data && data.users) || []) {
      if (!u || !u.id) continue;
      const id = String(u.id), cur = this.users.get(id);
      if (!cur || (u.rounds + u.moves) >= (cur.rounds + cur.moves)) this.users.set(id, u);
    }
  }
  this.remoteOk = true;
};

P.pushRemote = async function () {
  if (!this.remote) return;
  if (!this.remoteOk) await this.loadRemote();
  this.dirty = false;
  await this.remote.write(this.serialize());
};

P.scheduleRemote = function () {
  if (!this.remote || this.rtimer) return;
  const self = this;
  this.rtimer = setTimeout(function () {
    self.rtimer = null;
    self.pushRemote().catch(function (e) { self.dirty = true; console.error('[stats]', e.message); self.scheduleRemote(); });
  }, this.remoteMs);
  if (this.rtimer.unref) this.rtimer.unref();
};

// Toʻxtashdan oldin: kutilayotgan oʻzgarishlarni darhol yozish
P.flushRemote = async function () {
  if (!this.remote || !this.dirty) return;
  if (this.rtimer) { clearTimeout(this.rtimer); this.rtimer = null; }
  await this.pushRemote();
};

P.save = function () {
  this.dirty = true;
  this.scheduleRemote();
  if (!this.file || this.timer) return;
  const self = this;
  this.timer = setTimeout(function () {
    self.timer = null;
    self.flush();
  }, 3000);
  if (this.timer.unref) this.timer.unref();
};

P.flush = function () {
  if (!this.file) return;
  try {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, this.serialize());
    fs.renameSync(tmp, this.file);
  } catch (e) { console.error('[stats] saqlab boʻlmadi:', e.message); }
};

P.user = function (who) {
  const id = String(who.id);
  let u = this.users.get(id);
  if (!u) {
    u = { id: id, name: '', photo: '', rounds: 0, durak: 0, draws: 0, first: 0, place: 0, good: 0, moves: 0, auto: 0, at: 0 };
    this.users.set(id, u);
  }
  if (who.name) u.name = String(who.name).slice(0, 64);
  if (who.photo) u.photo = String(who.photo).slice(0, 512);
  u.at = this.now();
  return u;
};

// Bitta yurish
P.move = function (who, verdict, auto) {
  if (!who || who.bot || verdict == null) return;
  const u = this.user(who);
  u.moves++;
  if (verdict) u.good++;
  if (auto) u.auto++;
  this.save();
};

// Oʻyin tugadi: o.durak — shu oʻyinchi durak boʻldi; o.draw — durang; o.place — nechanchi boʻlib chiqdi (1 dan); o.n — oʻyinchilar soni
P.round = function (who, o) {
  if (!who || who.bot) return;
  const u = this.user(who);
  u.rounds++;
  if (o.draw) u.draws++;
  if (o.durak) u.durak++;
  if (o.place === 1) u.first++;
  // chiqish oʻrni ulushi: 1-chiqqan — 1, durak — 0, durang — 0.5
  const n = o.n || 4;
  let q;
  if (o.durak) q = 0;
  else if (o.draw && !o.place) q = 0.5;
  else q = n > 1 ? 1 - ((o.place || n) - 1) / (n - 1) : 1;
  u.place = (u.place || 0) + Math.max(0, Math.min(1, q));
  this.save();
};

function effOf(u) {
  const q = u.moves ? u.good / u.moves : 0;
  const safe = u.rounds ? 1 - (u.durak || 0) / u.rounds : 0;
  const pl = u.rounds ? (u.place || 0) / u.rounds : 0;
  return Math.round((q * 0.5 + safe * 0.25 + pl * 0.25) * 100);
}

P.view = function (u) {
  return {
    id: u.id,
    name: u.name || 'Oʻyinchi',
    photo: u.photo || '',
    rounds: u.rounds,
    eff: effOf(u),
    acc: u.moves ? Math.round((u.good / u.moves) * 100) : 0,
    dur: u.rounds ? Math.round(((u.durak || 0) / u.rounds) * 100) : 0,
    first: u.rounds ? Math.round(((u.first || 0) / u.rounds) * 100) : 0,
    durak: u.durak || 0,
    moves: u.moves,
    ranked: u.rounds >= MIN_ROUNDS
  };
};

// Reyting: yetarli raund oʻynaganlar samaradorlik boʻyicha, keyin qolganlar
P.list = function (limit) {
  const all = Array.from(this.users.values()).filter(function (u) { return u.rounds > 0 || u.moves > 0; }).map(this.view, this);
  all.sort(function (a, b) {
    if (a.ranked !== b.ranked) return a.ranked ? -1 : 1;
    return b.eff - a.eff || b.rounds - a.rounds;
  });
  return all.slice(0, limit || 100);
};

P.me = function (id) {
  const u = this.users.get(String(id));
  return u ? this.view(u) : null;
};

module.exports = { Stats: Stats, judge: judge, effOf: effOf, MIN_ROUNDS: MIN_ROUNDS };

// Xona uchun: yurishni tahlil qilib yozish
Stats.prototype.check = function (st, seat, a, auto, who) {
  if (!who || who.bot) return;
  this.move(who, judge(st, seat, a, auto), auto);
};
