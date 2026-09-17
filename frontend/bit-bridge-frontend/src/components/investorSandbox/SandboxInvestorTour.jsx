import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { setOwnerMode } from '../../redux/app'
import { isInvestorSandbox } from '../../config/sandbox'
import { getInvestorStage, getInvestorStageIndex, INVESTOR_STAGES } from '../../utils/investorSandboxProgress'

const INTRO_KEY = 'bb_investor_sandbox_intro_dismissed_v1'

export const SandboxContextCard = ({ eyebrow, title, children, metrics = [], action, actionLabel }) => (
  <section className="rounded-[24px] border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.35),rgba(15,23,42,0.92))] p-5 shadow-[0_18px_45px_rgba(8,47,73,0.18)]">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/80">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        <div className="mt-2 text-sm leading-6 text-slate-300">{children}</div>
      </div>
      {action ? <button type="button" onClick={action} className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">{actionLabel}</button> : null}
    </div>
    {metrics.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</p><p className="mt-1 text-lg font-semibold text-white">{metric.value}</p>{metric.helper ? <p className="mt-1 text-xs text-slate-400">{metric.helper}</p> : null}</div>)}</div> : null}
  </section>
)

const stageCopy = {
  personal: 'Everyday financial access — dedicated account, wallet, transfers, bills, cards and FX.',
  group: 'Financial coordination for communities — collections, recurring obligations, treasury, governance and payouts.',
  business: 'Financial operations for businesses — collections, vendors, operational payments and payouts.',
}

export const SandboxTourProgress = ({ onReopen }) => {
  const location = useLocation()
  const { ownerMode } = useSelector((state) => state.app || {})
  const currentStage = getInvestorStage({ pathname: location.pathname, ownerMode })
  const currentIndex = getInvestorStageIndex(currentStage)

  return <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-2 text-xs">{INVESTOR_STAGES.map((stage, index) => <div key={stage.key} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${index === currentIndex ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-100' : index < currentIndex ? 'border-emerald-400/30 text-emerald-200' : 'border-slate-700 text-slate-500'}`}><span className="font-semibold">{stage.shortLabel}</span><span>{stage.label}</span></div>)}</div>
    {onReopen ? <button type="button" onClick={onReopen} className="self-start text-xs font-medium text-cyan-300 hover:text-cyan-100 sm:self-auto">View investor guide</button> : null}
  </div>
}

const SandboxInvestorTour = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (!isInvestorSandbox || typeof window === 'undefined') return
    setShowIntro(window.localStorage.getItem(INTRO_KEY) !== 'true')
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(INTRO_KEY, 'true')
    setShowIntro(false)
  }
  const startPersonal = () => {
    dismiss()
    dispatch(setOwnerMode({ mode: 'personal' }))
    navigate('/dashboard/home')
  }

  if (!isInvestorSandbox) return null
  return <>
    <SandboxTourProgress onReopen={() => setShowIntro(true)} />
    {showIntro ? <section className="mb-6 rounded-[28px] border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(8,47,73,0.62),rgba(15,23,42,0.96))] p-5 md:p-7 shadow-[0_24px_60px_rgba(8,47,73,0.22)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl"><p className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Investor orientation</p><h1 className="mt-2 text-2xl font-semibold text-white">Explore the BitBridge Global model</h1><p className="mt-3 text-sm leading-6 text-slate-300">One financial infrastructure connecting how individuals, organized groups and businesses manage money.</p></div>
        <button type="button" onClick={dismiss} className="self-start text-sm text-slate-400 hover:text-white">Dismiss</button>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">{INVESTOR_STAGES.map((stage) => <div key={stage.key} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><p className="text-xs font-semibold text-cyan-200">{stage.shortLabel} {stage.label}</p><p className="mt-2 text-sm leading-5 text-slate-300">{stageCopy[stage.key]}</p></div>)}</div>
      <button type="button" onClick={startPersonal} className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">Start with Personal</button>
    </section> : null}
  </>
}

export default SandboxInvestorTour
