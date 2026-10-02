import { expect,test,type Page } from '@playwright/test'
import type { ClientSession,createClientExperienceStore } from '../src/client-experience-store'
import { revisionText } from '../src/client-common-revision-copy'
import { commonBacktestText } from '../src/client-common-backtest-copy'
import type { ClientLanguage } from '../src/client-preferences'
import { installCommonResponseFixture, publishCommonResponseFixture } from './fixtures/client-common-response-fixture'
type Store=ReturnType<typeof createClientExperienceStore>
const key='teth-client-experience'

async function ready(page:Page){await expect.poll(async()=>{await page.clock.runFor(200);return page.getByTestId('common-backtest').count()}).toBe(1)}
async function result(page:Page){
  await installCommonResponseFixture(page,'revision@example.test')
  await page.clock.install({time:new Date('2026-10-01T00:00:00Z')})
  await page.addInitScript(()=>{localStorage.setItem('tethLang','ko');sessionStorage.setItem('teth-client-profile-preview',JSON.stringify({name:'수정 검수',email:'revision@example.test'}))})
  await page.goto('/');await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000))
  await page.locator('#strategy-idea').fill('BTC 반등 일봉 손절 3%, 익절 8%');await page.locator('#strategy-idea').press('Enter');await page.clock.fastForward(20_000)
  await publishCommonResponseFixture(page)
  await page.getByRole('button',{name:'과거로 돌려 보기',exact:true}).click();await ready(page)
  await page.getByRole('button',{name:'최근 1년',exact:true}).click()
  await page.getByRole('group',{name:'시작 금액',exact:true}).getByRole('button',{name:'$3,000',exact:true}).click()
  await page.getByRole('button',{name:'과거를 다시 돌려 보기',exact:true}).click();await page.clock.fastForward(65_000)
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','result')
}
async function snapshot(page:Page){return page.evaluate(key=>{const s=JSON.parse(sessionStorage.getItem(key)!);return s.sessions.find((x:ClientSession)=>x.id===s.currentId) as ClientSession},key)}

test('result returns to its conversation, proposes one change and reruns with the same money and period, compares and reverts',async({page},info)=>{
  await result(page)
  const before=await snapshot(page)
  await page.getByRole('button',{name:'규칙 수정하기',exact:true}).click()
  expect((await snapshot(page)).id).toBe(before.id)
  await expect(page.getByTestId('common-revision-direction')).toBeVisible()
  await expect(page.getByTestId('common-revision')).toHaveCount(0)
  await page.getByRole('button',{name:'파는 조건 넓히기',exact:true}).click()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await page.clock.fastForward(20_000)
  const proposal=page.getByTestId('common-revision').last()
  await expect(proposal).toContainText('8%');await expect(proposal).toContainText('11%')
  await page.locator('.g-composer textarea').fill('작성하던 질문은 그대로')
  await page.screenshot({path:info.outputPath('revision-proposal.png')})
  await proposal.getByRole('button',{name:'수정한 규칙으로 다시 검증하기',exact:true}).click();await ready(page)
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','run')
  const applied=await snapshot(page)
  expect(applied.commonBacktest?.period).toBe(365);expect(applied.commonBacktest?.amount).toBe(3000)
  expect(applied.turns[0]).toEqual(before.turns[0])
  expect(applied.turns.at(-1)?.inlineRequest?.parameters.tp).toBe(11)
  expect(applied.draft).toBe('작성하던 질문은 그대로')
  await page.clock.fastForward(65_000)
  const comparison=page.getByTestId('common-revision-comparison')
  await expect(comparison.getByRole('table')).toBeVisible()
  await page.clock.runFor(1000)
  const plot=page.locator('.cbt-chart-plot'),pin=page.locator('.cbt-chart-pin circle')
  await plot.focus();await page.keyboard.press('Home');await page.keyboard.press('Enter');await page.clock.runFor(200)
  await expect(pin).toHaveAttribute('cx',/\d/)
  const firstX=Number(await pin.getAttribute('cx'))
  expect(firstX).toBeGreaterThanOrEqual(0);expect(firstX).toBeLessThan(15)
  await plot.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await page.clock.runFor(200)
  const lastX=Number(await pin.getAttribute('cx')),width=(await plot.boundingBox())!.width
  expect(lastX).toBeGreaterThan(width*.7);expect(lastX).toBeLessThan(width)
  await expect(comparison).toContainText('같은 기간, 같은 시작 금액, 같은 가격 자료')
  await comparison.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('revision-comparison.png')})
  await page.reload();await ready(page)
  await expect(comparison.getByRole('table')).toBeVisible()
  await comparison.getByRole('button',{name:'이전 규칙으로 돌아가기'}).click();await page.clock.fastForward(65_000)
  const reverted=await snapshot(page)
  expect(reverted.turns.at(-1)?.inlineRequest).toEqual(before.turns[0].inlineRequest)
  expect(reverted.commonBacktest?.period).toBe(365);expect(reverted.commonBacktest?.amount).toBe(3000)
  await expect(comparison.getByRole('table')).toBeVisible()
})

