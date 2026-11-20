// 복사 설정 창 (원본 skcSheet = mkFollowSheet): 예산 > 손실 중단 기준 > 요약 > 세부 설정 > 시작.
// body 바로 아래에 붙고, 떠 있는 동안 나머지 화면은 inert 다.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fuIs, mkMin, mkScope, tfSSFind } from '../../core/engine/catalog';
import { cpUsd } from '../../core/engine/format';
import type { Strat } from '../../core/engine/types';
import { useShare } from '../../state/share';
import { useApp } from '../../state/store';
import { cpSetupGo, cpStart, followClose, tfIntentClear, tfIntentPeek } from './copyActions';
import { goDetail } from './Hub';
import { Glyph } from './parts';

const SKC_LOSS = [-10, -20, -30, -50];

/** skcSub(s) */
function skcSub(s: Strat): string {
  const by = s.by ? '@' + s.by : '';
  const sc = mkScope(s) + (fuIs(s) ? ' 선물' : '');
  return [by, sc].filter(Boolean).join(', ');
}
/** skcLev(s) */
function skcLev(s: Strat): number {
  const c = s.cfg;
  return c && c.fut && (c.lev as number) > 1 ? (c.lev as number) : 0;
}
/** skcRow(k,v) */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="r">
      <span>{k}</span>
      <b className="num">{v}</b>
    </div>
  );
}

