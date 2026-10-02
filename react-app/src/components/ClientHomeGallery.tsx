import { memo, useEffect, useId, useState, type CSSProperties } from 'react'
import { CLIENT_HOME_ACTIONS, CLIENT_HOME_ASSETS, HOME_TEMPLATE_MAX, normalizeTemplateSelection, toggleTemplateSelection, type HomeTemplateAction, type HomeTemplateAsset, type HomeTemplateSelection } from '../client-home-gallery'
import '../client-home-gallery.css'
import { useClientPreferences } from '../client-preferences'
import { homeTemplateLabel, shellText } from '../client-shell-copy'

type SelectionProps = { selection: HomeTemplateSelection; onChange: (selection: HomeTemplateSelection) => void; disabled?: boolean }

// SVG geometry is preserved from tfTplArt, not replaced by generic icon art.
function TemplateArt({ id }: { id: string }) {
  const uid = useId()
  const accent = '#5b8af7', line = 'rgba(255,255,255,.72)', muted = 'rgba(255,255,255,.28)', sub = 'rgba(255,255,255,.14)'
  return <svg viewBox="0 0 220 124" width="220" height="124" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1c21" /><stop offset="1" stopColor="#141519" /></linearGradient></defs>
    <rect width="220" height="124" fill={`url(#${uid})`} /><path d="M18 84H202" stroke={sub} strokeWidth="1" />
    {id === 'auto' && <><path d="M30 72C58 66 74 44 98 46C122 48 138 66 166 58" fill="none" stroke={line} strokeWidth="2" strokeLinecap="round" /><path d="M166 58H190" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 6" /><circle cx="166" cy="58" r="10" fill="none" stroke={accent} strokeWidth="2" /><circle cx="166" cy="58" r="3.5" fill={accent} /></>}
    {id === 'ind' && <><path d="M32 56C58 40 88 62 116 48C142 36 162 50 188 42" fill="none" stroke={line} strokeWidth="2" strokeLinecap="round" /><path d="M32 70H188" stroke={muted} strokeWidth="1.5" strokeDasharray="3 5" /><path d="M32 30H188" stroke={muted} strokeWidth="1.5" strokeDasharray="3 5" /><circle cx="116" cy="48" r="3.5" fill={accent} /><circle cx="116" cy="48" r="8" fill="none" stroke={accent} strokeWidth="1.5" opacity=".45" /></>}
    {id === 'rank' && <><path d="M66 34H176" stroke={accent} strokeWidth="7" strokeLinecap="round" /><path d="M66 52H148" stroke={muted} strokeWidth="7" strokeLinecap="round" /><path d="M66 70H120" stroke={muted} strokeWidth="7" strokeLinecap="round" /><text x="46" y="38" fontFamily="inherit" fontSize="11" fontWeight="600" fill={line}>1</text><text x="46" y="56" fontFamily="inherit" fontSize="11" fontWeight="600" fill={muted}>2</text><text x="46" y="74" fontFamily="inherit" fontSize="11" fontWeight="600" fill={muted}>3</text></>}
    {id === 'anal' && <g strokeLinecap="round"><path d="M76 30V78" stroke={muted} strokeWidth="1.5" /><rect x="70" y="42" width="12" height="22" rx="2" fill="none" stroke={line} strokeWidth="1.5" /><path d="M104 26V82" stroke={muted} strokeWidth="1.5" /><rect x="98" y="36" width="12" height="30" rx="2" fill="none" stroke={line} strokeWidth="1.5" /><path d="M132 34V74" stroke={accent} strokeWidth="1.5" /><rect x="126" y="44" width="12" height="20" rx="2" fill={accent} fillOpacity=".2" stroke={accent} strokeWidth="1.5" /><path d="M160 30V70" stroke={muted} strokeWidth="1.5" /><rect x="154" y="38" width="12" height="22" rx="2" fill="none" stroke={line} strokeWidth="1.5" /></g>}
    {id === 'port' && <><circle cx="110" cy="52" r="26" fill="none" stroke={muted} strokeWidth="7" /><path d="M110 26a26 26 0 0 1 24.6 17.7" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" /><circle cx="110" cy="52" r="14" fill="none" stroke={sub} strokeWidth="1" /></>}
  </svg>
}

function TemplateThumb({ item, lazy = false }: { item: HomeTemplateAction | HomeTemplateAsset; lazy?: boolean }) {
  return 'img' in item ? <span className="timg" style={{ background: item.bg }}><img className={item.inv ? 'inv' : undefined} src={item.img} alt="" loading={lazy ? 'lazy' : 'eager'} decoding="async" /></span> : <TemplateArt id={item.id} />
}

export const ClientHomeGallery = memo(function ClientHomeGallery({ selection, onChange, animate = false, disabled = false }: SelectionProps & { animate?: boolean }) {
  const { language } = useClientPreferences()
  const [limitAttempt, setLimitAttempt] = useState(0)
  const current = normalizeTemplateSelection(selection)
  const total = current.acts.length + current.assets.length
  const atLimit = total >= HOME_TEMPLATE_MAX
  useEffect(() => {
    if (!limitAttempt) return
    const timer = window.setTimeout(() => setLimitAttempt(0), 5000)
    return () => window.clearTimeout(timer)
  }, [limitAttempt])
  function pick(kind: keyof HomeTemplateSelection, id: string) {
    if (disabled) return
    if (atLimit && !current[kind].includes(id)) { setLimitAttempt(value => value + 1); return }
    setLimitAttempt(0)
    onChange(toggleTemplateSelection(current, kind, id))
  }
  return <section className={`client-home-gallery g-tplwrap${animate ? ' entering' : ''}`} aria-label={shellText(language, 'templates')} inert={disabled}>
    <div className="g-tpls">
      {([['acts', CLIENT_HOME_ACTIONS], ['assets', CLIENT_HOME_ASSETS]] as const).flatMap(([kind, items]) => items.map((item, index) => <button key={`${kind}:${item.id}`} type="button" className={`g-tpl${current[kind].includes(item.id) ? ' on' : ''}`} data-k={kind} data-id={item.id} aria-label={homeTemplateLabel(language, item.id, item.lb)} aria-pressed={current[kind].includes(item.id)} onClick={() => pick(kind, item.id)} onFocus={event => {
        // Keyboard focus must clear the sticky composer, not just the viewport.
        if (event.currentTarget.matches(':focus-visible')) event.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'instant' })
      }} style={{ '--tpl-delay': `${kind === 'acts' ? .24 + index * .07 : .55 + Math.min(index, 14) * .035}s` } as CSSProperties}>
        <TemplateThumb item={item} lazy={kind === 'assets' && index > 3} />
        <span className="lb">{homeTemplateLabel(language, item.id, item.lb)}</span>
      </button>))}
    </div>
    <div className="client-template-notice" role="status" aria-live="polite" aria-atomic="true">{limitAttempt > 0 && atLimit && <span key={limitAttempt}>{shellText(language, 'limit', { count: HOME_TEMPLATE_MAX })}</span>}</div>
  </section>
})

