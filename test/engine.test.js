'use strict';
const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine');

// Belgilangan koloda: avval tarqatiladigan kartalar (aylana boʻyicha), keyin koloda (oxirgisi birinchi olinadi), [0] — koʻzir
function deckFor(n, hands, stockTopFirst, trumpCard) {
  const d = [];
  for (let r = 0; r < 6; r++) for (let i = 0; i < n; i++) d.push(hands[i][r]);
  const used = new Set(d.concat(stockTopFirst, [trumpCard]));
  const rest = E.makeDeck().filter((c) => !used.has(c));
  // koloda: [koʻzir, ...qolganlar, ...stockTopFirst teskari]
  return d.concat([trumpCard], rest, stockTopFirst.slice().reverse());
}

test('karta urish: mast va koʻzir', () => {
  assert.ok(E.beats('6H', '7H', 'S'));
  assert.ok(!E.beats('7H', '6H', 'S'));
  assert.ok(E.beats('AH', '6S', 'S'));
  assert.ok(!E.beats('6S', 'AH', 'S'));
  assert.ok(E.beats('7S', '8S', 'S'));
  assert.ok(!E.beats('7H', '8D', 'S'));
});

test('eng kichik koʻzir birinchi yuradi', () => {
  const hands = [
    ['AH', 'KH', 'QH', 'JH', '10H', '9H'],
    ['6S', 'AC', 'KC', 'QC', 'JC', '10C'],
    ['7S', 'AD', 'KD', 'QD', 'JD', '10D']
  ];
  const st = E.newRound({ n: 3, deck: deckFor(3, hands, [], '8S') });
  assert.strictEqual(st.trump, 'S');
  assert.strictEqual(st.attacker, 1);
  assert.strictEqual(st.defender, 2);
  assert.strictEqual(st.phase, 'attack');
  assert.strictEqual(st.hands[0].length, 6);
  assert.strictEqual(st.stock.length, 36 - 18);
});

test('hujum, urish, tashlash va bito', () => {
  const hands = [
    ['6H', '6C', 'AC', 'KC', 'QC', 'JC'],
    ['7H', '7C', 'AD', 'KD', 'QD', 'JD'],
    ['8H', '9S', '10C', '6D', '7D', '8D']
  ];
  const st = E.newRound({ n: 3, deck: deckFor(3, hands, [], 'AS') });
  E.takeEvents(st);
  // 9S — eng kichik koʻzir: 2-oʻrin yuradi, 0-oʻrin himoyalanadi
  assert.strictEqual(st.attacker, 2);
  assert.strictEqual(st.defender, 0);
  let r = E.act(st, 0, { type: 'attack', cards: ['6H'] });
  assert.ok(!r.ok);
  r = E.act(st, 2, { type: 'attack', cards: ['8H'] });
  assert.ok(r.ok, r.error);
  assert.strictEqual(st.phase, 'defend');
  assert.strictEqual(st.turn, 0);
  r = E.act(st, 0, { type: 'beat', cards: ['6H'], on: 0 });
  assert.ok(!r.ok, 'kichik karta urmaydi');
  r = E.act(st, 0, { type: 'beat', cards: ['JC'], on: 0 });
  assert.ok(!r.ok, 'boshqa mast urmaydi');
  // 1-oʻrin ham tashlay oladi (podkidnoy): stolda 8 bor — 8 yoʻq, tashlay olmaydi
  r = E.act(st, 1, { type: 'attack', cards: ['7H'] });
  assert.ok(!r.ok);
  // himoyachida 8H dan katta chervi yoʻq — oladi
  r = E.act(st, 0, { type: 'take' });
  assert.ok(r.ok);
  assert.strictEqual(st.phase, 'throw');
  // 2-oʻrin 8D ni tashlaydi
  assert.strictEqual(st.turn, 2);
  r = E.act(st, 2, { type: 'attack', cards: ['8D'] });
  assert.ok(r.ok, r.error);
  // boshqa 8 lik yoʻq — hech kim tashlay olmaydi, yurish oʻzi tugaydi
  assert.strictEqual(st.phase, 'boutEnd');
  const evs = E.collect(st);
  assert.ok(evs.some((e) => e.kind === 'refill'));
  assert.strictEqual(st.hands[0].length, 8, 'olgan himoyachida 8 ta karta');
  // olgan oʻyinchi navbatini oʻtkazib yuboradi: endi 1-oʻrin hujum qiladi, 2-oʻrin himoyalanadi
  assert.strictEqual(st.attacker, 1);
  assert.strictEqual(st.defender, 2);
});

