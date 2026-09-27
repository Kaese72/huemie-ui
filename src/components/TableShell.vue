<script setup>
// TableShell is the shared div-grid table used by every list view
// (Adapters/Devices/Groups/Rules/Users/AI Control). It owns the grid
// markup/CSS, the pagination footer, the sortable-header click/arrow UI,
// and wiring a ColumnFilter into any column that declares itself
// filterable. It is purely presentational/stateless: page/filter/sort
// STATE and the actual fetch live in the parent, via useTableList.js.
//
// Custom per-column cell content (badges, action buttons, tooltips, ...)
// is provided by the parent through a `cell-<key>` scoped slot; slot
// content is compiled in the PARENT's template scope, so each page's own
// <style scoped> classes for that content keep working unchanged.
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ColumnFilter from './ColumnFilter.vue'
import { ROW_HEIGHT_PX, HEADER_HEIGHT_PX, MIN_PAGE_SIZE, RESIZE_DEBOUNCE_MS, DETAIL_OVERLAY_WIDTH } from '../composables/tableLayout.js'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  selectedId: { type: [String, Number], default: null },
  columnFilters: { type: Object, default: () => ({}) },
  sort: { type: Object, default: null },
  attributeStats: { type: Object, default: () => ({}) },
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
function cellStyle(col) {
  return { flex: `0 0 ${col.width || '240px'}` }
}

function onHeaderClick(col) {
  if (!col.sortable) return
  let next
  if (!props.sort || props.sort.field !== col.key) {
    next = { field: col.key, direction: 'asc' }
  } else if (props.sort.direction === 'asc') {
    next = { field: col.key, direction: 'desc' }
  } else {
    next = null
  }
  emit('sort-change', next)
}

function sortIndicator(col) {
  if (!props.sort || props.sort.field !== col.key) return ''
  return props.sort.direction === 'asc' ? '▲' : '▼'
}
</script>

<template>
  <div class="table-shell" :style="shellStyle">
    <div class="table-wrapper" ref="tableWrapperRef">
      <div class="table-header">
        <div
          v-for="col in columns"
          :key="col.key"
          class="table-cell header-cell"
          :class="{ sortable: col.sortable }"
          :style="cellStyle(col)"
          @click="onHeaderClick(col)"
        >
          <span class="header-label">{{ col.label }}</span>
          <span v-if="col.sortable" class="sort-indicator">{{ sortIndicator(col) }}</span>
          <ColumnFilter
            v-if="col.filter"
            :type="col.filter.type"
            :stats="col.filter.type === 'attribute' ? attributeStats[col.filter.statsKey] : null"
            :operators="col.filter.operators || null"
            :active="!!columnFilters[col.key]"
            @click.stop
            @apply="filter => emit('filter-apply', col.key, filter)"
            @clear="() => emit('filter-clear', col.key)"
          />
        </div>
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
}
.header-cell {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.header-cell.sortable {
  cursor: pointer;
}
.header-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sort-indicator {
  font-size: 0.7rem;
  color: #1890ff;
  flex-shrink: 0;
}

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
