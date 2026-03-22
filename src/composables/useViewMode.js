import { computed } from 'vue'
import { useRoute } from 'vue-router'

export const isMobileDevice = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768

export function useViewMode() {
  const route = useRoute()
  const viewMode = computed(() => route.path.startsWith('/mobile') ? 'mobile' : 'desktop')
  return { viewMode, isMobileDevice }
}
