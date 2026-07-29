import test from 'node:test'
import assert from 'node:assert/strict'

import { createInitialGreenfieldSimulationState, recordChidiPayment } from '../experienceCenterCircleDemo.js'
import {
  getMemberPaymentInitialPhase,
  getMemberPaymentUiState,
  MEMBER_PAYMENT_COMPLETED_CTA_LABEL,
  MEMBER_PAYMENT_CTA_LABEL,
} from '../experienceCenterMemberPayment.js'

test('member payment starts with Pay ₦25,000 enabled', () => {
  const simulationState = createInitialGreenfieldSimulationState()
  const uiState = getMemberPaymentUiState({ simulationState, phase: 'review' })

  assert.equal(getMemberPaymentInitialPhase(simulationState), 'review')
  assert.equal(uiState.isCompleted, false)
  assert.equal(uiState.isTransitioning, false)
  assert.equal(uiState.primaryActionLabel, MEMBER_PAYMENT_CTA_LABEL)
  assert.equal(uiState.primaryActionState, 'enabled')
  assert.equal(uiState.backActionState, 'enabled')
})

test('member payment transition disables duplicate activation while processing', () => {
  const simulationState = createInitialGreenfieldSimulationState()
  const recordingState = getMemberPaymentUiState({ simulationState, phase: 'recording' })
  const updatingState = getMemberPaymentUiState({ simulationState, phase: 'updating' })

  assert.equal(recordingState.isTransitioning, true)
  assert.equal(recordingState.primaryActionLabel, MEMBER_PAYMENT_CTA_LABEL)
  assert.equal(recordingState.primaryActionState, 'disabled')
  assert.equal(recordingState.backActionState, 'disabled')

  assert.equal(updatingState.isTransitioning, true)
  assert.equal(updatingState.primaryActionState, 'disabled')
})

test('completed payment state exposes See Amaka’s Updated Collections immediately', () => {
  const simulationState = recordChidiPayment(createInitialGreenfieldSimulationState())
  const uiState = getMemberPaymentUiState({ simulationState, phase: 'recorded' })

  assert.equal(getMemberPaymentInitialPhase(simulationState), 'recorded')
  assert.equal(uiState.isCompleted, true)
  assert.equal(uiState.isTransitioning, false)
  assert.equal(uiState.primaryActionLabel, MEMBER_PAYMENT_COMPLETED_CTA_LABEL)
  assert.equal(uiState.primaryActionState, 'enabled')
  assert.equal(uiState.backActionState, 'enabled')
})

test('already-completed payment stays on the completed CTA even if the old phase is passed in', () => {
  const simulationState = recordChidiPayment(createInitialGreenfieldSimulationState())
  const uiState = getMemberPaymentUiState({ simulationState, phase: 'review' })

  assert.equal(uiState.isCompleted, true)
  assert.equal(uiState.primaryActionLabel, MEMBER_PAYMENT_COMPLETED_CTA_LABEL)
  assert.equal(uiState.primaryActionState, 'enabled')
})
