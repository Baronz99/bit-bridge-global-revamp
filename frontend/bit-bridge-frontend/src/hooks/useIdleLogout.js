// src/hooks/useIdleLogout.js
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { SET_LOADING } from '../redux/app'
import { forceLogout } from '../redux/auth'


// ✅ Use your centralized token keys (match src/api/client.js + src/api/auth.js conventions)
const TOKEN_KEY = 'bitglobal'
const REFRESH_TOKEN_KEY = 'refresh-token'

// Defaults
const DEFAULT_IDLE_MS = 15 * 60 * 1000 // 15 minutes
const HIDDEN_GRACE_MS = 2 * 60 * 1000 // 2 minutes hidden grace

function clearAuthStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    // keep email / recent emails if you want
  } catch (_) {}
}

export default function useIdleLogout({
  idleMs = DEFAULT_IDLE_MS,
  enabled = true,
  redirectTo = '/login?reason=idle',
} = {}) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { logged } = useSelector((s) => s.auth)

  const lastActivityRef = useRef(Date.now())
  const timerRef = useRef(null)
  const hiddenAtRef = useRef(null)

  // ✅ Prevent multiple logouts firing back-to-back
  const didLogoutRef = useRef(false)

  const bump = () => {
    lastActivityRef.current = Date.now()
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  /**
   * Perform logout and redirect.
   * - emitEvent: if true, broadcast to other tabs
   */
  const logoutNow = (reason = 'idle', { emitEvent = true } = {}) => {
    if (didLogoutRef.current) return
    didLogoutRef.current = true

    // stop checks immediately
    stopTimer()

    // stop any global spinners
    dispatch(SET_LOADING(false))

    // clear tokens
    clearAuthStorage()

    // Cross-tab sync: tell other tabs to logout too (only for local initiator)
    if (emitEvent) {
      try {
        localStorage.setItem(
          'bb_logout_event',
          JSON.stringify({ at: Date.now(), reason })
        )
      } catch (_) {}
    }

    dispatch(forceLogout({ message: reason === 'idle' ? 'Session expired due to inactivity.' : null }))


    // ✅ Use replace to avoid back-button returning to broken protected page
    navigate(reason === 'idle' ? redirectTo : '/login', { replace: true })
  }

  const scheduleCheck = () => {
    stopTimer()
    timerRef.current = setInterval(() => {
      if (!enabled || !logged) return
      const now = Date.now()
      const idleFor = now - lastActivityRef.current
      if (idleFor >= idleMs) logoutNow('idle')
    }, 1000)
  }

  useEffect(() => {
    // when user becomes logged in again, allow hook to work again
    didLogoutRef.current = false

    if (!enabled || !logged) {
      stopTimer()
      return
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((evt) => window.addEventListener(evt, bump, { passive: true }))

    const onVisibilityChange = () => {
      if (!logged) return

      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else {
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
        hiddenAtRef.current = null

        // If they left the tab hidden too long, force logout
        if (hiddenFor >= HIDDEN_GRACE_MS) {
          logoutNow('idle')
          return
        }
        bump()
      }
    }

    const onStorage = (e) => {
      if (e.key === 'bb_logout_event' && e.newValue) {
        // Another tab logged out → mirror it, but DO NOT re-emit (prevents loops)
        logoutNow('synced', { emitEvent: false })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorage)

    bump()
    scheduleCheck()

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, bump))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorage)
      stopTimer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, logged, idleMs])
}
