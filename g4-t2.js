/* G4/T2 전략 복사 목록(claude 뼈대, 4단계 통합). 흐름 계약 sprint/G4/T2/sketch/claude/flow.md, 계획 sprint/G4/T2/integrate-plan.md
   T1(g4-t1.js) 위에 얹는다. 숫자는 전부 G4T1Data.results(= btCompute, amt 1000)에서 받는다. 문구 정본 sprint/G4/T2/copy/table-v1.md */
(function () {
  'use strict';
  var D = G4T1Data, LIST = '#/trade/strategies', PER = 10, POS = 'g4.t2.pos', FROM = 'g4.t2.from', LAST = 'g4.t2.last', COUNTED = 'g4.t2.counted';
  var t1Hub = tfShareHub, t1NF = tfNFRoute, t1Detail = tfSS3DetailRender, t1Card = mkCard, oldContent = gContent;
  var expanded = false, sig = null, keepOpen = false, backId = null, reloadY = null;
  var KIND = { agent: 1, rule: 1, mix: 1 }, MKT = { crypto: 1, stock: 1, index: 1, multi: 1 };
  var HELP = '<p class="cq-help mk-help">막히면 상담원이 24시간 답합니다. <button type="button" class="pl-link" onclick="tfTxHelp()">상담원에게 묻기</button></p>';

  function base() { return location.pathname + location.search; }
  function onList() { var h = location.hash; return h === LIST || h.indexOf(LIST + '?') === 0; }
  function ssGet(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function ssSet(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function docScroll() { return document.body.classList.contains('gft-doc'); }
  function getY() { var sc = $('g-scroll'); return docScroll() ? window.scrollY : (sc ? sc.scrollTop : 0); }
  function setY(y) { var sc = $('g-scroll'); if (docScroll()) window.scrollTo(0, y); else if (sc) sc.scrollTop = y; }
  function real(s) { return !!(s && s.cfg && !s.me); }
  function fin(s, per) { return real(s) ? D.results(s, per || 0).final : -1e18; }
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
  function rowsNow() {
    var t = tfSSState(), rows = tfSSRows(), k = mkSortKey(t);
    if (t.ss.asset && t.ss.asset !== 'all') rows = rows.filter(function (s) { return s.mkt === t.ss.asset; });
    if (t.ss.kind && t.ss.kind !== 'all') rows = rows.filter(function (s) { return (s.kind || 'rule') === t.ss.kind; });
    if (TF_SS_Q) {
      var q = TF_SS_Q.toLowerCase();
      rows = rows.filter(function (s) { return [s.nick, s.asset, mkTitle(s), s.one || '', s.by ? '@' + s.by : '', s.id || '', mkOldNames(s.id), MK_KIND[s.kind] || '', mkUni(s).list.join(' '), mkUni(s).list.map(mkTk).join(' '), mkTk(s.asset || '')].join(' ').toLowerCase().indexOf(q) >= 0; });
    }
    if (typeof tfMyExFilter === 'function') rows = tfMyExFilter(rows);
    rows.sort(k === 'fw' ? function (a, b) { return (b.fw || 0) - (a.fw || 0) || fin(b) - fin(a); }
      : function (a, b) { return fin(b) - fin(a); });
    return rows;
  }

  function card(s) {
    if (!s.kind) s.kind = 'rule';
    if (!real(s)) return t1Card(s);
    var r = D.results(s, 0), ne = tfSS3Rid(s), ex = mkEx(s), money = Math.round(r.final), hold = Math.round(r.benchFinal), now = mkNowLine(s);
    return '<article class="mk-card skf g4l k-' + s.kind + (backId && backId === ne ? ' g4l-back' : '') + '" role="link" tabindex="0" data-id="' + gEsc(s.id) + '" data-ne="' + gEsc(ne) + '" aria-label="' + gEsc(mkHook(s)) + ' 전략 보기" onclick="G4T2.open(event,\'' + ne + '\')" onkeydown="G4T2.open(event,\'' + ne + '\')">'
      + '<div class="skf-top">' + mkGlyph(s, 28) + '<div class="skf-nm"><h3>' + gEsc(mkHook(s)) + '</h3><span><img src="assets/logos/' + ex[0] + '.png" alt="" width="14" height="14" loading="lazy">' + MK_KIND[s.kind] + ', ' + ex[1] + '에서 실행</span></div></div>'
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
      if (!rows.length) return '<div class="myex-empty"><p>' + nm + '에서 실행할 수 있는 전략이 아직 없습니다.</p><button type="button" class="pl-link" onclick="tfMyExSet(\'\')">전체 보기</button></div>' + HELP;
      note = '<p class="myex-note">' + nm + '에서 바로 실행할 수 있는 전략 ' + rows.length + '개입니다.</p>';
    }
    if (!rows.length) return '<div class="ss3-empty">조건에 맞는 전략이 없습니다<br><button type="button" class="mk-btn2" style="margin-top:16px" onclick="tfSS3Reset()">필터 초기화</button></div>' + HELP;
    var shown = expanded ? rows : rows.slice(0, PER), rest = rows.length - shown.length;
    return note + '<div class="mk-grid mk3-grid g4l-grid">' + shown.map(mkCard).join('') + '</div>'
      + (rest > 0 ? '<div class="g4l-morew"><button type="button" class="g4l-more" onclick="G4T2.more()">나머지 ' + rest + '개 더 보기</button></div>' : endLine(rows.length)) + HELP;
  };
  /* 끝 문장(I4): 31개 전부를 다 보였을 때만 */
  function endLine(n) { return n && n === allCount() ? '<p class="g4l-end">' + n + '개 전략을 모두 봤습니다</p>' : ''; }
  function allCount() { return tfSSRows().filter(real).length; }
  /* 머리 한 줄의 개수 = 시장, 검색을 건 뒤 줄 수(종류 탭은 전체일 때만 이 줄, 내 거래소가 켜지면 안내 한 줄만: 시안 S2 안1) */
  function headCount() { return rowsNow().filter(real).length; }
  function headLine() { return '전략 ' + headCount() + '개가 같은 $1,000을 굴린 결과입니다.'; }

  /* 조작 줄: 제목, 정렬 이름, 전체일 때 한 줄 */
  var c0 = mk3Controls;
  mk3Controls = function (t) {
    var d = document.createElement('div'); d.innerHTML = c0.apply(this, arguments);
    var sort = mkSortKey(t), sel = d.querySelector('.skf-sort select'), row = d.querySelector('.mk3-kindrow');
    if (sort === 'win') sort = 'pick';
    if (sel) sel.innerHTML = [['pick', '전체 기간 금액순'], ['fw', '복사한 사람순']].map(function (o) { return '<option value="' + o[0] + '"' + (sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
    if (row && !row.querySelector('.mk3-kindhelp') && !(typeof tfMyExOn === 'function' && tfMyExOn())) row.insertAdjacentHTML('beforeend', '<p class="mk3-kindhelp one g4l-count">' + headLine() + '</p>');
    return '<h1 class="g4l-h1">전략 복사</h1>' + d.innerHTML;
  };

  /* 그리기: T1 통합본의 목록 그리기를 그대로 부르고 주소만 상태에 맞춘다 */
  function draw(o) {
    o = o || {};
    keepOpen = !!o.keep; backId = o.restore && o.restore.id || null;
    var st = history.state;
    try { replace(LIST); t1Hub('find'); } finally { keepOpen = false; backId = null; }
    try { history.replaceState(st, '', base() + url()); } catch (_) {} /* T1 showList 가 비운 기록 상태를 되돌린다 */
    document.body.classList.add('g4-list');
    var page = document.querySelector('#g-content .ss3'), back = page && page.querySelector('.g4-back');
    if (back && !ssGet(FROM)) back.remove();
    if (o.restore) { setY(o.restore.y); requestAnimationFrame(function () { setY(o.restore.y); }); }
    else if (o.fresh && !ssGet(COUNTED)) { ssSet(COUNTED, 1); enter(); }
  }
  /* 새로 들어온 첫 화면만: 큰 금액이 $1,000 에서 제 값으로, 곡선이 왼쪽에서 */
  function enter() {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (_) {}
    var g = document.querySelector('#ss3-grid .g4l-grid'); if (!g) return;
    /* I1: 시작 시각은 첫 프레임 시각으로 잡고 진행값은 0~1 로 묶는다(막힌 동안 시작된 프레임의 시각이 앞서도 $1,000 아래로 안 감) */
    var els = [], t0 = null;
    [].forEach.call(g.querySelectorAll('.g4l-amt'), function (b) { var r = b.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) els.push({ b: b, to: +b.dataset.to, pc: b.parentNode.querySelector('.g4l-pct') }); });
    g.classList.add('g4l-enter');
    function paint(e) { els.forEach(function (x) { var v = 1000 + (x.to - 1000) * e; x.b.textContent = cpUsd(Math.round(v), 0); if (x.pc) x.pc.textContent = pct(1000 + (+x.pc.dataset.to - 1000) * e); }); }
    paint(0);
    requestAnimationFrame(function tick(now) {
      if (t0 == null) t0 = now;
      var p = Math.max(0, Math.min(1, (now - t0) / 600));
      paint(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(tick); else g.classList.remove('g4l-enter');
    });
  }

  gContent = function () { document.body.classList.remove('g4-list'); return oldContent.apply(this, arguments); };

  tfShareHub = function (tab) {
    if (tab === 'follow') { tfNav('#/trade'); return; }
    if (onList()) { draw({}); return; }
    expanded = false;
    tfNav(url());
  };
  tfNFRoute = function (h) {
    if (h === LIST || h.indexOf(LIST + '?') === 0) {
      var pm = G.mode, pos = ssGet(POS), back = pm === 'tfss3d' && pos && pos.url === h;
      var reload = reloadY != null && reloadY.url === h;
      if (pm === 'nfmain') ssSet(FROM, 1); else if (pm !== 'tfss3d' && pm !== 'tfss3' && !reload) ssSet(FROM, null);
      parse(h);
      draw({ keep: true, restore: back ? pos : reload ? { y: reloadY.y } : null, fresh: !back && !reload && pm !== 'tfss3' });
      ssSet(POS, null);
      return true;
    }
    return t1NF(h);
  };
  var s0 = tfSS3Search;
  tfSS3Search = function () {
    var r = s0.apply(this, arguments); setUrl();
    var c = document.querySelector('.g4l-count'); if (c) c.textContent = headLine();
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
    url: url
  };
  if (onList()) tfRoute();
})();
