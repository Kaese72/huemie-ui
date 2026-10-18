<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { followConversation } from './composables/useConversationStream.js'

const route = useRoute()
const router = useRouter()

const conversation = ref(null)
const entries = ref([])
const loadError = ref(null)
const loading = ref(true)

const query = ref('')
const sending = ref(false)
const sendError = ref(null)

const messagesRef = ref(null)
let abortController = null

// Whose turn it is is derived entirely from the DialogEntry stream, not
// from polling GET /conversations/{id} -- USER_INPUT means the agent just
// picked up the turn, AGENT_INITIATIVE_RELEASED/USER_STOP mean it just gave
// initiative back (see restmodels.DialogEntryTypeAgentInitiativeReleased).
// Replaying the full history on connect naturally walks this state machine
// to the conversation's actual current turn before any live entries arrive.
const agentHasInitiative = ref(false)
const inProgress = computed(() => agentHasInitiative.value)
const canSend = computed(() => conversation.value && !inProgress.value && !sending.value)

async function fetchConversation(id) {
  const response = await axios.get(`/chatbot-service/v0/conversations/${id}`)
  conversation.value = response.data
}

async function scrollToBottom() {
  await nextTick()
  const el = messagesRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function onEntry(entry) {
  entries.value.push(entry)
  scrollToBottom()
  if (entry.type === 'USER_INPUT') {
    agentHasInitiative.value = true
  } else if (entry.type === 'AGENT_INITIATIVE_RELEASED' || entry.type === 'USER_STOP') {
    agentHasInitiative.value = false
  }
}

async function connect(id) {
  loading.value = true
  loadError.value = null
  entries.value = []
  conversation.value = null
  abortController?.abort()
  abortController = new AbortController()

  try {
    // Fetched once, purely to display the conversation's name -- turn
    // state comes from replaying the entry stream below, not from this.
    await fetchConversation(id)
    agentHasInitiative.value = conversation.value.initiative === 'AGENT'
    loading.value = false
    await followConversation(id, 0, onEntry, abortController.signal)
  } catch (err) {
    if (err.name !== 'AbortError') {
      loadError.value = err
      loading.value = false
    }
  }
}

watch(() => route.params.id, (id) => { if (id) connect(id) }, { immediate: true })

onBeforeUnmount(() => {
  abortController?.abort()
})

async function sendInput() {
  if (!query.value.trim()) return
  sendError.value = null
  sending.value = true
  try {
    await axios.post(`/chatbot-service/v0/conversations/${route.params.id}/input`, { query: query.value })
    // The USER_INPUT entry this produces arrives shortly via the stream too
    // and would set the same value -- set it here as well so the input box
    // disables immediately rather than waiting on that round trip.
    agentHasInitiative.value = true
    query.value = ''
  } catch (err) {
    sendError.value = err
  } finally {
    sending.value = false
  }
}

async function stopConversation() {
  try {
    await axios.post(`/chatbot-service/v0/conversations/${route.params.id}/terminate`)
  } catch {
    // Best-effort -- the next SSE update reflects whatever actually happened.
  }
}

async function forgetConversation() {
  // Mirrors the API's own guard (persistence.ErrConversationNotAwaitingInput,
  // HTTP/409): a conversation can only be forgotten while the user holds
  // initiative, not while the agent is still working on it.
  if (!confirm(`Forget conversation "${conversation.value?.name}"? This cannot be undone.`)) return
  try {
    await axios.post(`/chatbot-service/v0/conversations/${route.params.id}/forget`)
    router.push({ name: 'AIControl' })
  } catch (err) {
    sendError.value = err
  }
}

// Generic tool calls (list_devices/list_groups) are rendered specially
// below instead of through this label - their response is a raw blob that
// can be arbitrarily long, so it's hidden behind an expand/collapse toggle
// rather than printed inline. See expandedGenericToolResults.
function toolLabel(entry) {
  switch (entry.type) {
    case 'AGENT_DEVICE_CAPABILITY_TRIGGER_CALL': {
      const c = entry['device-capability-trigger-call']
      return `Triggered "${c.capability}" on device ${c['device-id']}`
    }
    case 'AGENT_DEVICE_CAPABILITY_TRIGGER_RESPONSE': {
      const r = entry['device-capability-trigger-response']
      return `↳ ${r.success ? 'Succeeded' : `Failed: ${r['error-message'] ?? 'unknown error'}`}`
    }
    case 'AGENT_GROUP_CAPABILITY_TRIGGER_CALL': {
      const c = entry['group-capability-trigger-call']
      return `Triggered "${c.capability}" on group ${c['group-id']}`
    }
    case 'AGENT_GROUP_CAPABILITY_TRIGGER_RESPONSE': {
      const r = entry['group-capability-trigger-response']
      return `↳ ${r.success ? 'Succeeded' : `Failed: ${r['error-message'] ?? 'unknown error'}`}`
    }
    default:
      return ''
  }
}

const isToolEntry = (type) => type.includes('CAPABILITY_TRIGGER')

// Tracks which generic tool calls' responses are currently expanded, keyed
// by tool-use-id (shared between the *_CALL and *_RESPONSE entry of a pair).
// Collapsed (the default - nothing in this Set) renders no box at all, so it
// takes up no space; expanding one inserts the box in its natural place in
// the message flow, pushing later entries down rather than overlaying them.
const expandedGenericToolResults = ref(new Set())

function toggleGenericToolResult(toolUseId) {
  if (expandedGenericToolResults.value.has(toolUseId)) {
    expandedGenericToolResults.value.delete(toolUseId)
  } else {
    expandedGenericToolResults.value.add(toolUseId)
  }
}

// list_devices/list_groups' output is device-store's raw JSON response as an
// unparsed string (restmodels.GenericToolResponsePayload.Output) - pretty
// print it for readability when it parses as JSON, otherwise fall back to
// the raw string as-is (e.g. a plain-text error message isn't JSON at all).
function formatToolOutput(output) {
  try {
    return JSON.stringify(JSON.parse(output), null, 2)
  } catch {
    return output
  }
}
</script>

<template>
  <div class="chat-view">
    <div class="pane-header">
      <h2 class="detail-title chat-title">{{ conversation?.name ?? 'Conversation' }}</h2>
      <div class="header-actions">
        <button class="btn btn-danger btn-sm" @click="forgetConversation">Forget</button>
        <router-link :to="{ name: 'AIControl' }" class="icon-btn" title="Back to conversations" aria-label="Back to conversations">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </router-link>
      </div>
    </div>

    <div v-if="loadError" class="alert alert-error">Error: {{ loadError.message }}</div>
    <p v-else-if="loading" class="empty">Loading…</p>

    <template v-else>
      <div class="messages" ref="messagesRef">
        <template v-for="entry in entries" :key="entry.id">
          <div v-if="entry.type === 'USER_INPUT'" class="bubble user">{{ entry['user-input'].text }}</div>
          <div v-else-if="entry.type === 'AGENT_MESSAGE'" class="bubble agent">{{ entry['agent-message'].text }}</div>
          <div v-else-if="entry.type === 'AGENT_ERROR'" class="alert alert-error agent-error">{{ entry['agent-error'].message }}</div>
          <div v-else-if="entry.type === 'USER_STOP'" class="system-note">Conversation stopped</div>
          <div v-else-if="entry.type === 'AGENT_GENERIC_TOOL_CALL'" class="tool-note tool-call-row">
            <button
              class="expand-toggle"
              @click="toggleGenericToolResult(entry['generic-tool-call']['tool-use-id'])"
            >
              <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
              Called {{ entry['generic-tool-call']['tool-name'] }}
              <span
                class="expand-arrow"
                :class="{ open: expandedGenericToolResults.has(entry['generic-tool-call']['tool-use-id']) }"
              >▾</span>
            </button>
          </div>
          <div
            v-else-if="entry.type === 'AGENT_GENERIC_TOOL_RESPONSE' && expandedGenericToolResults.has(entry['generic-tool-response']['tool-use-id'])"
            class="tool-result-box"
            :class="{ error: entry['generic-tool-response']['is-error'] }"
          >
            <pre>{{ formatToolOutput(entry['generic-tool-response'].output) }}</pre>
          </div>
          <div v-else-if="isToolEntry(entry.type)" class="tool-note">
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
            {{ toolLabel(entry) }}
          </div>
        </template>
        <div v-if="inProgress" class="bubble agent thinking" aria-label="Thinking">
          <span /><span /><span />
        </div>
      </div>

      <div class="composer">
        <textarea
          v-model="query"
          rows="2"
          class="input"
          placeholder="Message the assistant…"
          :disabled="!canSend"
          @keydown.enter.exact.prevent="sendInput"
        ></textarea>
        <button v-if="inProgress" class="btn btn-danger" @click="stopConversation">Stop</button>
        <button v-else class="btn btn-primary" :disabled="!canSend" @click="sendInput">Send</button>
      </div>
      <div v-if="sendError" class="alert alert-error">{{ sendError.response?.data?.detail || sendError.message }}</div>
    </template>
  </div>
</template>

<style scoped>
/* DESIGN.md (this repo), section 8 "AI Control". */
.chat-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.chat-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.messages {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 2px;
}
.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 20px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
/* You are at home: your messages carry the warm tint. */
.bubble.user {
  align-self: flex-end;
  background: color-mix(in srgb, var(--warm) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--warm) 25%, transparent);
  color: var(--text);
  border-bottom-right-radius: 6px;
}
.bubble.agent {
  align-self: flex-start;
  background: color-mix(in srgb, var(--ink) 4%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--text);
  border-bottom-left-radius: 6px;
}
.bubble.agent.thinking {
  display: inline-flex;
  gap: 5px;
  padding: 14px 16px;
}
.thinking span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--muted);
  animation: chat-breathe 1.2s ease-in-out infinite;
}
.thinking span:nth-child(2) { animation-delay: 0.15s; }
.thinking span:nth-child(3) { animation-delay: 0.3s; }
@keyframes chat-breathe {
  0%, 100% { opacity: 0.25; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-2px); }
}
.agent-error {
  align-self: flex-start;
  max-width: 78%;
  margin: 0;
}
.system-note {
  align-self: center;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
}
.tool-note {
  align-self: flex-start;
  margin-left: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--faint);
}
.tool-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}
.tool-call-row { padding: 0; }
.expand-toggle {
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.15s;
}
.expand-toggle:hover { color: var(--text); }
.expand-arrow {
  display: inline-block;
  font-size: 1rem;
  line-height: 1;
  transform: rotate(-90deg);
  transition: transform 0.15s ease;
}
.expand-arrow.open { transform: rotate(0deg); }
.tool-result-box {
  align-self: flex-start;
  margin-left: 6px;
  max-width: 90%;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: 12px;
  padding: 8px 12px;
}
.tool-result-box.error {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  border-color: color-mix(in srgb, var(--danger) 25%, transparent);
}
.tool-result-box pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, 'Cascadia Code', SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--muted);
}
.tool-result-box.error pre { color: var(--danger-ink); }

.composer {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}
.composer textarea {
  flex: 1;
  resize: none;
  border-radius: 20px;
  padding: 10px 16px;
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .thinking span { animation: none; opacity: 0.6; }
}
</style>
