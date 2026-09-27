import { ref, computed } from 'vue'
import { MIN_PAGE_SIZE, PAGE_WINDOW_RADIUS } from './tableLayout.js'

// useTableList owns the endpoint-agnostic half of a paginated/filterable/
// sortable table view: page-size/current-page/total-count state, the
// {field,operator,value}/{field,direction} wire-format param builders
// matching the shared huemie-lib/query backend contract, and refetch
// orchestration (on filter/sort/page/page-size change, and step-back-a-page
// if the current page becomes empty).
//
// `fetchPage({ offset, limit, filters, sort }) => Promise<{ rows, total }>`
// is the one thing each view still owns itself, since the endpoint and
// response shape (a bare array vs e.g. AIControlTable's
// `response.data.conversations`) differ per view.
//
// Page sizing itself is NOT computed here: TableShell.vue measures its own
// rendered container height (only it knows the actual row/header heights in
// the DOM) and calls onResize(newPageSize) - including once, right after its
// own first mount, which is what triggers this composable's very first
// fetch.
export function useTableList({ fetchPage }) {
  const rows = ref([])
  const error = ref(null)
  const pageSize = ref(MIN_PAGE_SIZE)
  const currentPage = ref(0) // 0-indexed
  const totalCount = ref(0)
  const columnFilters = ref({}) // { [field]: { op, value } }
  const sort = ref(null) // { field, direction } | null
  // ready flips true once the first fetch has resolved, so callers can tell
  // "genuinely no rows yet" apart from "haven't loaded yet" (e.g. to decide
  // whether to redirect on a truly-empty list - see AIControlTable).
  const ready = ref(false)
  let sized = false

  const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

  const pageWindow = computed(() => {
    const pages = []
    const start = Math.max(0, currentPage.value - PAGE_WINDOW_RADIUS)
    const end = Math.min(totalPages.value - 1, currentPage.value + PAGE_WINDOW_RADIUS)
    for (let p = start; p <= end; p++) pages.push(p)
    return pages
  })
  const showFirst = computed(() => pageWindow.value.length === 0 || pageWindow.value[0] > 0)
  const showLast = computed(() => pageWindow.value.length === 0 || pageWindow.value[pageWindow.value.length - 1] < totalPages.value - 1)

  function buildFiltersParam() {
    const entries = Object.entries(columnFilters.value)
    if (entries.length === 0) return undefined
    return JSON.stringify(entries.map(([field, filter]) => ({ field, operator: filter.op, value: filter.value })))
  }

  function buildSortParam() {
    if (!sort.value) return undefined
    return JSON.stringify([{ field: sort.value.field, direction: sort.value.direction }])
  }

  async function fetchCurrentPage() {
    try {
      const offset = currentPage.value * pageSize.value
      const { rows: newRows, total } = await fetchPage({
        offset,
        limit: pageSize.value,
        filters: buildFiltersParam(),
        sort: buildSortParam(),
      })
      rows.value = newRows
      totalCount.value = total
      // If the current page no longer exists (e.g. rows were removed, or a
      // filter now matches fewer pages), step back and refetch.
      const maxPage = Math.max(0, totalPages.value - 1)
      if (currentPage.value > maxPage) {
        currentPage.value = maxPage
        await fetchCurrentPage()
        return
      }
      error.value = null
    } catch (err) {
      error.value = err
    } finally {
      ready.value = true
    }
  }

  function goToPage(page) {
    const clamped = Math.min(Math.max(0, page), totalPages.value - 1)
    if (clamped === currentPage.value) return
    currentPage.value = clamped
    fetchCurrentPage()
  }

  function onResize(newPageSize) {
    if (!sized) {
      // First measurement, right after TableShell's own mount - this is
      // what kicks off the very first fetch.
      sized = true
      pageSize.value = newPageSize
      fetchCurrentPage()
      return
    }
    if (newPageSize === pageSize.value) return
    // Keep viewing roughly the same rows when the page size changes.
    const firstVisibleIndex = currentPage.value * pageSize.value
    pageSize.value = newPageSize
    currentPage.value = Math.floor(firstVisibleIndex / newPageSize)
    fetchCurrentPage()
  }

  function onColumnFilterApply(key, filter) {
    columnFilters.value = { ...columnFilters.value, [key]: filter }
    currentPage.value = 0
    fetchCurrentPage()
  }

  function onColumnFilterClear(key) {
    if (!(key in columnFilters.value)) return
    const next = { ...columnFilters.value }
    delete next[key]
    columnFilters.value = next
    currentPage.value = 0
    fetchCurrentPage()
  }

  function onSortChange(next) {
    sort.value = next
    currentPage.value = 0
    fetchCurrentPage()
  }

  return {
    rows,
    error,
    ready,
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
    refresh: fetchCurrentPage,
  }
}
