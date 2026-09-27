// Shared layout constants for TableShell.vue and useTableList.js. These must
// match the fixed heights set on TableShell's own .table-header/.table-row/
// .pagination-footer CSS - previously duplicated (identically, by luck) in
// every one of the six table views; now a single source of truth.
export const ROW_HEIGHT_PX = 40
export const HEADER_HEIGHT_PX = 40
export const MIN_PAGE_SIZE = 1
export const RESIZE_DEBOUNCE_MS = 300
export const PAGE_WINDOW_RADIUS = 2

// Shared with DetailOverlay.vue: when a detail panel is open, TableShell
// reserves this much trailing space on every row so scrolling all the way
// right still stops before the overlay - otherwise the overlay (which floats
// on top rather than shrinking the table) would permanently hide whatever
// content ends up underneath it, with no way to scroll it into view.
export const DETAIL_OVERLAY_WIDTH = '50%'
