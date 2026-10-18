import { ref, watch } from 'vue'
import axios from 'axios'
import { useAuth } from './useAuth.js'

// The signed-in user's record, fetched once and shared (UserChip shows the
// name). Same interface as cloud-ui's useCurrentUser, so the shared
// UserChip.vue can be copied across unchanged. Any failure just leaves it
// empty - the chip then falls back to "Your account".
const user = ref(null)
let loadedFor = null

function load(id) {
  if (id == null) {
    user.value = null
    loadedFor = null
    return
  }
  if (loadedFor === id) return
  loadedFor = id
  axios.get(`/authentication-service/v0/users/${id}`)
    .then(response => { if (loadedFor === id) user.value = response.data })
    .catch(() => {})
}

let watching = false

export function useCurrentUser() {
  if (!watching) {
    watching = true
    const { currentUserId } = useAuth()
    watch(currentUserId, load, { immediate: true })
  }
  return { user }
}
