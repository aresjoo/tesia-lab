// 설정 > 사용량 (원본 stUsage): 퍼센트와 초기화 날짜만 보여 준다.
import { acUsd } from '../../../core/account/ac';
import { aiMeter, aiNext } from '../../../core/account/ai';
import { aiNextGo } from './actions';
import { Num, StBtn, StRow, StSec } from './parts';

const TIER_L: Record<string, string> = { FREE: '무료 둘러보기', UID: 'TETH 초대 계정', CARD: 'TETH 구독', CARD_UID: 'TETH 구독과 초대 계정' };
const HOW: Record<string, string> = {
  FREE: '둘러보기용 무료 사용량입니다.',
  UID: '모자라면 카드를 등록해 계속 쓸 수 있습니다.',
  CARD: '초대 계정을 연결하면 사용량이 매달 더 생깁니다.',
  CARD_UID: '모자라면 크레딧을 추가해 계속 쓸 수 있습니다.',
};

/** stUsage() */
export function Usage() {
  const m = aiMeter();
  const nx = aiNext();
  const note = m.pct >= 100 ? '새 요청은 잠시 멈춥니다. 실행 중인 전략과 결과 보기는 그대로입니다.' : '';
  const rd = new Date(m.reset);
  const rdT = rd.getFullYear() + '년 ' + (rd.getMonth() + 1) + '월 ' + rd.getDate() + '일';
  return (
    <>
      <h1>사용량</h1>
      <section className="stg-sec">
        <div className="stg-card use-card">
          <div className="use-h">
            <b>이번 달 AI 사용량</b>
            <span className="num">{m.pct + '%'}</span>
          </div>
          <div className="use-track">
            <i style={{ width: m.pct + '%' }} />
          </div>
          <p className="use-sub">{rdT + '에 초기화됩니다.' + (note ? ' ' + note : '')}</p>
        </div>
      </section>
      <StSec>
        <StRow k="이용 방식" v={TIER_L[m.tier] || ''} act={m.pct >= 80 ? <StBtn l={nx.label} fn={aiNextGo} cls="p" /> : null} sub={HOW[m.tier] || ''} />
      </StSec>
      {m.tier === 'CARD_UID' || m.tier === 'UID' ? (
        <StSec>
          <StRow k="거래 크레딧" v={<Num>{acUsd(Math.max(0, m.bal))}</Num>} />
        </StSec>
      ) : null}
    </>
  );
}
