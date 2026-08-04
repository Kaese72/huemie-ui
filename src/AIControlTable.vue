<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const conversations = ref([])
const error = ref(null)
const loading = ref(true)
const router = useRouter()

const openMenuId = ref(null)

async function fetchConversations() {
  try {
    const response = await axios.get('/chatbot-service/v0/conversations')
    conversations.value = response.data.conversations ?? []
    error.value = null
  } catch (err) {
    error.value = err
  }
}

function closeMenu() {
  openMenuId.value = null
}

onMounted(async () => {
  await fetchConversations()
  loading.value = false
  // Per the AI Control design: with zero conversations, go straight to the
  // "start a new chat" flow rather than flashing an empty table.
  if (conversations.value.length === 0 && !error.value) {
    router.replace({ name: 'AIControlNew' })
  }
  window.addEventListener('click', closeMenu)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', closeMenu)
})

function onRowClick(conversation) {
  router.push({ name: 'AIControlChat', params: { id: conversation.id } })
}

function toggleMenu(conversationId, event) {
  event.stopPropagation()
  openMenuId.value = openMenuId.value === conversationId ? null : conversationId
}

async function forgetConversation(conversation, event) {
  event.stopPropagation()
  openMenuId.value = null
  // Mirrors the API's own guard (persistence.ErrConversationNotAwaitingInput,
  // HTTP/409): a conversation can only be forgotten while the user holds
  // initiative, not while the agent is still working on it.
  if (!confirm(`Forget conversation "${conversation.name}"? This cannot be undone.`)) return
  try {
    await axios.post(`/chatbot-service/v0/conversations/${conversation.id}/forget`)
    await fetchConversations()
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div class="ai-control-view">
    <div class="pane-header">
      <h1>AI Control</h1>
      <button class="btn-create" @click="router.push({ name: 'AIControlNew' })">+ New chat</button>
    </div>
    <div v-if="error" class="error">Error: {{ error.message }}</div>
    <div v-else-if="loading" class="empty">Loading…</div>
    <div v-else class="table-wrapper">
      <div class="table-header">
        <div class="cell cell-id">ID</div>
        <div class="cell cell-name">Name</div>
        <div class="cell cell-status">Status</div>
        <div class="cell cell-initiative">Turn</div>
        <div class="cell cell-updated">Updated</div>
        <div class="cell cell-actions"></div>
      </div>
      <div
        v-for="conversation in conversations" :key="conversation.id"
        class="table-row"
        @click="onRowClick(conversation)"
      >
        <div class="cell cell-id">{{ conversation.id }}</div>
        <div class="cell cell-name">{{ conversation.name }}</div>
        <div class="cell cell-status">
          <span class="status-badge" :class="conversation.status === 'AGENT_IN_PROGRESS' ? 'in-progress' : 'idle'">
            {{ conversation.status === 'AGENT_IN_PROGRESS' ? 'Thinking…' : 'Waiting for you' }}
          </span>
        </div>
        <div class="cell cell-initiative">{{ conversation.initiative === 'AGENT' ? 'Agent' : 'User' }}</div>
        <div class="cell cell-updated">{{ new Date(conversation.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</div>
        <div class="cell cell-actions">
          <button class="menu-btn" @click="toggleMenu(conversation.id, $event)">⋮</button>
          <div v-if="openMenuId === conversation.id" class="menu" @click.stop>
            <button class="menu-item danger" @click="forgetConversation(conversation, $event)">Forget conversation</button>
          </div>
        </div>
      </div>
      <div v-if="conversations.length === 0" class="empty">
        <p>No conversations yet.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-control-view {
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
.pane-header h1 { margin: 0 0 0.5rem 0; }
.btn-create {
  padding: 0.4rem 1rem;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-create:hover { background: #369870; }
.error { color: red; padding: 0.5rem; }
.table-wrapper {
  flex: 1 1 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eee;
  height: 40px;
  box-sizing: border-box;
}
.table-header {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  position: sticky;
  top: 0;
}
.table-row {
  cursor: pointer;
  transition: background 0.15s;
}
.table-row:hover { background: #f0f9f5; }
.cell {
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-id         { width: 60px;  flex-shrink: 0; font-weight: bold; }
.cell-name       { flex: 1; min-width: 0; }
.cell-status     { width: 140px; flex-shrink: 0; }
.cell-initiative { width: 80px;  flex-shrink: 0; }
.cell-updated    { width: 220px; flex-shrink: 0; color: #777; font-size: 0.85rem; }
.cell-actions    { width: 44px;  flex-shrink: 0; position: relative; overflow: visible; text-align: center; }
.menu-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: #555;
}
.menu-btn:hover { background: #e6e6e6; }
.menu {
  position: absolute;
  top: 100%;
  right: 0.5rem;
  z-index: 20;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  min-width: 170px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.menu-item {
  border: none;
  background: #fff;
  text-align: left;
  padding: 0.5rem 0.85rem;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover { background: #f5f5f5; }
.menu-item.danger { color: #e53935; }
.menu-item.danger:hover { background: #ffebee; }
.status-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.8rem;
}
.status-badge.idle { background: #e6f7ff; color: #1890ff; }
.status-badge.in-progress { background: #fff3e0; color: #e65100; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
.empty p { margin: 0.25rem 0; }
</style>
