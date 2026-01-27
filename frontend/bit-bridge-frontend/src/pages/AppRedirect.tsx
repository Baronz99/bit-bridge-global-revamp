import React, { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  // Accept multiple param names (providers vary)
  const paymentReference =
    queryParams.get('paymentReference') ||
    queryParams.get('transactionReference') ||
    queryParams.get('reference')

  useEffect(() => {
    const host = window.location.hostname || ''

    // Treat these as "web" environments where deep-linking will fail
    const isWeb =
      host.includes('netlify.app') ||
      host.includes('bitbridgeglobal.com') ||
      host.includes('localhost')

    if (isWeb) {
      // ✅ Web behavior: route into the web app instead of trying to deep-link
      if (paymentReference) {
        // Keep the reference so the next page can verify/requery
        navigate(`/dashboard/account?paymentReference=${encodeURIComponent(paymentReference)}`, { replace: true })
      } else {
        navigate('/dashboard/account', { replace: true })
      }
      return
    }

    // Optional: non-web behavior (only useful if you actually want to deep link from a mobile browser)
    if (paymentReference) {
      window.location.href = `bitbridgeglobal://transaction/confirm?reference=${encodeURIComponent(paymentReference)}`
      // Fallback back into the web app after a short delay if deep link fails
      setTimeout(() => {
        navigate(`/dashboard/account?paymentReference=${encodeURIComponent(paymentReference)}`, { replace: true })
      }, 1200)
    } else {
      navigate('/dashboard/account', { replace: true })
    }
  }, [paymentReference, navigate, location.search])

  return <div>Redirecting...</div>
}

export default AppRedirect
