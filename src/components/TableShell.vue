<script setup>
// TableShell is the shared div-grid table used by every list view
// (Adapters/Devices/Groups/Rules/Users/AI Control). It owns the grid
// markup/CSS, the pagination footer, and delegates each header cell to
// TableHeaderCell, which owns the combined ordering/filtering dialog for
// any column that declares itself sortable and/or filterable. TableShell
// itself is purely presentational/stateless: page/filter/sort STATE and
// the actual fetch live in the parent, via useTableList.js.
//
// Custom per-column cell content (badges, action buttons, tooltips, ...)
// is provided by the parent through a `cell-<key>` scoped slot; slot
// content is compiled in the PARENT's template scope, so each page's own
// <style scoped> classes for that content keep working unchanged.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import TableHeaderCell from './TableHeaderCell.vue'
import { ROW_HEIGHT_PX, HEADER_HEIGHT_PX, MIN_PAGE_SIZE, RESIZE_DEBOUNCE_MS, DETAIL_OVERLAY_WIDTH } from '../composables/tableLayout.js'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  selectedId: { type: [String, Number], default: null },
  columnFilters: { type: Object, default: () => ({}) },
  sort: { type: Object, default: null },
  attributeStats: { type: Object, default: () => ({}) },
  // Whether a fetch this table triggered is currently in flight - fed to
  // each column's header dialog so it can show "applying" vs. "applied"
  // for the filter edit it just debounced into a request.
  loading: { type: Boolean, default: false },
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  pageWindow: { type: Array, required: true },
  showFirst: { type: Boolean, required: true },
  showLast: { type: Boolean, required: true },
})

const emit = defineEmits(['row-click', 'go-to-page', 'filter-apply', 'filter-clear', 'sort-change', 'resize'])

const tableWrapperRef = ref(null)
let resizeObserver = null
let resizeDebounceTimer = null

function calculatePageSize() {
  const el = tableWrapperRef.value
  if (!el || el.clientHeight === 0) return null
  const availableHeight = el.clientHeight - HEADER_HEIGHT_PX
  return Math.max(MIN_PAGE_SIZE, Math.floor(availableHeight / ROW_HEIGHT_PX))
}

function emitResize() {
  const size = calculatePageSize()
  if (size != null) emit('resize', size)
}

function handleResize() {
  clearTimeout(resizeDebounceTimer)
  resizeDebounceTimer = setTimeout(emitResize, RESIZE_DEBOUNCE_MS)
}

