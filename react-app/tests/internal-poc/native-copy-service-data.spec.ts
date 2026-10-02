import { expect, test, type Page } from '@playwright/test'

test.afterEach(async ({ page }) => { await expect(page.locator('body')).not.toContainText('PRIVATE_ADAPTER_PAYLOAD_NOT_FOR_DISPLAY') })

const hub=(page:Page)=>page.locator('#sharing-test-root')
async function mount(page:Page,ready=true){
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>localStorage.setItem('tethLang','ko'))
  await page.goto('/')
  await page.evaluate(async ready=>{const path='/tests/fixtures/sharing-service-harness.tsx';const {mountSharing}=await import(/* @vite-ignore */path);Reflect.set(window,'sharingHarness',mountSharing(ready))},ready)
  await expect(hub(page).locator('.native-strategies')).toBeVisible()
}
async function settle(page:Page,kind:string,success=true){await page.evaluate(({kind,success})=>Reflect.get(window,'sharingHarness').settle(kind,success),{kind,success})}
async function follow(page:Page){await hub(page).getByRole('button',{name:/^따라가는 중/}).click()}
async function detail(page:Page){await follow(page);await hub(page).locator('.cpd-card').getByRole('button',{name:'상세',exact:true}).click()}

test('공급 계좌 대시보드와 상세5탭은 실제 행과 결제 자산을 보존한다',async({page})=>{
  await mount(page);await follow(page)
  await expect(hub(page).locator('.cpd-sum .cpp-kpi')).toHaveCount(6)
  await expect(hub(page).locator('.cpd-card')).toContainText('1,150.25 USDC')
  await expect(hub(page).locator('.cpd-card')).toContainText('수익 분배 7%')
  await hub(page).locator('.cpd-card').getByRole('button',{name:'상세',exact:true}).click()
  await expect(hub(page).locator('.cpp-tabs button')).toHaveCount(5)
  await expect(hub(page).locator('.cpx-tbl tbody')).toContainText('3,400.012345')
  await expect(hub(page).locator('.cpx-tbl tbody')).toContainText('Short')
  for(const [tab,content] of [['거래 내역','공급된 목표 체결'],['수익 분배','2.81 USDC'],['잔고 변경','350.25 USDC'],['트랜잭션','Funding']]){
    // Stable source tab identifiers, independent of translated labels.
    const key={'거래 내역':1,'수익 분배':2,'잔고 변경':3,'트랜잭션':4}[tab]!
    await hub(page).locator('.cpp-tabs button').nth(key).click()
    await expect(hub(page).locator('.cpx-tbl tbody')).toContainText(content)
    await expect(hub(page).locator('.cpx-tbl tbody tr')).toHaveCount(1)
  }
  await expect(hub(page).locator('.cpx-tbl')).toContainText('0.032 USDC')
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>/copy-preview/.test(key)))).toEqual([])
})

test('잔고 조정은 공급 손실 확인을 거치고 실패/중복 제출/통화 변환 없이 성공 뒤에만 이동한다',async({page})=>{
  await mount(page);await detail(page)
  await hub(page).getByRole('button',{name:'잔고 조정',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.locator('.cps-in .un')).toHaveText('USDC')
  await dialog.getByRole('textbox',{name:'조정 금액',exact:true}).fill('100')
  await dialog.getByRole('button',{name:'확인',exact:true}).click()
  await expect(dialog).toContainText('잠깐, 손실 구간이에요')
  await dialog.getByRole('button',{name:'100.00 USDC 추가할게요',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'100.00 USDC 추가할게요',exact:true})).toBeDisabled()
  await expect(hub(page).locator('.cpp-tabs button').first()).toHaveAttribute('aria-pressed','true')
  await settle(page,'adjust',false);await expect(dialog.getByRole('alert')).toHaveText('요청을 완료하지 못했어요. 내용을 확인하고 다시 시도해주세요.')
  await dialog.getByRole('button',{name:'100.00 USDC 추가할게요',exact:true}).click();await settle(page,'adjust')
  await expect(dialog).toHaveCount(0)
  await expect(hub(page).locator('.cpp-tabs button').nth(3)).toHaveAttribute('aria-pressed','true')
})

