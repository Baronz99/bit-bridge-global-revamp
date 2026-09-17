import test from 'node:test'
import assert from 'node:assert/strict'
import { getPersonSourceLabel, isPersonLinked, normalizeCirclePeopleResponse } from '../circlePeople.js'

test('normalizes People registry without using memberships as a roster', () => {
  const result = normalizeCirclePeopleResponse({ data: { participant_count: 84, people: [{ display_name: 'Ada', source: 'linked_user', user_id: 'u1' }] } })
  assert.equal(result.participantCount, 84)
  assert.equal(result.people.length, 1)
  assert.equal(getPersonSourceLabel(result.people[0]), 'Linked app user')
  assert.equal(isPersonLinked(result.people[0]), true)
})
