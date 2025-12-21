import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { userProfile } from '../redux/actions/auth'
import { getToken } from '../api/client'

export const useInitializeData = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    if (getToken()) dispatch(userProfile())
  }, [dispatch])
}

export default useInitializeData
