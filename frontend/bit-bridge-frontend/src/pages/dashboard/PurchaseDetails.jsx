import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { CheckCircleOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'

import { SET_LOADING } from '../../redux/app'
import { publicKey } from '../../redux/baseUrl'
import { confirmPayment, getPurchaseOrder } from '../../redux/actions/purchasePower'
import BillOrderDetails from '../../components/confirmationDetails/billOrderDetails'
import PaymentOptions from '../../components/paymentOptions/PaymentOptions'
import BonusApplyCard from '../../components/confirmationDetails/BonusApplyCard'
import client from '../../api/client'
import { getWallet } from '../../redux/actions/wallet'
import nairaFormat from '../../utils/nairaFormat'

const DashboardPurchaseDetails = () => {
  const { user } = useSelector((state) => state.auth)
  const { data: walletData } = useSelector((state) => state.wallet)
  const wallet = walletData?.bridge || null
  const [applyCommission, setApplyCommission] = useState(false)
  const [rewardsSummary, setRewardsSummary] = useState(null)
  const [bonusDebugInfo, setBonusDebugInfo] = useState(null)
  const [bonusVerifyMismatch, setBonusVerifyMismatch] = useState(null)

  const { purchaseOrder } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const outlet = useOutletContext()
  const id = outlet?.[0]
  const service = outlet?.[2] ?? outlet?.[1]
  const [message, setMessage] = useState()
  const [err, setErr] = useState()
  const navigate = useNavigate()

  const totalAmount = Number(purchaseOrder?.total_amount) || 0
  const amountValue = Number(purchaseOrder?.amount) || totalAmount || 0
  const serviceCharge = Number(purchaseOrder?.service_charge) || 0
  const walletBalance = Number(wallet?.balance) || 0
  const walletCommission = Number(wallet?.commission) || 0
  const lifetimeRewards = Number(rewardsSummary?.total_earned) || 0
  const debugBonusFlow =
    typeof window !== 'undefined' &&
    window.localStorage &&
    window.localStorage.getItem('DEBUG_BONUS_FLOW') === '1'

  const isBonusEligible = useMemo(() => {
    const serviceType = String(purchaseOrder?.service_type || '').toUpperCase()
    return serviceType === 'VTU' || serviceType === 'DATA'
  }, [purchaseOrder?.service_type])

  const bonusApplied = applyCommission ? Math.min(walletCommission, amountValue) : 0
  const walletDebit = amountValue - bonusApplied
  const totalDebit = walletDebit + serviceCharge
  const walletAfter = walletBalance - totalDebit
  const bonusAfter = walletCommission - bonusApplied

  const getBackendBonusUsed = (order) => {
    const commissionUsed = Number(order?.commission_used) || 0
    if (commissionUsed) return { value: commissionUsed, sourceField: 'commission_used' }
    const bonusUsed = Number(order?.bonus_used) || 0
    if (bonusUsed) return { value: bonusUsed, sourceField: 'bonus_used' }
    const billCommission = Number(order?.bill_commission) || 0
    return { value: billCommission, sourceField: 'bill_commission' }
  }

  const componentProps = {
    email: purchaseOrder?.email ?? user?.emal,
    amount: totalAmount * 100,
    publicKey: publicKey,
    text: 'Pay From Bank',
    onSuccess: () => {
      handleConfirmation('card')
    },
    // // onClose: () => alert('Are you sure'),
  }

  const queryId = searchParams.get('transaction_id')
  const dispatch = useDispatch()

  const handleConfirmation = useCallback(
    (payment_method) => {
      const expected = {
        amount: amountValue,
        bonusBalance: walletCommission,
        applyBonus: applyCommission,
        bonusApplied,
        walletDebit,
        serviceCharge,
        totalDebit,
        bonusAfter,
        walletAfter,
      }

      if (debugBonusFlow) {
        console.groupCollapsed('[BONUS_FLOW] checkout submit')
        console.table(expected)
        console.log('purchaseOrder', purchaseOrder)
        console.groupEnd()
      }

      dispatch(SET_LOADING(true))
      dispatch(
        confirmPayment({ queryId, data: { payment_method, use_commission: applyCommission } })
      ).then((result) => {
        if (confirmPayment.fulfilled.match(result)) {
          const data = result.payload?.data || result.payload
          const backendBonus = getBackendBonusUsed(data)
          const expectedBonusApplied = applyCommission
            ? Math.min(walletCommission, amountValue)
            : 0
          const expectedWalletDebit = amountValue - expectedBonusApplied
          const expectedTotalDebit = expectedWalletDebit + serviceCharge

          if (debugBonusFlow) {
            console.groupCollapsed('BONUS_VERIFY')
            console.log('expectedBonusApplied', expectedBonusApplied)
            console.log('backendBonusUsed', backendBonus.value, backendBonus.sourceField)
            console.log('expectedWalletDebit', expectedWalletDebit)
            console.log('order_totals', {
              amount: data?.amount,
              total_amount: data?.total_amount,
              service_charge: data?.service_charge,
              bill_commission: data?.bill_commission,
            })
            console.groupEnd()
          }

          if (applyCommission && backendBonus.value === 0) {
            console.warn('[BONUS_VERIFY] applyCommission=true but backend bonus_used is 0', {
              backendBonus,
              bill_order: data,
            })
          }
          if (Math.abs(backendBonus.value - expectedBonusApplied) > 0.01) {
            console.warn('[BONUS_VERIFY] bonus mismatch', {
              backendBonus,
              expectedBonusApplied,
              bill_order: data,
            })
          }

          setBonusDebugInfo({
            expected,
            backend_bonus: backendBonus,
            backend_bill_order: data,
          })

          dispatch(SET_LOADING(false))
          const verifyWalletUpdate = async () => {
            const delays = [300, 800, 1500]
            let lastObserved = null
            for (let attempt = 0; attempt < delays.length; attempt += 1) {
              const walletResult = await dispatch(getWallet())
              const updated =
                walletResult?.payload?.data?.bridge ||
                walletResult?.payload?.bridge ||
                walletResult?.payload?.data ||
                null
              const updatedBalance = Number(updated?.balance) || 0
              const updatedBonus = Number(updated?.commission) || 0
              const expectedBonusAfter = walletCommission - backendBonus.value
              const expectedBalanceAfter = walletBalance - expectedTotalDebit

              lastObserved = {
                updatedBalance,
                updatedBonus,
                expectedBalanceAfter,
                expectedBonusAfter,
              }

              const bonusMatch = Math.abs(updatedBonus - expectedBonusAfter) <= 0.01
              const balanceMatch = Math.abs(updatedBalance - expectedBalanceAfter) <= 0.01

              if (bonusMatch && balanceMatch) {
                setBonusVerifyMismatch(null)
                return
              }

              await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
            }

            if (debugBonusFlow && lastObserved) {
              setBonusVerifyMismatch({
                backendBonusUsed: backendBonus,
                expectedBonusApplied,
                expectedWalletDebit,
                expectedTotalDebit,
                ...lastObserved,
              })
            }
          }

          verifyWalletUpdate()
          navigate(
            `/dashboard/utilities/${service}/${id}/confirm-payment?transaction_id=${data?.id}`
          )
        } else {
          const data = result.payload
          dispatch(SET_LOADING(false))
          toast(data?.message || 'Failed to make purchase', { type: 'error' })
          setMessage(data.message)
          setErr(true)
        }
      })
    },
    [
      queryId,
      dispatch,
      navigate,
      applyCommission,
      amountValue,
      walletCommission,
      bonusApplied,
      walletDebit,
      serviceCharge,
      totalDebit,
      bonusAfter,
      walletAfter,
      debugBonusFlow,
      purchaseOrder,
      id,
      service,
    ]
  )

  useEffect(() => {
    const safe = String(queryId || '').trim().toLowerCase()
    if (!safe || safe === 'undefined' || safe === 'null') {
      setMessage('Receipt not available yet')
      setErr(true)
      return
    }
    dispatch(getPurchaseOrder(queryId))
  }, [dispatch, queryId])

  useEffect(() => {
    if (!isBonusEligible) {
      setApplyCommission(false)
      return
    }
    if (walletCommission <= 0 && applyCommission) {
      setApplyCommission(false)
    }
  }, [isBonusEligible, walletCommission, applyCommission])

  useEffect(() => {
    if (!isBonusEligible) return
    let active = true

    const loadRewards = async () => {
      try {
        const response = await client.get('/rewards')
        if (!active) return
        setRewardsSummary(response?.data?.data || null)
      } catch {
        if (!active) return
        setRewardsSummary(null)
      }
    }

    loadRewards()
    return () => {
      active = false
    }
  }, [isBonusEligible])

  return (
    <>
      {debugBonusFlow && bonusVerifyMismatch && (
        <div className="bg-yellow-900/30 border border-yellow-600/40 text-yellow-200 rounded-lg p-3 mb-4 text-xs">
          <p className="font-semibold">Verification mismatch (debug only)</p>
          <pre className="whitespace-pre-wrap mt-2">
            {JSON.stringify(bonusVerifyMismatch, null, 2)}
          </pre>
        </div>
      )}
      <BonusApplyCard
        amount={amountValue}
        bonusBalance={walletCommission}
        lifetimeRewards={lifetimeRewards}
        applyBonus={applyCommission}
        setApplyBonus={setApplyCommission}
        serviceType={purchaseOrder?.service_type}
      />
      {message && (
        <div className={`${err ? 'bg-red-200' : 'bg-green-200'} p-4 my-4`}>
          <p
            className={`${err ? 'text-red-800' : 'text-green-800'} items-center flex gap-2 font-semibold text-center`}
          >
            <CheckCircleOutlined />
            {message}
          </p>
        </div>
      )}

      <BillOrderDetails
        purchaseOrder={purchaseOrder}
        applyCommission={applyCommission}
        paymentBreakdown={{
          amount: amountValue,
          bonusApplied,
          walletDebit,
          serviceCharge,
          totalDebit,
          walletBalance,
          bonusBalance: walletCommission,
          walletAfter,
          bonusAfter,
          applyBonus: applyCommission,
          debug: {
            amount: amountValue,
            bonusBalance: walletCommission,
            bonusApplied,
            walletDebit,
            serviceCharge,
            totalDebit,
            walletAfter,
            bonusAfter,
            lifetimeRewards,
            backend: bonusDebugInfo,
          },
        }}
        debugBonusFlow={debugBonusFlow}
      />

      <div className="bg-gray-800 rounded-2xl shadow-xl p-4 md:p-5 w-full max-w-7xl mx-auto mt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">Before you pay</p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Wallet to debit now</span>
            <span className="font-semibold text-white">{nairaFormat(walletDebit, 'ngn')}</span>
          </div>
          {applyCommission && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Bonus to apply</span>
              <span className="text-emerald-300">{nairaFormat(bonusApplied, 'ngn')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Total payable from wallet</span>
            <span className="font-semibold text-white">{nairaFormat(totalDebit, 'ngn')}</span>
          </div>
        </div>
      </div>

      <PaymentOptions
        componentProps={componentProps}
        handleConfirmation={handleConfirmation}
        purchaseOrder={purchaseOrder}
        // redirect_url={`https://www.bitbridgeglobal.com/checkout`}
        redirect_url={`https://www.bitbridgeglobal.com/checkout`}
        disableWalletPay={walletDebit > walletBalance}
      />
    </>
  )
}

export default DashboardPurchaseDetails
