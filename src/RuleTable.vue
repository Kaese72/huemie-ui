<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const rules = ref([])
const error = ref(null)
const router = useRouter()
const route = useRoute()

const selectedId = computed(() => route.params.id)

onMounted(async () => {
  try {
    const response = await axios.get('/ittt-orchestrator/v0/rules')
    rules.value = Array.isArray(response.data) ? response.data : []
  } catch (err) {
    error.value = err
  }
})

function onRowClick(rule) {
  if (selectedId.value == rule.id) {
    router.push({ name: 'Rules' })
  } else {
    router.push({ name: 'RuleDetail', params: { id: rule.id } })
  }
}

async function createRule() {
  try {
    const response = await axios.post('/ittt-orchestrator/v0/rules', {
      name: 'New rule',
      enabled: false,
    })
    const created = response.data
    rules.value.push(created)
    router.push({ name: 'RuleDetail', params: { id: created.id } })
  } catch (err) {
    error.value = err
  }
}

function onRuleUpdated(updated) {
  const idx = rules.value.findIndex(r => r.id === updated.id)
  if (idx !== -1) rules.value.splice(idx, 1, updated)
}

function onRuleDeleted(id) {
  rules.value = rules.value.filter(r => r.id !== id)
  router.push({ name: 'Rules' })
}
</script>

<template>
  <div class="split-layout">
    <div class="list-pane" :class="{ half: selectedId }">
      <div class="pane-header">
        <h1>Rules</h1>
        <button class="btn-create" @click="createRule">+ New rule</button>
      </div>
      <div v-if="error" class="error">Error: {{ error.message }}</div>
      <div v-if="rules.length > 0" class="table-wrapper">
        <div class="table-header">
          <div class="cell cell-id">ID</div>
          <div class="cell cell-name">Name</div>
          <div class="cell cell-enabled">Enabled</div>
          <div class="cell cell-count">Actions</div>
        </div>
        <div
          v-for="rule in rules" :key="rule.id"
          class="table-row"
          :class="{ selected: rule.id == selectedId }"
          @click="onRowClick(rule)"
        >
          <div class="cell cell-id">{{ rule.id }}</div>
          <div class="cell cell-name">{{ rule.name }}</div>
          <div class="cell cell-enabled">{{ rule.enabled ? '✓' : '—' }}</div>
          <div class="cell cell-count">{{ rule.actions?.length ?? 0 }}</div>
        </div>
      </div>
      <div v-else-if="!error" class="empty">
        <p>No rules yet.</p>
        <p>Click <strong>+ New rule</strong> to create one.</p>
      </div>
    </div>

    <div v-if="selectedId" class="detail-pane">
      <router-view @updated="onRuleUpdated" @deleted="onRuleDeleted" />
    </div>
  </div>
</template>

<style scoped>
.split-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.list-pane {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  transition: max-width 0.3s;
}
.list-pane.half {
  max-width: 40%;
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
}
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
.table-row.selected { background: #e6f7ff; }
.cell {
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-id      { width: 60px;  flex-shrink: 0; font-weight: bold; }
.cell-name    { flex: 1; min-width: 0; }
.cell-enabled { width: 72px;  flex-shrink: 0; text-align: center; }
.cell-count   { width: 72px;  flex-shrink: 0; text-align: center; }
.empty {
  padding: 2rem 1rem;
  color: #999;
  font-style: italic;
  text-align: center;
}
.empty p { margin: 0.25rem 0; }
.detail-pane {
  flex: 1;
  border-left: 1px solid #ddd;
  background: #fff;
  overflow-y: auto;
  padding: 1.5rem;
  min-width: 0;
}
</style>
