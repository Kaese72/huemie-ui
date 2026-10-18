import { ref } from 'vue'

// Must match the inline script in index.html, which applies the theme before
// the app loads so the page never flashes the wrong one.
const STORAGE_KEY = 'humi-theme'

// Until the user picks a theme themselves, it follows the local time of day:
// light during the day, dark in the evening and at night.
const DAY_START_HOUR = 7
const DAY_END_HOUR = 19

function storedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function timeOfDayTheme(now = new Date()) {
  const hour = now.getHours()
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'light' : 'dark'
}

const theme = ref(document.documentElement.dataset.theme || storedTheme() || timeOfDayTheme())

function apply(value) {
  theme.value = value
  document.documentElement.dataset.theme = value
}

// Keep following the clock while the page stays open (e.g. across 19:00),
// unless the user has chosen a theme.
setInterval(() => {
  if (!storedTheme() && theme.value !== timeOfDayTheme()) apply(timeOfDayTheme())
}, 60 * 1000)

export function useTheme() {
  function toggleTheme() {
    const next = theme.value === 'dark' ? 'light' : 'dark'
    apply(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode etc.) - the choice just won't persist.
    }
  }

  return { theme, toggleTheme }
}
