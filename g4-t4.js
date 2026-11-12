/* G4 T4 직접 검증 = 같은 $1,000 이 다시 굴러 상세와 같은 끝 값에 닿는다. 뼈대 claude 스케치 3985a84, 통합 g4-T4-int.
   계약 sprint/G4/T4/sketch/claude/flow-contract.md, 결정 sprint/G4/T4/decision-1.md ①~⑥, decision.md J1~J14.
   숫자는 앱 계산값만: 끝 값 F = round(btCompute(per, $1,000).final) = T3 큰 돈, 그냥 들고 있었다면 H = round(benchFinal),
   굴리는 잔고 v(j) = round(1000 × eq[j].v). F 는 0초부터 그대로 보이고(T2 R1: 본 숫자는 다시 세지 않는다), 굴리는 것은 아래 잔고 한 줄과 곡선뿐.
   준비 화면, 기간·금액 알약, 시작 단추, 게스트 가입 관문은 없다. 가입은 맡기는 순간(T5 진입점)에만. */
(function () {
  'use strict';
  if (typeof btView !== 'function' || typeof btRoute !== 'function') return;
  var D = window.G4T1Data, HANDOFF = 'g4.t1.handoff', SEEN = 'g4.t4.seen', FROM = 'g4.t4.from', PER = 'g4.t4.per';
  /* J5: 누른 순간부터 착지까지 3.5초(공개, 내 전략, 주소 직행 모두). 주소 직행은 주소를 연 순간(문서 시작)부터 센다 */
  var TOTAL = 3500, DELAY = 120, MIN_ROLL = 1500, W = 1000, H = 300;
  var raf = 0, roll = null, MODE = 'main', V = null, clickAt = 0, booted = false; /* V: 지금 화면의 숫자 묶음 */
  var prevView = btView, prevRoute = btRoute, prevContent = gContent;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function read(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function write(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function usd(v) { return '$' + Math.round(Math.abs(v)).toLocaleString('en-US'); }
  function sUsd(v) { var n = Math.round(v); return (n < 0 ? '-' : '+') + '$' + Math.abs(n).toLocaleString('en-US'); }
  function pct(v) { return (v < 0 ? '-' : '+') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  function ymd(i) { var d = String(mkDate(i)).split('.'); return [+d[0], +d[1], +d[2]]; }
  function dList(i) { var d = ymd(i); return d[0] + '. ' + d[1] + '. ' + d[2] + '.'; }
  function dSent(i) { var d = ymd(i); return d[0] + '년 ' + d[1] + '월 ' + d[2] + '일'; }
  function ne() { return tfSS3Rid(BT.s); }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function seenKey() { return BT.s.id + ':' + BT.per + ':' + BT.amt + ':' + PRICE0.length; }
  function seen() { var m = read(SEEN) || {}; return !!m[seenKey()]; }
  function markSeen() { var m = read(SEEN) || {}; m[seenKey()] = 1; write(SEEN, m); }
  function copyRow(s) { try { return D.mine().find(function (x) { return x.s.id === s.id; }) || null; } catch (_) { return null; } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; roll = null; }

  /* ── 들어오기: 「직접 검증하기」는 가입 없이 곧장 이 화면 ── */
  btOpen = function (n) { clickAt = performance.now(); write(FROM, location.hash); location.hash = '#/share/bt/' + n; };
  if (typeof tfVerifyGo === 'function') { var verifyGo = tfVerifyGo; tfVerifyGo = function () { clickAt = performance.now(); return verifyGo.apply(this, arguments); }; }
  /* J13: 백테스트 주소로 곧장 오면 index.html 머리가 본문을 가린다(html.g4-bt-wait). 이 화면을 그리거나 다른 주소로 가면 푼다 */
  function reveal() { document.documentElement.classList.remove('g4-bt-wait'); }
  addEventListener('hashchange', function () { if (!/^#\/share\/bt\//.test(location.hash)) reveal(); });

  btRoute = function (h) {
    var m = h.match(/^#\/share\/bt\/([^/]+)(?:\/(go|all))?$/);
    if (!m) return prevRoute.apply(this, arguments);
    MODE = m[2] === 'all' ? 'all' : 'main';
    if (m[2] === 'go' || S.user || m[1] === 'mine') { if (m[2] === 'go') stop(); var rv = prevRoute.call(this, m[2] === 'go' ? h : '#/share/bt/' + m[1]); if (window.TF_STATE_READY) setTimeout(reveal, 0); return rv; }
    /* 처음 온 사람: 지금 앱은 여기서 상세 + 가입 창으로 보낸다(M1). 이 스케치는 화면을 그대로 연다 */
    TF_ONSHARE = true;
    if (!window.TF_STATE_READY) { TF_ONSHARE = false; return; }
    var s = null; try { s = tfSSFind(decodeURIComponent(m[1])); } catch (_) {}
    if (!s || !s.cfg) { TF_ONSHARE = false; reveal(); tfShareHub('find'); return; }
    if (BT.id !== s.id) { btStop(); BT.id = s.id; BT.s = s; BT.R = null; BT.phase = 'ready'; BT.sel = null; BT.grp = null; BT.filt = null; BT.trf = 'all'; BT.decN = 8; BT.ordN = 8; }
    BT.s = s; btView(); /* 재생 멈춤은 viewMain 이 정한다(같은 화면 다시 그리기면 그대로 둠) */
  };

  /* T3 I5 인계(기간, $1,000)를 받는다. 없으면 이 탭에서 마지막으로 본 기간, 그것도 없으면 전체(T3 기본) */
  function takeHandoff() {
    var h = read('g4.t3.verify');
    if (h && BT.s && h.strategyId === BT.s.id) { BT.per = Number.isFinite(+h.per) ? +h.per : 0; write('g4.t3.verify', null); write(PER + '.' + BT.s.id, BT.per); }
    else if (!BT.s.mine) { var p = read(PER + '.' + BT.s.id); BT.per = p == null ? 0 : p; }
    BT.amt = 1000; BT.R = null;
  }

  btView = function () {
    if (!BT.s) return prevView.apply(this, arguments);
    takeHandoff();
    if (MODE === 'all') return viewAll();
    return viewMain();
  };

  /* ── 숫자 묶음 ── */
  function numbers() {
    var s = BT.s, R = btCompute(), N = R.N, amt = BT.amt;
    var F = Math.round(R.final), Hd = Math.round(R.benchFinal);
    var ret = BT.per === 0 && s.r && Number.isFinite(s.r.ret) ? s.r.ret : (R.final / amt - 1) * 100;
    var lo = amt, hi = amt;
    for (var j = 0; j < N; j++) { var a = amt * R.eq[j].v, b = amt * R.bench[j]; if (a < lo) lo = a; if (b < lo) lo = b; if (a > hi) hi = a; if (b > hi) hi = b; }
    var closed = R.tr.filter(function (t) { return !t.open && t.x != null; });
    var wins = closed.filter(function (t) { return t.pnl > 0; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var big = (wins.length ? wins : closed.slice().sort(function (a, b) { return Math.abs(b.pnl) - Math.abs(a.pnl); })).slice(0, 3)
      .map(function (t) { return { j: Math.max(0, Math.min(N - 1, t.x - R.i0)), t: t }; }).sort(function (a, b) { return a.j - b.j; });
    return { s: s, per: BT.per, R: R, N: N, amt: amt, F: F, H: Hd, diff: F - Hd, ret: ret, lo: lo, hi: hi, big: big, trades: R.tr.length, mine: !!s.mine };
  }
  function X(j) { return V.N > 1 ? j / (V.N - 1) * W : 0; }
  function Y(v) { var r = V.hi - V.lo || 1; return H - 6 - (v - V.lo) / r * (H - 12); }
  function path(get) { var d = ''; for (var j = 0; j < V.N; j++) d += (j ? 'L' : 'M') + X(j).toFixed(1) + ' ' + Y(get(j)).toFixed(1); return d; }
  function tradeText(t) {
    var tk = mkTk(t.a), act = t.side === -1 ? '숏 청산' : t.side === 1 && V.s.cfg && V.s.cfg.fut ? '롱 청산' : '매도';
    return { d: dList(V.R.eq[0].i + (t.x - V.R.i0)), a: tk + ' ' + act, p: pct(t.pnl) };
  }

  /* ── 그리기 ── */
  function exLine(s) {
    if (s.mine) return '<div class="t4-ex"><span>내 전략</span></div>';
    var e = mkEx(s), fut = !!(s.cfg && s.cfg.fut), off = window.G4T3 ? G4T3.T(fut ? 'official' : 'officialSpot', { ex: e[1] }) : e[1];
    var fol = window.G4T3 ? G4T3.T('follow', { count: Number(s.fw || 0).toLocaleString('en-US') }) : '';
    return '<div class="t4-ex"><img src="assets/logos/' + esc(e[0]) + '.png" alt="" width="20" height="20"><span>' + esc(off) + '</span>' + (fol ? '<i aria-hidden="true">|</i><span>' + esc(fol) + '</span>' : '') + '</div>';
  }
  function primaryLabel() { if (V.mine) return '$1,000으로 실행하기'; return copyRow(V.s) ? '예산 조정' : usd(V.amt) + '으로 복사하기'; }
  function free() { return S.user ? '' : '<p class="t4-free">영원히 무료, 카드 등록 필요없음</p>'; }
  function allLabel() { return '거래 ' + V.trades.toLocaleString('en-US') + '건 모두 보기'; }
  function card() {
    var e = V.mine ? null : mkEx(V.s);
    return '<aside class="t4-card" id="t4-card"><h2>' + (V.mine ? '이 전략 실행' : '이 전략 복사') + '</h2>'
      + '<p class="t4-card-sub">' + usd(V.amt) + ' 넣었다면 지금</p><b class="t4-card-num">' + usd(V.F) + '</b>'
      + (e ? '<div class="t4-ex t4-ex-sm"><img src="assets/logos/' + esc(e[0]) + '.png" alt="" width="18" height="18"><span>' + esc(window.G4T3 ? G4T3.T(V.s.cfg && V.s.cfg.fut ? 'official' : 'officialSpot', { ex: e[1] }) : e[1]) + '</span></div>' : '')
      + '<button type="button" class="bt-cta t4-primary" onclick="G4T4.copy()">' + esc(primaryLabel()) + '</button>' + free()
      + '<div class="t4-card-links"><button type="button" class="t4-link" onclick="G4T4.all()">' + esc(allLabel()) + '</button>'
      + (V.mine ? '<button type="button" class="t4-link" onclick="rvFix()">규칙 수정하기</button><button type="button" class="t4-link" onclick="rvChat()">대화로 돌아가기</button>' : '') + '</div></aside>';
  }
  function bar() {
    return '<div class="t4-bar" id="t4-bar"><div class="t4-bar-top"><span>' + usd(V.amt) + ' 넣었다면 지금</span><b>' + usd(V.F) + '</b></div>'
      + '<button type="button" class="bt-cta t4-primary" onclick="G4T4.copy()">' + esc(primaryLabel()) + '</button>' + free() + '</div>';
  }
  function page() {
    var s = V.s, R = V.R, e0 = R.eq[0].i, up = V.ret >= 0;
    var holdD = path(function (j) { return V.amt * R.bench[j]; }), eqD = path(function (j) { return V.amt * R.eq[j].v; });
    var base = Y(V.amt).toFixed(1);
    var mk = V.big.map(function (b, k) { return '<i class="t4-mk' + (b.t.pnl < 0 ? ' dn' : '') + '" id="t4-mk' + k + '" style="left:' + (X(b.j) / W * 100).toFixed(2) + '%;top:' + (Y(V.amt * R.eq[b.j].v) / H * 100).toFixed(2) + '%"></i>'; }).join('');
    /* 끝 값 꼬리표 둘이 겹치면(값이 가까우면) 위아래로 벌린다. 간격 18% */
    var ts = Y(V.F) / H * 100, th = Y(V.H) / H * 100, gap = 18;
    if (Math.abs(ts - th) < gap) { var mid = (ts + th) / 2, sAbove = ts <= th; ts = mid + (sAbove ? -gap / 2 : gap / 2); th = mid + (sAbove ? gap / 2 : -gap / 2); } /* J12: 이름이 수익률 색 변수(up)를 덮어 손실이 초록으로 보였다 */
    var tags = '<div class="t4-tag t4-tag-s" style="top:' + ts.toFixed(2) + '%"><small>전략</small><b>' + usd(V.F) + '</b></div>'
      + '<div class="t4-tag t4-tag-h" style="top:' + th.toFixed(2) + '%"><small>그냥 들고 있었다면</small><b>' + usd(V.H) + '</b></div>';
    return '<div class="t4" id="bt-root" data-phase="run" data-kind="' + esc(s.kind) + '">'
      + '<div class="t4-layout"><div class="t4-main">'
      + '<button type="button" class="t4-link bk t4-back" onclick="G4T4.back()">' + (s.mine ? '← 대화로' : '← 전략 상세') + '</button>'
      + '<h1 class="t4-name">' + esc(mkHook(s)) + '</h1>' + exLine(s)
      + '<p class="t4-sub">' + usd(V.amt) + ' 넣었다면 지금</p>'
      + '<div class="t4-money"><b class="t4-final num">' + usd(V.F) + '</b><span class="num ' + (up ? 'up' : 'dn') + '">' + pct(V.ret) + '</span></div>'
      + '<p class="t4-since">' + esc(dSent(e0)) + '부터 지금까지</p>'
      + '<div class="t4-replay" id="t4-replay"></div>'
      + '<div class="t4-plot" id="t4-chart" onclick="G4T4.skip()" role="img" aria-label="' + esc(usd(V.amt) + '이 ' + usd(V.F) + '까지 간 곡선') + '">'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="t4-clip"><rect id="t4-clip-r" x="0" y="0" width="0" height="' + H + '"/></clipPath></defs>'
      + '<line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" class="t4-base"/>'
      + '<path d="' + holdD + '" class="t4-hold"/><g clip-path="url(#t4-clip)"><path d="' + eqD + '" class="t4-eq"/></g></svg>' /* J7: 그냥 들고 있기 점선은 0초부터 전체 */
      + mk + '<i class="t4-dot" id="t4-dot"></i>' + tags + '</div>'
      /* J14: 1440 은 곡선이 본문 칸 폭을 다 쓰고, 끝 값은 곡선 오른쪽 꼬리표 대신 곡선 아래 한 줄(390 은 꼬리표 그대로) */
      + '<div class="t4-keys"><span class="t4-key-s"><i aria-hidden="true"></i>전략 <b class="num">' + usd(V.F) + '</b></span><span class="t4-key-h"><i aria-hidden="true"></i>그냥 들고 있었다면 <b class="num">' + usd(V.H) + '</b></span></div>'
      + '<ol class="t4-trades" id="t4-trades"></ol>'
      + '<div class="t4-more"><button type="button" class="t4-link" onclick="G4T4.all()">' + esc(allLabel()) + '</button>'
      + (V.mine ? '<button type="button" class="t4-link" onclick="rvFix()">규칙 수정하기</button><button type="button" class="t4-link" onclick="rvChat()">대화로 돌아가기</button>' : '') + '</div>'
      + '</div>' + card() + '</div>' + bar() + '</div>';
  }
  function replayRun() {
    return '<p class="t4-prog">하루씩 다시 굴리는 중 <span id="t4-day">0</span> / ' + V.N.toLocaleString('en-US') + '일</p>'
      + '<p class="t4-roll"><span id="t4-date">' + esc(dList(V.R.eq[0].i)) + '</span><b class="num" id="t4-bal">' + usd(V.amt) + '</b></p>'
      + '<button type="button" class="t4-link bt-skip" onclick="G4T4.skip()">결과 바로 보기</button>';
  }
  function replayDone() {
    var cmp;
    if (V.diff > 0 && V.F >= V.amt) cmp = '그냥 들고 있었다면 ' + usd(V.H) + ' (차이 <span class="up">' + sUsd(V.diff) + '</span> 더 벌었습니다)';
    else if (V.diff > 0) cmp = '그냥 들고 있었다면 ' + usd(V.H) + ' (차이 ' + usd(V.diff) + ' 덜 잃었습니다)';
    else cmp = '그냥 들고 있었다면 ' + usd(V.H);
    return '<p class="t4-ok">' + V.N.toLocaleString('en-US') + '일을 하루씩 다시 굴려도 <b class="num">' + usd(V.F) + '</b>입니다</p><p class="t4-cmp">' + cmp + '</p>';
  }

  function paint(j) {
    var R = V.R, r = $('t4-clip-r'), dot = $('t4-dot'); if (!r) return;
    r.setAttribute('width', (X(j) + 1).toFixed(1));
    var v = V.amt * R.eq[j].v;
    if (dot) { dot.style.left = (X(j) / W * 100).toFixed(2) + '%'; dot.style.top = (Y(v) / H * 100).toFixed(2) + '%'; }
    var d = $('t4-day'), dt = $('t4-date'), b = $('t4-bal');
    if (d) d.textContent = (j + 1).toLocaleString('en-US');
    if (dt) dt.textContent = dList(R.eq[j].i);
    if (b) { b.textContent = usd(v); b.className = 'num ' + (v >= V.amt ? 'up' : 'dn'); }
    var ol = $('t4-trades');
    V.big.forEach(function (x, k) {
      if (x.j > j || x.shown) return; x.shown = 1;
      var m = $('t4-mk' + k); if (m) m.classList.add('on');
      var t = tradeText(x.t);
      if (ol) ol.insertAdjacentHTML('beforeend', '<li class="t4-tr"><span>' + esc(t.d) + '</span><span>' + esc(t.a) + '</span><b class="num ' + (x.t.pnl >= 0 ? 'up' : 'dn') + '">' + esc(t.p) + '</b></li>');
    });
  }
  function land(instant) {
    stop(); if (!$('t4-replay')) return;
    paint(V.N - 1);
    var root = $('bt-root'); root.setAttribute('data-phase', 'result'); root.classList.add('landed'); if (instant) root.classList.add('still');
    $('t4-replay').innerHTML = replayDone();
    var c = $('t4-card'), b = $('t4-bar'); if (c) c.classList.add('on'); if (b) b.classList.add('on');
    BT.phase = 'result'; markSeen(); barHeight();
    try { tfTrack('bt_land', { id: BT.id, per: BT.per, instant: !!instant }); } catch (_) {}
  }
  function tick(now) {
    if (!roll || !$('t4-chart')) { raf = 0; return; }
    var e = now - roll.t0;
    if (e >= 0) { var k = Math.min(1, e / roll.dur); paint(Math.floor(k * (V.N - 1))); if (k >= 1) { land(false); return; } }
    raf = requestAnimationFrame(tick);
  }
  function barHeight() { var b = $('t4-bar'); if (b && b.offsetHeight) document.documentElement.style.setProperty('--t4-bar-h', b.offsetHeight + 'px'); }

  var lastAt = 0, lastHash = '';
  function viewMain() {
    /* J5: 부팅 라우팅이 같은 화면을 곧바로 한 번 더 그리면 재생이 처음부터 다시 시작됐다(직행 446ms, 1114ms 두 번). 같은 전략, 같은 기간, 같은 주소를 2.5초 안에 다시 그리라면 그대로 둔다 */
    var r0 = $('bt-root');
    if (r0 && r0.classList.contains('t4') && V && V.s.id === BT.s.id && V.per === BT.per && location.hash === lastHash && performance.now() - lastAt < 2500) return;
    stop();
    tfPageMode('tfbt', '백테스트');
    V = numbers();
    TF_RENDERING = true; gContent(page()); TF_RENDERING = false;
    document.body.classList.add('g4-t4'); reveal();
    requestAnimationFrame(barHeight);
    lastAt = performance.now(); lastHash = location.hash;
    var now = performance.now(), from = clickAt && now - clickAt < 2000 ? clickAt : !booted && now < 4000 ? 0 : now;
    booted = true; clickAt = 0;
    if (seen() || reduced()) { land(true); return; }
    $('t4-replay').innerHTML = replayRun(); paint(0);
    BT.phase = 'run';
    roll = { t0: now + DELAY, dur: Math.max(MIN_ROLL, from + TOTAL - now - DELAY) }; raf = requestAnimationFrame(tick);
    try { tfTrack('bt_start', { id: BT.id, per: BT.per, t4: 1 }); } catch (_) {}
    scrollTo(0, 0);
  }

  /* ── 모두 보기: 지금 결과 화면의 아래 칸(판단 기록, 거래 내역, 월별, 자세한 지표)을 다음 화면으로 ── */
  function viewAll() {
    stop();
    var t = tfS(); t.bt = t.bt || {}; t.bt.id = BT.id; t.bt.per = BT.per; t.bt.amt = BT.amt; t.bt.done = 1;
    prevView();
    V = V && V.s === BT.s ? V : numbers();
    document.body.classList.add('g4-t4', 'g4-t4-all'); reveal(); booted = true;
    var root = $('bt-root');
    if (root) root.insertAdjacentHTML('afterbegin', '<div class="t4-allhd"><button type="button" class="t4-link bk t4-back" onclick="G4T4.result()">← 결과</button><h1 class="t4-name">거래 ' + V.trades.toLocaleString('en-US') + '건</h1><p class="t4-since">' + esc(mkHook(BT.s)) + ', ' + esc(dSent(V.R.eq[0].i)) + '부터 ' + usd(V.amt) + '</p></div>');
    scrollTo(0, 0);
  }

  /* 처음 온 사람이 「$1,000으로 복사하기」 → 가입을 끝내면: 지금 앱(T1 openSaved)은 상세로 보낸다. 여기서 눌렀으면 같은 착지 화면에서 같은 시트를 연다 */
  var prevIntent = tfIntentRun;
  tfIntentRun = function () {
    var o = tfIntentPeek(), r = read('g4.t4.return');
    if (o && o.kind === 'g4copy' && S.user && r && r.id === o.id) {
      tfIntentClear(); write('g4.t4.return', null); write(PER + '.' + r.id, r.per);
      try { history.replaceState(null, '', location.pathname + location.search + '#/share/bt/' + r.ne); } catch (_) {}
      btRoute('#/share/bt/' + r.ne);
      setTimeout(function () { mkFollowSheet(r.ne); }, 0);
      return true;
    }
    return prevIntent.apply(this, arguments);
  };

  /* J12: 앱의 옛 백테스트 글자 정리(skbApply)가 같은 #bt-root 를 0.3초 뒤 고쳐 써서 제목 「RSI10 비트코인」이 「RSI10 BTC」로 바뀌었다. T4 화면은 건너뛴다(모두 보기 화면은 옛 결과 화면이라 그대로 적용) */
  if (typeof skbApply === 'function') { var skb = skbApply; skbApply = function (root) { if (root && root.classList && root.classList.contains('t4')) return; return skb.apply(this, arguments); }; }

  gContent = function () { stop(); document.body.classList.remove('g4-t4', 'g4-t4-all'); return prevContent.apply(this, arguments); };

  window.G4T4 = {
    skip: function () { if (roll) land(false); },
    copy: function () {
      if (!V) return; var s = V.s;
      if (s.mine) { btUse(); return; }
      var n = ne(), h = (D && D.save && D.save(s.id, V.amt)) || { strategyId: s.id };
      h.budget = V.amt; h.per = BT.per; h.returnTo = '#/share/bt/' + n;
      h.face = { final: V.F, bench: V.H, ret: V.ret, since: V.R.i0, pos: D && D.pos ? D.pos(s) : null };
      write(HANDOFF, h);
      try { tfTrack('bt_copy', { id: s.id, per: BT.per, budget: V.amt }); } catch (_) {}
      write('g4.t4.return', { id: s.id, ne: n, per: BT.per });
      var row = copyRow(s); if (row) { cpAdjDlg(row.c.id); return; }
      cpSetupGo(n);
    },
    all: function () { if (!BT.s) return; markSeen(); location.hash = '#/share/bt/' + ne() + '/all'; },
    result: function () { var main = '#/share/bt/' + ne(); if (history.length > 1 && read('g4.t4.allFrom') === main) { history.back(); return; } location.hash = main; },
    back: function () {
      if (!BT.s) return; if (BT.s.mine) { btBack(); return; }
      var f = read(FROM), d = '#/share/s/' + ne();
      if (f && f.indexOf(d) === 0 && history.length > 1) { history.back(); return; }
      location.hash = d + '/all';
    }
  };
  /* 모두 보기로 가기 전 자리(돌아올 때 history.back 이 착지 화면이 되게) */
  addEventListener('hashchange', function (e) { try { var o = new URL(e.oldURL).hash, n = new URL(e.newURL).hash; if (/\/all$/.test(n) && n.indexOf('#/share/bt/') === 0) write('g4.t4.allFrom', o); } catch (_) {} });
  addEventListener('resize', function () { if (document.body.classList.contains('g4-t4')) barHeight(); });
})();
