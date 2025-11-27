// frontend/bit-bridge-frontend/src/pages/auth/Login.jsx

import {
  AlipayOutlined,
  LockOutlined,
  MobileOutlined,
  TaobaoOutlined,
  UserOutlined,
  WeiboOutlined,
} from '@ant-design/icons'
import {
  LoginFormPage,
  ProConfigProvider,
  ProFormCaptcha,
  ProFormText,
} from '@ant-design/pro-components'
import { Button, ConfigProvider, Tabs, message, theme } from 'antd'
import { useEffect, useState } from 'react'
import './style.scss'
import logo from '../../assets/logos/2.png'

const iconStyles = {
  color: 'rgba(0, 0, 0, 0.2)',
  fontSize: '18px',
  verticalAlign: 'middle',
  cursor: 'pointer',
}

import enUS from 'antd/es/locale/en_US'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { userLogin } from '../../redux/actions/auth'
import { SET_LOADING } from '../../redux/app'

const LoginPage = () => {
  const { logged } = useSelector((state) => state.auth)
  const [loginType, setLoginType] = useState('account')
  const dispatch = useDispatch()
  const location = useLocation()
  const [loading, setLoading] = useState(false)

  const { token } = theme.useToken()
  const navigate = useNavigate()

  // Read saved email (from signup / check-email) to prefill login form
  const savedEmail =
    typeof window !== 'undefined' ? localStorage.getItem('email') || '' : ''

  useEffect(() => {
    // you can add side-effects here later if needed
  }, [])

  if (!logged) {
    return (
      <div
        style={{
          backgroundColor: 'white',
          height: '100vh',
        }}
      >
        <LoginFormPage
          loading={loading}
          // 👇 prefill email from localStorage
          initialValues={{ email: savedEmail }}
          onFinish={(values) => {
            dispatch(SET_LOADING(true))
            setLoading(true)

            dispatch(userLogin({ user: values })).then((result) => {
  if (userLogin.fulfilled.match(result)) {
    dispatch(SET_LOADING(false))
    setLoading(false)

    // Try to read the logged-in user from the response
    const payloadUser =
      result.payload?.data || result.payload?.user || result.payload || {}

    const onboardingStage = payloadUser?.onboarding_stage

    // If onboarding not started, send them to the use-case step
    const nextPath =
      !onboardingStage || onboardingStage === 'not_started'
        ? '/onboarding/use-case'
        : (location.state?.from?.pathname || '/dashboard/home')

    navigate(nextPath)
  } else if (userLogin.rejected.match(result)) {
    setLoading(false)
    dispatch(SET_LOADING(false))
  }
})

          }}
          backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"
          logo={logo}
          backgroundVideoUrl="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/jXRBRK_VAwoAAAAAAAAAAAAAK4eUAQBr"
          title={<NavLink to={'/'}> BitBridge Global</NavLink>}
          containerStyle={{
            backgroundColor: 'rgba(0, 0, 0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
          className="login-page"
          subTitle="Login "
          style={{
            color: 'white',
          }}
          activityConfig={{
            style: {
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
              color: 'white',
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(4px)',
            },
            title: 'Securely Bridge Your Digital Assets',
            subTitle:
              'Access your BitBridge account and seamlessly manage your digital assets.',
            text: ' Enjoy a secure, fast, and user-friendly experience while bridging assets across networks',
            action: (
              <Button
                size="large"
                style={{
                  borderRadius: 20,
                  background: token.colorBgElevated,
                  color: token.colorPrimary,
                  width: 120,
                }}
                onClick={() => navigate('/signup')}
              >
                Sign Up
              </Button>
            ),
          }}
          actions={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
              }}
            >
              {/* Social login area (currently disabled) */}
            </div>
          }
        >
          <Tabs
            centered
            activeKey={loginType}
            onChange={(activeKey) => setLoginType(activeKey)}
          >
            <Tabs.TabPane key={'account'} tab={'Login with account'} />
            {/* <Tabs.TabPane key={'phone'} tab={'Login with phone number'} /> */}
          </Tabs>

          {loginType === 'account' && (
            <>
              <ProFormText
                name="email"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <UserOutlined
                      style={{
                        color: token.colorText,
                      }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                placeholder={'username or email'}
                rules={[
                  {
                    required: true,
                    message: 'Please enter your username!',
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{
                        color: token.colorText,
                      }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                placeholder={'Password'}
                rules={[
                  {
                    required: true,
                    message: 'Please enter your password!',
                  },
                ]}
              />
            </>
          )}

          {loginType === 'phone' && (
            <>
              <ProFormText
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <MobileOutlined
                      style={{
                        color: token.colorText,
                      }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                name="mobile"
                placeholder={'Mobile Number'}
                rules={[
                  {
                    required: true,
                    message: 'Please enter your mobile number!',
                  },
                  {
                    pattern: /^1\d{10}$/,
                    message: 'Invalid mobile number format!',
                  },
                ]}
              />
              <ProFormCaptcha
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{
                        color: token.colorText,
                      }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                captchaProps={{
                  size: 'large',
                }}
                placeholder={'Please enter the verification code.'}
                captchaTextRender={(timing, count) => {
                  if (timing) {
                    return `${count} ${'Get verification code'}`
                  }
                  return 'Get verification code'
                }}
                name="captcha"
                rules={[
                  {
                    required: true,
                    message: 'Please enter the verification code',
                  },
                ]}
                onGetCaptcha={async () => {
                  message.success(
                    'Verification code successfully obtained! The code is: 1234'
                  )
                }}
              />
            </>
          )}

          <div
            style={{
              marginBlockEnd: 24,
            }}
          >
            <NavLink to={'/send-confirmation'} className="btn btn-primary">
              Confirm Account
            </NavLink>
            <a
              style={{
                float: 'right',
              }}
              onClick={() => navigate('/forgot-password')}
            >
              Forgot Password
            </a>
          </div>
        </LoginFormPage>
      </div>
    )
  }

  // If already logged in, push to dashboard
  navigate('/dashboard/home')
  return null
}

export const App = () => {
  return (
    <ConfigProvider locale={enUS}>
      <ProConfigProvider dark>
        <LoginPage />
      </ProConfigProvider>
    </ConfigProvider>
  )
}

export default App
