// Browser-only test harness: use the application's exact optimized URLs.
// Fetching compiled source does not mount the app or dispatch any API request.
export async function testClientReactRuntimePaths(): Promise<{ reactPath: string; rootPath: string }> {
  const response = await fetch('/src/client-bootstrap.tsx', { cache: 'no-store' })
  if (!response.ok) throw new Error('TEST_REACT_RUNTIME_SOURCE_UNAVAILABLE')
  const source = await response.text()
  const reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
  const rootPath = source.match(/from "([^"\n]*\/react-dom_client\.js[^"\n]*)"/)?.[1]
  if (!reactPath || !rootPath) throw new Error('TEST_REACT_RUNTIME_DEPENDENCY_UNAVAILABLE')
  for (const [value, name] of [[reactPath, 'react'], [rootPath, 'react-dom_client']] as const) {
    const url = new URL(value, location.origin)
    if (url.origin !== location.origin
      || !new RegExp(`^/node_modules/\\.vite(?:-e2e-[0-9]+)?/deps/${name}\\.js$`).test(url.pathname)
      || !/^\?v=[a-zA-Z0-9_-]+$/.test(url.search) || url.hash !== '') {
      throw new Error('TEST_REACT_RUNTIME_DEPENDENCY_REJECTED')
    }
  }
  return { reactPath, rootPath }
}
