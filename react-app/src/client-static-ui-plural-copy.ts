import type { ClientLanguage } from './client-preferences'
import dictionary from './client-static-ui-plural-copy.json' with { type: 'json' }

/** Singular variants for explicit UI templates only. Other counts and all
 * unregistered/user/API text keep their existing presentation. */
export function singularUiTemplate(language: ClientLanguage, source: string, values: Readonly<Record<string, unknown>>): string | undefined {
  if (!['en', 'es', 'fr'].includes(language) || !Object.hasOwn(dictionary, source)) return undefined
  const row = dictionary[source as keyof typeof dictionary]
  const value = values[row.parameter]
  return (typeof value === 'number' || typeof value === 'string') && Number(value) === 1
    ? row[language as 'en' | 'es' | 'fr'] : undefined
}
