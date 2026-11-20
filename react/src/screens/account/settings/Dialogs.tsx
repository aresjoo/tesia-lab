// 설정의 창들 (원본 stDlg 로 띄우는 것). 원본처럼 body 바로 아래(#st-dlg)에 뜬다.
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AC_CFG, acCardFmt, acExpFmt, acS, acUsd } from '../../../core/account/ac';
import { aiAuto, aiAutoSet } from '../../../core/account/ai';
import { skDate, skExp, stBillOf, stBillTo, stDefCard } from '../../../core/account/settings';
import { aiTopupDo, skBillSave, skCardDef, stCardAdd, stCardDel, stCardDlg, stEmailDone, stEmailSend, stPwSave, stSubCancel } from './actions';
import { Num, StBtn, StRow } from './parts';
import { ST, stDlg, stDlgClose } from './state';

const val = (r: RefObject<HTMLInputElement | null>) => (r.current ? r.current.value : '');

/** stDlg(html, label): 뜨면 첫 입력 칸이나 단추에 초점 */
function Dlg({ label, children }: { label?: string; children: ReactNode }) {
  const w = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = w.current?.querySelector<HTMLElement>('input,button');
    if (f)
      try {
        f.focus();
      } catch {
        /* 무시 */
      }
  }, []);
  return createPortal(
    <div
      id="st-dlg"
      className="acx-cf stg-dlg"
      role="dialog"
      aria-modal="true"
      aria-label={label || '설정'}
      ref={w}
      onClick={(e) => {
        if (e.target === e.currentTarget) stDlgClose();
      }}
    >
      <div className="bx">{children}</div>
    </div>,
    document.body,
  );
}
const X = () => (
  <button type="button" className="x" aria-label="닫기" onClick={stDlgClose}>
    ✕
  </button>
);
const No = ({ l = '취소', fn = stDlgClose }: { l?: string; fn?: () => void }) => (
  <button type="button" className="no" onClick={fn}>
    {l}
  </button>
);

/** stEmailPaint(): 새 주소 → 그 주소로 보낸 확인 번호 → 변경 */
function EmailDlg() {
  const s = ST.em;
  const [er, setEr] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  if (s.step === 0)
    return (
      <Dlg label="이메일 변경">
        <h3>이메일 변경</h3>
        <p>새 이메일 주소로 확인 번호를 보냅니다. 확인을 마치면 로그인 주소가 바뀝니다.</p>
        <label className="ty">
          <span>새 이메일</span>
          <input id="st-em" type="email" autoComplete="off" defaultValue={s.v} placeholder="name@example.com" ref={inp} />
        </label>
        <small className="er" id="st-em-e">
          {er}
        </small>
        <div className="bts">
          <No />
          <button type="button" className="ok" onClick={() => setEr(stEmailSend(inp.current ? inp.current.value : '') || '')}>
            확인 번호 보내기
          </button>
        </div>
      </Dlg>
    );
  return (
    <Dlg label="이메일 변경">
      <h3>확인 번호 입력</h3>
      <p>
        <b className="num">{s.v}</b> 으로 보낸 6자리 번호를 입력해 주십시오.
      </p>
      <label className="ty">
        <span>확인 번호</span>
        <input id="st-ec" inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="num" ref={inp} />
      </label>
      <small className="er" id="st-em-e">
        {er}
      </small>
      <div className="bts">
        <No
          l="주소 다시 입력"
          fn={() => {
            ST.em.step = 0;
            stDlg({ k: 'email' });
          }}
        />
        <button type="button" className="ok" onClick={() => setEr(stEmailDone(inp.current ? inp.current.value : '') || '')}>
          이메일 변경
        </button>
      </div>
    </Dlg>
  );
}

/** stReceipt(id) */
function ReceiptDlg({ id }: { id: string }) {
  const b = stBillOf(id);
  if (!b) return null;
  const bt = acS().billTo;
  const head: Record<string, string> = { paid: '영수증', failed: '결제 실패 내역', refunded: '환불 내역' };
  const st: Record<string, string> = { paid: '결제 완료', failed: '승인되지 않음', refunded: '환불 완료' };
  return (
    <Dlg label="결제 내역">
      <h3>{head[b.st] || '내역'}</h3>
      <dl className="stg-rc">
        <div>
          <dt>내용</dt>
          <dd>{b.label}</dd>
        </div>
        <div>
          <dt>날짜</dt>
          <dd className="num">{skDate(b.at)}</dd>
        </div>
        <div>
          <dt>금액</dt>
          <dd className="num">{acUsd(b.amt) + ' USD'}</dd>
        </div>
        <div>
          <dt>결제 수단</dt>
          <dd className="num">{(b.brand || '') + ' •••• ' + (b.last4 || '')}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{String(st[b.st])}</dd>
        </div>
        <div>
          <dt>번호</dt>
          <dd className="num">{b.id}</dd>
        </div>
        {bt && bt.name ? (
          <div>
            <dt>받는 사람</dt>
            <dd>{bt.name}</dd>
          </div>
        ) : null}
      </dl>
      <div className="bts">
        <button type="button" className="ok" onClick={stDlgClose}>
          닫기
        </button>
      </div>
    </Dlg>
  );
}

