export const ZENDESK_SNIPPET_ID = 'ze-snippet'
export const ZENDESK_SNIPPET_ORIGIN = 'https://static.zdassets.com'
export const ZENDESK_SNIPPET_PATH = '/ekr/snippet.js'

export interface ClientHelpConfig { zendeskWidgetIdentifier: string | null }
type PublicHelpInput = { zendeskKey?: unknown }

/**
 * Zendesk's browser widget identifier is intentionally public: the browser
 * sends it in the snippet URL. Credentials, API tokens and private account
 * configuration must never use this input.
 */
export function validateZendeskWidgetIdentifier(value: unknown): string | null {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value)
    ? value
    : null
}

/** An explicit runtime own-property wins even when blank or invalid. */
export function resolveClientHelpConfig(
  runtime: unknown,
  buildZendeskWidgetIdentifier?: unknown,
): ClientHelpConfig {
  const config = runtime && typeof runtime === 'object' && !Array.isArray(runtime)
    ? runtime as PublicHelpInput
    : null
  const descriptor = config
    ? Object.getOwnPropertyDescriptor(config, 'zendeskKey')
    : undefined
  const selected = descriptor
    ? ('value' in descriptor ? descriptor.value : undefined)
    : buildZendeskWidgetIdentifier
  return { zendeskWidgetIdentifier: validateZendeskWidgetIdentifier(selected) }
}

export function readClientHelpConfig(): ClientHelpConfig {
  return resolveClientHelpConfig(
    typeof window === 'undefined' ? undefined : Reflect.get(window, 'TETH_CONFIG'),
    import.meta.env.VITE_TETH_ZENDESK_WIDGET_KEY,
  )
}

export function zendeskSnippetUrl(identifier: string): string {
  const validated = validateZendeskWidgetIdentifier(identifier)
  if (validated === null) throw new TypeError('PUBLIC_WIDGET_IDENTIFIER_INVALID')
  return `${ZENDESK_SNIPPET_ORIGIN}${ZENDESK_SNIPPET_PATH}?key=${encodeURIComponent(validated)}`
}
