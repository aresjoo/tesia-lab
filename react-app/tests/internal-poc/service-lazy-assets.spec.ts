import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'
import { createServer, type Server } from 'node:http'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

type ManifestEntry = { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[] }
const exec = promisify(execFile)

test('서비스 HTML은 지연 청크를 허용목록에 유지하되 최초 화면에서 미리 받지 않는다', async ({ page }, info) => {
  const output = await mkdtemp(join(tmpdir(), 'teth-service-lazy-assets-'))
  let server: Server | undefined
  try {
    await exec('npx', ['vite', 'build', '--config', 'vite.service.config.ts', '--outDir', output, '--manifest'], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    const manifest = JSON.parse(await readFile(join(output, '.vite/manifest.json'), 'utf8')) as Record<string, ManifestEntry>
    const html = await readFile(join(output, 'internal-poc.html'), 'utf8')
    function closure(dynamic: boolean) {
      const keys = new Set<string>(), files = new Set<string>()
      function visit(key: string) {
        if (keys.has(key)) return
        keys.add(key)
        const entry = manifest[key]
        if (!entry) throw new Error(`Missing manifest dependency: ${key}`)
        files.add(`/${entry.file}`)
        for (const css of entry.css ?? []) files.add(`/${css}`)
        for (const next of [...(entry.imports ?? []), ...(dynamic ? entry.dynamicImports ?? [] : [])]) visit(next)
      }
      visit('internal-poc.html')
      return files
    }
    const all = closure(true), initial = closure(false)
    const links = [...html.matchAll(/<link\b([^>]+)>/g)].map(match => {
      const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attr => [attr[1], attr[2]]))
      return attrs
    })
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1])
    const registered = new Set([...scripts, ...links.map(link => link.href)])
    const fetched = links.filter(link => ['modulepreload', 'preload', 'stylesheet'].includes(link.rel)).map(link => link.href)
    const deferred = [...all].filter(file => !initial.has(file))
    expect(deferred.some(file => /lightweight-charts.*\.js$/.test(file))).toBe(true)
    expect(deferred.some(file => /ClientProfessionalPriceChart.*\.js$/.test(file))).toBe(true)
    for (const file of all) {
      expect(registered.has(file), `Backend static allowlist must retain ${file}`).toBe(true)
      await expect(readFile(join(output, file.slice(1)))).resolves.toBeTruthy()
    }
    for (const file of initial) {
      expect([...scripts, ...fetched], `Vite must retain initial static asset: ${file}`).toContain(file)
    }
    for (const file of deferred) {
      expect(fetched, `Lazy asset must not be a browser preload: ${file}`).not.toContain(file)
      expect(links.some(link => link.href === file && link.rel === 'teth-static-asset')).toBe(true)
    }
    expect(html.toLowerCase()).not.toContain('fixture')

    // Real built modules/HTML, no source transforms and no backend writes.
    // This HTTP fixture tests browser fetching, not the backend allowlist.
    const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
    server = createServer(async (request, response) => {
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
      const path = resolve(output, pathname === '/' ? 'internal-poc.html' : `.${pathname}`)
      if (!path.startsWith(output + sep)) { response.writeHead(404).end(); return }
      try { const body = await readFile(path); response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }).end(body) }
      catch { response.writeHead(404).end() }
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing local test server address')
    const origin = `http://127.0.0.1:${address.port}`
    const requests: string[] = [], errors: string[] = []
    page.on('request', request => requests.push(new URL(request.url()).pathname))
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== origin || url.pathname.startsWith('/api/') || request.method() !== 'GET') return route.abort()
      return route.continue()
    })
    await page.goto(origin)
    await expect(page.locator('.client-service-app')).toBeVisible()
    await expect(page.locator('.landing-hero textarea')).toBeVisible()
    await expect(page.locator('.site-help-trigger')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    // The real home mounts its support launcher (ClientHelp); a dynamic
    // component actually rendered on home is not an unused/preloaded route.
    for (const file of deferred.filter(file => !/\/ClientHelp-/.test(file))) {
      expect(requests, `Unused browser asset must stay lazy: ${file}`).not.toContain(file)
    }
    const chart = deferred.find(file => /ClientProfessionalPriceChart.*\.js$/.test(file))!
    const library = deferred.find(file => /lightweight-charts.*\.js$/.test(file))!
    await page.evaluate(async path => { await import(/* @vite-ignore */ path) }, chart)
    expect(requests.filter(path => path === chart)).toHaveLength(1)
    expect(requests.filter(path => path === library)).toHaveLength(1)
    expect(errors).toEqual([])
    await page.screenshot({ path: info.outputPath('built-service-home.png') })
  } finally {
    await page.close()
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())) }
    await rm(output, { recursive: true, force: true })
  }
})
