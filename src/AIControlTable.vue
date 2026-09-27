<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import TableShell from './components/TableShell.vue'
import { useTableList } from './composables/useTableList.js'

const router = useRouter()
const openMenuId = ref(null)

const columns = [
  { key: 'id', label: 'ID', width: '60px' },
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'status', label: 'Status', width: '140px', filter: { type: 'text', operators: ['text-eq'] } },
  { key: 'initiative', label: 'Turn', width: '100px', filter: { type: 'text', operators: ['text-eq'] } },
  { key: 'updated', label: 'Updated', width: '220px', sortable: true },
  { key: 'actions', label: '', width: '48px' },
]

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/chatbot-service/v0/conversations', { params })
  const rows = response.data?.conversations ?? []
  const totalHeader = response.headers['x-total-count']
  return { rows, total: totalHeader != null ? parseInt(totalHeader, 10) : rows.length }
}

const {
  rows: conversations,
  error,
  ready,
  columnFilters,
  sort,
  currentPage,
  totalPages,
  pageWindow,
  showFirst,
  showLast,
  goToPage,
  onResize,
  onColumnFilterApply,
  onColumnFilterClear,
  onSortChange,
  loading,
  refresh,
} = useTableList({ fetchPage })

// Per the AI Control design: with zero conversations - and no filter
// narrowing them there - go straight to the "start a new chat" flow rather
// than flashing an empty table. A filter that happens to match nothing does
// NOT redirect: that's just an empty filtered result, not "you have no
// conversations at all".
watch([ready, conversations, columnFilters], ([isReady, rows, filters]) => {
  if (isReady && rows.length === 0 && Object.keys(filters).length === 0 && !error.value) {
    router.replace({ name: 'AIControlNew' })
  }
})

function closeMenu() {
  openMenuId.value = null
}

onMounted(() => {
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
  if (!confirm(`Forget conversation "${conversation.name}"? This cannot be undone.`)) return
  try {
    await axios.post(`/chatbot-service/v0/conversations/${conversation.id}/forget`)
    await refresh()
  } catch (err) {
    error.value = err
  }
}
</script>

<template>
  <div class="ai-control-table">
    <h1>AI Control</h1>
    <div v-if="error">Error: {{ error.message }}</div>
    <TableShell
      :columns="columns"
      :rows="conversations"
      :selected-id="null"
      :column-filters="columnFilters"
      :sort="sort"
      :loading="loading"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-window="pageWindow"
      :show-first="showFirst"
      :show-last="showLast"
      @row-click="onRowClick"
      @go-to-page="goToPage"
      @filter-apply="onColumnFilterApply"
      @filter-clear="onColumnFilterClear"
      @sort-change="onSortChange"
      @resize="onResize"
    >
      <template #cell-status="{ row }">
        <span class="status-badge" :class="row.status === 'AGENT_IN_PROGRESS' ? 'in-progress' : 'idle'">
          {{ row.status === 'AGENT_IN_PROGRESS' ? 'Thinking…' : 'Waiting for you' }}
        </span>
      </template>
      <template #cell-initiative="{ row }">{{ row.initiative === 'AGENT' ? 'Agent' : 'User' }}</template>
      <template #cell-updated="{ row }">{{ new Date(row.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
      <template #cell-actions="{ row }">
        <button class="menu-btn" @click="toggleMenu(row.id, $event)">⋮</button>
        <div v-if="openMenuId === row.id" class="menu" @click.stop>
          <button class="menu-item danger" @click="forgetConversation(row, $event)">Forget conversation</button>
        </div>
      </template>
      <template #empty>
        <div v-if="ready" class="empty">
          <p>No conversations match the current filters.</p>
        </div>
      </template>
    </TableShell>
  </div>
</template>

<style scoped>
.ai-control-table {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ai-control-table h1 {
  flex-shrink: 0;
}
.status-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: 500;
}
.status-badge.idle { background: #e8f5e9; color: #2e7d32; }
.status-badge.in-progress { background: #fff3e0; color: #e65100; }
.menu-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  color: #666;
}
.menu-btn:hover { color: #222; }
.menu {
  position: absolute;
  right: 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  z-index: 10;
}
.menu-item {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.menu-item:hover { background: #f5f5f5; }
.menu-item.danger { color: #c62828; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
</style>
