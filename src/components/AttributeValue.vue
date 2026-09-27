<script setup>
// Renders a device attribute's extracted value (see utils/deviceUtil.js):
// a real boolean gets the shared BoolBadge circle, the 'Unknown' sentinel
// (attribute missing/unset) becomes a faint "N/A" rather than the word
// "Unknown", and anything else (a string/number attribute value) is shown
// as plain text same as before.
import BoolBadge from './BoolBadge.vue'

defineProps({
  value: { default: null },
  tooltip: { type: String, default: null },
})
</script>

<template>
  <BoolBadge v-if="typeof value === 'boolean'" :value="value" :title="tooltip" />
  <span
    v-else-if="value === 'Unknown' || value === null || value === undefined"
    class="value-na"
    :title="tooltip || 'No value'"
  >N/A</span>
  <span v-else :title="tooltip">{{ value }}</span>
</template>

<style scoped>
.value-na {
  color: #888;
  opacity: 0.4;
}
</style>
