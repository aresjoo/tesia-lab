/** Presentation-only split. Concatenating both pieces must recover the input. */
export function catalogueFirstSentence(text: string) {
  // CJK sentence endings do not require spaces. Keep the existing ASCII
  // boundary so decimal points and dotted numeric identifiers stay together.
  const cut = text.search(/[。！？]|[.!?](?=\s)/)
  return cut > 0 ? { head: text.slice(0, cut + 1), rest: text.slice(cut + 1) } : { head: text, rest: '' }
}
