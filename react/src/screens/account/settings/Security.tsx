// 설정 > 보안 (원본 skSecurity 로 바뀐 stSecurity): 로그인, 로그인한 기기, 거래소 연결. 한 줄에 조작 하나.
import { acConnList, acName } from '../../../core/account/ac';
import { skDate, stDevice, stS } from '../../../core/account/settings';
import { AcLogo } from '../brokers/parts';
import { stBrokers, stDisc, stOutAll, stOutOne, stTwofa } from './actions';
import { Num, StBtn, StRow, StSec } from './parts';
import { stDlg } from './state';

/** stSecurity() */
export function Security() {
  const s = stS();
  const [dev, br] = stDevice(navigator.userAgent);
  const L = acConnList();
  return (
    <>
      <h1>보안</h1>
      <StSec t="로그인">
        <StRow
          k="비밀번호"
          act={<StBtn l="변경" fn={() => stDlg({ k: 'pw' })} />}
          sub={
            s.pwAt ? (
              <>
                마지막 변경일 <Num>{skDate(s.pwAt)}</Num>
              </>
            ) : (
              '12자 이상, 숫자와 특수문자를 포함합니다.'
            )
          }
        />
        <StRow
          k="2단계 인증"
          act={
            <button type="button" className="stg-sw" role="switch" aria-checked={!!s.twofa} aria-label="2단계 인증" onClick={stTwofa}>
              <i />
            </button>
          }
          sub="로그인할 때 이메일 인증번호를 확인합니다."
        />
      </StSec>
      <StSec t="로그인한 기기">
        <StRow k={dev + ', ' + br} sub="현재 기기" />
        {(s.devices || []).map((d) => (
          <StRow
            key={d.id}
            k={d.n}
            act={<StBtn l="로그아웃" fn={() => stOutOne(d.id)} />}
            sub={
              <>
                {d.where + ', 마지막 활동 '}
                <Num>{d.at}</Num>
              </>
            }
          />
        ))}
        <StRow k="다른 모든 기기" act={<StBtn l="모두 로그아웃" fn={stOutAll} />} sub="이 기기의 로그인은 유지합니다." />
      </StSec>
      <StSec t="거래소 연결">
        {L.length ? (
          L.map((k) => (
            <StRow
              key={k}
              k={
                <>
                  <AcLogo id={k} z={20} />
                  {acName(k)}
                </>
              }
              act={<StBtn l="연결 끊기" fn={() => stDisc(k)} />}
              sub="잔고 조회와 주문"
            />
          ))
        ) : (
          <StRow k="연결된 거래소가 없습니다" act={<StBtn l="거래소 연결" fn={stBrokers} />} sub="연결하면 거래소마다 허용한 권한이 여기에 보입니다." />
        )}
      </StSec>
    </>
  );
}
