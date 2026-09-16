import { useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { setOwnerMode } from '../../redux/app'

const BusinessWorkspaceRequired = ({
  title = 'Business workspace required',
  message,
  ctaLabel = 'Go to business overview',
  ctaTo = '/dashboard/business',
}) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { ownerMode, selectedBusinessEntityId, businessEntities = [] } = useSelector((state) => state.app || {})

  const resolvedSelectedBusiness = useMemo(
    () =>
      businessEntities.find((entity) => String(entity?.id || '') === String(selectedBusinessEntityId || '')) || null,
    [businessEntities, selectedBusinessEntityId]
  )

  const firstBusiness = businessEntities[0] || null
  const hasBrokenBusinessSelection =
    ownerMode === 'business' && !resolvedSelectedBusiness && businessEntities.length > 0

  useEffect(() => {
    if (!hasBrokenBusinessSelection) return
    if (businessEntities.length !== 1) return

    dispatch(setOwnerMode({ mode: 'business', businessEntityId: firstBusiness?.id }))
  }, [businessEntities.length, dispatch, firstBusiness?.id, hasBrokenBusinessSelection])

  const primaryCtaLabel = hasBrokenBusinessSelection
    ? firstBusiness?.name
      ? `Open ${firstBusiness.name}`
      : 'Open business workspace'
    : ctaLabel

  const primaryCtaTo = hasBrokenBusinessSelection
    ? '/dashboard/business/onboarding'
    : ctaTo

  const secondaryCtaLabel = businessEntities.length > 0 ? 'Create another business account' : 'Create business account'

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="mt-2 text-sm text-slate-400">
          {hasBrokenBusinessSelection
            ? 'Business mode is active, but no workspace is selected. Re-open your available business workspace or return to setup.'
            : message}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {hasBrokenBusinessSelection ? (
            <button
              type="button"
              onClick={() => {
                if (!firstBusiness?.id) return
                dispatch(setOwnerMode({ mode: 'business', businessEntityId: firstBusiness.id }))
                navigate('/dashboard/business/onboarding')
              }}
              className="rounded-2xl border border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] px-4 py-3 text-sm font-medium text-[#FFD2A0] transition hover:border-[#FFB05A]/70 hover:bg-[rgba(255,176,90,0.18)]"
            >
              {primaryCtaLabel}
            </button>
          ) : (
            <Link
              to={primaryCtaTo}
              className="rounded-2xl border border-[#FFB05A]/40 bg-[rgba(255,176,90,0.12)] px-4 py-3 text-sm font-medium text-[#FFD2A0] transition hover:border-[#FFB05A]/70 hover:bg-[rgba(255,176,90,0.18)]"
            >
              {primaryCtaLabel}
            </Link>
          )}
          <Link
            to="/dashboard/business/activate"
            className="rounded-2xl border border-slate-700 bg-slate-950/45 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-950/65"
          >
            {secondaryCtaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

BusinessWorkspaceRequired.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  ctaLabel: PropTypes.string,
  ctaTo: PropTypes.string,
}

export default BusinessWorkspaceRequired
