/* G4 T1 / N1: use the existing engine and restore the caller's BT state. */
(function () {
  'use strict';
  var cache = new Map();
  function results(s, per) {
    var key = s.id + ':' + per + ':' + PRICE0.length + ':' + s.r.ret;
    if (cache.has(key)) return cache.get(key);
    var saved = BT;
    try {
      BT = Object.assign({}, saved, { s: s, id: s.id, per: per, amt: 1000, R: null });
      var r = btCompute();
      cache.set(key, r);
      return r;
    } finally { BT = saved; }
  }
  function held(s) {
    var o = s.r && s.r.state && s.r.state.open;
    return o ? (Array.isArray(o) ? o : [o]) : [];
  }
  function face(exIds) {
    return tfSSRows().filter(function (s) { return !s.me && s.cfg && held(s).length && (!exIds || exIds.indexOf(exchange(s)) >= 0); })
      .map(function (s) { return { s: s, all: results(s, 0) }; })
      .sort(function (a, b) { return b.all.final - a.all.final; })[0] || null;
  }
  function mine() {
    if (!S.user) return [];
    return cpState().copies.filter(function (c) { return c.status === 'active'; })
      .map(function (c) { return { c: c, s: tfSSFind(c.nick), d: cpCalc(c) }; })
      .filter(function (row) { return row.s && !row.d.missing; });
  }
  /* 핫픽스 mine 도착(T5 cur3 P1): 대화로 만든 내 전략을 시작하면 S.tf.strat 에 live 로 남는데 T1 은 복사 기록(cp.copies)만 읽어
     공개 추천 카드로 갔다. live 내 전략도 T1 카드 행으로. 복사 기록 행과 모양은 같고(c.id, s, d) mine 표시만 더한다.
     전략 객체는 시작 때 저장한 규칙(p)과 자산으로 엔진(mkRunCfg)을 돌린 것, 이름은 대화, 착지와 같은 이름(aiSpec.name) */
  var liveCache = new Map();
  function liveStrategy(st) {
    var a = (typeof BT_MINE_ALIAS !== 'undefined' && BT_MINE_ALIAS[st.asset]) || st.asset, p = st.p || {};
    if (!a || !MK_PX_CFG[a] || p.rsiTh == null) return null;
    var cfg = { id: 'mine', kind: 'rule', asset: a, rsiTh: p.rsiTh, tp: p.tp, sl: p.sl, tf: p.trendFilter ? 1 : 0, fng: p.fng != null ? p.fng : null, startI: 61 };
    var key = st.at + '|' + JSON.stringify(cfg) + '|' + PRICE0.length + '|' + (st.g4name || '');
    if (liveCache.has(key)) return liveCache.get(key);
    var name = st.g4name || st.name;
    var s = { id: 'mine-live-' + st.at, mine: true, live: true, kind: 'rule', mkt: /비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a) ? 'crypto' : 'stock',
      nick: name, name: name, one: '', asset: a, uni: null, cfg: cfg, ex: st.ex || linked()[0] || null, p: p, fw: 0, by: '', r: mkRunCfg(cfg) };
    liveCache.set(key, s);
    return s;
  }
  function live() {
    if (!S.user) return [];
    var t = tfS(), ai = t.aiSpec || {}, named = false;
    var rows = (t.strat || []).filter(function (st) { return st && st.status === 'live' && !st.src && st.p; }).map(function (st, k) {
      /* 이름: 방금 시작한 것(맨 앞)이 지금 대화의 규칙과 같으면 그 이름을 기록에 붙여 둔다(나중에 다른 대화를 해도 이름이 그대로) */
      if (!st.g4name && k === 0 && ai.name && ai.rsiTh === st.p.rsiTh && (ai.tp == null || ai.tp === st.p.tp)) { st.g4name = ai.name; named = true; }
      var s = liveStrategy(st); if (!s) return null;
      var cap = (st.cap || 0) / 1000;
      return { c: { id: 'mine:' + st.at }, s: s, st: st, mine: true, d: { value: cap, inv: cap, total: 0, myPct: 0, lots: [], posOpen: false, waiting: 0 } };
    }).filter(Boolean);
    if (named && typeof tfSave === 'function') tfSave();
    return rows;
  }
  function exchange(s) { return mkEx(s)[0].replace(/^app-/, ''); }
  function copyExchange(c) {
    if (c.exchangeId) return c.exchangeId;
    var s = tfSSFind(c.nick), ex = s && exchange(s), connected = linked();
    return connected.indexOf(ex) >= 0 ? ex : connected.length === 1 ? connected[0] : ex || '';
  }
  function hasFill(row) {
    var eq = row.s.r.eq, last = eq[eq.length - 1].i;
    return (row.d.lots || []).some(function (lot) { return lot.inv != null && lot.inv <= last; });
  }
  function linked() { return S.user ? acConnList().filter(function (id) { return acReady(id); }) : []; }
  function pos(s, row) {
    if (row && !hasFill(row)) return '다음 진입을 기다리는 중';
    if (row && !row.d.posOpen) return row.d.waiting > 0.005 ? '원본 전략이 다음에 진입하면 예산 ' + cpUsd(row.d.waiting, 0) + '을 반영합니다.' : '현재 보유 종목이 없습니다.';
    var L = held(s);
    if (!L.length) return '진입 조건을 기다리고 있습니다.';
    return '지금 ' + L.map(function (x) {
      return mkTk(x.k) + (fuIs(s) ? (x.side < 0 ? ' 숏' : ' 롱') : '') + ' ' + mkPct0(tbPnl(x), 1);
    }).join(', ') + ' 보유 중';
  }
  function curve(s, row) {
    if (!row) {
      var r = results(s, 0);
      return r.eq.map(function (p, j) { return { i: p.i, strategy: p.v * 1000, hold: r.bench[j] * 1000 }; });
    }
    var c = row.c, d = row.d, eq = s.r.eq, last = eq[eq.length - 1].i;
    var start = c.simStartI != null ? c.simStartI : eq[Math.max(0, eq.length - 31)].i;
    var led = c.ledger.map(function (e, j) { return { i: e.i != null ? e.i : (j ? last : start), amt: e.amt, type: e.type }; });
    var first = Math.min.apply(null, led.map(function (e) { return e.i; }));
    var prices = mkUni(s).list.map(function (k) { return mkPx(k); }), out = [];
    for (var i = first; i <= last; i++) {
      var hold = led.filter(function (e) { return e.i <= i; }).reduce(function (sum, e) {
        var ratio = prices.reduce(function (v, P) { return v + P[i] / P[e.i]; }, 0) / prices.length;
        return sum + (e.type === 'add' ? 1 : -1) * e.amt * ratio;
      }, 0);
      out.push({ i: i, strategy: d.at(i).value, hold: hold });
    }
    return out;
  }
  var key = 'g4.t1.handoff';
  function read() {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function save(id, budget) {
    var s = tfSSFind(id);
    if (!s || !s.id) return null;
    var prev = read(), amount = budget;
    if (amount === undefined) amount = prev && prev.strategyId === s.id ? prev.budget : 1000;
    var value = { strategyId: s.id, budget: amount, returnTo: '#/share/s/' + encodeURIComponent(s.id) + '/all' };
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    return value;
  }
  window.G4T1Data = { results: results, held: held, face: face, mine: mine, live: live, exchange: exchange, copyExchange: copyExchange, hasFill: hasFill, linked: linked, pos: pos, curve: curve, handoff: read, save: save };
})();
