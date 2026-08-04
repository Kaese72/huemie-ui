// The chatbot's dialog-entry stream (GET .../conversations/{id}/follow/{id})
// is Server-Sent Events, but the native EventSource API cannot send an
// Authorization header, which chatbot-service's inbound auth middleware
// requires on every route. fetch() can set headers and still exposes a
// streamable body, so this hand-rolls the (very small) SSE framing --
// "data: ...\n\n" per message -- instead of pulling in a library for it.
import { useAuth } from './useAuth.js'

// Starts following a conversation's dialog entries from afterId (0 for full
// history) until the stream ends or `signal` aborts it. onEntry is called
// once per DialogEntry, in the order the server sends them (ascending ID).
// Returns nothing; callers control lifetime via signal (an AbortController).
export async function followConversation(conversationId, afterId, onEntry, signal) {
  const { useToken } = useAuth()
  const response = await fetch(`/chatbot-service/v0/conversations/${conversationId}/follow/${afterId}`, {
    headers: { Authorization: `Bearer ${useToken.value}` },
    signal,
  })
  if (!response.ok || !response.body) {
    throw new Error(`follow-conversation returned ${response.status}`)
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
