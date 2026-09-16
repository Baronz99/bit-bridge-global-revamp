// frontend/bit-bridge-frontend/src/pages/auth/CheckEmail.jsx
import { NavLink, useSearchParams } from 'react-router-dom'

const CheckEmail = () => {
  const [query] = useSearchParams()
  const email = localStorage.getItem('email') || ''
  const flow = query.get('flow') || localStorage.getItem('confirmation_flow') || 'signup'
  const isEmailChange = flow === 'email-change'

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center text-white">
      <h2 className="text-3xl text-purple-200 font-semibold mb-4">
        {isEmailChange ? 'Confirm your new email' : 'Verify your email'}
      </h2>

      <p className="text-white text-lg mb-2">
        {isEmailChange ? 'We’ve sent a confirmation link to your new email:' : 'We&apos;ve sent a confirmation email to:'}
      </p>

      <p className="text-purple-300 text-xl font-bold mb-6">
        {email}
      </p>

      <p className="text-gray-400 mb-4 max-w-md">
        {isEmailChange
          ? 'Your login email remains unchanged until you open that inbox and confirm the new address. After confirmation, return to account security to continue.'
          : 'Please open that email and click the verification link. Once your email is confirmed, you can come back here and log in to continue setting up your BitBridge account.'}
      </p>

      {/* Resend confirmation link */}
      <NavLink
        to={`/send-confirmation${isEmailChange ? '?flow=email-change' : ''}`}
        className="text-purple-300 underline mb-6"
      >
        {isEmailChange ? 'Resend confirmation to new email' : 'Resend email'}
      </NavLink>

      {/* Go to login after confirming */}
      <NavLink
        to={isEmailChange ? '/dashboard/profile-account?section=security' : '/login'}
        className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-sm font-medium"
      >
        {isEmailChange ? 'Back to security' : 'Continue to log in'}
      </NavLink>
    </div>
  )
}

export default CheckEmail
