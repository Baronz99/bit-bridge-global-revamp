import { useDispatch } from 'react-redux'
import { useEffect } from 'react'
import { getProvisions } from '../../../../redux/actions/provision'
import CableTvComponent from '../../components/cable-tv-compoent'

const CableUtilities = () => {
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(getProvisions())
  }, [])
  return <CableTvComponent />
}

export default CableUtilities
