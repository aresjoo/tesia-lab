// 설정 > 결제 (원본 skBilling 을 감싼 최종 stBilling): 구독 카드 하나(플랜, 청구 예정 금액, 결제 수단, 청구 정보)와 결제 내역 최근 3건. 관리는 창에서 한다.
import { AC_CFG, acAccess, acS, acSubOn, acUsd } from '../../../core/account/ac';
import { aiBill } from '../../../core/account/ai';
import { skDate, skDateK, stDefCard } from '../../../core/account/settings';
import { S } from '../../../core/account/tf';
import { stBrokers, stCardDlg, stSubResume } from './actions';
import { Num, SkNext, StBtn, StRow } from './parts';
import { ST, stDlg, stRe } from './state';

const BILL_ST: Record<string, string> = { paid: '결제 완료', failed: '결제 실패', refunded: '환불 완료' };

/** stBilling() */
export function Billing() {
  const a = acS();
  const acc = acAccess();
  const sub = a.sub;
  const on = acSubOn();
  const cx = !!sub && sub.st === 'cancelled';
  const def = stDefCard();
  const price = acUsd((sub && sub.price) || AC_CFG.price) + ' / 월';
  const plan = on ? (
    cx ? (
      <StRow
        k="TETH 구독"
        v={<Num>{price}</Num>}
        act={<StBtn l="다시 시작" fn={stSubResume} />}
        sub={
          <>
            <Num>{skDateK((sub && sub.until) as number)}</Num>까지 이용할 수 있습니다.
          </>
        }
      />
    ) : (
      <StRow
        k="TETH 구독"
        v={<Num>{price}</Num>}
        act={<StBtn l="구독 관리" fn={() => stDlg({ k: 'sub' })} />}
        sub={
          <>
            다음 결제일은 <Num>{skDateK((sub && sub.next) || Date.now() + 30 * 864e5)}</Num>입니다.
          </>
        }
      />
    )
  ) : acc === 'partner' ? (
    <StRow k="TETH 초대 계정" sub="이용료가 없습니다." />
  ) : cx ? (
    <StRow
      k="구독이 종료되었습니다"
      act={<StBtn l="다시 구독" fn={stBrokers} cls="p" />}
      sub={
        <>
          <Num>{skDateK((sub && sub.until) as number)}</Num>에 종료되어 전략의 신규 주문이 중단되었습니다.
        </>
      }
    />
  ) : (
    <StRow k="이용 중인 플랜이 없습니다" act={<StBtn l="거래소 연결" fn={stBrokers} cls="p" />} sub={'TETH 초대 계정은 무료, 구독은 월 ' + acUsd(AC_CFG.price) + '입니다.'} />
  );
  const showPay = !(acc === 'partner' && !a.cards.length && !a.bill.length);
  const btEmail = a.billTo ? a.billTo.email : (S.user && S.user.email) || '';
  /* 청구 예정 금액: 구독 카드 안, 결제 수단 줄 바로 앞 (aiBill 로 감싼 부분) */
  const q = aiBill();
  const fail = a.pay && a.pay.st === 'fail' && !on;
  const n = ST.allBill ? a.bill.length : 3;
  return (
    <>
      <h1>결제</h1>
      {fail ? (
        <p className="stg-warn" role="alert">
          마지막 결제가 승인되지 않았습니다. 결제 수단을 확인해 주십시오.
        </p>
      ) : null}
      <section className="stg-sec">
        <header>
          <h2>구독</h2>
        </header>
        <div className="stg-card">
          {plan}
          {showPay ? (
            <>
              {q.gross ? (
                <StRow
                  k="청구 예정 금액"
                  v={<Num>{acUsd(q.total)}</Num>}
                  sub={
                    q.credit || q.extra ? (
                      <Num>
                        {'구독 ' + acUsd(q.gross) + (q.credit ? ', 거래 크레딧 -' + acUsd(q.credit) : '') + (q.extra ? ', 추가 사용 +' + acUsd(q.extra) : '')}
                      </Num>
                    ) : null
                  }
                />
              ) : null}
              <StRow
                k="결제 수단"
                act={<StBtn l={a.cards.length ? '관리' : '추가'} fn={a.cards.length ? () => stDlg({ k: 'cards' }) : stCardDlg} />}
                sub={
                  def ? (
                    <>
                      {def.brand + ' '}
                      <Num>{'•••• ' + def.last4}</Num>
                    </>
                  ) : (
                    '등록한 카드가 없습니다'
                  )
                }
              />
              <StRow k="청구 정보" act={<StBtn l="변경" fn={() => stDlg({ k: 'bill' })} />} sub={<Num>{btEmail || '-'}</Num>} />
            </>
          ) : null}
        </div>
      </section>
      <section className="stg-sec">
        <header>
          <h2>결제 내역</h2>
          {a.bill.length > 3 && !ST.allBill ? (
            <button
              type="button"
              className="stg-lk"
              onClick={() => {
                ST.allBill = true;
                stRe();
              }}
            >
              전체 보기
            </button>
          ) : null}
        </header>
        {a.bill.length ? (
          <div className="stg-card">
            {a.bill.slice(0, n).map((b) => (
              <button type="button" className="stg-r stg-hr" key={b.id} onClick={() => stDlg({ k: 'receipt', id: b.id })}>
                <div className="k">
                  <b className="num">{skDate(b.at)}</b>
                  <span className={b.st === 'failed' ? 'bad' : undefined}>{BILL_ST[b.st] || b.st}</span>
                </div>
                <div className="v num">{acUsd(b.amt)}</div>
                <div className="a">
                  <SkNext />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="stg-card">
            <div className="stg-r">
              <div className="k">
                <span>{acc === 'partner' ? 'TETH 초대 계정은 결제 내역이 없습니다.' : '아직 결제 내역이 없습니다.'}</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
