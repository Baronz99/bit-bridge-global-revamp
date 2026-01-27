import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()

  const paymentReference =
    queryParams.get('paymentReference') ||
    queryParams.get('transactionReference') ||
    queryParams.get('reference')

  useEffect(() => {
    const origin = window.location.origin

    // Send user into the existing web confirm flow
    if (paymentReference) {
      window.location.replace(
        `${origin}/checkout?paymentReference=${encodeURIComponent(paymentReference)}`
      )
      return
    }

    // No ref provided: still send them to checkout (ConfirmPayment can show a friendly state)
    window.location.replace(`${origin}/checkout`)
  }, [paymentReference])

  return <div style={{ padding: 16 }}>Redirecting…</div>
}

export default AppRedirect
