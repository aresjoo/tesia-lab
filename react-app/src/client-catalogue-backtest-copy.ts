/** Exact Korean bt/rv public-catalogue copy from 9fbff821; source rules remain Korean. */
export const catalogueBacktestCopy = {
  title: '백테스트', conditions: '돌려 볼 조건', period: '기간', amount: '시작 금액', start: '과거를 다시 돌려 보기',
  rules: '이 전략의 규칙', terms: '백테스트 조건', skip: '바로 결과 보기', execute: '이 전략 실행하기',
  rerun: '조건을 바꿔 다시 돌리기', browse: '다른 전략 둘러보기', decisions: '어떻게 판단했나', trades: '거래 하나씩 보기',
  loading: '가격 자료 준비', readTitle: 'TETH의 해석', readUnavailable: '해석을 불러오지 못했습니다. 결과 숫자는 위에 그대로 있습니다.',
  judgmentUnavailable: '판단 문장을 불러오지 못했습니다.', noTrades: '거래가 한 번도 없어 결과를 판단하기 어렵습니다. 조건을 넓히거나 기간을 바꿔 보십시오.',
  callbackUnavailable: '연결 준비 화면이 아직 연결되지 않았습니다.', callbackPending: '연결 확인을 요청하고 있습니다.',
  callbackAwaiting: '연결 확인을 요청했습니다. 확인 결과를 기다립니다.', callbackFailed: '연결 확인을 요청하지 못했습니다. 검증 결과는 그대로 있습니다.',
  ownerUnavailable: '로그인 상태와 전략을 확인한 뒤 다시 열어 주십시오.', storage: '이 탭에 조건을 저장하지 못했습니다. 기존 기록은 그대로 있습니다.',
  preview: '클라이언트 가격 스냅샷 미리보기 · 실제 주문·결제·거래소 연결은 진행되지 않습니다.',
} as const
export const catalogueBacktestPeriodLabels = { 90: '최근 3개월', 365: '최근 1년', 730: '최근 2년', 0: '전체 기간' } as const
