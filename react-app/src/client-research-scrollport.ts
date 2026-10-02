/** Footer documents scroll the shell; embedded research keeps its own viewport. */
export function clientResearchScrollport(root: HTMLElement | null = document.getElementById('research-main')): HTMLElement | null {
  return root?.closest<HTMLElement>('.client-source-app.has-site-footer') ?? root
}
