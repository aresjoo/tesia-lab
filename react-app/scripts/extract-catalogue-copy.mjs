// Emits an apply_patch payload; no repository writes or runtime eval.
// Usage: node scripts/extract-catalogue-copy.mjs <bare-client-repository>
import ts from 'typescript'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const sha = '412fd6042e0b3935773831f43163a7da68191162'
const html = execFileSync('git', ['--git-dir=' + process.argv[2], 'show', sha + ':index.html'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).join('\n')
const ast = ts.createSourceFile('client.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === 'cpCalc')
if (declarations.length !== 1) throw Error('Expected one source cpCalc')
const calculation = declarations[0].getText(ast).replaceAll('\r\n', '\n')
const runtime = `/** Exact client cpCalc from ${sha}. Preview accounting only.
 * Not execution, a wallet, risk enforcement, or a service accounting contract.
 * Pure injected inputs: no storage, network, clock, DOM or eval.
 */
export const copyCalculationSourceSha = '${sha}'
export function runSourceCatalogueCopy(copy, source, prices, share) {
  const tfSSFind = nick => nick === copy.nick ? source : null
  const cpMeta = () => ({ share })
  const mkPx = prices
${calculation}
  return cpCalc(copy)
}
`
const fixture = JSON.stringify({ sha, codeSha256: createHash('sha256').update(calculation).digest('hex'), code: calculation }, null, 2)
const actionNames = ['cpState', 'cpFind', 'cpStart', 'cpAdjCommit', 'cpFlat', 'mkStopGo', 'cpClose']
const actionCode = actionNames.map(name => {
  const matches = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  if (matches.length !== 1) throw Error('Expected one source ' + name)
  return matches[0].getText(ast).replaceAll('\r\n', '\n')
}).join('\n')
const actions = JSON.stringify({ sha, codeSha256: createHash('sha256').update(actionCode).digest('hex'), code: actionCode }, null, 2)
console.log('*** Begin Patch\n' + [['src/client-catalogue-copy-source.mjs', runtime], ['tests/fixtures/catalogue-copy-runtime.json', fixture], ['tests/fixtures/catalogue-copy-actions-runtime.json', actions]].map(([file, content]) => '*** Add File: ' + process.cwd() + '/' + file + '\n' + content.trimEnd().split('\n').map(line => '+' + line).join('\n')).join('\n') + '\n*** End Patch')
