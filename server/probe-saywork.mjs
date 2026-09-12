// say/work 신규 프롬프트의 거절 A/B + 포맷 준수 게이트 (키는 .env 에서만, 미출력)
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const env = {}
for (const line of readFileSync(new URL('./.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}
const src = readFileSync('C:/Users/hyun1/OneDrive/바탕 화면/tesia-lab/src/prompts/teth-system.ts', 'utf8')
const SYSTEM = /export const TETH_SYSTEM_PROMPT = `([\s\S]*?)`\n\n\/\*/.exec(src)[1]
console.log('system chars:', SYSTEM.length)

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

async function probe(label, question, extra) {
  try {
    const response = await client.beta.messages.create({
      model: 'claude-fable-5', max_tokens: 4000,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: SYSTEM,
      messages: [{ role: 'user', content: question }],
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    })
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const says = (text.match(/<say>/g) ?? []).length
    const works = (text.match(/<work\b/g) ?? []).length
    const items = (text.match(/<item>/g) ?? []).length
    const startsWithSay = /^\s*<say>/.test(text)
    const models = [...text.matchAll(/<work model="([^"]*)"/g)].map(m => m[1])
    const firstIsOrchestrator = works < 2 || models[0] === 'claude-fable-5'
    const sayBodies = [...text.matchAll(/<say>([\s\S]*?)<\/say>/g)].map(m => m[1])
    const routeLeak = sayBodies.some(s => /사용합니다|claude-|gemini-|gpt-/.test(s))
    console.log(`[${label}] stop=${response.stop_reason} says=${says} works=${works} items=${items} startsSay=${startsWithSay} models=[${models.join(',')}] firstOrch=${firstIsOrchestrator} routeLeak=${routeLeak}`)
    console.log(`[${label}] head: ${text.slice(0, 160).replace(/\n/g, ' | ')}`)
    if (extra) extra(label, text)
  } catch (error) {
    console.log(`[${label}] ERROR ${error.status ?? ''} ${String(error.message).slice(0, 140)}`)
  }
}

const detail = (label, text) => {
  const asks = (text.match(/<ask>/g) ?? []).length
  const chips = /"action"\s*:\s*\[\s*\{/.test(text)
  const tables = (text.match(/\|---/g) ?? []).length
  console.log(`[${label}] asks=${asks} actionChip=${chips} tables=${tables}`)
}
await probe('ko-market', '비트코인 지금 사도 돼?', detail)
await probe('ask-trigger', '비트코인 반감기 사이클 내 시드에 맞춰서 알려줘. 궁금한 건 미리 질문하고 답해', detail)
await probe('concept-nochip', '달력 매매랑 추세 추종이 뭐가 달라?', detail)
