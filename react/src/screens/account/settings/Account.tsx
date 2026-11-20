// 설정 > 계정 (원본 stAccount): 상태, 이름, 사용자명, 이메일, 연결된 거래소, 로그아웃, 계정 삭제.
import { useEffect, useRef, useState } from 'react';
import { acAccess, acConnList, acName, acS } from '../../../core/account/ac';
import { stAccessTxt, stHandle } from '../../../core/account/settings';
import { S } from '../../../core/account/tf';
import { AcLogo, maskId } from '../brokers/parts';
import { stBrokers, stDelete, stDisc, stHandleSave, stLogout, stNameSave } from './actions';
import { Num, StBtn, StRow, StSec } from './parts';
import { ST, stEdit, stEmailDlg, stGo } from './state';

/** 고치는 줄: stEdit(k) 가 열면 칸에 초점을 주고 글자를 모두 고른다 */
function EdRow({ k, id, max, val, at, save }: { k: string; id: string; max: number; val: string; at?: boolean; save: (v: string) => string | null }) {
  const inp = useRef<HTMLInputElement>(null);
  const [er, setEr] = useState('');
  useEffect(() => {
    const i = inp.current;
    if (i)
      try {
        i.focus();
        i.select();
      } catch {
        /* 무시 */
      }
  }, []);
  return (
    <div className="stg-r ed">
      <div className="k">
        <b>{k}</b>
      </div>
      <div className="v">
        {at ? <span className="stg-at">@</span> : null}
        <input id={id} className="stg-in" maxLength={max} defaultValue={val} ref={inp} />
        <small className="er" id={id + '-e'}>
          {er}
        </small>
      </div>
      <div className="a">
        <StBtn l="취소" fn={() => stEdit(null)} />
        <StBtn l="저장" fn={() => setEr(save(inp.current ? inp.current.value : '') || '')} cls="p" />
      </div>
    </div>
  );
}

/** stAccount() */
export function Account() {
  const u = S.user || { name: '', email: '' };
  const a = acS();
  const L = acConnList();
  const e = ST.edit;
  const none = acAccess() === 'none';
  return (
    <>
      <h1>계정</h1>
      <StSec t="계정">
        <StRow k="상태" v={<span className={'stg-pill ' + (none ? '' : 'on')}>{stAccessTxt()}</span>} act={none ? <StBtn l="실행 환경 연결" fn={stBrokers} cls="p" /> : <StBtn l="결제와 이용 방식" fn={() => stGo('billing')} />} />
        {e === 'name' ? <EdRow k="이름" id="st-name" max={30} val={u.name || ''} save={stNameSave} /> : <StRow k="이름" v={u.name || ''} act={<StBtn l="변경" fn={() => stEdit('name')} />} />}
        {e === 'handle' ? (
          <EdRow k="사용자명" id="st-hd" max={20} val={stHandle()} at save={stHandleSave} />
        ) : (
          <StRow k="사용자명" v={<Num>{'@' + stHandle()}</Num>} act={<StBtn l="변경" fn={() => stEdit('handle')} />} sub="공유한 전략에 등록자로 표시됩니다" />
        )}
        <StRow k="이메일" v={<Num>{u.email || ''}</Num>} act={<StBtn l="변경" fn={stEmailDlg} />} />
      </StSec>
      <StSec t="연결된 거래소">
        {L.length ? (
          L.map((k) => {
            const c = a.conn[k];
            return (
              <StRow
                key={k}
                k={
                  <>
                    <AcLogo id={k} z={20} />
                    {acName(k)}
                  </>
                }
                v={
                  <>
                    {(c.via === 'paid' ? '구독으로 이용' : 'TETH 초대 계정') + (c.uid ? ', ' : '')}
                    {c.uid ? <Num>{maskId(c.uid)}</Num> : null}
                  </>
                }
                act={<StBtn l="연결 끊기" fn={() => stDisc(k)} />}
              />
            );
          })
        ) : (
          <StRow k="연결된 거래소가 없습니다" act={<StBtn l="거래소 연결" fn={stBrokers} cls="p" />} sub="전략을 실행하려면 거래소 계정이 필요합니다" />
        )}
      </StSec>
      <StSec>
        <StRow k="로그아웃" act={<StBtn l="로그아웃" fn={stLogout} />} sub="이 기기에서만 로그아웃합니다" />
      </StSec>
      <StSec>
        <StRow k="계정 삭제" act={<StBtn l="계정 삭제" fn={stDelete} cls="dg" />} sub="전략과 기록이 모두 지워지며 되돌릴 수 없습니다" />
      </StSec>
    </>
  );
}
