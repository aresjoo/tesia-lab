// 설정 화면 (#/settings, #/settings/<탭>). 원본 stView(): 접는 메뉴와 레일, 탭 본문. 설정에 있는 동안 전체 화면(body.st-full)이다.
// 모바일(900px 이하)은 CSS 가 가른다: #/settings 는 목록(m-list), #/settings/<탭> 은 상세(m-detail).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GLC_LANGS } from '../../../core/i18n.data';
import { ST_NF, ST_TABS, stNfOf, stTabOf } from '../../../core/account/settings';
import { useBodyClass } from '../../../state/hooks';
import { nav } from '../../../state/route';
import { setLang, sideMobClose, useApp } from '../../../state/store';
import { scrollTop, tfTxHelp, useTf } from '../util';
import { Account } from './Account';
import { stBrokers, stNf } from './actions';
import { Billing } from './Billing';
import { StDialogs } from './Dialogs';
import { Num, SkChev, StIc, StRow, StSec, StTg, TabIc } from './parts';
import { Security } from './Security';
import { ST, stBack, stGo, stHashClear, stHooks, stMList, stNavToggle, stRe } from './state';
import { Usage } from './Usage';

/** stGeneral() */
function General() {
  const lang = useApp((s) => s.lang);
  const cur = GLC_LANGS.find((l) => l.c === lang) || GLC_LANGS[0];
  return (
    <>
      <h1>일반</h1>
      <StSec>
        <StRow
          k="언어"
          act={
            /* stLang(c): 언어를 바꾸고 화면을 처음부터 다시 그린다 */
            <select
              className="stg-sel"
              aria-label="언어"
              value={cur.c}
              onChange={(e) => {
                setLang(e.target.value);
                scrollTop();
              }}
            >
              {GLC_LANGS.map((l) => (
                <option value={l.c} key={l.c}>
                  {l.n}
                </option>
              ))}
            </select>
          }
          sub="화면과 알림에 쓰는 언어입니다"
        />
        <StRow k="금액 표시" v={<Num>USD</Num>} sub="모든 금액은 미국 달러로 표시합니다. 자산 수량은 BTC, ETH, USDT처럼 자산 단위 그대로입니다" />
      </StSec>
    </>
  );
}

/** stNotify(): 한 섹션뿐이라 섹션 제목은 두지 않는다 */
function Notify() {
  return (
    <>
      <h1>알림</h1>
      <StSec>
        {ST_NF.map((x) => {
          const v = stNfOf(x[0]);
          const lock = x[0] === 'bill';
          return (
            <StRow
              key={x[0]}
              k={x[1]}
              act={
                <div className="stg-seg multi" role="group" aria-label={x[1] + ' 알림'}>
                  {(
                    [
                      ['push', '푸시'],
                      ['email', '이메일'],
                    ] as const
                  ).map((o) => {
                    const dis = lock && o[0] === 'email';
                    return (
                      <button type="button" key={o[0]} aria-pressed={v.indexOf(o[0]) >= 0} disabled={dis} title={dis ? '결제와 보안 알림은 이메일로 항상 보냅니다' : undefined} onClick={() => stNf(x[0], o[0])}>
                        {o[1]}
                      </button>
                    );
                  })}
                </div>
              }
              sub={x[2]}
            />
          );
        })}
      </StSec>
    </>
  );
}

