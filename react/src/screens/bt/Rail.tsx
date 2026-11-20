// 판단 패널과 오른쪽 칸 (원본 btPanelInit, btPanelFill, btPanelSum, btReadyRail, btRunRail, btResultRail, btReadHtml, rvCompare, rvActs).
import { useRef, useState, type ReactNode } from 'react';
import { BT_AMT, BT_PER, btCols, btPerL, btRules, btSteps, btSumCells, btTerms, btUsd, btUsdS, btWinTxt, btYMD, type BtR, type Dec, type Pair } from '../../core/bt/compute';
import { mkPct0, mkSign, type Strat } from '../../core/bt/engine';
import type { RvSpec, BtVer } from '../../core/bt/tf';
import { skbText } from '../../core/bt/text';
import { nav } from '../../state/route';
import { toast } from '../../state/store';
import { acConfirm, stDate } from './ac';
import { BT, backToChat, btJump, btReadLoad, btReadNow, btReroute, btSetAmt, btSetPer, btStart, btUse, useBt } from './bt';
import { Check, Chev, Dt, Gloss, tx } from './parts';
import { tfS, tfSave } from './tfState';

const Arrow = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

/** 판단 패널: 재생 중에는 기회 하나의 발견, 확인, 결정이 차례로 켜지고, 다 돌린 뒤에는 칸이 요약이 된다 */
export function Panel() {
  const s = useBt((x) => x.s) as Strat;
  const R = useBt((x) => x.R);
  const head = useBt((x) => x.head);
  const panel = useBt((x) => x.panel);
  const pj = useBt((x) => x.pj);
  const C = btCols(s);
  const n = C.length;
  const last = n - 1;
  const st = panel.st;
  const S = panel.sum && R ? btSumCells(R, s) : null;
  let T: Pair[] = [];
  if (st && !S) {
    const buys = st.ds.filter((x) => x.k === 'buy');
    const d = buys[0] || st.ds[0];
    T = [d.p0 as Pair];
    if (n === 3) T.push(d.p1 || ['', '']);
    T.push(buys.length > 1 ? [buys.map((x) => x.tk).join(', ') + ' 매수', (buys[0].p2 as Pair)[1]] : ((buys[0] || d).p2 as Pair));
  }
  return (
    <div className={'bt-panel c' + n + (panel.rest && !S ? ' rest' : '') + (S ? ' sum' : '')} id="bt-panel" data-st={panel.dataSt && st && !S ? st.j : undefined}>
      <div className="ph" role="status" aria-live="polite">
        <span className={'bt-dot' + (head.dot ? ' ' + head.dot : '')} id="bt-pdot" />
        <b className="num" id="bt-pdate">
          {tx(head.date)}
        </b>
        <span id="bt-pstate">{tx(head.state)}</span>
        <em className="num" id="bt-plast">
          {tx(head.last)}
        </em>
      </div>
      <div className="pc">
        {C.map((c, i) => {
          if (S) {
            const x = S[i];
            return (
              <div key={i} className="cell on sum" id={'bt-pc' + i}>
                <small>
                  <i className="num">{i + 1}</i>
                  {tx(x[0], true)}
                </small>
                <b>
                  {x[1].map((a, k) =>
                    panel.sum === 2 ? (
                      <button key={k} type="button" className={'k-' + a[1]} onClick={() => btJump(a[1])}>
                        {tx(a[0])}
                        <Arrow />
                      </button>
                    ) : (
                      <span key={k} className={'k-' + a[1]}>
                        {tx(a[0])}
                      </span>
                    ),
                  )}
                </b>
                <span>{tx(x[2])}</span>
              </div>
            );
          }
          const stage = panel.stage;
          const vis = !!st && (i === 0 ? stage >= 0 : i === last ? stage >= 2 : stage >= 1);
          const act = !!st && !panel.rest && ((i === 0 && stage === 0) || (i === last && stage >= 2) || (i > 0 && i < last && stage === 1));
          const t = T[i] || ['', ''];
          return (
            <div key={i} className={'cell' + (vis ? ' on' : '') + (act ? ' act' : '') + (i === last && vis ? (st && st.kind === 'buy' ? ' go' : ' no') : '')} id={'bt-pc' + i}>
              <small>
                <i className="num">{i + 1}</i>
                {tx(c, true)}
              </small>
              <b>{vis ? tx(t[0]) : ''}</b>
              <span>{vis ? tx(t[1]) : ''}</span>
            </div>
          );
        })}
      </div>
      <div className={pj.cls} id="bt-pjw" hidden={pj.hidden}>
        <small>{pj.label}</small>
        <p id="bt-pj">{pj.text}</p>
      </div>
    </div>
  );
}

