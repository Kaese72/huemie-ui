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

function toolLabel(entry) {
  switch (entry.type) {
    case 'AGENT_GENERIC_TOOL_CALL':
      return `🔧 Called ${entry['generic-tool-call']['tool-name']}`
    case 'AGENT_GENERIC_TOOL_RESPONSE':
      return `↳ ${entry['generic-tool-response']['is-error'] ? 'Failed' : 'Result'}: ${entry['generic-tool-response'].output}`
    case 'AGENT_DEVICE_CAPABILITY_TRIGGER_CALL': {
      const c = entry['device-capability-trigger-call']
      return `🔧 Triggered "${c.capability}" on device ${c['device-id']}`
    }
    case 'AGENT_DEVICE_CAPABILITY_TRIGGER_RESPONSE': {
      const r = entry['device-capability-trigger-response']
      return `↳ ${r.success ? 'Succeeded' : `Failed: ${r['error-message'] ?? 'unknown error'}`}`
    }
    case 'AGENT_GROUP_CAPABILITY_TRIGGER_CALL': {
      const c = entry['group-capability-trigger-call']
      return `🔧 Triggered "${c.capability}" on group ${c['group-id']}`
    }
    case 'AGENT_GROUP_CAPABILITY_TRIGGER_RESPONSE': {
      const r = entry['group-capability-trigger-response']
      return `↳ ${r.success ? 'Succeeded' : `Failed: ${r['error-message'] ?? 'unknown error'}`}`
    }
    default:
      return ''
  }
}

const isToolEntry = (type) => type.startsWith('AGENT_GENERIC_TOOL') || type.includes('CAPABILITY_TRIGGER')
</script>

<template>
  <div class="chat-view">
    <div class="pane-header">
      <h1>{{ conversation?.name ?? 'Conversation' }}</h1>
      <div class="header-actions">
        <button class="forget-btn" @click="forgetConversation">Forget conversation</button>
        <router-link :to="{ name: 'AIControl' }" class="back-link">← Back to conversations</router-link>
      </div>
    </div>

    <div v-if="loadError" class="error">Error: {{ loadError.message }}</div>
    <div v-else-if="loading" class="empty">Loading…</div>

    <template v-else>
      <div class="messages" ref="messagesRef">
        <template v-for="entry in entries" :key="entry.id">
          <div v-if="entry.type === 'USER_INPUT'" class="bubble user">{{ entry['user-input'].text }}</div>
          <div v-else-if="entry.type === 'AGENT_MESSAGE'" class="bubble agent">{{ entry['agent-message'].text }}</div>
          <div v-else-if="entry.type === 'AGENT_ERROR'" class="bubble agent-error">⚠ {{ entry['agent-error'].message }}</div>
          <div v-else-if="entry.type === 'USER_STOP'" class="system-note">Conversation stopped.</div>
          <div v-else-if="isToolEntry(entry.type)" class="tool-note">{{ toolLabel(entry) }}</div>
        </template>
        <div v-if="inProgress" class="bubble agent thinking">Thinking…</div>
      </div>

      <div class="composer">
        <textarea
          v-model="query"
          rows="2"
          placeholder="Message the chatbot…"
          :disabled="!canSend"
          @keydown.enter.exact.prevent="sendInput"
        ></textarea>
        <button v-if="inProgress" class="stop-btn" @click="stopConversation">Stop</button>
        <button v-else class="send-btn" :disabled="!canSend" @click="sendInput">Send</button>
      </div>
      <div v-if="sendError" class="error-msg">{{ sendError.response?.data?.detail || sendError.message }}</div>
    </template>
  </div>
</template>

<style scoped>
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
  padding-right: 1rem;
  flex-shrink: 0;
}
.pane-header h1 {
  margin: 0 0 0.5rem 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-actions { display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
.back-link { color: #666; text-decoration: none; font-size: 0.9rem; flex-shrink: 0; }
.back-link:hover { color: #42b983; }
.forget-btn {
  padding: 0.3rem 0.75rem;
  background: #fff;
  color: #e53935;
  border: 1px solid #e53935;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.forget-btn:hover { background: #ffebee; }
.error { color: red; padding: 0.5rem; }
.empty { padding: 2rem 1rem; color: #999; font-style: italic; text-align: center; }

.messages {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
}
.bubble {
  max-width: 70%;
  padding: 0.6rem 0.9rem;
  border-radius: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble.user {
  align-self: flex-end;
  background: #42b983;
  color: #fff;
  border-bottom-right-radius: 2px;
}
.bubble.agent {
  align-self: flex-start;
  background: #f0f0f0;
  color: #222;
  border-bottom-left-radius: 2px;
}
.bubble.agent.thinking { color: #999; font-style: italic; }
.bubble.agent-error {
  align-self: flex-start;
  background: #fdecea;
  color: #721c24;
  border-bottom-left-radius: 2px;
}
.system-note, .tool-note {
  align-self: center;
  font-size: 0.8rem;
  color: #999;
  font-style: italic;
}
.tool-note { align-self: flex-start; margin-left: 0.5rem; }

.composer {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
}
.composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  outline: none;
}
.composer textarea:focus { border-color: #42b983; }
.composer textarea:disabled { background: #f5f5f5; }
.send-btn, .stop-btn {
  align-self: flex-end;
  border: none;
  border-radius: 5px;
  padding: 0.6rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
}
.send-btn { background: #42b983; }
.send-btn:hover:not(:disabled) { background: #369b6f; }
.send-btn:disabled { opacity: 0.65; cursor: default; }
.stop-btn { background: #e65100; }
.stop-btn:hover { background: #c74600; }
.error-msg {
  background: #fdecea;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  color: #721c24;
  margin-top: 0.5rem;
}
</style>
