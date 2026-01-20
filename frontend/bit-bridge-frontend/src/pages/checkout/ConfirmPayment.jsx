import { CheckCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useState, useCallback } from 'react'
import BillOrderDetails from '../../components/confirmationDetails/billOrderDetails'
import ClassicBtn from '../../components/button/ClassicButton'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getRefOrder } from '../../redux/actions/purchasePower'
import client from '../../api/client'
import { getAccessToken } from '../../auth/tokenStore'

const SUCCESS_STATUSES = new Set(['approved', 'completed', 'success', 'paid'])
const FAILED_STATUSES = new Set(['failed', 'declined', 'cancelled', 'reversed', 'expired'])
const PROCESSING_STATUSES = new Set([
  'initialized',
  'processing',
  'confirming',
  'awaiting_transfer',
  'created',
  'submitted',
])
const TERMINAL_STATUSES = new Set([...SUCCESS_STATUSES, ...FAILED_STATUSES])

const ConfirmPayment = () => {
  const { purchaseOrder, message, loading } = useSelector((state) => state.purchase)
  const [searchParams] = useSearchParams()
  const refId = searchParams.get('paymentReference')
  const navigate = useNavigate()

  const dispatch = useDispatch()
  const [transactionRecord, setTransactionRecord] = useState(null)
  const [transactionError, setTransactionError] = useState('')
  const [lastCheckedAt, setLastCheckedAt] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [authExpired, setAuthExpired] = useState(false)
  console.log(
    purchaseOrder?.status,
    purchaseOrder?.status == 'approved' || purchaseOrder?.status == 'completed'
  )

  useEffect(() => {
    if (!refId) return
    if (authExpired && getAccessToken()) {
      setAuthExpired(false)
    }
    const isWalletRef = refId.startsWith('fbg')
    if (!isWalletRef) {
      dispatch(getRefOrder(refId))
      return
    }

    let cancelled = false
    let timeoutId = null
    let shouldPoll = true
    const startedAt = Date.now()
    const fetchRecord = async () => {
      try {
        const res = await client.get('/transactions/verify', {
          params: { payment_reference: refId },
        })
        if (cancelled) return
        const record = res?.data?.data || null
        setTransactionRecord(record)
        setTransactionError('')
        setLastCheckedAt(new Date())

        const displayStatus = String(record?.status || '').toLowerCase()
        if (TERMINAL_STATUSES.has(displayStatus)) {
          shouldPoll = false
          if (timeoutId) clearTimeout(timeoutId)
        }
      } catch (err) {
        if (cancelled) return
        if (err?.response?.status === 404) {
          setTransactionRecord(null)
          setTransactionError('')
          setLastCheckedAt(new Date())
          return
        }
        if (err?.response?.status === 401) {
          shouldPoll = false
          setAuthExpired(true)
          setTransactionError('Session expired. Please log in to continue verification.')
          if (timeoutId) clearTimeout(timeoutId)
          return
        }
        setTransactionError(err?.response?.data?.message || 'Unable to check transfer status')
      }
    }

    fetchRecord()
    const scheduleNext = () => {
      if (!shouldPoll) return
      if (Date.now() - startedAt > 8 * 60 * 1000) return
      const elapsed = Date.now() - startedAt
      const delay = elapsed < 30_000 ? 4_000 : 12_000
      timeoutId = setTimeout(async () => {
        await fetchRecord()
        scheduleNext()
      }, delay)
    }
    scheduleNext()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [dispatch, refId, authExpired])

  const isWalletRef = refId?.startsWith('fbg')
  const activeRecord = isWalletRef ? transactionRecord : purchaseOrder
  const displayStatus = String(activeRecord?.status || '').toLowerCase()
  const isSuccess = SUCCESS_STATUSES.has(displayStatus)
  const isProcessing =
    PROCESSING_STATUSES.has(displayStatus) ||
    displayStatus === 'pending' ||
    (isWalletRef && !transactionRecord && !isSuccess)
  const isFailed = FAILED_STATUSES.has(displayStatus)
  const isUnknown = !isSuccess && !isFailed && !isProcessing
  const hasPaymentReference = Boolean(isWalletRef && transactionRecord?.reference)
  const handleBack = useCallback(() => {
    navigate('/dashboard/home')
  }, [navigate])

  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(handleBack, 2000)
    return () => clearTimeout(t)
  }, [isSuccess, handleBack])

  const handleRefresh = () => {
    if (!refId || !isWalletRef) return
    setTransactionError('')
    client
      .get('/transactions/verify', { params: { payment_reference: refId } })
      .then((res) => {
        setTransactionRecord(res?.data?.data || null)
        setLastCheckedAt(new Date())
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setTransactionRecord(null)
          setLastCheckedAt(new Date())
          return
        }
        if (err?.response?.status === 401) {
          setAuthExpired(true)
          setTransactionError('Session expired. Please log in to continue verification.')
          return
        }
        setTransactionError(err?.response?.data?.message || 'Unable to check transfer status')
      })
  }
  const loginReturnTo = `${window.location.pathname}${window.location.search}`

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6">
      {/* <div>ConfirmPayment</div>
    https://bitbridgeglobal.com/?paymentReference=fbg-1754295884 */}

      {/* https://bitbridgeglobal.com/?paymentReference=fbg-1754295884  */}

      {/* http://localhost:5173/?paymentReference=fbg-1754295884 */}

      {/* https://bitbridgeglobal.com/app-redirect?paymentReference=bbg-1754300805 */}

      {(activeRecord || isWalletRef) && (
        <div
          className={`${
            isSuccess ? 'bg-green-200' : isFailed ? 'bg-red-200' : 'bg-slate-200'
          }  p-4`}
        >
          <p
            className={`${
              isSuccess ? 'text-green-800' : isFailed ? 'text-red-800' : 'text-slate-700'
            }  items-center flex gap-2 font-semibold text-center"`}
          >
            <CheckCircleOutlined />

            {`${
              isSuccess
                ? ' Wallet funded successfully'
                : isFailed
                  ? ' Payment failed'
                  : hasPaymentReference
                    ? ' Payment received — confirming wallet credit'
                    : ' Awaiting transfer'
            } `}
          </p>
        </div>
      )}

      {isWalletRef ? (
        <div className="bg-gray-900 text-white  flex items-center justify-center">
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-semibold mb-4 text-center">Transaction Details</h2>
            {transactionError && (
              <p className="text-sm text-red-300 mb-3 text-center">{transactionError}</p>
            )}
            {authExpired && (
              <div className="text-center text-sm text-slate-200 mb-4">
                <p className="mb-2">Session expired, please log in to continue verification.</p>
                <a
                  href={`/login?reason=session_expired&returnTo=${encodeURIComponent(loginReturnTo)}`}
                  className="inline-flex items-center justify-center rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600"
                >
                  Log in to continue
                </a>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
              <span>
                Last checked:{' '}
                {lastCheckedAt ? lastCheckedAt.toLocaleTimeString() : '—'}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-xs text-slate-200 underline underline-offset-2 hover:text-white"
              >
                Refresh status
              </button>
            </div>

            {isProcessing && !authExpired ? (
              <div className="text-sm">
                <div className="flex justify-center items-center gap-2 my-4">
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Detail
                    label="Amount"
                    value={
                      transactionRecord?.amount != null
                        ? `₦${parseFloat(transactionRecord.amount).toLocaleString()}`
                        : '—'
                    }
                  />
                  <Detail label="Transaction ID" value={transactionRecord?.reference || refId} />
                  <Detail label="Status" value={displayStatus} badge />
                  <Detail
                    label="Created At"
                    value={
                      transactionRecord?.created_at
                        ? new Date(transactionRecord.created_at).toLocaleString()
                        : '—'
                    }
                  />
                  <Detail
                    label="Updated At"
                    value={
                      transactionRecord?.updated_at
                        ? new Date(transactionRecord.updated_at).toLocaleString()
                        : '—'
                    }
                  />
                  <Detail
                    label="Last Checked"
                    value={lastCheckedAt ? lastCheckedAt.toLocaleTimeString() : '—'}
                  />
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowDetails((prev) => !prev)}
                    className="text-xs text-slate-200 underline underline-offset-2 hover:text-white"
                  >
                    {showDetails ? 'Hide details' : 'View details'}
                  </button>
                </div>

                {showDetails && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {transactionRecord?.bonus ? (
                      <Detail
                        label="Bonus"
                        value={`₦${parseFloat(transactionRecord?.bonus || 0).toLocaleString()}`}
                      />
                    ) : null}
                    {transactionRecord?.transaction_type ? (
                      <Detail label="Type" value={transactionRecord?.transaction_type} />
                    ) : null}
                    {transactionRecord?.coin_type ? (
                      <Detail label="Coin Type" value={transactionRecord?.coin_type} />
                    ) : null}
                    {transactionRecord?.wallet_id ? (
                      <Detail label="Wallet ID" value={transactionRecord?.wallet_id} />
                    ) : null}
                    {transactionRecord?.bank ? (
                      <Detail label="Bank" value={transactionRecord?.bank} />
                    ) : null}
                    {transactionRecord?.bank_code ? (
                      <Detail label="Bank Code" value={transactionRecord?.bank_code} />
                    ) : null}
                    {transactionRecord?.sender ? (
                      <Detail label="Sender" value={transactionRecord?.sender} />
                    ) : null}
                    {transactionRecord?.address ? (
                      <Detail label="Address" value={transactionRecord?.address} />
                    ) : null}
                  </div>
                )}
              </div>
            ) : authExpired ? null : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Detail label="Transaction ID" value={transactionRecord?.reference || refId} />
                <Detail label="Status" value={displayStatus} badge />
                <Detail
                  label="Amount"
                  value={
                    transactionRecord?.amount != null
                      ? `₦${parseFloat(transactionRecord.amount).toLocaleString()}`
                      : '—'
                  }
                />
                <Detail
                  label="Created At"
                  value={
                    transactionRecord?.created_at
                      ? new Date(transactionRecord.created_at).toLocaleString()
                      : '—'
                  }
                />
                <Detail
                  label="Updated At"
                  value={
                    transactionRecord?.updated_at
                      ? new Date(transactionRecord.updated_at).toLocaleString()
                      : '—'
                  }
                />
                <Detail label="Currency" value={transactionRecord?.currency || '—'} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <BillOrderDetails purchaseOrder={purchaseOrder} />
      )}

      <div className="bg-gray-800 rounded-2xl shadow-lg p-6 my-4 w-full max-w-2xl m-auto">
        <ClassicBtn onclick={handleBack}>Back to Home Page</ClassicBtn>
      </div>
    </div>
  )
}

const Detail = ({ label, value, badge = false }) => (
  <div className="flex flex-col">
    <span className="text-gray-400 uppercase text-xs">{label}</span>
    {badge ? (
      (() => {
        const status = String(value || '').toLowerCase()
        const isSuccess = SUCCESS_STATUSES.has(status)
        const isFailed = FAILED_STATUSES.has(status)
        const isProcessing = PROCESSING_STATUSES.has(status) || status === 'pending'
        const isUnknown = !isSuccess && !isFailed && !isProcessing
        const cls = isSuccess
          ? 'bg-green-600 text-white'
          : isFailed
            ? 'bg-red-600 text-white'
            : isProcessing
              ? 'bg-slate-600 text-white'
              : isUnknown
                ? 'bg-amber-600 text-white'
                : 'bg-slate-600 text-white'
        return (
          <span className={`mt-1 inline-block px-2 py-1 rounded-md text-xs font-medium ${cls}`}>
            {value}
          </span>
        )
      })()
    ) : (
      <span className="text-white mt-1">{value}</span>
    )}
  </div>
)

export default ConfirmPayment
