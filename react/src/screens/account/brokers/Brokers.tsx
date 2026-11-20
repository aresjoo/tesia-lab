// 거래소 연결 화면 (#/brokers, #/brokers/<거래소>). 원본 tfBrokersView() = acPageView() 가 그리는 세 화면:
// 플랜 화면(plView), 플랜 구성(plCheckout), 플랜 뒤 화면(px: 거래소 선택, 계정, 승인, 확인, 완료, 연결된 거래소 목록).
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  AC_CFG,
  AC_PAID_MAX,
  acCardFmt,
  acConnList,
  acConnOk,
  acEx,
  acExpFmt,
  acExs,
  acName,
  acRef,
  acRouteNow,
  acS,
  acSavedCard,
  acStep,
  acSubOn,
  acUsd,
  plRebate,
  type AcBt,
  type AcStepK,
} from '../../../core/account/ac';
import { useBodyClass } from '../../../state/hooks';
import { setState, sideMobClose } from '../../../state/store';
import { scrollTop, useTf } from '../util';
import {
  acAddMore,
  acAuthOpen,
  acDisc,
  acGoTerminal,
  acLeave,
  acPageView,
  acSheetDone,
  cardInput,
  cardSave,
  PL,
  plApple,
  plCheckout,
  plNewCard,
  plPay,
  plPaySaved,
  plPick,
  plView,
  pxBack,
  pxGuide,
  pxHas,
  pxInvite,
  pxJoined,
  pxLimitAlt,
  pxPaidRoute,
  pxPickEx,
  pxSub,
  pxUidAlt,
  UI,
} from './flow';
import { AcCk, AcHelp, AcLogo, AcOut, maskId, PlI, PlLogos, PxChev, PxHelp, type PlIcon } from './parts';

const Sp = () => <i className="acx-sp" />;

export function Brokers({ ex }: { ex: string | null }) {
  useTf();
  /* 주소로 들어오면 acPageView(ex). acStart 가 화면을 정해 두고 들어온 때는 그대로 둔다 */
  useLayoutEffect(() => {
    if (PL.entered) PL.entered = false;
    else acPageView(ex && acEx(ex) ? ex : null);
    return acLeave;
  }, [ex]);
  /* gContent(): 화면이 바뀌면 맨 위로, 모바일 드로어는 닫는다 */
  const seq = PL.seq;
  useEffect(() => {
    scrollTop();
    sideMobClose();
  }, [seq]);
  const view = PL.view;
  useBodyClass('pl-page', true);
  useBodyClass('pl-dark', view !== 'plan');
  useEffect(() => {
    setState({ chead: view === 'checkout' ? '플랜 구성' : '거래소 연결' });
  }, [view]);
  if (view === 'plan') return <PlanCards />;
  if (view === 'checkout') return <Checkout />;
  return <Page />;
}

