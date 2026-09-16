import logoMark from '../../assets/logos/bitbridge-logo-clear.png'

const NAIRA = '\u20A6'

const BREAKDOWN = [
  {
    label: 'Deposits',
    amount: `${NAIRA}67.59M`,
    count: '867',
    border: 'border-cyan-300/40',
    glow: 'shadow-[0_0_26px_rgba(56,189,248,0.18)]',
    accent: 'text-cyan-300',
    panel: 'from-cyan-400/12 via-slate-900/88 to-slate-950/96',
  },
  {
    label: 'Transfers',
    amount: `${NAIRA}61.59M`,
    count: '923',
    border: 'border-emerald-300/40',
    glow: 'shadow-[0_0_26px_rgba(74,222,128,0.18)]',
    accent: 'text-emerald-300',
    panel: 'from-emerald-400/12 via-slate-900/88 to-slate-950/96',
  },
  {
    label: 'Bills',
    amount: `${NAIRA}2.48M`,
    count: '918',
    border: 'border-amber-300/40',
    glow: 'shadow-[0_0_26px_rgba(252,211,77,0.16)]',
    accent: 'text-amber-300',
    panel: 'from-amber-300/12 via-slate-900/88 to-slate-950/96',
  },
  {
    label: 'Treasury',
    amount: `${NAIRA}1.47M`,
    count: '36',
    border: 'border-teal-300/40',
    glow: 'shadow-[0_0_26px_rgba(45,212,191,0.18)]',
    accent: 'text-teal-300',
    panel: 'from-teal-300/12 via-slate-900/88 to-slate-950/96',
  },
]

const BreakdownCard = ({ item }) => (
  <div
    className={`relative overflow-hidden rounded-[28px] border ${item.border} bg-gradient-to-b ${item.panel} px-5 py-6 ${item.glow}`}
  >
    <div className="absolute inset-x-6 top-0 h-px bg-white/25" />
    <p className={`text-center text-[13px] font-medium uppercase tracking-[0.28em] ${item.accent}`}>
      {item.label}
    </p>
    <p className="mt-7 text-center text-[3.2rem] font-semibold tracking-[-0.06em] text-white">
      {item.amount}
    </p>
    <div className="mx-auto mt-5 h-px w-[72%] bg-white/18" />
    <p className={`mt-5 text-center text-[3rem] font-semibold tracking-[-0.06em] ${item.accent}`}>
      {item.count}
    </p>
    <p className="mt-1 text-center text-[12px] uppercase tracking-[0.26em] text-slate-300">
      Transactions
    </p>
  </div>
)

const TransactionMilestoneFlyer = () => {
  return (
    <div className="min-h-screen bg-[#020617] p-0 text-white">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#030816] text-white shadow-[0_40px_120px_rgba(15,23,42,0.78)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_center,_rgba(56,189,248,0.12),_transparent_26%),radial-gradient(circle_at_50%_44%,_rgba(34,211,238,0.10),_transparent_16%),radial-gradient(circle_at_50%_62%,_rgba(74,222,128,0.12),_transparent_18%),linear-gradient(180deg,_rgba(4,10,24,1),_rgba(2,6,23,1))]" />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/10" />
        <div className="absolute left-1/2 top-[11.5%] h-[3px] w-[34%] -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-90 shadow-[0_0_24px_rgba(252,211,77,0.85)]" />
        <div className="absolute left-1/2 top-[34%] h-[3px] w-[36%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-90 shadow-[0_0_26px_rgba(34,211,238,0.88)]" />
        <div className="absolute left-1/2 top-[49.2%] h-[3px] w-[30%] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-300 to-transparent opacity-90 shadow-[0_0_26px_rgba(74,222,128,0.85)]" />
        <div className="absolute inset-x-0 bottom-0 h-[18%] bg-[radial-gradient(circle_at_center_bottom,_rgba(56,189,248,0.35),_transparent_46%),linear-gradient(180deg,_transparent,_rgba(2,6,23,0.95))]" />

        <div className="relative flex h-full flex-col px-10 pb-10 pt-10 sm:px-12 sm:pb-12 sm:pt-11">
          <div className="flex flex-col items-center text-center">
            <p className="text-[1.8rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.2rem]">
              BitBridge Global
            </p>
            <img src={logoMark} alt="BitBridge Global" className="mt-4 h-16 w-auto sm:h-20" />
            <p className="mt-6 text-[18px] uppercase tracking-[0.38em] text-amber-200/90 sm:text-[20px]">
              Financial Coordination Milestone
            </p>
          </div>

          <div className="mt-14 text-center">
            <p className="text-[8.6rem] font-semibold leading-[0.88] tracking-[-0.085em] text-white drop-shadow-[0_10px_26px_rgba(56,189,248,0.20)] sm:text-[10rem]">
              {`${NAIRA}133M+`}
            </p>
            <p className="mt-3 text-[2.2rem] font-medium uppercase tracking-[0.28em] text-white sm:text-[2.5rem]">
              Processed Volume
            </p>
          </div>

          <div className="mt-16 text-center">
            <p className="text-[7.2rem] font-semibold leading-[0.9] tracking-[-0.075em] text-emerald-300 drop-shadow-[0_10px_28px_rgba(74,222,128,0.16)] sm:text-[8rem]">
              2,700+
            </p>
            <p className="mt-3 text-[2rem] font-medium uppercase tracking-[0.28em] text-emerald-300/95 sm:text-[2.2rem]">
              Successful Transactions
            </p>
          </div>

          <p className="mx-auto mt-10 max-w-[760px] text-center text-[1.15rem] leading-8 text-white/92 sm:text-[1.28rem]">
            Powering deposits, transfers, bills, and shared financial coordination.
          </p>

          <div className="mx-auto mt-9 h-px w-[82%] bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />

          <p className="mx-auto mt-5 max-w-[860px] text-center text-[1rem] font-medium uppercase leading-8 tracking-[0.16em] text-amber-200/92 sm:text-[1.08rem]">
            Gross successful NGN activity across deposits, transfers, bills, and treasury inflows.
          </p>

          <div className="mt-12 grid grid-cols-4 gap-4">
            {BREAKDOWN.map((item) => (
              <BreakdownCard key={item.label} item={item} />
            ))}
          </div>

          <div className="relative mt-auto pt-10">
            <div className="absolute inset-x-0 bottom-14 h-28 rounded-[999px] border-t border-cyan-300/35 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.18),_rgba(2,6,23,0)_60%)]" />
            <div className="absolute inset-x-[10%] bottom-10 h-[1px] bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            <p className="relative text-center text-[1rem] uppercase tracking-[0.28em] text-amber-200/92 sm:text-[1.08rem]">
              All-time Metrics • May 2026
            </p>
            <p className="relative mt-8 text-center text-[1.35rem] font-medium uppercase tracking-[0.32em] text-white sm:text-[1.5rem]">
              This is only the beginning.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TransactionMilestoneFlyer
