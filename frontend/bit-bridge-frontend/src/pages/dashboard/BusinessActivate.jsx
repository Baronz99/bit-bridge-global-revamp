import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import BusinessWorkspaceNav from '../../components/business/BusinessWorkspaceNav'
import useSelectedBusiness from '../../hooks/useSelectedBusiness'
import { createBusinessEntity } from '../../api/business'
import { setBusinessEntities, setOwnerMode } from '../../redux/app'

const cardClass =
  'rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.22)]'

const steps = [
  {
    title: 'Create business profile',
    description: 'Register the legal business name so a company account context can be created on BitBridge.',
  },
  {
    title: 'Complete KYB profile',
    description: 'Add registration details, operating information, contacts, and authorized signatories.',
  },
  {
    title: 'Upload required documents',
    description: 'Provide incorporation and compliance documents required for provider review.',
  },
  {
    title: 'Approval and provisioning',
    description: 'After KYB approval, the business wallet and receiving account are provisioned.',
  },
]

const BusinessActivate = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { ownerMode, selectedBusiness } = useSelectedBusiness()
  const { businessEntities = [] } = useSelector((state) => state.app || {})
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
  })

  const existingBusiness = useMemo(() => businessEntities[0] || null, [businessEntities])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const businessName = String(formData.name || '').trim()
    if (!businessName) {
      toast.error('Business name is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    try {
      const response = await createBusinessEntity({
        business_entity: {
          name: businessName,
          metadata: formData.sector ? { sector: formData.sector.trim() } : {},
        },
      })

      const created = response?.data?.data
      const nextEntities = created
        ? [...businessEntities.filter((item) => Number(item.id) !== Number(created.id)), created]
        : businessEntities

      dispatch(setBusinessEntities(nextEntities))
      if (created?.id) dispatch(setOwnerMode({ mode: 'business', businessEntityId: created.id }))

      toast.success('Business profile created. Continue with KYB setup next.')
      navigate('/dashboard/business/onboarding')
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to create the business profile right now.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (ownerMode === 'business' && selectedBusiness) {
    return <Navigate to="/dashboard/business" replace />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[28px] border border-[#FF7A18] bg-[linear-gradient(135deg,rgba(255,138,42,0.16),rgba(255,176,90,0.08)_40%,rgba(15,23,42,0.94)_100%)] p-5 md:p-7 shadow-[0_24px_60px_rgba(255,122,24,0.16)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FFB05A]">Business Banking Activation</p>
          <div className="mt-3 max-w-3xl">
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Open a business account profile</h1>
            <p className="mt-2 text-sm text-slate-300">
              Start from here to activate business banking on BitBridge. This creates the company account context that later goes through KYB review and account provisioning.
            </p>
          </div>
        </section>

        <BusinessWorkspaceNav
          action={
            <Link
              to="/dashboard/home"
              className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
            >
              Back to personal
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
          <section className={cardClass}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">Create the company profile</h2>
              <p className="mt-2 text-sm text-slate-400">
                Once created, the business will appear in the banking profile switcher and can proceed to KYB completion.
              </p>
            </div>

            {errorMessage ? (
              <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-slate-300">Registered business name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                  placeholder="BitBridge Foods Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Sector</label>
                <input
                  type="text"
                  name="sector"
                  value={formData.sector}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-3 text-slate-100 outline-none transition focus:border-[#FFB05A]/60"
                  placeholder="Retail, logistics, services..."
                />
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-50/90">
                Creating the profile is only the first step. Business transfers and receiving accounts become available after KYB approval and provisioning.
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl bg-[#FFB05A] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffc27d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating business profile...' : 'Create business profile'}
              </button>
              {ownerMode === 'business' && existingBusiness && !selectedBusiness ? (
                <button
                  type="button"
                  onClick={() => {
                    dispatch(setOwnerMode({ mode: 'business', businessEntityId: existingBusiness.id }))
                    navigate('/dashboard/business/onboarding')
                  }}
                  className="ml-3 rounded-2xl border border-slate-700 bg-slate-950/45 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-950/65"
                >
                  Re-open existing workspace
                </button>
              ) : null}
            </form>
          </section>

          <section className={cardClass}>
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">What is required to activate business banking?</h2>
              <p className="mt-2 text-sm text-slate-400">
                The business mode becomes fully usable after these stages are completed.
              </p>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] text-xs font-semibold text-[#FFD2A0]">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{step.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{step.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default BusinessActivate
