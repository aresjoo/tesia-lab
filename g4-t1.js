/* Independent G4/T1 Codex implementation. Copy: table-v1; numbers/routes: decision-1. */
(function () {
  'use strict';
  var D = G4T1Data, selectedCopy = null, listRoute = '#/trade/strategies';
  var oldNF = tfNFRoute, oldDash = tfDashView, oldHub = tfShareHub;
  var oldContent = gContent, oldSheet = mkFollowSheet, oldSetup = cpSetupGo;
  var oldAfter = acAfter, oldIntent = tfIntentRun, oldAuthSync = authSyncUI;
  var listRendering = false, resumeQueued = false;
  function esc(v) { return gEsc(String(v == null ? '' : v)); }
  function money(v, cents) { return cpUsd(v, cents ? 2 : 0); }
  function signed(v) { return (v > 0 ? '+' : '') + money(v, true); }
  function date(i) { var d = idxToDate(i); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function tidy(t) { return String(t || '').replace(/바꿉니입니다/g, '바꿉니다').replace(/올립니입니다/g, '올립니다'); }
  var oldPolite = mkPolite;
  mkPolite = function (t) { return tidy(oldPolite(t)); };
  function now(s) { return tidy(mkChatNow(s, s.r)); }
  function first(t, n) { return (t.match(/.*?(?:\.(?=\s|$)|$)/g) || [t]).filter(Boolean).slice(0, n).join(' ').trim(); }
  function n1(s, small) {
    var r = D.results(s, 0), y = D.results(s, 365);
    return '<div class="g4-n1' + (small ? ' compact' : '') + '"><span>$1,000 넣었다면 지금</span><strong>' + money(r.final) + '</strong>'
      + '<p>그냥 들고 있었다면 ' + money(r.benchFinal) + '</p><small>전체 기간 ' + date(r.i0) + '부터</small>'
      + '<small>최근 1년 ' + money(y.final) + ', 그냥 들고 있었다면 ' + money(y.benchFinal) + '</small></div>';
  }
  function records(s) {
    // Same event formatter as detail, without stale MK_VOICE "now" replacement.
    return (s.r.events || []).slice(-3).reverse().map(function (e) {
      var m = mkChatEv(s, e);
      return '<li><div><time>' + date(e.i) + '</time><span>' + esc(m.tag) + '</span></div><p>' + esc(first(tidy(m.t), 2)) + '</p></li>';
    }).join('');
  }
  function render() {
    if (!window.TF_STATE_READY) return;
    var owned = D.mine(), row = owned.find(function (x) { return x.c.id === selectedCopy; }) || owned[0];
    var f = row ? { s: row.s, all: D.results(row.s, 0) } : D.face();
    if (!f) { showList(); return; }
    var s = f.s, r = f.all, y = D.results(s, 365), current = first(now(s), 2);
    if (row && !row.d.posOpen) current = row.d.waiting > 0.005 ? '원본 전략이 다음에 진입하면 예산 ' + money(row.d.waiting) + '을 반영합니다.' : '현재 보유 종목이 없습니다.';
    var balance = row ? row.d.value : r.final, change = row ? row.d.total : r.final - 1000;
    tfPageMode('nfmain', 'AI 트레이딩');
    document.body.classList.add('g4-main');
    TF_ONNF = true; TF_ONSHARE = false; TF_ONSTRAT = false;
    var choose = owned.length > 1 ? '<select aria-label="복사한 전략 선택" onchange="G4T1.selectCopy(this.value)">' + owned.map(function (x) {
      return '<option value="' + esc(x.c.id) + '"' + (x === row ? ' selected' : '') + '>' + esc(mkTitle(x.s)) + '</option>';
    }).join('') + '</select>' : '';
    var comparison = row
      ? '넣은 돈 ' + money(row.d.inv, true) + ', 같은 기간 원본 수익률 ' + mkPct0(row.d.pnlPct * 100, 1)
      : '그냥 들고 있었다면 ' + money(r.benchFinal) + '. ' + (Math.round(r.final) >= Math.round(r.benchFinal)
        ? '+' + money(Math.round(r.final) - Math.round(r.benchFinal)) + ' 더 벌었습니다.'
        : money(Math.round(r.benchFinal) - Math.round(r.final)) + ' 적습니다.');
    var body = '<main class="g4-trade" lang="ko"><p class="g4-usp">' + (row ? 'TETH AI 실시간 자동 운용 중' : 'Bitget이 선정한 최고의 트레이딩 AI') + '</p>'
      + '<section class="g4-money" aria-labelledby="g4-title"><div class="g4-strategy">' + mkGlyph(s, 36)
      + '<div><span>' + esc(mkTitle(s)) + '</span><small>' + esc(MK_KIND[s.kind]) + '</small></div>' + mkExTag(s) + '</div>' + choose
      + '<h1 id="g4-title">' + (row ? '내 자산' : '$1,000 넣었다면 지금') + '<strong class="g4-amount">' + money(balance, !!row) + '</strong></h1>'
      + (row ? '<p class="g4-profit ' + (change >= 0 ? 'up' : 'down') + '">' + signed(change) + ' (' + mkPct0(row.d.myPct * 100, 1) + ')</p>' : '')
      + '<p class="g4-compare">' + esc(comparison) + '</p>'
      + (!row ? '<p class="g4-period">전체 기간 ' + date(r.i0) + '부터<br>최근 1년 ' + money(y.final) + ', 그냥 들고 있었다면 ' + money(y.benchFinal) + '</p>' : '')
      + '<div class="g4-now"><p>' + esc(current) + '</p><small>' + (row ? esc(mkTitle(s)) : s.fw.toLocaleString() + '명이 따라가는 중') + '</small></div>'
      + '<button class="g4-primary" type="button" onclick="G4T1.primary()">' + (row ? '예산 조정' : '이 전략 보기') + '</button>'
      + (!row ? '<p class="g4-free">영원히 무료, 카드 등록 필요없음</p>' : '') + '</section>'
      + '<section class="g4-history" aria-labelledby="g4-history-title"><div class="g4-section-head"><h2 id="g4-history-title">TETH의 판단 기록</h2><a href="#/share/s/' + encodeURIComponent(s.id) + '/all/log">판단 기록 보기</a></div><ol>' + records(s) + '</ol></section>'
      + '<nav class="g4-links" aria-label="더 둘러보기"><a href="' + listRoute + '">전체 ' + tfSSRows().filter(function (x) { return !x.me; }).length + '개 전략 둘러보기 →</a>'
      + (row ? '<a href="#/trade/chart">차트 보기</a><button type="button" onclick="G4T1.stop()">복사 중단</button>' : '') + '</nav>'
      + '<p class="g4-help">막히면 상담원이 24시간 답합니다. <button type="button" onclick="tethHelpOpen()">상담원에게 묻기</button></p></main>';
    G4T1.current = { strategyId: s.id, copyId: row ? row.c.id : null };
    TF_RENDERING = true;
    try { gContent(body); } finally { TF_RENDERING = false; }
    document.body.classList.add('g4-main');
    document.documentElement.classList.remove('g4-entry');
    window.G4_T1_READY = true;
  }
  function showList() {
    listRendering = true;
    try { oldHub('find'); } finally { listRendering = false; }
    history.replaceState(null, '', location.pathname + location.search + listRoute);
    TF_ONNF = true;
    var page = document.querySelector('#g-content .ss3');
    if (page) page.insertAdjacentHTML('afterbegin', '<a class="g4-back" href="#/trade">← AI 트레이딩</a>');
    document.documentElement.classList.remove('g4-entry');
  }
  tfShareHub = function (tab) {
    if (tab === 'follow') { tfNav('#/trade'); return; }
    if (listRendering || location.hash === listRoute) { showList(); return; }
    tfNav(listRoute);
  };
  tfNFRoute = function (h) {
    if (h === '#/trade') { render(); return true; }
    if (h === listRoute) { showList(); return true; }
    if (h === '#/trade/chart') {
      var previewBefore = window.TF_PREVIEW;
      window.TF_PREVIEW = !S.user;
      try { oldDash(); } finally { window.TF_PREVIEW = previewBefore; }
      // The legacy terminal normalizes its URL to /trade; keep T1's nested route.
      if ($('nfxh-wrap')) history.replaceState(null, '', location.pathname + location.search + h);
      var chart = document.querySelector('#g-content');
      if (chart && !chart.querySelector('.g4-back')) chart.insertAdjacentHTML('afterbegin', '<a class="g4-back g4-chart-back" href="#/trade">← AI 트레이딩</a>');
      return true;
    }
    return oldNF(h);
  };
  // Direct entry points, including QA and the sidebar, converge on the summary.
  tfDashView = function () { if (location.hash === '#/trade/chart') return oldDash(); tfNav('#/trade'); };
  tfIntroView = function () { tfNav('#/trade'); };
  tfTradeInactiveView = function () { tfNav('#/trade'); };
  gContent = function () {
    document.body.classList.remove('g4-main');
    return oldContent.apply(this, arguments);
  };
  // Stable back target and the same N1 values when entering the existing T3.
  var oldDetail = tfSS3DetailRender;
  tfSS3DetailRender = function (ne, pd, tab) {
    var v = oldDetail.apply(this, arguments), s;
    try { s = tfSSFind(decodeURIComponent(ne)); } catch (_) {}
    var page = document.querySelector('#g-content .mk-detail');
    if (s && s.cfg && page && !page.querySelector('.g4-n1')) {
      page.insertAdjacentHTML('afterbegin', '<a class="g4-back" href="#/trade">← AI 트레이딩</a>' + n1(s, false));
    }
    return v;
  };
  var oldCard = mkCard;
  mkCard = tfSS3Card = function (s) {
    var html = oldCard(s);
    if (!s.cfg || s.me) return html;
    var box = document.createElement('template'); box.innerHTML = html;
    var card = box.content.firstElementChild;
    if (card) { var perf = card.querySelector('.skf-perf'); if (perf) perf.remove(); card.insertAdjacentHTML('afterbegin', n1(s, true)); }
    return box.innerHTML;
  };
  function captureBudget() {
    var el = $('cps-amt'), o = D.handoff();
    if (el && o) D.save(o.strategyId, el.value === '' ? null : Number(el.value));
  }
  function copyReady(s) {
    var d = tfDerive(), ex = s.ex && acEx(s.ex) ? s.ex : null;
    return !!(S.user && d.entitlement && d.entitlement.follow && acReady(ex));
  }
  function budgetSync() {
    var input = $('g4-budget'), o = D.handoff(), button = $('g4-budget-next');
    if (!input || !o) return false;
    var strategy = tfSSFind(o.strategyId), amount = Number(input.value);
    var valid = !!(strategy && input.value.trim() && Number.isFinite(amount) && amount >= mkMin(strategy));
    D.save(o.strategyId, input.value.trim() && Number.isFinite(amount) && amount > 0 ? amount : null);
    if (button) button.disabled = !valid;
    var error = $('g4-budget-error');
    if (error) error.textContent = input.value && !valid && strategy ? '최소 ' + money(mkMin(strategy)) + '부터 시작할 수 있습니다' : '';
    return valid;
  }
  function budgetSheet(s, o) {
    mkFollowClose(true);
    tfSS3Dlg('전략 복사', '<form class="g4-budget-form" onsubmit="G4T1.connectBudget(event)">'
      + '<p class="g4-budget-strategy">' + esc(mkTitle(s)) + '</p>'
      + '<label for="g4-budget">복사 예산</label><div class="g4-budget-input"><span>$</span>'
      + '<input id="g4-budget" type="number" inputmode="decimal" min="' + mkMin(s) + '" step="any" required'
      + ' aria-describedby="g4-budget-min g4-budget-error" oninput="G4T1.budgetSync()" value="' + (o && o.budget != null ? esc(o.budget) : '') + '"></div>'
      + '<p id="g4-budget-min">최소 ' + money(mkMin(s)) + '</p>'
      + '<p id="g4-budget-error" role="status"></p>'
      + '<button id="g4-budget-next" type="submit" class="g4-primary" disabled>거래소 연결</button></form>');
    $('ss3-dlgw').classList.add('g4-budget-dialog');
    budgetSync();
    if (innerWidth > 760) $('g4-budget').focus();
  }
  function connectBudget(event) {
    if (event) event.preventDefault();
    if (!budgetSync()) return;
    var o = D.handoff(), s = tfSSFind(o.strategyId);
    tfSS3DlgClose(true);
    acStart({ need: s.ex && acEx(s.ex) ? s.ex : null, name: mkHook(s),
      after: { kind: 'copy', id: o.strategyId, budget: o.budget, returnTo: o.returnTo } });
  }
  function openSaved() {
    var o = D.handoff();
    if (!o || !S.user || !tfSSFind(o.strategyId)) return false;
    history.replaceState(null, '', location.pathname + location.search + o.returnTo);
    tfSS3DetailRender(o.strategyId, 'all', 'ov');
    mkFollowSheet(o.strategyId);
    return true;
  }
  cpSetupGo = function (ne) {
    var id; try { id = decodeURIComponent(ne); } catch (_) { id = ne; }
    if (!D.save(id)) return oldSetup(ne);
    if (!S.user) {
      authOpen('signup'); // authOpen clears the previous intent; save this one afterwards.
      tfIntentSet({ kind: 'g4copy', id: D.handoff().strategyId });
      return;
    }
    return oldSetup(ne);
  };
  mkFollowSheet = function (ne) {
    var id; try { id = decodeURIComponent(ne); } catch (_) { id = ne; }
    var o = D.save(id), strategy = tfSSFind(id);
    if (strategy && S.user && !copyReady(strategy)) { budgetSheet(strategy, o); return; }
    var v = oldSheet(ne), inp = $('cps-amt');
    if (inp && o && o.budget != null) { inp.value = o.budget; cpFormSync(); }
    return v;
  };
  var oldSync = cpFormSync;
  cpFormSync = function () { captureBudget(); return oldSync.apply(this, arguments); };
  // A successful account operation resumes only an explicitly pending copy intent.
  tfIntentRun = function () {
    var o = tfIntentPeek();
    if (o && o.kind === 'g4copy' && S.user) { tfIntentClear(); return openSaved(); }
    return oldIntent();
  };
  acAfter = function (af) {
    if (af && af.kind === 'copy') {
      var id; try { id = decodeURIComponent(af.id); } catch (_) { id = af.id; }
      D.save(id); if (openSaved()) return;
    }
    return oldAfter(af);
  };
  authSyncUI = function () {
    var v = oldAuthSync.apply(this, arguments), o = tfIntentPeek();
    if (S.user && o && o.kind === 'g4copy' && !resumeQueued) {
      resumeQueued = true;
      setTimeout(function () { resumeQueued = false; tfIntentRun(); }, 0);
    } else if (S.user && location.hash === '#/trade') { setTimeout(render, 0); }
    return v;
  };
  // Main-page adjustment keeps the user here and refreshes the existing ledger values.
  var oldAdjCommit = cpAdjCommit;
  cpAdjCommit = function (cid, amount, direction) {
    var onMain = G.mode === 'nfmain' && location.hash === '#/trade';
    var copy = cpFind(cid), entries = copy ? copy.ledger.length : 0;
    var v = oldAdjCommit.apply(this, arguments);
    if (onMain && location.hash === '#/trade' && copy && copy.ledger.length !== entries) render();
    return v;
  };
  window.G4T1 = {
    current: null,
    render: render,
    budgetSync: budgetSync,
    connectBudget: connectBudget,
    primary: function () {
      var c = G4T1.current;
      if (c.copyId) { cpAdjDlg(c.copyId); return; }
      D.save(c.strategyId); tfSS3Go(encodeURIComponent(c.strategyId), 'all', 'ov');
    },
    stop: function () {
      var c = G4T1.current;
      if (c && c.copyId) cpCloseDlg(c.copyId);
    },
    selectCopy: function (id) { selectedCopy = id; render(); }
  };
  if (/^#\/trade(?:\/|$)/.test(location.hash) && window.TF_STATE_READY) tfRoute();
})();
