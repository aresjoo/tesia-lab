// Compatibility for the insight's explicit link-copy action only. No permission
// grants, clipboard reads, background retries, or persistence happen here.
function legacyInsightCopy(text: string, current: () => boolean): boolean {
  if (!current()) return false
  const active = document.activeElement
  const field = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null
  const fieldSelection = field && field.selectionStart !== null ? [field.selectionStart, field.selectionEnd, field.selectionDirection] as const : null
  const selection = window.getSelection()
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
  const direction = selection?.anchorNode && selection.focusNode ? { anchor: selection.anchorNode, start: selection.anchorOffset, focus: selection.focusNode, end: selection.focusOffset } : null
  const scroll: { node: HTMLElement; left: number; top: number }[] = []
  for (let node = active; node; node = node.parentElement) if (node instanceof HTMLElement) scroll.push({ node, left: node.scrollLeft, top: node.scrollTop })
  const position = { left: window.scrollX, top: window.scrollY }
  const temporary = document.createElement('textarea')
  temporary.value = text
  temporary.readOnly = true
  temporary.tabIndex = -1
  temporary.setAttribute('aria-hidden', 'true')
  temporary.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none;font-size:16px'
  try {
    document.body.appendChild(temporary)
    temporary.focus({ preventScroll: true })
    temporary.select()
    temporary.setSelectionRange(0, text.length)
    // A modal can make body children inert while a modern API request awaits
    // rejection. Never copy the modal's unrelated selected text as success.
    if (document.activeElement !== temporary || temporary.selectionStart !== 0 || temporary.selectionEnd !== text.length) return false
    return document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    const ownsFocus = document.activeElement === temporary || document.activeElement === active
    temporary.remove()
    // A synchronous copy listener can navigate or focus another field. Never
    // restore the old document's selection over that newer interaction.
    if (current() && ownsFocus && active?.isConnected && (active instanceof HTMLElement || active instanceof SVGElement) && !active.closest('[hidden],[inert]')) {
      try { active.focus({ preventScroll: true }) } catch { /* Detached/unsupported focus is harmless. */ }
      try {
        if (field && fieldSelection) field.setSelectionRange(fieldSelection[0], fieldSelection[1], fieldSelection[2] ?? undefined)
        else if (selection) {
          selection.removeAllRanges()
          if (ranges.length === 1 && direction?.anchor.isConnected && direction.focus.isConnected) {
            selection.setBaseAndExtent(direction.anchor, direction.start, direction.focus, direction.end)
          } else for (const range of ranges) if (range.commonAncestorContainer.isConnected) selection.addRange(range)
        }
      } catch { /* Selection nodes may have been removed by a copy listener. */ }
      for (const item of scroll) if (item.node.isConnected) {
        if (item.node.scrollLeft !== item.left) item.node.scrollLeft = item.left
        if (item.node.scrollTop !== item.top) item.node.scrollTop = item.top
      }
      if (window.scrollX !== position.left || window.scrollY !== position.top) window.scrollTo({ ...position, behavior: 'instant' })
    }
  }
}

export function copyInsightLink(text: string, current: () => boolean): Promise<boolean> {
  if (!current()) return Promise.resolve(false)
  try {
    if (typeof navigator.clipboard?.writeText === 'function') {
      return Promise.resolve(navigator.clipboard.writeText(text)).then(() => true, () => legacyInsightCopy(text, current))
    }
  } catch { /* A missing, throwing, or blocked API uses the source compatibility path. */ }
  // Evaluate synchronously, before returning a Promise, to retain the click's
  // user activation when the modern API is unavailable.
  return Promise.resolve(legacyInsightCopy(text, current))
}
