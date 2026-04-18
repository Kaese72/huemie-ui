import { ref, computed } from 'vue'
import axios from 'axios'

// Module-level state — shared across all component instances.
const timezones = ref([])
let fetchStarted = false

export function useTimezones() {
  if (!fetchStarted) {
    fetchStarted = true
    axios.get('/ittt-orchestrator/v0/globals/timezones')
      .then(res => { timezones.value = Array.isArray(res.data) ? res.data : [] })
      .catch(err => { console.error('Failed to load timezone list from server:', err) })
  }
  return timezones
}

// Resolved once the server list has loaded. Falls back to UTC with a console
// warning if the browser's reported timezone is not in the server's list.
const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
let warned = false

export const localTimezone = computed(() => {
  if (timezones.value.length === 0) return 'UTC'
  if (timezones.value.includes(browserTz)) return browserTz
  if (!warned) {
    warned = true
    console.warn(
      `Browser timezone "${browserTz}" is not in the server's timezone list — defaulting to UTC`
    )
  }
  return 'UTC'
})
