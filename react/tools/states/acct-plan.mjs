// 이용 현황 화면(#/plan/rebates, #/plan/alerts)의 견줌 상태.
// 프리셋 02~11 은 과금 상태 11가지(TF_QA_PRESETS), 12~15 는 실행 환경 상태다. 두 쪽에 같은 저장 글자를 심어 같은 값에 닿는지 본다.
export default ({ click, seq }) => {
  const wait = (ms) => async (p) => { await p.waitForTimeout(ms); };
  const bottom = async (p) => { await p.evaluate(() => { window.scrollTo(0, 1e6); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = 1e6; }); };
  const U = (preset, o = {}) => ({ preset, hash: '#/plan/rebates', ...o });
  const A = (preset, o = {}) => ({ preset, hash: '#/plan/alerts', ...o });
  /* 스위치의 input 은 크기가 0 이라 label 을 누른다 */
  const sw = (card, row) => click(`.nfx-grid2 > section:nth-of-type(${card}) .nfx-row:nth-of-type(${row}) .nfx-sw`);
  const reload = async (p) => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#g-root'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500); await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' }); };
  const ids = ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15'];
  return [
    /* 계정 상태별 이용 현황 본문 */
    ...ids.map((id) => ['plan-' + id, null, null, U(id)]),
    ['plan-02-bottom', bottom, null, U('02')],
    ['plan-08-en', null, 'en', U('08')],
    /* 그 밖의 갈래: 관망, 무료 다 씀, 요금 연동만, 실행 연결만 */
    ['plan-watch', null, null, U('02', { tweak: "tfQaOverlay('bwatch')" })],
    ['plan-freeout', null, null, U('02', { tweak: "tfQaOverlay('creditout')" })],
    ['plan-uidonly', null, null, U('03', { tweak: "tfDevTgl('api')" })],
    ['plan-apionly', null, null, U('02', { tweak: "tfDevTgl('api')" })],
    /* 단추: 거래소 연결 CTA(상태 06), 연결하기, 카드 등록 */
    ['plan-06-cta', seq(click('.us-cta .ac-btn'), wait(900)), null, U('06')],
    ['plan-02-connect', seq(click('.us-rows .us-row:nth-of-type(1) .ac-btn'), wait(900)), null, U('02')],
    ['plan-02-card', seq(click('.us-rows .us-row:nth-of-type(2) .ac-btn'), wait(900)), null, U('02')],
    /* 알림 설정 */
    ['plan-alerts', null, null, A('02')],
    ['plan-alerts-bottom', bottom, null, A('02')],
    ['plan-alerts-en', null, 'en', A('08')],
    ['plan-alerts-toggle', seq(sw(1, 1), sw(1, 3), sw(2, 2), sw(2, 4), wait(500)), null, A('02')],
    /* 토글한 값이 저장되는지: 누르고 다시 연다 */
    ['plan-alerts-saved', seq(sw(1, 2), sw(2, 3), wait(1500), reload), null, A('02')],
    /* 탭으로 옮기기. 「이용 현황」 탭은 #/plan 으로 가고 회원이면 결제 설정으로 모인다 */
    ['plan-tab-alerts', seq(click('.nfx-tabs .nfx-tab:nth-of-type(2)'), wait(700)), null, U('08')],
    ['plan-tab-usage', seq(click('.nfx-tabs .nfx-tab:nth-of-type(1)'), wait(900)), null, A('08')],
    /* 손님이 주소로 바로 들어온 때: 홈, 로그인 창, 토스트 */
    ['plan-guest', null, null, { hash: '#/plan/rebates' }],
    ['plan-guest-alerts', null, null, { hash: '#/plan/alerts' }],
  ];
};
