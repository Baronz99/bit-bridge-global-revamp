import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'

const PaymentOptions = ({ handleConfirmation, disableWalletPay }) => {
  const { user } = useSelector((state) => state.auth)
  const { isLoading } = useSelector((state) => state.app)

  return (
    <div className="bg-gray-100/10 mt-4 flex justify-center items-center flex-col gap-6 min-h-60 p-4 md:p-8 rounded-lg">
      {user ? (
        <div className="w-full">
          <button
            className="border-alt m-auto block max-w-sm w-full h-20 bg-alt rounded-lg border px-4 py-2 shadow-md text-primary text-xl font-medium"
            disabled={isLoading || disableWalletPay}
            onClick={() => handleConfirmation('wallet')}
          >
            Pay from Wallet
          </button>
          {disableWalletPay && (
            <p className="text-xs text-red-400 mt-2 text-center">
              Insufficient wallet balance for this purchase.
            </p>
          )}
        </div>
      ) : (
        <p className="text-center font-medium text-primary text-lg">
          <NavLink className={'hover:text-alt'} to={'/login'}>
            Login
          </NavLink>{' '}
          to pay with from your wallet
        </p>
      )}

      <p className="text-xs text-gray-400 text-center">
        Bank/card bill checkout is disabled. Fund wallet to continue.
      </p>
    </div>
  )
}

PaymentOptions.propTypes = {
  handleConfirmation: PropTypes.func,
  purchaseOrder: PropTypes.object,
  redirect_url: PropTypes.string,
  disableWalletPay: PropTypes.bool,
}

export default PaymentOptions
