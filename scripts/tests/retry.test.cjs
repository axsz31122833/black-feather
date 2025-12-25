async function localRetry(fn, attempts = 3, baseDelayMs = 5) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, i))) }
  }
  throw lastErr
}

exports.run = async function () {
  let tries = 0
  const res = await localRetry(async () => {
    tries++
    if (tries < 3) throw new Error('fail')
    return 42
  }, 5, 1)
  if (res !== 42) throw new Error('retry did not return expected value')
}
