/*
 * Durak — oʻyin dvigateli ("podkidnoy", 36 karta, 2–6 oʻyinchi).
 * Bir xil kod serverda (Node.js) va brauzerda (demo rejimi) ishlaydi.
 *
 * Qoidalar:
 *  - 36 ta karta. Kuch: 6 < 7 < 8 < 9 < 10 < V < D < K < T. Ochko yoʻq.
 *  - Har kimga 6 tadan karta. Keyingi karta ochiladi — u koʻzir, koloda tagida yotadi va eng oxirida olinadi.
 *  - Birinchi oʻyinda eng kichik koʻziri bor oʻyinchi yuradi. Keyingi oʻyinlarda — "durakning tagidan":
 *    durakdan oldingi oʻyinchi durakka yuradi.
 *  - Hujumchi chap tomondagi (keyingi) oʻyinchiga yuradi: 1 ta karta yoki bir xil qiymatdagi bir nechta karta.
 *  - Himoyachi har bir kartani urishi kerak: oʻsha mastning kattarogʻi yoki koʻzir bilan (koʻzirni faqat kattaroq koʻzir uradi).
 *  - Himoyachidan boshqa hamma stoldagi kartalar (hujum va himoya) bilan bir xil qiymatdagi karta tashlay oladi ("podkidnoy").
 *    Bir yurishda 6 tadan (va himoyachida yurish boshida boʻlgan kartalardan) koʻp tashlab boʻlmaydi;
 *    urilmagan kartalar himoyachi qoʻlidagi kartalardan koʻp boʻlmaydi.
 *  - Himoyachi ura olmasa yoki xohlamasa — "Olaman": qolganlar yana tashlashi mumkin, keyin u stoldagi hamma kartalarni oladi
 *    va navbatini oʻtkazib yuboradi.
 *  - Hamma karta urilgach va hech kim tashlamasa — "Bito": kartalar chiqib ketadi, himoyachi keyingi yurishni qiladi.
 *  - Yurishdan keyin hamma 6 tagacha karta oladi: avval asosiy hujumchi, keyin boshqalar, himoyachi eng oxirida.
 *  - Koloda tugagach kartasi qolmagan oʻyinchi oʻyindan chiqadi. Oxirida kartasi qolgan oʻyinchi — durak.
 *    Hamma bir vaqtda chiqsa — durang.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DurakEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['S', 'H', 'D', 'C'];
  const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // kuchsizdan kuchliga
  const HAND = 6;     // qoʻldagi kartalar
  const MAX_ATTACK = 6; // bir yurishda eng koʻpi bilan
  const MIN_N = 2, MAX_N = 6;
  const MAX_BOUTS = 150; // bitta oʻyinda yurishlar chegarasi
  const RANK_INDEX = {};
  RANKS.forEach(function (r, i) { RANK_INDEX[r] = i; });
  const DECK = makeDeck();
  const DECK_SET = new Set(DECK);

  // ---------- kartalar ----------
  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    return d;
  }
  function rankOf(c) { return c.slice(0, -1); }
  function suitOf(c) { return c.slice(-1); }
  function strength(c) { return RANK_INDEX[rankOf(c)]; }
  function isCard(c) { return typeof c === 'string' && DECK_SET.has(c); }

  function shuffle(arr, rng) {
    rng = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // d karta a kartani uradimi?
  function beats(a, d, trump) {
    const sa = suitOf(a), sd = suitOf(d);
    if (sa === sd) return strength(d) > strength(a);
    return sd === trump;
  }

  function clampN(n) { n = Number(n) || 4; return Math.max(MIN_N, Math.min(MAX_N, Math.floor(n))); }
  function hasCards(hand, cards) {
    if (!Array.isArray(cards) || !cards.length) return false;
    if (new Set(cards).size !== cards.length) return false;
    return cards.every(function (c) { return isCard(c) && hand.indexOf(c) >= 0; });
  }
  function removeCards(hand, cards) {
    for (const c of cards) { const i = hand.indexOf(c); if (i >= 0) hand.splice(i, 1); }
  }

  // Qoʻldagi kartalar tartibi (chapdan oʻngga): mastlar, koʻzir oxirida, har mast ichida kichigidan kattasiga
  const SUIT_ORDER = { S: 0, H: 1, C: 2, D: 3 };
  function sortHand(hand, trump) {
    return hand.slice().sort(function (a, b) {
      const sa = suitOf(a), sb = suitOf(b);
      const ka = sa === trump ? 10 : SUIT_ORDER[sa], kb = sb === trump ? 10 : SUIT_ORDER[sb];
      return ka - kb || strength(a) - strength(b);
    });
  }
  // Karta "qiymati" — AI uchun: koʻzirlar qimmat
  function cost(c, trump) { return strength(c) + (suitOf(c) === trump ? 10 : 0); }
  function cheapFirst(cards, trump) { return cards.slice().sort(function (a, b) { return cost(a, trump) - cost(b, trump); }); }

  // ---------- oʻrinlar ----------
  function active(st, s) { return !st.out[s]; }
  // s dan keyingi oʻyindagi oʻyinchi (s ning oʻzi emas)
  function nextActive(st, s) {
    for (let k = 1; k <= st.n; k++) { const j = (s + k) % st.n; if (active(st, j)) return j; }
    return s;
  }
  function prevActive(st, s) {
    for (let k = 1; k <= st.n; k++) { const j = (s - k + st.n * 2) % st.n; if (active(st, j)) return j; }
    return s;
  }
  // Hujum qila oladiganlar: himoyachidan boshqa, oʻyindagi oʻyinchilar — asosiy hujumchidan boshlab
  function attackers(st) {
    const o = [];
    for (let k = 0; k < st.n; k++) {
      const s = (st.attacker + k) % st.n;
      if (s !== st.defender && active(st, s)) o.push(s);
    }
    return o;
  }

  // ---------- holat ----------
  // opts.n — oʻyinchilar soni; opts.durak — oldingi oʻyin duragi (uning tagidan yuriladi)
  function newRound(opts) {
    opts = opts || {};
    const n = clampN(opts.n);
    const deck = opts.deck ? opts.deck.slice() : shuffle(DECK, opts.rng);
    const hands = [];
    for (let i = 0; i < n; i++) hands.push([]);
    let p = 0;
    for (let r = 0; r < HAND; r++) for (let i = 0; i < n; i++) hands[i].push(deck[p++]);
    const rest = deck.slice(p);
    // 6 kishida koloda qolmaydi — koʻzir oxirgi tarqatilgan karta boʻyicha (u oʻyinchining qoʻlida qoladi)
    const trumpCard = rest.length ? rest[0] : deck[p - 1];
    const st = {
      n: n,
      trump: suitOf(trumpCard),
      trumpCard: trumpCard,
      // stock: [0] — ochiq koʻzir (eng oxirida olinadi); pop() bilan olinadi
      stock: rest.slice(),
      hands: hands,
      out: hands.map(function () { return false; }),
      places: [],        // oʻyindan chiqish tartibi
      table: [],         // [{ a, d, by }]
      attacker: 0,
      defender: 1,
      boutLimit: MAX_ATTACK,
      taking: false,
      passed: hands.map(function () { return false; }),
      discarded: 0,
      boutNo: 0,
      phase: 'attack',   // attack | defend | throw | boutEnd | roundEnd
      turn: -1,
      lowest: null,      // birinchi yurishni belgilagan eng kichik koʻzir
      result: null,
      seq: 0,
      pending: []
    };
    let first = -1;
    const prev = Number.isInteger(opts.durak) && opts.durak >= 0 && opts.durak < n ? opts.durak : -1;
    if (prev >= 0) {
      first = prevActive(st, prev); // durakning tagidan
    } else {
      let best = 99;
      hands.forEach(function (h, i) {
        h.forEach(function (c) { if (suitOf(c) === st.trump && strength(c) < best) { best = strength(c); first = i; st.lowest = c; } });
      });
      if (first < 0) first = Number.isInteger(opts.first) ? ((opts.first % n) + n) % n : 0;
    }
    ev(st, 'start', first, { low: st.lowest || undefined, under: prev >= 0 ? prev : undefined });
    beginBout(st, first);
    return st;
  }

  function ev(st, kind, seat, data) {
    const e = { n: ++st.seq, kind: kind, seat: seat };
    if (data) for (const k in data) if (data[k] !== undefined) e[k] = data[k];
    st.pending.push(e);
    return e;
  }
  function takeEvents(st) { const e = st.pending; st.pending = []; return e; }

  function beginBout(st, attacker) {
    st.table = [];
    st.taking = false;
    st.attacker = attacker;
    st.defender = nextActive(st, attacker);
    st.boutLimit = Math.min(MAX_ATTACK, st.hands[st.defender].length);
    st.passed = st.hands.map(function () { return false; });
    st.phase = 'attack';
    st.turn = attacker;
  }

  function unbeaten(st) { let k = 0; for (const x of st.table) if (!x.d) k++; return k; }
  function tableRanks(st) {
    const r = new Set();
    for (const x of st.table) { r.add(rankOf(x.a)); if (x.d) r.add(rankOf(x.d)); }
    return r;
  }
  // Yana nechta karta tashlash mumkin
  function room(st) {
    if (st.phase === 'attack') return Math.min(st.boutLimit, st.hands[st.defender].length);
    const byTotal = st.boutLimit - st.table.length;
    const byHand = st.hands[st.defender].length - unbeaten(st);
    return Math.max(0, Math.min(byTotal, byHand));
  }
  // seat tashlay oladigan kartalar
  function throwable(st, seat) {
    if (seat === st.defender || !active(st, seat)) return [];
    if (st.phase !== 'defend' && st.phase !== 'throw') return [];
    if (room(st) <= 0) return [];
    const rs = tableRanks(st);
    return st.hands[seat].filter(function (c) { return rs.has(rankOf(c)); });
  }
  // Hali qaror qilmagan (va tashlay oladigan) hujumchilar
  function waiting(st) {
    return attackers(st).filter(function (s) { return !st.passed[s] && throwable(st, s).length > 0; });
  }

  // Navbat: kim harakat qilishi kutilyapti (taymer shunga qoʻyiladi)
  function updateTurn(st) {
    if (st.phase === 'attack') { st.turn = st.attacker; return; }
    if (st.phase !== 'defend' && st.phase !== 'throw') { st.turn = -1; return; }
    if (!st.taking && unbeaten(st) > 0) { st.phase = 'defend'; st.turn = st.defender; return; }
    st.phase = 'throw';
    const w = waiting(st);
    if (w.length) { st.turn = w[0]; return; }
    // Hech kim tashlamaydi — yurish tugadi
    st.phase = 'boutEnd';
    st.turn = -1;
    if (st.taking) ev(st, 'took', st.defender, { count: tableCount(st) });
    else ev(st, 'bito', st.defender, { count: tableCount(st) });
  }
  function tableCount(st) { let k = 0; for (const x of st.table) k += x.d ? 2 : 1; return k; }

  function fail(msg) { return { ok: false, error: msg }; }
  function okv(st) { return { ok: true, events: takeEvents(st) }; }

  function sameRank(cards) { return cards.every(function (c) { return rankOf(c) === rankOf(cards[0]); }); }

  /*
   * Harakatlar:
   *  { type: 'attack', cards: [...] } — yurish (stol boʻsh, asosiy hujumchi) yoki tashlash (podkidnoy)
   *  { type: 'beat', cards: [c], on: i } — himoyachi stoldagi i-kartani c bilan uradi
   *  { type: 'take' } — himoyachi kartalarni oladi
   *  { type: 'pass' } — hujumchi: boshqa tashlamayman ("Bito" / "Pas")
   */
  function act(st, seat, a) {
    if (!a || typeof a.type !== 'string') return fail('Notoʻgʻri harakat');
    if (st.phase === 'roundEnd') return fail('Oʻyin tugadi');
    if (st.phase === 'boutEnd') return fail('Yurish tugadi');
    const hand = st.hands[seat];
    if (!hand || !active(st, seat)) return fail('Siz oʻyindan chiqqansiz');
    const cards = Array.isArray(a.cards) ? a.cards.slice(0, MAX_ATTACK) : [];
    switch (a.type) {
      case 'attack': {
        if (seat === st.defender) return fail('Siz himoyalanyapsiz');
        if (!hasCards(hand, cards)) return fail('Bu kartalar qoʻlingizda yoʻq');
        if (!sameRank(cards)) return fail('Bir xil qiymatdagi kartalar bilan yuriladi');
        if (st.phase === 'attack') {
          if (seat !== st.attacker) return fail('Hozir ' + 'sizning yurishingiz emas');
          if (cards.length > room(st)) return fail('Bunchalik koʻp karta tashlab boʻlmaydi');
          removeCards(hand, cards);
          for (const c of cards) st.table.push({ a: c, d: null, by: seat });
          st.phase = 'defend';
          ev(st, 'attack', seat, { cards: cards.slice() });
        } else if (st.phase === 'defend' || st.phase === 'throw') {
          const rs = tableRanks(st);
          if (!cards.every(function (c) { return rs.has(rankOf(c)); })) return fail('Stolda shu qiymatdagi karta yoʻq');
          if (cards.length > room(st)) return fail(room(st) ? 'Faqat ' + room(st) + ' ta karta tashlash mumkin' : 'Boshqa karta tashlab boʻlmaydi');
          removeCards(hand, cards);
          for (const c of cards) st.table.push({ a: c, d: null, by: seat });
          ev(st, 'throw', seat, { cards: cards.slice() });
        } else return fail('Hozir tashlab boʻlmaydi');
        st.passed = st.hands.map(function () { return false; });
        updateTurn(st);
        return okv(st);
      }
      case 'beat': {
        if (seat !== st.defender) return fail('Siz himoyachi emassiz');
        if (st.taking) return fail('Siz kartalarni olyapsiz');
        if (st.phase !== 'defend') return fail('Urish uchun karta yoʻq');
        if (cards.length !== 1 || !hasCards(hand, cards)) return fail('Bitta karta tanlang');
        let on = Number.isInteger(a.on) ? a.on : -1;
        if (on < 0) { // qaysi kartani urishi aytilmagan — ura oladigan birinchisi
          on = st.table.findIndex(function (x) { return !x.d && beats(x.a, cards[0], st.trump); });
        }
        const slot = st.table[on];
        if (!slot || slot.d) return fail('Bu karta allaqachon urilgan');
        if (!beats(slot.a, cards[0], st.trump)) return fail('Bu karta urmaydi');
        removeCards(hand, cards);
        slot.d = cards[0];
        ev(st, 'beat', seat, { cards: cards.slice(), on: on, target: slot.a });
        st.passed = st.hands.map(function () { return false; });
        updateTurn(st);
        return okv(st);
      }
      case 'take': {
        if (seat !== st.defender) return fail('Siz himoyachi emassiz');
        if (st.taking) return fail('Allaqachon olyapsiz');
        if (st.phase !== 'defend') return fail('Olish uchun urilmagan karta yoʻq');
        st.taking = true;
        st.passed = st.hands.map(function () { return false; });
        ev(st, 'take', seat);
        updateTurn(st);
        return okv(st);
      }
      case 'pass': {
        if (seat === st.defender) return fail('Siz himoyalanyapsiz');
        if (st.phase !== 'throw' && st.phase !== 'defend') return fail('Hozir kerak emas');
        if (st.passed[seat]) return okv(st);
        st.passed[seat] = true;
        ev(st, 'pass', seat, { taking: st.taking || undefined });
        updateTurn(st);
        return okv(st);
      }
    }
    return fail('Nomaʼlum harakat');
  }

  // Yurish tugadi: kartalar olinadi yoki chiqib ketadi, hamma 6 tagacha karta oladi, keyingi yurish
  function collect(st) {
    if (st.phase !== 'boutEnd') return [];
    const d = st.defender, took = st.taking;
    const order = attackers(st).concat([d]);
    if (took) {
      for (const x of st.table) { st.hands[d].push(x.a); if (x.d) st.hands[d].push(x.d); }
    } else {
      st.discarded += tableCount(st);
    }
    st.table = [];
    for (const s of order) {
      let got = 0;
      while (st.hands[s].length < HAND && st.stock.length) { st.hands[s].push(st.stock.pop()); got++; }
      if (got) ev(st, 'refill', s, { count: got });
    }
    // koloda tugagan boʻlsa — kartasi qolmaganlar chiqadi
    if (!st.stock.length) {
      for (const s of order) {
        if (!st.hands[s].length && !st.out[s]) {
          st.out[s] = true;
          st.places.push(s);
          ev(st, 'out', s, { place: st.places.length });
        }
      }
    }
    st.boutNo++;
    const left = [];
    for (let s = 0; s < st.n; s++) if (!st.out[s]) left.push(s);
    if (left.length <= 1) {
      endRound(st, left.length ? { type: 'durak', seat: left[0] } : { type: 'draw', seat: -1 });
      return takeEvents(st);
    }
    // Kartalar cheksiz aylanib qolsa (juda kam uchraydi) — durang
    if (st.boutNo >= MAX_BOUTS) {
      endRound(st, { type: 'draw', seat: -1, stall: true });
      return takeEvents(st);
    }
    // Olgan himoyachi navbatini oʻtkazib yuboradi; bito boʻlsa — himoyachi yuradi
    let next;
    if (took) next = nextActive(st, d);
    else next = st.out[d] ? nextActive(st, d) : d;
    beginBout(st, next);
    return takeEvents(st);
  }

  function endRound(st, r) {
    st.phase = 'roundEnd';
    st.turn = -1;
    r.places = st.places.slice();
    r.counts = st.hands.map(function (h) { return h.length; });
    st.result = r;
    ev(st, r.type, r.seat, { places: r.places.slice() });
  }

  // Vaqt tugadi: himoyachi oladi, hujumchi tashlamaydi, yurishda — eng kichik karta
  function autoMove(st, seat) {
    if (st.phase === 'attack' && seat === st.attacker) {
      const c = cheapFirst(st.hands[seat], st.trump)[0];
      return c ? { type: 'attack', cards: [c] } : null;
    }
    if (st.phase === 'defend' && seat === st.defender && !st.taking) return { type: 'take' };
    if ((st.phase === 'throw' || st.phase === 'defend') && seat !== st.defender && active(st, seat)) return { type: 'pass' };
    return null;
  }

  // ---------- har bir oʻyinchi uchun koʻrinish (yashirin maʼlumotsiz) ----------
  function viewFor(st, me) {
    const mine = me >= 0 && me < st.n;
    const v = {
      n: st.n,
      me: mine ? me : -1,
      trump: st.trump,
      trumpCard: st.trumpCard,
      stock: st.stock.length,
      discarded: st.discarded,
      phase: st.phase,
      attacker: st.attacker,
      defender: st.defender,
      turn: st.turn,
      taking: st.taking,
      limit: st.boutLimit,
      room: (st.phase === 'defend' || st.phase === 'throw' || st.phase === 'attack') ? room(st) : 0,
      boutNo: st.boutNo,
      table: st.table.map(function (x) { return { a: x.a, d: x.d, by: x.by }; }),
      passed: st.passed.slice(),
      out: st.out.slice(),
      places: st.places.slice(),
      hand: mine ? st.hands[me].slice() : null,
      counts: st.hands.map(function (h) { return h.length; }),
      result: null
    };
    if (st.phase === 'roundEnd') v.result = resultView(st);
    return v;
  }

  function resultView(st) {
    const r = st.result;
    if (!r) return null;
    return { type: r.type, seat: r.seat, places: r.places.slice(), counts: r.counts.slice(), stall: !!r.stall };
  }

  // ---------- kompyuter oʻyinchisi ----------
  // Yurish: eng arzon karta (juftlari bilan), koloda tugaganda — kuchliroq bosim
  function aiAttack(st, me) {
    const hand = st.hands[me], tr = st.trump;
    const sorted = cheapFirst(hand, tr);
    const lead = sorted.find(function (c) { return suitOf(c) !== tr; }) || sorted[0];
    const rk = rankOf(lead);
    let group = hand.filter(function (c) { return rankOf(c) === rk && (suitOf(c) !== tr || !st.stock.length); });
    if (!group.length) group = [lead];
    // juft kartalar bilan birga yurish (koloda kam qolganda yoki kichik kartalar boʻlsa)
    if (strength(lead) > 4 && st.stock.length > 6) group = [lead];
    return { type: 'attack', cards: group.slice(0, room(st)) };
  }

  function aiDefend(st, me) {
    const hand = st.hands[me], tr = st.trump;
    // urilmagan kartalarning har biriga eng arzon urar kartani tanlaymiz (kattasidan boshlab)
    const open = [];
    st.table.forEach(function (x, i) { if (!x.d) open.push(i); });
    open.sort(function (a, b) { return cost(st.table[b].a, tr) - cost(st.table[a].a, tr); });
    const used = new Set();
    const plan = [];
    for (const i of open) {
      const a = st.table[i].a;
      const opts = cheapFirst(hand.filter(function (c) { return !used.has(c) && beats(a, c, tr); }), tr);
      if (!opts.length) return { type: 'take' };
      used.add(opts[0]);
      plan.push({ on: i, c: opts[0] });
    }
    // qimmat koʻzirlarni koloda hali katta boʻlganda ayaymiz
    const spend = plan.reduce(function (s, p) { return s + (suitOf(p.c) === tr ? 3 + strength(p.c) : 0); }, 0);
    const stock = st.stock.length;
    const tableSize = tableCount(st);
    if (stock > 8 && spend >= 10 && tableSize <= 2) return { type: 'take' };
    if (stock > 14 && plan.some(function (p) { return suitOf(p.c) === tr && strength(p.c) >= 7; })) return { type: 'take' };
    const p = plan[0];
    return { type: 'beat', cards: [p.c], on: p.on };
  }

  function aiThrow(st, me) {
    const tr = st.trump;
    const opts = cheapFirst(throwable(st, me), tr).filter(function (c) {
      if (!st.stock.length) return true;                 // oxirida — hammasini tashlaymiz
      if (suitOf(c) === tr) return false;                 // koʻzir ayaladi
      return strength(c) <= (st.taking ? 7 : 5);          // olayotganga kattaroq ham beriladi
    });
    if (!opts.length) return { type: 'pass' };
    return { type: 'attack', cards: [opts[0]] };
  }

  function aiChoose(st, me) {
    if (!active(st, me)) return null;
    if (st.phase === 'attack' && me === st.attacker) return aiAttack(st, me);
    if (st.phase === 'defend' && me === st.defender && !st.taking) return aiDefend(st, me);
    if ((st.phase === 'throw' || st.phase === 'defend') && me !== st.defender) return aiThrow(st, me);
    return null;
  }

  return {
    SUITS: SUITS, RANKS: RANKS, HAND: HAND, MAX_ATTACK: MAX_ATTACK, MIN_N: MIN_N, MAX_N: MAX_N,
    makeDeck: makeDeck, shuffle: shuffle, rankOf: rankOf, suitOf: suitOf, strength: strength, isCard: isCard,
    beats: beats, clampN: clampN, sortHand: sortHand,
    newRound: newRound, act: act, collect: collect, takeEvents: takeEvents,
    viewFor: viewFor, resultView: resultView, autoMove: autoMove,
    throwable: throwable, room: room, attackers: attackers, unbeaten: unbeaten,
    AI: { choose: aiChoose }
  };
});