function Sheet({ s }: { s: Strat }) {
  const spot = useShare((x) => x.cp.spot);
  const [amt, setAmt] = useState('');
  const [loss, setLoss] = useState(-20); /* TF_MKF.loss */
  const [existing, setExisting] = useState('skip'); /* TF_MKF.existing */
  const [cap, setCap] = useState(95); /* TF_MKF.cap */
  const [more, setMore] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  const silent = useRef(false);
  const min = mkMin(s);
  const lev = skcLev(s);

  /* cpFormSync() */
  const v = parseFloat(amt);
  let msg = '';
  if (amt !== '' && (!isFinite(v) || v < min)) msg = '최소 $' + min + '부터 시작할 수 있습니다';
  else if (isFinite(v) && v > spot) msg = '사용 가능 금액보다 큽니다';
  const ok = amt !== '' && isFinite(v) && v >= min && v <= spot;
  /* skcSum(v): 금액이 틀려도 적은 값으로 요약한다 */
  const sv = ok ? v : isFinite(v) && v > 0 ? v : null;
  const L = Math.abs(loss || 20);

  useEffect(() => {
    const w = wrap.current;
    const trig = document.activeElement as HTMLElement | null; /* TF_MKF.trig */
    /* mkFollowInert(true,w) */
    const marked: Element[] = [];
    [].forEach.call(document.body.children, (x: HTMLElement) => {
      if (x === w || x.tagName === 'SCRIPT' || x.tagName === 'STYLE') return;
      if (!x.inert) {
        x.inert = true;
        x.setAttribute('data-mkf-inert', '1');
        marked.push(x);
      }
    });
    const gs = document.getElementById('g-scroll');
    if (gs) gs.style.overflow = 'hidden';
    /* mkFollowEsc(e): Esc 로 닫고, Tab 은 창 안에서만 돈다 */
    const key = (e: KeyboardEvent) => {
      const d = document.getElementById('ss3-dlgw'); /* 시트 위에 다른 대화 상자가 열려 있으면 그쪽이 맨 위다 */
      if (e.key === 'Escape') {
        if (!d) followClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const box = d || w;
      if (!box) return;
      const f = [].filter.call(box.querySelectorAll('button,input,select,textarea,summary,a[href]'), (x: HTMLInputElement) => {
        const dt = x.closest('details');
        if (dt && !dt.open && x.tagName !== 'SUMMARY') return false;
        return !x.disabled && x.tabIndex >= 0 && x.getClientRects().length > 0;
      }) as HTMLElement[];
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey ? i <= 0 : i < 0 || i === f.length - 1) {
        e.preventDefault();
        f[e.shiftKey ? f.length - 1 : 0].focus();
      }
    };
    document.addEventListener('keydown', key);
    if (inp.current && window.innerWidth > 760) {
      try {
        inp.current.focus();
      } catch {
        /* 무시 */
      }
    }
    return () => {
      marked.forEach((x) => {
        (x as HTMLElement).inert = false;
        x.removeAttribute('data-mkf-inert');
      });
      document.removeEventListener('keydown', key);
      if (gs && !document.getElementById('ss3-dlgw')) gs.style.overflow = '';
      if (!silent.current && trig && trig.focus && document.body.contains(trig)) {
        try {
          trig.focus();
        } catch {
          /* 무시 */
        }
      }
    };
  }, []);

  return createPortal(
    <div
      className="mk-follow-w skc-w"
      id="mk-follow"
      ref={wrap}
      onClick={(e) => {
        if (e.target === e.currentTarget) followClose();
      }}
    >
      <div className="mk-follow skc" role="dialog" aria-modal="true" aria-labelledby="mk-f-t">
        <div className="skc-body">
          <div className="skc-hd">
            <h2 id="mk-f-t">전략 복사</h2>
            <button type="button" className="mk-f-x" aria-label="닫기" onClick={followClose}>
              ✕
            </button>
          </div>
          <div className="skc-strat">
            <div className="nm">
              <Glyph s={s} z={32} />
              <div>
                <b>{s.name}</b>
                <span>{skcSub(s)}</span>
              </div>
            </div>
            {lev ? (
              <p className="skc-lev">
                현재 레버리지는 <span className="num">{lev + '배'}</span>입니다. 원본에서 바꾸면 내 복사에도 적용됩니다.
              </p>
            ) : null}
          </div>
          <div className={'skc-fld' + (msg ? ' bad' : '')} id="cps-amt-fld">
            <label htmlFor="cps-amt">복사 예산</label>
            <div className="skc-in">
              <i>$</i>
              <input id="cps-amt" ref={inp} type="number" inputMode="decimal" min={min} placeholder={String(min)} value={amt} onChange={(e) => setAmt(e.target.value)} aria-describedby="skc-amt-h cps-amt-err" />
              <button type="button" className="mx" onClick={() => setAmt(String(Math.floor(spot)))}>
                최대
              </button>
            </div>
            <div className="skc-hint" id="skc-amt-h">
              사용 가능{' '}
              <b className="num" id="cps-spot">
                {cpUsd(spot, 0)}
              </b>
              , 최소 <span className="num">{cpUsd(min, 0)}</span>
            </div>
            <div className="skc-err" id="cps-amt-err" role="alert">
              {msg}
            </div>
          </div>
          <div className="skc-fld">
            <span className="lb" id="skc-loss-l">
              손실 중단 기준
            </span>
            {/* skcLoss(v,btn) */}
            <div className="skc-pills" role="radiogroup" aria-labelledby="skc-loss-l">
              {SKC_LOSS.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={x === loss} className={x === loss ? 'on' : ''} onClick={() => setLoss(x)}>
                  {Math.abs(x) + '%'}
                </button>
              ))}
            </div>
            <div className="skc-hint" id="mk-f-lossh">
              {'예산의 ' + L + '%를 잃으면 복사를 자동으로 멈춥니다.'}
            </div>
          </div>
          <div className="skc-sum" id="mk-f-sum">
            <Row k="복사 예산" v={sv == null ? <em>미입력</em> : cpUsd(sv, 0)} />
            <Row k="손실 중단 기준" v={sv == null ? L + '%' : cpUsd((sv * L) / 100, 0) + ' (' + L + '%)'} />
            <Row k="시작 시점" v={existing === 'copy' ? '현재 포지션부터' : '다음 진입부터'} />
            <Row k="주문당 예산 한도" v={(cap || 95) + '%'} />
          </div>
          <p className="skc-more">
            {/* skcMore() */}
            <button type="button" className="pl-link" id="skc-more-b" aria-expanded={more} onClick={() => setMore(!more)}>
              {more ? '세부 설정 접기' : '세부 설정'}
            </button>
          </p>
          <div className="skc-adv" id="skc-adv" hidden={!more}>
            <div className="skc-fld">
              <span className="lb" id="skc-ex-l">
                복사 시작 시점
              </span>
              {/* skcEx(v,btn) */}
              <div className="skc-pills two" id="mk-f-ex" role="radiogroup" aria-labelledby="skc-ex-l">
                <button type="button" role="radio" aria-checked={existing === 'skip'} className={existing === 'skip' ? 'on' : ''} onClick={() => setExisting('skip')}>
                  다음 진입부터
                </button>
                <button type="button" role="radio" aria-checked={existing === 'copy'} className={existing === 'copy' ? 'on' : ''} onClick={() => setExisting('copy')}>
                  현재 포지션부터
                </button>
              </div>
              <div className="skc-hint" id="skc-ex-h">
                {existing === 'copy' ? '원본이 지금 가진 포지션을 현재 가격으로 바로 따라 삽니다.' : '원본이 새로 진입할 때부터 따라갑니다.'}
              </div>
            </div>
            <div className="skc-fld skc-cap">
              <label htmlFor="mk-f-cap">주문당 예산 한도</label>
              <div className="skc-in sm">
                {/* mkFollowCap(v) */}
                <input
                  id="mk-f-cap"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={95}
                  step={5}
                  defaultValue={95}
                  onInput={(e) => {
                    const n = parseInt(e.currentTarget.value, 10);
                    if (isFinite(n)) setCap(Math.max(5, Math.min(95, n)));
                  }}
                />
                <i>%</i>
              </div>
            </div>
            <div className="skc-hint">한 번의 주문에 쓰는 예산 비율입니다.</div>
          </div>
        </div>
        <div className="skc-ft">
          <button
            type="button"
            className="pl-cta pl-cta-w skc-cta"
            id="cps-cta"
            disabled={!ok}
            onClick={() => {
              silent.current = true;
              if (!cpStart(s.id, { amt: v, loss, existing, cap })) silent.current = false;
            }}
          >
            전략 복사 시작
          </button>
          <p className="skc-foot">복사는 무료이며 언제든 멈출 수 있습니다.</p>
        </div>
        <div id="mk-f-live" role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {sv != null && ok ? '복사 예산 ' + cpUsd(sv, 0) + ', 손실 ' + L + '%에서 멈춤' : ''}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FollowSheet() {
  const id = useShare((x) => x.follow);
  const user = useApp((x) => x.user);
  /* 화면을 떠나면 창도 닫는다 */
  useEffect(() => {
    const h = () => followClose();
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  /* tfIntentRun(): 가입을 마치면 하려던 복사로 돌아간다 */
  const was = useRef(!!user);
  useEffect(() => {
    const fresh = !!user && !was.current; /* 방금 가입(로그인)을 마쳤을 때만 */
    was.current = !!user;
    if (!fresh) return;
    const o = tfIntentPeek();
    if (!o || o.kind !== 'copy') return;
    tfIntentClear();
    const t = setTimeout(() => {
      if (window.location.hash.indexOf('#/share/s/') !== 0) goDetail(o.id, 'all', 'ov');
      setTimeout(() => cpSetupGo(o.id), 500);
    }, 320);
    return () => clearTimeout(t);
  }, [user]);
  const s = id ? tfSSFind(id) : null;
  return s ? <Sheet key={s.id} s={s} /> : null;
}