test('f5070e0 result returns to the same conversation without creating a new strategy',async({page})=>{
  await result(page);const before=await snapshot(page)
  await expect(page.getByRole('button',{name:'다른 전략 만들기',exact:true})).toHaveCount(0)
  await page.locator('.rv-links').getByRole('button',{name:'대화로 돌아가기',exact:true}).click()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  const next=await snapshot(page)
  expect(next.id).toBe(before.id);expect(next.turns).toEqual(before.turns)
  expect(next.commonBacktest).toEqual(before.commonBacktest);expect(next.draft).toBe(before.draft)
  await page.getByRole('button',{name:'이어서 보기',exact:true}).click();await ready(page)
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','result')
  expect((await snapshot(page)).commonBacktest).toEqual(before.commonBacktest)
})

async function storeFixture(page:Page){
  await page.route('**/revision-store.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Revision store test</title>'}))
  await page.goto('/revision-store.html')
  await page.evaluate(async()=>{
    const path='/src/client-experience-store.ts', {createClientExperienceStore}=await import(path)
    let now=Date.now();Date.now=()=>now
    const store=createClientExperienceStore();store.send('BTC 반등 일봉 손절 3%, 익절 8%');now+=20_000;store.tick(now)
    const session=store.getSnapshot().sessions[0],turn=session.turns[0]
    store.commonBacktest(session.id,{turnId:turn.id,period:365,amount:3000,startedAt:now,skipped:true})
    Reflect.set(window,'revisionStore',store);Reflect.set(window,'advanceRevision',()=>{now+=20_000;store.tick(now)})
  })
}

test('stale, duplicate and cross-owner proposals cannot overwrite a result',async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(()=>{
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0],state=s.commonBacktest!
    const id=store.startCommonRevision(s.id,state,'owner-a','수정','조건 하나를 비교합니다.')
    Reflect.get(window,'advanceRevision')()
    let wrong=false;try{store.applyCommonRevision(s.id,id,'owner-b','적용')}catch{wrong=true}
    const good=store.applyCommonRevision(s.id,id,'owner-a','적용'),saved=JSON.stringify(store.getSnapshot())
    let duplicate=false,stale=false
    try{store.applyCommonRevision(s.id,id,'owner-a','적용')}catch{duplicate=true}
    try{store.startCommonRevision(s.id,state,'owner-a','수정','수정')}catch{stale=true}
    return {wrong,duplicate,stale,unchanged:saved===JSON.stringify(store.getSnapshot()),good}
  })
  expect(out).toMatchObject({wrong:true,duplicate:true,stale:true,unchanged:true});expect(out.good).toBeTruthy()
})

for(const failure of ['throw','drop'] as const)test(`revision ${failure} write does not publish or lose original conditions`,async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(failure=>{
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0],before=store.getSnapshot(),raw=sessionStorage.getItem('teth-client-experience')
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='teth-client-experience'){if(failure==='throw')throw new Error('test');return}set.call(this,k,v)}
    let rejected=false;try{store.startCommonRevision(s.id,s.commonBacktest!,null,'수정','비교합니다.')}catch{rejected=true}
    Storage.prototype.setItem=set
    return {rejected,same:before===store.getSnapshot(),raw:raw===sessionStorage.getItem('teth-client-experience')}
  },failure)
  expect(out).toEqual({rejected:true,same:true,raw:true})
})

