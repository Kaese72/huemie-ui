import { ref, readonly } from 'vue'

function detectMobile() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
}

const isMobileDevice = detectMobile()
const viewMode = ref(isMobileDevice ? 'mobile' : 'desktop')

export function useViewMode() {
  function toggleViewMode() {
    if (isMobileDevice) return
    viewMode.value = viewMode.value === 'desktop' ? 'mobile' : 'desktop'
  }

  return {
    viewMode: readonly(viewMode),
    isMobileDevice,
    toggleViewMode,
  }
}
