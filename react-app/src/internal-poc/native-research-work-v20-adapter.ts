import {
  TesiaResearchWorkV20Client,
  type ResearchWorkProjection,
  type ResearchWorkV20Transport,
} from './contracts/generated/api-v0.20/index.js'

const MAX_RESPONSE_BYTES = 262_144
const MAX_TARGET_BYTES = 2_048
const WORK_PATH = /^\/api\/v20\/consultation\/research-works\/[A-Za-z0-9_-]{16,128}$/

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    await response.body?.cancel().catch(() => undefined)
    throw new TypeError('API_V20_RESPONSE_TOO_LARGE')
  }
  if (response.body === null) throw new TypeError('API_V20_RESPONSE_BODY_REQUIRED')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = '', complete = false
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new TypeError('API_V20_RESPONSE_TOO_LARGE')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    complete = true
    return text
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** Same-origin transport for the generated observation-only API20 client. */
export class NativeResearchWorkV20Adapter {
  private readonly client: TesiaResearchWorkV20Client

  constructor(options: Readonly<{ fetch?: FetchPort; origin?: string }> = {}) {
    const fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    const origin = options.origin ?? window.location.origin
    const transport: ResearchWorkV20Transport = {
      request: async request => {
        const target = new URL(request.path, origin)
        if (target.origin !== origin || !WORK_PATH.test(target.pathname) || target.search || target.hash
          || new TextEncoder().encode(target.pathname).length > MAX_TARGET_BYTES) {
          throw new TypeError('API_V20_TARGET_INVALID')
        }
        const response = await fetchPort(target, {
          method: request.method,
          headers: request.headers,
          credentials: request.credentials,
          redirect: request.redirect,
          cache: request.cache,
          ...(request.signal === undefined ? {} : { signal: request.signal }),
        })
        return {
          status: response.status,
          headers: [...response.headers.entries()],
          body: await boundedText(response),
        }
      },
    }
    this.client = new TesiaResearchWorkV20Client(transport)
  }

  async read(researchWorkId: string, signal?: AbortSignal): Promise<ResearchWorkProjection> {
    const envelope = await this.client.get(
      researchWorkId,
      signal === undefined ? {} : { signal },
    )
    return envelope.data
  }
}

export { ApiV20Error } from './contracts/generated/api-v0.20/index.js'
export type { ResearchWorkProjection } from './contracts/generated/api-v0.20/index.js'
