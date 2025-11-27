import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

const ConfirmationError = () => {
  // const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)

  console.log(user)
  const navigate = useNavigate()

  return (
    <div className="h-screen bg-gray-900 w-full flex flex-col justify-center items-center gap-4">
      <h2 className="text-3xl text-center text-red-400 50 font-semibold"> Email Not Confirmed</h2>
      {/* <p className='text-white text-lg'>Email has been confirmed</p> : */}
      <p className="text-white text-lg">Email confirmation failed </p>
      <div>
        <img src="/images/error-message.png" alt="error confirmation" className="h-60 m-auto" />
      </div>
      {/* {user?.confirmed_at && storedToken} */}
      <button
        className="bg-purple-950 text-white px-4 py-2 rounded-md hover:bg-purple-800 transition-all duration-300"
        disabled={user?.confirmed_at !== null}
        onClick={() => {
          navigate('/login')
        }}
      >
        Back to Login
      </button>
    </div>
  )
}

// };

export default ConfirmationError