export function ClientHomeTemplateSelection({ selection, onChange, onEmptyFocus, disabled = false }: SelectionProps & { onEmptyFocus?: () => void }) {
  const { language } = useClientPreferences()
  const current = normalizeTemplateSelection(selection)
  if (!current.acts.length && !current.assets.length) return null
  function remove(kind: keyof HomeTemplateSelection, id: string, button: HTMLButtonElement) {
    if (disabled) return
    const row = button.closest('.client-template-selection')
    const buttons = Array.from(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const index = buttons.indexOf(button)
    const next = buttons[index + 1] ?? buttons[index - 1]
    onChange(toggleTemplateSelection(current, kind, id))
    // Preserve keyboard position when the focused remove button unmounts.
    if (document.activeElement === button) {
      if (next) next.focus()
      else if (onEmptyFocus) onEmptyFocus()
      else document.querySelector<HTMLButtonElement>(`.client-home-gallery button[data-k="${kind}"][data-id="${id}"]`)?.focus()
    }
  }
  return <div className="client-template-selection g-tpl-sel" aria-label={shellText(language, 'selected')} inert={disabled}>
    {(['acts', 'assets'] as const).flatMap(kind => current[kind].map(id => {
      const item = (kind === 'acts' ? CLIENT_HOME_ACTIONS : CLIENT_HOME_ASSETS).find(entry => entry.id === id)!
      const label = homeTemplateLabel(language, item.id, item.lb)
      return <span className="tchip" key={`${kind}:${id}`}><span className="th"><TemplateThumb item={item} /></span><span className="chip-label">{label}</span><button type="button" aria-label={shellText(language, 'remove', { name: label })} onClick={event => remove(kind, id, event.currentTarget)}>×</button></span>
    }))}
  </div>
}
