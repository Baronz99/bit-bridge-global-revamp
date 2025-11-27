import { NavLink, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ConfirmationSuccess = () => {
  const { user } = useSelector((state) => state.auth)
  const navigate = useNavigate()

  return (
    <div className="h-screen bg-gray-900 w-full flex flex-col justify-center items-center gap-4">
      <h2 className="text-3xl text-center text-purple-200 font-semibold">
        Email Confirmed
      </h2>

      <p className="text-white text-lg">
        Your email has been successfully confirmed.
      </p>

      <div>
        <img src="/images/email-success.png" alt="" className="h-60 m-auto" />
      </div>

      <button
        className="bg-purple-950 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-all duration-300"
        onClick={() => {
          // You can choose /login or /dashboard/home here
          navigate('/login')
          // or navigate('/dashboard/home') once you fully hydrate auth from token
        }}
      >
        Continue to Login
      </button>
    </div>
  )
}

export default ConfirmationSuccess
