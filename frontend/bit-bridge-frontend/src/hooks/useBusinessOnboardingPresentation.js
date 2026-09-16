import { useMemo } from 'react'
import useFinancialAccountViewModel from './useFinancialAccountViewModel'
import { deriveBusinessOnboardingPresentation } from '../utils/businessOnboardingPresentation'

const useBusinessOnboardingPresentation = (accountId, currentStep) => {
  const financialAccount = useFinancialAccountViewModel(accountId)

  const presentation = useMemo(
    () => deriveBusinessOnboardingPresentation(financialAccount, currentStep),
    [financialAccount, currentStep]
  )

  return {
    ...financialAccount,
    presentation,
    screenMode: presentation.screenMode,
    hero: presentation.hero,
    stepper: presentation.stepper,
    currentStepContent: presentation.currentStepContent,
    blockingItems: presentation.blockingItems,
    navigation: presentation.navigation,
  }
}

export default useBusinessOnboardingPresentation
