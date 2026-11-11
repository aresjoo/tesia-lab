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
  function exchange(s) { return mkEx(s)[0].replace(/^app-/, ''); }
  function linked() { return S.user ? acConnList().filter(function (id) { return acReady(id); }) : []; }
  function pos(s, row) {
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
  window.G4T1Data = { results: results, held: held, face: face, mine: mine, exchange: exchange, linked: linked, pos: pos, curve: curve, handoff: read, save: save };
})();
