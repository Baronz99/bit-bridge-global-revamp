import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Redirecting…')

  const paymentReference = useMemo(() => {
    return (
      queryParams.get('paymentReference') ||
      queryParams.get('payment_reference') ||
      queryParams.get('reference') ||
      ''
    ).trim()
  }, [queryParams])

  const fallbackPath = useMemo(() => {
    return paymentReference
      ? `/checkout?paymentReference=${encodeURIComponent(paymentReference)}`
      : '/checkout'
  }, [paymentReference])

  // Allow forcing deep link with ?openApp=1
  const openAppParam = useMemo(() => {
    const v = (queryParams.get('openApp') || queryParams.get('open_app') || '').trim()
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
  }, [queryParams])

  const envInfo = useMemo(() => {
    const host = window.location.hostname.toLowerCase()

    const isStagingHost =
      host.includes('staging') ||
      host.includes('netlify.app') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1')

    const ua = navigator.userAgent || ''
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua)

    return { isStagingHost, isMobileUA, host }
  }, [])

  useEffect(() => {
    if (!paymentReference) {
      setMessage('Missing payment reference.')
      return
    }

    const fallback = () => {
      navigate(fallbackPath, { replace: true })
    }

    // ✅ In staging: default to web confirm (clean QA).
    // ✅ In production: attempt deep link on mobile, fallback to web.
    // ✅ You can still force deep link in staging with ?openApp=1
    const shouldTryDeepLink =
      (openAppParam || !envInfo.isStagingHost) && envInfo.isMobileUA

    if (!shouldTryDeepLink) {
      setMessage('Opening confirmation page…')
      fallback()
      return
    }

    setMessage('Opening app…')
    const deepLink = `bitbridgeglobal://transaction/confirm?reference=${encodeURIComponent(
      paymentReference
    )}`

    let didFallback = false
    const safeFallback = () => {
      if (didFallback) return
      didFallback = true
      fallback()
    }

    try {
      window.location.href = deepLink
    } catch {
      // ignore
    }

    const t = setTimeout(() => {
      if (!document.hidden) safeFallback()
    }, 1200)

    const onVisibility = () => {
      if (!document.hidden) safeFallback()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paymentReference, fallbackPath, navigate, envInfo.isStagingHost, envInfo.isMobileUA, openAppParam])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, marginBottom: 12 }}>{message}</div>

      {paymentReference ? (
        <>
          <div style={{ opacity: 0.7, marginBottom: 16 }}>Ref: {paymentReference}</div>

          <button
            onClick={() => navigate(fallbackPath, { replace: true })}
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
