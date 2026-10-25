<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import AiControlTabs from './components/AiControlTabs.vue'
import { useTableList } from './composables/useTableList.js'

const router = useRouter()
const route = useRoute()
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
  // selectedId.value is a string while conversation.id is a number, thus we
  // can not do a ===
  if (selectedId.value == conversation.id) {
    // If already selected, close detail view
    router.push({ name: 'AIControl' })
  } else {
    router.push({ name: 'AIControlChat', params: { id: conversation.id } })
  }
}

// Only AIControlChat has a real row to highlight - the "new chat" detail
// pane (AIControlNew) has no row of its own, but TableShell still needs a
// non-null selectedId to reserve trailing scroll space for the open overlay,
// hence the sentinel (it will never match a real conversation id).
const selectedId = computed(() => {
  if (route.name === 'AIControlChat') return route.params.id
  if (route.name === 'AIControlNew') return '__new__'
  return null
})
const showDetail = computed(() => selectedId.value != null)

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
  <div class="list-page">
    <div class="list-head">
      <div>
        <h1 class="list-title">AI Control</h1>
        <p class="list-lede">Ask an assistant to look at and act on your home.</p>
      </div>
      <div class="list-actions">
        <AiControlTabs />
        <button class="btn btn-primary" @click="router.push({ name: 'AIControlNew' })">New chat</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
    <div class="split-content">
      <TableShell
        :columns="columns"
        :rows="conversations"
        :selected-id="selectedId"
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
          <span v-if="row.status === 'AGENT_IN_PROGRESS'" class="badge badge-warm"><span class="pulse-dot" />Thinking…</span>
          <span v-else class="badge badge-green">Waiting for you</span>
        </template>
        <template #cell-initiative="{ row }">{{ row.initiative === 'AGENT' ? 'Agent' : 'User' }}</template>
        <template #cell-updated="{ row }">{{ new Date(row.updated).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
        <template #cell-actions="{ row }">
          <button class="icon-btn menu-btn" title="More" aria-label="More" @click="toggleMenu(row.id, $event)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v.01M12 12v.01M12 18.5v.01" /></svg>
          </button>
          <div v-if="openMenuId === row.id" class="menu" @click.stop>
            <button class="menu-item danger" @click="forgetConversation(row, $event)">Forget conversation</button>
          </div>
        </template>
        <template #empty>
          <div v-if="ready" class="table-empty">
            <p>No conversations match the current filters.</p>
          </div>
        </template>
      </TableShell>
      <DetailOverlay v-if="showDetail">
        <router-view />
      </DetailOverlay>
    </div>
  </div>
</template>

<style scoped>
.menu-btn {
  width: 28px;
  height: 28px;
}
.menu-btn svg {
  stroke-width: 3;
}
.menu {
  position: absolute;
  right: 1rem;
  padding: 6px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: 14px;
  box-shadow: 0 16px 40px color-mix(in srgb, var(--shadow-ink) 30%, transparent);
  z-index: 10;
  animation: ui-rise 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 9px;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  color: var(--text);
  white-space: nowrap;
}
.menu-item:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
.menu-item.danger { color: var(--danger-ink); }
.menu-item.danger:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }
</style>
