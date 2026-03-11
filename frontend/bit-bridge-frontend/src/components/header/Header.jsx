import { NavLink, useNavigate } from 'react-router-dom'
import Nav from '../nav/Nav'
import {
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import './style.scss'
import logoIcon from '../../assets/logos/bitbridge-logo-clear.png'
import { useEffect, useState } from 'react'
import DrawerModal from '../drawer/Drawer'
import Carts from '../carts/Carts'
import { useDispatch, useSelector } from 'react-redux'
import { GET_CART, SET_LOADING } from '../../redux/app'
import { userLogin, userLogout } from '../../redux/actions/auth'
import ClassicBtn from '../button/ClassicButton'

const Header = () => {
  const [toggleNav, setToggle] = useState(false)
  const inActive = `inactive text-alt`

  const navigate = useNavigate()

  const { cartItems } = useSelector((state) => state.app)
  const [open, setOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    dispatch(GET_CART())
  }, [dispatch])

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setLoginLoading(true)
    dispatch(SET_LOADING(true))

    try {
      const result = await dispatch(userLogin({ user: loginForm }))
      if (userLogin.fulfilled.match(result)) {
        navigate('/dashboard/home')
        setShowLogin(false)
        setLoginForm({ email: '', password: '' })
      }
    } finally {
      setLoginLoading(false)
      dispatch(SET_LOADING(false))
    }
  }

  return (
    <>
      <DrawerModal
        open={open}
        onClose={() => {
          setOpen(!open)
        }}
      >
        <Carts items={cartItems} />
      </DrawerModal>

      <header className="absolute bg-primar w-full top-0 z-10 left-0 p-4 px-0 border-b border-gray-700 shadow">
        <div className="max-w-app-layout -700 m-auto px-4">
          <div className="flex gap-3 flex-wrap md:flex-row flex-col justify-between items-center">
            <div className="w-full md:w-max flex items-center gap-4">
              <button
                type="button"
                onClick={() => setToggle((prev) => !prev)}
                className="md:hidden nav-btn inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-transparent text-slate-200"
                aria-label="Toggle navigation"
              >
                <MenuUnfoldOutlined />
              </button>

              <NavLink to="/" className="flex items-center gap-3">
                <img
                  src={logoIcon}
                  alt="BitBridge Global logo"
                  className="h-10 w-10 object-contain"
                />

                <div className="leading-tight">
                  <div className="text-slate-100 font-semibold tracking-[0.16em] text-[11px] md:text-xs uppercase">
                    BIT BRIDGE
                  </div>
                  <div className="text-slate-400 font-medium tracking-[0.26em] text-[9px] md:text-[10px] uppercase">
                    GLOBAL
                  </div>
                </div>
              </NavLink>
            </div>

            <div className="flex items-center gap-4 md:justify-end justify-between w-full md:w-max">
              <a
                href={'/#app'}
                className={`${inActive} text-center font-semibold text-alt hover:bg-gray-800 hover:text-gray-200 border flex gap-3 py-2 px-4 rounded-3xl`}
              >
                <QuestionCircleOutlined className={`${inActive} flex text-center`} />
                Get App
              </a>

              <button
                type="button"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-transparent text-slate-200"
                onClick={() => setOpen(true)}
                aria-label="Open cart"
              >
                <ShoppingCartOutlined className={`${inActive}`} />
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-alt px-1 text-[10px] font-semibold text-black">
                  {cartItems.length}
                </span>
              </button>

              {user ? (
                <NavLink
                  onClick={() => dispatch(userLogout())}
                  to="/"
                  className={`${inActive} block text-center`}
                >
                  Log Out
                </NavLink>
              ) : (
                <div className="relative z-10">
                  <button
                    onClick={() => setShowLogin((prev) => !prev)}
                    className={`${inActive} block text-center`}
                  >
                    Login
                  </button>
                  <div
                    className={`${
                      showLogin ? 'block' : 'hidden'
                    } absolute py-4 w-60 right-0`}
                  >
                    <div className="p-2 z-50 bg-gray-900 border border-primary rounded-lg">
                      <form className="space-y-3" onSubmit={handleLoginSubmit}>
                        <input
                          type="email"
                          value={loginForm.email}
                          onChange={(event) =>
                            setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                          }
                          placeholder="Email"
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-alt"
                          required
                        />
                        <input
                          type="password"
                          value={loginForm.password}
                          onChange={(event) =>
                            setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                          placeholder="**********"
                          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-alt"
                          required
                        />
                        <ClassicBtn htmlType="submit" isLoading={loginLoading} className="w-full !my-0">
                          Sign In
                        </ClassicBtn>
                        <NavLink
                          to="/send-confirmation"
                          className="btn text-center block text-alt"
                        >
                          Confirm Account
                        </NavLink>
                      </form>
                      <NavLink to="/signup" className={`${inActive} block text-center mt-3`}>
                        Sign up
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}

              {user && (
                <NavLink to="/dashboard/home" className={`${inActive} block text-center`}>
                  Account
                </NavLink>
              )}
            </div>
          </div>

          <div className="max-w-7x m-auto">
            <Nav open={toggleNav} setToggle={setToggle} />
          </div>
        </div>
      </header>
    </>
  )
}

export default Header
