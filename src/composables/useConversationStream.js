// The chatbot's dialog-entry stream (GET .../conversations/{id}/follow/{id})
// is Server-Sent Events, but the native EventSource API cannot send an
// Authorization header, which chatbot-service's inbound auth middleware
// requires on every route. fetch() can set headers and still exposes a
// streamable body, so this hand-rolls the (very small) SSE framing --
// "data: ...\n\n" per message -- instead of pulling in a library for it.
import { useAuth } from './useAuth.js'

const MAX_BACKOFF_MS = 15000

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

// Follows a conversation's dialog entries from afterId (0 for full history)
// until `signal` aborts it, reconnecting automatically -- with capped
// exponential backoff -- if the underlying connection ends unexpectedly.
// chatbot's FollowConversation handler (internal/restwebapp/sse.go) never
// closes this connection on its own in normal operation -- it only stops on
// client disconnect -- so any other end of the stream (a proxy idle/write
// timeout killing the connection mid-frame, a dropped NetworkPolicy, a
// pod restart, ...) is transient, not a real end of the conversation, and
// gets resumed from the last entry actually received rather than replaying
// the whole history again. A 4xx response (e.g. an invalid/expired token,
// or the conversation genuinely not existing) is treated as permanent and
// thrown to the caller instead of retried forever.
export async function followConversation(conversationId, afterId, onEntry, signal) {
  let lastId = afterId
  let attempt = 0

  while (!signal.aborted) {
    try {
      await followOnce(conversationId, lastId, (entry) => {
        lastId = entry.id
        onEntry(entry)
      }, signal)
      attempt = 0
    } catch (err) {
      if (signal.aborted || err.name === 'AbortError') return
      if (err.status >= 400 && err.status < 500) throw err
      attempt += 1
    }
    if (signal.aborted) return
    await sleep(Math.min(1000 * 2 ** (attempt - 1), MAX_BACKOFF_MS), signal)
  }
}

// followOnce runs a single connection attempt and resolves once the
// connection ends, however it ends -- the caller (followConversation)
// decides whether that's worth reconnecting over.
async function followOnce(conversationId, afterId, onEntry, signal) {
  const { useToken } = useAuth()
  const response = await fetch(`/chatbot-service/v0/conversations/${conversationId}/follow/${afterId}`, {
    headers: { Authorization: `Bearer ${useToken.value}` },
    signal,
  })
  if (!response.ok || !response.body) {
    const err = new Error(`follow-conversation returned ${response.status}`)
    err.status = response.status
    throw err
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })

    let boundary
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      // Comment-only frames (server keep-alive heartbeats) have no "data:"
      // line and are silently ignored here, same as the SSE spec requires.
      const dataLines = rawEvent
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
      if (dataLines.length === 0) continue
      try {
        onEntry(JSON.parse(dataLines.join('\n')))
      } catch {
        // Malformed frame -- skip it rather than tearing down the stream.
      }
    }
  }
}
