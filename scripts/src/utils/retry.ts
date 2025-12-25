export async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 300): Promise<T> {
  let lastErr: any = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const delay = baseDelayMs * Math.pow(2, i)
      await new Promise(res => setTimeout(res, delay))
    }
  }
  throw lastErr
}

