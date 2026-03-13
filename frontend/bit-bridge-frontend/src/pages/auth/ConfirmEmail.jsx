import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { SET_LOADING } from '../../redux/app'
import { useEffect, useRef } from 'react'
import { confirmEmail } from '../../api/auth'
import { setAccessToken, setRefreshToken } from '../../auth/tokenStore'

const ConfirmEmail = () => {
  const dispatch = useDispatch()
  const [query] = useSearchParams()
  const { user } = useSelector((state) => state.auth)

  const token = query.get('confirmation_token')
  const flow = query.get('flow') || localStorage.getItem('confirmation_flow') || 'signup'
  const isEmailChange = flow === 'email-change'
  const navigate = useNavigate()

  // 👇 prevents double-run of the effect (React StrictMode)
  const hasConfirmedRef = useRef(false)

  useEffect(() => {
    // CASE 1: No token in URL -> show “check your email” message only
    if (!token) return

    // CASE 2: Token present -> but only run once
    if (hasConfirmedRef.current) return
    hasConfirmedRef.current = true

    dispatch(SET_LOADING(true))

    confirmEmail(token)
      .then((res) => {
        const data = res?.data || {}

        const accessToken = data.access_token
        const refreshTokenFromBody = data.refresh_token
        const refreshTokenFromHeader = res?.headers?.['bit-refresh-token']
        const refreshToken = refreshTokenFromBody || refreshTokenFromHeader

        // Store tokens using your app??Ts real keys
        if (accessToken) setAccessToken(accessToken)
        if (refreshToken) setRefreshToken(refreshToken)

        dispatch(SET_LOADING(false))
        if (isEmailChange) {
          localStorage.removeItem('confirmation_flow')
        }
        navigate('/confirmation-success')
      })
      .catch((err) => {
        console.error('Network error while confirming', err)
        dispatch(SET_LOADING(false))
        navigate('/confirmation-error')
      })
  }, [token, dispatch, navigate])

  const email = localStorage.getItem('email') || ''

  return (
    <div className="h-screen bg-gray-900 w-full flex flex-col justify-center items-center gap-4">
      <h2 className="text-3xl text-center text-purple-200 50 font-semibold">
        Confirm Email
      </h2>

      {token ? (
        <p className="text-white text-lg">
          {isEmailChange ? 'Confirming your new email, please wait...' : 'Confirming your email, please wait...'}
        </p>
      ) : user?.confirmed_at ? (
        <p className="text-white text-lg">
          {isEmailChange ? 'New email has been confirmed' : 'Email has been confirmed'}
        </p>
      ) : (
        <p className="text-white text-lg">
          {isEmailChange ? `New email confirmation has been sent to ${email}` : `Email confirmation has been sent to ${email}`}
        </p>
      )}

      <div>
        <img src="/images/email.png" alt="" className="h-60 m-auto" />
      </div>

      <button
        className="bg-purple-950 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-all duration-300"
        onClick={() => {
          navigate(isEmailChange ? '/dashboard/profile-account?section=security' : '/login')
        }}
      >
        {isEmailChange ? 'Back to security' : 'Continue to Login'}
      </button>

      <p className="text-gray-500 text-sm">
        If you have not received a confirmation email, please check your spam
        folder or{' '}
        <NavLink
          to={`/send-confirmation${isEmailChange ? '?flow=email-change' : ''}`}
          className="text-purple-200 font-semibold"
        >
          resend confirmation
        </NavLink>
        .
      </p>
    </div>
  )
}

export default ConfirmEmail
