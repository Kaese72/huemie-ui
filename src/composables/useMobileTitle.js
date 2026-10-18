import { ref } from 'vue'

const title = ref('Humi')

export function useMobileTitle() {
  return { title }
}
