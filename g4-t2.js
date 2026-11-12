/* G4/T2 전략 복사 목록(claude 뼈대, 4단계 통합). 흐름 계약 sprint/G4/T2/sketch/claude/flow.md, 계획 sprint/G4/T2/integrate-plan.md
   T1(g4-t1.js) 위에 얹는다. 숫자는 전부 G4T1Data.results(= btCompute, amt 1000)에서 받는다. 문구 정본 sprint/G4/T2/copy/table-v1.md */
(function () {
  'use strict';
  var D = G4T1Data, LIST = '#/trade/strategies', PER = 10, POS = 'g4.t2.pos', FROM = 'g4.t2.from', LAST = 'g4.t2.last', COUNTED = 'g4.t2.counted';
  var t1Hub = tfShareHub, t1NF = tfNFRoute, t1Detail = tfSS3DetailRender, t1Card = mkCard, oldContent = gContent;
  /* R1(S8, K1 대체): 그 숫자를 처음 보는 사람만 $1,000 부터 센다. count = entry ∈ {direct, reload, home-nav}.
     direct·reload = 이 문서가 목록 주소로 열린 뒤 첫 그리기(landed), home-nav = 사이드바·메뉴 「전략 복사」(tfShareView). T1 링크, 상세에서 뒤로는 끝 값 0초부터 */
  var landed = false, landedDrawn = false, navEntry = false;
  var drawing = false, expanded = false, sig = null, keepOpen = false, backId = null, reloadY = null, drawn = null;
  var KIND = { agent: 1, rule: 1, mix: 1 }, MKT = { crypto: 1, stock: 1, index: 1, multi: 1 };
  /* 문구 7개 언어(K5 링크, K9 빈 결과). 정본 sprint/G4/T2/copy/ (카피 주인 1.3 agy) */
  var TX = {
    linkMy: { ko: '{ex} 전략 {n}개 둘러보기 →', en: 'Explore {n} {ex} strategies →', ja: '{ex}の{n}戦略を見る →', 'zh-CN': '浏览 {n} 个 {ex} 策略 →', 'zh-TW': '瀏覽 {n} 個 {ex} 策略 →', es: 'Explorar {n} estrategias de {ex} →', fr: 'Découvrir {n} stratégies {ex} →' },
    linkAll: { ko: '전체 {n}개 전략 둘러보기 →', en: 'Explore all {n} strategies →', ja: '全{n}の戦略を見る →', 'zh-CN': '浏览全部 {n} 个策略 →', 'zh-TW': '瀏覽全部 {n} 個策略 →', es: 'Explorar las {n} estrategias →', fr: 'Découvrir les {n} stratégies →' },
    emptyMkt: { ko: '이 시장에는 없지만, 다른 시장에 {ex} 전략 {n}개가 있습니다.', en: 'None in this market, but {n} {ex} strategies are active in other markets.', ja: 'この市場にはありませんが、他の市場に{ex}戦略が{n}件あります。', 'zh-CN': '该市场暂无策略，但在其他市场有 {n} 个 {ex} 策略。', 'zh-TW': '此市場暫無策略，但在其他市場有 {n} 個 {ex} 策略。', es: 'No hay en este mercado, pero hay {n} estrategias de {ex} en otros mercados.', fr: "Aucune dans ce marché, mais {n} stratégies {ex} sont disponibles sur d'autres marchés." },
    /* 시장이 아닌 조건(종류, 검색)으로 0개일 때. 확정본(table-v2-K)에 없는 경우라 1.3 확인 대기 */
    /* K17(agy-copy-k2 권고 영어): 빈 결과 문장과 단추, 상담 줄. 다른 언어는 한국어로 둔다(카피 주인 확정 전) */
    viewAll: { ko: '전체 보기', en: 'View all' },
    emptyGuest: { ko: '조건에 맞는 전략이 없습니다', en: 'No strategies match your filters' },
    resetFlt: { ko: '필터 초기화', en: 'Reset filters' },
    helpLine: { ko: '막히면 상담원이 24시간 답합니다.', en: 'Need help? 24/7 agent is available.' },
    helpBtn: { ko: '상담원에게 묻기', en: 'Ask agent' },
    emptyFlt: { ko: '{ex}에서 실행하는 전략 중 이 조건에 맞는 것은 없습니다.', en: 'No {ex} strategies match these filters.', ja: 'この条件に合う{ex}の戦略はありません。', 'zh-CN': '没有符合这些条件的 {ex} 策略。', 'zh-TW': '沒有符合這些條件的 {ex} 策略。', es: 'Ninguna estrategia de {ex} coincide con estos filtros.', fr: 'Aucune stratégie {ex} ne correspond à ces filtres.' }
  };
  function tx(k, v) { var e = TX[k] || {}, l = (window.GLC && GLC.lang) || 'ko', t = e[l] || e.ko || k; return t.replace(/\{(\w+)\}/g, function (_, n) { return v && v[n] != null ? v[n] : ''; }); }
  function help() { return '<p class="cq-help mk-help">' + gEsc(tx('helpLine')) + ' <button type="button" class="pl-link" onclick="tfTxHelp()">' + gEsc(tx('helpBtn')) + '</button></p>'; } /* K17: 그릴 때마다 지금 언어로 */

  function base() { return location.pathname + location.search; }
  /* K1·K12: 저장된 로그인이 없으면 복원할 것이 없으니 곧장 그린다. 있으면 복원이 끝난 뒤(TF_STATE_READY)에만.
     부팅 0.9초 타이머(TF_BOOTED)는 복원과 무관하게 켜지므로 세지 않는다(복원 전 전체 목록을 그렸다가 내 거래소 목록으로 바꾸던 것).
     복원 부팅을 안 쓰는 화면(?ui=classic)이나 9초가 지나도 복원이 안 끝나면 그때 그린다 */
  var forced = false;
  function saved() { try { var p = JSON.parse(localStorage.getItem('teth.state') || 'null'); return !!(p && p.v && p.user); } catch (_) { return false; } }
  function ready() { return !!(forced || window.TF_STATE_READY || !saved() || (window.TF_BOOTED && !window.ANTIGRAVITY_RESEARCH_UI)); }
  /* K15: 복원을 기다리는 동안 본문을 숨기지 않는다. 목록 주소에 있을 때만 카드 틀(index.html G4L_SKEL_DRAW, 이름 없이 $1,000)을 그리고
     목록 화면 상태(TF_ONNF)로 둔다. 그래야 앞판처럼 기다리는 중에 어디로 나가도 원래 라우터가 그 화면을 그린다(T1 g4-entry 숨김도 푼다) */
  function hold(on) {
    on = !!on && onList();
    document.documentElement.classList.toggle('g4l-wait', on);
    if (!on) return;
    try { if (window.G4L_SKEL_DRAW) G4L_SKEL_DRAW(); } catch (_) {}
    window.TF_ONNF = true; document.documentElement.classList.remove('g4-entry');
  }
  /* K15: 목록 밖으로 나가는 길(다른 라우트, 본문 교체, 새 전략, 주소 바뀜)에서 대기를 바로 푼다.
     틀 표시(html.g4l-skel: 보조 칸 숨김 등)는 틀이 화면에서 실제로 사라졌을 때만 걷는다. T1 이 복원 뒤에 그리는 #/trade 처럼 틀이 남아 있는 동안 보조 칸이 위 단추에 겹쳐 뜨지 않게 */
  function leave() { hold(false); if (!document.querySelector('#g-content article.g4l-skel')) document.documentElement.classList.remove('g4l-skel'); }
  function sigNow() { var c = []; try { c = tfMyExConn(); } catch (_) {} return location.hash + '|' + (S.user ? S.user.email || 1 : 0) + '|' + c.join(',') + '|' + (c.length ? tfMyExGet() : '') + '|' + ((window.GLC && GLC.lang) || 'ko'); }
  function onList() { var h = location.hash; return h === LIST || h.indexOf(LIST + '?') === 0; }
  function ssGet(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function docScroll() { return document.body.classList.contains('gft-doc'); }
  function getY() { var sc = $('g-scroll'); return docScroll() ? window.scrollY : (sc ? sc.scrollTop : 0); }
  function setY(y) { var sc = $('g-scroll'); if (docScroll()) window.scrollTo(0, y); else if (sc) sc.scrollTop = y; }
  function real(s) { return !!(s && s.cfg && !s.me); }
  function fin(s, per) { return real(s) ? D.results(s, per || 0).final : -1e18; }
  function win(s) { return fin(s) > 1000 ? 1 : 0; }
  function day(i) { var d = idxToDate(i); return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.'; }
  function pct(v) { var x = (v / 1000 - 1) * 100; return '(' + (x >= 0 ? '+' : '-') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%)'; }
  /* 기록 상태(T1 의 창 표시 g4Overlay 등)를 지우지 않고 주소만 바꾼다 */
  function replace(h) { try { history.replaceState(history.state, '', base() + h); } catch (_) {} }

  /* 카드 곡선: 전략 실선 + 그냥 들고 있기 점선, 같은 높이 범위(I6, 시안 S1 안1). 범례 없음 */
  function spark(r) {
    var W = 170, H = 78, pad = 5, eq = r.eq || [], bh = r.bench || [], n0 = eq.length, N = Math.min(140, n0), a = [], h = [], j;
    if (n0 < 2) return '<span class="mk-spark"></span>';
    for (j = 0; j < N; j++) { var k = Math.round(j * (n0 - 1) / (N - 1)); a.push(eq[k].v); if (bh.length === n0 && isFinite(bh[k])) h.push(bh[k]); }
    var all = a.concat(h), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi - lo < 1e-9) { hi = lo + 1; }
    var path = function (arr) { var d = ''; for (var i = 0; i < arr.length; i++) d += (i ? 'L' : 'M') + (1 + i / (arr.length - 1) * (W - 2)).toFixed(1) + ' ' + (pad + (1 - (arr[i] - lo) / (hi - lo)) * (H - pad * 2)).toFixed(1); return d; };
    return '<svg class="mk-spark g4l-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'
      + (h.length === a.length ? '<path d="' + path(h) + '" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>' : '')
      + '<path d="' + path(a) + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* 주소 ↔ 목록 상태(종류, 정렬, 시장, 검색, 펼침) */
  function url() {
    var t = tfSSState(), q = []; mkSortKey(t);
    if (KIND[t.ss.kind]) q.push('kind=' + t.ss.kind);
    if (t.ss.sort === 'fw') q.push('sort=fw');
    if (MKT[t.ss.asset]) q.push('mkt=' + t.ss.asset);
    if (TF_SS_Q) q.push('q=' + encodeURIComponent(TF_SS_Q));
    if (expanded) q.push('more=1');
    return LIST + (q.length ? '?' + q.join('&') : '');
  }
  function setUrl() { replace(url()); }
  function parse(h) {
    var t = tfSSState(), p = {}; mkSortKey(t);
    (h.split('?')[1] || '').split('&').forEach(function (x) { var i = x.indexOf('='); if (i > 0) p[x.slice(0, i)] = x.slice(i + 1); });
    t.ss.kind = KIND[p.kind] ? p.kind : 'all';
    t.ss.sort = p.sort === 'fw' ? 'fw' : 'pick'; t.ss.dir = 'desc'; /* 옛 ?sort=y1 은 기본으로(I8) */
    t.ss.asset = MKT[p.mkt] ? p.mkt : 'all';
    var q = ''; try { q = decodeURIComponent(p.q || ''); } catch (_) {}
    TF_SS_Q = q.trim(); expanded = p.more === '1';
    tfSave();
  }

  /* 걸러 내고 세운 줄. 기본 = 전체 기간 금액순 */
  function rowsNow(asset) {
    var t = tfSSState(), rows = tfSSRows(), k = mkSortKey(t), m = asset || t.ss.asset;
    if (m && m !== 'all') rows = rows.filter(function (s) { return s.mkt === m; });
    if (t.ss.kind && t.ss.kind !== 'all') rows = rows.filter(function (s) { return (s.kind || 'rule') === t.ss.kind; });
    if (TF_SS_Q) {
      var q = TF_SS_Q.toLowerCase();
      rows = rows.filter(function (s) { return [s.nick, s.asset, mkTitle(s), s.one || '', s.by ? '@' + s.by : '', s.id || '', mkOldNames(s.id), MK_KIND[s.kind] || '', mkUni(s).list.join(' '), mkUni(s).list.map(mkTk).join(' '), mkTk(s.asset || '')].join(' ').toLowerCase().indexOf(q) >= 0; });
    }
    if (typeof tfMyExFilter === 'function') rows = tfMyExFilter(rows);
    /* K6: 복사한 사람순 = [끝 값 > $1,000 먼저, 그다음 따라가는 사람 큰 순]. 숫자는 그대로 */
    rows.sort(k === 'fw' ? function (a, b) { return win(b) - win(a) || (b.fw || 0) - (a.fw || 0) || fin(b) - fin(a); }
      : function (a, b) { return fin(b) - fin(a); });
    return rows;
  }

  function card(s) {
    if (!s.kind) s.kind = 'rule';
    if (!real(s)) return t1Card(s);
    var r = D.results(s, 0), ne = tfSS3Rid(s), ex = mkEx(s), money = Math.round(r.final), hold = Math.round(r.benchFinal), now = mkNowLine(s);
    return '<article class="mk-card skf g4l k-' + s.kind + (backId && backId === ne ? ' g4l-back' : '') + '" role="link" tabindex="0" data-id="' + gEsc(s.id) + '" data-ne="' + gEsc(ne) + '" aria-label="' + gEsc(mkHook(s)) + ' 전략 보기" onclick="G4T2.open(event,\'' + ne + '\')" onkeydown="G4T2.open(event,\'' + ne + '\')">'
      + '<div class="skf-top">' + mkGlyph(s, 28) + '<div class="skf-nm"><h3>' + gEsc(mkHook(s)) + '</h3><span><img src="assets/logos/' + ex[0] + '.png" alt="" width="14" height="14" decoding="sync">' + MK_KIND[s.kind] + ', ' + ex[1] + '에서 실행</span></div></div>'
      + '<div class="skf-perf g4l-perf"><div class="skf-ret"><small>$1,000 넣었다면 지금</small><div class="g4l-amtrow"><b class="num g4l-amt" data-to="' + money + '">' + cpUsd(money, 0) + '</b><span class="num g4l-pct ' + (r.final >= 1000 ? 'up' : 'dn') + '" data-to="' + r.final + '">' + pct(r.final) + '</span></div></div>' + spark(r) + '</div>'
      + '<div class="g4l-info">'
      + '<p class="g4l-sub num">그냥 들고 있었다면 ' + cpUsd(hold, 0) + ', ' + day(r.i0) + '부터</p>'
      + '<span class="g4l-min num">최소 ' + cpUsd(mkMin(s), 0) + '</span>'
      + '<span class="g4l-now">' + (now ? '지금 ' + gEsc(now) : '') + '</span>'
      + '<span class="skf-fw g4l-fw">' + (s.fw ? mkFwHtml(s.fw) : '') + '</span>'
      + '<span class="g4l-go" aria-hidden="true">이 전략 보기</span>'
      + '</div></article>';
  }
  mkCard = tfSS3Card = card;

  /* 목록 본문: 되풀이 없음, 열 장 뒤 더 보기, 끝 줄 */
  tfSS3GridHtml = function () {
    var t = tfSSState(), rows = rowsNow(), my = typeof tfMyExOn === 'function' && tfMyExOn(), note = '';
    var s2 = [t.ss.asset, t.ss.kind, TF_SS_Q, t.ss.sort, my ? tfMyExGet() : ''].join('|');
    if (sig !== s2) { if (!keepOpen) expanded = false; sig = s2; }
    if (my) {
      var nm = gEsc(tfMyExNames(tfMyExIds()));
      if (!rows.length) {
        /* K9(table-v2-K): 고른 시장에만 없으면 다른 시장의 개수를 말하고, 「전체 보기」는 시장만 되돌린다(내 거래소는 그대로). 개수 = 되돌린 뒤 보이는 카드 수 */
        var ex = tfMyExNames(tfMyExIds()), n0 = TF_MYEX_N, other = MKT[t.ss.asset] ? rowsNow('all').filter(real).length : 0; TF_MYEX_N = n0;
        return empty('<div class="myex-empty"><p>' + gEsc(other ? tx('emptyMkt', { ex: ex, n: other }) : tx('emptyFlt', { ex: ex })) + '</p><button type="button" class="pl-link" onclick="' + (other ? 'G4T2.allMarkets()' : 'tfMyExSet(\'\')') + '">' + gEsc(tx('viewAll')) + '</button></div>');
      }
      note = '<p class="myex-note">' + nm + '에서 바로 실행할 수 있는 전략 ' + rows.length + '개입니다.</p>';
    }
    if (!rows.length) return empty('<div class="ss3-empty">' + gEsc(tx('emptyGuest')) + '<br><button type="button" class="mk-btn2" style="margin-top:16px" onclick="tfSS3Reset()">' + gEsc(tx('resetFlt')) + '</button></div>');
    emptyFlag(false);
    var shown = expanded ? rows : rows.slice(0, PER), rest = rows.length - shown.length;
    return note + '<div class="mk-grid mk3-grid g4l-grid">' + shown.map(mkCard).join('') + '</div>'
      + (rest > 0 ? '<div class="g4l-morew"><button type="button" class="g4l-more" onclick="G4T2.more()">나머지 ' + rest + '개 더 보기</button></div>' : endLine(rows.length)) + help();
  };
  /* K10: 빈 결과는 떠 있는 상담 단추를 숨기고 24시간 한 줄만 둔다(DESIGN_PROMPT 4절) */
  function emptyFlag(on) { document.body.classList.toggle('g4l-empty', !!on); }
  function empty(html) { emptyFlag(true); return html + help(); }
  /* 끝 문장(I4): 31개 전부를 다 보였을 때, R3: 내 거래소 목록 전부(조건 없음, 예 Bitget 12개)를 다 보였을 때 */
  function myAll() { var t = tfSSState(); return typeof tfMyExOn === 'function' && tfMyExOn() && (t.ss.asset || 'all') === 'all' && (t.ss.kind || 'all') === 'all' && !TF_SS_Q; }
  function endLine(n) { return n && (n === allCount() || myAll()) ? '<p class="g4l-end">' + n + '개 전략을 모두 봤습니다</p>' : ''; }
  function allCount() { return tfSSRows().filter(real).length; }
  /* 머리 한 줄의 개수 = 시장, 검색을 건 뒤 줄 수(종류 탭은 전체일 때만 이 줄, 내 거래소가 켜지면 안내 한 줄만: 시안 S2 안1) */
  function headCount() { return rowsNow().filter(real).length; }
  function headLine() { var n = headCount(); return n ? '전략 ' + n + '개가 같은 $1,000을 굴린 결과입니다.' : ''; } /* K8: 0개면 줄 없음 */

  /* 조작 줄: 제목, 정렬 이름, 전체일 때 한 줄 */
  var c0 = mk3Controls;
  mk3Controls = function (t) {
    var d = document.createElement('div'); d.innerHTML = c0.apply(this, arguments);
    var sort = mkSortKey(t), sel = d.querySelector('.skf-sort select'), row = d.querySelector('.mk3-kindrow');
    if (sort === 'win') sort = 'pick';
    if (sel) sel.innerHTML = [['pick', '전체 기간 금액순'], ['fw', '복사한 사람순']].map(function (o) { return '<option value="' + o[0] + '"' + (sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    if (row && !row.querySelector('.mk3-kindhelp') && !(typeof tfMyExOn === 'function' && tfMyExOn())) row.insertAdjacentHTML('beforeend', '<p class="mk3-kindhelp one g4l-count"' + (headLine() ? '' : ' hidden') + '>' + headLine() + '</p>');
    return '<h1 class="g4l-h1">전략 복사</h1>' + d.innerHTML;
  };

  /* 그리기: T1 통합본의 목록 그리기를 그대로 부르고 주소만 상태에 맞춘다 */
  function draw(o) {
    o = o || {};
    keepOpen = !!o.keep; backId = o.restore && o.restore.id || null;
    var st = history.state;
    drawing = true;
    try { replace(LIST); t1Hub('find'); } finally { keepOpen = false; backId = null; drawing = false; }
    try { history.replaceState(st, '', base() + url()); } catch (_) {} /* T1 showList 가 비운 기록 상태를 되돌린다 */
    document.body.classList.add('g4-list'); hold(false); document.documentElement.classList.remove('g4l-skel'); /* K14 틀 끝 */
    document.body.classList.remove('has-banner'); /* K4: 다운로드 띠는 홈에만. 0.3초 감시를 기다리지 않고 첫 프레임부터 뺀다 */
    drawn = sigNow();
    var page = document.querySelector('#g-content .ss3'), back = page && page.querySelector('.g4-back');
    if (back && !ssGet(FROM)) back.remove();
    if (o.restore) { setY(o.restore.y); if (o.fresh) enter(); requestAnimationFrame(function () { setY(o.restore.y); }); } /* R1: 새로고침은 되돌린 자리에서 같은 프레임에 센다(끝 값이 한 프레임 먼저 보이지 않게) */
    else if (o.fresh) enter();
  }
  /* 새로 들어온 첫 화면만: 큰 금액이 $1,000 에서 제 값으로(K1: 곡선과 로고는 첫 프레임부터 다 그려 둔다) */
  function enter() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
    var g = document.querySelector('#ss3-grid .g4l-grid'); if (!g) return;
    var els = [], el = 0, last = null;
    [].forEach.call(g.querySelectorAll('.g4l-amt'), function (b) { var r = b.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) els.push({ b: b, to: +b.dataset.to, pc: b.parentNode.querySelector('.g4l-pct') }); });
    function paint(e) { els.forEach(function (x) { var v = 1000 + (x.to - 1000) * e; x.b.textContent = cpUsd(Math.round(v), 0); if (x.pc) x.pc.textContent = pct(1000 + (+x.pc.dataset.to - 1000) * e); }); }
    paint(0);
    /* K1: 진행은 실제로 그려진 프레임마다 더한다. 부팅 직후 막힌 프레임 하나가 세기를 건너뛰지 않게 한 프레임에 최대 50ms */
    requestAnimationFrame(function tick() {
      var now = performance.now();
      if (last != null) el += Math.min(50, now - last);
      last = now;
      var p = Math.max(0, Math.min(1, el / 600));
      paint(1 - Math.pow(1 - p, 2));
      if (p < 1) requestAnimationFrame(tick);
    });
  }

  gContent = function () { document.body.classList.remove('g4-list'); var r = oldContent.apply(this, arguments); if (!drawing) leave(); return r; }; /* K15: 목록 그리기 밖의 본문 교체(거래소 연결처럼 주소가 목록 그대로인 화면 포함)는 목록을 떠난 것 */ /* g4l-empty 는 목록(g4-list)에서만 듣고, 목록을 그릴 때마다 다시 정한다 */

  tfShareHub = function (tab) {
    if (tab === 'follow') { tfNav('#/trade'); return; }
    if (onList()) { navEntry = false; draw({}); return; }
    expanded = false;
    tfNav(url());
  };
  tfNFRoute = function (h) {
    if (h === LIST || h.indexOf(LIST + '?') === 0) {
      /* K1: 확정 목록을 한 번만 그린다. 저장된 로그인이 있으면 복원 뒤에 그리고(복원 전 임시 목록 없음),
         부팅 재라우팅이 같은 상태로 다시 부르면 그리지 않는다(세던 숫자를 끝 값으로 덮지 않게) */
      if (!ready()) { hold(true); return true; }
      if (G.mode === 'tfss3' && drawn === sigNow() && document.querySelector('#ss3-grid .g4l-grid, #ss3-grid .myex-empty, #ss3-grid .ss3-empty')) return true;
      var pm = G.mode, pos = ssGet(POS), back = pm === 'tfss3d' && pos && pos.url === h;
      var reload = reloadY != null && reloadY.url === h;
      if (pm === 'nfmain') ssSet(FROM, 1); else if (pm !== 'tfss3d' && pm !== 'tfss3' && !reload) ssSet(FROM, null);
      parse(h);
      var count = !back && ((landed && !landedDrawn) || navEntry); landedDrawn = true; navEntry = false; /* R1 */
      draw({ keep: true, restore: back ? pos : reload ? { y: reloadY.y } : null, fresh: count });
      ssSet(POS, null);
      return true;
    }
    leave(); navEntry = false; /* K15, R1: 목록 밖으로 가면 사이드바 진입 표시도 버린다 */
    return t1NF(h);
  };
  var sv0 = window.tfShareView; /* R1: 사이드바·메뉴 「전략 복사」로 오는 것 = home-nav */
  if (typeof sv0 === 'function') tfShareView = function () { navEntry = true; return sv0.apply(this, arguments); };
  var home0 = window.gHome;
  /* K15: 「새 전략」은 주소가 안 바뀔 수 있다. 부팅 0.9초(TF_BOOTED) 전에 누르면 앱이 목록 주소를 지우지 않아 부팅 재라우팅이 목록을 다시 그렸다 → 목록을 떠난 것으로 본다 */
  if (typeof home0 === 'function') gHome = function () {
    leave();
    if (onList()) { try { history.replaceState(null, '', base()); } catch (_) {} window.TF_ONNF = false; }
    return home0.apply(this, arguments);
  };
  addEventListener('hashchange', function () { if (!onList()) leave(); }); /* K15 */
  var s0 = tfSS3Search;
  tfSS3Search = function () {
    var r = s0.apply(this, arguments); setUrl();
    var c = document.querySelector('.g4l-count'); if (c) { c.textContent = headLine(); c.hidden = !c.textContent; }
    return r;
  };
  /* 목록의 스크롤 자리를 이 탭에 적어 둔다(새로고침 복원용) */
  var saveT = 0;
  function saveLast() { if (onList() && G.mode === 'tfss3' && reloadY == null) ssSet(LAST, { url: location.hash, y: getY() }); }
  document.addEventListener('scroll', function () { clearTimeout(saveT); saveT = setTimeout(saveLast, 150); }, true);
  window.addEventListener('pagehide', saveLast);
  /* I3: 같은 목록 주소를 새로고침했으면 부팅 중 다시 그려져도 마지막 자리로. 사람이 움직이면 놓는다 */
  (function () {
    var nav = null, last = ssGet(LAST); try { nav = performance.getEntriesByType('navigation')[0]; } catch (_) {}
    if (!(nav && nav.type === 'reload' && last && last.url === location.hash)) return;
    reloadY = last;
    var drop = function () { reloadY = null; ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (t) { removeEventListener(t, drop, true); }); };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (t) { addEventListener(t, drop, true); });
    setTimeout(drop, 6000);
  })();

  /* 연결한 사람은 「내 거래소」가 켜진 채 도착한다. 끈 것은 기억한다 */
  tfMyExGet = function () {
    var c = tfMyExConn(); if (!c.length) return '';
    var v = null; try { v = localStorage.getItem('teth.myex'); } catch (_) {}
    if (v === 'off') return '';
    if (!v) return 'all';
    return v !== 'all' && c.indexOf(v) < 0 ? 'all' : v;
  };
  var m0 = tfMyExSet;
  tfMyExSet = function (v) {
    if (v) return m0.apply(this, arguments);
    try { localStorage.setItem('teth.myex', 'off'); } catch (_) {}
    tfMyExMenu(false); tfShareHub('find');
  };
  tfSS3Reset = function () {
    TF_SS_Q = ''; var t = tfSSState(); t.ss.asset = 'all'; t.ss.kind = 'all'; t.ss.risk = 'all'; tfSave();
    if (tfMyExConn().length) { try { localStorage.setItem('teth.myex', 'off'); } catch (_) {} }
    tfShareHub('find');
  };

  /* 상세: 길 표시 「전략 복사」는 뒤로 한 번과 같다. 목록에서 온 사람에게는 「← AI 트레이딩」을 두지 않는다 */
  tfSS3DetailRender = function (ne) {
    var v = t1Detail.apply(this, arguments), page = document.querySelector('#g-content .mk-detail'), pos = ssGet(POS);
    if (page) {
      var lk = page.querySelector('.tfbk-bc .lk'), b = page.querySelector('a.g4-back');
      if (lk) lk.setAttribute('onclick', 'G4T2.back(\'' + tfSSNe(decodeURIComponent(ne)) + '\')');
      if (b && pos && pos.id === ne) b.remove();
    }
    return v;
  };

  /* I11: 복사 시트 예산 칸이 비어 열리면 $1,000 을 넣는다(T1 I3 과 같은 한 사람 흐름) */
  var fs0 = mkFollowSheet;
  mkFollowSheet = function () {
    var v = fs0.apply(this, arguments), inp = $('cps-amt');
    if (inp && !String(inp.value || '').trim()) { inp.value = inp.type === 'number' ? '1000' : '1,000'; try { cpFormSync(); } catch (_) {} }
    return v;
  };

  window.G4T2 = {
    open: function (e, ne) {
      if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      ssSet(POS, { url: location.hash, y: getY(), id: ne });
      skfOpen(e, ne);
    },
    more: function () {
      var g = document.querySelector('#ss3-grid .g4l-grid'), w = document.querySelector('.g4l-morew'); if (!g) return;
      var n = g.children.length;
      expanded = true;
      g.insertAdjacentHTML('beforeend', rowsNow().slice(n).map(mkCard).join(''));
      if (w) w.replaceWith(document.createRange().createContextualFragment(endLine(rowsNow().length)));
      setUrl();
      if (g.children[n]) try { g.children[n].focus({ preventScroll: true }); } catch (_) {}
    },
    back: function (ne) {
      var pos = ssGet(POS);
      if (pos && pos.id === ne && pos.url) { history.back(); return; }
      expanded = false; tfNav(url());
    },
    url: url,
    allMarkets: function () { var t = tfSSState(); t.ss.asset = 'all'; tfSave(); tfShareHub('find'); },
    /* K5: AI 트레이딩의 「둘러보기」 링크. 개수 = 이 링크로 도착하는 목록(필터 없음, 내 거래소 상태 그대로)의 카드 수 */
    linkText: function () {
      var rows = tfSSRows().filter(real), ids = typeof tfMyExIds === 'function' ? tfMyExIds() : [];
      if (!ids.length) return tx('linkAll', { n: rows.length });
      var n = rows.filter(function (s) { return ids.indexOf(String(mkEx(s)[0] || '').replace(/^app-/, '')) >= 0; }).length;
      return tx('linkMy', { ex: tfMyExNames(ids), n: n });
    }
  };
  /* K13: 언어를 바꾸면 AI 트레이딩의 둘러보기 링크는 그 자리에서, 목록은 조건·펼친 수·스크롤을 지킨 채 다시 그린다 */
  var gl0 = window.glcSetLang;
  if (typeof gl0 === 'function') glcSetLang = function () {
    var r = gl0.apply(this, arguments);
    try {
      var a = document.querySelector('#g-content .g4-links a'); if (a && G.mode === 'nfmain') a.textContent = G4T2.linkText();
      if (onList() && G.mode === 'tfss3' && ready()) draw({ keep: true, restore: { y: getY() } });
    } catch (_) {}
    return r;
  };
  landed = onList(); /* R1: 이 문서가 목록 주소로 열렸나(직행·새로고침) */
  if (onList()) {
    if (ready()) tfRoute();
    else { hold(true); setTimeout(function () { if (!onList() || !document.documentElement.classList.contains('g4l-wait')) return; forced = true; tfRoute(); }, 9000); }
  }
})();
