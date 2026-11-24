import { ref, watch } from 'vue'
import axios from 'axios'
import { useAuth } from './useAuth.js'

// ittt-orchestrator's list endpoint caps a page at 200; a single device or
// group is never involved in anywhere near that many rules.
const LIMIT = 200

// useRelatedRules fetches the automation rules that involve one device or
// group, using ittt-orchestrator's related-devices / related-groups filter
// (the IDs it derives from each rule's conditions and actions).
//
// `field` is 'related-devices' or 'related-groups'; `idSource` is a getter
// for the device/group ID. It fetches immediately and again whenever the ID
// changes, i.e. when the detail page opens, not when a tab is selected.
// Without view access to automation rules nothing is fetched and
// `available` is false, so the page can leave the section out instead of
// showing a 403.
export function useRelatedRules(field, idSource) {
  const { hasView } = useAuth()
  const rules = ref([])
  const loading = ref(false)
  const error = ref(null)
  const available = ref(false)
  let requestSeq = 0

  async function refresh() {
    const id = idSource()
    available.value = hasView('ar')
    rules.value = []
    error.value = null
    if (!available.value || id == null || id === '') return
    const seq = ++requestSeq
    loading.value = true
    try {
      const response = await axios.get('/ittt-orchestrator/v0/rules', {
        params: {
          limit: LIMIT,
          filters: JSON.stringify([{ field, operator: 'in', value: String(id) }]),
          sort: JSON.stringify([{ field: 'name', direction: 'asc' }]),
        },
      })
      // Ignore a response for an ID the page has since moved away from.
      if (seq === requestSeq) rules.value = Array.isArray(response.data) ? response.data : []
    } catch (err) {
      if (seq === requestSeq) error.value = err
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  watch(idSource, refresh, { immediate: true })

  return { rules, loading, error, available, refresh }
}
