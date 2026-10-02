// Emits an apply_patch payload, never writes repository files itself.
// Usage: node scripts/extract-catalogue-judgment.mjs <bare-source-repository>
import ts from 'typescript'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const sha = '412fd6042e0b3935773831f43163a7da68191162'
const html = execFileSync('git', ['--git-dir=' + process.argv[2], 'show', sha + ':index.html'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n')
const ast = ts.createSourceFile('source.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const names = 'mkPxFmt mkList mkPxU mkInst mkTagIO mkWords mkPolite mkSay mkDepthN mkRules mkHeldTxt mkDipAt mkDipTxt mkDipNow mkChatIntro mkChatWait mkChatNow mkChatEv mkChatMsgs mkChatTitle mkTopTxt mkJ mkPct0 mkUni mkMD mkTk fuOp fuIs fuSd fuPct fuNeed fuAiTxt fuSig fuOuts fuEv fuRules fuChatIntro fuChatNow fuChatEv skdText skdDate MK_CRYPTO MK_WHY_P MK_TK FU_WHY FU_WHY_P SKD_EXACT SKD_RE SKD_RULE MK_GLOSS MKC_IC'.split(' ')
const found = new Map()
for (const node of ast.statements) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) found.set(node.name.text, node.getText(ast))
  if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
    if (ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)) found.set(declaration.name.text, 'var ' + declaration.getText(ast) + ';')
  }
}
for (const name of names) if (!found.has(name)) throw Error('Missing source declaration: ' + name)
const code = names.map(n => found.get(n)).join('\n').replaceAll('\r\n', '\n')
const module = `/** Extracted pure presentation functions from aresjoo/tesia-lab ${sha}.
 * No DOM, HTML injection, network, eval, trading authority, or stale MK_VOICE.
 * The original Korean narrative is source-language content. UI labels localize separately.
 */
export const judgmentSourceSha = '${sha}'
export function createJudgmentRuntime({ prices, date, length, universes, symbol }) {
  const mkPx = prices, idxToDate = date, PRICE0 = { length }, MK_UNI = universes, skSym = symbol
  // Source timestamps synthesize seconds; only recorded civil dates are exposed.
  const mkTS = (_s, i) => date(i).toISOString().slice(0, 10)
  // Historical authored prose has no data-version binding and conflicts with this snapshot.
  const MK_VOICE = undefined
${code}
  return {
    messages(s, r) {
      return mkChatMsgs(s, r, 6).map(m => {
        let text = skdText(m.t)
        if (m.k !== 'now' && m.k !== 'intro') text = text.split(/(?<=다\\.)\\s+/).filter(sentence => !SKD_RULE.test(sentence)).join(' ')
        return { ...m, t: text, title: skdText(mkChatTitle(s, m)) }
      })
    },
    glossary: MK_GLOSS, icons: MKC_IC,
  }
}
`
const fixture = JSON.stringify({ sha, codeSha256: createHash('sha256').update(code).digest('hex'), code }, null, 2) + '\n'
const files = [['src/client-catalogue-judgment-source.mjs', module], ['tests/fixtures/catalogue-judgment-runtime.json', fixture]]
console.log('*** Begin Patch\n' + files.map(([path, text]) => '*** Add File: ' + process.cwd() + '/' + path + '\n' + text.trimEnd().split('\n').map(line => '+' + line).join('\n')).join('\n') + '\n*** End Patch')
