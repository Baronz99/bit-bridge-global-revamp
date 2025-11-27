import { LockOutlined, UserOutlined } from '@ant-design/icons'
import {
  LoginForm,
  ProConfigProvider,
  ProFormCheckbox,
  ProFormText,
  setAlpha,
} from '@ant-design/pro-components'
import enUS from 'antd/es/locale/en_US'

import { ConfigProvider, Space, Tabs, theme } from 'antd'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logos/2.png'
import { useDispatch, useSelector } from 'react-redux'
import { userSignUp } from '../../redux/actions/auth'
import { SET_LOADING } from '../../redux/app'
import { MdOutlineAlternateEmail, MdOutlinePhone } from 'react-icons/md'

import axios from "axios";
import { API_BASE_URL } from "../../api/config.js";



export const Signup = () => {
  const { token } = theme.useToken()
  const [loginType, setLoginType] = useState('phone')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

    const testBackend = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/health`)
      console.log('Backend health:', res.data)
      alert('✅ Backend is connected!')
    } catch (err) {
      console.error('Backend error:', err)
      alert('❌ Frontend cannot reach backend')
    }
  }


  const iconStyles = {
    marginInlineStart: '16px',
    color: setAlpha(token.colorTextBase, 0.2),
    fontSize: '24px',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600)
    }

    handleResize()

    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  console.log(isMobile)

  return (
    <ProConfigProvider hashed={false}>
      <div style={{ backgroundColor: token.colorBgContainer }}>
        <LoginForm
          contentStyle={{
            maxWidth: 420, // control width
            width: '100%',
            margin: '0 auto',
          }}
          onFinish={(values) => {
            setLoading(true)
            dispatch(SET_LOADING(true))

            dispatch(
              userSignUp({
                user: {
                  email: values.email,
                  password: values.password,
                  confirm_password: values.confirm_password,
                  user_profile_attributes: {
                    first_name: values.first_name,
                    last_name: values.last_name,
                    phone_number: values.phone_number,
                  },
                },
              })
            ).then((result) => {
              if (userSignUp.fulfilled.match(result)) {
                dispatch(SET_LOADING(false))
                localStorage.setItem('email', values.email)
                navigate('/check-email')
              } else {
                dispatch(SET_LOADING(false))
                setLoading(false)
                //  navigate(location.state?.from?.pathname ||"/confirmation")
              }
            })
          }}
          logo={logo}
          title={<NavLink to={'/'}> BitBridge Global</NavLink>}
          backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"
          containerStyle={{
            backdropFilter: 'blur(4px)',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
          }}
          subTitle="Nigerians Largest trading and exchange platform"
          actions={
            <Space className="text-gray-800 font-medium text-base">
              Already have an account? <NavLink to={'/login'}>Login</NavLink>
              {/* <AlipayCircleOutlined style={iconStyles} />
              <TaobaoCircleOutlined style={iconStyles} />
              <WeiboCircleOutlined style={iconStyles} /> */}
            </Space>
          }
          submitter={{
            searchConfig: {
              submitText: 'Sign Up', // Change button text to Sign Up
            },
          }}
        >
          <Tabs centered activeKey={loginType} onChange={(activeKey) => setLoginType(activeKey)}>
            <Tabs.TabPane key={'account'} tab={'Signup with email and password'} />
          </Tabs>
          <>
            <ProFormText
              name="first_name"
              fieldProps={{
                size: 'large',
                prefix: <UserOutlined className={'prefixIcon'} />,
              }}
              placeholder={'John'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your first name!',
                },
              ]}
            />
            <ProFormText
              name="last_name"
              fieldProps={{
                size: 'large',
                prefix: <UserOutlined className={'prefixIcon'} />,
              }}
              placeholder={'Doe'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your last name!',
                },
              ]}
            />

            <ProFormText
              name="email"
              fieldProps={{
                size: 'large',
                prefix: <MdOutlineAlternateEmail className={'prefixIcon'} />,
              }}
              placeholder={'email@example.com'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your email!',
                },
              ]}
            />

            <ProFormText
              name="phone_number"
              fieldProps={{
                size: 'large',
                prefix: <MdOutlinePhone className={'prefixIcon'} />,
              }}
              placeholder={'08012345678'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your email!',
                },
              ]}
            />
            <ProFormText.Password
              name="password"
              fieldProps={{
                size: 'large',
                prefix: <LockOutlined className={'prefixIcon'} />,
                strengthText:
                  'Password should contain numbers, letters, and special characters, at least 8 characters long.',
                statusRender: (value) => {
                  const getStatus = () => {
                    if (value && value.length > 12) {
                      return 'ok'
                    }
                    if (value && value.length > 6) {
                      return 'pass'
                    }
                    return 'poor'
                  }
                  const status = getStatus()
                  if (status === 'pass') {
                    return <div style={{ color: token.colorWarning }}>Strength: Medium</div>
                  }
                  if (status === 'ok') {
                    return <div style={{ color: token.colorSuccess }}>Strength: Strong</div>
                  }
                  return <div style={{ color: token.colorError }}>Strength: Weak.</div>
                },
              }}
              placeholder={'Password'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your password!',
                },
              ]}
            />

            <ProFormCheckbox
              name={'consent'}
              rules={[
                {
                  required: true,
                  message: 'You must consent before signing up',
                },
              ]}
            >
              <span className="text-black">
                I hereby give my e-signature and consent to use this platform in accordance with the{' '}
                <a href="/terms" target="_blank" className="text-blue-600 underline">
                  Terms & Conditions
                </a>
                .
              </span>
            </ProFormCheckbox>
          </>

          <div
            style={{
              marginBlockEnd: 24,
            }}
          ></div>

                    <button
            type="button"
            onClick={testBackend}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              borderRadius: 4,
              border: '1px solid #ccc',
            }}
          >
            Test Backend Connection
          </button>

        </LoginForm>
      </div>
    </ProConfigProvider>
  )
}

const App = () => (
  <ConfigProvider locale={enUS}>
    <Signup />
  </ConfigProvider>
)

export default App
