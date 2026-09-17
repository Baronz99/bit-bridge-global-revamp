const objectValue = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

export const normalizeCirclePeopleResponse = (payload) => {
  const root = objectValue(payload)
  const data = objectValue(root.data)
  const people = Array.isArray(root.people)
    ? root.people
    : Array.isArray(root.participants)
      ? root.participants
      : Array.isArray(root.items)
        ? root.items
        : Array.isArray(data.people)
          ? data.people
          : Array.isArray(data.participants)
            ? data.participants
            : Array.isArray(data.items)
              ? data.items
              : Array.isArray(data.data)
                ? data.data
                : Array.isArray(payload)
                  ? payload
                  : []

  const metrics = { ...data, ...root }
  return {
    people,
    participantCount: Number(metrics.participant_count ?? people.length) || 0,
    activeParticipantCount: metrics.active_participant_count == null ? null : Number(metrics.active_participant_count) || 0,
  }
}

export const getPersonDisplayName = (person) =>
  String(person?.display_name || person?.name || person?.full_name || 'Unnamed participant').trim()

export const getPersonStatus = (person) =>
  String(person?.status || person?.lifecycle_state || (person?.active === false ? 'inactive' : 'active')).replaceAll('_', ' ')

export const getPersonSourceLabel = (person) => {
  const source = String(person?.source || person?.origin || '').toLowerCase()
  if (source === 'import' || source === 'imported') return 'Imported roster'
  if (source === 'linked_user' || source === 'linked') return 'Linked app user'
  return source ? source.replaceAll('_', ' ') : 'Circle registry'
}

export const isPersonLinked = (person) => Boolean(
  person?.linked_user || person?.linked_user_id || person?.user_id || person?.user
)