for(const mode of ['retry','continue'] as const)test(`${mode} preserves the proposal and rejects a different owner`,async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(async mode=>{
    const path='/src/client-experience-store.ts',{createClientExperienceStore}=await import(path)
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    const id=store.startCommonRevision(s.id,s.commonBacktest!,'owner-a','수정 요청','조건 하나를 비교합니다. 더 좋은 결과를 보장하지 않습니다.')
    store.stop(s.id)
    const saved=JSON.parse(sessionStorage.getItem('teth-client-experience')!)
    if(mode==='continue')saved.sessions[0].turns.at(-1).answer='조건 하나를 비교합니다.'
    sessionStorage.setItem('teth-client-experience',JSON.stringify(saved))
    const next=createClientExperienceStore() as Store,prior=next.getSnapshot().sessions[0].turns.at(-1)!
    const run=(owner:string)=>mode==='retry'?next.retryPreview(s.id,id,owner,{question:prior.question,binding:{scopeId:JSON.stringify([owner,s.id]),messageId:id,observationId:`${id}:stopped`}})
      :next.continuePreview(s.id,id,owner,{partialText:prior.answer,prompt:'방금 끊긴 답변을 이어서 계속 작성해줘',binding:{scopeId:JSON.stringify([owner,s.id]),messageId:id,observationId:`${id}:interrupted`}})
    const wrong=run('owner-b'),accepted=run('owner-a'),retry=next.getSnapshot().sessions[0].turns.at(-1)!
    next.tick(Date.now()+20_000)
    const restored=createClientExperienceStore() as Store,final=restored.getSnapshot().sessions[0]
    const applied=restored.applyCommonRevision(s.id,retry.id,'owner-a','적용')
    return {wrong,accepted,original:final.turns.find(t=>t.id===id),prior,metadata:retry.commonRevision,expected:prior.commonRevision,
      restored:final.turns.at(-1)?.commonRevision,applied,tp:restored.getSnapshot().sessions[0].turns.at(-1)?.inlineRequest?.parameters.tp}
  },mode)
  expect(out.wrong).toBe(false);expect(out.accepted).toBe(true)
  expect(out.original).toEqual(out.prior);expect(out.metadata).toEqual(out.expected);expect(out.restored).toEqual(out.expected)
  expect(out.applied).toBeTruthy();expect(out.tp).toBe(11)
})

for(const operation of ['apply','revert'] as const)for(const failure of ['throw','drop'] as const)test(`${operation} ${failure} retains the original result and proposal`,async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(({operation,failure})=>{
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    const id=store.startCommonRevision(s.id,s.commonBacktest!,null,'수정','조건을 비교합니다.');Reflect.get(window,'advanceRevision')()
    if(operation==='revert'){
      store.applyCommonRevision(s.id,id,null,'적용')
      const current=store.getSnapshot().sessions[0]
      store.commonBacktest(s.id,{...current.commonBacktest!,skipped:true})
    }
    const before=store.getSnapshot(),raw=sessionStorage.getItem('teth-client-experience')
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='teth-client-experience'){if(failure==='throw')throw new Error('test');return}set.call(this,k,v)}
    let rejected=false;try{if(operation==='apply')store.applyCommonRevision(s.id,id,null,'적용');else store.revertCommonRevision(s.id,store.getSnapshot().sessions[0].commonBacktest!,null,'복원')}catch{rejected=true}
    Storage.prototype.setItem=set
    return {rejected,same:before===store.getSnapshot(),raw:raw===sessionStorage.getItem('teth-client-experience')}
  },{operation,failure})
  expect(out).toEqual({rejected:true,same:true,raw:true})
})

test('changed period or capital cannot be presented as an equal comparison',async({page})=>{
  await storeFixture(page)
  const flags=await page.evaluate(async()=>{
    const path='/src/client-common-revision.ts',{commonRevisionComparison}=await import(path)
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    const id=store.startCommonRevision(s.id,s.commonBacktest!,null,'수정','조건을 비교합니다.');Reflect.get(window,'advanceRevision')()
    store.applyCommonRevision(s.id,id,null,'적용')
    const next=store.getSnapshot().sessions[0],base=next.commonBacktest!
    return [commonRevisionComparison(next)?.same,
      commonRevisionComparison({...next,commonBacktest:{...base,period:730}})?.same,
      commonRevisionComparison({...next,commonBacktest:{...base,amount:1000}})?.same]
  })
  expect(flags).toEqual([true,false,false])
})

