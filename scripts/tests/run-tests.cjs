const fs = require('fs')
const path = require('path')

async function runFile(file) {
  const mod = require(file)
  if (typeof mod.run !== 'function') {
    console.log('[SKIP]', path.basename(file), 'no run() export')
    return true
  }
  try {
    await mod.run()
    console.log('[PASS]', path.basename(file))
    return true
  } catch (e) {
    console.error('[FAIL]', path.basename(file), e && e.message ? e.message : e)
    return false
  }
}

async function main() {
  const dir = path.join(process.cwd(), 'tests')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.cjs'))
  let pass = 0, fail = 0
  for (const f of files) {
    const ok = await runFile(path.join(dir, f))
    ok ? pass++ : fail++
  }
  console.log(`Tests: ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

