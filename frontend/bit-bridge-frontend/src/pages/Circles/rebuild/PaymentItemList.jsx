 
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

const PaymentItemList = ({ items = [], selectedKey, onSelect }) => {
  return (
    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Contribution Options</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const selected = String(item.key || item.id) === String(selectedKey || '')
          const badge = getPaymentItemStatusBadge(item)
          const primaryAction = item.is_payable_now === false ? 'Review' : getPaymentItemCallToAction(item)
          return (
            <button
              key={String(item.key || item.id)}
              type="button"
              onClick={() => onSelect?.(item)}
              className={`flex w-full flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-cyan-400/60 bg-cyan-500/10'
                  : 'border-slate-900 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-white">{getPaymentItemTitleLabel(item)}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass[badge.tone]}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{getPaymentItemMetaLabel(item)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-200">{getPaymentItemAmountLabel(item)}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <span className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-white">
                  {primaryAction}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default PaymentItemList
