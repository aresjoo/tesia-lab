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
  function face() {
    return tfSSRows().filter(function (s) { return !s.me && held(s).length; })
      .map(function (s) { return { s: s, all: results(s, 0) }; })
      .sort(function (a, b) { return b.all.final - a.all.final; })[0] || null;
  }
  function mine() {
    if (!S.user) return [];
    return cpState().copies.filter(function (c) { return c.status === 'active'; })
      .map(function (c) { return { c: c, s: tfSSFind(c.nick), d: cpCalc(c) }; })
      .filter(function (row) { return row.s && !row.d.missing; });
  }
  var key = 'g4.t1.handoff';
  function read() {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function save(id, budget) {
    var s = tfSSFind(id);
    if (!s || !s.id) return null;
    var prev = read(), amount = budget;
    if (amount === undefined) amount = prev && prev.strategyId === s.id ? prev.budget : null;
    var value = { strategyId: s.id, budget: amount, returnTo: '#/share/s/' + encodeURIComponent(s.id) + '/all' };
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    return value;
  }
  window.G4T1Data = { results: results, held: held, face: face, mine: mine, handoff: read, save: save };
})();