onMounted(() => {
  // The wrapper is already laid out by the time onMounted fires (no data
  // dependency - its height comes from the surrounding flex layout, not
  // from row content), so this can measure and emit immediately.
  emitResize()
  if (tableWrapperRef.value && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(tableWrapperRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  clearTimeout(resizeDebounceTimer)
})

function isSelected(row) {
  return props.selectedId != null && String(row[props.rowKey]) === String(props.selectedId)
}

// When a detail overlay is open (selectedId set), TableShell narrows itself
// to the region the overlay doesn't cover, rather than staying full-width
// underneath it. A reserved-padding approach (narrowing only the scrollable
// content while the .table-wrapper box itself stayed full-width) turned out
// unreliable: the browser's native horizontal scrollbar still rendered at
// the .table-wrapper's own full-width bottom edge, so its right half - and
// any content scrolled into that region - ended up physically covered by
// the overlay again, unreachable. Narrowing the whole shell instead keeps
// the scrollbar, header and every column entirely within the visible area,
// with no overlap possible. Page-level chrome outside TableShell (titles,
// create buttons, ...) is unaffected, since only TableShell's own box
// shrinks - it never triggers a page reflow the way the original two-column
// flex layout did.
const shellStyle = computed(() => (
  props.selectedId != null ? { width: `calc(100% - ${DETAIL_OVERLAY_WIDTH})` } : {}
))

// Fixed width, never shrinking or growing (flex-shrink/grow both 0): the
// header and every row are separate flex containers (one per <div
// class="table-row">), so if columns were allowed to shrink/grow, each
// container could resolve their widths slightly differently whenever
// available width varied even by a pixel - desyncing header from data
// columns. A hard fixed width is what makes them stay pixel-identical, at
// the cost of trailing empty space if the table is wider than its content
// (acceptable - the alternative is columns drifting).
//
// columnMinWidths (from each TableHeaderCell, once it knows how much room
// its own label/icons actually need) and columnWidths (only set once a
// column's resize handle is dragged) both live only in this component's
// memory - neither is persisted, so a reload goes back to each column's
// declared `width` (or the shared default) floored by its header's
// min-width.
const columnMinWidths = ref({})
const columnWidths = ref({})

function onMinWidthComputed(col, px) {
  if (columnMinWidths.value[col.key] === px) return
  columnMinWidths.value = { ...columnMinWidths.value, [col.key]: px }
}

function onResizeColumn(col, px) {
  columnWidths.value = { ...columnWidths.value, [col.key]: px }
}

function baseWidthOf(col) {
  const override = columnWidths.value[col.key]
  if (override != null) return override
  const parsed = col.width ? parseInt(col.width, 10) : NaN
  return Number.isFinite(parsed) ? parsed : 240
}

function cellStyle(col) {
  const min = columnMinWidths.value[col.key] || 0
  return { flex: `0 0 ${Math.max(baseWidthOf(col), min)}px` }
}

</script>

<template>
  <div class="table-shell" :style="shellStyle">
    <div class="table-wrapper" ref="tableWrapperRef">
      <div class="table-header">
        <TableHeaderCell
          v-for="col in columns"
          :key="col.key"
          :col="col"
          :sort="sort"
          :filter-value="columnFilters[col.key] || null"
          :stats="col.filter && col.filter.type === 'attribute' ? attributeStats[col.filter.statsKey] : null"
          :loading="loading"
          :style="cellStyle(col)"
          @sort-change="next => emit('sort-change', next)"
          @filter-apply="filter => emit('filter-apply', col.key, filter)"
          @filter-clear="() => emit('filter-clear', col.key)"
          @min-width-computed="px => onMinWidthComputed(col, px)"
          @resize-column="px => onResizeColumn(col, px)"
        />
      </div>
      <div
        v-for="row in rows"
        :key="row[rowKey]"
        class="table-row"
        :class="{ selected: isSelected(row) }"
        @click="emit('row-click', row)"
      >
        <div v-for="col in columns" :key="col.key" class="table-cell" :style="cellStyle(col)">
          <slot :name="'cell-' + col.key" :row="row">{{ row[col.key] }}</slot>
        </div>
      </div>
      <slot v-if="rows.length === 0" name="empty" />
    </div>
    <div class="pagination-footer">
      <button v-if="showFirst" class="page-btn" @click="emit('go-to-page', 0)">0</button>
      <button class="page-btn nav-btn" :disabled="currentPage === 0" title="Previous page" aria-label="Previous page" @click="emit('go-to-page', currentPage - 1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
      </button>
      <button
        v-for="p in pageWindow"
        :key="p"
        class="page-btn"
        :class="{ current: p === currentPage }"
        :disabled="p === currentPage"
        @click="emit('go-to-page', p)"
        :aria-current="p === currentPage ? 'page' : null"
      >{{ p }}</button>
      <button class="page-btn nav-btn" :disabled="currentPage === totalPages - 1" title="Next page" aria-label="Next page" @click="emit('go-to-page', currentPage + 1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </button>
      <button v-if="showLast" class="page-btn" @click="emit('go-to-page', totalPages - 1)">{{ totalPages - 1 }}</button>
    </div>
  </div>
</template>

<style scoped>
/* See DESIGN.md (this repo), section 4 "Tables". Row and header heights
   must stay 40px - they are ROW_HEIGHT_PX / HEADER_HEIGHT_PX in
   tableLayout.js, which the page size is calculated from. */
.table-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s;
  /* The whole table area (header, rows, footer) sits in one panel. */
  border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  border-radius: 20px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--ink) 3.5%, transparent),
    color-mix(in srgb, var(--ink) 1.5%, transparent));
  box-sizing: border-box;
}
.table-wrapper {
  width: 100%;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
}
.table-header, .table-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: max-content;
  box-sizing: border-box;
  height: 40px;
}
.table-header {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--faint);
  background: color-mix(in srgb, var(--ink) 3%, var(--bg));
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  /* top-only: .table-wrapper's overflow-y is hidden (pagination, not
     vertical scroll, changes pages), so this is inert today but harmless -
     left:0 was deliberately dropped: it stuck the header at the viewport's
     left edge while .table-row's scrolled normally underneath, permanently
     desyncing header labels from their columns as soon as anything scrolled
     horizontally. */
  position: sticky;
  top: 0;
  z-index: 1;
}
.table-row {
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text);
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 6%, transparent);
  transition: background 0.2s, box-shadow 0.2s;
}
.table-row:hover {
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}
/* Selected (detail open): green tint plus a bar on the left edge. An inset
   shadow, so nothing in the row moves. */
.table-row.selected {
  background: color-mix(in srgb, var(--green) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--green);
}
.table-cell {
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
  /* Same faint column dividers as .header-cell (TableHeaderCell.vue), so
     rows read as distinct columns. */
  border-left: 1px solid color-mix(in srgb, var(--ink) 4%, transparent);
  border-right: 1px solid color-mix(in srgb, var(--ink) 4%, transparent);
  margin-left: -1px;
}
/* .header-cell's own layout (flex/gap/clickable cursor), .header-label,
   .sort-indicator and .filter-dot are all styled in TableHeaderCell.vue,
   which owns that markup now - only .table-cell above (shared with plain
   data cells) still needs to live here. */

/* Pagination footer */
.pagination-footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 48px;
  border-top: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
}
.page-btn {
  display: inline-grid;
  place-items: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
  transition: background 0.2s, color 0.2s;
}
.page-btn:hover:not(:disabled) {
  color: var(--text);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.page-btn:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}
.page-btn:disabled {
  cursor: default;
  opacity: 0.35;
}
.page-btn.current {
  font-weight: 700;
  color: var(--text);
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  opacity: 1;
  cursor: default;
}
.nav-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