test('정리·종료는 공급 정산값과 비동기 성공을 쓰며 미실현금액을 임의 재계산하지 않는다',async({page})=>{
  await mount(page);await detail(page)
  await hub(page).getByRole('button',{name:'포지션 전체 정리',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog).toContainText('1,149.44 USDC')
  await dialog.getByRole('button',{name:'정리하기',exact:true}).click();await settle(page,'flatten',false)
  await expect(dialog.getByRole('alert')).toContainText('다시 시도해주세요.')
  await expect(hub(page).locator('.cpx-tbl tbody')).toContainText('ETH/USDC')
  await dialog.getByRole('button',{name:'정리하기',exact:true}).click();await settle(page,'flatten')
  await expect(dialog).toHaveCount(0);await expect(hub(page).locator('.cpx-tbl tbody')).not.toContainText('ETH/USDC')
  await hub(page).getByRole('button',{name:'카피 종료',exact:true}).click()
  await expect(dialog).toContainText('1,151.13 USDC')
  await dialog.getByRole('button',{name:'종료하고 정산',exact:true}).click();await settle(page,'close',false)
  await expect(dialog).toBeVisible();await expect(hub(page).locator('.cpp-meta')).toContainText('카피 중')
  await dialog.getByRole('button',{name:'종료하고 정산',exact:true}).click();await settle(page,'close')
  await expect(dialog).toHaveCount(0);await expect(hub(page).locator('.cpx')).toHaveCount(0)
  await expect(hub(page).getByRole('button',{name:/^따라가는 중/})).toHaveAttribute('aria-pressed','true')
  await hub(page).getByRole('button',{name:'종료 포함',exact:true}).click()
  await expect(hub(page).locator('.cpd-card')).toContainText('종료됨')
  await hub(page).getByRole('button',{name:'기록 보기',exact:true}).click()
  await expect(hub(page).locator('.cpp-meta')).toContainText('종료됨')
  await expect(hub(page).getByRole('button',{name:'잔고 조정',exact:true})).toHaveCount(0)
})

test('팔로우 카드 전체 본문·재개·설정·보관·삭제는 공급 성공 전 목록을 바꾸지 않는다',async({page})=>{
  await mount(page);await follow(page)
  const list=hub(page).locator('.client-shared-follow-list'),card=list.locator('article')
  await expect(card).toContainText('예산 350.25 USDC');await expect(card.locator('svg')).toHaveCount(1)
  await card.getByRole('button',{name:'이어서 진행',exact:true}).click();await settle(page,'resume',false);await expect(list.getByRole('alert')).toContainText('다시 시도해주세요.')
  await card.getByRole('button',{name:'설정 변경',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await settle(page,'edit')
  await expect(page.getByRole('dialog').getByRole('combobox').first()).toHaveValue('2')
  await expect(page.getByRole('dialog').getByRole('combobox').nth(1)).toHaveValue('-4')
  await expect(page.getByRole('dialog').getByRole('combobox').nth(2)).toHaveValue('12')
  await page.getByRole('dialog').getByRole('button',{name:'다음: 예상 결과 보기',exact:true}).click();await settle(page,'validate-copy')
  await page.getByRole('dialog').getByRole('button',{name:'확정하고 검증 시작',exact:true}).click();await settle(page,'validate-confirm')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await page.evaluate(()=>Reflect.get(window,'sharingHarness').actions)).toContain('confirm-id:follow-actual')
  await card.getByRole('button',{name:'중지',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'중지하고 보관',exact:true}).click()
  await expect(card).toContainText('실행 준비');await settle(page,'archive',false);await expect(dialog.getByRole('alert')).toContainText('다시 시도해주세요.')
  await dialog.getByRole('button',{name:'중지하고 보관',exact:true}).click();await settle(page,'archive');await expect(dialog).toHaveCount(0)
  await expect(card).toContainText('보관됨')
  await card.getByRole('button',{name:'목록에서 삭제',exact:true}).click();await expect(card).toHaveCount(1);await settle(page,'remove',false)
  await expect(card).toHaveCount(1);await card.getByRole('button',{name:'목록에서 삭제',exact:true}).click();await settle(page,'remove');await expect(card).toHaveCount(0)
})

test('계정 전환 중 조정 응답은 새 계정 라우트·모달을 변경하지 않는다',async({page})=>{
  await mount(page);await detail(page);await hub(page).getByRole('button',{name:'잔고 조정',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'출금',exact:true}).click();await dialog.getByRole('textbox').fill('50');await dialog.getByRole('button',{name:'확인',exact:true}).click()
  await page.evaluate(()=>window.dispatchEvent(new Event('sharing-test-owner')))
  await expect(dialog).toHaveCount(0);await settle(page,'adjust')
  await expect(hub(page).getByRole('button',{name:'전략 찾기',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(hub(page).locator('.cpx')).toHaveCount(0)
})

test('미공급도 대시보드·요약·표 헤더와 탭은 유지하며 0·샘플 행으로 대체하지 않는다',async({page})=>{
  await mount(page,false);await follow(page)
  await expect(hub(page).locator('.cpd-sum .cpp-kpi b')).toHaveText(['—','—','—','—','—','—'])
  await expect(hub(page).locator('.client-shared-follow-list .ss3-tiles dd')).toHaveText(['—','—','—'])
  await expect(hub(page).locator('.cpd-card')).toHaveCount(0)
})

test('프로필 4개 데이터 탭은 미공급에도 표·달력 구조를 보존하고 320px에서 넘치지 않는다',async({page},info)=>{
  await page.setViewportSize({width:320,height:850});await mount(page)
  await hub(page).locator('.strategy-list-link').first().click()
  await hub(page).locator('.shared-detail-profile').click()
  await hub(page).getByRole('button',{name:'손익 캘린더',exact:true}).click()
  const calendar=hub(page).locator('.ss3-cal')
  await calendar.getByRole('button',{name:/2031-01-02/}).click()
  await expect(calendar.locator('.cal-c:focus .cal-tooltip')).toHaveText('49.79 USDC')
  await calendar.getByRole('button',{name:'이전 월',exact:true}).click()
  await expect(calendar.getByRole('button',{name:/2030-12-15/})).toBeVisible()
  await expect(calendar.getByRole('button',{name:'이전 월',exact:true})).toBeDisabled()
  await page.screenshot({path:info.outputPath('supplied-calendar-320.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true)
  await page.evaluate(()=>window.dispatchEvent(new Event('sharing-test-missing')))
  for(const tab of ['포지션','자금 이동','카피하는 사람들']){
    await hub(page).getByRole('button',{name:tab,exact:true}).click()
    await expect(hub(page).locator('.cpx-tbl thead')).toBeVisible()
    await expect(hub(page).locator('.cpx-tbl tbody')).toContainText('아직 제공되지 않은 정보')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true)
  }
})

test('320px 계좌 설정·상세 표는 원본 구조와 가로 스크롤을 보존하고 미공급 값은 0이 아니다',async({page},info)=>{
  await page.setViewportSize({width:320,height:850});await mount(page);await detail(page)
  await hub(page).getByRole('button',{name:'설정',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('ETH/USDC')
  await page.getByRole('dialog').getByRole('button',{name:'잔고 조정 열기',exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('textbox',{name:'조정 금액',exact:true})).toBeVisible()
  await page.getByRole('dialog').getByRole('button',{name:'취소',exact:true}).click()
  for(let i=0;i<5;i++){
    await hub(page).locator('.cpp-tabs button').nth(i).click()
    await expect(hub(page).locator('.cpx-tbl thead')).toBeVisible()
    expect(await hub(page).locator('.cpx-tblw').evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    if(i===2)await expect(hub(page).locator('.cpx-tbl tbody td').nth(3)).toHaveText('0 USDC')
  }
  await page.screenshot({path:info.outputPath('supplied-account-320.png'),fullPage:true})
  await page.evaluate(()=>window.dispatchEvent(new Event('sharing-test-missing')))
  for(let i=0;i<5;i++){
    await hub(page).locator('.cpp-tabs button').nth(i).click()
    await expect(hub(page).locator('.cpx-tbl thead')).toBeVisible()
    await expect(hub(page).locator('.cpx-tbl tbody')).toContainText('아직 제공되지 않은 정보')
    await expect(hub(page).locator('.cpx-tbl tbody')).not.toContainText('0 USDC')
  }
})

test('팔로우 설정 로딩 중 다른 탭으로 이동하면 늦은 응답이 모달을 열지 않는다',async({page})=>{
  await mount(page);await follow(page)
  await hub(page).locator('.client-shared-follow-list').getByRole('button',{name:'설정 변경',exact:true}).click()
  await hub(page).getByRole('button',{name:'전략 찾기',exact:true}).click();await settle(page,'edit')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(hub(page).getByRole('button',{name:'전략 찾기',exact:true})).toHaveAttribute('aria-pressed','true')
})
