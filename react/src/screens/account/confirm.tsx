// 확인 창 (원본 acConfirm): 되돌리기 어려운 일은 한 번 더 묻는다. type 이 있으면 그 글자를 쳐야 단추가 켜진다.
// 거래소 연결과 설정이 함께 쓴다. 창은 원본처럼 body 바로 아래(#ac-cf)에 뜬다.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmOpt = { title: string; body?: string; list?: string[]; type?: string; ok?: string; no?: string; danger?: number | boolean; run: () => void };

let cur: ConfirmOpt | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const sub = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
/** acConfirm(o) */
export function acConfirm(o: ConfirmOpt) {
  cur = { ...o }; /* 새 객체라 떠 있던 창은 새로 뜬다 */
  emit();
}
/** acConfirmClose() */
export function acConfirmClose() {
  if (!cur) return;
  cur = null;
  emit();
}
export const acConfirmOpen = () => !!cur;

function Box({ o }: { o: ConfirmOpt }) {
  const [v, setV] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  const no = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      (inp.current || no.current)?.focus();
    } catch {
      /* 무시 */
    }
  }, []);
  return (
    <div
      id="ac-cf"
      className="acx-cf"
      role="alertdialog"
      aria-modal="true"
      aria-label={o.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) acConfirmClose();
      }}
    >
      <div className="bx">
        <h3>{o.title}</h3>
        {o.body ? <p>{o.body}</p> : null}
        {o.list ? (
          <ul>
            {o.list.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : null}
        {o.type ? (
          <label className="ty">
            <span>
              계속하려면 <b>{o.type}</b> 를 입력해 주십시오
            </span>
            <input id="ac-cf-in" ref={inp} autoComplete="off" spellCheck={false} value={v} onChange={(e) => setV(e.target.value)} />
          </label>
        ) : null}
        <div className="bts">
          <button type="button" className="no" ref={no} onClick={acConfirmClose}>
            {o.no || '취소'}
          </button>
          <button
            type="button"
            className={'ok' + (o.danger ? ' dg' : '')}
            id="ac-cf-ok"
            disabled={!!o.type && v.trim() !== o.type}
            onClick={() => {
              acConfirmClose();
              try {
                o.run();
              } catch {
                /* 원본도 실행 중 오류를 삼킨다 */
              }
            }}
          >
            {o.ok || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 앱에 한 번 올려 둔다 */
export function AcConfirmHost() {
  const o = useSyncExternalStore(sub, () => cur);
  return o ? createPortal(<Box o={o} key={o.title} />, document.body) : null;
}
