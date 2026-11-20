// 이용 현황 화면 (#/plan/rebates, #/plan/alerts). 원본 tfPlanView(tab) 과 tfNFView('nfplan', ...).
// 원본은 rebates 를 plan 탭으로 모은다(`if(tab==='rebates') tab='plan'`). 그래서 #/plan/rebates 는 이용 현황 본문, #/plan/alerts 는 알림 설정이다.
import { useEffect, useLayoutEffect } from 'react';
import { acEx } from '../../../core/account/ac';
import { bcBoot } from '../../../core/account/bc';
import { tfDerive, tfDeriveCfg, tfExName, tfWon, type DeriveCta } from '../../../core/account/derive';
import { tfNFInit, tfSave } from '../../../core/account/tf';
import { goHome, nav } from '../../../state/route';
import { authOpen, sideMobClose } from '../../../state/store';
import { acStart } from '../brokers/flow';
import { scrollTop, useTf } from '../util';
import { NfRow, NfSwitch, NfxIc, type NfxIcon } from './parts';

/** tfAcSheet(kind): 지원 거래소면 그 거래소로, 아니면(card 등) 고르는 데서부터 활성화 흐름을 연다 */
export function tfAcSheet(kind: string) {
  acStart({ ex: kind && acEx(kind) ? kind : null, after: { kind: 'terminal' } });
}
/** tfDerive() 의 CTA action 글자(원본 onclick 그대로)를 실행한다 */
export function tfCtaRun(action: string) {
  let m: RegExpMatchArray | null;
  if ((m = action.match(/^tfAcSheet\('([^']*)'\)$/))) tfAcSheet(m[1]);
  else if ((m = action.match(/^tfNav\('([^']*)'\)$/))) nav(m[1]);
  else if ((m = action.match(/^authOpen\('(signup|login)'\)$/))) authOpen(m[1] as 'signup' | 'login');
  else if (action === 'gHome()') goHome();
  else if (/^tfShareHub\(/.test(action)) nav('#/share'); /* 전략 복사 허브는 그 조각의 화면이다 */
}

/** tfNFPrefI(k,inp) */
function tfNFPrefI(k: string, on: boolean) {
  const t = tfNFInit();
  (t.notifPrefs as Record<string, boolean>)[k] = !!on;
  tfSave();
}

const TABS: ['plan' | 'alerts', string][] = [
  ['plan', '이용 현황'],
  ['alerts', '알림 설정'],
];

/** tfPlanView(tab) */
export function Plan({ tab: tab0 }: { tab: 'rebates' | 'alerts' }) {
  useTf();
  const tab = tab0 === 'rebates' ? 'plan' : tab0;
  /* 원본은 로그인 때 bcBoot() 를 부른다(authSyncUI). session 에 걸리기 전까지 여기서도 한 번 부른다(여러 번 불러도 같은 결과) */
  useLayoutEffect(() => {
    bcBoot();
  }, []);
  /* gContent(): 화면이 바뀌면 맨 위로, 모바일 드로어는 닫는다 */
  useEffect(() => {
    scrollTop();
    sideMobClose();
  }, [tab]);
  return (
    <div className="nfx-page">
      <div className="nfx-glow" />
      <div className="nfx-head">
        <h1 className="nfx-title">이용 현황</h1>
        <div className="nfx-sub">지금 무료인지, 얼마를 내는지, 어떻게 줄이는지</div>
        <div className="nfx-tabs">
          {TABS.map((tb) => (
            <button key={tb[0]} className={'nfx-tab' + (tab === tb[0] ? ' on' : '')} onClick={() => nav('#/plan' + (tb[0] === 'plan' ? '' : '/' + tb[0]))}>
              {tb[1]}
            </button>
          ))}
        </div>
      </div>
      {tab === 'plan' ? <Usage key="plan" /> : <Alerts key="alerts" />}
    </div>
  );
}

/** 이용 현황 본문: 모든 값은 tfDerive() 에서만 읽는다 */
function Usage() {
  const d = tfDerive();
  const exOn = d.facts.uid && d.facts.api;
  const exName = tfExName(d.facts.ex) || 'Bitget';
  const exTxt = exOn ? exName + ' 연결됨' : d.facts.uid ? '요금 연동만 끝났습니다' : d.facts.api ? '실행 연결만 끝났습니다' : '미연결';
  const cta: DeriveCta | null = d.primaryCTA && /tfAcSheet\(/.test(d.primaryCTA.action) ? d.primaryCTA : null;
  return (
    <div className="nfx-grid2">
      <section className="nfx-card nfx-card-hero us-hero">
        <div className="us-status">{d.statusLine || ''}</div>
        <div className="us-bar">
          <div className="us-line">{d.bill.display || ''}</div>
        </div>
        {d.reduceHint ? (
          <div className="us-hint">
            <b>줄이는 방법</b> {d.reduceHint}
          </div>
        ) : null}
        {cta ? (
          <div className="nfx-cta us-cta">
            <button className="ac-btn p" onClick={() => tfCtaRun(cta.action)}>
              {cta.label}
            </button>
          </div>
        ) : null}
        <div className="us-foot">시뮬레이션 데이터입니다</div>
      </section>
      <section className="nfx-card">
        <div className="nfx-sechead">
          <h2 className="nfx-sectit">연결 상태</h2>
        </div>
        <div className="us-rows">
          <div className="us-row">
            <div>
              <div className="lb">거래소 연결</div>
              <div className="ds">{exTxt}</div>
            </div>
            <div className="rt">
              <span className={'nfx-badge' + (exOn ? ' pro' : '')}>{exOn ? '연결됨' : '미연결'}</span>
              {exOn ? null : (
                <button className="ac-btn s" onClick={() => tfAcSheet('bitget')}>
                  연결하기
                </button>
              )}
            </div>
          </div>
          <div className="us-row">
            <div>
              <div className="lb">카드</div>
              <div className="ds">{d.facts.plan ? '월 ' + tfWon(tfDeriveCfg().PLAN_KRW) + ', 거래 혜택만큼 상쇄됩니다' : '등록하면 연결 없이도 쓸 수 있습니다'}</div>
            </div>
            <div className="rt">
              <span className={'nfx-badge' + (d.facts.plan ? ' blue' : '')}>{d.facts.plan ? '등록됨' : '없음'}</span>
              {d.facts.plan ? null : (
                <button className="ac-btn s" onClick={() => tfAcSheet('card')}>
                  등록
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const TOG: [string, string, string, NfxIcon, string][] = [
  ['pos', '포지션 진입/청산', '전략의 체결이 확정될 때', 'trend', 'gb'],
  ['loss', '손실 단계 경고', '평가 손실이 단계에 진입할 때', 'warn', 'ga'],
  ['review', '거래복기 리포트', '체결 복기가 생성될 때', 'doc', 'gb'],
  ['watch', '관심 종목 소식', '데모에서는 실행 이벤트만 수신합니다', 'star', ''],
];
const CH: [string, string, string, NfxIcon][] = [
  ['chK', '카카오톡', '데모에서는 설정만 저장됩니다', 'chat'],
  ['chT', '텔레그램', '데모에서는 설정만 저장됩니다', 'send'],
  ['chM', '이메일 리포트', '데모에서는 설정만 저장됩니다', 'mail'],
];

/** 알림 설정: 받을 알림과 수신 채널 */
function Alerts() {
  const P = tfNFInit().notifPrefs as Record<string, boolean>;
  return (
    <div className="nfx-grid2">
      <section className="nfx-card">
        <div className="nfx-sechead">
          <h2 className="nfx-sectit">어떤 알림을 받겠습니까</h2>
          <span className="nfx-badge">{TOG.length}개 항목</span>
        </div>
        <div className="nfx-rows">
          {TOG.map((o, i) => (
            <NfRow key={o[0]} ic={o[3]} icc={o[4]} lb={o[1]} ds={o[2]} val={<NfSwitch on={!!P[o[0]]} change={(v) => tfNFPrefI(o[0], v)} />} stag={i + 1} />
          ))}
        </div>
      </section>
      <section className="nfx-card">
        <div className="nfx-sechead">
          <h2 className="nfx-sectit">수신 채널</h2>
          <span className="nfx-badge">4개 채널</span>
        </div>
        <div className="nfx-rows">
          <NfRow
            ic="bell"
            icc="gg"
            lb="앱 내 수신함"
            ds="기본 채널이라 항상 동작합니다"
            val={
              <>
                <span className="nfx-badge pro" style={{ marginRight: 4 }}>
                  기본
                </span>
                <NfSwitch on grn />
              </>
            }
            stag={1}
          />
          {CH.map((o, i) => (
            <NfRow key={o[0]} ic={o[3]} lb={o[1]} ds={o[2]} val={<NfSwitch on={!!P[o[0]]} change={(v) => tfNFPrefI(o[0], v)} />} stag={i + 2} />
          ))}
        </div>
        <div className="nfx-foot" style={{ marginTop: 14 }}>
          <NfxIc k="info" />
          <span>시뮬레이션 데이터입니다. 외부 채널 발송은 일어나지 않고 설정만 저장됩니다.</span>
        </div>
      </section>
    </div>
  );
}
