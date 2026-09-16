import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { refreshAccessToken, userProfile } from '../redux/actions/auth'
import { resetUser } from '../redux/auth'
import { cookieAuthEnabled, getAccessToken } from '../auth/tokenStore'

export const useInitializeData = () => {
  const dispatch = useDispatch()
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    const token = getAccessToken()
    if (token) {
      dispatch(userProfile())
      return
    }

    if (cookieAuthEnabled()) {
      dispatch(refreshAccessToken()).then((res) => {
        if (refreshAccessToken.fulfilled.match(res)) {
          dispatch(userProfile())
        }
      })
      return
    }

    dispatch(resetUser())
  }, [dispatch])
}

export default useInitializeData
