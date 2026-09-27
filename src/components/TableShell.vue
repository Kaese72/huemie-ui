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
      <button class="page-btn nav-btn" :disabled="currentPage === 0" @click="emit('go-to-page', currentPage - 1)">&lt;</button>
      <button
        v-for="p in pageWindow"
        :key="p"
        class="page-btn"
        :class="{ current: p === currentPage }"
        :disabled="p === currentPage"
        @click="emit('go-to-page', p)"
      >{{ p === currentPage ? `[${p}]` : p }}</button>
      <button class="page-btn nav-btn" :disabled="currentPage === totalPages - 1" @click="emit('go-to-page', currentPage + 1)">&gt;</button>
      <button v-if="showLast" class="page-btn" @click="emit('go-to-page', totalPages - 1)">{{ totalPages - 1 }}</button>
    </div>
  </div>
</template>

<style scoped>
.table-shell {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s;
  /* Divides the whole table area (header, rows, footer) from the
     surrounding page on every side, not just the shadow that previously
     only separated the header from what's below it. */
  border: 1px solid #ddd;
  border-radius: 4px;
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
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
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
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
}
.table-row.selected {
  background: #e6f7ff;
}
.table-cell {
  padding: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
  /* Same left/right divider treatment as .header-cell (TableHeaderCell.vue),
     so rows read as distinct columns rather than one continuous strip -
     previously only the header had this. */
  border-left: 1px solid rgba(0, 0, 0, 0.08);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
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
  gap: 0.35rem;
  height: 44px;
  border-top: 2px solid #ddd;
  background: #f5f5f5;
}
.page-btn {
  min-width: 2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font: inherit;
}
.page-btn:hover:not(:disabled) {
  background: #e6f7ff;
}
.page-btn:disabled {
  cursor: default;
  opacity: 0.4;
}
.page-btn.current {
  font-weight: bold;
  border-color: #1890ff;
  color: #1890ff;
  background: #fff;
  cursor: default;
}
.nav-btn {
  font-weight: bold;
}
</style>
