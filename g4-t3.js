/* G4 T3 4단계 통합 (sprint/G4/T3/stage4/flow-contract.md, integrate-plan.md).
   뼈대 codex 4ca3056. claude 3e0cf4e 에서 곡선 그리기, 가입 창 뒤로, 신호/체결 짝, 거래소 한 줄.
   화면은 astra-decision.md 채택안(A1 안2 + 안3 곡선 끝 값, A2 안3, A3 f b c 안3), 문구는 copy/table-v2.md(ko, en) 그대로.
   숫자는 앱 계산값만(N1 식): 큰 돈 = round(btCompute(per 0).final), 비교 = round(benchFinal), 차이 = 둘의 차. 상수로 박지 않는다.
   영어 화면에 한국어를 남기지 않는다: 문구표에 없는 다른 언어는 영어로 보인다. */
(function () {
  'use strict';
  var D = G4T1Data, KEY = 'g4.t3.detail', HANDOFF = 'g4.t1.handoff';
  var current = null, frame = 0, clipN = 0;
  var oldHead = mk3Head, oldOverview = mkOvTab, oldDetail = tfSS3DetailRender;
  var oldContent = gContent, oldSave = D.save, oldSet = mkdSet;

  /* ── 문구 (copy/table-v2.md 확정안 ko, en) ── */
  var TX = {
    ko: {
      back: '← 전략 복사', heroSub: '$1,000 넣었다면 지금',
      heroCompare: '그냥 들고 있었다면 {bench} (차이 {diff} 더 벌었습니다)', heroHold: '그냥 들고 있었다면 {bench}',
      since: '{date}부터 지금까지', follow: '{count}명이 따라가는 중', official: '{ex} 선물 공식 연동', officialSpot: '{ex} 공식 연동',
      endStrategy: '전략', endHold: '그냥 들고 있었다면', keyStrategy: '전략', keyHold: '그냥 들고 있기',
      posLive: '지금 {pos} 보유 중', posWait: '지금 신호를 기다리는 중', next: '다음 판단', execLinked: '{ex} 계정으로 바로 복사합니다',
      execUnlinked: '{ex} 계정 연결 후 바로 실행됩니다',
      tabAll: '전체', tab1Y: '최근 1년', tab3M: '최근 3개월', tab30D: '최근 30일', period: '기간',
      cardTitle: '이 전략 복사', cardMin: '최소 운용 금액 {min}', btnCopy: '{amt}으로 복사하기', btnAdjust: '예산 조정',
      free: '영원히 무료, 카드 등록 필요없음', barFree: '영원히 무료, 카드 등록 필요없음', linkedNote: '수수료 0원, 언제든 중단 가능',
      myAssetLink: '내 복사 자산 {amt} 보기', barLabel: '$1,000 넣었다면 지금', barMine: '내 운용 자산', copying: '현재 {amt} 복사 운용 중',
      verify: '직접 검증하기', analyze: 'TETH에게 분석시키기',
      decTitle: 'TETH의 판단 기록', decNote: '신호는 AI 판단 시각, 체결은 실제 주문이 실행된 시각입니다.', signal: '신호 {t}', fill: '체결 {t}',
      decMore: '이전 판단 기록 보기', ordTitle: '최근 체결 내역', ordNote: '초기 운용 $1,000 기준 체결 결과', ordAll: '전체 거래 내역 보기 ({count}건)',
      ordCols: ['종목', '주문 유형', '체결 시각', '체결가', '손익'], holding: '보유 중', info: '전략 정보',
      support: '막히면 상담원이 24시간 답합니다.', supportLink: '상담원에게 묻기', menu: '더 보기', watch: '관심 전략', link: '링크 복사',
      copyTitle: '전략 복사', budget: '복사 예산', minNote: '최소 {min}부터 자유롭게 설정할 수 있습니다.', stopLabel: '원금 보호 손실 중단',
      stopDesc: '설정한 예산의 {pct}% 손실 시 복사를 자동으로 멈춰 원금을 보호합니다.', start: '전략 복사 시작', connect: '{ex} 연결하고 복사 시작',
      foot: '복사는 무료이며 언제든 위약금 없이 멈출 수 있습니다.', connected: '{ex} 연결됨',
      adjTitle: '예산 조정, {name}', myAsset: '내 운용 자산 {amt} (수익률 {ret})', tabAdd: '예산 추가', tabOut: '예산 회수',
      avail: '계정 잔여 가능 금액: {amt}', adjNote: '조정된 예산은 다음 AI 진입 주문부터 자동으로 반영됩니다.', adjBtn: '예산 변경 완료', copyingTag: '복사 중',
      authBack: '전략 상세로 돌아왔습니다. 언제든 무료로 복사할 수 있습니다.',
      chatBack: '← 전략 상세로 돌아가기', addAmt: '추가할 금액', outAmt: '회수할 금액', none: '아직 없음'
    },
    en: {
      back: '← Copy Strategies', heroSub: 'If you invested $1,000, now',
      heroCompare: 'If you had held: {bench} ({diff} more earned)', heroHold: 'If you had held: {bench}',
      since: 'Since {date} to present', follow: '{count} people following', official: 'Official {ex} Futures Integration', officialSpot: 'Official {ex} Integration',
      endStrategy: 'Strategy', endHold: 'Buy & Hold', keyStrategy: 'Strategy', keyHold: 'Buy & Hold',
      posLive: 'Currently holding {pos}', posWait: 'Waiting for signal', next: 'Next decision:', execLinked: 'Ready to copy directly to your {ex} account',
      execUnlinked: 'Executes immediately upon connecting {ex} account',
      tabAll: 'All', tab1Y: 'Past 1 Year', tab3M: 'Past 3 Months', tab30D: 'Past 30 Days', period: 'Period',
      cardTitle: 'Copy This Strategy', cardMin: 'Minimum investment {min}', btnCopy: 'Copy with {amt}', btnAdjust: 'Adjust Budget',
      free: 'Free forever, no credit card required', barFree: 'Free forever, no card required', linkedNote: 'Zero fees, cancel anytime',
      myAssetLink: 'View my copied asset {amt}', barLabel: 'If $1,000 invested', barMine: 'My Copied Asset', copying: 'Currently Copying with {amt}',
      verify: 'Verify Strategy', analyze: 'Ask TETH to Analyze',
      decTitle: 'TETH Trading Decisions', decNote: 'Signal indicates the AI decision time; Execution indicates the order fill time.', signal: 'Signal: {t}', fill: 'Fill: {t}',
      decMore: 'View Previous Decisions', ordTitle: 'Recent Executed Orders', ordNote: 'Executed results based on $1,000 initial capital', ordAll: 'View All {count} Orders',
      ordCols: ['Symbol', 'Type', 'Fill Time', 'Price', 'PnL'], holding: 'Holding', info: 'Strategy info',
      support: 'Stuck? Our support team answers 24/7.', supportLink: 'Ask Support', menu: 'More', watch: 'Watchlist', link: 'Copy link',
      copyTitle: 'Copy Strategy', budget: 'Copy Budget', minNote: 'Minimum {min}. You can change this amount freely.', stopLabel: 'Capital Protection Stop-Loss',
      stopDesc: 'Automatically stops copying if loss reaches {pct}% to protect your principal.', start: 'Start Strategy Copy', connect: 'Connect {ex} and Start Copy',
      foot: 'Copying is completely free and can be stopped anytime without penalties.', connected: '{ex} connected',
      adjTitle: 'Adjust Budget, {name}', myAsset: 'My Copied Asset: {amt} (Return {ret})', tabAdd: 'Add Budget', tabOut: 'Withdraw Budget',
      avail: 'Available Account Balance: {amt}', adjNote: 'Adjusted budget will apply automatically from the next AI entry order.', adjBtn: 'Confirm Budget Adjustment', copyingTag: 'Copying',
      authBack: 'Returned to strategy details. You can copy for free anytime.',
      chatBack: '← Back to Strategy Details', addAmt: 'Amount to add', outAmt: 'Amount to withdraw', none: 'None yet'
    }
  };
  /* 전략 이름 영어(문구표 #2 의 f1 과 같은 짜임. 나머지 30개는 agy 확인 전 임시) */
  var NAME_EN = {
    f1: 'BNB Moving Average Bi-Directional 2x', f2: 'DOGE Moving Average Bi-Directional 2x', f3: 'AVAX Trend Bi-Directional',
    f4: 'ETH Trend Bi-Directional 2x', f5: 'Major Coin Breakout Follower', f6: 'ADA Moving Average Bi-Directional', f7: 'Strongest Coin Long/Short',
    f8: 'AVAX Moving Average Bi-Directional', f9: 'Two-Coin Long/Short Switch', f10: 'BTC Trend Bi-Directional 2x',
    d1: 'Three-Coin Split', d2: 'Four Markets, Two Picks', d3: 'Daily Coin Comparison', d4: 'Three Tech Stocks Split', d5: 'Tech Stocks Rising Together', d6: 'One Major Coin',
    r1: 'BTC After a Big Drop', r2: 'Nasdaq 4% Take Profit', r3: 'ETH Quick Exit', r4: 'Gold Only When Clear', r5: 'Tesla After a Big Drop',
    r6: 'SOL Short and Frequent', r7: 'XRP 4% Take Profit', r8: 'NVIDIA 8% Target', r9: 'BTC Only When Clear',
    h1: 'Waiting for Tech Recovery', h2: 'Crypto Market Check First', h3: 'Index and Gold, Short Term', h4: 'Four-Market Recovery Wait',
    h5: 'Strong Coin Recovery', h6: 'Six-Market Rotation'
  };
  var TAG_EN = {
    '선물 숏 진입': 'Futures Short Entry', '선물 롱 청산': 'Futures Long Exit', '선물 롱 진입': 'Futures Long Entry', '선물 숏 청산': 'Futures Short Exit',
    '현물 매수': 'Spot Buy', '현물 매도': 'Spot Sell', '토큰화 주식 매수': 'Tokenized Stock Buy', '토큰화 주식 매도': 'Tokenized Stock Sell',
    '토큰화 지수 매수': 'Tokenized Index Buy', '토큰화 지수 매도': 'Tokenized Index Sell', '토큰화 금 매수': 'Tokenized Gold Buy', '토큰화 금 매도': 'Tokenized Gold Sell',
    '포지션 유지': 'Position Held', '보유 유지': 'Holding', '관망': 'Waiting', '숏 후보 선정': 'Short Candidates', '롱 후보 선정': 'Long Candidates',
    '종목 선정': 'Asset Selection', '현재 상태': 'Current Status', '전략 개요': 'Strategy Overview'
  };
  var TYPE_EN = { '숏 진입': 'Short Entry', '롱 진입': 'Long Entry', '숏 청산': 'Short Exit', '롱 청산': 'Long Exit', '매수': 'Buy', '매도': 'Sell' };
  var WORD_EN = { '숏': 'Short', '롱': 'Long', '나스닥': 'Nasdaq', '금': 'Gold', '테슬라': 'Tesla', '엔비디아': 'NVIDIA' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function lang() { return typeof GLC !== 'undefined' && GLC.lang ? GLC.lang : 'ko'; }
  function ko() { return lang() === 'ko'; }
  function T(k, o) {
    var s = (ko() ? TX.ko : TX.en)[k]; if (s == null) s = TX.en[k];
    return o && typeof s === 'string' ? s.replace(/\{(\w+)\}/g, function (m, x) { return o[x] != null ? o[x] : m; }) : s;
  }
  function esc(v) { return gEsc(String(v == null ? '' : v)); }
  function money(v, cents) { return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); }
  function pct(v) { return (v >= 0 ? '+' : '-') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  function read(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function write(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function real(s) { return !!(s && s.cfg && !s.me && !s.mine); }
  function per(v) { return [0, 365, 90, 30].indexOf(+v) >= 0 ? +v : 0; }
  function route(s) { return '#/share/s/' + encodeURIComponent(s.id) + '/all'; }
  function state(s) { var x = read(KEY); return x && x.id === s.id ? x : { id: s.id, per: 0, y: 0 }; }
  function name(s) { return ko() ? mkHook(s) : (NAME_EN[s.id] || mkHook(s)); }
  function exOf(s) { var e = mkEx(s); return { file: e[0], name: e[1], id: D.exchange(s) }; }
  function logo(s, size) { var e = exOf(s); return '<img class="t3-logo" src="assets/logos/' + esc(e.file) + '.png" alt="" width="' + size + '" height="' + size + '">'; }
  function official(s) { return T(fuIs(s) ? 'official' : 'officialSpot', { ex: exOf(s).name }); }
  function dot(i) { var d = idxToDate(i); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function longDate(i) { var d = idxToDate(i); return ko() ? d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  /* "2026.10.30 09:00" → ko "2026. 10. 30. 09:00" / en "Oct 30, 2026, 09:00", year=false 면 연도 없이 */
  function stamp(t, year) {
    var m = String(t || '').match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2})/); if (!m) return t || '';
    if (ko()) return (year ? m[1] + '. ' : '') + (+m[2]) + '. ' + (+m[3]) + '. ' + m[4];
    return MON[+m[2] - 1] + ' ' + (+m[3]) + (year ? ', ' + m[1] : '') + ', ' + m[4];
  }
  function nextTime() {
    var t = tbNextClose(); if (ko()) return t;
    var m = String(t).match(/(\d{4})년 (\d{1,2})월 (\d{1,2})일 (\d{2}:\d{2})/);
    return m ? MON[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] + ', ' + m[4] : t;
  }
  function enWords(t) { return String(t).replace(/(나스닥|테슬라|엔비디아|숏|롱|금)/g, function (w) { return WORD_EN[w] || w; }); }
  /* 지금 한 줄: G4T1Data.pos 그대로 계산, 문구표 #12 와 5.1(K16)의 틀로.
     보유 = 「지금 {pos} {pnl} 보유 중」. 포지션 없이 기다림(복사했지만 첫 체결 전 포함) = 목록 카드와 같은 말(mkNowLine, 「지금 신호를 기다리는 중」 등) */
  function waitLine(s) {
    if (!ko()) return T('posWait');
    var w = ''; try { w = mkNowLine(s) || ''; } catch (_) {}
    return /기다리/.test(w) && !/보유 중$/.test(w) ? '지금 ' + w : T('posWait');
  }
  function posLine(s, row) {
    var p = D.pos(s, row), m = String(p).match(/^지금 (.+) 보유 중$/);
    if (m) return T('posLive', { pos: ko() ? m[1] : enWords(m[1]) });
    if (/기다리/.test(p)) return waitLine(s);
    return ko() ? p : T('posWait');
  }
  function copyFor(s) { return D.mine().find(function (x) { return x.s.id === s.id; }) || null; }
  function budget(s) { var h = D.handoff(); return h && h.strategyId === s.id && Number.isFinite(h.budget) && h.budget > 0 ? h.budget : 1000; }
  function linkedTo(s) { return D.linked().indexOf(D.exchange(s)) >= 0; }

  /* ── 숫자: N1 식 그대로. 전체·1년·3개월 = btCompute(per), 30일 = mkSlice(N1 표대로 기간 고르기 안에만) ── */
  function series(s, p) {
    p = per(p);
    if (p !== 30) {
      var r = D.results(s, p);
      return { eq: r.eq, bench: r.bench, i0: r.i0, final: r.final, benchFinal: r.benchFinal, ret: p === 0 ? s.r.ret : (r.final / 1000 - 1) * 100 };
    }
    var x = mkSlice(s, 30), eq = x.eq, first = eq[0].i, prices = mkUni(s).list.map(mkPx);
    var hold = eq.map(function (point) { return prices.reduce(function (sum, px) { return sum + px[point.i] / px[first]; }, 0) / prices.length; });
    return { eq: eq, bench: hold, i0: first, final: 1000 * eq[eq.length - 1].v, benchFinal: 1000 * hold[hold.length - 1], ret: x.ret };
  }

  /* ── 곡선: 전략 실선 + 그냥 들고 있기 점선 + 끝 값 꼬리표(A1 안3). 그리기는 0.2초에 시작해 0.9초에 끝(I2, claude 3e0cf4e 방식) ── */
  function drawOnce(s, p) {
    var k = 'g4.t3.drawn.' + s.id + '.' + p;
    if (read(k) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return false;
    write(k, true); return true;
  }
  function curve(r, o) {
    o = o || {};
    var values = r.eq.map(function (p) { return p.v; }).concat(r.bench), lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), span = hi - lo || 1;
    var n = r.eq.length, W = 720, H = o.h || 224, id = 't3clip' + (++clipN), anim = !!o.animate;
    function y(v) { return 12 + (1 - (v - lo) / span) * (H - 24); }
    function path(hold) { return r.eq.map(function (p, j) { return (j ? 'L' : 'M') + (4 + j / Math.max(1, n - 1) * (W - 8)).toFixed(2) + ',' + y(hold ? r.bench[j] : p.v).toFixed(2); }).join(' '); }
    if (n < 2) return '';
    var ys = y(r.eq[n - 1].v), yh = y(r.bench[n - 1]), gap = 34;
    if (Math.abs(ys - yh) < gap) { if (ys <= yh) yh = Math.min(H, ys + gap); else ys = Math.min(H, yh + gap); }
    var tags = o.tags === false ? '' : '<span class="t3-tag s" style="top:' + (ys - 15).toFixed(1) + 'px"><small>' + esc(T('endStrategy')) + '</small>' + money(Math.round(r.final)) + '</span>'
      + '<span class="t3-tag h" style="top:' + (yh - 15).toFixed(1) + 'px"><small>' + esc(T('endHold')) + '</small>' + money(Math.round(r.benchFinal)) + '</span>';
    return '<figure class="t3-curve' + (anim ? ' drawing' : '') + (o.cls ? ' ' + o.cls : '') + '" data-strategy-end="' + Math.round(r.final) + '" data-hold-end="' + Math.round(r.benchFinal) + '">'
      + '<div class="t3-plot" style="height:' + H + 'px"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(T('keyStrategy') + ' ' + money(Math.round(r.final)) + ', ' + T('keyHold') + ' ' + money(Math.round(r.benchFinal))) + '">'
      + '<defs><clipPath id="' + id + '"><rect x="0" y="0" height="' + H + '" width="' + (anim ? 0 : W) + '">'
      + (anim ? '<animate attributeName="width" from="0" to="' + W + '" begin="0.2s" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".22 1 .36 1"/>' : '') + '</rect></clipPath></defs>'
      + '<path class="t3-grid" d="M0 12H' + W + ' M0 ' + (H / 2) + 'H' + W + ' M0 ' + (H - 12) + 'H' + W + '"/>'
      + '<g clip-path="url(#' + id + ')"><path class="t3-hold" d="' + path(true) + '"/><path class="t3-line" d="' + path(false) + '"/></g></svg>' + tags + '</div>'
      + (o.legend ? '<figcaption><span><i class="t3-key"></i>' + esc(T('keyStrategy')) + '</span><span><i class="t3-key dashed"></i>' + esc(T('keyHold')) + '</span></figcaption>' : '')
      + '</figure>';
  }
  function compare(r, cls) {
    var diff = Math.round(r.final) - Math.round(r.benchFinal), bench = money(Math.round(r.benchFinal));
    if (diff <= 0) return '<p class="' + cls + '">' + esc(T('heroHold', { bench: bench })) + '</p>';
    var t = esc(T('heroCompare', { bench: bench, diff: '\u0001' })).replace('\u0001', '<span class="up">+' + money(diff) + '</span>');
    return '<p class="' + cls + '">' + t.replace(' (', '<br>(') + '</p>';
  }
  function periodPicker(p) {
    return '<label class="t3-period"><span>' + esc(T('period')) + '</span><select class="mkd-per" aria-label="' + esc(T('period')) + '" onchange="G4T3.period(this.value)">'
      + [[0, 'tabAll'], [365, 'tab1Y'], [90, 'tab3M'], [30, 'tab30D']].map(function (x) { return '<option value="' + x[0] + '"' + (p === x[0] ? ' selected' : '') + '>' + esc(T(x[1])) + '</option>'; }).join('') + '</select></label>';
  }
  /* A1 안2: 라벨 + 기간 → 큰 돈 + % → 비교·차이 두 줄 → 날짜 → 큰 곡선(끝 값) */
  function proof(s, p) {
    var r = series(s, p);
    return '<section class="t3-proof" data-period="' + p + '"><div class="t3-proof-top"><p>' + esc(T('heroSub')) + '</p>' + periodPicker(p) + '</div>'
      + '<div class="t3-money"><strong class="t3-final num" data-value="' + Math.round(r.final) + '">' + money(Math.round(r.final)) + '</strong><span class="num ' + (r.ret >= 0 ? 'up' : 'dn') + '">' + pct(r.ret) + '</span></div>'
      + compare(r, 't3-compare-line') + '<p class="t3-range">' + esc(T('since', { date: longDate(r.i0) })) + '</p>'
      + '<div id="t3-chart">' + curve(r, { animate: drawOnce(s, p), h: innerWidth <= 860 ? (copyFor(s) ? 140 : 168) : 224 }) + '</div></section>';
  }
  function now(s, row) {
    var ex = exOf(s), line = '';
    if (S.user && !row) line = '<p class="t3-exec">' + esc(T(linkedTo(s) ? 'execLinked' : 'execUnlinked', { ex: ex.name })) + '</p>';
    return '<section class="t3-now"><p class="t3-pos">' + esc(posLine(s, row)) + '</p><p class="t3-next">' + esc(T('next')) + ' <time>' + esc(nextTime()) + '</time></p>' + line + '</section>';
  }

  /* ── A2 안3: 판단 기록(굵은 사건 제목 + 한 줄 + 오른쪽 신호·체결), I11 ── */
  function recEn(m, s) {
    var t = String(m.t || ''), sym = mkTk(m.a || '') || '', out = [], x;
    if ((x = t.match(/^(.+?)를 체결가 \$([\d.,]+)에 (숏|롱) 진입했습니다\./))) out.push('Entered ' + WORD_EN[x[3]] + ' on ' + (sym || x[1]) + ' at fill price $' + x[2] + '.');
    else if ((x = t.match(/^(.+?)의 (롱|숏) 포지션을 체결가 \$([\d.,]+)에 청산했습니다\./))) out.push('Closed the ' + (sym || x[1]) + ' ' + WORD_EN[x[2]] + ' position at fill price $' + x[3] + '.');
    if ((x = t.match(/(\d+)일 평균선이 (\d+)일 평균선을 (아래|위)로 교차했습니다\./))) out.push(x[1] + '-day MA crossed ' + (x[3] === '아래' ? 'below' : 'above') + ' the ' + x[2] + '-day MA.');
    else if ((x = t.match(/투입 금액 대비 ([+-]?[\d.]+%)입니다\./))) out.push('Realized return after fees and funding: ' + x[1] + '.');
    return out.join(' ');
  }
  function recItem(s, m) {
    var body = ko() ? tbSent(skdText(m.t || ''), 2).head : recEn(m, s), times;
    if ((m.k === 'buy' || m.k === 'sell') && m.i != null) {
      /* R1(5단계 리허설): 체결은 표(mkOrders)와 같은 거래 원본 = 이벤트의 체결 봉(xi). 추적 손절처럼 그날 체결되면 신호와 같은 날.
         체결 봉을 모르는 기록만 예전처럼 다음 봉 */
      var ev = ((s.r && s.r.events) || []).filter(function (e) { return e.i === m.i && e.xi != null && e.t === (m.k === 'buy' ? 'enter' : 'exit') && (!m.a || !e.a || e.a === m.a); })[0];
      times = '<span>' + esc(T('signal', { t: stamp(mkWhen(s, m.i, m.a), true) })) + '</span><span>' + esc(T('fill', { t: stamp(mkWhen(s, ev ? ev.xi : m.i + 1, m.a), false) })) + '</span>';
    } else times = '<span>' + esc(m.ts || '') + '</span>';
    return '<li><div class="t3-rec-main"><b>' + esc(ko() ? skdText(m.tag || '') : (TAG_EN[m.tag] || '')) + '</b>' + (body ? '<p>' + esc(body) + '</p>' : '') + '</div><div class="t3-rec-time num">' + times + '</div></li>';
  }
  function records(s) {
    var ms = mkChatMsgs(s, s.r, 8).filter(function (m) { return m.k !== 'now' && m.k !== 'intro'; });
    if (!ms.length) return '';
    return '<section class="t3-records" aria-labelledby="t3-rec-t"><h2 id="t3-rec-t">' + esc(T('decTitle')) + '</h2><p class="t3-record-note">' + esc(T('decNote')) + '</p>'
      + '<ol>' + ms.slice(0, 2).map(function (m) { return recItem(s, m); }).join('') + '</ol>'
      + (ms.length > 2 ? '<details class="t3-more-records"><summary>' + esc(T('decMore')) + '</summary><ol>' + ms.slice(2).map(function (m) { return recItem(s, m); }).join('') + '</ol></details>' : '') + '</section>';
  }
  function orders(s) {
    var rows = mkOrders(s); if (!rows.length) return '';
    var cols = T('ordCols');
    var body = rows.slice(0, 3).map(function (x) {
      var px = ko() ? mkPxU(x.a, x.px) : (/포인트$/.test(mkPxU(x.a, x.px)) ? mkPxFmt(x.px) + ' pts' : '$' + mkPxFmt(x.px));
      var pnl = x.pnl != null ? '<span class="' + (x.pnl >= 0 ? 'up' : 'dn') + '">' + pct(x.pnl) + '</span>' : x.open ? esc(T('holding')) : '';
      return '<tr><td><b>' + esc(ko() ? mkTk(x.a) : enWords(mkTk(x.a))) + '</b></td><td>' + esc(ko() ? x.label : (TYPE_EN[x.label] || '')) + '</td><td class="num">' + esc(stamp(x.when, true)) + '</td><td class="num r">' + esc(px) + '</td><td class="num r">' + pnl + '</td></tr>';
    }).join('');
    return '<section class="t3-orders"><div class="t3-section-head"><h2>' + esc(T('ordTitle')) + '</h2><button class="t3-link" type="button" onclick="G4T3.orders()">' + esc(T('ordAll', { count: rows.length })) + '</button></div>'
      + '<p class="t3-order-note">' + esc(T('ordNote')) + '</p><div class="t3-tblw"><table class="t3-tbl"><thead><tr>' + cols.map(function (c, i) { return '<th' + (i > 2 ? ' class="r"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div></section>';
  }

  /* ── I4 주 단추 자리: 1440 따라오는 카드, 390 아래 고정 바 ── */
  function primaryLabel(s, row) { return row ? T('btnAdjust') : T('btnCopy', { amt: money(budget(s)) }); }
  function card(s, row) {
    var r = series(s, current && current.s.id === s.id ? current.per : per(state(s).per));
    if (row) return '<aside class="t3-action"><p class="t3-card-title">' + esc(T('barMine')) + '</p><strong class="t3-card-num num">' + money(row.d.value, true) + '</strong>'
      + '<p class="t3-card-ex">' + logo(s, 20) + '<span>' + esc(official(s)) + '</span></p>'
      + '<button id="t3-copy" class="t3-primary" type="button" onclick="G4T3.copy()">' + esc(T('btnAdjust')) + '</button>'
      + '<p class="t3-free"><button type="button" class="t3-link" onclick="G4T3.mine()">' + esc(T('myAssetLink', { amt: money(row.d.value, true) })) + '</button></p>'
      + '<div class="t3-secondary"><button class="t3-link" type="button" onclick="G4T3.verify()">' + esc(T('verify')) + '</button><button class="t3-link" type="button" onclick="G4T3.analyze()">' + esc(T('analyze')) + '</button></div></aside>';
    return '<aside class="t3-action"><p class="t3-card-title">' + esc(T('cardTitle')) + '</p><p class="t3-card-lb">' + esc(T('heroSub')) + '</p><strong class="t3-card-num num">' + money(Math.round(r.final)) + '</strong>'
      + '<p class="t3-card-ex">' + logo(s, 20) + '<span>' + esc(official(s)) + '</span></p>' /* R5b: 「최소 운용 금액 $X」 줄은 뺀다(R5 와 같은 규칙, 최소 미만은 복사 창 오류 줄) */
      + '<button id="t3-copy" class="t3-primary" type="button" onclick="G4T3.copy()">' + esc(primaryLabel(s, null)) + '</button>'
      + '<p class="t3-free">' + esc(S.user && linkedTo(s) ? T('linkedNote') : T('free')) + '</p>'
      + '<div class="t3-secondary"><button class="t3-link" type="button" onclick="G4T3.verify()">' + esc(T('verify')) + '</button><button class="t3-link" type="button" onclick="G4T3.analyze()">' + esc(T('analyze')) + '</button></div></aside>';
  }
  function bar(s, row) {
    var r = series(s, current && current.s.id === s.id ? current.per : per(state(s).per));
    var left = row ? '<span>' + esc(T('barMine')) + '</span><strong class="num">' + money(row.d.value, true) + '</strong>' : '<span>' + esc(T('barLabel')) + '</span><strong class="num">' + money(Math.round(r.final)) + '</strong>';
    return '<div class="t3-mobile-bar' + (row ? ' mine' : '') + '"><p class="t3-bar-n">' + left + '</p><button id="t3-mobile-copy" class="t3-primary" type="button" onclick="G4T3.copy()">' + esc(primaryLabel(s, row)) + '</button>'
      + (!row && !(S.user && linkedTo(s)) ? '<p class="t3-bar-free">' + esc(T('barFree')) + '</p>' : '') + '</div>';
  }

  mk3Head = function (s, ne, pd, watching) {
    if (!real(s)) return oldHead.apply(this, arguments);
    var row = copyFor(s);
    return '<header class="t3-header"><div><div class="t3-title-row"><h1>' + esc(name(s)) + '</h1>' + '</div>' /* 다듬기(4): 「현재 $X 복사 운용 중」 배지는 뺀다(바로 아래 「내 운용 자산」 줄과 같은 말, $1,000 이 한 화면에 네 번) */
      + '<p class="t3-sub">' + logo(s, 20) + '<span>' + esc(official(s)) + '</span><i aria-hidden="true">|</i><span>' + esc(T('follow', { count: Number(s.fw || 0).toLocaleString('en-US') })) + '</span></p></div>'
      + '<details class="t3-menu"><summary aria-label="' + esc(T('menu')) + '">⋯</summary><div><button type="button" onclick="tfSS3WatchTgl(\'' + ne + '\')">' + esc(T('watch')) + '</button>'
      + '<button type="button" onclick="tfSS3CopyLink(\'' + ne + '\',\'all\')">' + esc(T('link')) + '</button><button type="button" onclick="G4T3.analyze()">' + esc(T('analyze')) + '</button></div></details></header>';
  };
  mkOvTab = function (s, r, pd, ne) {
    if (!real(s)) return oldOverview.apply(this, arguments);
    var x = state(s), row = copyFor(s); current = { s: s, per: per(x.per), row: row, ne: ne };
    MKD.s = s; MKD.per = current.per; MKD.tab = 'bal'; MKD.gran = 'day'; MKD.eq = s.r.eq;
    return '<div class="t3-layout"><div class="t3-main">'
      + (row ? '<p class="t3-owned"><span>' + esc(T('barMine')) + '</span><strong class="num">' + money(row.d.value, true) + '</strong></p>' : '')
      + '<div id="t3-proof-host">' + proof(s, current.per) + '</div>' + now(s, row)
      + '<nav class="t3-mobile-secondary"><button class="t3-link" type="button" onclick="G4T3.verify()">' + esc(T('verify')) + '</button><button class="t3-link" type="button" onclick="G4T3.analyze()">' + esc(T('analyze')) + '</button></nav>'
      + records(s) + orders(s)
      + (ko() ? '<details class="t3-info"><summary>' + esc(T('info')) + '</summary><p>' + esc(mkOne(s)) + '</p>' + mkInfoTab(s, r, ne) + '</details>' : '')
      + '<p class="t3-help">' + esc(T('support')) + ' <button class="t3-link" type="button" onclick="tfTxHelp()">' + esc(T('supportLink')) + '</button></p>'
      + '</div>' + card(s, row) + '</div>' + bar(s, row);
  };
  /* K9: 개요 화면에 있을 때만, 그 전략의 자리만 저장한다(떠난 뒤 늦게 도는 저장이 T4 의 0 으로 덮지 않게) */
  function onOverview() { return !!document.querySelector('.t3-detail #t3-proof-host') && !!current && location.hash.indexOf(route(current.s)) === 0; }
  function preserve() {
    if (!onOverview()) return;
    var sc = $('g-scroll'), y = document.body.classList.contains('gft-doc') ? window.scrollY : sc ? sc.scrollTop : 0;
    /* K15: 「이전 판단 기록 보기」를 펼친 채 거래 내역으로 갔으면 돌아올 때도 펼쳐 둔다(접히면 본문이 짧아져 같은 자리로 못 돌아온다) */
    write(KEY, { id: current.s.id, per: current.per, y: y, more: !!document.querySelector('.t3-detail .t3-more-records[open]') });
  }
  /* K3: 새로고침 직전 자리도 남긴다(스크롤 멈출 때, pagehide). 복원은 본문 높이가 찰 때까지 몇 번 다시 */
  function scroller() { return document.body.classList.contains('gft-doc') ? null : $('g-scroll'); }
  function restoreY(y, n) {
    requestAnimationFrame(function () {
      var sc = scroller(); if (sc) sc.scrollTop = y; else window.scrollTo(0, y);
      var got = sc ? sc.scrollTop : window.scrollY;
      if (Math.abs(got - y) > 2 && n < 12) setTimeout(function () { if (onDetail()) restoreY(y, n + 1); }, 120);
    });
  }
  var saveT = 0;
  function saveSoon() { if (!onOverview()) return; clearTimeout(saveT); saveT = setTimeout(preserve, 150); }
  addEventListener('scroll', saveSoon, { passive: true, capture: true });
  addEventListener('pagehide', function () { if (onDetail()) preserve(); });
  function handoff() {
    if (!current) return null;
    preserve(); var s = current.s, h = D.save(s.id, budget(s)), r = series(s, 0);
    h.per = current.per; h.returnTo = route(s);
    h.face = { final: Math.round(r.final), bench: Math.round(r.benchFinal), ret: s.r.ret, since: r.i0, pos: D.pos(s) }; /* I10: T7 첫 카드가 같은 숫자로 시작하도록 */
    write(HANDOFF, h); return h;
  }
  D.save = function (id, amount) {
    var prev = read(HANDOFF), v = oldSave.apply(this, arguments);
    if (v) { var x = read(KEY); v.per = x && x.id === v.strategyId ? per(x.per) : prev && prev.strategyId === v.strategyId ? per(prev.per) : 0; write(HANDOFF, v); }
    return v;
  };
  /* 다듬기(2): 주소로 곧장 온 사람도 큰 숫자는 0초부터 끝 값(예전 0.6초 $1,000 세기는 뺐다. 세는 동안 바·카드 숫자와 달랐다) */
  /* K17: 부팅 때 저장 복원(STORE.load)과 부팅 재라우팅이 이미 그린 같은 상세를 0.6초쯤 뒤 한 번 더 그려 곡선이 끝 상태로 바뀌었다.
     같은 전략, 같은 탭, 같은 사람 상태, 같은 언어를 2.5초 안에 다시 그리라면 지금 화면을 그대로 둔다(기간, 예산, 언어가 바뀌면 다시 그림) */
  var lastSig = '', lastAt = 0;
  function sig(s, tab) {
    var row = copyFor(s), u = S.user ? (S.user.email || S.user.id || 'u') : '';
    return [s.id, tab || 'ov', u, row ? row.c.id + ':' + row.d.value + ':' + row.d.inv : '', D.linked().join(','), lang(), per(state(s).per)].join('|');
  }
  tfSS3DetailRender = function (ne, pd, tab) {
    var s; try { s = tfSSFind(decodeURIComponent(ne)); } catch (_) {}
    if (!real(s)) { var v0 = oldDetail.apply(this, arguments); if (s || window.TF_STATE_READY) reveal(); return v0; } /* 저장 복원 전 「없음」 판정 전이면 가린 채 둔다 */
    var k = sig(s, tab);
    if (k === lastSig && Date.now() - lastAt < 2500 && G.mode === 'tfss3d' && document.querySelector('#g-content .t3-detail') && !$('modal-auth').classList.contains('open')) return;
    var restore = state(s), v = oldDetail.apply(this, arguments), page = document.querySelector('#g-content .mk-detail');
    if (!page) return v;
    lastSig = k; lastAt = Date.now(); reveal();
    page.querySelectorAll(':scope > .g4-n1,:scope > a.g4-back').forEach(function (el) { el.remove(); });
    page.classList.add('t3-detail'); page.lang = ko() ? 'ko' : 'en'; document.body.classList.add('g4-t3');
    var nav = page.querySelector('.mk-dtabs'); if (nav) nav.hidden = true;
    var crumb = page.querySelector('.tfbk-bc'), ov = !tab || tab === 'ov';
    if (crumb) crumb.innerHTML = '<button type="button" class="t3-link t3-crumb" onclick="G4T3.' + (ov ? 'back' : 'overview') + '()">' + esc(ov ? T('back') : T('chatBack')) + '</button>';
    current = { s: s, per: per(restore.per), row: copyFor(s), ne: encodeURIComponent(s.id) };
    requestAnimationFrame(barHeight);
    sideEn();
    if (ov) {
      if (restore.more) { var more = page.querySelector('.t3-more-records'); if (more) more.open = true; }
      if (restore.y) restoreY(restore.y, 0);
      if (typeof MK_OV_KEEP !== 'undefined' && MK_OV_KEEP && MK_OV_KEEP.ne === ne) MK_OV_KEEP = null;
    } else {
      var body = page.querySelector('.mk-dbody');
      if (body && !body.classList.contains('t3-layout')) {
        var main = document.createElement('div'); main.className = 't3-main';
        while (body.firstChild) main.appendChild(body.firstChild);
        body.appendChild(main); body.classList.add('t3-layout'); body.insertAdjacentHTML('beforeend', card(s, current.row));
      }
      if (!page.querySelector('.t3-mobile-bar')) page.insertAdjacentHTML('beforeend', bar(s, current.row));
    }
    return v;
  };
  gContent = function () { cancelAnimationFrame(frame); clearTimeout(saveT); dropNotice(); document.body.classList.remove('g4-t3'); return oldContent.apply(this, arguments); };
  var listOpen = G4T2.open;
  G4T2.open = function (e, ne) {
    if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    var s = tfSSFind(decodeURIComponent(ne)); if (real(s)) write(KEY, { id: s.id, per: 0, y: 0 });
    return listOpen.apply(this, arguments);
  };
  mkdSet = function (k, v) { if (document.querySelector('.t3-detail') && k === 'per') return window.G4T3.period(v); return oldSet.apply(this, arguments); };
  var tradesGo = mkGoTrades;
  mkGoTrades = function (ne) { if (current) preserve(); return tradesGo.apply(this, arguments); };
  var oldAdjust = cpAdjCommit;
  /* K21: 앱의 예산 변경은 토스트를 부른 뒤 상세를 다시 그린다. 390 안내 줄이 먼저 본문을 올리고(57px) 다시 그리기에 지워지던 것 →
     누르기 전 스크롤을 그대로 두고, 토스트는 다시 그린 뒤 보이는 「내 운용 자산」 줄 아래에 낸다(1440 은 앱 토스트 그대로) */
  cpAdjCommit = function () {
    var on = !!document.querySelector('.t3-detail'), id = current && current.s.id;
    if (!(on && id)) return oldAdjust.apply(this, arguments);
    var sc = scroller(), y0 = sc ? sc.scrollTop : scrollY, said = [], keep = toast, v;
    toast = function (m) { said.push(m); };
    try { v = oldAdjust.apply(this, arguments); } finally { toast = keep; }
    if (sc) sc.scrollTop = y0; else scrollTo(0, y0);
    preserve(); lastSig = ''; tfSS3DetailRender(id, 'all', 'ov');
    sc = scroller(); if (sc) sc.scrollTop = y0; else scrollTo(0, y0); /* 복원(restoreY)은 다음 프레임이라 안내 자리를 고르기 전에 같은 자리로 */
    noticeAt = '.t3-detail .t3-owned'; try { said.forEach(function (m) { toast(m); }); } finally { noticeAt = ''; }
    return v;
  };
  /* I5: T4 는 고른 맥락(전략, 기간, $1,000)을 받는다. T4 의 가입·재생은 T4 몫 */
  var oldBTView = btView;
  btView = function () { var h = read('g4.t3.verify'); if (h && BT.s && h.strategyId === BT.s.id) { BT.per = h.per; BT.amt = h.budget; BT.R = null; write('g4.t3.verify', null); } return oldBTView.apply(this, arguments); };

  /* ── 복사 창 머리(A3 안3): 로고 + 이름 + 연동/연결 → 돈 → 비교 → 곡선. f(T1 예산 창), b(복사 창), c(예산 조정) 같은 결 ── */
  /* 390 바 높이를 QA 단추와 토스트 자리 계산에 넘긴다(I9) */
  function barHeight() { var b = document.querySelector('.t3-mobile-bar'); if (b && b.offsetHeight) document.documentElement.style.setProperty('--t3-bar-h', b.offsetHeight + 'px'); }
  function onDetail() { return !!document.querySelector('.t3-detail'); }
  /* 창의 숫자 = 상세에서 지금 고른 기간의 큰 숫자(목록 → 상세 → 가입 → 복사 창이 같은 값) */
  function curPer(s) { return current && current.s.id === s.id ? current.per : per(state(s).per); }
  function sheetHead(s, mode, row) {
    var r = series(s, curPer(s)), diff = Math.round(r.final) - Math.round(r.benchFinal), sub = mode === 'b' ? T('connected', { ex: exOf(s).name }) : mode === 'c' ? T('copyingTag') : official(s);
    var h = '<div class="t3s-head">' + logo(s, 28) + '<div><b>' + esc(name(s)) + '</b><span>' + esc(sub) + '</span></div></div>';
    if (mode === 'c') {
      var d = row.d;
      /* 문구표 #65 「내 운용 자산 {amt} (수익률 {ret})」를 라벨, 큰 금액, 괄호 수익률로 나눠 한 번만 보인다 */
      var m65 = T('myAsset', { amt: '\u0001', ret: pct(d.myPct * 100) }).split('\u0001');
      h += '<div class="t3s-money"><span>' + esc(m65[0].replace(/[:\s]+$/, '')) + '</span><strong class="num">' + money(d.value, true) + '<small>' + esc((m65[1] || '').trim()) + '</small></strong>'
        + '<p>' + esc(T('heroSub')) + ' ' + money(Math.round(r.final)) + '</p><p>' + esc(T('heroHold', { bench: money(Math.round(r.benchFinal)) })) + '</p></div>';
    } else {
      h += '<div class="t3s-money"><span>' + esc(T('heroSub')) + '</span><div><strong class="num">' + money(Math.round(r.final)) + '</strong><em class="' + (r.ret >= 0 ? 'up' : 'dn') + ' num">' + pct(r.ret) + '</em></div>'
        + (mode === 'auth' ? '' : '<p>' + esc(T('heroHold', { bench: money(Math.round(r.benchFinal)) })) + '</p>' + (diff > 0 ? '<p class="t3s-diff"><span class="up">+' + money(diff) + '</span> ' + esc(ko() ? '더 벌었습니다' : 'more earned') + '</p>' : '')) + '</div>';
    }
    return h + curve(r, { h: mode === 'auth' ? 72 : 84, legend: mode !== 'auth', tags: mode === 'c', cls: 'compact', animate: false });
  }
  var t1Sheet = mkFollowSheet;
  mkFollowSheet = function (ne) {
    var v = t1Sheet.apply(this, arguments);
    if (!onDetail()) return v;
    var id; try { id = decodeURIComponent(ne); } catch (_) { id = ne; }
    var s = tfSSFind(id); if (!real(s)) return v;
    try { fSheet(s); bSheet(s); } catch (e) { if (window.console) console.warn('g4-t3 sheet', e); }
    return v;
  };
  function fSheet(s) {
    var w = $('ss3-dlgw'); if (!w || !w.classList.contains('g4-budget-dialog') || w.classList.contains('t3s')) return;
    w.classList.add('t3s');
    var t = w.querySelector('#ss3-dlg-t'); if (t) t.textContent = T('copyTitle');
    var form = w.querySelector('.g4-budget-form'); if (!form) return;
    form.querySelectorAll('.g4-budget-strategy, .g4-budget-now, .g4-proof').forEach(function (n) { n.remove(); });
    form.insertAdjacentHTML('afterbegin', sheetHead(s, 'f'));
    var lb = form.querySelector('label[for="g4-budget"]'); if (lb) lb.textContent = T('budget');
    var mn = $('g4-budget-min'); if (mn) mn.style.display = 'none'; /* R2(5단계 리허설): 칸 밑 최소 금액 문장은 뺀다. 최소 미만이면 #g4-budget-error 가 알린다 */
    var go = $('g4-budget-next'); if (go) go.textContent = T('connect', { ex: exOf(s).name });
    form.insertAdjacentHTML('beforeend', '<p class="t3s-foot">' + esc(T('foot')) + '</p>');
    enFix();
  }
  function bSheet(s) {
    var w = $('mk-follow'); if (!w || w.classList.contains('t3s')) return;
    w.classList.add('t3s');
    var t = $('mk-f-t'); if (t) t.textContent = T('copyTitle');
    var st = w.querySelector('.skc-strat'); if (st) st.outerHTML = sheetHead(s, 'b');
    var fld = $('cps-amt-fld'), lb = fld && fld.querySelector('label'); if (lb) lb.textContent = T('budget');
    var hint = $('skc-amt-h'); if (hint) hint.style.display = 'none'; /* R2: 같은 문장을 b 창에서도 뺀다. 최소 미만이면 #cps-amt-err 가 알린다 */
    var loss = w.querySelector('.skc-pills') && w.querySelector('.skc-pills').closest('.skc-fld');
    if (loss) {
      var box = document.createElement('details'); box.className = 't3s-more';
      box.innerHTML = '<summary>' + esc(T('stopLabel')) + '</summary>';
      loss.parentNode.insertBefore(box, loss); box.appendChild(loss);
      var ll = $('skc-loss-l'); if (ll) ll.remove();
      lossDesc();
    }
    w.querySelectorAll('#mk-f-sum, .skc-more, #skc-adv').forEach(function (n) { n.hidden = true; n.style.display = 'none'; });
    var cta = $('cps-cta'); if (cta) cta.textContent = T('start');
    var foot = w.querySelector('.skc-foot'); if (foot) foot.textContent = T('foot');
    enFix();
  }
  function lossDesc() { var h = $('mk-f-lossh'); if (h && $('mk-follow') && $('mk-follow').classList.contains('t3s')) h.textContent = T('stopDesc', { pct: Math.abs(TF_MKF.loss || 20) }); }
  var oldLoss = skcLoss;
  skcLoss = function () { var v = oldLoss.apply(this, arguments); lossDesc(); return v; };
  var oldAdjRender = cpAdjRender;
  cpAdjRender = function (cid) {
    var v = oldAdjRender.apply(this, arguments);
    if (!onDetail()) return v;
    try { cSheet(cid); } catch (e) { if (window.console) console.warn('g4-t3 adjust', e); }
    return v;
  };
  function cSheet(cid) {
    var w = $('ss3-dlgw'), c = cpFind(cid); if (!w || !c) return;
    var s = tfSSFind(c.nick); if (!real(s)) return;
    var row = D.mine().find(function (x) { return x.c.id === cid; }); if (!row) return;
    w.classList.add('t3s', 't3s-adjust');
    var t = w.querySelector('#ss3-dlg-t'); if (t) t.textContent = T('adjTitle', { name: name(s) });
    var pnl = w.querySelector('.cpa-pnl');
    if (pnl) pnl.outerHTML = '<div class="t3s-adj-head">' + sheetHead(s, 'c', row) + '</div>';
    var tabs = w.querySelectorAll('.cpa-tgl button'); if (tabs[0]) tabs[0].textContent = T('tabAdd'); if (tabs[1]) tabs[1].textContent = T('tabOut');
    var bal = w.querySelector('.cps-bal'); if (bal) bal.textContent = T('avail', { amt: money(TF_CPA.dir === 'add' ? cpState().spot : cpCalc(c).avail, true) });
    var note = w.querySelector('.cpa-note'); if (note && TF_CPA.dir === 'add') note.textContent = T('adjNote');
    var go = $('cpa-go'); if (go) go.textContent = T('adjBtn');
    var cancel = w.querySelector('.acts3 .obtn'); if (cancel) cancel.remove();
    var amt = $('cpa-amt');
    /* K12(A3 c 안3): 「추가할 금액」 이름표 + f·b 창과 같은 큰 $ 칸. 「USD」와 파란 「최대」 칩은 뺀다 */
    var box = amt && amt.closest('.cps-in');
    if (box && !box.classList.contains('t3s-amt')) {
      box.classList.add('t3s-amt'); box.insertAdjacentHTML('afterbegin', '<i aria-hidden="true">$</i>'); amt.placeholder = '';
      var fld = box.closest('.cps-fld'); if (fld) fld.insertAdjacentHTML('beforebegin', '<label class="t3s-amt-l" for="cpa-amt">' + esc(T(TF_CPA.dir === 'add' ? 'addAmt' : 'outAmt')) + '</label>');
    }
    if (amt && amt.value === '' && TF_CPA.dir === 'add') { amt.value = Math.min(1000, Math.floor(cpState().spot)) || ''; if (amt.value) cpAdjSync(cid); }
    enFix();
  }

  /* 영어 화면의 복사 창: 앱이 그때그때 쓰는 오류·낭독 문구와 「최대」를 영어로(한국어를 남기지 않음) */
  var EN_MSG = [
    [/^최소 \$([\d,.]+)부터 시작할 수 있습니다$/, 'Minimum $$$1 to start'], [/^사용 가능 금액보다 큽니다$/, 'More than your available amount'],
    [/^0보다 큰 금액을 입력해주십시오$/, 'Enter an amount greater than $0'], [/^회수 가능 금액을 넘었습니다$/, 'More than the amount you can withdraw'],
    [/^복사 예산 (\$[\d,]+), 손실 (\d+)%에서 멈춤$/, 'Copy budget $1, stops at $2% loss'], [/^사용 가능 금액으로 맞췄습니다$/, 'Set to your available amount'], [/^최대$/, 'Max']
  ];
  function enFix() {
    if (ko()) return;
    document.querySelectorAll('.t3s #cps-amt-err, .t3s #cpa-err, .t3s #g4-budget-error, .t3s #mk-f-live, .t3s .mx, .t3s .g4-budget-adjusted').forEach(function (el) {
      var t = el.textContent.trim(); if (!t) return;
      for (var i = 0; i < EN_MSG.length; i++) if (EN_MSG[i][0].test(t)) { el.textContent = t.replace(EN_MSG[i][0], EN_MSG[i][1]); return; }
    });
  }
  var t1FormSync = cpFormSync;
  cpFormSync = function () { var v = t1FormSync.apply(this, arguments); enFix(); return v; };
  var t1AdjSync = cpAdjSync;
  cpAdjSync = function () { var v = t1AdjSync.apply(this, arguments); enFix(); return v; };
  if (window.G4T1 && G4T1.budgetSync) { var t1Budget = G4T1.budgetSync; G4T1.budgetSync = function () { var v = t1Budget.apply(this, arguments); enFix(); return v; }; }

  /* ── I6 가입 창: 열 때 기록 한 칸, 브라우저 뒤로 = 창만 닫고 같은 상세(claude 3e0cf4e 239~256줄) ── */
  var authBack = false, skipPop = false, oldClose = closeModal, oldAuthOpen = authOpen;
  function authOn() { var m = $('modal-auth'); return !!(m && m.classList.contains('open')); }
  /* K11: 상세에서 연 가입 창은 설명문 대신 A3 f 안3 머리 한 덩어리(로고, 이름, 「$1,000 넣었다면 지금 $X +%」, 작은 곡선). 다른 화면에서 열면 원래 창 */
  function authHeadOff() {
    document.querySelectorAll('#modal-auth .t3-au-head').forEach(function (n) { n.remove(); });
    var sub = document.querySelector('#au-start .au-sub'); if (sub) sub.style.display = '';
  }
  authOpen = function () {
    authHeadOff();
    var v = oldAuthOpen.apply(this, arguments);
    if (onDetail() && authOn()) {
      var title = document.querySelector('#au-start .au-title'), sub = document.querySelector('#au-start .au-sub');
      if (current && title) {
        try { title.insertAdjacentHTML('afterend', '<div class="t3s t3-au-head">' + sheetHead(current.s, 'auth') + '</div>'); if (sub) sub.style.display = 'none'; } catch (e) { authHeadOff(); }
      }
      if (!(history.state && history.state.g4t3Auth)) history.pushState({ g4t3Auth: true }, '', location.href);
    }
    return v;
  };
  closeModal = function (id) {
    if (id === 'modal-auth') setTimeout(function () { if (!authOn()) authHeadOff(); }, 400);
    return oldClose.apply(this, arguments);
  };
  /* K22: 닫는 길이 여럿이다(✕·바깥 누름 = closeModal, Esc = 앱 공통 keydown 이 open 클래스만 지움). 어느 길이든 창이 닫히는 순간
     I6 기록 칸이 남아 있으면 한 칸 뒤로 정리한다. 브라우저 뒤로로 닫을 때는 이미 그 칸을 지나왔으므로(state 에 g4t3Auth 없음) 그대로 */
  function authClosed() {
    setTimeout(function () { if (!authOn()) authHeadOff(); }, 400);
    if (authBack || !(history.state && history.state.g4t3Auth)) return;
    if (!S.user) { skipPop = true; history.back(); if (onDetail()) toast(T('authBack')); }
  }
  /* K23: 가입을 마치면(signupDone) 가입 창 칸을 T1 의 「닫힌 창」 칸으로 바꾼 뒤 진행한다. 곧 열리는 복사 창(g4-t1.js armOverlay)은
     새 칸을 쌓지 않고 이 칸을 다시 쓰고, 창이 안 열려도 뒤로가 이 칸을 건너뛴다(g4-t1.js popstate). 가입 칸이 남아 상세에서 뒤로 한 번이 헛돌던 것 */
  if (typeof signupDone === 'function') {
    var oldSignupDone = signupDone;
    signupDone = function () {
      if (history.state && history.state.g4t3Auth) {
        var resume = typeof tfIntentPeek === 'function' && (tfIntentPeek() || {}).kind === 'g4copy'; /* 가입 뒤 이어서 열 복사 창이 있나(T1 의도) */
        history.replaceState(Object.assign({}, history.state, { g4t3Auth: false, g4Overlay: false, g4ClosedOverlay: true }), '', location.href);
        /* T1 의 가입 뒤 이어하기(openSaved)는 이 칸을 상세 주소로 되돌린 뒤 복사 창 칸을 하나 더 쌓는다. 그 한 번만 이 칸에 다시 쓴다 */
        var push = history.pushState, undo = function () { if (history.pushState === once) history.pushState = push; }, once = function (st) {
          undo(); return (st && st.g4Overlay ? history.replaceState : push).apply(history, arguments);
        };
        history.pushState = once; setTimeout(undo, 3000);
        var v = oldSignupDone.apply(this, arguments);
        /* K24: 위 머리 「무료로 시작」처럼 이어서 열 복사 창이 없으면(T1 의도 없음) 아무도 이 칸을 다시 쓰지 않는다. 그대로 두면 뒤로 한 번이 같은 상세에서 헛돈다 → 한 칸 뒤로 정리.
           복사 창이 있는 길은 390 처럼 창이 늦게 열려도 위 한 번 다시 쓰기에 맡긴다 */
        if (!resume && history.pushState === once && history.state && history.state.g4ClosedOverlay) { undo(); skipPop = true; history.back(); }
        return v;
      }
      return oldSignupDone.apply(this, arguments);
    };
  }
  (function watchAuth() {
    var m = $('modal-auth'); if (!m) { addEventListener('DOMContentLoaded', watchAuth, { once: true }); return; }
    var was = authOn();
    new MutationObserver(function () { var on = authOn(); if (was && !on) authClosed(); was = on; }).observe(m, { attributes: true, attributeFilter: ['class'] });
  })();
  addEventListener('popstate', function () {
    if (skipPop) { skipPop = false; return; }
    if (authOn() && !(history.state && history.state.g4t3Auth) && onDetail()) { authBack = true; try { oldClose('modal-auth'); } finally { authBack = false; } setTimeout(function () { if (!authOn()) authHeadOff(); }, 400); }
  });
  /* K1(I10): 분석의 화면 확인 프레임은 옛 상세 선택자(.mk3-dh 등)만 기다려 새 상세에서 20초 뒤 실패했다.
     새 상세(.t3-detail 의 큰 돈)가 그려지면 준비로 본다. 끝까지 못 그리면 8초에 넘어가고, 분석은 첫 카드의 N1 숫자로 시작한다 */
  if (typeof anFrame === 'function') {
    anFrame = function (ne, pd, ok, fail) {
      var fr = document.createElement('iframe'); fr.className = 'an-frame'; fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
      fr.style.cssText = 'position:fixed;left:0;top:0;width:' + AN_W + 'px;height:' + AN_H + 'px;border:0;opacity:0;pointer-events:none;z-index:-1';
      fr.src = location.pathname + location.search + (location.search ? '&' : '?') + 'an=1#/share/s/' + ne + '/' + pd;
      var t0 = Date.now(), timer;
      fr.onload = function () {
        timer = setInterval(function () {
          var w = fr.contentWindow, d = fr.contentDocument; if (!w || !d) return;
          var ready = w.G && w.G.mode === 'tfss3d' && d.querySelector('.t3-detail .t3-final, .mk3-dh, .mk3-t, #g-content .mk3');
          if (ready) {
            clearInterval(timer);
            try { var st = d.createElement('style'); st.textContent = '#tf-devbtn,#tf-devpanel,#teth-help,.hw-fab,#hw-fab,[id^=hw-],.g-terms,.t3-mobile-bar{display:none!important} #g-scroll{scrollbar-width:none} html,body{overflow:hidden}'; d.head.appendChild(st); } catch (e) {}
            anLib(d, function () { setTimeout(function () { ok(fr); }, 500); }, function () { fail(); fr.remove(); }); return;
          }
          if (Date.now() - t0 > 8000) { clearInterval(timer); fail(); fr.remove(); }
        }, 250);
      };
      fr.onerror = function () { clearInterval(timer); fail(); fr.remove(); };
      document.body.appendChild(fr);
    };
  }
  /* K4(I9): 390 상세의 안내(사용량 소진 등)는 떠 있는 토스트 대신 「지금」 문장 바로 아래 한 줄로. 지금 문장이 화면 밖이면 바 바로 위 한 줄 */
  /* K8(I10): 화면 확인 프레임이나 캡처 라이브러리를 못 불러와도 「전략 페이지 열기 실패」로 끝내지 않는다.
     그 단계를 이 전략의 N1 카드(문구표 #71)로 마치고 분석을 바로 시작한다. 정상 경로는 index.html anShots 와 같다 */
  if (typeof anShots === 'function') {
    anShots = function (run, s, ne, pd) {
      var done; AN.gate = new Promise(function (r) { done = r; });
      var mine = function (st) { AN.own = 1; try { return actStep(run, st); } finally { AN.own = 0; } };
      var open = mine({ kind: 'fetch', title: '전략 페이지 여는 중' });
      var fin = function () { AN.gate = null; done(); };
      anFrame(ne, pd, function (fr) {
        open.done('전략 페이지 열기 완료', '', (Date.now() - open.st.t0) + 'ms');
        var i = 0;
        var next = function () {
          if (i >= AN_TABS.length) { AN.lastShotAt = Date.now(); setTimeout(function () { try { fr.remove(); } catch (e) {} }, 200); anHead(run, mkHook(s) + ' 전략을 분석하는 중'); fin(); return; }
          var tb = AN_TABS[i++], st = mine({ kind: 'fetch', title: tb[1] + ' 화면 확인 중' });
          anCapture(fr, ne, pd, tb[0], function (url, w, h) {
            if (url) { st.st.open = true; st.done(tb[1] + ' 화면 확인 완료', '<img class="an-shot" src="' + url + '" alt="' + tb[1] + ' 화면" width="' + w + '" height="' + h + '" loading="lazy">', w + '×' + h); }
            else st.fail(tb[1] + ' 화면 확인 실패', '화면을 가져오지 못했습니다. 다른 화면으로 계속합니다.');
            setTimeout(next, 300);
          });
        };
        next();
      }, function () {
        var r = series(s, 0), title = name(s) + ' / ' + T('heroSub') + ' ' + money(Math.round(r.final));
        var card = '<div class="an-n1"><b>' + esc(name(s)) + '</b><span>' + esc(T('heroSub')) + ' <strong class="num">' + money(Math.round(r.final)) + '</strong> <em class="up num">' + pct(s.r.ret) + '</em></span><span>' + esc(T('heroHold', { bench: money(Math.round(r.benchFinal)) })) + '</span></div>';
        open.st.open = true; open.done(title, card, '');
        anHead(run, mkHook(s) + ' 전략을 분석하는 중'); fin();
      });
      return AN.gate;
    };
  }
  /* K4·K10(I9): 390 상세의 안내(사용량 소진 등)는 떠 있는 토스트가 아니라 「지금」 문장 바로 아래 흐름 안의 한 줄.
     아무것도 덮지 않고(아래 글이 밀림), 바 뒤로 가면 그만큼만 본문을 올려 보이게 하고, 화면을 떠나면 바로 사라진다 */
  var noticeT = 0, noticeAt = '';
  function dropNotice() { clearTimeout(noticeT); document.querySelectorAll('.t3-notice').forEach(function (n) { n.remove(); }); }
  addEventListener('hashchange', dropNotice); addEventListener('popstate', dropNotice);
  var t3Toast = toast;
  toast = function (message) {
    var nowEl = document.querySelector('.t3-detail .t3-now');
    if (!onDetail() || innerWidth > 860 || !nowEl) return t3Toast.apply(this, arguments);
    dropNotice();
    var n = document.createElement('p'); n.className = 't3-notice'; n.setAttribute('role', 'status'); n.textContent = message;
    var bar = document.querySelector('.t3-mobile-bar'), barTop = bar ? bar.getBoundingClientRect().top : innerHeight;
    var at = nowEl;
    if (noticeAt) { /* K21: 예산 변경 뒤에는 본문을 움직이지 않는다. 「내 운용 자산」 줄이나 「지금」 줄 아래에 자리가 보이면 거기, 없으면 앱 토스트 */
      at = [document.querySelector(noticeAt), nowEl].filter(Boolean).find(function (e) { var q = e.getBoundingClientRect(); return q.top >= 64 && q.bottom < barTop - 60; });
      if (!at) return t3Toast.apply(this, arguments);
    }
    at.insertAdjacentElement('afterend', n);
    var r = n.getBoundingClientRect();
    var sc = scroller(), by = 0;
    if (r.bottom > barTop - 8) by = r.bottom - barTop + 12; else if (r.top < 64) by = r.top - 72;
    if (by) { if (sc) sc.scrollTop += by; else window.scrollBy(0, by); }
    if (!noticeAt) noticeT = setTimeout(dropNotice, 3200); /* 다듬기(1, codex M-C3): 예산 변경 확인은 지우지 않고 그 자리에 둔다(3.2초 뒤 지우면 본문이 40px 튐). 화면을 떠나거나 다음 안내가 오면 사라짐 */
  };
  /* K18(문구표 5.2): 영어 화면의 왼쪽 사이드바 빈 목록 「아직 없음」 → 「None yet」. 사이드바가 다시 그려져도 같게 */
  /* K20: 공통 메뉴의 펼친 라벨과 접힌 툴팁을 같은 언어로. en 이외의 메뉴는 원래 한국어 표시 유지 */
  var sideLabels = [
    ['#g-side [onclick="gHistory()"]', '연구 기록', 'Research'],
    ['#g-tf-dash-btn', 'AI 트레이딩', 'AI Trading'],
    ['#g-tf-share-btn', '전략 복사', 'Copy Trading'],
    ['#g-tf-cx-btn', '거래소 연결', 'Connect Exchange'],
    ['#g-guest-note + .g-sec', '최근', 'Recent']
  ];
  function sideEn() {
    sideLabels.forEach(function (row) {
      var el = document.querySelector(row[0]); if (!el) return;
      var labels = el.querySelectorAll('.lb, .lbp'), text = row[lang() === 'en' ? 2 : 1];
      (labels.length ? labels : [el]).forEach(function (n) { if (n.textContent !== text) n.textContent = text; });
    });
    if (ko()) return;
    document.querySelectorAll('#g-art-list .g-note, #g-sess-list .g-note').forEach(function (n) { if (n.textContent.trim() === TX.ko.none) n.textContent = T('none'); });
  }
  if (window.MutationObserver) {
    ['g-side', 'g-art-list'].forEach(function (id) { var el = $(id); if (el) new MutationObserver(sideEn).observe(el, { childList: true, subtree: true }); });
    new MutationObserver(sideEn).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  sideEn();
  /* K17: 상세 주소에 있는 동안 html.g4-detail(첫 칠하기 전 index.html 머리에서 붙임). 다운로드 띠와 그 자리 64px 를 처음부터 뺀다 */
  function detailFlag() { var on = /^#\/share\/s\//.test(location.hash); document.documentElement.classList.toggle('g4-detail', on); if (!on) reveal(); }
  /* K19: 상세 주소로 곧장 왔을 때 상세를 그릴 때까지 가린 본문(html.g4-detail-wait, index.html 머리)을 그린 순간 푼다. 다른 주소로 가도 푼다 */
  function reveal() { document.documentElement.classList.remove('g4-detail-wait'); }
  addEventListener('hashchange', detailFlag); detailFlag();
  /* K7(I9): QA 단추는 주소에 ?qa=1 이 있을 때만(PO 12:57 판정) */
  function qaFlag() { return /[?&]qa=1(?:&|$)/.test(location.search) || /[?&]qa=1(?:&|$)/.test(location.hash); }
  function qaSync() { document.documentElement.classList.toggle('t3-qa', qaFlag()); }
  qaSync(); addEventListener('hashchange', qaSync);
  /* 언어를 바꾸면 상세를 그 자리에서 다시 그린다(곡선은 그리지 않음) */
  if (typeof glcSetLang === 'function') {
    var gl0 = glcSetLang;
    glcSetLang = function () { var r = gl0.apply(this, arguments); try { if (onDetail() && current) { preserve(); lastSig = ''; tfSS3DetailRender(current.ne, 'all', 'ov'); } sideEn(); } catch (_) {} return r; };
  }

  window.G4T3 = {
    series: series, curve: curve, T: T,
    period: function (v) {
      if (!current) return; current.per = per(v); MKD.per = current.per; preserve();
      var host = $('t3-proof-host'); if (host) host.innerHTML = proof(current.s, current.per);
      var row = copyFor(current.s), b = document.querySelector('.t3-mobile-bar'); if (b) b.outerHTML = bar(current.s, row);
      var a = document.querySelector('.t3-action'); if (a) a.outerHTML = card(current.s, row); requestAnimationFrame(barHeight);
      handoff();
    },
    copy: function () { if (!current) return; var row = copyFor(current.s); handoff(); if (row) { cpAdjDlg(row.c.id); return; } cpSetupGo(current.ne); },
    orders: function () { if (current) { preserve(); mkGoTrades(current.ne); } },
    overview: function () { if (current) mkBackOv(current.ne); },
    back: function () { if (!current) return; preserve(); G4T2.back(current.ne); },
    verify: function () { if (!current) return; var h = handoff(); write('g4.t3.verify', h); btOpen(current.ne); },
    mine: function () { var row = current && copyFor(current.s); if (!row) return; try { sessionStorage.setItem('g4.t1.selectedCopy', row.c.id); } catch (_) {} tfNav('#/trade'); },
    analyze: function () {
      if (!current) return; var h = handoff();
      if (!S.user) { tfSS3Ask(current.ne, 'all'); return; }
      var here = location.href;
      /* K2: 사용량이 막힌 사람은 기록·주소를 건드리기 전에 막고 상세에 그대로 둔다(안내는 I9 자리) */
      if (typeof aiGate === 'function' && aiGate('new') === 'block') { tfSS3Ask(current.ne, 'all'); try { history.replaceState(history.state, '', here); } catch (_) {} return; }
      /* tfSS3Ask 는 지금 기록 칸을 대화 주소로 바꾼다. 상세 칸을 하나 더 쌓아 두어 뒤로 한 번 = 상세(I10) */
      try { history.pushState(null, '', here); } catch (_) {}
      tfSS3Ask(current.ne, 'all');
      if (G.mode === 'tfss3d') { try { history.replaceState(history.state, '', here); } catch (_) {} return; } /* 다른 이유로 대화에 못 들어갔으면 주소 복구(codex 4ca3056 방어) */
      var content = $('g-content');
      if (content && !content.querySelector('.t3-return')) content.insertAdjacentHTML('afterbegin', '<a class="t3-return t3-link" href="' + esc(h.returnTo) + '">' + esc(T('chatBack')) + '</a>');
    }
  };
  if (/^#\/share\/s\//.test(location.hash) && window.TF_STATE_READY) tfRoute();
})();