/* ═══ 화면 1: 두 카드 (plView) ═══ */
const Items = ({ list, sm }: { list: [PlIcon, ReactNode][]; sm?: boolean }) => (
  <ul className={'pl-items' + (sm ? ' sm' : '')}>
    {list.map(([k, t], i) => (
      <li key={i}>
        <PlI k={k} />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);
/** mkPct0(v, d) */
const mkPct0 = (v: number, d = 1) => {
  const x = +v.toFixed(d);
  return (x > 0 ? '+' : '') + x.toFixed(d) + '%';
};
/** mkSign(v) */
const mkSign = (v: number) => {
  const x = +v.toFixed(1);
  return x > 0 ? ' mk-up' : x < 0 ? ' mk-dn' : '';
};
/** plBtCard(b): 왼쪽 결과 카드. 결과가 좋은 백테스트에서 왔을 때만 */
function PlBtCard({ b }: { b: AcBt }) {
  const eq = b.eq || [];
  const W = 280;
  const H = 72;
  const mn = Math.min(...eq);
  const mx = Math.max(...eq);
  const rg = mx - mn || 1;
  const pts = eq.map((v, i) => ((i / (eq.length - 1)) * W).toFixed(1) + ',' + (H - ((v - mn) / rg) * (H - 6) - 3).toFixed(1)).join(' ');
  return (
    <article className="pl-card pl-bt">
      <div className="pl-lb">실행할 전략</div>
      <h2 className="pl-h">{b.name}</h2>
      <p className="pl-d">{b.per + ', ' + b.amt + '로 시작. ' + acName(b.ex) + '에서 실행합니다.'}</p>
      <div className="pl-price">
        <span className={'num' + mkSign(b.ret)}>{mkPct0(b.ret, 1)}</span>
        <small>검증 수익률</small>
      </div>
      {eq.length > 2 && (
        <svg className="pl-spark" viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={pts} fill="none" stroke={b.ret >= 0 ? '#2fb98a' : '#f0566a'} strokeWidth="2" />
        </svg>
      )}
      <Items
        list={[
          ['coin', '그냥 들고 있었다면 ' + mkPct0(b.bench, 1)],
          ['swap', '가장 크게 내려간 폭 ' + b.mdd.toFixed(1) + '%'],
          ['cal', '거래 ' + b.n + '번'],
        ]}
      />
    </article>
  );
}
function PlanCards() {
  const ctx = PL.ctx || {};
  const bt = ctx.bt || null;
  const need = ctx.need ? acName(ctx.need) : null;
  const exs = (
    <>
      연결 가능한 거래소 7곳 <PlLogos z={16} />
    </>
  );
  return (
    <div className={'pl' + (bt ? ' pl-wide' : '')} id="pl-root">
      <header className="pl-head">
        <h1>거래소 연결</h1>
        {need && (
          <p className="pl-need">{'이 전략은 ' + need + '에서 실행됩니다. ' + need + ' 계정을 연결합니다.'}</p>
        )}
      </header>
      <div className={'pl-grid' + (bt ? ' has-bt' : '')}>
        {bt && <PlBtCard b={bt} />}
        <article className="pl-card pl-hi">
          <div className="pl-top">
            <span className="pl-lb">TETH 초대 계정</span>
          </div>
          <h2 className="pl-h">거래하는 사람을 위해</h2>
          <p className="pl-d">TETH 초대로 가입한 거래소 계정으로 이용합니다. 초대 계정이 없다면 거래소에 새로 가입합니다.</p>
          <div className="pl-price">
            <i>$</i>
            <span className="num pl-grad">0</span>
            <small>/ 월</small>
          </div>
          <button type="button" className="pl-cta pl-cta-hi" onClick={() => plPick('partner')}>
            무료로 시작하기
          </button>
          <div className="pl-sub">포함된 기능</div>
          <Items
            list={[
              ['bolt', '전략 자동 실행'],
              ['grid', exs],
              ['coin', '거래 수수료 환급'],
              ['trophy', '전략 대회 참가'],
              ['card', '카드 등록 없이 이용'],
              ['lock', '연결 권한: 잔고 조회와 주문'],
              ['head', '24시간 고객 지원'],
            ]}
          />
          <p className="pl-foot">{plRebate() + ' 연결 과정에서 TETH 초대 계정 여부를 확인합니다.'}</p>
        </article>
        <article className="pl-card">
          <div className="pl-top">
            <span className="pl-lb">TETH 구독</span>
          </div>
          <h2 className="pl-h">지금 쓰는 계정 그대로</h2>
          <p className="pl-d">TETH 초대로 가입하지 않은 거래소 계정도 연결합니다. 기존 계정을 유지하며 전략을 실행합니다.</p>
          <div className="pl-price">
            <i>$</i>
            <span className="num">280</span>
            <small>/ 월</small>
          </div>
          <button type="button" className="pl-cta" onClick={() => plPick('paid')}>
            구독으로 시작하기
          </button>
          <div className="pl-sub">구독 혜택</div>
          <Items
            list={[
              ['bolt', '전략 자동 실행'],
              ['grid', exs],
              ['swap', '초대 가입 없이 계정 연결'],
              ['cal', '거래소 7곳 모두 연결'],
              ['lock', '연결 권한: 잔고 조회와 주문'],
              ['head', '24시간 고객 지원'],
            ]}
          />
          <p className="pl-foot">매월 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.</p>
        </article>
      </div>
      <AcHelp />
    </div>
  );
}

/* ═══ 화면 2A: 구독 결제 (plCheckout) ═══ */
function Checkout() {
  const a = acS();
  const sv = acSavedCard();
  const useSaved = !!sv && !a.newCard;
  const f = a.pay.st === 'fail';
  const price = acUsd(AC_CFG.price);
  const refs = { cn: useRef<HTMLInputElement>(null), ce: useRef<HTMLInputElement>(null), cc: useRef<HTMLInputElement>(null), ch: useRef<HTMLInputElement>(null) };
  /* acErr(): 오류가 난 칸에 초점 */
  const fz = UI.focus;
  useEffect(() => {
    if (fz.field) refs[fz.field].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fz.n]);
  const bad = (k: 'cn' | 'ce' | 'cc' | 'ch') => (UI.err[k] ? 'bad' : undefined);
  const busy = UI.busy;
  return (
    <div className="pl pl-co" id="pl-root">
      <header className="pl-cohead">
        <button type="button" className="pl-back" aria-label="뒤로" onClick={() => plView(PL.ctx)}>
          <PxChev hidden={false} />
        </button>
        <h1>플랜 구성</h1>
      </header>
      <div className="pl-cogrid">
        <section className="pl-left">
          <h3 className="pl-t3 pl-hid">TETH 구독</h3>
          <h3 className="pl-t3 mt0">결제 수단 선택하기</h3>
          {useSaved && sv ? (
            <div className="pl-saved">
              <div className="r on">
                <PlI k="card" />
                <span>
                  <b>{sv.brand + ' •••• ' + sv.last4}</b>
                  <small>{'저장한 카드, ' + sv.exp}</small>
                </span>
                <i>
                  <AcCk />
                </i>
              </div>
              <button type="button" className="pl-link" onClick={plNewCard}>
                다른 결제 수단 사용
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="pl-apple" onClick={plApple} aria-label="Apple Pay로 결제" disabled={busy === 'apple'}>
                {busy === 'apple' ? (
                  <>
                    <Sp />
                    Apple Pay 승인 중
                  </>
                ) : (
                  <>
                    <svg width="16" height="19" viewBox="0 0 16 19" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M13.1 10.1c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-1.9-.9-3.2-.8C3.2 4.7 1.7 5.6.8 7.2c-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4.1zM10.7 3c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"
                      />
                    </svg>
                    <span>Pay</span>
                  </>
                )}
              </button>
              <div className="pl-or">
                <span>또는</span>
              </div>
              {f && (
                <p className="acx-fail" role="alert">
                  결제가 승인되지 않았습니다. 카드 한도나 해외 결제 설정을 확인하고 다시 시도하거나 다른 카드를 써 주십시오.
                </p>
              )}
              <div className="pl-form">
                <div className="pl-in big">
                  <input id="ac-cn" ref={refs.cn} className={bad('cn')} placeholder="카드 번호" inputMode="numeric" maxLength={19} autoComplete="cc-number" value={UI.card.cn} onChange={(e) => cardInput('cn', acCardFmt(e.target.value))} aria-label="카드 번호" />
                  <span className="pl-brands">
                    <i className="visa">VISA</i>
                    <i className="mc" />
                    <i className="amex">AMEX</i>
                  </span>
                </div>
                <div className="two">
                  <div className="pl-in">
                    <input id="ac-ce" ref={refs.ce} className={bad('ce')} placeholder="만료 날짜" inputMode="numeric" maxLength={7} autoComplete="cc-exp" value={UI.card.ce} onChange={(e) => cardInput('ce', acExpFmt(e.target.value))} aria-label="만료 날짜" />
                  </div>
                  <div className="pl-in">
                    <input id="ac-cc" ref={refs.cc} className={bad('cc')} placeholder="보안 코드" inputMode="numeric" maxLength={4} type="password" autoComplete="cc-csc" value={UI.card.cc} onChange={(e) => cardInput('cc', e.target.value)} aria-label="보안 코드" />
                    <span className="pl-cvc">123</span>
                  </div>
                </div>
                <div className="pl-in">
                  <input id="ac-ch" ref={refs.ch} className={bad('ch')} placeholder="카드에 적힌 이름" autoComplete="cc-name" value={UI.card.ch} onChange={(e) => cardInput('ch', e.target.value)} aria-label="카드에 적힌 이름" />
                </div>
                <span className="er" id="ac-cn-e">
                  {UI.err.cn || ''}
                </span>
                <span className="er" id="ac-ce-e" hidden>
                  {UI.err.ce || ''}
                </span>
                <span className="er" id="ac-cc-e" hidden>
                  {UI.err.cc || ''}
                </span>
                <span className="er" id="ac-ch-e" hidden>
                  {UI.err.ch || ''}
                </span>
                <label className="pl-ck">
                  <input type="checkbox" id="pl-save" checked={UI.card.save} onChange={(e) => cardSave(e.target.checked)} />
                  <span>다음 결제에도 이 카드 사용</span>
                </label>
              </div>
            </>
          )}
        </section>
        <aside className="pl-right">
          <div className="pl-sumcard">
            <h2>TETH 구독</h2>
            <p>선택한 거래소 계정으로 전략을 실행합니다.</p>
            <Items
              sm
              list={[
                ['bolt', '전략 자동 실행'],
                ['swap', '초대 가입 없이 계정 연결'],
                ['lock', '연결 권한: 잔고 조회와 주문'],
                ['head', '24시간 고객 지원'],
              ]}
            />
            <div className="pl-lines">
              <div>
                <span>매월 구독료</span>
                <b className="num">{price + '.00'}</b>
              </div>
              <div className="tot">
                <span>오늘 결제 금액</span>
                <b className="num">{price + '.00'}</b>
              </div>
            </div>
            <button type="button" className="pl-cta pl-cta-w" id="ac-go" onClick={useSaved ? plPaySaved : plPay} disabled={busy === 'pay'} data-l={busy === 'pay' ? price + ' 결제하고 시작하기' : undefined}>
              {busy === 'pay' ? (
                <>
                  <Sp />
                  결제 승인 중
                </>
              ) : (
                price + ' 결제하고 시작하기'
              )}
            </button>
          </div>
          <p className="pl-legal">{'해지할 때까지 매월 ' + price + '이 자동 결제됩니다. 설정의 결제에서 언제든 해지할 수 있으며, 해지 후에도 남은 구독 기간 동안 이용할 수 있습니다.'}</p>
        </aside>
      </div>
      <AcHelp />
    </div>
  );
}

/* ═══ 플랜 뒤 화면 (px): 화면 하나에 결정 하나 ═══ */
type Title = { h: string; s: string; back: string };
/** pxTitle(): 화면마다 제목 하나, 한 줄 하나, 뒤로 가기 하나 */
function pxTitle(cur: AcStepK): Title {
  const a = acS();
  const ctx = PL.ctx || {};
  const n = acName(a.ex);
  const r = acRouteNow();
  if (cur === 'ex') return { h: '거래소 선택', s: '전략을 실행할 거래소를 선택합니다.', back: 'plan' };
  if (cur === 'acct' || cur === 'guide') return { h: n + ' 계정', s: '이용료 없이 연결하려면 TETH 초대로 가입한 ' + n + ' 계정이 필요합니다.', back: ctx.need ? 'plan' : 'ex' };
  if (cur === 'auth') return { h: n + ' 연결', s: n + ' 화면이 열리면 아래 두 권한을 허용합니다.', back: r === 'partner' ? 'acct' : ctx.need ? '' : 'ex' };
  if (cur === 'uid') {
    const u = a.uid.ex === a.ex ? a.uid : { st: 'none' };
    return u.st === 'fail' ? { h: 'TETH 초대 계정이 아닙니다', s: '이 ' + n + ' 계정은 TETH 초대로 만든 계정이 아닙니다. 아래에서 하나를 고르십시오.', back: '' } : { h: n + ' 연결 확인 중', s: '승인한 계정을 확인하고 있습니다.', back: '' };
  }
  if (cur === 'limit') return { h: '거래소 ' + AC_PAID_MAX + '곳이 연결되어 있습니다', s: '구독 하나로 ' + AC_PAID_MAX + '곳까지 연결됩니다. ' + n + ' 연결 방법을 고르십시오.', back: 'plan' };
  if (cur === 'pay') return { h: '플랜 구성', s: '', back: '' };
  if (cur === 'done') return { h: '연결되었습니다', s: '이제 ' + (ctx.name ? ctx.name + ' 전략을 ' : '전략을 ') + '시작하면 ' + acName(a.ex || acConnList()[0]) + ' 계정에서 실행됩니다.', back: '' };
  return { h: '거래소 연결', s: '', back: '' };
}
/** pxHead(t) */
function PxHead({ t }: { t: Title }) {
  return (
    <>
      <header className="pl-cohead px-head">
        {t.back && (
          <button type="button" className="pl-back" aria-label="뒤로" onClick={() => pxBack(t.back)}>
            <PxChev />
          </button>
        )}
        <h1>{t.h}</h1>
      </header>
      {t.s && <p className="px-lead">{t.s}</p>}
    </>
  );
}
function Page() {
  const ctx = PL.ctx || {};
  const L = acConnList();
  const st = acStep();
  const cur: AcStepK = st === 'commit' ? 'done' : st;
  /* acFlowHtml(): 이용 방식을 아직 안 골랐으면 플랜 화면, 결제 차례면 플랜 구성 화면으로 */
  useEffect(() => {
    if (PL.list) return;
    if (cur === 'route') plView(PL.ctx || {});
    else if (cur === 'pay') plCheckout(PL.ctx || {});
  }, [cur]);
  /* acHeadHtml() */
  const head: Title =
    ctx.page && L.length && !L.some(acConnOk)
      ? { h: '구독이 끝났습니다', s: '연결은 그대로 있습니다. 다시 구독하면 전략이 새 주문을 이어서 냅니다.', back: '' }
      : PL.list
        ? { h: '거래소 연결', s: '', back: '' }
        : pxTitle(cur);
  let body: ReactNode;
  if (PL.list)
    body = (
      <>
        <PxList />
        <PxHelp />
      </>
    );
  else if (cur === 'route') body = null;
  else if (cur === 'pay') body = <p className="px-lead">결제 화면으로 이동합니다.</p>;
  else
    body = (
      <>
        {cur === 'ex' && <PxBEx />}
        {(cur === 'acct' || cur === 'guide') && <PxBAcct />}
        {cur === 'auth' && <PxBAuth />}
        {cur === 'uid' && <PxBUid />}
        {cur === 'limit' && <PxBLimit />}
        {cur === 'done' && <PxBDone />}
        <PxHelp />
      </>
    );
  return (
    <div className="pl pl-co px" id="pl-root">
      <div id="ac-head">
        <PxHead t={head} />
      </div>
      <div className="px-body" id="ac-flow">
        {body}
      </div>
    </div>
  );
}
/** pxList(): 연결된 거래소 목록 화면 */
function PxList() {
  const a = acS();
  return (
    <>
      <div className="px-card px-list">
        {acConnList().map((k) => (
          <p className="px-acct" key={k}>
            <span className="lg">
              <AcLogo id={k} z={22} />
            </span>
            <b>{acName(k)}</b>
            <em>{!acConnOk(k) ? '구독이 끝나 새 주문이 멈췄습니다' : a.conn[k].via === 'paid' ? '구독' : 'TETH 초대 계정'}</em>
            <button type="button" className="pl-link" onClick={() => acDisc(k)}>
              연결 끊기
            </button>
          </p>
        ))}
      </div>
      <button type="button" className="pl-cta pl-cta-w px-cta" onClick={acGoTerminal}>
        터미널 열기
      </button>
      <p className="px-links">
        <button type="button" className="pl-link" onClick={acAddMore}>
          거래소 더 연결하기
        </button>
      </p>
    </>
  );
}
/** pxBEx(): 거래소. 타일을 누르면 바로 다음 화면 */
function PxBEx() {
  const a = acS();
  return (
    <div className="pl-exs px-exs" role="group" aria-label="거래소">
      {acExs().map((b) => {
        const cn = !!a.conn[b.id];
        return (
          <button type="button" key={b.id} className={cn ? 'cn' : undefined} aria-label={cn ? b.name + ', 연결됨' : undefined} onClick={() => pxPickEx(b.id)}>
            {cn && (
              <svg className="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
            <AcLogo id={b.id} z={30} />
            <b>{b.name}</b>
          </button>
        );
      })}
    </div>
  );
}
/** pxPaidLink(n) */
function PxPaidLink({ n }: { n: string }) {
  return acSubOn() ? (
    <button type="button" className="pl-link" onClick={pxSub}>
      구독으로 연결
    </button>
  ) : (
    <button type="button" className="pl-link" onClick={pxPaidRoute}>
      {'지금 쓰는 ' + n + ' 계정으로 연결 (월 ' + acUsd(AC_CFG.price) + ')'}
    </button>
  );
}
/** pxBAcct(): 계정. 초대 가입 안내 한 카드, 단추 하나, 작은 갈래 둘 */
function PxBAcct() {
  const a = acS();
  const n = acName(a.ex);
  const j = !!a.joined && a.has === 'no';
  const ref = acRef(a.ex);
  return (
    <>
      <div className={'px-card' + (j ? ' px-hi' : '')}>
        <ul className="px-steps">
          <li className={j ? 'ok' : undefined}>
            <b>
              {j && <AcCk />}
              TETH 초대 링크로 가입
            </b>
            <span>{j ? n + ' 가입 화면을 열었습니다. 가입을 마쳤다면 계정을 연결합니다.' : '이메일이나 전화번호로 가입합니다.'}</span>
          </li>
          <li>
            <b>본인 확인</b>
            <span>{'전략을 시작하기 전에 ' + n + '에서 마칩니다.'}</span>
          </li>
        </ul>
      </div>
      {j ? (
        <>
          <button type="button" className="pl-cta pl-cta-hi px-cta" onClick={() => pxGuide(2)}>
            가입한 계정 연결
          </button>
          <p className="px-links">
            <a className="pl-link acx-a" href={ref} target="_blank" rel="noopener">
              {n + ' 가입 화면 다시 열기'}
            </a>
            <PxPaidLink n={n} />
          </p>
        </>
      ) : (
        <>
          <a className="pl-cta pl-cta-w px-cta acx-a" href={ref} target="_blank" rel="noopener" onClick={pxJoined}>
            {n + ' 가입 화면 열기'}
            <AcOut />
          </a>
          <p className="px-links">
            <button type="button" className="pl-link acx-have" onClick={pxHas}>
              기존 초대 계정 연결
            </button>
            <PxPaidLink n={n} />
          </p>
        </>
      )}
    </>
  );
}
/** pxBAuth(): 승인. 권한 두 줄, 단추 하나 */
function PxBAuth() {
  const a = acS();
  const n = acName(a.ex);
  const st = a.auth.ex === a.ex ? a.auth.st : 'idle';
  /* pxInviteLink(): 구독 회원이 이 거래소만 TETH 초대 계정으로 연결하고 싶을 때 */
  const invite = acSubOn() && acRouteNow() === 'paid' && a.ex && !a.conn[a.ex];
  return (
    <>
      <div className="px-card">
        <ul className="px-perm">
          <li>
            <AcCk />
            <span>
              <b>잔고 조회</b>전략에 쓸 잔고를 봅니다
            </span>
          </li>
          <li>
            <AcCk />
            <span>
              <b>주문</b>전략 조건에 맞을 때 주문을 냅니다
            </span>
          </li>
        </ul>
      </div>
      {st === 'fail' ? (
        <p className="acx-fail px-fail" role="alert">
          {n + '에서 승인을 마치지 못했습니다. 잠시 뒤 다시 시도해 주십시오.'}
        </p>
      ) : st === 'cancel' ? (
        <p className="px-note" role="status">
          승인을 취소했습니다. 연결된 것은 없습니다.
        </p>
      ) : null}
      <button type="button" className="pl-cta pl-cta-w px-cta" id="ac-go" onClick={acAuthOpen}>
        <AcLogo id={a.ex} z={20} />
        {n + '에서 승인하기'}
      </button>
      {invite ? (
        <p className="px-links px-sm">
          <button type="button" className="pl-link" onClick={pxInvite}>
            TETH 초대 계정으로 연결
          </button>
        </p>
      ) : null}
    </>
  );
}
/** pxBUid(): 초대 계정 확인. 진행 중이면 두 줄 목록, 아니면 세 갈래 */
function PxBUid() {
  const a = acS();
  const n = acName(a.ex);
  const u = a.uid.ex === a.ex ? a.uid : { st: 'none' };
  const id = a.auth.uid || '';
  if (u.st === 'fail')
    return (
      <div className="px-col">
        <button type="button" className="px-ch" onClick={() => pxUidAlt('new')}>
          <b>TETH 초대로 새 계정 만들기</b>
          <span>이용료 없이 씁니다</span>
        </button>
        <button type="button" className="px-ch" onClick={() => pxUidAlt('paid')}>
          <b>이 계정을 그대로 쓰고 구독하기</b>
          <span>{'월 ' + acUsd(AC_CFG.price)}</span>
        </button>
        <button type="button" className="px-ch" onClick={() => pxUidAlt('ex')}>
          <b>다른 거래소 고르기</b>
          <span>초대로 만든 계정이 다른 거래소에 있을 때</span>
        </button>
      </div>
    );
  const p = UI.uidPhase;
  return (
    <div className="px-card">
      <p className="px-acct">
        <AcLogo id={a.ex} z={22} />
        <b>{n}</b>
        <span className="num">{maskId(id)}</span>
      </p>
      <ul className="btg-chk acx-chk px-chk" id="ac-chk">
        <li className={p ? 'ok' : 'run'} id="ac-c0">
          <span className="ic">{p ? <AcCk /> : <i />}</span>
          <b>계정 확인</b>
          <span>{p ? '확인했습니다' : '승인한 계정을 읽는 중'}</span>
        </li>
        <li className={p ? 'run' : undefined} id="ac-c1">
          <span className="ic">{p ? <i /> : null}</span>
          <b>초대 계정 확인</b>
          <span>TETH 초대로 만든 계정인지</span>
        </li>
      </ul>
    </div>
  );
}
/** pxBLimit(): 한도. 갈래 둘, 작은 링크 하나 (지금은 구독 하나로 전부 연결해 이 화면에 오지 않는다) */
function PxBLimit() {
  const a = acS();
  const n = acName(a.ex);
  const L = acConnList().filter((k) => a.conn[k].via === 'paid');
  return (
    <>
      <p className="px-acct px-now">
        {L.map((k) => (
          <i key={k}>
            <AcLogo id={k} z={20} />
            {acName(k)}
          </i>
        ))}
      </p>
      <div className="px-col">
        <button type="button" className="px-ch" onClick={() => pxLimitAlt('partner')}>
          <b>{n + '를 TETH 초대 계정으로 연결'}</b>
          <span>이용료 없음. 초대 계정이 없으면 새로 가입합니다</span>
        </button>
        <button type="button" className="px-ch" onClick={() => pxLimitAlt('more')}>
          <b>구독 추가</b>
          <span>{'월 ' + acUsd(AC_CFG.price) + ', 거래소 ' + AC_PAID_MAX + '곳 더 연결'}</span>
        </button>
      </div>
      {PL.ctx && PL.ctx.need ? null : (
        <p className="px-links">
          <button type="button" className="pl-link" onClick={() => pxLimitAlt('ex')}>
            다른 거래소 고르기
          </button>
        </p>
      )}
    </>
  );
}
/** pxBDone(): 완료. 계정 한 줄, 단추 하나 */
function PxBDone() {
  const a = acS();
  const ex = a.ex || acConnList()[0];
  const c = a.conn[ex] || {};
  const af = PL.ctx && PL.ctx.after;
  /* pxDoneLabel() */
  const label = af && af.kind === 'copy' ? '전략 복사 이어서 하기' : af && af.kind === 'bt' ? '전략 실행 이어서 하기' : '전략 시작하기';
  return (
    <>
      <div className="px-card">
        <p className="px-acct">
          <AcLogo id={ex} z={22} />
          <b>{acName(ex)}</b>
          {c.uid ? <span className="num">{maskId(c.uid)}</span> : null}
          <em>{c.via === 'paid' ? '구독' : 'TETH 초대 계정'}</em>
        </p>
      </div>
      <button type="button" className="pl-cta pl-cta-w px-cta" onClick={acSheetDone}>
        {label}
      </button>
      <p className="px-links">
        <button type="button" className="pl-link" onClick={acAddMore}>
          거래소 더 연결하기
        </button>
      </p>
    </>
  );
}
