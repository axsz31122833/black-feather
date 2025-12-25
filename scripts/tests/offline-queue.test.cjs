exports.run = async function () {
  let queued = 0
  function mockPostMessage(msg) {
    if (msg && msg.type === 'enqueue_ops') queued++
  }
  // simulate offline by throwing on insert
  const sendOpsEvent = async (event_type, ref_id, payload, postMessage) => {
    try {
      throw new Error('offline')
    } catch {
      postMessage({ type: 'enqueue_ops', event_type, ref_id, payload })
    }
  }
  await sendOpsEvent('test_event', 'rid', { a: 1 }, mockPostMessage)
  if (queued !== 1) throw new Error('enqueue did not occur')
}

