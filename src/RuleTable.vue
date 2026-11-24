<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import TableShell from './components/TableShell.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import BoolBadge from './components/BoolBadge.vue'
import ChoiceDialog from './components/ChoiceDialog.vue'
import { useTableList } from './composables/useTableList.js'
import { readBlueprint, hasTargetIds, clearTargetIds, setPendingDraft } from './composables/useRuleBlueprint.js'

const router = useRouter()
const route = useRoute()

const columns = [
  { key: 'id', label: 'ID', width: '60px', sortable: true },
  { key: 'name', label: 'Name', sortable: true, filter: { type: 'text' } },
  { key: 'enabled', label: 'Enabled', width: '72px', filter: { type: 'boolean' } },
  // The device and group IDs the rule refers to (ittt-orchestrator derives
  // them from the conditions and actions); the id-list filter matches rules
  // involving any of the given IDs.
  { key: 'related-devices', label: 'Devices', width: '110px', filter: { type: 'id-list' } },
  { key: 'related-groups', label: 'Groups', width: '110px', filter: { type: 'id-list' } },
  { key: 'actions', label: 'Actions', width: '72px' },
  { key: 'cooldown', label: 'Cooldown', width: '72px' },
  // nullable: the date filter also offers "none"/"any" (is-null), i.e.
  // rules that are or aren't scheduled at all.
  { key: 'next-occurence', label: 'Next occurrence', width: '200px', filter: { type: 'date', nullable: true, nullLabels: { none: 'not scheduled', any: 'scheduled' } } },
]

function isCooldownActive(rule) {
  return rule['cooldown-until'] && new Date(rule['cooldown-until']) > new Date()
}

const selectedId = computed(() => route.params.id)
const creating = computed(() => route.name === 'RuleNew')

async function fetchPage({ offset, limit, filters, sort }) {
  const params = { offset, limit }
  if (filters) params.filters = filters
  if (sort) params.sort = sort
  const response = await axios.get('/ittt-orchestrator/v0/rules', { params })
  const rows = Array.isArray(response.data) ? response.data : []
  const totalHeader = response.headers['x-total-count']
  return { rows, total: totalHeader != null ? parseInt(totalHeader, 10) : rows.length }
}

const {
  rows: rules,
  error,
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

function onRowClick(rule) {
  if (String(rule.id) === String(selectedId.value)) {
    router.push({ name: 'Rules' })
  } else {
    router.push({ name: 'RuleDetail', params: { id: rule.id } })
  }
}

function createRule() {
  router.push({ name: 'RuleNew' })
}

// ── Paste a copied rule as an unsaved draft ──────────────────────────────────
const ID_CHOICES = [
  { value: 'clear', label: 'Clear IDs' },
  { value: 'keep', label: 'Keep IDs', primary: true },
]
const pasteError = ref('')
const pastedRule = ref(null) // waiting on the keep/clear IDs answer

async function pasteRule() {
  pasteError.value = ''
  const blueprint = await readBlueprint()
  if (!blueprint) {
    pasteError.value = 'Nothing to paste. Open a rule and click Copy rule first.'
    return
  }
  if (hasTargetIds(blueprint)) {
    pastedRule.value = blueprint
  } else {
    openDraft(blueprint, false)
  }
}

function onPasteChoice(choice) {
  const blueprint = pastedRule.value
  pastedRule.value = null
  if (choice === 'clear') {
    openDraft(clearTargetIds(blueprint), true)
  } else {
    openDraft(blueprint, false)
  }
}

function openDraft(blueprint, idsCleared) {
  const draft = setPendingDraft(blueprint, { idsCleared })
  router.push({ name: 'RuleNew', query: { draft } })
}

async function onRuleCreated(created) {
  // Pagination/total count shift when a rule is added, so refetch rather than pushing locally.
  await refresh()
  router.replace({ name: 'RuleDetail', params: { id: created.id } })
}

function onRuleUpdated(updated) {
  const idx = rules.value.findIndex(r => r.id === updated.id)
  if (idx !== -1) rules.value.splice(idx, 1, updated)
}

function onRuleDeleted() {
  router.push({ name: 'Rules' })
  // Pagination/total count shift when a rule disappears, so refetch rather than filtering locally.
  refresh()
}
</script>

<template>
  <div class="list-page">
    <div class="list-head">
      <div>
        <h1 class="list-title">Rules</h1>
        <p class="list-lede">When something happens at home, do something about it.</p>
      </div>
      <div class="list-actions">
        <button class="btn btn-ghost" title="Paste a copied rule as a new, unsaved rule" @click="pasteRule">Paste rule</button>
        <button class="btn btn-primary" @click="createRule">New rule</button>
      </div>
    </div>
    <div v-if="error" class="alert alert-error">Error: {{ error.message }}</div>
    <div v-if="pasteError" class="alert alert-error">{{ pasteError }}</div>
    <div class="split-content">
      <TableShell
        :columns="columns"
        :rows="rules"
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
        <template #cell-enabled="{ row }"><BoolBadge :value="row.enabled" /></template>
        <template #cell-related-devices="{ row }">
          <span v-if="row['related-devices']?.length" class="mono" :title="row['related-devices'].join(', ')">{{ row['related-devices'].join(', ') }}</span>
          <span v-else class="na">—</span>
        </template>
        <template #cell-related-groups="{ row }">
          <span v-if="row['related-groups']?.length" class="mono" :title="row['related-groups'].join(', ')">{{ row['related-groups'].join(', ') }}</span>
          <span v-else class="na">—</span>
        </template>
        <template #cell-actions="{ row }">{{ row.actions?.length ?? 0 }}</template>
        <template #cell-cooldown="{ row }">
          <span v-if="isCooldownActive(row)" class="badge badge-neutral" :title="`Cooling down until ${new Date(row['cooldown-until']).toLocaleString()}`">
            {{ new Date(row['cooldown-until']).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }}
          </span>
          <span v-else class="na">—</span>
        </template>
        <template #cell-next-occurence="{ row }">
          <template v-if="row['next-occurence']">{{ new Date(row['next-occurence']).toLocaleString(undefined, { timeZoneName: 'short' }) }}</template>
          <span v-else class="na">—</span>
        </template>
        <template #empty>
          <div class="table-empty">
            <p>No rules yet.</p>
            <p>Click <strong>New rule</strong> to create one.</p>
          </div>
        </template>
      </TableShell>

      <DetailOverlay v-if="selectedId || creating">
        <router-view @created="onRuleCreated" @updated="onRuleUpdated" @deleted="onRuleDeleted" />
      </DetailOverlay>
    </div>

    <ChoiceDialog
      :show="!!pastedRule"
      title="Keep device and group IDs?"
      message="This rule refers to specific devices and groups. Keep them, or clear them and pick new ones before saving."
      :options="ID_CHOICES"
      @choose="onPasteChoice"
      @close="pastedRule = null"
    />
  </div>
</template>
