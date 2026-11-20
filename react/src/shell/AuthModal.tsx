// 로그인과 회원가입 창 (원본 #modal-auth, 흉내 인증). 단계와 문구, 검사 규칙을 원본 그대로 옮겼다.
import { Fragment, useEffect, useRef, useState, type RefObject } from 'react';
import { useL } from '../state/hooks';
import { authClose, signIn, toast, useApp, type AuthMode } from '../state/store';
import { POLICY } from './Overlays';

type Step = 'au-start' | 'au-code' | 'au-pw-new' | 'au-age' | 'au-pw';

/** authBad: 빨간 테두리 + 흔들림 + 포커스 */
function shake(ref: RefObject<HTMLInputElement | null>, bad = true) {
  const i = ref.current;
  if (!i) return;
  if (bad) i.classList.add('bad');
  i.classList.remove('shake');
  void i.offsetWidth;
  i.classList.add('shake');
  i.focus();
}
const good = (ref: RefObject<HTMLInputElement | null>) => ref.current?.classList.remove('bad');

function Foot() {
  const L = useL();
  return (
    <div className="au-foot">
      <a href={POLICY.T} target="_blank" rel="noopener noreferrer">
        {L('menu.terms')}
      </a>
      <span>|</span>
      <a href={POLICY.P} target="_blank" rel="noopener noreferrer">
        {L('menu.privacy')}
      </a>
    </div>
  );
}
/** 문구 안의 <br> 과 {e}(굵은 이메일)를 살려 그린다 */
function Sub({ text, email, id }: { text: string; email?: string; id?: string }) {
  const lines = text.split('<br>');
  return (
    <div className="au-sub" id={id}>
      {lines.map((ln, i) => {
        const p = ln.split('{e}');
        return (
          <Fragment key={i}>
            {i > 0 && <br />}
            {p[0]}
            {p.length > 1 && <b>{email}</b>}
            {p[1]}
          </Fragment>
        );
      })}
    </div>
  );
}

