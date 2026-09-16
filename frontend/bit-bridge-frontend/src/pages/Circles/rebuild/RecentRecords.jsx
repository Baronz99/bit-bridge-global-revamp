 
import { Link } from 'react-router-dom'
import { formatDateTimeLabel, getPaymentEventLabel, getReceiptRoute } from './shared'

const RecentRecords = ({ records = [], emptyLabel = 'No activity yet.' }) => {
  return (
    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Recent Activity</p>
      <div className="mt-4 space-y-3">
        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
            {emptyLabel}
          </div>
        ) : (
          records.slice(0, 8).map((record, index) => {
            const receiptRoute = getReceiptRoute(record)
            return (
              <div
                key={String(record.id || record.reference || index)}
                className="rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{getPaymentEventLabel(record)}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTimeLabel(record.created_at || record.occurred_at)}</p>
                  </div>
                  {receiptRoute ? (
                    <Link to={receiptRoute} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                      Proof
                    </Link>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default RecentRecords