/** stRail(): 접힌 상태의 아이콘 레일 (로고에 올리면 토글 아이콘) */
function Rail() {
  const I = ({ children }: { children: ReactNode }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
  return (
    <aside className="stg-rail" aria-label="바로 가기">
      <button type="button" className="stg-rl" aria-label="사이드바 표시/숨기기" onClick={stNavToggle}>
        <span className="logo brand-mark brand-bg" />
        <span className="tg">
          <StTg />
        </span>
        <span className="tip">사이드바 표시/숨기기</span>
      </button>
      <button type="button" className="stg-ri" aria-label="새 전략" onClick={stBack}>
        <I>
          <path d="M12 3a9 9 0 1 0 9 9" />
          <path d="M17.800 2.800l3.400 3.400L13 14.400l-4 .600.600-4z" />
        </I>
        <span className="tip">새 전략</span>
      </button>
      <button
        type="button"
        className="stg-ri"
        aria-label="전략 복사"
        onClick={() => {
          /* stBack();tfShareHub() */
          stHashClear();
          nav('#/share');
        }}
      >
        <I>
          <path d="M5 19c2-4 4-6 8-8" />
          <path d="M14 4a6 6 0 0 1 6 6c-3 0-5 1-6 2-1-1-2-3-2-6a6 6 0 0 1 2-2z" />
          <circle cx="15" cy="9" r="1" />
        </I>
        <span className="tip">전략 복사</span>
      </button>
    </aside>
  );
}

/** stView() */
export function Settings({ tab }: { tab: string | null }) {
  useTf();
  const mList = !tab; /* ST.mList: 탭 없는 주소 */
  const cur = stTabOf(tab); /* ST.tab */
  const [seq, setSeq] = useState(0);
  const navEl = useRef<HTMLElement>(null);
  /* 설정 화면에 있는 동안만 전체 화면 모드 (원본 stFull) */
  useBodyClass('st-full', true);
  /* stRoute(h): 주소가 바뀌거나 같은 주소로 다시 들어오면 고치던 줄을 닫고 맨 위로 (gContent) */
  useLayoutEffect(() => {
    if (ST.edit) {
      ST.edit = null;
      stRe();
    }
    scrollTop();
    sideMobClose();
    /* 좁은 화면: 지금 보는 설정 탭이 보이게 */
    const w = navEl.current;
    const n = w ? w.querySelector<HTMLElement>('.stg-ni.on') : null;
    if (w && n && w.scrollWidth > w.clientWidth) w.scrollLeft = Math.max(0, n.offsetLeft - w.clientWidth / 2 + n.offsetWidth / 2);
  }, [tab, seq]);
  useEffect(() => {
    stHooks.reroute = () => setSeq((s) => s + 1);
    return () => {
      stHooks.reroute = null;
      /* 화면을 떠나면 고치던 줄과 떠 있던 창을 접는다 */
      ST.edit = null;
      ST.dlg = null;
    };
  }, []);
  /* 설정을 떠나 다음 화면이 그려질 때도 맨 위에서 시작한다 (원본은 어떤 화면이든 gContent 가 스크롤을 올린다) */
  useLayoutEffect(() => scrollTop, []);
  return (
    <div className={'stg' + (ST.navHid ? ' nav-hid' : '') + (mList ? ' m-list' : ' m-detail')} id="st-root">
      <button type="button" className="stg-tg" id="st-tg" aria-label="사이드바 표시하기/숨기기" aria-expanded={!ST.navHid} onClick={stNavToggle}>
        <StTg />
        <span className="tip">사이드바 표시/숨기기</span>
      </button>
      <Rail />
      <nav className="stg-nav" aria-label="설정" ref={navEl}>
        <button type="button" className="stg-back" onClick={stBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          앱으로 돌아가기
        </button>
        <small>설정</small>
        {ST_TABS.map((x) => {
          const on = !mList && cur === x[0]; /* 목록(#/settings)에서는 고른 탭 표시를 뗀다 */
          return (
            <button type="button" key={x[0]} className={'stg-ni' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={() => stGo(x[0])}>
              <TabIc k={x[0]} />
              {x[1]}
            </button>
          );
        })}
        <small>바로 가기</small>
        <button type="button" className="stg-ni" onClick={stBrokers}>
          <StIc>
            <path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" />
            <path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" />
          </StIc>
          거래소 연결
        </button>
        <button type="button" className="stg-ni" onClick={tfTxHelp}>
          <StIc>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.010" />
          </StIc>
          상담원에게 묻기
        </button>
      </nav>
      <main className="stg-main" id="st-main">
        {/* stBody(): 사용량 탭은 원본이 뒤에서 끼워 넣어 「설정」 뒤로 단추가 없다 */}
        {cur === 'usage' ? null : (
          <button type="button" className="stg-mback" onClick={stMList}>
            <SkChev />
            설정
          </button>
        )}
        {cur === 'general' && <General />}
        {cur === 'account' && <Account />}
        {cur === 'notify' && <Notify />}
        {cur === 'billing' && <Billing />}
        {cur === 'usage' && <Usage />}
        {cur === 'security' && <Security />}
      </main>
      <StDialogs />
    </div>
  );
}
