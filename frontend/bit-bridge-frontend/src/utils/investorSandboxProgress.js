export const INVESTOR_STAGES = [
  { key: 'personal', label: 'Personal', shortLabel: '01' },
  { key: 'group', label: 'Group Finance', shortLabel: '02' },
  { key: 'business', label: 'Business', shortLabel: '03' },
]

export const getInvestorStage = ({ pathname = '', ownerMode = 'personal' } = {}) => {
  if (ownerMode === 'business' || pathname.startsWith('/dashboard/business')) return 'business'
  if (ownerMode === 'circle' || pathname.startsWith('/dashboard/shared-groups')) return 'group'
  return 'personal'
}

export const getInvestorStageIndex = (stage) => Math.max(0, INVESTOR_STAGES.findIndex((item) => item.key === stage))

export const selectPreferredInvestorEntity = (entities, pattern) => {
  const list = Array.isArray(entities) ? entities : []
  return list.find((entity) => pattern.test(String(entity?.name || ''))) || list[0] || null
}