type CardK = 'cn' | 'ce' | 'cc' | 'ch';
/** stCardDlg(): 카드 칸은 acIn 과 같은 짜임이다. 오류가 난 칸은 bad 를 붙이고 초점을 준다 (acErr) */
function CardDlg() {
  const [v, setV] = useState({ cn: '', ce: '', cc: '', ch: '' });
  const [er, setEr] = useState<{ field: CardK; msg: string; n: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!er) return;
    const i = box.current?.querySelector<HTMLElement>('#sc-' + er.field);
    if (i)
      try {
        i.focus();
      } catch {
        /* 무시 */
      }
  }, [er]);
  const In = (k: CardK, lb: string, ph: string, attr: InputHTMLAttributes<HTMLInputElement>, fmt?: (s: string) => string) => {
    const id = 'sc-' + k;
    const bad = !!er && er.field === k;
    return (
      <label className="btg-f" htmlFor={id}>
        <span>{lb}</span>
        <input
          id={id}
          className={'num' + (bad ? ' bad' : '')}
          placeholder={ph}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={id + '-e'}
          {...attr}
          value={v[k]}
          onChange={(e) => setV({ ...v, [k]: fmt ? fmt(e.target.value) : e.target.value })}
        />
        <small className="er" id={id + '-e'} role="alert">
          {bad ? er.msg : ''}
        </small>
      </label>
    );
  };
  return (
    <Dlg label="결제 수단 추가">
      <h3>결제 수단 추가</h3>
      <div className="btg-form" ref={box}>
        {In('cn', '카드 번호', '0000 0000 0000 0000', { inputMode: 'numeric', maxLength: 19 }, acCardFmt)}
        <div className="two">
          {In('ce', '유효기간', 'MM / YY', { inputMode: 'numeric', maxLength: 7 }, acExpFmt)}
          {In('cc', '보안 코드', '뒷면 3자리', { inputMode: 'numeric', maxLength: 4, type: 'password' })}
        </div>
        {In('ch', '카드에 적힌 이름', 'HONG GILDONG', {})}
      </div>
      <div className="bts">
        <No />
        <button
          type="button"
          className="ok"
          onClick={() => {
            const r = stCardAdd(v);
            setEr(r ? { field: r.field, msg: r.msg, n: (er ? er.n : 0) + 1 } : null);
          }}
        >
          추가
        </button>
      </div>
    </Dlg>
  );
}

/** skSubDlg() */
function SubDlg() {
  const sub = acS().sub;
  const def = stDefCard();
  return (
    <Dlg label="TETH 구독">
      <X />
      <h3>TETH 구독</h3>
      <div className="stg-card">
        <StRow k="요금" v={<Num>{acUsd((sub && sub.price) || AC_CFG.price) + ' / 월'}</Num>} />
        <StRow k="다음 결제일" v={<Num>{skDate((sub && sub.next) || Date.now() + 30 * 864e5)}</Num>} />
        <StRow
          k="결제 수단"
          v={
            def ? (
              <>
                {def.brand + ' '}
                <Num>{'•••• ' + def.last4}</Num>
              </>
            ) : (
              '-'
            )
          }
        />
      </div>
      <div className="bts">
        <button
          type="button"
          className="dg"
          onClick={() => {
            stDlgClose();
            stSubCancel();
          }}
        >
          구독 해지
        </button>
      </div>
    </Dlg>
  );
}