test('revert restores the prior period and amount even after a different-period run',async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(()=>{
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    const id=store.startCommonRevision(s.id,s.commonBacktest!,null,'수정','조건을 비교합니다.');Reflect.get(window,'advanceRevision')()
    store.applyCommonRevision(s.id,id,null,'적용')
    store.commonBacktest(s.id,{...store.getSnapshot().sessions[0].commonBacktest!,period:730,amount:1000,skipped:true})
    store.revertCommonRevision(s.id,store.getSnapshot().sessions[0].commonBacktest!,null,'이전 규칙')
    return store.getSnapshot().sessions[0].commonBacktest
  })
  expect(out).toMatchObject({period:365,amount:3000})
})

for(const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as ClientLanguage[])
for(const view of [{width:320,zoom:1},{width:1440,zoom:1},{width:1440,zoom:2}])test(`${language} ${view.width} ${view.zoom} proposal and history stay readable and interactive`,async({page},info)=>{
  await page.clock.install()
  await storeFixture(page)
  await page.setViewportSize({width:view.width,height:1000});await page.emulateMedia({reducedMotion:'reduce'})
  await page.evaluate(language=>{
    localStorage.setItem('tethLang',language)
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    store.startCommonRevision(s.id,s.commonBacktest!,null,'수정 요청','조건 하나를 비교합니다.');Reflect.get(window,'advanceRevision')()
  },language)
  // The isolated store advances Date.now to finish its prepared response.
  // Keep that same observation time when navigating into the real React host.
  await page.clock.setFixedTime(new Date(await page.evaluate(()=>Date.now())))
  await page.goto('/')
  await page.locator('body').evaluate((el,zoom)=>{el.style.zoom=String(zoom)},view.zoom)
  const proposal=page.getByTestId('common-revision').last(),r=(k:Parameters<typeof revisionText>[1])=>revisionText(language,k)
  await expect(proposal.getByRole('heading')).toHaveText(r('proposal'))
  const other=proposal.getByRole('button',{name:r('other'),exact:true}),composer=page.locator('.g-composer textarea')
  await composer.fill('My unchanged draft');await other.click();await expect(composer).toHaveValue('My unchanged draft');await expect(composer).toBeFocused()
  const contextCard=page.getByTestId('common-result-context').last()
  await expect(contextCard.locator('.rv-kv small').last()).toHaveText(r('count'))
  expect((await contextCard.boundingBox())!.width).toBeGreaterThan(Math.min(220,view.width-100))
  expect(await contextCard.locator('.rv-kv i').evaluateAll(nodes=>nodes.every(node=>{
    const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length===1
  }))).toBe(true)
  if(language==='fr'){
    await contextCard.scrollIntoViewIfNeeded()
    await page.screenshot({path:info.outputPath('context-full-viewport-fr.png')})
    if(view.width===1440){
      await expect.poll(async()=>{
        const nav=(await page.locator('.client-auth-nav').boundingBox())!,scroll=(await page.locator('.g-scroll').boundingBox())!
        return scroll.y>=nav.y+nav.height
      }).toBe(true)
    }
  }
  expect(await proposal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await proposal.getByText(r('rules'),{exact:true}).click();await expect(proposal.locator('.rv-rules')).toBeVisible()
  if(language==='fr')await proposal.screenshot({path:info.outputPath('proposal-fr.png')})
  await proposal.getByRole('button',{name:r('apply'),exact:true}).click()
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','result')
  const comparison=page.getByTestId('common-revision-comparison')
  await expect(comparison.getByRole('table')).toBeVisible();await expect(comparison.locator('.rv-sum')).not.toBeEmpty()
  await comparison.locator('summary').last().click();await expect(comparison.locator('.rv-history time')).toBeVisible()
  await expect(comparison.locator('.rv-history')).toContainText('USD');await expect(comparison.locator('.rv-history')).toContainText(r('count'))
  expect(await comparison.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  expect(await comparison.locator('td').evaluateAll(cells=>cells.every(cell=>{
    const range=document.createRange();range.selectNodeContents(cell)
    return range.getClientRects().length===1
  }))).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  if(language==='fr')await comparison.screenshot({path:info.outputPath('comparison-fr.png')})
  await comparison.getByRole('button',{name:r('revert'),exact:true}).click()
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','result')
  expect((await snapshot(page)).turns.at(-1)?.inlineRequest?.parameters.tp).toBe(8)
})

test('corrupt source, data and multi-field metadata are quarantined without discarding messages',async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(async()=>{
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    store.startCommonRevision(s.id,s.commonBacktest!,null,'수정 원문','비교합니다.');Reflect.get(window,'advanceRevision')()
    const original=sessionStorage.getItem('teth-client-experience')!,path='/src/client-experience-store.ts',{createClientExperienceStore}=await import(path),rows=[]
    for(const kind of ['data','turn','multiple','pair','period']){
      const saved=JSON.parse(original),revision=saved.sessions[0].turns.at(-1).commonRevision
      if(kind==='data')revision.dataRevision='other';if(kind==='turn')revision.base.turnId='other'
      if(kind==='multiple')revision.proposal.parameters.sl=-8;if(kind==='pair')revision.proposal.pair='ETH/USDT';if(kind==='period')revision.base.amount=1
      sessionStorage.setItem('teth-client-experience',JSON.stringify(saved))
      const restored=createClientExperienceStore().getSnapshot(),last=restored.sessions[0].turns.at(-1)!
      rows.push({warning:restored.recoveryWarning,text:last.question,invalid:last.commonRevisionInvalid,proposal:last.commonRevision})
    }
    return rows
  })
  for(const row of out)expect(row).toEqual({warning:true,text:'수정 원문',invalid:true,proposal:undefined})
})

test('new conversation context survives deleting the origin and quarantines invalid metadata without losing its text',async({page})=>{
  await storeFixture(page)
  const out=await page.evaluate(async()=>{
    const path='/src/client-experience-store.ts',{createClientExperienceStore}=await import(path)
    const store=Reflect.get(window,'revisionStore') as Store,s=store.getSnapshot().sessions[0]
    const id=store.startCommonAlternative(s.id,s.commonBacktest!,null,'원 결과를 보고 다른 방식을 생각해 볼게요')
    const context=store.getSnapshot().sessions.find(x=>x.id===id)!.turns[0].commonResultContext
    store.remove(s.id)
    const reloaded=createClientExperienceStore() as Store,preserved=reloaded.getSnapshot().sessions.find(x=>x.id===id)!
    const original=sessionStorage.getItem('teth-client-experience')!,rows=[]
    for(const kind of ['owner','input','revision','amount','title','marker']){
      const raw=JSON.parse(original),turn=raw.sessions.find((x:ClientSession)=>x.id===id).turns[0]
      if(kind==='owner')turn.commonResultContext.owner=45
      if(kind==='input')turn.commonResultContext.input.parameters.sl=4
      if(kind==='revision')turn.commonResultContext.dataRevision='other'
      if(kind==='amount')turn.commonResultContext.amount=4
      if(kind==='title')turn.commonResultContext.title={html:'wrong'}
      if(kind==='marker')turn.commonResultContextInvalid=true
      sessionStorage.setItem('teth-client-experience',JSON.stringify(raw))
      const value=(createClientExperienceStore() as Store).getSnapshot()
      const last=value.sessions.find(x=>x.id===id)!.turns[0]
      rows.push({warning:value.recoveryWarning,invalid:last.commonResultContextInvalid,text:last.question,context:last.commonResultContext})
    }
    return {context,preserved:preserved.turns[0].commonResultContext,rows}
  })
  expect(out.preserved).toEqual(out.context)
  for(const row of out.rows)expect(row).toEqual({warning:true,invalid:true,text:'원 결과를 보고 다른 방식을 생각해 볼게요',context:undefined})
})

for(const kind of ['none','bad','good'] as const)for(const copied of [false,true])test(`${kind} ${copied?'copied':'owned'} result keeps source action order and carries facts to its next conversation`,async({page},info)=>{
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url())})
  await page.clock.install();await storeFixture(page)
  await page.evaluate(async({kind,copied})=>{
    const path='/src/client-common-backtest-preview.ts',{commonBacktestInput,commonPreviewResult}=await import(path)
    const store=Reflect.get(window,'revisionStore') as Store,raw=structuredClone(store.getSnapshot()),s=raw.sessions[0]
    if(kind==='none')s.turns[0].inlineRequest!.parameters.rsiTh=0
    if(kind==='good'){
      let found=false
      // Select a deterministic UI branch fixture, never product optimization.
      search:for(const period of [90,365,730])for(const rsiTh of [20,40,60,80])for(const sl of [-1,-5,-12])for(const tp of [4,12,25]){
        s.commonBacktest!.period=period as 90|365|730
        Object.assign(s.turns[0].inlineRequest!.parameters,{rsiTh,sl,tp})
        const evaluated=commonPreviewResult(commonBacktestInput(s)!)
        if(evaluated.evaluation.trades.length&&evaluated.evaluation.pnl>=0&&evaluated.evaluation.nav>=evaluated.points.at(-1)!.benchmark){found=true;break search}
      }
      if(!found)throw new Error('No positive fixture')
    }
    if(copied){s.sharedCopy={owner:'branch@example.test',nick:'source-branch-fixture',confirmedAt:Date.now(),returnId:null,active:false}
      sessionStorage.setItem('teth-client-profile-preview',JSON.stringify({name:'분기 검수',email:'branch@example.test'}))}
    sessionStorage.setItem('teth-client-experience',JSON.stringify(raw));localStorage.setItem('tethLang','ko')
  },{kind,copied})
  await page.clock.setFixedTime(new Date(await page.evaluate(()=>Date.now())));await page.goto('/#/share/bt/mine')
  await expect(page.getByTestId('common-backtest')).toHaveAttribute('data-phase','result')
  // Scope remains explicit even if the source rail tag/class changes.
  const actions=page.getByTestId('common-backtest').locator('.rv-actions').first()
  await expect(actions.locator('button').first()).toHaveText(kind==='good'||copied?'이 전략 실행하기':'규칙 수정하기')
  await expect(page.getByRole('button',{name:'규칙 수정하기',exact:true})).toHaveCount(copied?0:1)
  if(kind==='none')await expect(page.locator('.rv-note')).toContainText('거래가 한 번도 없어')
  if(copied)await expect(page.locator('.rv-why')).toContainText('복사한 공개 전략')
  // This opens the connection plan; it does not place an order or mark an account connected.
  await expect(page.getByRole('button',{name:'이 전략 실행하기',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'이 전략 실행하기',exact:true})).toHaveClass(copied||kind==='good'?'cbt-primary':'cbt-secondary')
  if (kind === 'good' && !copied) {
    const links = actions.locator('.rv-links')
    await expect(links).toHaveCount(1)
    await expect(links.getByRole('button')).toHaveText(['규칙 수정하기', '대화로 돌아가기'])
    await expect(links.locator('i')).toHaveAttribute('aria-hidden', 'true')
    await expect(links.getByRole('button').first()).not.toHaveClass(/cbt-primary/)
    const boxes = await links.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y))
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThanOrEqual(1)
    const originalViewport = page.viewportSize()!
    for (const zoom of [1, 2]) for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as ClientLanguage[]) {
      // Keep the effective layout >=320 CSS px, including the emulated phone.
      await page.setViewportSize({ width: Math.max(originalViewport.width, 320 * zoom), height: originalViewport.height })
      await page.evaluate(async ({ language, zoom }) => {
        const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language)
        document.body.style.zoom = String(zoom)
      }, { language, zoom })
      const fix = links.getByRole('button', { name: revisionText(language, 'fix'), exact: true })
      const back = links.getByRole('button', { name: commonBacktestText(language, 'back'), exact: true })
      await expect(fix).toBeVisible()
      await fix.scrollIntoViewIfNeeded()
      await fix.focus(); await page.keyboard.press('Tab'); await expect(back).toBeFocused()
      expect(await links.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      for (const button of [fix, back]) {
        expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true)
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43 * zoom)
        await button.scrollIntoViewIfNeeded()
        expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return [.1,.5,.9].every(y => document.elementFromPoint(r.x+r.width/2,r.y+r.height*y)?.closest('button') === el) })).toBe(true)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if (language === 'fr') await page.screenshot({ path: info.outputPath(`result-links-fr-${zoom}.png`) })
    }
    await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', 'ko'); document.body.style.zoom = '1' })
    await page.setViewportSize(originalViewport)
  }
  const before=await snapshot(page)
  await expect(page.getByRole('button',{name:'다른 전략 만들기',exact:true})).toHaveCount(0)
  await actions.getByRole('button',{name:copied?'다른 전략 둘러보기':'대화로 돌아가기',exact:true}).click()
  if(copied)await expect(page).toHaveURL(/#\/share(?:\?|$)/)
  else await expect(page.locator('.g-composer textarea')).toBeVisible()
  const next=await snapshot(page)
  expect(next.id).toBe(before.id);expect(next.turns).toEqual(before.turns)
  expect(next.commonBacktest).toEqual(before.commonBacktest)
  expect(next.sharedCopy).toEqual(before.sharedCopy);expect(writes).toEqual([])
})
