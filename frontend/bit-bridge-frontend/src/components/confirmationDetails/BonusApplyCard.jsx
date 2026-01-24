import PropTypes from 'prop-types'
import nairaFormat from '../../utils/nairaFormat'
import SwitchButton from '../button/switchButton'

const BonusApplyCard = ({
  amount,
  bonusBalance,
  lifetimeRewards,
  applyBonus,
  setApplyBonus,
  serviceType,
}) => {
  const normalizedService = String(serviceType || '').toUpperCase()
  if (!['VTU', 'DATA'].includes(normalizedService)) return null

  const safeAmount = Number(amount) || 0
  const safeBonus = Number(bonusBalance) || 0
  const safeLifetime = Number(lifetimeRewards) || 0
  const canApply = safeBonus > 0
  const bonusApplied = applyBonus ? Math.min(safeBonus, safeAmount) : 0
  const bonusRemaining = safeBonus - bonusApplied
  const walletDebit = safeAmount - bonusApplied

  return (
    <div className="bg-gray-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg my-6 p-4 border border-gray-800">
      <div className="space-y-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
            Bonus balance (spendable)
            <span
              title="Bonus balance comes from 1% cashback on airtime/data. It reduces what you pay from wallet. Lifetime rewards is history only."
              className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-gray-600 text-[10px] text-gray-400"
              aria-label="Why am I seeing this?"
            >
              ?
            </span>
          </p>
          <p className="text-lg font-semibold text-white">{nairaFormat(safeBonus, 'ngn')}</p>
          <p className="text-[11px] text-gray-500">Not withdrawable · Airtime/Data only.</p>
        </div>
        <p className="text-[11px] text-gray-500">
          Rewards earned (history): {nairaFormat(safeLifetime, 'ngn')} · Not spendable
        </p>
        {!canApply && <p className="text-xs text-red-300">No bonus available.</p>}
        <div className="text-xs text-emerald-300 space-y-1">
          <p className="text-sm text-white font-semibold">
            You’ll pay {nairaFormat(walletDebit, 'ngn')} from wallet
          </p>
          <p>Bonus applied: {nairaFormat(bonusApplied, 'ngn')}</p>
          <p>Remaining bonus: {nairaFormat(bonusRemaining, 'ngn')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-200">Apply bonus balance</span>
        <SwitchButton
          checked={applyBonus}
          disabled={!canApply}
          onChange={(checked) => {
            if (!canApply) return
            setApplyBonus(checked)
          }}
        />
      </div>
    </div>
  )
}

BonusApplyCard.propTypes = {
  amount: PropTypes.number,
  bonusBalance: PropTypes.number,
  lifetimeRewards: PropTypes.number,
  applyBonus: PropTypes.bool,
  setApplyBonus: PropTypes.func,
  serviceType: PropTypes.string,
}

export default BonusApplyCard
