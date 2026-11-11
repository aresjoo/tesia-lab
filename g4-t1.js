/* G4/T1 integration: decision.md I1-I11 and astra/astra-decision.md. */
(function () {
  'use strict';
  var D = G4T1Data, selectedCopy = sessionStorage.getItem('g4.t1.selectedCopy'), listRoute = '#/trade/strategies';
  var oldNF = tfNFRoute, oldDash = tfDashView, oldHub = tfShareHub;
  var oldContent = gContent, oldSheet = mkFollowSheet, oldSetup = cpSetupGo;
  var oldAfter = acAfter, oldIntent = tfIntentRun, oldAuthSync = authSyncUI;
  var listRendering = false, resumeQueued = false, chartRendering = false;
  function esc(v) { return gEsc(String(v == null ? '' : v)); }
  function money(v, cents) { return cpUsd(v, cents ? 2 : 0); }
  function signed(v) { return (v > 0 ? '+' : '') + money(v, true); }
  function date(i) { var d = idxToDate(i); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function tidy(t) {
    var text = skdText(String(t || '').replace(/바꿉니입니다/g, '바꿉니다').replace(/올립니입니다/g, '올립니다'));
    return text.replace(/\b([A-Z][A-Z0-9]*)[을를](?:\(를\))?/g, function (_, symbol) { return symbol + (symbol.endsWith('L') ? '을' : '를'); })
      .replace(/[A-Z0-9]+, (?=종가가|\d+일 평균)/g, '')
      .replace(/(\d+일) 평균이 (\d+일) 평균을 (아래|위)로 (?:넘음|넘었습니다)\./g, '$1 평균선이 $2 평균선을 $3로 교차했습니다.')
      .replace(/(최저가|최고가) \$?([\d,.]+)을\(를\) 아래로 벗어남\./g, '$1 $$$2 아래로 벗어났습니다.')
      .replace(/(최저가|최고가) \$?([\d,.]+)을\(를\) 넘음\./g, '$1 $$$2을 넘었습니다.')
      .replace(/을\(를\)/g, '을').replace(/벗어남\./g, '벗어났습니다.');
  }
  var oldPolite = mkPolite;
  mkPolite = function (t) { return tidy(oldPolite(t)); };
  var oldMessages = mkChatMsgs, oldFeed = tbFeed;
  mkChatMsgs = function () { return oldMessages.apply(this, arguments).map(function (m) { return Object.assign({}, m, {t: tidy(m.t), ts: date(m.i) + ' ' + ((String(m.ts || '').match(/\d{2}:\d{2}/) || ['09:00'])[0])}); }); };
  tbFeed = function (messages) { return oldFeed((messages || []).map(function (m) { return Object.assign({}, m, {t: tidy(m.t), ts: String(m.ts || '').replace(/(\d{2}:\d{2}):\d{2}/g, '$1')}); })); };
  function now(s) { return tidy(mkChatNow(s, s.r)); }
  function first(t, n) { return (t.match(/.*?(?:\.(?=\s|$)|$)/g) || [t]).filter(Boolean).slice(0, n).join(' ').trim(); }
  function n1(s, small) {
    var r = D.results(s, 0), y = D.results(s, 365);
    return '<div class="g4-n1' + (small ? ' compact' : '') + '"><span>$1,000 넣었다면 지금</span><strong>' + money(r.final) + '</strong>'
      + '<p>그냥 들고 있었다면 ' + money(r.benchFinal) + '</p><small>전체 기간 ' + date(r.i0) + '부터</small>'
      + '<small>최근 1년 ' + money(y.final) + ', 그냥 들고 있었다면 ' + money(y.benchFinal) + '</small></div>';
  }
  var COPY = {
    usp: 'Bitget이 선정한 최고의 트레이딩 AI', running: '지금 돌아가는 중',
    managed: 'TETH AI가 내 거래소에서 직접 운용 중', linked: ' 계정 연결 완료',
    start: '내 $1,000으로 이 전략 시작하기', invested: '넣은 돈 ',
    ifInvested: '$1,000 넣었다면 지금', strategy: '전략', hold: '그냥 들고 있기',
    records: 'TETH의 판단 기록', free: '영원히 무료, 카드 등록 필요없음'
  };
  var arrived = false;
  function bars() { return '<span class="g4-bars" aria-hidden="true"><i></i><i></i><i></i></span>'; }
  function curve(s, row, compact) {
    var points = D.curve(s, row), last = points[points.length - 1];
    if (!last) return '';
    var low = Infinity, high = -Infinity;
    points.forEach(function (p) { low = Math.min(low, p.strategy, p.hold); high = Math.max(high, p.strategy, p.hold); });
    var range = high - low || 1, firstI = points[0].i, span = last.i - firstI || 1;
    function line(key) { return points.map(function (p) { return (8 + (p.i - firstI) / span * 984).toFixed(2) + ',' + (190 - (p[key] - low) / range * 180).toFixed(2); }).join(' '); }
    return '<figure class="g4-curve' + (compact ? ' compact' : '') + '" data-strategy-end="' + last.strategy + '" data-hold-end="' + last.hold + '">'
      + '<svg viewBox="0 0 1000 200" preserveAspectRatio="none" role="img" aria-label="' + esc(COPY.strategy + ' ' + money(last.strategy, true) + ', ' + COPY.hold + ' ' + money(last.hold, true)) + '">'
      + '<polyline class="g4-line-hold" points="' + line('hold') + '"/><polyline class="g4-line-strategy" points="' + line('strategy') + '"/></svg>'
      + '<figcaption><span><i class="g4-key"></i>' + COPY.strategy  + '</span><span><i class="g4-key dashed"></i>' + COPY.hold  + '</span></figcaption></figure>';
  }
  function proof(s, compact) {
    var r = D.results(s, 0), y = D.results(s, 365), difference = Math.round(r.final) - Math.round(r.benchFinal);
    return '<div class="g4-proof' + (compact ? ' compact' : '') + '"><div class="g4-money-row"><h1 id="g4-title">' + COPY.ifInvested + '<strong class="g4-amount">' + money(r.final) + '</strong></h1>'
      + '<div class="g4-comparison"><p>그냥 들고 있었다면 ' + money(r.benchFinal) + '</p><p><span>전체 기간 ' + date(r.i0) + '부터</span>'
      + (!compact ? '<span><span class="' + (difference >= 0 ? 'up' : 'down') + '">' + (difference >= 0 ? '+' : '') + money(difference) + '</span> ' + (difference >= 0 ? '더 벌었습니다.' : '적습니다.') + '</span>' : '') + '</p></div></div>'
      + curve(s, null, compact) + (!compact ? '<p class="g4-period">최근 1년 ' + money(y.final) + ', 그냥 들고 있었다면 ' + money(y.benchFinal) + '</p>' : '') + '</div>';
  }
  function running(s, row) {
    var waiting = row && !D.hasFill(row);
    return '<div class="g4-now">' + (waiting ? '<span class="g4-running g4-waiting">' + bars() + COPY.running + ', ' + esc(D.pos(s, row)) + '</span>' : (!row ? '<span class="g4-running">' + bars() + COPY.running + '</span>' : '') + '<span>' + esc(D.pos(s, row)) + '</span>') + (row && !D.hasFill(row) ? '<span class="g4-next">다음 판단 ' + esc(tbNextClose()) + '</span>' : '') + (!row ? '<span class="g4-followers">' + s.fw.toLocaleString() + '명이 따라가는 중</span><span class="g4-next">다음 판단 ' + esc(tbNextClose()) + '</span>' : '') + '</div>';
  }
  function records(s) {
    var messages = mkChatMsgs(s, s.r, 6).filter(function (m) { return m.k !== 'now' && m.k !== 'intro'; });
    return messages.map(function (m, i) {
      var t = tidy(m.t), split = tbSent(t, 2);
      return '<li' + (i ? ' class="g4-record-extra" hidden' : '') + '><details><summary><time>' + esc(m.ts) + '</time><span class="g4-record-text">' + esc(split.head) + '</span><span class="g4-record-tag">' + esc(m.tag) + '</span></summary>'
        + (split.rest ? '<p>' + esc(split.rest) + '</p>' : '') + '</details></li>';
    }).join('') || '<li>아직 판단 기록이 없습니다.</li>';
  }
  function render() {
    if (!window.TF_STATE_READY) return;
    var owned = D.mine(), row = owned.find(function (x) { return x.c.id === selectedCopy; }) || owned[0], connected = !row ? D.linked() : [];
    var f = row ? { s: row.s, all: D.results(row.s, 0) } : D.face(connected.length ? connected : null);
    // A connected exchange with no eligible held strategy keeps the list, not another exchange's face.
    if (!f) { showList(); return; }
    var s = f.s, isLinked = !row && connected.length > 0, multiple = owned.length > 1;
    if (row) { selectedCopy = row.c.id; sessionStorage.setItem('g4.t1.selectedCopy', selectedCopy); }
    tfPageMode('nfmain', 'AI 트레이딩');
    TF_ONNF = true; TF_ONSHARE = false; TF_ONSTRAT = false;
    var choose = '';
    if (multiple) {
      var total = owned.reduce(function (v, x) { return v + x.d.value; }, 0), pnl = owned.reduce(function (v, x) { return v + x.d.total; }, 0);
      choose = '<section class="g4-portfolio" aria-label="전체 복사 자산"><span>합계 내 자산</span><div><strong>' + money(total, true) + '</strong><span class="' + (pnl >= 0 ? 'up' : 'down') + '">' + signed(pnl) + '</span></div><div class="g4-pills" aria-label="복사한 전략 선택">'
        + owned.map(function (x) { return '<button type="button" aria-pressed="' + (x === row) + '" data-copy-id="' + esc(x.c.id) + '" onclick="G4T1.selectCopy(this.dataset.copyId)"><span>' + esc(mkTitle(x.s)) + '</span><strong>' + money(x.d.value, true) + '</strong></button>'; }).join('') + '</div></section>';
    }
    var action = '<div class="g4-actions"><button class="g4-primary" type="button" onclick="G4T1.primary()">' + (row ? '예산 조정' : isLinked ? '이 전략 복사하기' : '이 전략 보기') + '</button>'
      + (!row ? '<p class="g4-free">' + COPY.free + '</p>' : '<nav class="g4-secondary"><a href="#/trade/chart">차트 보기</a><button type="button" onclick="G4T1.stop()">복사 중단</button></nav>') + '</div>';
    var body = '<main class="g4-trade ' + (row ? 'g4-owned' + (multiple ? ' g4-multiple' : '') : isLinked ? 'g4-linked' : 'g4-first') + (!arrived ? ' g4-arrive' : '') + '" lang="ko">' + choose
      + '<p class="g4-usp">' + (row ? bars() + COPY.managed : isLinked ? esc(acName(D.exchange(s))) + COPY.linked : COPY.usp) + '</p>'
      + (isLinked ? '<h1 class="g4-start">' + COPY.start + '</h1>' : '')
      + '<section class="g4-money" aria-label="' + esc(mkTitle(s)) + '"><div class="g4-strategy">' + mkGlyph(s, 36)
      + '<div><span>' + esc(mkTitle(s)) + '</span><small>' + esc(MK_KIND[s.kind]) + '</small></div>' + mkExTag(s) + '</div>'
      + (row ? '<h1 id="g4-title">내 자산<strong class="g4-amount">' + money(row.d.value, true) + '</strong></h1>' + (D.hasFill(row) ? '<p class="g4-profit ' + (row.d.total >= 0 ? 'up' : 'down') + '">' + signed(row.d.total) + ' (' + mkPct0(row.d.myPct * 100, 1) + ')</p>' : '') + '<p class="g4-invested">' + COPY.invested + money(row.d.inv, true) + '</p>' + (D.hasFill(row) ? curve(s, row, false) : '') : proof(s, false))
      + running(s, row) + (row || isLinked ? action : '') + '</section>'
      + '<section class="g4-history" aria-labelledby="g4-history-title"><div class="g4-section-head"><h2 id="g4-history-title">' + COPY.records + '</h2><button type="button" aria-expanded="false" onclick="G4T1.toggleRecords(this)">판단 기록 보기</button></div><ol>' + records(s) + '</ol></section>'
      + (!row && !isLinked ? action : '')
      + '<nav class="g4-links" aria-label="더 둘러보기"><a href="' + listRoute + '">' + (isLinked ? '다른 ' : '전체 ') + (tfSSRows().filter(function (x) { return !x.me; }).length - (isLinked ? 1 : 0)) + '개 전략 둘러보기 →</a></nav>'
      + '<p class="g4-help">막히면 상담원이 24시간 답합니다. <button type="button" onclick="tethHelpOpen()">상담원에게 묻기</button></p></main>';
    G4T1.current = { strategyId: s.id, copyId: row ? row.c.id : null, linked: !!isLinked };
    TF_RENDERING = true;
    try { gContent(body); } finally { TF_RENDERING = false; }
    document.body.classList.add('g4-main');
    document.documentElement.classList.remove('g4-entry');
    window.G4_T1_READY = true;
    lastLocation = location.href;
    arrived = true;
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
    document.documentElement.classList.remove('g4-entry');
    if (h === '#/trade/chart') {
      var previewBefore = window.TF_PREVIEW;
      window.TF_PREVIEW = !S.user;
      if (G4T1.current && G4T1.current.copyId) {
        var copies = cpState().copies.filter(function (x) { return x.status === 'active' && tfSSFind(x.nick); });
        TB_CP = Math.max(0, copies.findIndex(function (x) { return x.id === G4T1.current.copyId; }));
      }
      chartRendering = true;
      if (G4T1.current && G4T1.current.copyId) { TF_TM.sel = null; MKT.picked = false; }
      try { oldDash(); mktRefNote(); } finally { window.TF_PREVIEW = previewBefore; chartRendering = false; }
      // The legacy terminal normalizes its URL to /trade; keep T1's nested route.
      if ($('nfxh-wrap')) history.replaceState(null, '', location.pathname + location.search + h);
      var chart = document.querySelector('#g-content');
      if (chart && !chart.querySelector('.g4-back')) chart.insertAdjacentHTML('afterbegin', '<a class="g4-back g4-chart-back" href="#/trade">← AI 트레이딩</a>');
      return true;
    }
    return oldNF(h);
  };
  // Legacy mktStratSym returns the first copy before checking TB_CP. This route follows the chosen copy.
  var oldMarketSymbol = mktStratSym;
  mktStratSym = function () {
    if ((chartRendering || location.hash === '#/trade/chart') && G4T1.current && G4T1.current.copyId) {
      var row = D.mine().find(function (x) { return x.c.id === G4T1.current.copyId; });
      if (row) {
        var positions = D.held(row.s), key = positions.length ? positions[0].k : mkUni(row.s).list[0];
        var symbol = key ? String(mkTk(key)).toUpperCase() + 'USDT' : '';
        if (/^[A-Z0-9]+USDT$/.test(symbol)) return symbol;
      }
    }
    return oldMarketSymbol.apply(this, arguments);
  };
  var oldCopyBlock = tbCopyBlock;
  tbCopyBlock = function (copy) {
    var html = oldCopyBlock.apply(this, arguments), s = tfSSFind(copy.nick);
    if (!s || D.hasFill({c: copy, s: s, d: cpCalc(copy)})) return html;
    var box = document.createElement('template'); box.innerHTML = html;
    var title = box.content.querySelector('.tb-t'); if (title) title.textContent = '다음 진입을 기다리는 중';
    box.content.querySelectorAll('.tb-list, .tb-th').forEach(function (el) { el.remove(); });
    return box.innerHTML;
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
  function rawAmount(value) { return String(value == null ? '' : value).replace(/,/g, ''); }
  function formatAmount(input) {
    if (!input) return;
    input.type = 'text'; input.inputMode = 'decimal';
    var value = input.value, raw = rawAmount(value);
    if (!/^\d*(?:\.\d*)?$/.test(raw)) return;
    var caret = input.selectionStart, before = caret == null ? null : rawAmount(value.slice(0, caret)).length;
    var parts = raw.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); input.value = parts.join('.');
    if (document.activeElement === input && before != null) {
      var pos = 0, n = 0; while (pos < input.value.length && n < before) { if (input.value[pos] !== ',') n++; pos++; }
      input.setSelectionRange(pos, pos);
    }
  }
  function captureBudget() {
    var el = $('cps-amt'), o = D.handoff();
    if (el && o) D.save(o.strategyId, el.value === '' ? null : Number(rawAmount(el.value)));
  }
  function copyReady(s) {
    var d = tfDerive(), ex = D.exchange(s);
    return !!(S.user && d.entitlement && d.entitlement.follow && acReady(ex));
  }
  function budgetSync() {
    var input = $('g4-budget'), o = D.handoff(), button = $('g4-budget-next');
    if (!input || !o) return false;
    var strategy = tfSSFind(o.strategyId), amount = Number(rawAmount(input.value));
    var valid = !!(strategy && input.value.trim() && Number.isFinite(amount) && amount >= mkMin(strategy));
    D.save(o.strategyId, input.value.trim() && Number.isFinite(amount) && amount > 0 ? amount : null);
    if (button) button.disabled = !valid;
    var error = $('g4-budget-error');
    if (error) error.textContent = input.value && !valid && strategy ? '최소 ' + money(mkMin(strategy)) + '부터 시작할 수 있습니다' : '';
    formatAmount(input);
    return valid;
  }
  function budgetSheet(s, o) {
    mkFollowClose(true);
    tfSS3Dlg('전략 복사', '<form class="g4-budget-form" onsubmit="G4T1.connectBudget(event)">'
      + '<p class="g4-budget-strategy">' + esc(mkTitle(s)) + ' (' + esc(acName(D.exchange(s))) + '에서 실행)</p>'
      + '<p class="g4-budget-now">' + bars() + esc(D.pos(s)) + '</p>' + proof(s, true)
      + '<label for="g4-budget">복사 예산</label><div class="g4-budget-input"><span>$</span>'
      + '<input id="g4-budget" type="text" inputmode="decimal" min="' + mkMin(s) + '" step="any" required'
      + ' aria-describedby="g4-budget-min g4-budget-error" oninput="G4T1.budgetSync()" value="' + (o && o.budget != null ? esc(o.budget) : '') + '"></div>'
      + '<p id="g4-budget-min">최소 ' + money(mkMin(s)) + '</p>'
      + '<p id="g4-budget-error" role="status"></p>'
      + '<button id="g4-budget-next" type="submit" class="g4-primary" disabled>거래소 연결</button></form>');
    $('ss3-dlgw').classList.add('g4-budget-dialog');
    budgetSync();
    armOverlay();
    if (innerWidth > 760) $('g4-budget').focus();
  }
  function connectBudget(event) {
    if (event) event.preventDefault();
    if (!budgetSync()) return;
    var o = D.handoff(), s = tfSSFind(o.strategyId);
    tfSS3DlgClose(true);
    acStart({ need: D.exchange(s), name: mkHook(s),
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
    // S8: a newly started copy always waits for the next entry.
    var startOptions = $('mk-f-ex');
    if (startOptions) {
      TF_MKF.existing = 'skip';
      var nextEntry = startOptions.querySelector('button');
      if (nextEntry) { nextEntry.disabled = true; nextEntry.setAttribute('aria-checked', 'true'); }
      startOptions.querySelectorAll('button').forEach(function (button, i) { if (i) button.remove(); });
    }
    if (inp && o) {
      var available = Math.floor(cpState().spot * 100) / 100, adjusted = o.budget != null && o.budget > available;
      inp.value = o.budget == null ? '' : adjusted ? available : o.budget;
      cpFormSync();
      if (adjusted) adjustedNotice();
    }
    if ($('mk-follow')) armOverlay();
    return v;
  };
  var oldSync = cpFormSync;
  function adjustedNotice() {
    var field = $('cps-amt-fld');
    if (field && !field.querySelector('.g4-budget-adjusted')) field.insertAdjacentHTML('beforeend', '<p class="g4-budget-adjusted" role="status">사용 가능 금액으로 맞췄습니다</p>');
  }
  cpFormSync = function () {
    var input = $('cps-amt'), available = Math.floor(cpState().spot * 100) / 100;
    if (input && Number(rawAmount(input.value)) > available) { input.value = available; adjustedNotice(); }
    captureBudget(); var v = oldSync.apply(this, arguments); formatAmount(input); return v;
  };
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
    } else if (S.user && location.hash === '#/trade') { setTimeout(function () { if (location.hash === '#/trade' && !$('ss3-dlgw') && !$('mk-follow')) render(); }, 0); }
    return v;
  };
  var oldAdjustSync = cpAdjSync;
  cpAdjSync = function () { var v = oldAdjustSync.apply(this, arguments); formatAmount($('cpa-amt')); return v; };
  var oldAdjRender = cpAdjRender, oldStopDialog = mkStopDlg, oldToast = toast;
  cpAdjRender = function (cid) {
    var v = oldAdjRender.apply(this, arguments), dialog = $('ss3-dlgw'), c = cpFind(cid);
    if (dialog && c) {
      dialog.classList.add('g4-manage-dialog');
      var d = cpCalc(c), line = dialog.querySelector('.cpa-pnl');
      if (line) line.textContent = '내 수익률 ' + mkPct0(d.myPct * 100, 1) + ', 원본 전략 수익률 ' + mkPct0(d.pnlPct * 100, 1) + '입니다.';
      if ($('cpa-go')) $('cpa-go').textContent = '예산 변경 완료';
      formatAmount($('cpa-amt'));
      var tabs = dialog.querySelectorAll('.cpa-tgl button'); if (tabs[1]) tabs[1].textContent = '예산 회수';
      armOverlay();
    }
    return v;
  };
  mkStopDlg = function (cid) {
    var v = oldStopDialog.apply(this, arguments), dialog = $('ss3-dlgw');
    if (!dialog) return v;
    dialog.classList.add('g4-manage-dialog');
    var copy = cpFind(cid), amounts = dialog.querySelector('.cpd-kv');
    if (copy && amounts) {
      var d = cpCalc(copy);
      amounts.textContent = '순손익 ' + signed(d.net) + ', 돌려받을 예산 ' + money(Math.max(0, d.est), true);
      amounts.className = 'g4-stop-amounts';
    }
    var modes = ['now', 'wait', 'manual'], selected = 'now', options = dialog.querySelectorAll('.mk-stop-o');
    options.forEach(function (button, i) {
      button.removeAttribute('onclick'); button.setAttribute('aria-pressed', String(i === 0));
      if (i === 0) button.querySelector('b').textContent = '지금 정리 (시장가 청산)';
      button.onclick = function () { selected = modes[i]; options.forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); }); };
    });
    var confirm = document.createElement('button'); confirm.type = 'button'; confirm.className = 'wbtn'; confirm.id = 'g4-stop-confirm'; confirm.textContent = '복사 중단 확정';
    confirm.onclick = function () { mkStopGo(cid, selected); };
    dialog.querySelector('.acts3').prepend(confirm);
    dialog.querySelector('.acts3 .obtn').textContent = '전략 복사 계속';
    armOverlay();
    return v;
  };
  toast = function (message) {
    if (!document.body.classList.contains('g4-main') && !/전략 복사를 시작했습니다\.$/.test(message)) return oldToast.apply(this, arguments);
    var legacy = $('toast');
    if (legacy) { clearTimeout(legacy._h); legacy._q = []; legacy.classList.remove('show'); legacy.textContent = ''; }
    var node = $('g4-notice');
    if (!node) { node = document.createElement('div'); node.id = 'g4-notice'; node.setAttribute('role', 'status'); document.body.appendChild(node); }
    clearTimeout(node._h); node.textContent = message;
    node._h = setTimeout(function () { node.remove(); }, 2000);
  };
  var lastLocation = location.href, dismissedLocation = null, closingFromBack = false;
  function overlayOpen() { return document.querySelector('.g4-manage-dialog, .g4-budget-dialog, #mk-follow'); }
  function armOverlay() {
    var state = history.state || {}, next = Object.assign({}, state, {g4Overlay: true, g4ClosedOverlay: false});
    if (state.g4Overlay || state.g4ClosedOverlay) history.replaceState(next, '', location.href);
    else history.pushState(next, '', location.href);
    lastLocation = location.href;
    dismissedLocation = null;
  }
  function dismissOverlay() {
    if (!closingFromBack && history.state && history.state.g4Overlay) {
      dismissedLocation = location.href;
      history.replaceState(Object.assign({}, history.state, {g4Overlay: false, g4ClosedOverlay: true}), '', location.href);
    }
  }
  var oldDialogClose = tfSS3DlgClose, oldFollowClose = mkFollowClose;
  tfSS3DlgClose = function () { if (document.querySelector('.g4-manage-dialog, .g4-budget-dialog')) dismissOverlay(); return oldDialogClose.apply(this, arguments); };
  mkFollowClose = function () { if ($('mk-follow')) dismissOverlay(); return oldFollowClose.apply(this, arguments); };
  window.addEventListener('popstate', function () {
    var same = lastLocation === location.href;
    if (overlayOpen()) {
      dismissedLocation = null;
      closingFromBack = true;
      try { oldDialogClose(true); oldFollowClose(true); } finally { closingFromBack = false; }
      lastLocation = location.href;
      return;
    }
    // Skip adjacent copies of the same summary or dismissed-sheet location.
    if (same && (location.hash === '#/trade' || dismissedLocation === location.href || (history.state && (history.state.g4Overlay || history.state.g4ClosedOverlay)))) {
      history.back(); return;
    }
    lastLocation = location.href;
  });
  window.addEventListener('hashchange', function () { lastLocation = location.href; });
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
      if (c.linked) { D.save(c.strategyId, 1000); mkFollowSheet(c.strategyId); return; } D.save(c.strategyId); tfSS3Go(encodeURIComponent(c.strategyId), 'all', 'ov');
    },
    stop: function () {
      var c = G4T1.current;
      if (c && c.copyId) cpCloseDlg(c.copyId);
    },
    toggleRecords: function (button) {
      var expand = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expand)); button.textContent = expand ? '판단 기록 접기' : '판단 기록 보기';
      document.querySelectorAll('.g4-record-extra').forEach(function (el) { el.hidden = !expand; });
      if (expand) document.querySelector('.g4-history').scrollIntoView({ block: 'start', behavior: 'auto' });
    },
    selectCopy: function (id) { selectedCopy = id; sessionStorage.setItem('g4.t1.selectedCopy', id); render(); }
  };
  if (/^#\/trade(?:\/|$)/.test(location.hash) && window.TF_STATE_READY) tfRoute();
})();
