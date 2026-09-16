 
import { formatMoney } from './shared'

const TreasuryCard = ({ balanceCents, currency = 'NGN', onPay, statusLabel = '', helperLabel = '' }) => {
  return (
    <section className="rounded-[28px] border border-slate-900 bg-[#050b1b] px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Treasury</p>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-3xl font-semibold text-white md:text-4xl">
            {formatMoney(balanceCents, currency)}
          </p>
          {statusLabel ? <p className="mt-2 text-sm text-slate-400">{statusLabel}</p> : null}
          {helperLabel ? <p className="mt-1 text-xs text-slate-500">{helperLabel}</p> : null}
        </div>
        <button
          type="button"
          onClick={onPay}
          className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          Contribute to Treasury
        </button>
      </div>
    </section>
  )
}

export default TreasuryCard
