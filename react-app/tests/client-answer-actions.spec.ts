import { expect, test, type Page } from '@playwright/test'
import { answerFeedbackReasons, answerFeedbackText } from '../src/client-answer-feedback-copy'
import { feedbackText } from '../src/client-feedback-copy'
import type { ClientLanguage } from '../src/client-preferences'

const path = '/tests/fixtures/answer-actions.html'
const original = '**답변 원문**\n두 번째 줄 <script>literal</script>'
const languages: ClientLanguage[] = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
async function language(page: Page, lang: ClientLanguage) {
  await page.evaluate(lang => { localStorage.setItem('tethLang', lang); window.dispatchEvent(new StorageEvent('storage', { key:'tethLang', newValue:lang, storageArea:localStorage })) }, lang)
}
type Clip = { values: string[]; resolve: (() => void)[]; reject: (() => void)[] }
async function clipboard(page: Page) {
  await page.evaluate(() => {
    const clip: Clip = { values:[], resolve:[], reject:[] }
    Object.defineProperty(navigator,'clipboard',{ configurable:true, value:{ writeText: (text:string) => {
      clip.values.push(text); return new Promise<void>((resolve,reject) => { clip.resolve.push(resolve); clip.reject.push(() => reject(new Error('denied'))) })
    } } }); Object.assign(window,{ clip })
  })
}

for (const width of [320,1440]) test(`${width}px 원본 사유5종·기타·닫기·언어·초점 보존, 미연결은 성공 없이 원문 유지`, async ({ page }) => {
  await page.setViewportSize({ width, height:900 }); await page.goto(path)
  const posts:string[]=[]; page.on('request', req => { if(req.method() !== 'GET') posts.push(req.url()) })
  const down = page.getByRole('button',{ name:'아쉬운 답변', exact:true })
  await down.click()
  const panel=page.locator('.client-answer-feedback')
  await expect(panel).toHaveAccessibleName('무엇이 문제였나요?')
  await expect(panel.getByRole('status')).toHaveText(feedbackText('ko','unavailable'))
  await expect(panel.getByRole('button',{ name:'사실과 다름', exact:true })).toBeFocused()
  for(const key of answerFeedbackReasons) {
    const choice=panel.getByRole('button',{ name:answerFeedbackText('ko',key), exact:true })
    await choice.click(); await expect(choice).toHaveAttribute('aria-pressed','true')
    await expect(panel.getByRole('status')).toHaveText(feedbackText('ko','unavailable'))
  }
  await panel.getByRole('button',{ name:'기타',exact:true }).click()
  const input=panel.getByRole('textbox')
  await expect(input).toBeFocused()
  await panel.getByRole('button',{ name:'제출',exact:true }).click()
  await expect(input).toHaveAttribute('aria-invalid','true')
  const raw='  <img src=x> 사용자 의견\n추가 문장  '
  await input.fill(raw); await panel.getByRole('button',{ name:'제출',exact:true }).click()
  await expect(input).toHaveValue(raw)
  await expect(panel.getByRole('status')).toBeFocused()
  const element=await panel.elementHandle()
  await input.focus()
  for(const lang of languages) {
    await language(page,lang)
    await expect(panel).toHaveAccessibleName(answerFeedbackText(lang,'title'))
    await expect(panel.getByRole('status')).toHaveText(feedbackText(lang,'unavailable'))
    await expect(input).toBeFocused(); await expect(input).toHaveValue(raw)
    expect(await element!.evaluate(el=>el.isConnected)).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  }
  await page.screenshot({ path:`/tmp/teth-answer-feedback-fr-${width}.png`,fullPage:true })
  await input.dispatchEvent('keydown',{key:'Escape',isComposing:true})
  await expect(panel).toBeVisible()
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0)
  await expect(page.locator('.client-answer-actions button').nth(1)).toBeFocused()
  await expect(page.getByRole('textbox',{name:'답변 원문'})).toHaveValue(original)
  expect(posts).toEqual([])
})

test('복사 성공/실패·1.5초 복원·중복 응답·원문 변경·unmount 경쟁을 격리한다', async ({ page }) => {
  await page.goto(path); await clipboard(page)
  const button=page.locator('.client-answer-actions button').nth(2)
  await button.click()
  await expect(button).toHaveAccessibleName('답변 복사')
  expect(await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.values)).toEqual([original])
  await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.reject[0]())
  await expect(page.locator('.answer-copy-error')).toHaveText('복사 권한을 확인해주세요.')
  await button.click(); await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.resolve[1]())
  await expect(button).toHaveAccessibleName('답변 복사 완료')
  await expect(button).toHaveAccessibleName('답변 복사',{timeout:3000})
  await button.click(); await button.click()
  await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.resolve[3]())
  await expect(button).toHaveAccessibleName('답변 복사 완료')
  await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.reject[2]())
  await expect(page.locator('.answer-copy-error')).toHaveCount(0)
  await page.getByRole('textbox',{name:'답변 원문'}).fill('다른 답변')
  await page.getByRole('textbox',{name:'답변 원문'}).fill(original)
  await expect(button).toHaveAccessibleName('답변 복사')
  await button.click()
  await page.getByRole('button',{name:'표시 전환'}).click()
  await page.evaluate(()=>(window as unknown as {clip:Clip}).clip.resolve[4]())
  await page.getByRole('button',{name:'표시 전환'}).click()
  await expect(button).toHaveAccessibleName('답변 복사')
})