test('bito: himoyachi keyingi yurishni qiladi', () => {
  const hands = [
    ['6H', '6C', 'AC', 'KC', 'QC', 'JC'],
    ['7H', '7C', 'AD', 'KD', 'QD', 'JD']
  ];
  const st = E.newRound({ n: 2, deck: deckFor(2, hands, [], 'AS'), first: 0 });
  E.takeEvents(st);
  assert.strictEqual(st.attacker, 0);
  let r = E.act(st, 0, { type: 'attack', cards: ['6H'] });
  assert.ok(r.ok);
  r = E.act(st, 1, { type: 'beat', cards: ['7H'] });
  assert.ok(r.ok, r.error);
  assert.strictEqual(st.phase, 'throw');
  r = E.act(st, 0, { type: 'attack', cards: ['6C'] });
  assert.ok(r.ok, r.error);
  r = E.act(st, 1, { type: 'beat', cards: ['7C'], on: 1 });
  assert.ok(r.ok, r.error);
  // 0-oʻrinda 6/7 yoʻq — avtomatik bito
  assert.strictEqual(st.phase, 'boutEnd');
  E.collect(st);
  assert.strictEqual(st.attacker, 1);
  assert.strictEqual(st.discarded, 4);
});

test('tashlash chegarasi: himoyachi kartalaridan koʻp emas', () => {
  const hands = [
    ['6H', '6C', '6D', 'KC', 'QC', 'JC'],
    ['7H', '8C', 'AD', 'KD', 'QD', 'JD']
  ];
  const st = E.newRound({ n: 2, deck: deckFor(2, hands, [], 'AS'), first: 0 });
  E.takeEvents(st);
  assert.ok(E.act(st, 0, { type: 'attack', cards: ['6H', '6C', '6D'] }).ok);
  assert.strictEqual(st.table.length, 3);
  assert.ok(!E.act(st, 0, { type: 'attack', cards: ['6S'] }).ok);
});

test('kompyuter oʻyinchilari oʻyinni oxiriga yetkazadi', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let g = 0; g < 300; g++) {
    const n = 2 + (g % 5);
    const st = E.newRound({ n: n, rng: rng });
    let steps = 0;
    while (st.phase !== 'roundEnd') {
      assert.ok(++steps < 10000);
      if (st.phase === 'boutEnd') { E.collect(st); continue; }
      const a = E.AI.choose(st, st.turn);
      const r = E.act(st, st.turn, a);
      assert.ok(r.ok, r.error);
      const total = st.hands.reduce((x, h) => x + h.length, 0) + st.stock.length + st.discarded + st.table.reduce((x, t) => x + (t.d ? 2 : 1), 0);
      assert.strictEqual(total, 36);
    }
    assert.ok(st.result.type === 'durak' || st.result.type === 'draw');
    if (st.result.type === 'durak') assert.strictEqual(st.places.length, n - 1);
  }
});

test('koʻrinish: boshqalarning kartalari yashirin', () => {
  const st = E.newRound({ n: 3 });
  const v = E.viewFor(st, 1);
  assert.deepStrictEqual(v.hand, st.hands[1]);
  assert.ok(!('hands' in v));
  assert.strictEqual(v.counts.length, 3);
  const sp = E.viewFor(st, -1);
  assert.strictEqual(sp.hand, null);
});

test('vaqt tugasa: himoyachi oladi, hujumchi eng arzon kartani tashlaydi', () => {
  const st = E.newRound({ n: 2 });
  const a = E.autoMove(st, st.attacker);
  assert.strictEqual(a.type, 'attack');
  assert.ok(E.act(st, st.attacker, a).ok);
  assert.deepStrictEqual(E.autoMove(st, st.defender), { type: 'take' });
});

test('keyingi oʻyin durakning tagidan', () => {
  const st = E.newRound({ n: 4, durak: 2 });
  assert.strictEqual(st.attacker, 1);
  assert.strictEqual(st.defender, 2);
});