function Flow({ mode, open }: { mode: AuthMode; open: boolean }) {
  const L = useL();
  const [step, setStep] = useState<Step>('au-start');
  const [email, setEmail] = useState('');
  const [doneName, setDoneName] = useState('');
  const [pwDone, setPwDone] = useState(false);
  const [err, setErr] = useState<Record<string, boolean>>({});
  const [cool, setCool] = useState(0);
  const [pwNew, setPwNew] = useState('');
  const [eye, setEye] = useState<Record<string, boolean>>({});
  const [ageLoading, setAgeLoading] = useState(false);
  const rEmail = useRef<HTMLInputElement>(null);
  const rCode = useRef<HTMLInputElement>(null);
  const rPwNew = useRef<HTMLInputElement>(null);
  const rPw = useRef<HTMLInputElement>(null);
  const rAge = useRef<HTMLInputElement>(null);
  const rName = useRef<HTMLInputElement>(null);
  const rX = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) rX.current?.focus(); /* openModal: 창의 첫 버튼에 포커스 */
  }, [open]);
  /* 단계가 바뀌면 그 단계의 입력칸에 포커스 */
  useEffect(() => {
    const f = { 'au-code': rCode, 'au-pw-new': rPwNew, 'au-pw': rPw, 'au-age': rAge, 'au-start': null }[step];
    if (!f) return;
    const t = setTimeout(() => f.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [step]);
  /* 다시 보내기 대기 30초 */
  useEffect(() => {
    if (cool <= 0 || step !== 'au-code') return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool, step]);

  const bad = (k: string, ref: RefObject<HTMLInputElement | null>) => {
    setErr((e) => ({ ...e, [k]: true }));
    shake(ref);
  };
  const ok = (k: string, ref: RefObject<HTMLInputElement | null>) => {
    setErr((e) => ({ ...e, [k]: false }));
    good(ref);
  };
  const finish = (name: string) => signIn(name || '김도현');
  const ageShow = (name: string) => {
    setDoneName(name);
    setAgeLoading(false);
    setStep('au-age');
  };
  const oauth = (provider: string) => {
    toast(provider + ' 인증 완료');
    if (mode === 'signup') ageShow('김도현');
    else finish('김도현');
  };
  const sendCode = (em = email) => {
    if (!em) {
      setStep('au-start');
      return;
    }
    if (rCode.current) rCode.current.value = '';
    setStep('au-code');
    toast(L('code.sent'));
    setCool(30);
  };
  const emailNext = () => {
    const v = (rEmail.current?.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return bad('email', rEmail);
    ok('email', rEmail);
    setEmail(v);
    if (mode === 'signup') setStep('au-pw-new');
    else sendCode(v);
  };
  const finishEmail = () => {
    const nm = email.split('@')[0];
    if (mode === 'signup') ageShow(nm);
    else finish(nm);
  };
  const codeNext = () => {
    const v = (rCode.current?.value || '').trim();
    if (!/^\d{6}$/.test(v)) return bad('code', rCode);
    ok('code', rCode);
    finishEmail();
  };
  const rules = { len: pwNew.length >= 12, num: /\d/.test(pwNew), spec: /[^A-Za-z0-9\s]/.test(pwNew) };
  const pwAll = rules.len && rules.num && rules.spec;
  const pwNewNext = () => {
    if (!pwAll) return shake(rPwNew, false);
    setPwDone(true);
    sendCode();
  };
  const pwNext = () => {
    if ((rPw.current?.value || '').length < 1) return bad('pw', rPw);
    ok('pw', rPw);
    setPwDone(true);
    finishEmail(); /* 비밀번호 확인 = 로그인 완료, 코드를 다시 묻지 않는다 */
  };
  const ageFinish = () => {
    const v = parseInt((rAge.current?.value || '').trim(), 10);
    if (!v || v < 1 || v > 120) return bad('age', rAge);
    ok('age', rAge);
    const nm = rName.current?.value.trim() || doneName;
    setAgeLoading(true);
    setTimeout(() => finish(nm), 1000);
  };
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') fn();
  };
  const errCls = (k: string) => 'au-err' + (err[k] ? ' on' : '');
  const rq = (on: boolean, k: string, id: string) => (
    <div className={'rq' + (on ? ' ok' : '')} id={id}>
      <span className="m">{on ? '✓' : '•'}</span>
      <span className="t">{L(k)}</span>
    </div>
  );
  const showPwAlt = mode === 'login' && !pwDone;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="로그인 또는 회원가입">
      <button className="au-x" ref={rX} onClick={authClose} aria-label="닫기">
        ✕
      </button>

      <div className="au-step" id="au-start" hidden={step !== 'au-start'}>
        <div className="au-title">{L('auth.title')}</div>
        <Sub text={L('auth.sub')} />
        <div className="au-btns">
          <button className="au-btn" onClick={() => oauth('Google')}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {L('auth.google')}
          </button>
          <button className="au-btn" onClick={() => oauth('Apple')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginTop: -2 }}>
              <path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z" />
            </svg>
            {L('auth.apple')}
          </button>
        </div>
        <div className="au-div">{L('auth.or')}</div>
        <div className="au-input-wrap">
          <input className="au-input" id="au-email" ref={rEmail} type="email" placeholder={L('auth.email')} autoComplete="off" onKeyDown={enter(emailNext)} />
        </div>
        <div className={errCls('email')} id="au-email-err">
          {L('email.err')}
        </div>
        <button className="au-btn primary au-gap" onClick={emailNext}>
          {L('auth.continue')}
        </button>
        <div className="au-free" id="au-free">
          {L('auth.free')}
        </div>
      </div>

      <div className="au-step" id="au-code" hidden={step !== 'au-code'}>
        <div className="au-title" id="au-code-title">
          {L('code.title')}
        </div>
        <Sub id="au-code-sub" text={L(mode === 'login' ? 'code.sub.login' : 'code.sub.signup')} email={email} />
        <div className="au-input-wrap">
          <input
            className="au-input"
            id="au-code-in"
            ref={rCode}
            inputMode="numeric"
            maxLength={12}
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 6);
            }}
            placeholder={L('code.ph')}
            autoComplete="one-time-code"
            onKeyDown={enter(codeNext)}
          />
        </div>
        <div className={errCls('code')} id="au-code-err">
          {L('code.err')}
        </div>
        <button className="au-btn primary au-gap" id="au-code-go" onClick={codeNext}>
          {L('auth.continue')}
        </button>
        <button
          className="au-textbtn"
          id="au-resend"
          disabled={cool > 0}
          style={cool > 0 ? { opacity: 0.5 } : undefined}
          onClick={() => {
            if (cool > 0) return;
            if (rCode.current) rCode.current.value = '';
            ok('code', rCode);
            toast(L('code.resent'));
            setCool(30);
          }}
        >
          {cool > 0 ? L('code.wait').replace('{s}', String(cool)) : L('code.resend')}
        </button>
        <div className="au-div" id="au-code-div" hidden={!showPwAlt}>
          {L('auth.or')}
        </div>
        <button className="au-btn ghost au-gap" id="au-code-pwbtn" hidden={!showPwAlt} onClick={() => setStep('au-pw')}>
          {L('code.pwbtn')}
        </button>
        <Foot />
      </div>

      <div className="au-step" id="au-pw-new" hidden={step !== 'au-pw-new'}>
        <div className="au-title" id="au-pwnew-title">
          {L('pwnew.title')}
        </div>
        <Sub id="au-pwnew-sub" text={L('pwnew.sub')} />
        <div className="au-field">
          <span className="au-label" id="au-pwnew-lbl-email">
            {L('auth.email')}
          </span>
          <input className="au-input" id="au-pwnew-email" type="email" disabled value={email} readOnly />
          <button className="au-side" id="au-edit" onClick={() => setStep('au-start')}>
            {L('pwnew.edit')}
          </button>
        </div>
        <div className="au-field">
          <span className="au-label" id="au-pwnew-lbl-pw">
            {L('pw.label')}
          </span>
          <input className="au-input" id="au-pwnew-in" ref={rPwNew} type={eye.new ? 'text' : 'password'} autoComplete="new-password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} onKeyDown={enter(pwNewNext)} />
          <button className="au-side" onClick={() => setEye((v) => ({ ...v, new: !v.new }))} aria-label="비밀번호 표시">
            {eye.new ? '🙈' : '👁'}
          </button>
        </div>
        <div className="au-req">
          <div id="au-req-h">{L('req.head')}</div>
          {rq(rules.len, 'req.len', 'au-req-len')}
          {rq(rules.num, 'req.num', 'au-req-num')}
          {rq(rules.spec, 'req.spec', 'au-req-spec')}
        </div>
        <button className={'au-btn primary au-gap' + (pwAll ? '' : ' dis')} id="au-pwnew-go" onClick={pwNewNext}>
          {L('auth.continue')}
        </button>
        <div className="au-div" id="au-pwnew-div">
          {L('auth.or')}
        </div>
        <button className="au-btn ghost au-gap" id="au-pwnew-codebtn" onClick={() => sendCode()}>
          {L('pwnew.codebtn')}
        </button>
        <Foot />
      </div>

      <div className="au-step" id="au-age" hidden={step !== 'au-age'}>
        <div className="au-title">연령을 알려주십시오</div>
        <div className="au-sub">
          연령을 제공하면 당사{' '}
          <a href={POLICY.P} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', textUnderlineOffset: 3, color: 'inherit' }}>
            개인정보 보호 정책
          </a>
          을 준수하면서 사용자님의 경험을 개인 맞춤화하고 올바른 설정을 제공하는 데 도움이 됩니다
        </div>
        <div className="au-field">
          <span className="au-label">성명</span>
          <input className="au-input" id="au-age-name" ref={rName} type="text" autoComplete="name" defaultValue={doneName} key={doneName} />
        </div>
        <div className="au-field">
          <span className="au-label">연령</span>
          <input className="au-input" id="au-age-in" ref={rAge} type="number" min={1} max={120} inputMode="numeric" onKeyDown={enter(ageFinish)} />
        </div>
        <div className={errCls('age')} id="au-age-err">
          연령을 숫자로 입력해 주십시오.
        </div>
        <div className="au-agree">
          “시장에 입장하기”를 클릭하면 당사{' '}
          <a href={POLICY.T} target="_blank" rel="noopener noreferrer">
            이용약관
          </a>
          에 동의하고
          <br />
          <a href={POLICY.P} target="_blank" rel="noopener noreferrer">
            개인정보 보호 정책
          </a>
          을 읽은 것으로 간주합니다.
        </div>
        <button className={'au-btn primary au-gap' + (ageLoading ? ' loading' : '')} id="au-age-go" disabled={ageLoading} onClick={ageFinish}>
          {ageLoading ? <span className="au-spin" /> : '시장에 입장하기'}
        </button>
      </div>

      <div className="au-step" id="au-pw" hidden={step !== 'au-pw'}>
        <div className="au-title" id="au-pw-title">
          {L('pw.title')}
        </div>
        <Sub id="au-pw-sub" text={L('pw.sub')} email={email} />
        <div className="au-field">
          <span className="au-label" id="au-pw-lbl">
            {L('pw.label')}
          </span>
          <input className="au-input" id="au-pw-in" ref={rPw} type={eye.pw ? 'text' : 'password'} autoComplete="current-password" onKeyDown={enter(pwNext)} />
          <button className="au-side" onClick={() => setEye((v) => ({ ...v, pw: !v.pw }))} aria-label="비밀번호 표시">
            {eye.pw ? '🙈' : '👁'}
          </button>
        </div>
        <div className={errCls('pw')} id="au-pw-err">
          {L('pw.err')}
        </div>
        <button className="au-btn primary au-gap" id="au-pw-go" onClick={pwNext}>
          {L('auth.continue')}
        </button>
        <div className="au-div" id="au-pw-div">
          {L('auth.or')}
        </div>
        <button className="au-btn ghost au-gap" id="au-pw-codebtn" onClick={() => sendCode()}>
          {L('pw.codebtn')}
        </button>
        <Foot />
      </div>
    </div>
  );
}

export function AuthModal() {
  const auth = useApp((s) => s.auth);
  return (
    <div
      className={'modal-bg' + (auth.open ? ' open' : '')}
      id="modal-auth"
      onClick={(e) => {
        if (e.target === e.currentTarget) authClose();
      }}
    >
      {/* 열 때마다 새로 시작한다 (authOpen 이 입력과 단계를 처음으로 돌리던 것) */}
      <Flow key={auth.seq} mode={auth.mode} open={auth.open} />
    </div>
  );
}
