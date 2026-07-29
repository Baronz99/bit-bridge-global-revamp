import { deriveGreenfieldCircleView } from './experienceCenterCircleDemo.js'

export const MEMBER_PAYMENT_CTA_LABEL = 'Pay ₦25,000'
export const MEMBER_PAYMENT_COMPLETED_CTA_LABEL = 'See Amaka’s Updated Collections'
export const MEMBER_PAYMENT_TRANSITION_REASON = 'Wait for the payment transition to finish.'

export const getMemberPaymentInitialPhase = (simulationState) =>
  deriveGreenfieldCircleView(simulationState).paymentCompleted ? 'recorded' : 'review'

export const getMemberPaymentUiState = ({ simulationState, phase }) => {
  const circle = deriveGreenfieldCircleView(simulationState)
  const isCompleted = circle.paymentCompleted
  const isTransitioning = !isCompleted && phase !== 'review'

  return {
    circle,
    isCompleted,
    isTransitioning,
    backActionState: isTransitioning ? 'disabled' : 'enabled',
    primaryActionState: isTransitioning ? 'disabled' : 'enabled',
    primaryActionLabel: isCompleted
      ? MEMBER_PAYMENT_COMPLETED_CTA_LABEL
      : MEMBER_PAYMENT_CTA_LABEL,
  }
}
