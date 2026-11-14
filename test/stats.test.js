'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/engine');
const { Room } = require('../src/room');

function fakeClock() {
  let t = 1000, id = 0;
  const q = new Map();
  return {
    now: () => t,
    setTimeout: (f, ms) => { const h = ++id; q.set(h, { at: t + ms, f }); return h; },
    clearTimeout: (h) => { q.delete(h); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [h, x] of q) if (x.at <= end && (!next || x.at < next[1].at)) next = [h, x];
        if (!next) break;
        q.delete(next[0]);
        t = next[1].at;
        next[1].f();
      }
      t = end;
    }
  };
}

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Stats, judge } = require('../src/stats');

const st = (o) => Object.assign({ phase: 'defend', trump: 'S', stock: 10, defender: 1 }, o);

test('tahlil: arzonroq karta bilan urish mumkin edi — xato', () => {
  const s = st({ table: [{ a: '7H', d: null }], hands: [[], ['8H', 'AS', '6C']] });
  assert.equal(judge(s, 1, { type: 'beat', cards: ['AS'], on: 0 }), false, 'koʻzir isrof');
  assert.equal(judge(s, 1, { type: 'beat', cards: ['8H'], on: 0 }), true);
});
test('tahlil: koʻzirsiz ura olardi, lekin oldi — xato; koʻzir kerak boʻlsa — baholanmaydi', () => {
  const s = st({ table: [{ a: '7H', d: null }], hands: [[], ['8H', 'AS']] });
  assert.equal(judge(s, 1, { type: 'take' }), false);
  const s2 = st({ table: [{ a: 'AH', d: null }], hands: [[], ['6S', '7C']] });
  assert.equal(judge(s2, 1, { type: 'take' }), null);
});
test('tahlil: koloda bor paytda koʻzir bilan yurish — xato; vaqt tugasa — xato', () => {
  const s = st({ phase: 'attack', table: [], hands: [['6S', '7H']] });
  assert.equal(judge(s, 0, { type: 'attack', cards: ['6S'] }), false);
  assert.equal(judge(s, 0, { type: 'attack', cards: ['7H'] }), true);
  assert.equal(judge(Object.assign({}, s, { stock: 0 }), 0, { type: 'attack', cards: ['6S'] }), true, 'oxirida koʻzir ham boʻladi');
  assert.equal(judge(s, 0, { type: 'attack', cards: ['7H'] }, true), false);
  const t = st({ phase: 'throw', table: [{ a: '7H', d: '8H' }], hands: [['7S', '8C', 'AH']] });
  assert.equal(judge(t, 0, { type: 'attack', cards: ['8C'] }), true);
  assert.equal(judge(t, 0, { type: 'attack', cards: ['7S'] }), false);
});

test('statistika: oʻyinda yigʻiladi, botlar hisoblanmaydi, faylga saqlanadi', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'durak-')), 'stats.json');
  const stats = new Stats({ file });
  const c = fakeClock();
  const r = new Room({ id: 'x', stats, now: c.now, setTimeout: c.setTimeout, clearTimeout: c.clearTimeout, turnSeconds: 1, botDelay: [10, 20], collectMs: 20, autoStartMs: 50 });
  r.connect({ id: 'a', name: 'Ali' });
  r.fillBots('a');
  r.disconnect('a');
  let rounds = 0;
  for (let k = 0; k < 5000 && rounds < 3; k++) {
    c.advance(500);
    if (r.phase === 'roundEnd') { rounds++; r.connect({ id: 'a', name: 'Ali' }); r.dispatch('a', { t: 'next' }); r.disconnect('a'); }
  }
  const me = stats.me('a');
  assert.ok(me && me.rounds === 3, JSON.stringify(me));
  assert.ok(me.moves > 0);
  assert.equal(stats.list().length, 1); // botlar yoʻq
  assert.ok(me.eff >= 0 && me.eff <= 100);
  stats.flush();
  const again = new Stats({ file });
  assert.equal(again.me('a').rounds, 3);
  assert.equal(again.list()[0].ranked, true);
});

test('Yandex Disk: avval oʻqiydi, keyin yozadi; 404 — yangi fayl', async () => {
  const { YaDisk } = require('../src/yadisk');
  let stored = null; const calls = [];
  const fakeFetch = async (url, init) => {
    init = init || {};
    calls.push((init.method || 'GET') + ' ' + url.split('?')[0]);
    const json = (o, st) => ({ ok: (st || 200) < 400, status: st || 200, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.includes('/resources/download')) return stored == null ? json({}, 404) : json({ href: 'https://dl/x' });
    if (url.includes('/resources/upload')) { assert.equal(init.headers.Authorization, 'OAuth T'); return json({ href: 'https://up/x' }); }
    if (url === 'https://dl/x') return { ok: true, status: 200, text: async () => stored };
    if (url === 'https://up/x') { stored = init.body; return { ok: true, status: 201 }; }
    throw new Error('kutilmagan ' + url);
  };
  const s1 = new Stats({ remote: new YaDisk({ token: 'T', fetch: fakeFetch }), remoteMs: 10 });
  await s1.loadRemote();
  s1.round({ id: 'a', name: 'Ali' }, { durak: false, place: 1, n: 4 });
  await s1.flushRemote();
  assert.ok(stored && JSON.parse(stored).users[0].id === 'a');
  const s2 = new Stats({ remote: new YaDisk({ token: 'T', fetch: fakeFetch }) });
  await s2.loadRemote();
  assert.equal(s2.me('a').rounds, 1);
  // oʻqilmaguncha yozmaydi: pushRemote avval loadRemote qiladi
  const s3 = new Stats({ remote: new YaDisk({ token: 'T', fetch: fakeFetch }) });
  s3.round({ id: 'b', name: 'Vali' }, { durak: true, place: 0, n: 4 });
  await s3.flushRemote();
  const users = JSON.parse(stored).users.map((u) => u.id).sort();
  assert.deepEqual(users, ['a', 'b']);
  clearTimeout(s1.rtimer); clearTimeout(s3.rtimer);
});

test('samaradorlik: durak boʻlmaslik va birinchi chiqish hisoblanadi', () => {
  const stats = new Stats({});
  const a = { id: 'a', name: 'A' }, b = { id: 'b', name: 'B' };
  for (let k = 0; k < 3; k++) { stats.round(a, { place: 1, n: 4 }); stats.round(b, { durak: true, place: 0, n: 4 }); }
  stats.move(a, true); stats.move(b, true);
  assert.equal(stats.me('a').eff, 100);
  assert.equal(stats.me('b').eff, 50);
  assert.equal(stats.me('b').dur, 100);
  assert.equal(stats.me('a').first, 100);
  assert.deepEqual(stats.list().map((u) => u.id), ['a', 'b']);
});
