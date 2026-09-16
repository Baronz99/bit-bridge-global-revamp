import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const ConfirmationSuccess = () => {
  const navigate = useNavigate()
  const [handoffMessage, setHandoffMessage] = useState('')

  const appDeepLink = 'bitbridgeglobal://login?confirmed=1'
  const isMobileUA = useMemo(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || ''), [])

  const openInApp = () => {
    window.location.href = appDeepLink
  }

  useEffect(() => {
    if (!isMobileUA) return undefined

    setHandoffMessage('Email confirmed. Open the app to continue.')

    const timer = setTimeout(() => {
      try {
        openInApp()
      } catch {
        // ignore browser deep-link failures and keep the CTA visible
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [isMobileUA])

  return (
    <div className="h-screen bg-gray-900 w-full flex flex-col justify-center items-center gap-4">
      <h2 className="text-3xl text-center text-purple-200 font-semibold">
        Email Confirmed
      </h2>

      <p className="text-white text-lg">
        Your email has been successfully confirmed.
      </p>
      {handoffMessage ? (
        <p className="text-gray-300 text-sm text-center max-w-md px-4">
          {handoffMessage}
        </p>
      ) : null}

      <div>
        <img src="/images/email-success.png" alt="" className="h-60 m-auto" />
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        {isMobileUA ? (
          <button
            className="bg-purple-700 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-all duration-300"
            onClick={openInApp}
          >
            Open in App
          </button>
        ) : null}
        <button
          className="bg-purple-950 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-all duration-300"
          onClick={() => {
            navigate('/login')
          }}
        >
          Continue to Login
        </button>
      </div>
    </div>
  )
}

export default ConfirmationSuccess
