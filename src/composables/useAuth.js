import { ref, computed } from 'vue'
import axios from 'axios'

const useToken = ref(null)
const isInitialized = ref(false)
let refreshIntervalId = null
let initPromise = null

const isAuthenticated = computed(() => useToken.value !== null)

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

const currentUserId = computed(() => {
  if (!useToken.value) return null
  return decodeJwtPayload(useToken.value)?.id ?? null
})

const LOGIN_URL = '/authentication-service/v0/authentication/login'
const REFRESH_INTERVAL_MS = 8 * 60 * 1000 // 8 min; use-token expires in 10 min

function setToken(token) {
  useToken.value = token
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

function clearToken() {
  useToken.value = null
  delete axios.defaults.headers.common['Authorization']
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }
}

async function attemptCookieRefresh() {
  try {
    const response = await axios.post(LOGIN_URL, {}, { withCredentials: true })
    setToken(response.data['use-token'])
    return true
  } catch {
    clearToken()
    return false
  }
}

function startRefreshInterval() {
  if (refreshIntervalId !== null) return
  refreshIntervalId = setInterval(attemptCookieRefresh, REFRESH_INTERVAL_MS)
}

export function useAuth() {
  async function init() {
    if (initPromise) return initPromise
    initPromise = (async () => {
      const success = await attemptCookieRefresh()
      if (success) startRefreshInterval()
      isInitialized.value = true
    })()
    return initPromise
  }

  async function login(username, password) {
    const response = await axios.post(LOGIN_URL, { username, password }, { withCredentials: true })
    setToken(response.data['use-token'])
    startRefreshInterval()
  }

  function logout() {
    clearToken()
  }

  return { useToken, isAuthenticated, isInitialized, currentUserId, init, login, logout }
}
