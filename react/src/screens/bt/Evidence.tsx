// 결과의 근거: 판단 기록, 거래 내역, 월별 수익률, 자세한 지표
// (원본 btEvidence, btDecRows, btRowHtml, btDecDetail, btEvDetail, btJBlock, btTrRows, btTrDetail, fuTrDetail, btMini, btMonths, btTech, skbGroupHolds, skbMonthTable).
import { useRef, type ReactNode } from 'react';
import { btJKey } from '../../core/bt/ai';
import { btMiniGeo, btMonthTable, type MiniLine, type MiniMark } from '../../core/bt/chart';
import { btAi, btDecList, btMonthsSum, btPx, btSum4, btTradeOf, btTrList, btUsd, btUsdS, btYMD, isFut, type BtR, type Dec, type DecRow, type EvDay, type Tr } from '../../core/bt/compute';
import { FU_WHY, MK_WHY, PRICE0, fuSd, idxToDate, mkPct0, mkPx, mkPxFmt, mkSign, mkTk, type Strat } from '../../core/bt/engine';
import { skbText } from '../../core/bt/text';
import { BT, BT_AI, BT_PAGE, btFilt, btJRetry, btJudge, btMoreDec, btMoreTr, btSelDec, btSelEv, btSelTr, btSort, btTrFilt, useBt } from './bt';
import { BtDot } from './Rail';
import { Chev, Facts, MkdTerm, tx } from './parts';

const Num = ({ v, children }: { v?: number; children: ReactNode }) => <i className={'num' + (v != null ? mkSign(v) : '')}>{children}</i>;

