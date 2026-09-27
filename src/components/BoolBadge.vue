<script setup>
// A small circular badge for a plain boolean value: a green circle with a
// white checkmark for true, a plain grey circle for false. Shared by every
// table that shows a boolean column/attribute, so they all read the same
// way at a glance.
defineProps({
  value: { type: Boolean, required: true },
  title: { type: String, default: null },
})
</script>

<template>
  <span class="bool-badge" :title="title || (value ? 'True' : 'False')">
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="8" :fill="value ? '#52c41a' : '#c9c9c9'" />
      <path
        v-if="value"
        d="M4.6 8.3l2.1 2.1 4.7-4.9"
        fill="none"
        stroke="white"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.bool-badge {
  display: inline-flex;
  align-items: center;
}
</style>
