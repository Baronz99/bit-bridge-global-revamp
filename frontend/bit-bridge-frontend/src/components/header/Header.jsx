import { NavLink, useLocation, useNavigate } from 'react-router-dom'
// import SearchField from '../serachField/SearchField'
import Nav from '../nav/Nav'
import { MenuUnfoldOutlined, QuestionCircleOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import './style.scss'
import logo from '../../assets/logos/logo-mod.png'
import { Badge, Button, Form } from 'antd'
import { useEffect, useState } from 'react'
import DrawerModal from '../drawer/Drawer'
import Carts from '../carts/Carts'
import { useDispatch, useSelector } from 'react-redux'
import { GET_CART, SET_LOADING } from '../../redux/app'
import { userLogin, userLogout } from '../../redux/actions/auth'
import FormInput from '../formInput/FormInput'
import ClassicBtn from '../button/ClassicButton'
import { toast } from 'react-toastify'
const Header = () => {
  const [toggleNav, setToggle] = useState(false)
  const { pathname } = useLocation()

  // const inActive = `inactive  ${(pathname !== "/" && pathname !== "/phone-top-up" ) ?  "text-primary" : "text-alt"}`
  const inActive = `inactive text-alt`

  const navigate = useNavigate()

  const { cartItems } = useSelector((state) => state.app)
  const [open, setOpen] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { user } = useSelector((state) => state.auth)
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(GET_CART())
  }, [])

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

      <header className="absolute  bg-primar w-full top-0 z-10 left-0 p-4  px-0 border-b border-gray-700 shadow">
        <div className=" max-w-app-layout -700 m-auto px-4">
          <div className="flex gap-3 flex-wrap md:flex-row flex-col justify-between items-center">
            <div className="w-full md:w-max flex items-center gap-4">
              <Button
                onClick={() => setToggle((prev) => !prev)}
                className="md:hidden nav-btn"
                shape="circle"
                icon={<MenuUnfoldOutlined />}
              />

              <NavLink to={'/'} className={'text-3xl font-semibold'}>
                <img src={logo} alt="logo" className="h-14 w- object-cover border" />
              </NavLink>
            </div>

            {/* <SearchField className={"w-full max-w-md flex-"}/> */}

            <div className="flex  items-center gap-4 md:justify-end justify-between w-full md:w-max">
              {/* <NavLink to={"/"} className={`${inActive}  text-center font-semibold text-alt hover:bg-gray-800 hover:text-gray-200  border flex gap-3 py-2 px-4 rounded-3xl`} >
              <QuestionCircleOutlined className={`${inActive} flex text-center`}/>
              Help
            </NavLink> */}
              <a
                href={'/#app'}
                className={`${inActive}  text-center font-semibold text-alt hover:bg-gray-800 hover:text-gray-200  border flex gap-3 py-2 px-4 rounded-3xl`}
              >
                <QuestionCircleOutlined className={`${inActive} flex text-center`} />
                Get App
              </a>
              <Badge className="badge" count={cartItems.length} showZero>
                <Button
                  className="bg-none"
                  onClick={() => setOpen(true)}
                  type="default"
                  shape="circle"
                  icon={<ShoppingCartOutlined className={`${inActive}`} />}
                  size="middle"
                />
              </Badge>
              {user ? (
                <NavLink
                  onClick={() => dispatch(userLogout())}
                  to={'/'}
                  className={`${inActive} block text-center`}
                >
                  Log Out
                </NavLink>
              ) : (
                // <NavLink to={"/login"} className={"font-semibold"}>Login</NavLink>
                <div className="relative z-10 ">
                  <button
                    onClick={() => setShowLogin((prev) => !prev)}
                    to={'/login'}
                    className={`${inActive} block text-center`}
                  >
                    Login
                  </button>
                  <div
                    className={`${showLogin ? 'block' : 'hidden'} absolute  py-4 w-60 group-hover:block right-0`}
                  >
                    <div className="p-2 z-50 bg-gray-900 border border-primary rounded-lg">
                      <Form
                        initialValues={{
                          email: '',
                          password: '',
                        }}
                        onFinish={(values) => {
                          dispatch(SET_LOADING(true))

                          dispatch(userLogin({ user: values })).then((result) => {
                            if (userLogin.fulfilled.match(result)) {
                              dispatch(SET_LOADING(false))
                              console.log(result.payload.message)
                              navigate('/dashboard/home')
                              setShowLogin(false)
                            } else if (userLogin.rejected.match(result)) {
                              dispatch(SET_LOADING(false))
                            }
                          })
                        }}
                      >
                        <FormInput name={'email'} placeholder={'Email'} />
                        <FormInput type="password" name={'password'} placeholder={'**********'} />
                        <ClassicBtn htmlType={'submit'} className={'w-full'}>
                          Sign In
                        </ClassicBtn>
                        <NavLink
                          to={'/send-confirmation'}
                          className="btn text-center block text-alt"
                        >
                          Confirm Account
                        </NavLink>
                      </Form>
                      <NavLink to={'/signup'} className={`${inActive} block text-center`}>
                        Sign up
                      </NavLink>
                    </div>
                  </div>
                </div>
              )}
              {user && (
                <NavLink to={'/dashboard/home'} className={`${inActive} block text-center`}>
                  Account
                </NavLink>
              )}
              {/* <NavLink to={"/dashboard/home"}>Account</NavLink> */}
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
