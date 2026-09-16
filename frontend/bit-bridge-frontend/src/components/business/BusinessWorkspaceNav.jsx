import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

const defaultItems = [
  { key: 'overview', route: '/dashboard/business', label: 'Overview' },
  { key: 'team', route: '/dashboard/business/team', label: 'Team' },
  { key: 'payroll', route: '/dashboard/business/payouts', label: 'Payroll' },
  { key: 'policies', route: '/dashboard/business/policies', label: 'Policies' },
  { key: 'settings', route: '/dashboard/business/settings', label: 'Settings' },
  { key: 'approvals', route: '/dashboard/business/approvals', label: 'Approvals' },
  { key: 'transfers', route: '/dashboard/business/transfers', label: 'Transfers' },
  { key: 'receipts', route: '/dashboard/business/receipts', label: 'Receipts' },
]

const BusinessWorkspaceNav = ({ pendingCount = 0, action = null, visibleNavigationItems = null }) => {
  const items =
    Array.isArray(visibleNavigationItems) && visibleNavigationItems.length
      ? visibleNavigationItems
      : defaultItems.map((item) => ({
          ...item,
          badge: item.key === 'approvals' && pendingCount > 0 ? pendingCount : null,
        }))

  return (
    <nav className="rounded-3xl border border-slate-800 bg-slate-900/80 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <NavLink
              key={item.key || item.route}
              to={item.route}
              end={item.route === '/dashboard/business'}
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'border-[#FFB05A]/50 bg-[rgba(255,176,90,0.12)] text-[#FFD2A0]'
                    : 'border-slate-700 bg-slate-950/60 text-slate-300 hover:border-slate-500 hover:text-white',
                ].join(' ')
              }
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  {item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
        {action ? <div className="flex justify-start lg:justify-end">{action}</div> : null}
      </div>
    </nav>
  )
}

BusinessWorkspaceNav.propTypes = {
  action: PropTypes.node,
  pendingCount: PropTypes.number,
  visibleNavigationItems: PropTypes.arrayOf(
    PropTypes.shape({
      badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
}

export default BusinessWorkspaceNav
