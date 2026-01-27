import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

function AppRedirect() {
  const [queryParams] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Preparing…')

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

  const envInfo = useMemo(() => {
    const host = window.location.hostname.toLowerCase()
    const ua = navigator.userAgent || ''
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua)
    const isStagingHost =
      host.includes('staging') ||
      host.includes('netlify.app') ||
      host.includes('localhost') ||
      host.includes('127.0.0.1')

    return { isMobileUA, isStagingHost, host }
  }, [])

  const deepLink = useMemo(() => {
    return paymentReference
      ? `bitbridgeglobal://transaction/confirm?reference=${encodeURIComponent(paymentReference)}`
      : ''
  }, [paymentReference])

  const goWeb = () => navigate(fallbackPath, { replace: true })

  const openInApp = () => {
    if (!deepLink) return
    window.location.href = deepLink
  }

  useEffect(() => {
    if (!paymentReference) {
      setMessage('Missing payment reference.')
      return
    }

    // Desktop: don't try deep links, just go web
    if (!envInfo.isMobileUA) {
      setMessage('Opening confirmation page…')
      goWeb()
      return
    }

    // Mobile (staging or prod): show button + attempt one auto-open
    setMessage('Tap “Open in app” if it doesn’t open automatically.')

    let didFallback = false
    const safeFallback = () => {
      if (didFallback) return
      didFallback = true
      goWeb()
    }

    // Attempt deep link once (may be blocked by iOS/browser)
    try {
      openInApp()
    } catch {
      // ignore
    }

    // If after ~1500ms we’re still visible, assume it failed and remain on this page
    // (Don’t auto-push to /checkout; user might want to tap Open in app.)
    const t = setTimeout(() => {
      // If it failed, we simply keep the page; user can click either button.
      // If you prefer auto-web fallback, call safeFallback() here.
    }, 1500)

    // If user returns to browser after opening app, you can optionally send them to web:
    const onVisibility = () => {
      if (!document.hidden) {
        // optional: safeFallback()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [paymentReference, envInfo.isMobileUA, fallbackPath])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 16, marginBottom: 12 }}>{message}</div>

      {paymentReference ? (
        <>
          <div style={{ opacity: 0.7, marginBottom: 16 }}>Ref: {paymentReference}</div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={openInApp}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #111',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Open in app
            </button>

            <button
              onClick={goWeb}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #ccc',
                cursor: 'pointer',
              }}
            >
              Continue on web
            </button>
          </div>

          {envInfo.isStagingHost ? (
            <div style={{ marginTop: 14, opacity: 0.7, fontSize: 13 }}>
              Staging detected — deep links may require a tap on iOS.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default AppRedirect
