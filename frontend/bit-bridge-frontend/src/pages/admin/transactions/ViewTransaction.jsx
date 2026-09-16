import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { toast } from 'react-toastify'

import './styles.scss'

import ClassicBtn from '../../../components/button/ClassicButton'
import { SET_LOADING } from '../../../redux/app'
import { getTransaction, updateTransaction } from '../../../redux/actions/transaction'
import dateFormater from '../../../utils/dateFormat'
import nairaFormat from '../../../utils/nairaFormat'

const fallbackValue = (value) => {
  if (value === null || value === undefined || value === '') return 'Not available'
  return value
}

const detailEntries = (object) =>
  Object.entries(object || {}).filter(([, value]) => value !== null && value !== undefined && value !== '')

const DetailSection = ({ title, data }) => {
  const entries = detailEntries(data)
  if (!entries.length) return null

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      <div className="mt-3 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 text-sm">
            <span className="font-medium capitalize text-slate-500">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-right text-slate-900 break-all">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ViewTransaction = () => {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { transaction } = useSelector((state) => state.transaction)

  const sourceKind = new URLSearchParams(location.search).get('source_kind') || 'wallet_transaction'
  const canUpdateStatus = transaction?.actions?.can_update_status === true

  const loadTransaction = () =>
    dispatch(
      getTransaction({
        id,
        params: {
          admin_detail: true,
          source_kind: sourceKind,
        },
      })
    )

  useEffect(() => {
    dispatch(
      getTransaction({
        id,
        params: {
          admin_detail: true,
          source_kind: sourceKind,
        },
      })
    )
  }, [id, sourceKind])

  const handleStatusUpdate = (status) => {
    dispatch(SET_LOADING(true))
    dispatch(updateTransaction({ id, data: { status } })).then((result) => {
      dispatch(SET_LOADING(false))

      if (updateTransaction.fulfilled.match(result)) {
        loadTransaction()
        return
      }

      toast(result?.payload?.message || 'Unable to update transaction.', { type: 'error' })
    })
  }

  const summary = {
    transaction_id: transaction?.id || id,
    reference: transaction?.reference,
    source_kind: transaction?.source_kind || sourceKind,
    display_type: transaction?.display_type,
    transaction_type: transaction?.transaction_type,
    status: transaction?.status,
    amount:
      transaction?.amount !== null && transaction?.amount !== undefined
        ? nairaFormat(transaction.amount, (transaction?.currency || 'NGN').toLowerCase())
        : 'Not available',
    currency: transaction?.currency,
    created_at: transaction?.created_at ? dateFormater(transaction.created_at) : 'Not available',
  }

  return (
    <div>
      <span
        className="mb-5 bg-gray-50 shadow w-max p-3 rounded block cursor-pointer"
        onClick={() => navigate(-1)}
      >
        <FaArrowLeft />
      </span>

      <div className="bg-white p-4 md:p-6 rounded-lg shadow">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Admin transaction detail
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {transaction?.title || transaction?.display_type || 'Transaction detail'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {transaction?.subtitle || 'Review the source, initiator, and references for this record.'}
            </p>
          </div>

          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold capitalize text-slate-700">
            {fallbackValue(transaction?.status)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <DetailSection title="Summary" data={summary} />
          <DetailSection title="Initiated By" data={transaction?.initiated_by} />
          <DetailSection title="Customer" data={transaction?.customer} />
          <DetailSection title="Wallet" data={transaction?.wallet} />
          <DetailSection title="Provider" data={transaction?.provider} />
          <DetailSection title="Parties" data={transaction?.parties} />
          <DetailSection title="Linked Records" data={transaction?.linked} />
          <DetailSection title="FX Details" data={transaction?.fx} />
          <DetailSection title="Meta" data={transaction?.meta} />
          <DetailSection title="Legacy Fields" data={transaction?.legacy_fields} />
        </div>

        <div className="mt-6 bg-slate-50 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Timeline</h3>
          {Array.isArray(transaction?.timeline) && transaction.timeline.length ? (
            <div className="mt-3 space-y-3">
              {transaction.timeline.map((item, index) => (
                <div
                  key={`${item?.event_type || 'event'}-${item?.reference || index}`}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {fallbackValue(item?.event_type)}
                      </p>
                      <p className="text-xs text-slate-500">{fallbackValue(item?.source)}</p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {item?.occurred_at ? dateFormater(item.occurred_at) : 'Not available'}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
                    <span>Status: {fallbackValue(item?.status)}</span>
                    <span>Reference: {fallbackValue(item?.reference)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No timeline data available.</p>
          )}
        </div>

        {canUpdateStatus ? (
          <div className="mt-6 flex flex-wrap gap-4">
            <ClassicBtn
              disabled={transaction?.status === 'declined'}
              className={'my-1'}
              onclick={() => handleStatusUpdate('approved')}
            >
              Approve Payment
            </ClassicBtn>

            <ClassicBtn className={'my-1 cancel'} onclick={() => handleStatusUpdate('declined')}>
              Decline Payment
            </ClassicBtn>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ViewTransaction
