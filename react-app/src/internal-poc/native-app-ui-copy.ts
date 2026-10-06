import type { ClientLanguage } from '../client-preferences'
import translations from './native-app-ui-copy.json'

type KnownCopy = keyof typeof translations
export function nativeAppUiText(language: ClientLanguage, original: KnownCopy): string {
  return language === 'ko' ? original : translations[original][language]
}

function knownCopy(original: string): original is KnownCopy {
  return Object.hasOwn(translations, original)
}

// Display-only adapter for the app's own normalized notices. It never changes
// stored state, error comparisons, request codes, or raw API/provider prose.
export function nativeAppNotice(language: ClientLanguage, original: string): string {
  if (language === 'ko') return original
  if (knownCopy(original)) return nativeAppUiText(language, original)
  const normalized = /^(AUTHENTICATION_REQUIRED|NOT_READY|SNAPSHOT_CHANGED|BINDING_CONFLICT|SOURCE_VERIFICATION_FAILED|REQUEST_UNCONFIRMED) · (.+)$/s.exec(original)
  if (normalized && knownCopy(normalized[2])) return normalized[1] + ' · ' + nativeAppUiText(language, normalized[2])
  const validationPrefix = '전략 검증 실패: '
  if (original.startsWith(validationPrefix)) {
    return nativeAppUiText(language, '전략 검증 실패: {codes}').replace('{codes}', () => original.slice(validationPrefix.length))
  }
  return original
}
