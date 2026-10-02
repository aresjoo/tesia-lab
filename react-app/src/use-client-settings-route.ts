import { useEffect, useRef, useState } from 'react'
import { clientSettingsHash, readClientSettingsLocation, type ClientSettingsTab } from './client-settings-navigation'
import { pushSiteLocation, useSiteLocation } from './site-navigation'

export function closeClientSettingsRoute(restoreFocus = false) {
  if (!readClientSettingsLocation()) return
  // Preserve the native host on reload instead of falling into the legacy adapter.
  const hostHash = location.pathname.endsWith('/internal-poc.html') ? '#/native-client' : ''
  pushSiteLocation(location.pathname + location.search + hostHash)
  if (!restoreFocus) return
  const destination = location.href
  requestAnimationFrame(() => {
    // A later navigation/user action owns focus; don't pull it back.
    if (location.href !== destination) return
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body && active.id !== 'tesia-main' && !active.closest('.client-settings-page')) return
    // A comma selector returns DOM order, which puts the sidebar before the
    // composer. Preserve explicit context-first priority instead.
    const target = ['.g-composer textarea', '#strategy-idea', '#tesia-main', '.client-hamburger', '.client-sidebar-bottom button']
      .flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)])
      .find(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden],[inert]') && !el.matches(':disabled'))
    target?.focus({ preventScroll: true })
  })
}

export function openClientSettings(tab: ClientSettingsTab = 'general') {
  pushSiteLocation(location.pathname + location.search + clientSettingsHash(tab))
}

export function useClientSettingsRoute({ signedIn, ready = true, onLogin }: { signedIn: boolean; ready?: boolean; onLogin: () => void }) {
  const href = useSiteLocation(true)
  const hash = new URL(href, location.origin).hash
  const parsed = readClientSettingsLocation(hash)
  // The mobile list hides, rather than destroys, the current detail/editor.
  // A fresh list URL still starts with general; no account data is stored here.
  const [lastDetail, setLastDetail] = useState<ClientSettingsTab>('general')
  if (parsed && hash !== '#/settings' && parsed !== lastDetail) setLastDetail(parsed)
  const tab = hash === '#/settings' ? lastDetail : parsed ?? (signedIn && hash === '#/plan' ? 'billing' : null)
  const login = useRef(onLogin)
  const wasSignedIn = useRef(signedIn)
  const requestedLogin = useRef<string | null>(null)
  useEffect(() => { login.current = onLogin }, [onLogin])
  useEffect(() => {
    if (!ready) return
    const sessionEnded = wasSignedIn.current && !signedIn
    wasSignedIn.current = signedIn
    if (!tab) { requestedLogin.current = null; return }
    if (!signedIn) {
      // The route is a presentation intent, never authentication authority.
      // Keep it through login, but cancellation explicitly clears it in both
      // hosts. No account surface is rendered until the host authenticates.
      if (sessionEnded) { requestedLogin.current = null; closeClientSettingsRoute(); return }
      // A completed logout or lost session belongs to the host's recovery
      // screen. Reopening login here can clear its confirmed outcome/error.
      if (requestedLogin.current !== hash) { requestedLogin.current = hash; login.current() }
    } else if (hash === '#/plan') {
      // Only the exact legacy plan entry redirects. Alerts/rebates are distinct.
      history.replaceState(history.state, '', location.pathname + location.search + clientSettingsHash('billing'))
      window.dispatchEvent(new Event('teth:navigate'))
    } else requestedLogin.current = null
  }, [tab, hash, signedIn, ready])
  return ready && signedIn ? tab : null
}
