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
.detail-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  max-width: 100%;
  background: #fff;
  border-left: 1px solid #ddd;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  padding-left: 2rem;
  box-sizing: border-box;
  z-index: 10;
}
</style>
