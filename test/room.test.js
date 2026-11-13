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

function makeRoom(clock) {
  return new Room({
    id: 't1', now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    turnSeconds: 30, botDelay: [100, 200], collectMs: 500, autoStartMs: 1000
  });
}

const users = [1, 2, 3, 4, 5].map((i) => ({ id: 'u' + i, name: 'Oʻyinchi ' + i }));

test('4 kishi kirsa oʻyin oʻzi boshlanadi, beshinchisi tomoshabin', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  for (let i = 0; i < 4; i++) r.connect(users[i]);
  assert.equal(r.filled(), 4);
  assert.equal(r.hostId, 'u1');
  r.connect(users[4]);
  assert.equal(r.spectators.size, 1);
  c.advance(1000);
  assert.ok(r.phase === 'playing' || r.phase === 'roundEnd');
  assert.equal(r.round, 1);
  assert.equal(r.snapshot('u1').game.hand.length, 6);
  assert.equal(r.snapshot('u5').game.hand, null);
});

test('stol hajmi: 2 dan 6 kishigacha', () => {
  assert.equal(new Room({ size: 2 }).seats.length, 2);
  assert.equal(new Room({ size: 6 }).seats.length, 6);
  assert.equal(new Room({ size: 9 }).seats.length, 6);
  assert.equal(new Room({ size: 1 }).seats.length, 2);
  assert.equal(new Room({}).seats.length, 4);
});

test('4 kishi boʻlmasa boshlab boʻlmaydi; boʻsh oʻrinlarni bot bilan toʻldirish', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  r.connect(users[0]);
  r.connect(users[1]);
  assert.match(r.start('u1'), /4 kishi/);
  r.connect(users[2]); r.leave('u3'); // u3 — kuzatuvchi
  assert.match(r.fillBots('u3'), /stolda oʻtirgan/);
  assert.equal(r.fillBots('u2'), null); // stolda oʻtirgan har kim bot qoʻsha oladi
  assert.equal(r.filled(), 4);
  c.advance(1000);
  assert.notEqual(r.phase, 'lobby');
});

test('lobbida boshqa oʻringa oʻtish', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  r.connect(users[0]); // 0-oʻrin
  r.connect(users[1]); // 1-oʻrin
  assert.equal(r.sit('u2', 2), null);
  assert.equal(r.seatOf('u2'), 2);
  assert.equal(r.seats[1], null);
  assert.equal(r.sit('u2', 0), 'Bu oʻrin band');
});

test('vaqtida yurmasa avtomatik yuriladi; oʻyin oxiriga yetadi; durak hisobi; keyingi oʻyin durakning tagidan', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  for (let i = 0; i < 4; i++) r.connect(users[i]);
  c.advance(1000);
  let guard = 0;
  while (r.phase === 'playing' && guard++ < 3000) c.advance(30000);
  assert.equal(r.phase, 'roundEnd');
  const res = r.lastResult;
  if (res.type === 'durak') {
    assert.equal(r.score[res.seat], 1);
    assert.equal(r.score.reduce((a, b) => a + b, 0), 1);
    assert.equal(r.nextRound('u2'), null);
    assert.equal(r.game.defender, res.seat, 'durak himoyalanadi');
  }
});

test('stol egasi + 3 bot: bir necha oʻyin, kartalar yoʻqolmaydi', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  r.connect(users[0]);
  r.fillBots('u1');
  c.advance(1000);
  let duraks = 0;
  for (let round = 0; round < 6; round++) {
    let guard = 0;
    while (r.phase === 'playing' && guard++ < 5000) {
      const g = r.game;
      if (g.turn === 0) {
        assert.equal(r.dispatch('u1', { t: 'act', action: E.AI.choose(g, 0) }), null);
      } else c.advance(300);
      const total = g.hands.reduce((x, h) => x + h.length, 0) + g.stock.length + g.discarded + g.table.reduce((x, t) => x + (t.d ? 2 : 1), 0);
      assert.equal(total, 36);
    }
    assert.equal(r.phase, 'roundEnd');
    if (r.lastResult.type === 'durak') duraks++;
    assert.equal(r.score.reduce((a, b) => a + b, 0), duraks);
    r.nextRound('u1');
  }
});

test('yashirin kartalar boshqalarga koʻrinmaydi; notoʻgʻri harakat xato qaytaradi', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  for (let i = 0; i < 4; i++) r.connect(users[i]);
  c.advance(1000);
  const g = r.game;
  assert.equal(g.phase, 'attack');
  const notAtt = g.defender;
  assert.match(r.dispatch(users[notAtt].id, { t: 'act', action: { type: 'attack', cards: [g.hands[notAtt][0]] } }), /himoya/);
  assert.match(r.dispatch(users[g.attacker].id, { t: 'act', action: { type: 'attack', cards: ['XX'] } }), /yoʻq/);
  for (let i = 0; i < 4; i++) {
    const json = JSON.stringify(r.snapshot(users[i].id));
    for (let j = 0; j < 4; j++) {
      if (j === i) continue;
      for (const card of g.hands[j]) {
        if (card !== g.trumpCard && card !== g.lowest) assert.ok(!json.includes('"' + card + '"'), `${i} ${j} ning kartasini koʻrmoqda`);
      }
    }
  }
});

test('oʻyin vaqtida ilova yopilsa — oʻrni saqlanadi, vaqti tugaganda avtomatik yuriladi; qaytsa davom etadi', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  for (let i = 0; i < 4; i++) r.connect(users[i]);
  c.advance(1000);
  r.disconnect('u1');
  assert.equal(r.seatOf('u1'), 0);
  r.connect(users[0]);
  assert.equal(r.seats[0].auto, false);
  assert.equal(r.paused(), false);
});

test('lobbida oflayn qolgan oʻyinchi 30 soniyadan keyin chiqariladi', () => {
  const c = fakeClock();
  const r = makeRoom(c);
  r.connect(users[0]);
  r.connect(users[1]);
  r.disconnect('u2');
  c.advance(10000);
  assert.equal(r.sweep(), false);
  c.advance(25000);
  assert.equal(r.sweep(), true);
  assert.equal(r.filled(), 1);
});
