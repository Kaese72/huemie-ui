<script setup>
// A detail pane that floats over its sibling table rather than shrinking it,
// so the table stays full-width and fully interactive (scrollable, sortable,
// filterable, paginable) while a row's detail is open. The parent just needs
// `position: relative` on the containing element (see e.g. GroupTable.vue's
// .split-content) so this can anchor to it instead of the viewport.
//
// Width defaults to the same DETAIL_OVERLAY_WIDTH that TableShell reserves
// trailing scroll space for - keep them in sync (both read from
// tableLayout.js) so scrolling a table all the way right lines up exactly
// with this panel's left edge, rather than hiding content underneath it.
import { DETAIL_OVERLAY_WIDTH } from '../composables/tableLayout.js'

defineProps({
  width: { type: String, default: DETAIL_OVERLAY_WIDTH },
})
</script>

<template>
  <div class="detail-overlay" :style="{ width }">
    <slot />
  </div>
</template>

<style scoped>
/* DESIGN.md, section 5: a surface pane sliding in from the right. */
.detail-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  max-width: 100%;
  background: var(--surface);
  color: var(--text);
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  border-right: none;
  border-radius: 20px 0 0 20px;
  box-shadow: -12px 0 40px color-mix(in srgb, var(--shadow-ink) 30%, transparent);
  overflow-y: auto;
  padding: 24px 28px 32px;
  box-sizing: border-box;
  z-index: 10;
  animation: overlay-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes overlay-in {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .detail-overlay { animation: none; }
}
</style>
