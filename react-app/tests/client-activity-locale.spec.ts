import { expect, test, type Page } from '@playwright/test'

const original = {
  label: '작업 완료 — caller label',
  title: '생각하는 중 — caller title',
  detail: '완료 <script>원문 상세</script> & detail',
  publicSummary: '작업 설명 — 공개 요약 원문 / public summary',
}
const locales = [
  { language: 'ko', region: 'TETH 작업 과정', description: '작업 설명', duration: '5초', elapsed: '경과 시간 5초', states: ['진행 중', '완료', '실패', '중지됨'] },
  { language: 'en', region: 'TETH activity', description: 'Activity description', duration: '5s', elapsed: 'Elapsed time 5s', states: ['In progress', 'Complete', 'Failed', 'Stopped'] },
  { language: 'ja', region: 'TETHの作業過程', description: '作業の説明', duration: '5秒', elapsed: '経過時間 5秒', states: ['進行中', '完了', '失敗', '停止済み'] },
  { language: 'zh-CN', region: 'TETH任务过程', description: '任务说明', duration: '5秒', elapsed: '已用时间 5秒', states: ['进行中', '完成', '失败', '已停止'] },
  { language: 'zh-TW', region: 'TETH工作過程', description: '工作說明', duration: '5秒', elapsed: '經過時間 5秒', states: ['進行中', '完成', '失敗', '已停止'] },
  { language: 'es', region: 'Actividad de TETH', description: 'Descripción de la actividad', duration: '5 s', elapsed: 'Tiempo transcurrido 5 s', states: ['En curso', 'Completado', 'Fallido', 'Detenido'] },
  { language: 'fr', region: 'Activité de TETH', description: 'Description de l’activité', duration: '5 s', elapsed: 'Temps écoulé 5 s', states: ['En cours', 'Terminé', 'Échec', 'Arrêté'] },
] as const

async function mountActivity(page: Page) {
  await page.clock.install()
  await page.route('**/activity-locale-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' }))
  await page.goto('/activity-locale-fixture.html')
  await page.evaluate(async content => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientResearchActivity.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(componentPath)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('React dependency was not resolved')
    const reactModule = await import(/* @vite-ignore */ reactPath)
    const dom = await import(/* @vite-ignore */ domPath)
    const { ClientResearchActivity } = await import(/* @vite-ignore */ componentPath)
    const react = reactModule.default ?? reactModule
    const style = '/src/client-reference.css'
    await import(/* @vite-ignore */ style)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const startedAt = Date.now()
    const render = (status: 'running' | 'done' | 'failed' | 'stopped') => root.render(react.createElement(ClientResearchActivity, {
      label: content.label, status, startedAt,
      finishedAt: status === 'running' ? undefined : Date.now(), source: 'mock',
      steps: [
        { id: 'current', title: content.title, status, detail: content.detail, publicSummary: content.publicSummary },
        ...(['done', 'failed', 'stopped'] as const).map(state => ({ id: state, title: `원문 ${state}`, status: state })),
      ],
    }))
    Object.assign(window, { finishActivity: render })
    render('running')
  }, original)
  await expect(page.locator('.g-act2 .ar')).toHaveCount(4)
  await page.clock.fastForward(5_000)
}

async function selectLanguage(page: Page, language: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, language)
}

for (const locale of locales) test(`${locale.language}: 작업과정 UI만 언어 변경에 반응하고 전달된 원문과 실행 상태는 보존한다`, async ({ page }) => {
  await mountActivity(page)
  await selectLanguage(page, locale.language)
  const activity = page.getByRole('region', { name: locale.region, exact: true })
  await expect(activity).toBeVisible()
  await expect(activity).toHaveAttribute('data-source', 'mock')
  await expect(activity.locator('.els')).toHaveText(locale.duration)
  await expect(activity.locator('.els')).toHaveAttribute('aria-label', locale.elapsed)
  await expect(activity.locator('.am')).toHaveText([...locale.states])
  await expect(activity.locator('.hlb')).toHaveText(original.label)
  await expect(activity.getByRole('status')).toHaveText(original.label)
  await expect(activity.locator('.at').first()).toHaveText(original.title)
  await expect(activity.locator('.adin').first()).toHaveText(original.detail + original.publicSummary)
  await expect(activity.getByRole('region', { name: locale.description, exact: true })).toHaveText(original.publicSummary)
  await expect(activity.locator('script')).toHaveCount(0)
  await expect(activity.locator('.ar.running')).toHaveCount(1)
  await expect(activity.locator('.hd')).toHaveAttribute('aria-expanded', 'true')
  await expect(activity.locator('.arh').first()).toHaveAttribute('aria-expanded', 'true')
  await selectLanguage(page, locale.language === 'ko' ? 'en' : 'ko')
  await expect(activity).toHaveCount(0)
  await expect(page.locator('.g-act2 .ar.running')).toHaveCount(1)
  await expect(page.locator('.g-act2 .cot2')).toHaveText(original.publicSummary)
})

for (const [status, label] of [['done', 'Complete'], ['failed', 'Failed'], ['stopped', 'Stopped']] as const) test(`${status}: 언어 변경 후에도 종료 이벤트만 상태를 바꾸고 시간과 원문 기록을 보존한다`, async ({ page }) => {
  await mountActivity(page)
  await selectLanguage(page, 'en')
  await page.evaluate(value => Reflect.get(window, 'finishActivity')(value), status)
  const activity = page.locator('.g-act2')
  await expect(activity.locator('.hd')).toHaveAttribute('aria-expanded', 'false')
  await expect(activity.locator('.ar.running')).toHaveCount(0)
  await expect(activity.locator('.activity-logo')).toHaveCount(0)
  await expect(activity.locator('.am').first()).toHaveText(label)
  await page.clock.fastForward(60_000)
  await expect(activity.locator('.els')).toHaveText('5s')
  await activity.locator('.hd').click()
  await activity.locator('.arh').first().click()
  await expect(activity.getByRole('region', { name: 'Activity description' })).toHaveText(original.publicSummary)
  await expect(activity.locator('.adin').first()).toHaveText(original.detail + original.publicSummary)
  await selectLanguage(page, 'ko')
  await expect(activity.locator('.els')).toHaveText('5초')
  await expect(activity.locator('.ar').first()).toHaveClass(`ar ${status} think`)
  await expect(activity.getByRole('region', { name: '작업 설명' })).toHaveText(original.publicSummary)
  await expect(activity.locator('.hlb')).toHaveText(original.label)
})
