import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()

  const paramReq = queryParams.get('paymentReference')

  useEffect(() => {
    if (paramReq) {
      window.location.href = `bitbridgeglobal://transaction/confirm?reference=${paramReq}`
    } else {
      alert(':NO Ref')
    }
  }, [])

  return <div>Riderecting to app...</div>
}

export default AppRedirect
