// 본인 확인(KYC) 관문 (원본 acRunGate, acKycRun, acKycHtml): 연결은 막지 않고, 전략을 시작하기 직전에만 본다.
// 백테스트 조각의 btMineStart('live') 와 전략 복사 조각의 cpStart 가 acRunGate(ex, cb) 를 부른다.
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AC_QA, acConnList, acName, acRef, acRunOk, acS, acSave } from '../../../core/account/ac';
import { AcOut } from './parts';

/** 원본 AC_GATE */
let GATE: { ex: string; cb: () => void } | null = null;
let open = false;
let run = 0;
let ver = 0;
const subs = new Set<() => void>();
const emit = () => {
  ver++;
  subs.forEach((f) => f());
};
const sub = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
function close() {
  open = false;
  emit();
}
function check(ex: string) {
  const a = acS();
  if (!a.conn[ex]) return;
  const my = ++run;
  a.conn[ex].kyc = 'run';
  acSave();
  emit();
  setTimeout(() => {
    if (my !== run) return;
    const q = AC_QA.kyc || 'ok';
    const st = q === 'fail' || q === 'review' || q === 'err' ? q : 'ok';
    if (a.conn[ex]) a.conn[ex].kyc = st;
    acSave();
    emit();
    if (st === 'ok' && GATE && GATE.ex === ex)
      setTimeout(() => {
        close();
        const c = GATE && GATE.cb;
        GATE = null;
        if (c) c();
      }, 500);
  }, 1100);
}
/** acRunGate(ex, cb): 본인 확인이 끝났으면 바로 cb, 아니면 창을 띄워 확인한다 */
export function acRunGate(ex: string | null | undefined, cb: () => void) {
  const a = acS();
  const e = ex || acConnList()[0];
  if (!e || !a.conn[e] || acRunOk(e)) {
    cb();
    return;
  }
  GATE = { ex: e, cb };
  open = true;
  check(e);
}
/** acKycRun(ex): 확인 상태 다시 보기 */
export const acKycRun = (ex: string) => check(ex);
/** acRunGateGo() */
function gateGo() {
  const g = GATE;
  GATE = null;
  close();
  if (g && acRunOk(g.ex)) g.cb();
}

/** acKycHtml(ex): 제목 하나, 한 줄, 단추 하나 */
function Kyc({ ex }: { ex: string }) {
  const c = acS().conn[ex] || {};
  const n = acName(ex);
  const st = c.kyc || 'none';
  const s =
    st === 'ok'
      ? '본인 확인이 끝났습니다. 전략을 시작합니다.'
      : st === 'run'
        ? n + '에서 본인 확인 상태를 보는 중입니다.'
        : st === 'review'
          ? n + '에서 본인 확인을 검토하고 있습니다. 끝나면 전략을 시작할 수 있습니다.'
          : st === 'err'
            ? '본인 확인 상태를 불러오지 못했습니다. 잠시 뒤 다시 확인해 주십시오.'
            : '본인 확인이 끝나면 전략을 시작할 수 있습니다.';
  return (
    <div className={'px-kyc st-' + st} id="ac-kyc">
      <p className="px-lead">{s}</p>
      {st === 'ok' ? null : st === 'run' ? (
        <button type="button" className="pl-cta pl-cta-w px-cta" disabled>
          <i className="acx-sp" />
          확인 중
        </button>
      ) : (
        <>
          {(st === 'fail' || st === 'none') && (
            <a className="pl-cta pl-cta-w px-cta acx-a" href={acRef(ex)} target="_blank" rel="noopener">
              {n + '에서 본인 확인하기'}
              <AcOut />
            </a>
          )}
          <p className="px-links">
            <button type="button" className="pl-link" onClick={() => acKycRun(ex)}>
              {st === 'err' ? '다시 확인하기' : '확인 상태 다시 보기'}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
/** 앱에 한 번 올려 둔다. 확인 창과 같은 자리(#ac-cf)를 쓴다 */
export function AcKycGate() {
  useSyncExternalStore(sub, () => ver);
  if (!open || !GATE) return null;
  const ex = GATE.ex;
  const ok = acRunOk(ex);
  return createPortal(
    <div id="ac-cf" className="acx-cf px-cf" role="dialog" aria-modal="true">
      <div className="bx">
        <button type="button" className="x" aria-label="닫기" onClick={close}>
          ✕
        </button>
        <h3>{acName(ex) + ' 본인 확인'}</h3>
        <Kyc ex={ex} />
        <div className="bts">
          {/* 원본은 창을 띄울 때 붙인 hidden 을 떼지 않는다(disabled 만 푼다). 확인이 끝나면 0.5초 뒤 창이 닫히며 이어 간다 */}
          <button type="button" className="ok" id="ac-kyc-go" onClick={gateGo} hidden disabled={!ok}>
            전략 시작
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export const acKycGateOpen = () => open;
export const acKycGateClose = close;
/* 견줌 도구가 원본의 acRunGate('bitget', fn) 과 같은 때에 부를 수 있게 개발 서버에서만 내놓는다 */
if (import.meta.env.DEV) (window as unknown as { acRunGate: typeof acRunGate }).acRunGate = acRunGate;
