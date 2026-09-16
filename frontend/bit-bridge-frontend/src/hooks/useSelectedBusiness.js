import { useMemo } from 'react'
import { useSelector } from 'react-redux'

const useSelectedBusiness = () => {
  const { ownerMode, selectedBusinessEntityId, businessEntities } = useSelector((state) => state.app || {})

  const selectedBusiness = useMemo(() => {
    if (ownerMode !== 'business') return null
    return (
      businessEntities.find((entity) => String(entity?.id || '') === String(selectedBusinessEntityId || '')) || null
    )
  }, [businessEntities, ownerMode, selectedBusinessEntityId])

  return {
    ownerMode,
    selectedBusinessEntityId,
    selectedBusiness,
    businessEntities,
  }
}

export default useSelectedBusiness
