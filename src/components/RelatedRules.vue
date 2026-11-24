<script setup>
// RelatedRules lists the automation rules involving one device or group, as
// fetched by useRelatedRules, on that device's/group's detail page. Each
// row links to the rule and says where the rule uses it: in its conditions
// (devices only - conditions never reference groups), as an action target,
// or both.
import BoolBadge from './BoolBadge.vue'

const props = defineProps({
  kind: { type: String, required: true }, // 'device' | 'group'
  targetId: { type: [Number, String], required: true },
  rules: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
})

function treeReferencesDevice(node, id) {
  if (!node) return false
  const condition = node.condition
  if (condition?.type?.startsWith('device-id-attribute-') && String(condition.id) === id) return true
  return treeReferencesDevice(node.and, id) || treeReferencesDevice(node.or, id)
}

function usage(rule) {
  const id = String(props.targetId)
  const actionType = props.kind === 'device' ? 'device-capability' : 'group-capability'
  const inActions = (rule.actions || []).some(a => a.type === actionType && String(a.id) === id)
  const inConditions = props.kind === 'device' && treeReferencesDevice(rule['condition-tree'], id)
  if (inConditions && inActions) return 'Conditions and actions'
  if (inConditions) return 'Conditions'
  if (inActions) return 'Actions'
  return '—'
}
</script>

<template>
  <div v-if="error" class="alert alert-error">Error loading automation rules: {{ error.message }}</div>
  <p v-else-if="loading && !rules.length" class="empty">Loading…</p>
  <p v-else-if="!rules.length" class="empty">No automation rules involve this {{ kind }}.</p>
  <table v-else class="data-table">
    <thead>
      <tr>
        <th>Rule</th>
        <th>Enabled</th>
        <th>Used in</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="rule in rules" :key="rule.id">
        <td><router-link :to="{ name: 'RuleDetail', params: { id: rule.id } }">{{ rule.name }}</router-link></td>
        <td><BoolBadge :value="rule.enabled" /></td>
        <td class="muted">{{ usage(rule) }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.muted {
  color: var(--muted);
}
</style>
