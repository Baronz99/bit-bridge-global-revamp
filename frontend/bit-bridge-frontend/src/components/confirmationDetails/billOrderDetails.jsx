import { useState } from 'react'
import nairaFormat from '../../utils/nairaFormat'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

const normalizeStatusValue = (raw) => {
  const rawString = String(raw ?? '').trim()
  const numeric = rawString !== '' && !Number.isNaN(Number(rawString))

  if (numeric) {
    const num = Number(rawString)
    if (num === 0) return 'initialized'
    if (num === 5) return 'processing'
    if (num === 6) return 'provider_unavailable'
    return 'unknown'
  }

  if (!rawString) return 'unknown'

  const lowered = rawString.toLowerCase()
  if (lowered.includes('provider') && lowered.includes('unavail')) return 'provider_unavailable'
  const known = new Set([
    'initialized',
    'pending',
    'processing',
    'approved',
    'completed',
    'success',
    'paid',
    'failed',
    'refunded',
    'declined',
    'timedout',
    'timeout',
    'disputed',
    'provider_unavailable',
    'cancelled',
    'canceled',
    'reversed',
    'expired',
  ])
  return known.has(lowered) ? lowered : 'unknown'
}

const BillOrderDetails = ({ purchaseOrder, applyCommission, paymentBreakdown, debugBonusFlow }) => {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const [showBreakdown, setShowBreakdown] = useState(false)

  const normalizedStatus = normalizeStatusValue(purchaseOrder?.status)
  const isPhoneFailure =
    normalizedStatus === 'failed' &&
    /invalid phone|phone number/i.test(String(purchaseOrder?.reason || ''))

  const prefill = {
    billersCode: purchaseOrder?.meter_number || purchaseOrder?.billersCode || purchaseOrder?.phone,
    phone: purchaseOrder?.phone || purchaseOrder?.phone_number,
    meter_type: purchaseOrder?.meter_type,
    email: purchaseOrder?.email,
    amount: purchaseOrder?.amount,
    tariff_class: purchaseOrder?.tariff_class,
    name: purchaseOrder?.name,
    address: purchaseOrder?.address,
    biller: purchaseOrder?.biller,
    service_type: purchaseOrder?.service_type,
  }
  const amountValue = Number(purchaseOrder?.amount) || 0
  const serviceChargeValue = Number(purchaseOrder?.service_charge) || 0
  const totalAmountValue = Number(purchaseOrder?.total_amount) || 0
  const totalToPayNow = Number(paymentBreakdown?.totalDebit) || totalAmountValue
  const commissionValue =
    purchaseOrder?.bill_commission != null ? Number(purchaseOrder?.bill_commission) || 0 : null

  const resolveEditRoute = () => {
    if (!id || !purchaseOrder?.service_type) return null

    const serviceType = String(purchaseOrder.service_type).toLowerCase()
    const isDashboard = location.pathname.startsWith('/dashboard')

    if (serviceType.includes('electricity')) {
      return isDashboard ? `/dashboard/utilities/buy-power/${id}/powerform` : `/buy-power/${id}/payment-form`
    }

    if (serviceType.includes('vtu') || serviceType.includes('data')) {
      return isDashboard ? `/dashboard/utilities/mobile-top-up/${id}/mobileform` : `/phone-top-up/${id}`
    }

    if (serviceType.includes('tv') || serviceType.includes('cable')) {
      return isDashboard ? `/dashboard/utilities/cable/${id}/cableform` : `/utility-services/${id}`
    }

    return null
  }

  const handleUpdatePhone = () => {
    const route = resolveEditRoute()
    if (!route) return
    navigate(route, { state: { prefill, focusField: 'phone', fromBillOrderId: purchaseOrder?.id } })
  }

  const pickLabel = (type) => {
    switch (type) {
      case 'vtu':
      case 'data':
        return 'Phone Number'
      case 'tv':
        return 'Decoder ID'
      case 'electricity':
        return 'Meter Number'

      default:
        return 'Number'
    }
  }

  return (
    <div className="bg-gray-900 text-white flex flex-col gap-4 p-6 mt-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4 text-center">Billing Transaction</h2>
        <h2>
          {purchaseOrder?.token && (
            <div className="  md:flex-row flex-col my-4 flex gap-4">
              <p className="md:w-60 border-b  border-gray-700 px-2 font-semibold">Token</p>
              <p className="flex-1 border-b  border-gray-700 px-2 font-bold text-2xl">
                {purchaseOrder?.token}
              </p>
            </div>
          )}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {purchaseOrder?.name && (
            <Detail
              label={'Customer Name'}
              value={purchaseOrder?.name}
              hidden={
                purchaseOrder?.service_type === 'VTU' || purchaseOrder?.service_type === 'VTU'
              }
            />
          )}
          {purchaseOrder?.address && (
            <Detail
              label={'Address'}
              value={purchaseOrder?.address}
              hidden={
                purchaseOrder?.service_type === 'VTU' || purchaseOrder?.service_type === 'VTU'
              }
            />
          )}

          {purchaseOrder?.meter_number && (
            <Detail
              label={pickLabel(purchaseOrder?.service_type.toLowerCase())}
              value={purchaseOrder?.meter_number}
            />
          )}

          {purchaseOrder?.biller && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Biller</p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.biller}</p>
            // </div>

            <Detail label={'Biller'} value={purchaseOrder?.biller} />
          )}

          {purchaseOrder?.amount && (
            <div className="flex flex-col">
              <span className="text-gray-400 uppercase text-xs">Total to pay now (after bonus)</span>
              <span className="mt-1 text-xl font-semibold text-white">
                {nairaFormat(totalToPayNow)}
              </span>
              {applyCommission && (
                <span className="text-[11px] text-gray-500 mt-1">
                  Original amount: {nairaFormat(amountValue)}
                </span>
              )}
            </div>
          )}
          {purchaseOrder?.amount && serviceChargeValue > 0 && (
            <Detail label={'Fees'} value={nairaFormat(serviceChargeValue)} />
          )}
          {purchaseOrder?.transaction_id && (
            // <div className="gap-4 my-4 md:flex-row flex-col flex">
            //                 <p className="w-60 md:w-60 border-b  border-gray-700 px-2 font-semibold">Transaction ID</p>
            //                 <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.transaction_id}</p>
            //             </div>

            <Detail label={'Transaction ID'} value={purchaseOrder?.transaction_id} />
          )}
          {purchaseOrder?.status && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            //     <p className="w-60 border-b  border-gray-700 px-2  md:w-60 font-semibold"></p>
            //     <p className="flex-1 border-b  border-gray-700 px-2">{purchaseOrder?.status}</p>
            // </div>
            <Detail label={'Status'} value={normalizedStatus} badge />
          )}
          {purchaseOrder?.reason && <Detail label={'Reason'} value={purchaseOrder?.reason} />}
          {isPhoneFailure && resolveEditRoute() && (
            <div className="flex flex-col sm:col-span-2">
              <span className="text-gray-400 uppercase text-xs">Action</span>
              <div className="mt-1 rounded-md border border-red-500/50 bg-red-900/20 p-3">
                <p className="text-sm text-red-200">Payment failed due to invalid phone number.</p>
                <button
                  type="button"
                  onClick={handleUpdatePhone}
                  className="mt-2 inline-flex items-center rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Update phone number
                </button>
              </div>
            </div>
          )}
          {purchaseOrder?.id && (
            // <div className="gap-4 my-4 md:flex-row flex-col  flex">
            // <p className="w-60 px-2 md:w-60 font-semibold">Order ID</p>
            // <p className="flex-1 px-2">{purchaseOrder?.id}</p>
            // </div>

            <Detail label={'Order ID'} value={purchaseOrder?.id} />
          )}

          {purchaseOrder?.email && (
            <Detail label={'Email'} value={purchaseOrder?.email ?? user?.emal} />
          )}
        </div>
      </div>

      {paymentBreakdown && (
        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Payment breakdown</h3>
            <button
              type="button"
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="text-xs text-gray-300 hover:text-white transition"
            >
              {showBreakdown ? 'Hide breakdown' : 'See breakdown'}
            </button>
          </div>

          {showBreakdown && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <BreakdownRow
                  label="Subtotal"
                  value={nairaFormat(paymentBreakdown.amount, 'ngn')}
                />
                <BreakdownRow
                  label="Bonus applied"
                  value={`- ${nairaFormat(paymentBreakdown.bonusApplied, 'ngn')}`}
                  muted={!paymentBreakdown.applyBonus}
                />
                {paymentBreakdown.serviceCharge > 0 && (
                  <BreakdownRow
                    label="Fees"
                    value={nairaFormat(paymentBreakdown.serviceCharge, 'ngn')}
                  />
                )}
                <BreakdownRow
                  label="Total charged"
                  value={nairaFormat(paymentBreakdown.totalDebit, 'ngn')}
                  strong
                />
              </div>
              <div className="flex flex-col gap-2">
                <BreakdownRow
                  label="Wallet after"
                  value={nairaFormat(paymentBreakdown.walletAfter, 'ngn')}
                  strong
                />
                <BreakdownRow
                  label="Bonus after"
                  value={nairaFormat(paymentBreakdown.bonusAfter, 'ngn')}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {debugBonusFlow && paymentBreakdown && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 w-full max-w-7xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-2">
            Bonus flow debug
          </p>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(paymentBreakdown.debug, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

BillOrderDetails.propTypes = {
  purchaseOrder: PropTypes.object,
  applyCommission: PropTypes.bool,
  paymentBreakdown: PropTypes.object,
  debugBonusFlow: PropTypes.bool,
}

const Detail = ({
  label,
  value,
  badge = false,
  hidden = false,
  applyCommission = false,
  commission,
}) => {
  const shouldNormalizeStatus = badge && label === 'Status'
  const normalized = shouldNormalizeStatus ? normalizeStatusValue(value) : String(value || '').toLowerCase()
  const displayValue = shouldNormalizeStatus ? normalized : value
  const isSuccess = normalized === 'approved' || normalized === 'completed'
  const isPending =
    normalized === 'pending' ||
    normalized === 'processing' ||
    normalized === 'initialized'
  const isFailed =
    normalized === 'failed' ||
    normalized === 'refunded' ||
    normalized === 'declined' ||
    normalized === 'timedout' ||
    normalized === 'timeout' ||
    normalized === 'disputed' ||
    normalized === 'provider_unavailable'
  return (
    <div className={`${hidden ? 'hidden' : 'flex'} flex-col`}>
      <span className="text-gray-400 uppercase text-xs">{label}</span>
      {badge ? (
        <span
          className={`mt-1 inline-block px-2 py-1 rounded-md text-xs font-medium ${
            isSuccess
              ? 'bg-green-600 text-white'
              : isPending
                ? 'bg-yellow-600 text-white'
                : isFailed
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-600 text-white'
          }`}
        >
          {displayValue}
        </span>
      ) : (
        <p className="flex items-center gap-5 bg-red">
          <span className={`text-white  ${applyCommission && 'line-through'}`}>{value}</span>
          {applyCommission && <span className="text-white">{commission}</span>}
        </p>
      )}
    </div>
  )
}

Detail.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  badge: PropTypes.bool,
  hidden: PropTypes.bool,
  applyCommission: PropTypes.bool,
}

const BreakdownRow = ({ label, value, strong = false, muted = false }) => (
  <div className="flex items-center justify-between gap-3">
    <span className={`text-gray-400 ${muted ? 'opacity-60' : ''}`}>{label}</span>
    <span className={`${strong ? 'font-semibold text-white' : 'text-gray-200'}`}>{value}</span>
  </div>
)

BreakdownRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
  strong: PropTypes.bool,
  muted: PropTypes.bool,
}

export default BillOrderDetails
