import { useEffect, useMemo, useState } from 'react'
import {
  getBusinessAccount,
  getBusinessApprovalPolicies,
  getBusinessApprovalSummary,
  getBusinessEntity,
  getBusinessKybStatus,
  getBusinessOnboarding,
  getBusinessSettings,
  getBusinessWallet,
} from '../api/business'
import { deriveFinancialAccountState } from '../utils/financialAccountState'

const useFinancialAccountViewModel = (accountId) => {
  const normalizedAccountId = String(accountId || '').trim()
  const [loading, setLoading] = useState(Boolean(normalizedAccountId))
  const [error, setError] = useState(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [data, setData] = useState({
    entity: null,
    onboarding: null,
    kyb: null,
    wallet: null,
    account: null,
    approvalSummary: null,
    settings: null,
    approvalPolicies: [],
  })

  useEffect(() => {
    let active = true

    if (!normalizedAccountId) {
      setLoading(false)
      setError(null)
      setData({
        entity: null,
        onboarding: null,
        kyb: null,
        wallet: null,
        account: null,
        approvalSummary: null,
        settings: null,
        approvalPolicies: [],
      })
      return () => {
        active = false
      }
    }

    const loadFinancialAccount = async () => {
      setLoading(true)
      setError(null)

      const [
        entityRes,
        onboardingRes,
        kybStatusRes,
        walletRes,
        accountRes,
        approvalSummaryRes,
        settingsRes,
        approvalPoliciesRes,
      ] = await Promise.all([
        getBusinessEntity(normalizedAccountId).catch((requestError) => ({ __error: requestError })),
        getBusinessOnboarding(normalizedAccountId).catch(() => null),
        getBusinessKybStatus(normalizedAccountId).catch(() => null),
        getBusinessWallet(normalizedAccountId).catch(() => null),
        getBusinessAccount(normalizedAccountId).catch(() => null),
        getBusinessApprovalSummary(normalizedAccountId).catch(() => null),
        getBusinessSettings(normalizedAccountId).catch(() => null),
        getBusinessApprovalPolicies(normalizedAccountId).catch(() => null),
      ])

      if (!active) return

      if (entityRes?.__error) {
        setError(entityRes.__error)
        setLoading(false)
        return
      }

      setData({
        entity: entityRes?.data?.data || null,
        onboarding: onboardingRes?.data?.data || null,
        kyb: kybStatusRes?.data?.data || null,
        wallet: walletRes?.data?.data?.wallet || null,
        account: accountRes?.data?.data?.account || null,
        approvalSummary: approvalSummaryRes?.data?.data || null,
        settings: settingsRes?.data?.data?.settings || null,
        approvalPolicies: Array.isArray(approvalPoliciesRes?.data?.data) ? approvalPoliciesRes.data.data : [],
      })
      setLoading(false)
    }

    loadFinancialAccount().catch((requestError) => {
      if (!active) return
      setError(requestError)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [normalizedAccountId, reloadTick])

  const financialAccount = useMemo(
    () =>
      deriveFinancialAccountState({
        entity: data.entity,
        onboarding: data.onboarding,
        kyb: data.kyb,
        wallet: data.wallet,
        account: data.account,
        approvalSummary: data.approvalSummary,
        settings: data.settings,
        approvalPolicies: data.approvalPolicies,
      }),
    [data]
  )

  const reload = () => {
    if (!normalizedAccountId) return
    setReloadTick((tick) => tick + 1)
  }

  return {
    accountId: normalizedAccountId || null,
    loading,
    error,
    reload,
    ...financialAccount,
    raw: data,
  }
}

export default useFinancialAccountViewModel