/* ── 준비 ── */
function Seg<T extends number>({ list, cur, pick }: { list: [T, string][]; cur: number; pick: (v: T) => void }) {
  return (
    <div className="bt-seg" role="group">
      {list.map((o) => (
        <button key={o[0]} type="button" aria-pressed={o[0] === cur} onClick={() => pick(o[0])}>
          {o[1]}
        </button>
      ))}
    </div>
  );
}
function Fold({ title, rows, cls }: { title: string; rows: Pair[]; cls?: string }) {
  const [open] = useState(() => window.innerWidth > 900);
  return (
    <details className={'bt-box bt-fold ' + (cls || '')} open={open}>
      <summary>
        <h3>{tx(title, true)}</h3>
        <Chev />
      </summary>
      <dl className="bt-dl">
        {rows.map((r, i) => (
          <div key={i}>
            <Dt text={r[0]} />
            <dd>
              <Gloss text={r[1]} body />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
function ReadyRail({ s, R }: { s: Strat; R: BtR }) {
  const per = useBt((x) => x.per);
  const amt = useBt((x) => x.amt);
  return (
    <>
      <section className="bt-box bt-set">
        <h3>{tx('돌려 볼 조건', true)}</h3>
        <div className="bt-f">
          <small>기간</small>
          <Seg list={BT_PER} cur={per} pick={btSetPer} />
        </div>
        <div className="bt-f">
          <small>시작 금액</small>
          <Seg list={BT_AMT.map((a): [number, string] => [a, '$' + a.toLocaleString()])} cur={amt} pick={btSetAmt} />
          <em>USD</em>
        </div>
        <button type="button" className="bt-cta" onClick={btStart}>
          {tx('과거를 다시 돌려 보기', true)}
        </button>
        <p className="bt-note">{tx(btYMD(R.eq[0].i) + '부터 ' + btYMD(R.eq[R.N - 1].i) + '까지, ' + R.N.toLocaleString() + '일을 하루씩 다시 돌립니다.')}</p>
      </section>
      <Fold title="이 전략의 규칙" rows={btRules(s)} />
      <Fold title="백테스트 조건" rows={btTerms(s)} cls="bt-terms" />
    </>
  );
}

/* ── 다시 돌리는 동안 ── */
/** btDot(d) */
export const BtDot = ({ d }: { d: Dec }) => <i className={'bt-dt k-' + d.k + ((d.side || 0) < 0 ? ' s' : '')} aria-hidden="true" />;
function RunRail({ s }: { s: Strat }) {
  const steps = useBt((x) => x.steps);
  const feed = useBt((x) => x.feed);
  const shown = useBt((x) => x.feedShown);
  return (
    <>
      <section className="bt-box bt-stepbox">
        <h3>지금 하는 일</h3>
        <ol className="bt-steps" id="bt-steps">
          {btSteps(s).map((x) => {
            const v = steps[x[0]] || { cls: '', ic: '', evd: '' };
            return (
              <li key={x[0]} id={'bt-st-' + x[0]} className={v.cls || undefined}>
                <span className="ic">{v.ic === 'ok' ? <Check /> : v.ic === 'run' ? <i /> : null}</span>
                <span className="lb">{tx(x[1])}</span>
                <span className="evd num" id={'bt-se-' + x[0]}>
                  {tx(v.evd)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="bt-box bt-feedbox" id="bt-feedbox" hidden={!shown}>
        <h3>내린 판단</h3>
        <div className="bt-feed" id="bt-feed">
          {feed.map((d) => (
            <div key={d.ix} className={'bt-fr v2 k-' + d.k}>
              <time className="num">{btYMD(d.i).slice(5)}</time>
              <BtDot d={d} />
              <b>{tx(d.act || d.title)}</b>
              {d.pnl != null && <i className={'num' + mkSign(d.pnl)}>{mkPct0(d.pnl, 1)}</i>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ── 결과 ── */
/** btReadHtml(): 결과 해석. 모델이 쓴 글은 화면을 그릴 때 이미 와 있었던 것만 선물의 말로 바뀐다(원본과 같다) */
function ReadBox() {
  useBt((x) => x.ai);
  const X = btReadNow();
  const was = useRef(X.st === 'ok');
  let body: ReactNode;
  if (X.st === 'ok')
    body = (X.t || '')
      .split(/\n+/)
      .filter(Boolean)
      .slice(0, 4)
      .map((x, i) => (
        <p key={i} className={i === 0 ? 'h' : undefined}>
          {was.current ? tx(x) : skbText(x)}
        </p>
      ));
  else if (X.st === 'fail')
    body = (
      <>
        <p className="f">해석을 불러오지 못했습니다. 결과 숫자는 위에 그대로 있습니다.</p>
        <button type="button" className="bt-rtry" onClick={() => btReadLoad(true)}>
          다시 시도
        </button>
      </>
    );
  else
    body = (
      <>
        <div className="bt-sk" aria-label="결과를 읽는 중">
          <i />
          <i />
          <i />
        </div>
        <p className="l">{tx('결과를 읽고 있습니다', true)}</p>
      </>
    );
  return (
    <section className={'bt-box bt-read v2 ' + X.st} id="bt-read" aria-live="polite">
      <h3>TETH의 해석</h3>
      {body}
    </section>
  );
}

/* 이전 판과 비교, 결과에 맞는 단추 (원본 rv*) */
const rvTrades = (R: BtR) => R.wins.length + R.loss.length;
/** rvBad() */
export const rvBad = (R: BtR, amt: number) => !!rvTrades(R) && (R.final < amt || R.final < R.benchFinal);
/** rvSpecNow() */
function rvSpecNow(): RvSpec {
  const t = tfS();
  const s = t.aiSpec || ({} as Partial<NonNullable<typeof t.aiSpec>>);
  const iv = t.intake || {};
  const th = s.rsiTh as number;
  const depth = th >= 52 ? 'shallow' : th <= 38 ? 'deep' : 'mid';
  return { asset: (iv.asset || {}).label || '', depth, tp: s.tp == null ? null : s.tp, sl: s.sl as number, fng: s.fng == null ? null : s.fng, trend: !!s.tf, period: ['1y', '2y', 'all'][(iv.period || {}).i || 0] || '1y', name: s.name || null };
}
/** rvRuleText(sp) */
function rvRuleText(sp: RvSpec): string {
  const dep = { shallow: '조금', mid: '적당히', deep: '크게' }[sp.depth] || '적당히';
  return '사는 때: ' + sp.asset + '이 ' + dep + ' 밀렸다가 하루 0.5% 넘게 반등한 날' + (sp.trend ? ', 방향이 뚜렷할 때만' : '') + (sp.fng != null ? ', 공포 탐욕 지수 ' + sp.fng + ' 이하일 때만' : '') + '. 파는 때: ' + (sp.tp != null ? '산 가격보다 ' + sp.tp + '% 오르거나 ' : '') + Math.abs(sp.sl) + '% 내리면, 또는 25일이 지나면';
}
/** rvSnapNow() */
function rvSnapNow(R: BtR): BtVer {
  const sp = rvSpecNow();
  const t = tfS();
  return { at: Date.now(), spec: sp, rule: rvRuleText(sp), ai: JSON.parse(JSON.stringify(t.aiSpec || {})), pi: ((t.intake || {}).period || {}).i, per: BT.per, amt: BT.amt, ret: R.ret, mdd: R.mdd, n: rvTrades(R), bench: R.benchRet, final: R.final };
}
/** rvRerun(per,amt): 조건을 맞춰 준비 화면에서 다시 돌린다 */
function rvRerun(per: number, amt: number) {
  setTimeout(() => {
    window.location.hash = '#/share/bt/mine';
    btReroute(); /* 주소는 그대로여도 바뀐 규칙으로 다시 들어간다 */
    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (BT.s && BT.s.mine && BT.phase === 'ready' && document.getElementById('bt-root')) {
        clearInterval(iv);
        if (BT.per !== per) btSetPer(per);
        if (BT.amt !== amt) btSetAmt(amt);
        setTimeout(btStart, 300);
      } else if (n > 60) clearInterval(iv);
    }, 150);
  }, 400);
}
/** rvRevert(): 이전 규칙으로 돌아가 다시 돌린다 */
function rvRevert(R: BtR) {
  const t = tfS();
  const V = t.btVers || [];
  const v = V[0];
  if (!v || !v.ai) return;
  const now = rvSnapNow(R);
  t.aiSpec = JSON.parse(JSON.stringify(v.ai));
  if (t.intake && t.intake.period && v.pi != null) t.intake.period.i = v.pi;
  t.cur = null;
  t.score = 0;
  t.workDone = false;
  V.shift();
  V.unshift(now);
  t.btVers = V.slice(0, 5);
  tfSave();
  toast('이전 규칙으로 돌아갑니다');
  rvRerun(v.per, v.amt);
}
/** rvCompare() */
function RvCompare({ R, s }: { R: BtR; s: Strat }) {
  const t = tfS();
  const V = t.btVers || [];
  const v = V[0];
  if (!v || !s.mine) return null;
  const same = v.per === BT.per && v.amt === BT.amt;
  const rule = rvRuleText(rvSpecNow());
  const row = (k: string, a: string, b: string, sg: string) => (
    <div className="r">
      <span>{k}</span>
      <i className="num">{a}</i>
      <b className={'num' + sg}>{b}</b>
    </div>
  );
  const up = R.ret > v.ret;
  const sum = same ? '수정 후 수익률은 ' + mkPct0(v.ret, 1) + '에서 ' + mkPct0(R.ret, 1) + '로 ' + (up ? '높아졌습니다' : R.ret < v.ret ? '낮아졌습니다' : '같습니다') + '. 가장 크게 내려간 폭은 ' + Math.abs(v.mdd).toFixed(1) + '%에서 ' + Math.abs(R.mdd).toFixed(1) + '%로 ' + (Math.abs(R.mdd) < Math.abs(v.mdd) ? '줄었습니다' : Math.abs(R.mdd) > Math.abs(v.mdd) ? '커졌습니다' : '같습니다') + '.' : '';
  return (
    <section className="bt-box rv-cmp">
      <small>이전 판과 비교</small>
      {same ? (
        <>
          <p className="rv-sum">{skbText(sum)}</p>
          <p className="rv-same">같은 기간, 같은 시작 금액, 같은 가격 자료로 비교했습니다</p>
        </>
      ) : (
        <p className="rv-same warn">이전 검사와 기간이나 금액이 달라 결과 비교를 제공하지 않습니다</p>
      )}
      {same && (
        <div className="rv-rows">
          <div className="r h">
            <span />
            <i>이전</i>
            <b>이번</b>
          </div>
          {row('수익률', mkPct0(v.ret, 1), mkPct0(R.ret, 1), mkSign(R.ret - v.ret))}
          {row(skbText('가장 크게 내려간 폭'), v.mdd.toFixed(1) + '%', R.mdd.toFixed(1) + '%', mkSign(v.mdd - R.mdd))}
          {row('거래 수', v.n + '번', rvTrades(R) + '번', '')}
        </div>
      )}
      <details className="rv-det">
        <summary>바뀐 규칙 전체 보기</summary>
        <div className="rv-rules">
          <div>
            <small>이전 규칙</small>
            <p>{skbText(v.rule)}</p>
          </div>
          <div>
            <small>이번 규칙</small>
            <p>{skbText(rule)}</p>
          </div>
        </div>
      </details>
      <div className="rv-cmp-acts">
        <button type="button" className="rv-prev" onClick={() => rvRevert(R)}>
          이전 규칙으로 돌아가기
        </button>
        <button
          type="button"
          className="rv-prev"
          onClick={() =>
            acConfirm({ title: '이전 판', body: '', list: V.map((x) => stDate(x.at) + ' ' + mkPct0(x.ret, 1) + ' (낙폭 ' + x.mdd.toFixed(1) + '%, 거래 ' + x.n + '번). ' + x.rule), ok: '닫기', run: () => {} })
          }
        >
          이전 판 {V.length}개 보기
        </button>
      </div>
    </section>
  );
}
/** rvActs() */
function RvActs({ R, s }: { R: BtR; s: Strat }) {
  const bad = rvBad(R, BT.amt);
  const none = !rvTrades(R);
  /* 규칙 수정과 대화로 돌아가기는 대화 화면의 일이다 */
  const rvFix = () => {
    if (!s.mine) return;
    tfS().btLast = rvSnapNow(R);
    tfSave();
    backToChat();
  };
  const links = (L: [string, () => void][]) => (
    <p className="rv-links">
      {L.map((x, i) => [
        i ? <i key={'i' + i}>·</i> : null,
        <button key={i} type="button" onClick={x[1]}>
          {x[0]}
        </button>,
      ])}
    </p>
  );
  const note = none ? <p className="rv-note">거래가 한 번도 없어 결과를 판단하기 어렵습니다. 조건을 넓히거나 기간을 바꿔 보십시오.</p> : null;
  const run = (cls: string) => (
    <button type="button" className={cls} onClick={btUse}>
      {tx('이 전략 실행하기', true)}
    </button>
  );
  if (s.mine) {
    if (bad || none)
      return (
        <>
          {note}
          <button type="button" className="bt-cta" onClick={rvFix}>
            규칙 수정하기
          </button>
          {run('bt-sec')}
          {links([['대화로 돌아가기', backToChat]])}
        </>
      );
    return (
      <>
        {run('bt-cta')}
        {links([
          ['규칙 수정하기', rvFix],
          ['대화로 돌아가기', backToChat],
        ])}
      </>
    );
  }
  return (
    <>
      {note}
      {run('bt-cta')}
      {links([['다른 전략 둘러보기', () => nav('#/share')]])}
    </>
  );
}
function ResultRail({ s, R }: { s: Strat; R: BtR }) {
  const amt = BT.amt;
  const pf = R.final - amt;
  const diff = Math.round(R.final) - Math.round(R.benchFinal);
  let hold = tx('그냥 들고 있었다면 ', true);
  if (/^현물 보유 $/.test(hold)) hold = '현물 보유 손익 ';
  return (
    <>
      <section className="bt-box bt-verdict">
        <small>{tx(btPerL(BT.per) + ' 동안, ' + btUsd(amt) + '로', true)}</small>
        <p className="bt-v1b">
          <b className={'num' + mkSign(R.ret)}>{btUsdS(pf)}</b>
        </p>
        <p className="bt-v2">
          <span>
            {hold}
            <i className="num">{btUsdS(R.benchFinal - amt)}</i>
          </span>
          <b className={'num ' + (diff >= 0 ? 'mk-up' : 'mk-dn')}>{tx('그보다 $' + Math.abs(diff).toLocaleString() + ' ' + (diff >= 0 ? '많음' : '적음'), true)}</b>
        </p>
        <div className="bt-k3">
          <div>
            <small>{tx('가장 크게 내려간 폭', true)}</small>
            <b className="num mk-dn">{R.mdd.toFixed(1)}%</b>
            <em className="num">{tx('그냥 들고 있었다면 ' + R.benchMdd.toFixed(1) + '%', true)}</em>
          </div>
          <div>
            <small>{tx('이긴 거래', true)}</small>
            <b className="num">{tx(btWinTxt(R), true)}</b>
          </div>
          <div>
            <small>{tx('평균 보유', true)}</small>
            <b className="num">{Math.round(R.r.avgHold || 0)}일</b>
          </div>
        </div>
      </section>
      <ReadBox />
      <RvCompare R={R} s={s} />
      <RvActs R={R} s={s} />
      <p className="bt-rec num">
        <Check />
        <span>{tx('가격 ' + (R.list.length * R.N).toLocaleString() + '개, ' + R.N.toLocaleString() + '일을 확인했습니다')}</span>
      </p>
    </>
  );
}

export function Rail() {
  const s = useBt((x) => x.s) as Strat;
  const R = useBt((x) => x.R);
  const phase = useBt((x) => x.phase);
  const rail = useBt((x) => x.rail);
  return (
    <aside className="bt-rail" id="bt-rail">
      {!R ? null : phase === 'ready' ? <ReadyRail key={rail} s={s} R={R} /> : phase === 'run' ? <RunRail key={rail} s={s} /> : <ResultRail key={rail} s={s} R={R} />}
    </aside>
  );
}
/** 모바일 결과의 아래 고정 줄 (원본 #bt-mcta) */
export function Mcta() {
  const R = useBt((x) => x.R);
  const phase = useBt((x) => x.phase);
  const per = useBt((x) => x.per);
  return (
    <div className="bt-mcta" id="bt-mcta">
      {phase === 'result' && R && (
        <>
          <div>
            <b className={'num' + mkSign(R.ret)}>{mkPct0(R.ret, 1)}</b>
            <span>{btPerL(per)}</span>
          </div>
          <button type="button" className="bt-cta" onClick={btUse}>
            {tx('이 전략 실행하기', true)}
          </button>
        </>
      )}
    </div>
  );
}
