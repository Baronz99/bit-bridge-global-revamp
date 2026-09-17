import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeCircleWorkspace } from '../circleWorkspace.js'

test('circle normalization preserves participant scale separately from workspace access', () => {
  const workspace = normalizeCircleWorkspace({
    circlePayload: { data: { member_count: 1 } },
    contextPayload: {
      data: {
        circle: { member_count: 1, participant_count: 84, workspace_member_count: 1 },
        dues_summary: { counts: { total: 168, paid_current: 40, pending: 24, overdue: 20 } },
      },
    },
  })

  assert.equal(workspace.participant_count, 84)
  assert.equal(workspace.workspace_member_count, 1)
  assert.equal(workspace.member_count, 1)
  assert.equal(workspace.dues_summary.counts.total, 168)
})
