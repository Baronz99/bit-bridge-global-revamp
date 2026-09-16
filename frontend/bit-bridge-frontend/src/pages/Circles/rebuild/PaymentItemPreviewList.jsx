 
import {
  getPaymentItemCallToAction,
  getPaymentItemAmountLabel,
  getPaymentItemMetaLabel,
  getPaymentItemTitleLabel,
  getPaymentItemStatusBadge,
} from './shared'

const toneClass = {
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  slate: 'border-slate-700 bg-slate-900/80 text-slate-300',
}

const PaymentItemPreviewList = ({ items = [], onOpenPay }) => {
  return (
    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Contribution Options</p>
          <h2 className="mt-2 text-xl font-semibold text-white">What members can contribute to</h2>
        </div>
        <button
          type="button"
          onClick={onOpenPay}
          className="text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
        >
          Open Contributions
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-4 text-sm text-slate-400">
            No active contribution options yet.
          </div>
        ) : (
          items.slice(0, 5).map((item) => {
            const badge = getPaymentItemStatusBadge(item)
            return (
              <div
                key={String(item.key || item.id)}
                className="flex flex-col gap-3 rounded-2xl border border-slate-900 bg-slate-950/60 px-4 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-white">{getPaymentItemTitleLabel(item)}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass[badge.tone]}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{getPaymentItemMetaLabel(item)}</p>
                  <p className="mt-2 text-xs text-slate-500">{getPaymentItemCallToAction(item)}</p>
                </div>
                <div className="text-right text-sm font-medium text-slate-200">
                  {getPaymentItemAmountLabel(item)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default PaymentItemPreviewList
