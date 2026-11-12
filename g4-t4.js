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
  function dList(i) { var d = ymd(i); return ko() ? d[0] + '. ' + d[1] + '. ' + d[2] + '.' : MON[d[1] - 1] + ' ' + d[2] + ', ' + d[0]; }
  function dSent(i) { var d = ymd(i); return ko() ? d[0] + '년 ' + d[1] + '월 ' + d[2] + '일' : MON[d[1] - 1] + ' ' + d[2] + ', ' + d[0]; }
  /* 문구: 카피 주인 확정본(copy/table-v2.md 1~19, check-int.md). en 은 그 표의 en 칸 그대로.
     표에 없는 것(mineBack, allBack, allTitle, day, holding, allMore, fold*, connect, minErr, short, long, buy, close*, sell, chartAria)은 en 확정 전 임시 */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var TX = {
    ko: { navBack: '← 전략 상세', mineBack: '← 대화로', navTitle: '과거 시장에서 직접 검증', mine: '내 전략', target: '{amt} 넣었다면 지금', since: '{date}부터 지금까지',
      replaying: '하루씩 다시 굴리는 중 {cur} / {days}일', skip: '결과 바로 보기', landOk: '{days}일을 하루씩 다시 굴려도 {final}입니다',
      diffProfit: '그냥 들고 있었다면 {bench} (차이 {diff} 더 벌었습니다)', diffLoss: '그냥 들고 있었다면 {bench} (차이 {diff} 덜 잃었습니다)', hold: '그냥 들고 있었다면 {bench}',
      win: '총 {n}번의 매매 중 {wins}번 수익 달성 (승률 {win}%)', viewAll: '거래 {n}건 모두 보기', cta: '{amt}으로 복사하기', adjust: '예산 조정',
      free: '영원히 무료, 카드 등록 필요없음', editRules: '규칙 수정하기', chartAria: '{amt}이 {final}까지 간 곡선',
      allBack: '← 결과', allTitle: '거래 {n}건', day: '{n}일', holding: '보유 중', allMore: '이전 거래 {n}건 더 보기', foldLog: '판단 기록', foldMonth: '월별 수익률', foldTech: '자세한 지표',
      connect: '거래소 연결', minErr: '최소 {min}부터 시작할 수 있습니다', short: '숏', long: '롱', lev: '{n}배', buy: '매수', closeShort: '숏 청산', closeLong: '롱 청산', sell: '매도' },
    en: { navBack: '← Strategy Details', mineBack: '← Back to chat', navTitle: 'Direct Market Verification', mine: 'My Strategy', target: 'If you invested {amt}, now', since: 'Since {date} to present',
      replaying: 'Replaying day by day {cur} / {days} days', skip: 'View results now', landOk: 'Even replaying {days} days day by day, it is {final}',
      diffProfit: 'If simply held {bench} (Difference {diff} more earned)', diffLoss: 'If simply held {bench} (Difference {diff} less lost)', hold: 'If simply held {bench}',
      win: 'Achieved profit in {wins} of {n} trades (Win rate {win}%)', viewAll: 'View all {n} trades', cta: 'Copy with {amt}', adjust: 'Adjust Budget',
      free: 'Free forever, no card required', editRules: 'Edit rules', chartAria: '{amt} growing to {final}',
      allBack: '← Results', allTitle: '{n} trades', day: '{n}d', holding: 'Holding', allMore: 'Show {n} earlier trades', foldLog: 'Decision log', foldMonth: 'Monthly returns', foldTech: 'Detailed metrics',
      connect: 'Connect exchange', minErr: 'Start from {min}', short: 'Short', long: 'Long', lev: '{n}x', buy: 'Buy', closeShort: 'short closed', closeLong: 'long closed', sell: 'sold' }
  };
  function lang() { return typeof GLC !== 'undefined' && GLC.lang === 'en' ? 'en' : 'ko'; }
  function ko() { return lang() === 'ko'; }
  /* 값은 HTML 조각일 수 있다(굵게, 초록). 틀 글자는 esc */
  function L(k, o) { var t = TX[lang()][k] || TX.ko[k]; return esc(t).replace(/\{(\w+)\}/g, function (_, n) { return o && o[n] != null ? o[n] : ''; }); }
  function sName(s) { return !s.mine && window.G4T3 && G4T3.name ? G4T3.name(s) : mkHook(s); } /* 영어 이름은 T3 NAME_EN */
  function n0(v) { return Number(v).toLocaleString('en-US'); }
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
  addEventListener('hashchange', function () { if (!/^#\/share\/bt\//.test(location.hash)) reveal(); if (/^#\/share\/s\//.test(location.hash)) write('g4.t4.return', null); });

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
    var tk = mkTk(t.a), act = TX[lang()][t.side === -1 ? 'closeShort' : t.side === 1 && V.s.cfg && V.s.cfg.fut ? 'closeLong' : 'sell'];
    return { d: dList(V.R.eq[0].i + (t.x - V.R.i0)), a: tk + ' ' + act, p: pct(t.pnl) };
  }

  /* ── 그리기 ── */
  function exLine(s) {
    if (s.mine) return '<div class="t4-ex"><span>' + L('mine') + '</span></div>';
    var e = mkEx(s), fut = !!(s.cfg && s.cfg.fut), off = window.G4T3 ? G4T3.T(fut ? 'official' : 'officialSpot', { ex: e[1] }) : e[1];
    var fol = window.G4T3 ? G4T3.T('follow', { count: Number(s.fw || 0).toLocaleString('en-US') }) : '';
    return '<div class="t4-ex"><img src="assets/logos/' + esc(e[0]) + '.png" alt="" width="20" height="20"><span>' + esc(off) + '</span>' + (fol ? '<i aria-hidden="true">|</i><span>' + esc(fol) + '</span>' : '') + '</div>';
  }
  function primaryLabel() { return !V.mine && copyRow(V.s) ? TX[lang()].adjust : TX[lang()].cta.replace('{amt}', usd(V.amt)); } /* J4: 내 전략도 「$1,000으로 복사하기」(카피 확정 2) */
  function free() { return S.user ? '' : '<p class="t4-free">' + L('free') + '</p>'; }
  function allLabel() { return TX[lang()].viewAll.replace('{n}', n0(V.trades)); }
  function card() {
    var e = V.mine ? null : mkEx(V.s);
    return '<aside class="t4-card" id="t4-card"><h2>' + esc(window.G4T3 ? G4T3.T('cardTitle') : '이 전략 복사') + '</h2>'
      + '<p class="t4-card-sub">' + L('target', { amt: usd(V.amt) }) + '</p><b class="t4-card-num">' + usd(V.F) + '</b>'
      + (e ? '<div class="t4-ex t4-ex-sm"><img src="assets/logos/' + esc(e[0]) + '.png" alt="" width="18" height="18"><span>' + esc(window.G4T3 ? G4T3.T(V.s.cfg && V.s.cfg.fut ? 'official' : 'officialSpot', { ex: e[1] }) : e[1]) + '</span></div>' : '')
      + '<button type="button" class="bt-cta t4-primary" onclick="G4T4.copy()">' + esc(primaryLabel()) + '</button>' + free()
      + '</aside>'; /* 「대화로 돌아가기」는 위 뒤로 링크와 겹쳐 뺌(카피 표 18: 둘째 줄은 「규칙 수정하기」 하나) */ /* B2: 「거래 N건 모두 보기」는 곡선 아래 승률 줄로 */
  }
  function bar() {
    return '<div class="t4-bar" id="t4-bar"><div class="t4-bar-top"><span>' + L('target', { amt: usd(V.amt) }) + '</span><b>' + usd(V.F) + '</b></div>'
      + '<button type="button" class="bt-cta t4-primary" onclick="G4T4.copy()">' + esc(primaryLabel()) + '</button>' + free() + '</div>';
  }
  function page() {
    var s = V.s, R = V.R, e0 = R.eq[0].i, up = V.ret >= 0;
    var holdD = path(function (j) { return V.amt * R.bench[j]; }), eqD = path(function (j) { return V.amt * R.eq[j].v; });
    var base = Y(V.amt).toFixed(1);
    var mk = V.big.map(function (b, k) { return '<i class="t4-mk' + (b.t.pnl < 0 ? ' dn' : '') + '" id="t4-mk' + k + '" style="left:' + (X(b.j) / W * 100).toFixed(2) + '%;top:' + (Y(V.amt * R.eq[b.j].v) / H * 100).toFixed(2) + '%"></i>'; }).join('');
    return '<div class="t4" id="bt-root" data-phase="run" data-kind="' + esc(s.kind) + '">'
      + '<div class="t4-layout"><div class="t4-main">'
      + '<button type="button" class="t4-link bk t4-back" onclick="G4T4.back()">' + L(s.mine ? 'mineBack' : 'navBack') + '</button>'
      + '<h1 class="t4-name">' + esc(sName(s)) + '</h1>' + exLine(s)
      + '<p class="t4-sub">' + L('target', { amt: usd(V.amt) }) + '</p>'
      + '<div class="t4-money"><b class="t4-final num">' + usd(V.F) + '</b><span class="num ' + (up ? 'up' : 'dn') + '">' + pct(V.ret) + '</span></div>'
      + '<p class="t4-since">' + L('since', { date: esc(dSent(e0)) }) + '</p>'
      /* B1 안3: 상태 한 줄(재생 중 = 하루씩 다시 굴리는 중 n / N일, 착지 = 착지 1줄)과 비교 문장(0초부터, 착지 때 굵게)이 F 바로 밑 */
      + '<p class="t4-state" id="t4-state"></p><p class="t4-cmp" id="t4-cmp">' + cmpLine() + '</p>'
      + '<div class="t4-skiprow"><button type="button" class="t4-link bt-skip" id="t4-skip" onclick="G4T4.skip()">' + L('skip') + '</button></div>'
      + '<div class="t4-plot" id="t4-chart" onclick="G4T4.skip()" role="img" aria-label="' + L('chartAria', { amt: usd(V.amt), final: usd(V.F) }) + '">'
      + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="t4-clip"><rect id="t4-clip-r" x="0" y="0" width="0" height="' + H + '"/></clipPath></defs>'
      + '<line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '" class="t4-base"/>'
      + '<path d="' + holdD + '" class="t4-hold"/><g clip-path="url(#t4-clip)"><path d="' + eqD + '" class="t4-eq"/></g></svg>' /* J7: 그냥 들고 있기 점선은 0초부터 전체 */
      /* B1 안3: 곡선 머리점 + 세로 기준선 + 날짜·잔고 말풍선. 잔고 = 그날 eq(J6) */
      + mk + '<i class="t4-vline" id="t4-vline"></i><i class="t4-dot" id="t4-dot"></i>'
      + '<div class="t4-bub" id="t4-bub"><span id="t4-date">' + esc(dList(R.eq[0].i)) + '</span><b class="num" id="t4-bal">' + usd(V.amt) + '</b></div></div>'
      /* B2 안2 + J9: 곡선 아래 한 줄 = 「끝난 N번 중 M번 수익」 + 「거래 N건 모두 보기」(mine 은 「규칙 수정하기」 더함). 착지 때 보임 */
      + '<div class="t4-stats" id="t4-stats"><span>' + winLine() + '</span><span class="t4-stats-links"><button type="button" class="t4-link" onclick="G4T4.all()">' + esc(allLabel()) + '</button>'
      + (V.mine ? '<button type="button" class="t4-link" onclick="rvFix()">' + L('editRules') + '</button>' : '') + '</span></div>'
      + '<ol class="t4-trades" id="t4-trades"></ol>'
      + '</div>' + card() + '</div>' + bar() + '</div>';
  }
  /* 문구 = 카피 확정본(copy/decision-copy.md, table-v2.md) */
  function cmpLine() {
    if (V.diff > 0 && V.F >= V.amt) return L('diffProfit', { bench: usd(V.H), diff: '<span class="up">' + sUsd(V.diff) + '</span>' });
    if (V.diff > 0) return L('diffLoss', { bench: usd(V.H), diff: usd(V.diff) });
    return L('hold', { bench: usd(V.H) });
  }
  function runLine() { return L('replaying', { cur: '<span id="t4-day">0</span>', days: n0(V.N) }); }
  function okLine() { return L('landOk', { days: n0(V.N), final: '<b class="num">' + usd(V.F) + '</b>' }); }
  /* J9: N = 끝난 거래 수, M = 그중 수익(pnl > 0), 엔진 값. 문구는 agy 확정 전 임시(flow-contract 0.5) */
  function winLine() {
    var c = V.R.tr.filter(function (t) { return !t.open && t.x != null; }), m = c.filter(function (t) { return t.pnl > 0; }).length;
    /* J9 카피 확정(표 13): n = 끝난 거래 수, wins = 그중 수익, 승률 = wins / n 반올림(앱 「자세한 지표」 승률과 같은 정의) */
    var n = c.length, win = n ? Math.round(m / n * 100) : 0;
    return L('win', { n: n0(n), wins: '<b class="' + (m > 0 ? 'up' : '') + '">' + n0(m) + '</b>', win: win });
  }

  function paint(j) {
    var R = V.R, r = $('t4-clip-r'), dot = $('t4-dot'); if (!r) return;
    r.setAttribute('width', (X(j) + 1).toFixed(1));
    var v = V.amt * R.eq[j].v;
    var lx = (X(j) / W * 100).toFixed(2) + '%';
    if (dot) { dot.style.left = lx; dot.style.top = (Y(v) / H * 100).toFixed(2) + '%'; }
    var vl = $('t4-vline'), bub = $('t4-bub');
    if (vl) vl.style.left = lx;
    if (bub) { var pw = $('t4-chart').clientWidth, bw = bub.offsetWidth, x = X(j) / W * pw; bub.style.left = Math.max(0, Math.min(pw - bw, x - bw / 2)).toFixed(1) + 'px'; } /* 말풍선은 머리점 위, 곡선 칸 밖으로 나가지 않게 */
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
    stop(); if (!$('t4-state')) return;
    paint(V.N - 1);
    var root = $('bt-root'); root.setAttribute('data-phase', 'result'); root.classList.add('landed'); if (instant) root.classList.add('still');
    $('t4-state').innerHTML = okLine(); /* B2: 착지 1줄, 비교 문장 굵게(.landed), 주 단추 청록(.on) */
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
    tfPageMode('tfbt', TX[lang()].navTitle); /* 카피 표 2 */
    V = numbers();
    TF_RENDERING = true; gContent(page()); TF_RENDERING = false;
    document.body.classList.add('g4-t4'); reveal();
    requestAnimationFrame(barHeight);
    lastAt = performance.now(); lastHash = location.hash;
    var now = performance.now(), from = clickAt && now - clickAt < 2000 ? clickAt : !booted && now < 4000 ? 0 : now;
    booted = true; clickAt = 0;
    if (seen() || reduced()) { land(true); return; }
    $('t4-state').innerHTML = runLine(); paint(0);
    BT.phase = 'run';
    roll = { t0: now + DELAY, dur: Math.max(MIN_ROLL, from + TOTAL - now - DELAY) }; raf = requestAnimationFrame(tick);
    try { tfTrack('bt_start', { id: BT.id, per: BT.per, t4: 1 }); } catch (_) {}
    scrollTo(0, 0);
  }

  /* ── 모두 보기: 지금 결과 화면의 아래 칸(판단 기록, 거래 내역, 월별, 자세한 지표)을 다음 화면으로 ── */
  /* B4 안3: 거래 한 줄 = 「BNB 숏 2배 / 12일」 + 「진입 → 청산(보유 중)」 + 오른쪽 큰 수익률. 숫자는 엔진 값(R.tr, 최신이 먼저) */
  var ALL_FIRST = 8;
  function tradeRow(t, k) {
    var R = V.R, last = R.eq[R.N - 1].i, fut = !!(V.s.cfg && V.s.cfg.fut), lev = V.s.cfg && V.s.cfg.lev > 1 ? ' ' + TX[lang()].lev.replace('{n}', V.s.cfg.lev) : '';
    var nm = mkTk(t.a) + ' ' + (fut ? TX[lang()][t.side === -1 ? 'short' : 'long'] + lev : TX[lang()].buy), open = !!t.open || t.x == null;
    var days = Math.max(1, (open ? last : t.x) - t.e);
    return '<li class="t4-arow"' + (k >= ALL_FIRST ? ' hidden' : '') + '><div class="t4-arow-n"><b>' + esc(nm) + '</b><span>' + L('day', { n: n0(days) }) + '</span></div>'
      + '<div class="t4-arow-d">' + esc(dList(t.e)) + ' → ' + (open ? L('holding') : esc(dList(t.x))) + '</div>'
      + '<b class="t4-arow-p num ' + (t.pnl >= 0 ? 'up' : 'dn') + '">' + esc(pct(t.pnl)) + '</b></li>';
  }
  function viewAll() {
    stop();
    var t = tfS(); t.bt = t.bt || {}; t.bt.id = BT.id; t.bt.per = BT.per; t.bt.amt = BT.amt; t.bt.done = 1;
    prevView();
    V = V && V.s === BT.s && V.per === BT.per ? V : numbers();
    markSeen(); /* J10: 「← 결과」는 주소로 곧장 온 경우에도 착지 0초 */
    document.body.classList.add('g4-t4', 'g4-t4-all'); reveal(); booted = true;
    var root = $('bt-root'); if (!root) return;
    root.classList.add('t4', 't4-all');
    var e = V.mine ? null : mkEx(V.s), rest = Math.max(0, V.R.tr.length - ALL_FIRST);
    var head = '<button type="button" class="t4-link bk t4-back" onclick="G4T4.result()">' + L('allBack') + '</button>'
      + '<h1 class="t4-name">' + L('allTitle', { n: n0(V.trades) }) + '</h1>'
      + '<div class="t4-ex t4-all-sub">' + (e ? '<img src="assets/logos/' + esc(e[0]) + '.png" alt="" width="22" height="22">' : '') + '<span>' + esc(sName(V.s)) + '</span><i aria-hidden="true">|</i><span class="num">' + usd(V.amt) + ' → ' + usd(V.F) + '</span></div>';
    var list = '<ol class="t4-alist" id="t4-alist">' + V.R.tr.map(tradeRow).join('') + '</ol>'
      + (rest ? '<button type="button" class="t4-link t4-amore" onclick="G4T4.allMore(this)">' + L('allMore', { n: n0(rest) }) + '</button>' : '');
    root.insertAdjacentHTML('afterbegin', '<div class="t4-layout"><div class="t4-main" id="t4-allmain">' + head + list + '<div class="t4-folds" id="t4-folds"></div></div>' + card() + '</div>' + bar());
    /* 판단 기록, 월별 수익률, 자세한 지표 = 지금 결과 화면의 그 칸 그대로(누르는 동작 포함)를 접어서 아래로. 거래 내역 칸은 위 줄로 바뀌었으므로 숨김 */
    var folds = $('t4-folds'), secs = root.querySelectorAll('#bt-ev > section.bt-sec-b'), tech = root.querySelector('#bt-ev > details.bt-tech');
    function fold(title, node) { if (!node) return; var d = document.createElement('details'); d.className = 't4-fold'; d.innerHTML = '<summary>' + esc(title) + '</summary>'; d.appendChild(node); folds.appendChild(d); }
    fold(TX[lang()].foldLog, secs[0]); fold(TX[lang()].foldMonth, secs[2]); if (tech) { tech.open = true; fold(TX[lang()].foldTech, tech); }
    if (secs[1]) secs[1].hidden = true;
    var c = $('t4-card'), b = $('t4-bar'); if (c) c.classList.add('on'); if (b) b.classList.add('on'); /* B4: 결과와 같은 주 단추(착지 상태) */
    requestAnimationFrame(barHeight);
    scrollTo(0, 0); var sc = $('g-scroll'); if (sc) sc.scrollTop = 0;
  }


  /* J1: 여기서 「$1,000으로 복사하기」를 누른 사람이 가입(처음 온 사람)이나 거래소 연결(acAfter copy)을 끝내면
     지금 앱(T1 openSaved)은 상세로 보낸다. 같은 착지 화면(다시 굴리지 않음)으로 돌아와 같은 창을 $1,000 으로 연다 */
  function backToLanding(r) {
    write(PER + '.' + r.id, r.per);
    try { history.replaceState(null, '', location.pathname + location.search + '#/share/bt/' + r.ne); } catch (_) {}
    btRoute('#/share/bt/' + r.ne);
    setTimeout(function () { mkFollowSheet(r.ne); }, 0);
    return true;
  }
  var prevIntent = tfIntentRun;
  tfIntentRun = function () {
    var o = tfIntentPeek(), r = read('g4.t4.return');
    if (o && o.kind === 'g4copy' && S.user && r && r.id === o.id) { tfIntentClear(); return backToLanding(r); }
    return prevIntent.apply(this, arguments);
  };
  if (typeof acAfter === 'function') {
    var prevAfter = acAfter;
    acAfter = function (af) {
      var r = read('g4.t4.return'), h = read(HANDOFF), id = null;
      try { id = af && af.kind === 'copy' ? decodeURIComponent(af.id) : null; } catch (_) { id = af && af.id; }
      /* 창을 열면 T1 D.save 가 returnTo 를 상세로 되돌리므로 g4.t4.return(여기서 눌렀다는 기록)으로 판단. 상세로 걸어 나가면 지운다 */
      if (id && r && r.id === id && h && h.strategyId === id) return backToLanding(r);
      return prevAfter.apply(this, arguments);
    };
  }

  /* J12: 앱의 옛 백테스트 글자 정리(skbApply)가 같은 #bt-root 를 0.3초 뒤 고쳐 써서 제목 「RSI10 비트코인」이 「RSI10 BTC」로 바뀌었다. T4 화면은 건너뛴다(모두 보기 화면은 옛 결과 화면이라 그대로 적용) */
  if (typeof skbApply === 'function') { var skb = skbApply; skbApply = function (root) { if (root && root.classList && root.classList.contains('t4') && !root.classList.contains('t4-all')) return; return skb.apply(this, arguments); }; }

  /* 언어를 바꾸면 이 화면을 그 언어로 다시 그린다(착지 0초) */
  if (typeof glcSetLang === 'function') { var gl0 = glcSetLang; glcSetLang = function () { var r = gl0.apply(this, arguments); try { if ($('bt-root') && $('bt-root').classList.contains('t4') && BT.s) { V = null; lastHash = ''; btView(); } } catch (_) {} return r; }; }

  gContent = function () { stop(); document.body.classList.remove('g4-t4', 'g4-t4-all'); return prevContent.apply(this, arguments); };

  /* ── J4: 내 전략의 주 단추 = 그 사람 상태의 창(거래소 연결 전 = f 창, 연결됨 = b 창)과 같은 틀, 금액 $1,000.
     창 머리 숫자는 이 화면 숫자(F, H, 곡선). 창의 단추는 지금 앱의 내 전략 실행 길(btUse: 연결 전 = 거래소 연결, 연결됨 = 「전략 시작」)로 넘긴다.
     금액은 대화 전략의 예산(intake.budget)에 맞는 값이 있으면 그 값으로 넘긴다($1,000 = TF_BUDGET 0번). 그 뒤 화면은 T5 몫 ── */
  function T3T(k, o) { return window.G4T3 && G4T3.T ? G4T3.T(k, o) : k; }
  function mineLinked() { try { var l = D && D.linked ? D.linked() : []; return !!(S.user && l.length && acReady(l[0])); } catch (_) { return false; } }
  function mineMin() { try { return mkMin(V.s); } catch (_) { return 100; } }
  function mineAmt() { var el = $('g4-budget') || $('cps-amt'); return el ? Number(String(el.value).replace(/[^0-9.]/g, '')) : NaN; }
  function mineSheet() {
    var linked = mineLinked(), id = linked ? 'cps-amt' : 'g4-budget', min = mineMin();
    var r = { eq: V.R.eq, bench: V.R.bench, i0: V.R.i0, final: V.F, benchFinal: V.H, ret: V.ret };
    var head = window.G4T3 && G4T3.head ? G4T3.head(r, { name: sName(V.s), sub: TX[lang()].mine }) : '';
    tfSS3Dlg(T3T('copyTitle'), '<form class="g4-budget-form t4-mine-form" onsubmit="G4T4.mineGo(event)">' + head
      + '<label for="' + id + '">' + esc(T3T('budget')) + '</label><div class="g4-budget-input"><span>$</span>'
      + '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + usd(V.amt).slice(1) + '" oninput="G4T4.mineSync()" aria-describedby="g4-budget-min g4-budget-error"></div>'
      + '<p id="g4-budget-min">' + esc(T3T('minNote', { min: usd(min) })) + '</p><p id="g4-budget-error" role="status"></p>'
      + '<button id="g4-budget-next" type="submit" class="g4-primary">' + esc(linked ? T3T('start') : TX[lang()].connect) + '</button>'
      + '<p class="t3s-foot">' + esc(T3T('foot')) + '</p>'
      + '<p class="t4-mine-links"><button type="button" class="t3-link" onclick="tfSS3DlgClose(true);rvFix()">' + L('editRules') + '</button></p></form>'); /* B3 mine 둘째 줄(J4, T7 경계) */
    var w = $('ss3-dlgw'); if (w) w.classList.add('g4-budget-dialog', 't3s', 't4-mine', linked ? 't4-mine-b' : 't4-mine-f');
    try { tfTrack('bt_copy', { id: 'mine', per: BT.per, budget: V.amt }); } catch (_) {}
  }

  window.G4T4 = {
    allMore: function (btn) { document.querySelectorAll('#t4-alist .t4-arow[hidden]').forEach(function (li) { li.hidden = false; }); if (btn) btn.remove(); },
    mineSync: function () {
      var el = $('g4-budget') || $('cps-amt'), n = mineAmt(), ok = Number.isFinite(n) && n >= mineMin(), e = $('g4-budget-error'), b = $('g4-budget-next');
      if (el) { var raw = String(el.value).replace(/[^0-9.]/g, ''), p = raw.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); el.value = p.join('.'); }
      if (e) e.textContent = el && el.value && !ok ? TX[lang()].minErr.replace('{min}', usd(mineMin())) : '';
      if (b) b.disabled = !ok; return ok;
    },
    mineGo: function (ev) {
      if (ev) ev.preventDefault();
      if (!G4T4.mineSync()) return;
      var n = mineAmt();
      try { var t = tfS(), k = TF_BUDGET.indexOf(Math.round(n * 1000)); /* tfWon: 원 단위 / 1000 = $ */ if (t.intake && k >= 0) { t.intake.budget = Object.assign({}, t.intake.budget || {}, { i: k, label: usd(n) }); tfSave(); } } catch (_) {}
      try { tfSS3DlgClose(true); } catch (_) {}
      btUse();
    },
    /* T3 창(g4-t3.js onT4, hostCur)이 지금 화면의 전략과 기간을 읽는다 */
    ctx: function () { return V && BT.s && V.s.id === BT.s.id && $('bt-root') && $('bt-root').classList.contains('t4') ? { s: V.s, per: BT.per } : null; },
    skip: function () { if (roll) land(false); },
    copy: function () {
      if (!V) return; var s = V.s;
      if (s.mine) { mineSheet(); return; }
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
    result: function () { var main = '#/share/bt/' + ne(); if (history.length > 1 && read('g4.t4.allFrom') === main) { if (history.state && history.state.g4t3Auth) history.go(-2); else history.back(); return; } location.hash = main; },
    back: function () {
      if (!BT.s) return; if (BT.s.mine) { btBack(); return; }
      var f = read(FROM), d = '#/share/s/' + ne();
      /* 가입 창을 Esc 로 닫으면 T3 I6 의 창 기록 칸(g4t3Auth)이 남는다(상세에서도 같음). 그 칸 위면 두 칸 뒤가 상세 */
      if (f && f.indexOf(d) === 0 && history.length > 1) { if (history.state && history.state.g4t3Auth) history.go(-2); else history.back(); return; }
      location.hash = d + '/all';
    }
  };
  /* 모두 보기로 가기 전 자리(돌아올 때 history.back 이 착지 화면이 되게) */
  addEventListener('hashchange', function (e) { try { var o = new URL(e.oldURL).hash, n = new URL(e.newURL).hash; if (/\/all$/.test(n) && n.indexOf('#/share/bt/') === 0) write('g4.t4.allFrom', o); } catch (_) {} });
  addEventListener('resize', function () { if (document.body.classList.contains('g4-t4')) barHeight(); });
})();
