import { useNavigate } from 'react-router-dom'
import UtilityCard from '../../../components/card/UtilityCard'

const Utility = () => {
  const navigate = useNavigate()

  return (
    <div className="w-full px-4 md:px-6 py-4 space-y-6 text-slate-100">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">
            Pay Bills & Utilities
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xl">
            Quickly buy power, airtime, data or TV subscriptions from your BitBridge
            wallet in a few taps.
          </p>
        </div>
      </div>

      {/* Utilities grid */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 py-5 md:py-6 px-3 md:px-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          <div>
            <UtilityCard
              onClick={() => {
                navigate('/dashboard/utilities/buy-power')
              }}
              provider={'electricity'}
              title={'Electric Bills'}
              btnText={'Select Provider'}
            />
          </div>

          <div>
            <UtilityCard
              onClick={() => {
                navigate('/dashboard/utilities/cable')
              }}
              provider={'cable'}
              title={'Cable Bills'}
              btnText={'Subscribe to Tv'}
            />
          </div>

          <div>
            <UtilityCard
              onClick={() => {
                navigate('/dashboard/utilities/mobile-top-up')
              }}
              provider={'mobile1'}
              title={'Airtime Top Up'}
              btnText={'Mobile Top Up'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Utility
