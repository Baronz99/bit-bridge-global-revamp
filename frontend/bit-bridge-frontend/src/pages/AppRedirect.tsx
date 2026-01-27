import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Redirecting to app...')

  const paymentReference = useMemo(() => {
    return (
      queryParams.get('paymentReference') ||
      queryParams.get('payment_reference') ||
      queryParams.get('reference') ||
      ''
    ).trim()
  }, [queryParams])

  const fallbackPath = useMemo(() => {
    // Your web confirmation route is /checkout
    return paymentReference ? `/checkout?paymentReference=${encodeURIComponent(paymentReference)}` : '/checkout'
  }, [paymentReference])

  useEffect(() => {
    if (!paymentReference) {
      setMessage('Missing payment reference.')
      return
    }

    const deepLink = `bitbridgeglobal://transaction/confirm?reference=${encodeURIComponent(paymentReference)}`

    // If deep link fails (desktop / app not installed), fall back to web confirm page.
    let didFallback = false
    const fallback = () => {
      if (didFallback) return
      didFallback = true
      navigate(fallbackPath, { replace: true })
    }

    // Attempt deep link first
    try {
      window.location.href = deepLink
    } catch (e) {
      // ignore, we’ll fallback
    }

    // If the app opens, the browser page usually becomes hidden.
    // If after ~1200ms we're still visible, assume it failed and fallback.
    const t = setTimeout(() => {
      if (!document.hidden) {
        fallback()
      }
    }, 1200)

    // If user comes back (or page never hid), fallback anyway.
    const onVisibility = () => {
      if (!document.hidden) {
        // If we’re still here after returning, route them to web confirm.
        fallback()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paymentReference, fallbackPath, navigate])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, marginBottom: 12 }}>{message}</div>
      {paymentReference ? (
        <>
          <div style={{ opacity: 0.7, marginBottom: 16 }}>Ref: {paymentReference}</div>

          <button
            onClick={() => (window.location.href = fallbackPath)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          >
            Continue on web
          </button>
        </>
      ) : null}
    </div>
  )
}

export default AppRedirect
