import { ref } from 'vue'

const title = ref('Huemie')

export function useMobileTitle() {
  return { title }
}
