import test from 'node:test'
import assert from 'node:assert/strict'
import { getInvestorStage, getInvestorStageIndex } from '../investorSandboxProgress.js'

test('investor journey follows authenticated route and workspace context', () => {
  assert.equal(getInvestorStage({ pathname: '/dashboard/home', ownerMode: 'personal' }), 'personal')
  assert.equal(getInvestorStage({ pathname: '/dashboard/shared-groups/abc', ownerMode: 'circle' }), 'group')
  assert.equal(getInvestorStage({ pathname: '/dashboard/business', ownerMode: 'business' }), 'business')
  assert.equal(getInvestorStageIndex('business'), 2)
})