test('답변 교체는 열린 의견/투표/오류를 초기화하고 언어 변경은 초기화하지 않는다',async({page})=>{
  await page.goto(path)
  await page.locator('.client-answer-actions button').nth(1).click()
  await page.getByRole('button',{name:'기타',exact:true}).click()
  await page.locator('.fbt').fill('이 답변에만 속하는 의견')
  await language(page,'en'); await expect(page.locator('.fbt')).toHaveValue('이 답변에만 속하는 의견')
  await page.getByRole('textbox',{name:'답변 원문'}).fill('새 답변')
  await expect(page.locator('.client-answer-feedback')).toHaveCount(0)
  await expect(page.locator('.client-answer-actions button').nth(1)).toHaveAttribute('aria-pressed','false')
  await page.locator('.client-answer-actions button').nth(1).click()
  await page.getByRole('button',{name:'Other',exact:true}).click()
  await expect(page.locator('.fbt')).toHaveValue('')
})

test('동일 문장의 다른 답변은 이전 식별자의 늦은 복사 결과를 계승하지 않는다', async ({ page }) => {
  await page.goto(path); await clipboard(page)
  const identity = page.getByRole('button', { name: '답변 식별자 전환', exact: true })
  const copy = page.locator('.client-answer-actions button').nth(2)
  await identity.click()
  await copy.click()
  await identity.click()
  await page.evaluate(async () => {
    (window as unknown as { clip: Clip }).clip.resolve[0]()
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  // Sample after React commits, before the old 1.5s toast can auto-clear.
  expect(await copy.getAttribute('aria-label')).toBe('답변 복사')
  expect(await page.locator('.answer-copy-status').textContent()).toBe('')
  await copy.click()
  await page.evaluate(() => (window as unknown as { clip: Clip }).clip.resolve[1]())
  await expect(copy).toHaveAccessibleName('답변 복사 완료')
})

test('긴 실제 대화의 하단에서 의견 카드를 열면 선택과 입력을 바로 볼 수 있다', async ({ page }) => {
  await page.setViewportSize({ width:390, height:660 })
  await page.emulateMedia({ reducedMotion:'reduce' })
  await page.addInitScript(() => {
    const answer = Array.from({ length:30 }, (_,i) => `${i+1}. 답변 표시와 스크롤 검수용 문장입니다.`).join('\n')
    const turn = { id:'feedback-turn', question:'긴 답변 검수', answer, fullAnswer:answer, status:'done', startedAt:1, finishedAt:100, suggestions:[], phase:'plan' }
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name:'피드백 검수', email:'feedback@example.test' }))
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId:'feedback-session', homeDraft:'', sessions:[{ id:'feedback-session', title:'의견 카드 검수', renamed:true, idea:turn.question, draft:'작성 중인 질문', pair:'BTC/USDT', mode:'dip', phase:'plan', timeframe:'일봉', risk:'−3%', takeProfit:'+8%', workspace:'conversation', researchStatus:'초안', turns:[turn], updatedAt:1 }] }))
  })
  await page.goto('/')
  await page.getByRole('button',{ name:'아쉬운 답변',exact:true }).click()
  const panel=page.locator('.client-answer-feedback')
  // DOM visibility alone does not detect a focused control below the scrollport.
  await expect(panel.getByRole('button',{name:'사실과 다름',exact:true})).toBeInViewport({ratio:1})
  await panel.getByRole('button',{name:'기타',exact:true}).click()
  await expect(panel.getByRole('textbox')).toBeInViewport({ratio:1})
  await expect(panel.getByRole('button',{name:'제출',exact:true})).toBeInViewport({ratio:1})
  await expect(page.locator('.g-composer textarea')).toHaveValue('작성 중인 질문')
  await page.screenshot({path:'/tmp/teth-answer-feedback-conversation-390.png'})
})

