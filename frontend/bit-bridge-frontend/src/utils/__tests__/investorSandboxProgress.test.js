import test from 'node:test'
import assert from 'node:assert/strict'
import { getInvestorStage, getInvestorStageIndex, selectPreferredInvestorEntity } from '../investorSandboxProgress.js'

test('investor journey follows authenticated route and workspace context', () => {
  assert.equal(getInvestorStage({ pathname: '/dashboard/home', ownerMode: 'personal' }), 'personal')
  assert.equal(getInvestorStage({ pathname: '/dashboard/shared-groups/abc', ownerMode: 'circle' }), 'group')
  assert.equal(getInvestorStage({ pathname: '/dashboard/business', ownerMode: 'business' }), 'business')
  assert.equal(getInvestorStageIndex('business'), 2)
})

test('preferred journey entities use server-returned IDs without hardcoding them', () => {
  const entities = [{ id: 'generated-1', name: 'Other' }, { id: 'generated-2', name: 'Greenfield Residents Association' }]
  assert.equal(selectPreferredInvestorEntity(entities, /greenfield residents/i).id, 'generated-2')
  assert.equal(selectPreferredInvestorEntity([{ id: 'fallback' }], /missing/i).id, 'fallback')
})
