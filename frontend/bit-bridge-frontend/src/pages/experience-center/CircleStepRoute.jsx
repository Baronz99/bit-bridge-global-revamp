import { Navigate, useParams } from 'react-router-dom'
import AmakaCollections from './AmakaCollections'
import AmakaCompletion from './AmakaCompletion'
import AmakaPayoutCreate from './AmakaPayoutCreate'
import AmakaTreasury from './AmakaTreasury'
import ChidiObligations from './ChidiObligations'
import ChidiPaymentReview from './ChidiPaymentReview'
import CircleIntro from './CircleIntro'
import CircleOverview from './CircleOverview'
import CircleTimeline from './CircleTimeline'
import FreeExplore from './FreeExplore'
import TundeApproval from './TundeApproval'
import {
  getExperienceCenterState,
  getExperienceEntryPath,
  normalizeExperienceStepId,
} from '../../utils/experienceCenter'

const CircleStepRoute = () => {
  const params = useParams()
  const rawStepId = String(params['*'] || '')
    .split('/')
    .filter(Boolean)
    .join('-')
  const normalizedStepId = normalizeExperienceStepId('circle', rawStepId)

  if (!normalizedStepId) {
    return <Navigate to={getExperienceEntryPath('circle')} replace />
  }

  const existingState = getExperienceCenterState()
  const perspectiveId = existingState.selectedPerspectiveId || 'chidi'
  const simulationState = existingState.simulationState

  if (normalizedStepId === 'intro') return <CircleIntro />
  if (normalizedStepId === 'overview') {
    return <CircleOverview perspectiveId={perspectiveId} simulationState={simulationState} />
  }
  if (normalizedStepId === 'chidi-obligation') {
    return <ChidiObligations simulationState={simulationState} />
  }
  if (normalizedStepId === 'member-payment') {
    return <ChidiPaymentReview simulationState={simulationState} />
  }
  if (normalizedStepId === 'amaka-collections') {
    return <AmakaCollections simulationState={simulationState} />
  }
  if (normalizedStepId === 'amaka-treasury') {
    return <AmakaTreasury simulationState={simulationState} />
  }
  if (normalizedStepId === 'prepare-payout') {
    return <AmakaPayoutCreate simulationState={simulationState} />
  }
  if (normalizedStepId === 'approve-payout') {
    return <TundeApproval simulationState={simulationState} />
  }
  if (normalizedStepId === 'treasury-update') {
    return <AmakaCompletion simulationState={simulationState} />
  }
  if (normalizedStepId === 'activity-audit') {
    return <CircleTimeline simulationState={simulationState} />
  }
  if (normalizedStepId === 'free-explore') {
    return <FreeExplore simulationState={simulationState} />
  }

  return <Navigate to={getExperienceEntryPath('circle')} replace />
}

export default CircleStepRoute