test('낮은 화면에서 과거 답변의 의견을 닫으면 원래 버튼이 보이는 위치로 복귀한다', async ({page}) => {
  await page.setViewportSize({width:390,height:480})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(() => {
    const answer=Array.from({length:30},(_,i)=>`${i+1}. 이전 답변 및 후속 답변 위치 확인.`).join('\n')
    const turns=[1,2].map(n=>({id:`feedback-${n}`,question:`질문 ${n}`,answer,fullAnswer:answer,status:'done',startedAt:n,finishedAt:n+100,suggestions:[],phase:'plan'}))
    sessionStorage.setItem('teth-client-profile-preview',JSON.stringify({name:'복귀 검수',email:'return@example.test'}))
    sessionStorage.setItem('teth-client-experience',JSON.stringify({currentId:'return-session',homeDraft:'',sessions:[{id:'return-session',title:'이전 답변 복귀',renamed:true,idea:'질문 1',draft:'초안 유지',pair:'BTC/USDT',mode:'dip',phase:'plan',timeframe:'일봉',risk:'−3%',takeProfit:'+8%',workspace:'conversation',researchStatus:'초안',turns,updatedAt:1}]}))
  })
  await page.goto('/')
  const down=page.getByRole('button',{name:'아쉬운 답변',exact:true}).first()
  await down.click()
  const panel=page.locator('.client-answer-feedback')
  await panel.getByRole('button',{name:'기타',exact:true}).click()
  await panel.getByRole('textbox').fill('작성 내용 보존')
  await panel.getByRole('textbox').press('Escape')
  await expect(down).toBeFocused()
  await expect(down).toBeInViewport({ratio:1})
  await down.press('Enter')
  await panel.getByRole('button',{name:'기타',exact:true}).click()
  await expect(panel.getByRole('textbox')).toHaveValue('작성 내용 보존')
  await expect(page.locator('.g-composer textarea')).toHaveValue('초안 유지')
})

test('게스트 로그인 시 대화 원문은 유지하되 이전 임시 의견과 평가를 계승하지 않는다',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.addInitScript(()=>{
    const turn={id:'guest-turn',question:'원문 질문',answer:'원문 답변',fullAnswer:'원문 답변',status:'done',startedAt:1,finishedAt:100,suggestions:[],phase:'plan'}
    sessionStorage.setItem('teth-client-experience',JSON.stringify({currentId:'guest-session',homeDraft:'',sessions:[{id:'guest-session',title:'게스트 대화',renamed:true,idea:turn.question,draft:'질문 초안',pair:'BTC/USDT',mode:'dip',phase:'plan',timeframe:'일봉',risk:'−3%',takeProfit:'+8%',workspace:'conversation',researchStatus:'초안',turns:[turn],updatedAt:1}]}))
  })
  await page.goto('/')
  await page.getByRole('button',{name:'아쉬운 답변',exact:true}).click()
  await page.getByRole('button',{name:'기타',exact:true}).click()
  await page.locator('.client-answer-feedback textarea').fill('게스트 임시 의견')
  await page.locator((page.viewportSize()?.width??0)<=860?'.client-hamburger':'.client-rail-logo-row button').click()
  await page.getByRole('button',{name:'사이드바 로그인',exact:true}).click()
  await page.getByRole('button',{name:/Google/}).click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(page.locator('.client-answer-feedback')).toHaveCount(0)
  await expect(page.getByRole('button',{name:'아쉬운 답변',exact:true})).toHaveAttribute('aria-pressed','false')
  await expect(page.locator('.g-amsg').first()).toHaveText('원문 답변')
  // The client source explicitly sends a pending draft after guest login.
  // Preserve that handoff; clearing the draft is not loss when it became a turn.
  await expect(page.locator('.g-umsg').filter({hasText:'질문 초안'})).toHaveCount(1)
  await expect(page.locator('.g-composer textarea')).toHaveValue('')
})

test('긍정 평가도 접수로 오인되지 않도록 즉시 미연결을 안내하고 7언어를 따른다',async({page})=>{
  await page.goto(path)
  const button=page.locator('.client-answer-actions button').first()
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed','true')
  for(const lang of languages){
    await language(page,lang)
    await expect(page.locator('.answer-vote-status')).toHaveText(feedbackText(lang,'unavailable'))
  }
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed','false')
  await expect(page.locator('.answer-vote-status')).toHaveCount(0)
})

test('열린 부정 평가를 다시 누르면 선택을 취소할 수 있다',async({page})=>{
  await page.goto(path)
  const down=page.locator('.client-answer-actions button').nth(1)
  await down.click()
  await expect(down).toHaveAttribute('aria-pressed','true')
  await down.click()
  await expect(down).toHaveAttribute('aria-pressed','false')
  await expect(page.locator('.client-answer-feedback,.answer-vote-status')).toHaveCount(0)
})
