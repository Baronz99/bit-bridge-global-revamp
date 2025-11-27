import PropTypes from 'prop-types'
import { publicKey } from '../../redux/baseUrl'
import { useEffect, useRef } from 'react'
import { initializeMonifyPayment } from '../../redux/actions/transaction'

const PayMentButton = ({ user, amount, handleFormSubmit }) => {
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    if (!window.MonnifySDK) {
      const script = document.createElement('script')
      script.src = 'https://sdk.monnify.com/plugin/monnify.js'
      script.async = true
      script.onload = () => {
        scriptLoadedRef.current = true
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

  //     console.log("first", user,window.MonnifySDK)
  //     window.MonnifySDK?.initialize({
  //         amount: amount,
  //         currency: "NGN",
  //         customerEmail: user.email,
  //         customerName: user.email,
  //         customerPhone: user?.email,
  //         paymentDescription: "Fund Wallet",
  //         reference: `BBG-${new Date().getTime()}`,

  //         apiKey: publicKey,
  //         // inTestMode: true,
  //         contractCode: "215323810641",
  //         onComplete:  (response)=> {
  //             console.log("response from paid: ", response)
  //                 if(response.status === "SUCCESS"){
  //                       handleFormSubmit()
  //                     //   window.location.reload();

  //                   }

  //         },
  //         onClose: () => {
  //             // alert("Payment Cancelled")
  //         }
  //     })

  // }

  return (
    <button
      type="button"
      onClick={handleFormSubmit}
      className="border-alt m-auto block max-w-sm w-full h-20 bg-primary rounded-lg  border px-4 py-2 shadow-md text-alt font-medium text-xl"
    >
      Pay with Bank
    </button>
  )
}

PayMentButton.propTypes = {
  user: PropTypes.object,
  amount: PropTypes.number,
  purchaseOrder: PropTypes.object,
  handleFormSubmit: PropTypes.func,
}

export default PayMentButton
