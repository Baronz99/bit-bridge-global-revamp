// frontend/bit-bridge-frontend/src/pages/auth/CheckEmail.jsx
import { NavLink } from 'react-router-dom'

const CheckEmail = () => {
  const email = localStorage.getItem('email') || ''

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 text-center text-white">
      <h2 className="text-3xl text-purple-200 font-semibold mb-4">
        Verify your email
      </h2>

      <p className="text-white text-lg mb-2">
        We&apos;ve sent a confirmation email to:
      </p>

      <p className="text-purple-300 text-xl font-bold mb-6">
        {email}
      </p>

      <p className="text-gray-400 mb-4 max-w-md">
        Please open that email and click the verification link.
        Once your email is confirmed, you can come back here and log in
        to continue setting up your BitBridge account.
      </p>

      {/* Resend confirmation link */}
      <NavLink
        to="/send-confirmation"
        className="text-purple-300 underline mb-6"
      >
        Resend email
      </NavLink>

      {/* Go to login after confirming */}
      <NavLink
        to="/login"
        className="inline-flex items-center justify-center px-6 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-sm font-medium"
      >
        Continue to log in
      </NavLink>
    </div>
  )
}

export default CheckEmail
