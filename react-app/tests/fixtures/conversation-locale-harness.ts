import { setClientPreference, type ClientLanguage } from '../../src/client-preferences'

// Test-only bridge: the normal Main root and its preference subscription stay intact.
// Static import resolves to the same /src/client-preferences.ts module as Main.
Reflect.set(window, 'conversationLocaleHarness', {
  setLanguage: (language: ClientLanguage) => setClientPreference('language', language),
})
