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

// The "hp" claim - see authentication/usertoken.Permissions. Absent, or with
// no "admin" key, means the token carries no elevated access.
const currentPermissions = computed(() => {
  if (!useToken.value) return null
  return decodeJwtPayload(useToken.value)?.hp ?? null
})

const currentUserIsAdmin = computed(() => currentPermissions.value?.admin === true)

// hasModify mirrors the server's Permissions.HasModify: admin bypasses
// everything, otherwise the resource's own "m" grant decides.
function hasModify(resourceCode) {
  if (currentUserIsAdmin.value) return true
  return currentPermissions.value?.[resourceCode]?.m === '*'
}

const LOGIN_URL = '/authentication-service/v0/authentication/login'
const LOGOUT_URL = '/authentication-service/v0/authentication/logout'
const CLOUD_LOGIN_URL = '/authentication-service/v0/authentication/cloud'
const CLOUD_STATE_KEY = 'cloudLoginState'
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

  async function logout() {
    try {
      await axios.post(LOGOUT_URL, {}, { withCredentials: true })
    } catch {
      // Still drop the local session; the refresh cookie just lives until it expires.
    }
    clearToken()
  }

  // Whether to offer "Log in with Humi Cloud": true only when the appliance
  // is enrolled with the cloud. Any failure just means "don't offer it".
  async function cloudLoginAvailable() {
    try {
      const response = await axios.get(`${CLOUD_LOGIN_URL}/status`)
      return response.data.available === true
    } catch {
      return false
    }
  }

  // Sends the browser to the cloud to log in. The state value the appliance
  // hands back is remembered for this tab only, so completeCloudLogin can
  // check the callback belongs to a login this tab started.
  async function startCloudLogin() {
    const returnTo = `${window.location.origin}/cloud-login/callback`
    const response = await axios.post(`${CLOUD_LOGIN_URL}/start`, { returnTo })
    try {
      sessionStorage.setItem(CLOUD_STATE_KEY, response.data.state)
    } catch {
      throw new Error('This browser blocks the storage needed for cloud login.')
    }
    window.location.href = response.data.cloudUrl
  }

  // Finishes a cloud login from the code and state in the callback URL.
  async function completeCloudLogin(code, state) {
    let expected = null
    try {
      expected = sessionStorage.getItem(CLOUD_STATE_KEY)
      sessionStorage.removeItem(CLOUD_STATE_KEY)
    } catch {
      // treated as a mismatch below
    }
    if (!expected || expected !== state) {
      throw new Error('This login was not started from this browser tab. Please try again.')
    }
    const response = await axios.post(`${CLOUD_LOGIN_URL}/complete`, { code, state }, { withCredentials: true })
    setToken(response.data['use-token'])
    startRefreshInterval()
  }

  return {
    useToken,
    isAuthenticated,
    isInitialized,
    currentUserId,
    currentUserIsAdmin,
    hasModify,
    init,
    login,
    logout,
    cloudLoginAvailable,
    startCloudLogin,
    completeCloudLogin,
  }
}
