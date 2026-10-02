/** Source 9fbff821 index.html:21499–21512. Repetition is presentation only;
 * every page retains the original strategy object and ID. */
export function paginateSourceStrategies<T extends { me?: boolean }>(rows: readonly T[], plain: boolean, requestedPage: number) {
  let displayed = [...rows]
  if (plain) {
    const base = rows.filter(row => !row.me)
    for (let repeat = 1; repeat < 10 && base.length; repeat++) displayed.push(...base)
  }
  displayed = displayed.slice(0, 100)
  const pages = Math.max(1, Math.ceil(displayed.length / 10))
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1))
  return { rows: displayed.slice((page - 1) * 10, page * 10), page, pages }
}
