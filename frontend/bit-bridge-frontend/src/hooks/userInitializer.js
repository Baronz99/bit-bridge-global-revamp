import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { userProfile } from '../redux/actions/auth'
import { getToken } from '../api/client'

export const useInitializeData = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    // Only fetch profile if a token exists
    if (getToken()) dispatch(userProfile())
  }, [dispatch])
}

export default useInitializeData
