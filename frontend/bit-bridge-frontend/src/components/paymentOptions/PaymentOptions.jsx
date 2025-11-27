import PropTypes from 'prop-types'
// import { PaystackButton } from 'react-paystack'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import { publicKey } from '../../redux/baseUrl'
import { useEffect, useRef } from 'react'
import { initiatePurchaseOrder } from '../../redux/actions/purchasePower'
import { SET_LOADING } from '../../redux/app'

const PaymentOptions = ({ handleConfirmation, purchaseOrder, redirect_url }) => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  const scriptLoadedRef = useRef(false)
  const handleConfirmationRef = useRef(handleConfirmation)

  // Update ref when handleConfirmation changes
  useEffect(() => {
    handleConfirmationRef.current = handleConfirmation
  }, [handleConfirmation])

  // Load Monnify SDK once
  useEffect(() => {
    if (!window.MonnifySDK) {
      const script = document.createElement('script')
      script.src = 'https://sdk.monnify.com/plugin/monnify.js'
      script.async = true
      script.onload = () => {
        scriptLoadedRef.current = true
        console.log('✅ Monnify SDK loaded')
      }
      script.onerror = () => {
        console.error('❌ Failed to load Monnify SDK')
      }
      document.body.appendChild(script)
    } else {
      scriptLoadedRef.current = true
    }
  }, [])

  // const payWithMonnify = () => {
  //   if (!window.MonnifySDK) {
  //     console.error("Monnify SDK not loaded yet");
  //     return;
  //   }

  //   window.MonnifySDK.initialize({
  //     amount: purchaseOrder.total_amount,
  //     currency: "NGN",
  //     customerEmail: purchaseOrder.email,
  //     customerName: purchaseOrder.name,
  //     customerPhone: purchaseOrder?.phone,
  //     paymentDescription:
  //       purchaseOrder?.description ?? purchaseOrder?.service_type,
  //     reference: `BBG-${new Date().getTime()}`,
  //     apiKey: publicKey,
  //     // inTestMode: true,
  //     contractCode: "215323810641",
  //     onComplete: (response) => {
  //       if (response.status === "SUCCESS") {
  //         console.log("💰 Payment successful");
  //       //   handleConfirmation("card");
  //         handleConfirmationRef.current("card");  // ✅ Always fresh

  //       } else {
  //         console.warn("🚫 Payment failed or incomplete", response);
  //       }
  //     },
  //     onClose: () => {
  //       console.log("🛑 Monnify modal closed");
  //     },
  //   });
  // };

  const payWithMonnify = () => {
    dispatch(SET_LOADING(true))

    dispatch(
      initiatePurchaseOrder({
        params: {
          payment_method: 'card',
          redirect_url,
        },
        queryId: purchaseOrder.id,
      })
    )
      .unwrap()
      .then((res) => {
        console.log(res)
        dispatch(SET_LOADING(false))

        window.location.href = res.responseBody.checkoutUrl
      })
      .catch((err) => {
        console.log(err)
        dispatch(SET_LOADING(false))
      })
  }

  console.log(redirect_url)

  return (
    <div className="bg-gray-100/10 mt-4 flex justify-center items-center flex-col gap-6 min-h-60 p-4 md:p-8 rounded-lg">
      {user ? (
        <div className="w-full">
          <button
            className="border-alt m-auto block max-w-sm w-full h-20 bg-alt rounded-lg  border px-4 py-2 shadow-md text-primary text-xl font-medium"
            onClick={() => handleConfirmation('wallet')}
          >
            Pay from Wallet
          </button>
        </div>
      ) : (
        <p className="text-center font-medium text-primary  text-lg">
          <NavLink className={'hover:text-alt'} to={'/login'}>
            Login
          </NavLink>{' '}
          to pay with from your wallet
        </p>
      )}

      {/* <div className="w-full">
            <PaystackButton disabled={!purchaseOrder.email} className="border-alt m-auto block max-w-sm w-full h-20 bg-primary rounded-lg  border px-4 py-2 shadow-md text-alt font-medium text-xl" {...componentProps}/>
        </div> */}

      <div className="w-full">
        <button
          type="button"
          onClick={payWithMonnify}
          className="border-alt m-auto block max-w-sm w-full h-20 bg-primary rounded-lg  border px-4 py-2 shadow-md text-alt font-medium text-xl"
        >
          Pay with Bank?
        </button>
      </div>
    </div>
  )
}
PaymentOptions.propTypes = {
  handleConfirmation: PropTypes.func,
  purchaseOrder: PropTypes.object,
  redirect_url: PropTypes.string,
}
export default PaymentOptions