/** btMini(a,i1,i2,marks,lines,hold): 종목 하나의 가격 선 */
function Mini({ a, i1, i2, marks, lines, hold }: { a: string; i1: number; i2: number; marks: MiniMark[]; lines: MiniLine[]; hold: [number, number] | null }) {
  const P = mkPx(a); /* 원본은 선물 전략에서도 이 그림에 현물 가격을 쓴다 */
  const g = btMiniGeo(P, PRICE0.length - 1, i1, i2, lines);
  const { W, H, pl, pr, pt, pb, lo, hi, X, Y } = g;
  let hs = null;
  if (hold) {
    const hx = X(Math.max(lo, hold[0]));
    const hw = Math.max(2, X(Math.min(hi, hold[1])) - hx);
    hs = <rect x={hx.toFixed(1)} y={pt} width={hw.toFixed(1)} height={H - pt - pb} fill="rgba(255,255,255,.06)" />;
  }
  return (
    <svg className="bt-mini" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={a + ' 가격'}>
      {hs}
      <path d={g.d} fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="1.5" strokeLinejoin="round" />
      {lines.map((l, i) => {
        const y = Y(l[0]);
        return [
          <line key={'l' + i} x1={pl} x2={W - pr} y1={y.toFixed(1)} y2={y.toFixed(1)} stroke={l[2]} strokeDasharray="3 4" strokeOpacity=".7" />,
          <text key={'t' + i} x={W - pr + 8} y={(y + 4).toFixed(1)} fontSize="12" fill={l[2]}>
            {tx(l[1])}
          </text>,
        ];
      })}
      {!lines.length &&
        [g.mx - g.pad, g.mn + g.pad].map((p, i) => (
          <text key={'a' + i} x={W - pr + 8} y={(Y(p) + 4).toFixed(1)} fontSize="12" fill="#8b9096">
            {mkPxFmt(p)}
          </text>
        ))}
      {marks.map((m, i) => {
        if (m[0] < lo || m[0] > hi) return null;
        const x = X(m[0]);
        const y = Y(P[m[0]]);
        const ty = y - 12 < pt - 4 ? y + 22 : y - 12;
        return [
          <circle key={'c' + i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="5" fill={m[2]} stroke="#15171a" strokeWidth="2" />,
          <text key={'m' + i} x={x.toFixed(1)} y={ty.toFixed(1)} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={m[2]}>
            {tx(m[1])}
          </text>,
        ];
      })}
      <text x={pl} y={H - 7} fontSize="12" fill="#8b9096">
        {tx(btYMD(lo).slice(2))}
      </text>
      <text x={W - pr} y={H - 7} textAnchor="end" fontSize="12" fill="#8b9096">
        {tx(btYMD(hi).slice(2))}
      </text>
    </svg>
  );
}
/** btTradeMini(t), 선물이면 fuTradeMini(t) */
function TradeMini({ t }: { t: Tr }) {
  const s = BT.s as Strat;
  const R = BT.R as BtR;
  const c = s.cfg || {};
  const end = t.x != null ? t.x : R.T;
  const col = t.pnl >= 0 ? '#2fb98a' : '#f0566a';
  if (isFut(s)) {
    const sd = fuSd(t.side as number);
    const marks: MiniMark[] = [[t.e, sd + ' 진입', (t.side as number) > 0 ? '#2fb98a' : '#b08cf5']];
    if (t.x != null) marks.push([t.x, '청산', col]);
    return <Mini a={t.a} i1={t.e - 14} i2={end + 10} marks={marks} lines={c.sl ? [[t.ep * (1 - ((t.side as number) * c.sl) / 100), '손절 ' + c.sl + '%', '#f0566a']] : []} hold={[t.e, end]} />;
  }
  const marks: MiniMark[] = [[t.e, '매수', '#2fb98a']];
  if (t.x != null) marks.push([t.x, '매도', col]);
  const lines: MiniLine[] = s.kind === 'agent' ? [] : (c.tp != null ? [[t.ep * (1 + c.tp / 100), '목표 +' + c.tp + '%', '#2fb98a'] as MiniLine] : []).concat([[t.ep * (1 + (c.sl as number) / 100), '손절 ' + c.sl + '%', '#f0566a']]);
  return <Mini a={t.a} i1={t.e - 14} i2={end + 10} marks={marks} lines={lines} hold={[t.e, end]} />;
}
/** btUpsHtml(ups) */
function Ups({ ups }: { ups?: string[] | null }) {
  if (!ups) return null;
  return (
    <div className="bt-ups">
      <small>
        {tx('그날 오름세로 본 종목 ')}
        <i>가격이 60일 평균보다 위</i>
      </small>
      <ul>
        {(BT.R as BtR).list.map((k) => (
          <li key={k} className={ups.indexOf(k) >= 0 ? 'y' : 'n'}>
            {tx(mkTk(k))}
          </li>
        ))}
      </ul>
    </div>
  );
}
/** btJBlock(d): 그날 TETH의 판단. 모델이 그날의 값으로 쓴 문장 */
function JBlock({ d }: { d: Dec }) {
  useBt((x) => x.ai);
  const k = btJKey({ id: BT.id, s: BT.s as Strat, per: BT.per, amt: BT.amt }, d);
  const J = BT_AI.J[k] || btJudge(d);
  /* 펼칠 때 이미 와 있던 문장만 선물의 말로 바뀐다(원본과 같다) */
  const was = useRef(J.st === 'ok');
  return (
    <div className={'bt-jb ' + J.st} id={'bt-jb-' + d.ix}>
      <h4>그날 TETH의 판단</h4>
      {J.st === 'ok' ? (
        <p>{was.current ? tx(J.t) : skbText(J.t)}</p>
      ) : J.st === 'fail' ? (
        <>
          <p className="f">판단 문장을 불러오지 못했습니다.</p>
          <button type="button" onClick={() => btJRetry(d.ix)}>
            다시 시도
          </button>
        </>
      ) : (
        <p className="l">
          <i />
          <i />
          <i />
        </p>
      )}
    </div>
  );
}
/** btDecDetail(d): 판단 하나를 펼치면 */
function DecDetail({ d }: { d: Dec }) {
  const R = BT.R as BtR;
  const s = BT.s as Strat;
  const t = d.tid != null ? btTradeOf(R, d.tid) : null;
  let mini: ReactNode = null;
  if (d.a) mini = t ? <TradeMini t={t} /> : <Mini a={d.a} i1={d.i - 25} i2={d.i + 25} marks={[[d.i, d.k === 'skip' ? '보류' : d.tag, d.k === 'skip' ? '#f0b840' : '#9aa0a6']]} lines={[]} hold={null} />;
  let after: ReactNode = null;
  if (d.k === 'skip' && d.a) {
    const P = mkPx(d.a);
    const q = Math.min(R.T, d.i + 25);
    const ch = (P[q] / P[d.i] - 1) * 100;
    after = (
      <div className="bt-blk">
        <h4>그 뒤 가격</h4>
        <p className="bt-after">
          {tx('그 뒤 ' + (q - d.i) + '일 동안 ' + mkTk(d.a) + '의 가격은 ')}
          <b className={'num' + mkSign(ch)}>{mkPct0(ch, 1)}</b>
          {' 움직였습니다.'}
        </p>
      </div>
    );
  }
  return (
    <div className="bt-dd-in">
      {btAi(s) && <JBlock key={d.ix} d={d} />}
      {!!d.chain && (
        <div className="bt-dd-ch">
          <div className="bt-chain">
            <span className="ok">규칙 신호</span>
            <span className="ai">AI 확인</span>
            <span className={d.k === 'skip' ? 'no' : 'go'}>{tx(d.k === 'skip' ? '보류' : '매수')}</span>
          </div>
        </div>
      )}
      {mini && (
        <div className="bt-dd-c">
          <small>
            {tx(d.a + ' 가격, ' + (t ? '매수 전후' : '그 무렵') + ' ')}
            <i>USD</i>
          </small>
          {mini}
        </div>
      )}
      <div className="bt-dd-f">
        <div className="bt-blk">
          <h4>{tx(d.k === 'sell' ? '판 내용' : '그날 확인한 조건')}</h4>
          <Facts rows={d.facts} gl />
          <Ups ups={d.ups} />
        </div>
        {after}
      </div>
    </div>
  );
}
/** btEvDetail(E): AI 판단 전략의 재평가 하루 */
function EvDetail({ E }: { E: EvDay }) {
  const f = E.ds[0];
  const b = E.ds.filter((d) => d.k === 'buy');
  const p0 = f.p0 as [string, string];
  const p1 = f.p1 as [string, string];
  const p2 = f.p2 as [string, string];
  return (
    <div className="bt-dd-in one">
      <div className="bt-dd-f">
        <div className="bt-blk">
          <h4>그날 확인한 조건</h4>
          <Facts
            rows={[
              ['AI가 비교한 것', p0[0] + ', ' + p0[1]],
              ['시장 확인', p1[0] + ', ' + p1[1]],
              ['결정', E.out === 'buy' ? E.title + ' 매수' : p2[0] + ', ' + p2[1]],
            ]}
          />
          <Ups ups={E.ups} />
        </div>
        {!!b.length && (
          <div className="bt-blk">
            <h4>{tx('그날 산 종목')}</h4>
            <Facts rows={b.map((d): [string, string] => [d.tk, d.facts[0][1] + ', 비중 ' + d.facts[1][1] + ', ' + d.cmp])} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 판단 기록 ── */
const rowOf = (x: DecRow) => (x.d || x.ev) as Dec & EvDay;
/** 줄의 제목 글 (btRowHtml 의 act) */
const actOf = (x: DecRow) => (x.ev ? (x.ev.out === 'buy' ? x.ev.title + ' ' + x.ev.tag : x.ev.title) : (x.d as Dec).act || (x.d as Dec).title);
const shortDate = (s: string) => {
  const m = s.match(/(\d{4})\. (\d+)\. (\d+)\./);
  return m ? m[2] + '. ' + m[3] + '.' : s;
};
/** btRowHtml(x). grp 는 연속된 「그대로 유지」를 한 줄로 묶은 것(원본 skbGroupHolds) */
function DecRowView({ x, grp, hid }: { x: DecRow; grp?: { n: number; t1: string; t2: string }; hid?: boolean }) {
  const sel = useBt((b) => b.sel);
  const g = useBt((b) => b.grp);
  const R = BT.R as BtR;
  const ev = x.ev;
  const d = rowOf(x);
  const on = !!sel && (ev ? sel.t === 'e' && sel.ix === d.ix : sel.t === 'd' && sel.ix === d.ix);
  const inGrp = !ev && !!g && d.ix >= g.a && d.ix <= g.b && d.k === 'skip';
  let say: string;
  if (ev) {
    const B = ev.ds.filter((q) => q.k === 'buy');
    say = B.length > 1 ? R.list.length + '종목을 비교해 순위가 높은 ' + B.length + '종목을 나눠 매수했습니다' : (ev.ds[0] && ev.ds[0].say) || ev.why || '';
  } else say = (x.d as Dec).say || (x.d as Dec).why || '';
  const dd = ev ? ev.ds.filter((q) => q.k === 'buy')[0] || ev.ds[0] : (x.d as Dec);
  const time = tx(btYMD(d.i).slice(2));
  const o = !ev ? (x.d as Dec).out : null;
  return (
    <div className={'bt-row v2 k-' + d.k + (on ? ' on' : '') + (inGrp ? ' grp' : '') + (grp ? ' skb-grp' : '')} style={hid ? { display: 'none' } : undefined} data-skb-hid={hid ? '1' : undefined}>
      <button type="button" className="bt-rb" aria-expanded={on} onClick={() => (ev ? btSelEv(d.ix) : btSelDec(d.ix))}>
        <time className="num">{time}</time>
        <BtDot d={dd} />
        <b>{grp ? '그대로 유지 ' + grp.n + '번' : tx(actOf(x))}</b>
        <span className="wy">{grp ? shortDate(grp.t2) + '부터 ' + shortDate(grp.t1) + '까지 조건에 맞아 그대로 뒀습니다' : tx(say)}</span>
        {o && (
          <span className={'ot' + (o.mute ? ' m' : '')}>
            <small>{tx(o.t)}</small>
            <Num v={o.v}>{mkPct0(o.v, 1)}</Num>
          </span>
        )}
        <Chev />
      </button>
      {on && (ev ? <EvDetail E={ev} /> : <DecDetail d={x.d as Dec} />)}
    </div>
  );
}
/** btDecRows() */
function DecRows({ R, s }: { R: BtR; s: Strat }) {
  const filt = useBt((b) => b.filt) as string;
  const sort = useBt((b) => b.sort);
  const decN = useBt((b) => b.decN);
  const L = btDecList(R, s, filt, sort);
  const n = L.length;
  const N = Math.max(BT_PAGE, decN || BT_PAGE);
  if (!n) return <p className="bt-none">이 종류의 판단은 없었습니다</p>;
  const out: ReactNode[] = [];
  let ym = '';
  /* 연속된 「그대로 유지」는 첫 줄 하나로 묶고 나머지는 숨긴다. 월 구분이 끼면 묶음이 끊긴다 */
  let run: number[] = [];
  const rows: { x: DecRow; at: number }[] = [];
  const meta: Record<number, { grp?: { n: number; t1: string; t2: string }; hid?: boolean }> = {};
  const flush = () => {
    if (run.length > 1) {
      const t = (i: number) => tx(btYMD(rowOf(rows[i].x).i).slice(2));
      meta[run[0]] = { grp: { n: run.length, t1: t(run[0]), t2: t(run[run.length - 1]) } };
      run.slice(1).forEach((i) => (meta[i] = { hid: true }));
    }
    run = [];
  };
  L.slice(0, N).forEach((x) => {
    const d = rowOf(x);
    const dt = idxToDate(d.i);
    const k = dt.getFullYear() + '년 ' + (dt.getMonth() + 1) + '월';
    if (sort !== 'big' && k !== ym) {
      ym = k;
      flush();
      let c = 0;
      L.forEach((y) => {
        const t = idxToDate(rowOf(y).i);
        if (t.getFullYear() === dt.getFullYear() && t.getMonth() === dt.getMonth()) c++;
      });
      out.push(
        <div key={'ym' + k} className="bt-ym">
          <b>{k}</b>
          <span className="num">{c}건</span>
        </div>,
      );
    }
    const at = rows.length;
    rows.push({ x, at });
    if (/^그대로 유지$/.test(tx(actOf(x)).trim())) run.push(at);
    else flush();
    out.push(at);
  });
  flush();
  return (
    <>
      {out.map((o) => {
        if (typeof o !== 'number') return o;
        const x = rows[o].x;
        const d = rowOf(x);
        return <DecRowView key={(x.ev ? 'e' : 'd') + d.ix} x={x} {...meta[o]} />;
      })}
      {n > N ? (
        <button type="button" className="bt-more" onClick={() => btMoreDec(N + BT_PAGE * 2)}>
          <span className="u">{tx('이전 판단 더 보기 ').trim()}</span> <i className="num">{tx(N + ' / ' + n)}</i>
        </button>
      ) : n > BT_PAGE ? (
        <p className="bt-end num">{n}건을 모두 봤습니다</p>
      ) : null}
    </>
  );
}

/* ── 거래 내역 ── */
/** btTrDetail(t), 선물이면 fuTrDetail(t) */
function TrDetail({ t }: { t: Tr }) {
  const s = BT.s as Strat;
  const amt = BT.amt;
  const fut = isFut(s);
  const put = amt * t.cost;
  const got = t.got != null ? amt * t.got : put * (1 + t.pnl / 100);
  let L: [string, string][];
  let P: [string, ReactNode][];
  if (fut) {
    const side = t.side as number;
    const mv = side * (t.xp / t.ep - 1) * 100;
    const lv = t.lev || 1;
    const cost = t.pnl - mv * lv;
    L = [
      ['방향과 배수', fuSd(side) + ' ' + lv + '배'],
      ['진입한 날', btYMD(t.e) + ', ' + btPx(t.ep)],
      [t.open ? '지금 가격' : '청산한 날', (t.open ? '' : btYMD(t.x as number) + ', ') + btPx(t.xp)],
      ['들고 있던 기간', t.days + '일'],
      ['넣은 돈(증거금)', btUsd(put)],
    ];
    P = [
      [
        '가격이 움직인 만큼',
        <>
          <Num v={mv}>{mkPct0(mv, 1)}</Num>
          {side < 0 ? ', 숏이라 내릴수록 이익' : ''}
        </>,
      ],
    ];
    if (lv > 1) P.push(['레버리지 ' + lv + '배 반영', <Num v={mv * lv}>{mkPct0(mv * lv, 1)}</Num>]);
    if (!t.open) P.push(['수수료와 펀딩비', <Num>{mkPct0(cost, 1)}</Num>]);
  } else {
    const mv = (t.xp / t.ep - 1) * 100;
    const fee = t.pnl - mv;
    L = [
      ['산 날', btYMD(t.e) + ', ' + btPx(t.ep)],
      [t.open ? '지금 가격' : '판 날', (t.open ? '' : btYMD(t.x as number) + ', ') + btPx(t.xp)],
      ['들고 있던 기간', t.days + '일'],
      ['넣은 돈', btUsd(put)],
    ];
    P = [['가격이 움직인 만큼', <Num v={mv}>{mkPct0(mv, 1)}</Num>]];
    if (!t.open)
      P.push([
        '수수료',
        <>
          <Num>{mkPct0(fee, 1)}</Num>
          {tx(', 살 때와 팔 때 0.1%씩')}
        </>,
      ]);
  }
  P.push([
    t.open ? '지금 손익' : '이 거래의 손익',
    <>
      <Num v={t.pnl}>{mkPct0(t.pnl, 1)}</Num>
      {', ' + btUsdS(got - put)}
    </>,
  ]);
  return (
    <div className="bt-dd-in">
      <div className="bt-dd-c">
        <small>
          {tx(t.a + (fut ? ' 선물 가격, 진입 전후 ' : ' 가격, 매수 전후 '))}
          <i>USD</i>
        </small>
        <TradeMini t={t} />
        <p className="bt-cap2">{tx(fut ? '밝은 구간이 포지션을 들고 있던 기간입니다' : '밝은 구간이 들고 있던 기간입니다')}</p>
      </div>
      <div className="bt-dd-f">
        <div className="bt-blk">
          <h4>거래</h4>
          <Facts rows={L} />
        </div>
        <div className="bt-blk">
          <h4>손익이 나온 과정</h4>
          <Facts rows={P} />
          {!t.open && <p className="bt-after">{tx((fut ? '청산한 이유: ' : '판 이유: ') + ((fut ? FU_WHY : MK_WHY)[t.why || ''] || ''))}</p>}
        </div>
      </div>
    </div>
  );
}
/** btTrRows() */
function TrRows({ R }: { R: BtR }) {
  const trf = useBt((b) => b.trf);
  const ordN = useBt((b) => b.ordN);
  const sel = useBt((b) => b.sel);
  const L = btTrList(R, trf);
  const n = L.length;
  return (
    <>
      <div className="bt-th">
        <span>종목</span>
        <span>{tx('산 날', true)}</span>
        <span>{tx('판 날', true)}</span>
        <span className="r">{tx('기간', true)}</span>
        <span className="r">손익</span>
        <span />
      </div>
      {n ? (
        L.slice(0, ordN).map((t) => {
          const on = !!sel && sel.t === 't' && sel.id === t.id;
          return (
            <div key={t.id} className={'bt-row bt-tr' + (on ? ' on' : '')}>
              <button type="button" className="bt-rb" aria-expanded={on} onClick={() => btSelTr(t.id)}>
                <b>
                  {tx(mkTk(t.a) + (t.side ? ' ' : ''))}
                  {!!t.side && <i className={'bt-sd' + (t.side < 0 ? ' s' : '')}>{(t.side > 0 ? '롱' : '숏') + ((t.lev || 0) > 1 ? ' ' + t.lev + '배' : '')}</i>}
                </b>
                <time className="num">
                  <i>{tx('매수')}</i>
                  {tx(btYMD(t.e))}
                </time>
                <time className="num">
                  <i>{tx('매도')}</i>
                  {t.open ? '보유 중' : tx(btYMD(t.x as number))}
                </time>
                <span className="r num">{t.days}일</span>
                <span className={'r num' + mkSign(t.pnl)}>{mkPct0(t.pnl, 1)}</span>
                <Chev />
              </button>
              {on && <TrDetail t={t} />}
            </div>
          );
        })
      ) : (
        <p className="bt-none">이 종류의 거래는 없었습니다</p>
      )}
      {n > ordN && (
        <button type="button" className="bt-more" onClick={btMoreTr}>
          <span className="u">이전 거래 {Math.min(12, n - ordN)}건 더 보기</span>{' '}
        </button>
      )}
    </>
  );
}

/* ── 월별 수익률 ── */
/** btMonths() 의 막대(숨김)와, 그것을 연도 x 월로 다시 짠 표 */
function Months({ R }: { R: BtR }) {
  const m = R.mon;
  const mx = Math.max.apply(
    null,
    m.map((x) => Math.abs(x.ret)).concat(1),
  );
  const H = 58;
  const lab = m.map((x) => ({ pct: Math.abs(x.ret) < 0.05 ? '0%' : mkPct0(x.ret, 1), y: x.y, m: x.m, part: x.part }));
  const T = btMonthTable(lab);
  const MS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const cls = (v: number) => (v > 0 ? 'u' : v < 0 ? 'd' : '');
  return (
    <>
      <div className="bt-monw skb-hid">
        <div className="bt-mon" style={{ ['--n' as string]: m.length }}>
          {m.map((x, q) => {
            const h = Math.max(2, (Math.abs(x.ret) / mx) * H);
            const up = x.ret >= 0.05;
            const dn = x.ret <= -0.05;
            return (
              <div key={q} className={'bt-mo' + (up ? ' u' : dn ? ' d' : ' z') + (x.part ? ' pt' : '')}>
                <b className="num">{lab[q].pct}</b>
                <span className="p">
                  <i style={{ height: (up ? h : 0).toFixed(1) + 'px' }} />
                </span>
                <span className="n">
                  <i style={{ height: (dn ? h : 0).toFixed(1) + 'px' }} />
                </span>
                <em className="num">{(x.m === 1 || q === 0 ? String(x.y).slice(2) + '년 ' : '') + x.m + '월'}</em>
                {x.part && <small>일부</small>}
              </div>
            );
          })}
        </div>
      </div>
      {!T.full ? (
        <p className="skb-mt-short">
          아직 한 달이 안 됐습니다. 지금까지 <b className={'num ' + cls(T.r0)}>{(T.r0 > 0 ? '+' : '') + T.r0.toFixed(1)}%</b>입니다.
        </p>
      ) : (
        <>
          <div className="skb-mtw">
            <table className="skb-mt">
              <thead>
                <tr>
                  <th>연도</th>
                  {MS.map((k) => (
                    <th key={k}>{k}월</th>
                  ))}
                  <th>누적</th>
                </tr>
              </thead>
              <tbody>
                {T.order.map((y) => {
                  const ys = T.yrSum(y);
                  return (
                    <tr key={y}>
                      <td>{y}</td>
                      {MS.map((k) => {
                        const c = T.Y[y][k];
                        if (!c)
                          return (
                            <td key={k} className="e">
                              -
                            </td>
                          );
                        return (
                          <td key={k} className={cls(parseFloat(c.p))}>
                            {c.p}
                            {c.part && <small>일부</small>}
                          </td>
                        );
                      })}
                      <td className={'yr ' + cls(parseFloat(ys))}>{ys}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="skb-mtm">
            {T.order.map((y) => {
              const ys = T.yrSum(y);
              return [
                <div key={'y' + y} className="y">
                  {y}
                  <span className={'num ' + cls(parseFloat(ys))}>누적 {ys}</span>
                </div>,
                <div key={'g' + y} className="g">
                  {MS.map((k) => {
                    const c = T.Y[y][k];
                    if (!c)
                      return (
                        <div key={k} className="c e">
                          <em>{k}월</em>
                          <b>-</b>
                        </div>
                      );
                    return (
                      <div key={k} className="c">
                        <em>{k}월</em>
                        <b className={'num ' + cls(parseFloat(c.p))}>{c.p}</b>
                        {c.part && <small>일부</small>}
                      </div>
                    );
                  })}
                </div>,
              ];
            })}
          </div>
        </>
      )}
    </>
  );
}
/** 월별 수익률의 한 줄 요약. 꽉 찬 달이 셋보다 적으면 일부 기간 안내로 바뀐다 */
function monthsSay(R: BtR): string {
  const full = R.mon.filter((x) => !x.part).length;
  const say = btMonthsSum(R);
  if (!say) return '';
  return full < 3 ? '시작한 달과 마지막 달은 일부 기간만 계산했습니다.' : tx(say);
}

/** btTech() */
function Tech({ R }: { R: BtR }) {
  const r = R.r;
  const row = (k: string, v: string, t: string) => (
    <div>
      <dt>
        <MkdTerm t={k} tip={t} />
      </dt>
      <dd className="num">{v}</dd>
    </div>
  );
  return (
    <details className="bt-tech">
      <summary>
        {tx('자세한 지표', true)}
        <Chev />
      </summary>
      <dl className="bt-dl bt-tech-g">
        {row('승률', Math.round(R.win) + '%', '끝난 거래 중 이익으로 끝난 거래의 비율입니다.')}
        {row('손익비', (r.pf || 0).toFixed(2), '이긴 거래에서 번 돈을 진 거래에서 잃은 돈으로 나눈 값입니다. 1보다 크면 번 돈이 더 많습니다.')}
        {row('1년으로 환산한 수익률', mkPct0(r.cagr || 0, 1), '이 기간의 수익률을 1년 기준으로 바꾼 값입니다.')}
        {row('종목을 들고 있던 시간', Math.round(Math.min(100, r.exposure || 0)) + '%', '전체 기간 중 종목을 들고 있던 날의 비율입니다. 나머지는 현금으로 기다렸습니다.')}
        {row('낸 수수료', btUsd((BT.amt * (r.costImpact || 0)) / 100, 1), '살 때와 팔 때 낸 수수료를 모두 더한 값입니다. 위 결과는 이 수수료를 뺀 뒤의 값입니다.')}
        {row('가장 길게 회복을 기다린 기간', (r.underwaterDays || 0) + '일', '잔고가 그 전 가장 높았던 값으로 돌아오기까지 걸린 가장 긴 기간입니다.')}
      </dl>
    </details>
  );
}

/** btEvidence() */
export function Evidence() {
  const R = useBt((b) => b.R);
  const s = useBt((b) => b.s) as Strat;
  const phase = useBt((b) => b.phase);
  const f = useBt((b) => b.filt);
  const so = useBt((b) => b.sort);
  const tf = useBt((b) => b.trf);
  if (phase !== 'result' || !R) return <div className="bt-ev" id="bt-ev" />;
  const S4 = btSum4(R, s);
  const unit = (k: string) => ((k === 'opp' || k === 'skip') && s.kind === 'agent' ? '일' : k === 'opp' ? '번' : '건');
  return (
    <div className="bt-ev" id="bt-ev">
      <section className="bt-sec-b" id="bt-dec">
        <header className="v2">
          <h3>{tx('어떻게 판단했나', true)}</h3>
          <label className="bt-sort">
            <span>정렬</span>
            <select value={so} onChange={(e) => btSort(e.target.value)} aria-label="정렬">
              <option value="new">최신순</option>
              <option value="old">오래된순</option>
              <option value="big">결과가 큰 순</option>
            </select>
          </label>
        </header>
        <div className={'bt-s4 n' + (S4.length + 1)} role="tablist" aria-label="판단 종류">
          {S4.map((c) => (
            <button key={c[0]} type="button" role="tab" aria-selected={f === c[0]} className={'k-' + c[0]} onClick={() => btFilt(c[0])}>
              <small>{tx(c[1])}</small>
              <b className="num">
                {c[2]}
                <i>{unit(c[0])}</i>
              </b>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={f === 'all'} className="k-all" onClick={() => btFilt('all')}>
            <small>전체 기록</small>
            <b className="num">
              {btDecList(R, s, 'all', so).length}
              <i>건</i>
            </b>
          </button>
        </div>
        <div className="bt-list v2" id="bt-dl">
          <DecRows R={R} s={s} />
        </div>
      </section>
      <section className="bt-sec-b" id="bt-trs">
        <header>
          <h3>{tx('거래 하나씩 보기', true)}</h3>
          <div className="bt-chips" role="group" aria-label="거래 종류">
            {(
              [
                ['all', '전체 ' + R.tr.length],
                ['win', '이긴 거래 ' + R.wins.length],
                ['loss', '진 거래 ' + R.loss.length],
              ] as [string, string][]
            ).map((c) => (
              <button key={c[0]} type="button" aria-pressed={tf === c[0]} onClick={() => btTrFilt(c[0])}>
                {tx(c[1], true)}
              </button>
            ))}
          </div>
        </header>
        <div className="bt-list bt-tlist" id="bt-tl">
          <TrRows R={R} />
        </div>
      </section>
      <section className="bt-sec-b">
        <header>
          <h3>{tx('달마다 어땠나', true)}</h3>
          <span>{monthsSay(R)}</span>
        </header>
        <Months R={R} />
      </section>
      <Tech R={R} />
    </div>
  );
}