/** skCardsDlg() */
function CardsDlg() {
  const a = acS();
  return (
    <Dlg label="결제 수단">
      <X />
      <h3>결제 수단</h3>
      <div className="stg-card">
        {a.cards.map((c) => (
          <StRow
            key={c.id}
            k={
              <>
                {c.brand + ' '}
                <Num>{'•••• ' + c.last4}</Num>
              </>
            }
            act={
              <>
                {c.def ? null : <StBtn l="기본으로 설정" fn={() => skCardDef(c.id)} />}
                <StBtn
                  l="삭제"
                  fn={() => {
                    stDlgClose();
                    stCardDel(c.id);
                  }}
                />
              </>
            }
            sub={
              <>
                {c.def ? '기본 결제 수단, ' : ''}
                <Num>{skExp(c.exp)}</Num>
              </>
            }
          />
        ))}
      </div>
      <div className="bts">
        <button
          type="button"
          className="ok"
          onClick={() => {
            stDlgClose();
            stCardDlg();
          }}
        >
          결제 수단 추가
        </button>
      </div>
    </Dlg>
  );
}

/** skBillDlg() */
function BillDlg() {
  const bt = stBillTo();
  const [er, setEr] = useState('');
  const e = useRef<HTMLInputElement>(null);
  const n = useRef<HTMLInputElement>(null);
  const ad = useRef<HTMLInputElement>(null);
  return (
    <Dlg label="청구 정보">
      <h3>청구 정보</h3>
      <label className="ty">
        <span>결제 이메일</span>
        <input id="st-be" type="email" defaultValue={bt.email} ref={e} />
      </label>
      <label className="ty">
        <span>이름</span>
        <input id="st-bn" defaultValue={bt.name} ref={n} />
      </label>
      <label className="ty">
        <span>청구지 주소</span>
        <input id="st-ba" defaultValue={bt.addr} placeholder="도로명 주소, 도시, 우편번호, 국가" ref={ad} />
      </label>
      <small className="er" id="st-bi-e">
        {er}
      </small>
      <div className="bts">
        <No />
        <button type="button" className="ok" onClick={() => setEr(skBillSave(val(e), val(n), val(ad)) || '')}>
          저장
        </button>
      </div>
    </Dlg>
  );
}

/** stPwDlg() */
function PwDlg() {
  const [er, setEr] = useState('');
  const p0 = useRef<HTMLInputElement>(null);
  const p1 = useRef<HTMLInputElement>(null);
  const p2 = useRef<HTMLInputElement>(null);
  return (
    <Dlg label="비밀번호 변경">
      <h3>비밀번호 변경</h3>
      <label className="ty">
        <span>지금 비밀번호</span>
        <input id="st-p0" type="password" autoComplete="current-password" ref={p0} />
      </label>
      <label className="ty">
        <span>새 비밀번호</span>
        <input id="st-p1" type="password" autoComplete="new-password" ref={p1} />
      </label>
      <label className="ty">
        <span>새 비밀번호 확인</span>
        <input id="st-p2" type="password" autoComplete="new-password" ref={p2} />
      </label>
      <small className="er" id="st-pw-e">
        {er}
      </small>
      <div className="bts">
        <No />
        <button type="button" className="ok" onClick={() => setEr(stPwSave(val(p0), val(p1), val(p2)) || '')}>
          변경
        </button>
      </div>
    </Dlg>
  );
}

/** aiTopup() 의 창 */
function TopupDlg() {
  return (
    <Dlg>
      <h3>크레딧 추가</h3>
      <p className="stg-note">충전한 금액에서 쓴 만큼 차감됩니다. 남은 금액은 다음 달로 이어집니다.</p>
      <div className="use-amts">
        {[10, 25, 50, 100].map((v) => (
          <button type="button" className="use-amt" key={v} onClick={() => aiTopupDo(v)}>
            {'$' + v}
          </button>
        ))}
      </div>
      <label className="use-auto">
        <input type="checkbox" id="use-auto" defaultChecked={aiAuto()} onChange={(e) => aiAutoSet(e.target.checked)} /> 잔액이 $5 아래로 내려가면 $25를 자동으로 충전합니다
      </label>
    </Dlg>
  );
}

/** 설정 화면이 떠 있는 동안 올려 둔다. stDlg 를 부를 때마다 새로 뜬다(입력과 초점이 처음으로) */
export function StDialogs() {
  const d = ST.dlg;
  if (!d) return null;
  const key = ST.dlgSeq;
  if (d.k === 'email') return <EmailDlg key={key} />;
  if (d.k === 'receipt') return <ReceiptDlg key={key} id={d.id} />;
  if (d.k === 'card') return <CardDlg key={key} />;
  if (d.k === 'sub') return <SubDlg key={key} />;
  if (d.k === 'cards') return <CardsDlg key={key} />;
  if (d.k === 'bill') return <BillDlg key={key} />;
  if (d.k === 'pw') return <PwDlg key={key} />;
  return <TopupDlg key={key} />;
}
