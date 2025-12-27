// frontend/bit-bridge-frontend/src/pages/auth/Login.jsx

import { LockOutlined, MobileOutlined, UserOutlined } from '@ant-design/icons'
import {
  LoginFormPage,
  ProConfigProvider,
  ProFormCaptcha,
  ProFormText,
} from '@ant-design/pro-components'
import { Button, ConfigProvider, Tabs, message, theme } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import './style.scss'

// ✅ NEW: small CSS overrides (removes yellow autofill/focus border)
import './login-overrides.css'

// ✅ Use your clearer/bolder logo
import logo from '../../assets/logos/bitbridge-logo-clear.png'

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
  const [reasonShown, setReasonShown] = useState(false)

  // ✅ Keep EXACT same autofill behavior as your original file
  const savedEmail =
    typeof window !== 'undefined' ? localStorage.getItem('email') || '' : ''

  // ✅ Prefer explicit ?returnTo=... if present (your axios 401 redirect uses it)
  const returnTo = useMemo(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const rt = qs.get('returnTo')
      // Basic safety: only allow internal paths
      if (rt && rt.startsWith('/')) return rt
    } catch {
      // no-op
    }
    return null
  }, [])

  // ✅ Fix: never navigate during render (this caused blank page + warning)
  useEffect(() => {
    if (logged) {
      // If they already got logged (e.g. token restored), go where they intended
      navigate(returnTo || location.state?.from?.pathname || '/dashboard/home', {
        replace: true,
      })
    }
  }, [logged, navigate, location.state, returnTo])

  useEffect(() => {
    if (reasonShown) return
    const qs = new URLSearchParams(location.search)
    const reason = qs.get('reason')
    if (reason === 'idle') {
      message.info('Session expired due to inactivity. Please log in again.')
      setReasonShown(true)
    } else if (reason === 'session_expired') {
      message.info('Your session has expired. Please log in again.')
      setReasonShown(true)
    }
  }, [location.search, reasonShown])

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
          initialValues={{ email: savedEmail }}
          onFinish={(values) => {
            dispatch(SET_LOADING(true))
            setLoading(true)

            dispatch(userLogin({ user: values })).then((result) => {
              if (userLogin.fulfilled.match(result)) {
                dispatch(SET_LOADING(false))
                setLoading(false)

                // ✅ BEST UX: always go dashboard after login
                // KYC/onboarding is handled inside the app (banner + KYC center)
                navigate(returnTo || location.state?.from?.pathname || '/dashboard/home', {
                  replace: true,
                })
              } else if (userLogin.rejected.match(result)) {
                setLoading(false)
                dispatch(SET_LOADING(false))
              }
            })
          }}
          backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"
          logo={logo}
          backgroundVideoUrl="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/jXRBRK_VAwoAAAAAAAAAAAAAK4eUAQBr"
          title={
            <NavLink
              to="/"
              style={{
                display: 'inline-block',
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: '0.01em',
                color: '#fff',
                lineHeight: 1.2,
                textDecoration: 'none',
                textShadow: '0 2px 8px rgba(0,0,0,0.28)',
              }}
            >
              Bit Bridge Global
            </NavLink>
          }
          containerStyle={{
            backgroundColor: 'rgba(0, 0, 0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
          className="login-page"
          subTitle="Login "
          style={{ color: 'white' }}
          activityConfig={{
            style: {
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.2)',
              color: 'white',
              borderRadius: 8,
              backgroundColor: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(4px)',
            },
            title: 'Securely Bridge Your Digital Assets',
            subTitle: 'Access your BitBridge account and seamlessly manage your digital assets.',
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
          actions={<div style={{ display: 'flex', justifyContent: 'center' }} />}
        >
          <Tabs centered activeKey={loginType} onChange={(k) => setLoginType(k)}>
            <Tabs.TabPane key={'account'} tab={'Login with account'} />
            {/* <Tabs.TabPane key={'phone'} tab={'Login with phone number'} /> */}
          </Tabs>

          {loginType === 'account' && (
            <>
              <ProFormText
                name="email"
                fieldProps={{
                  size: 'large',
                  autoComplete: 'email',
                  className: 'bbg-auth-input',
                  prefix: (
                    <UserOutlined
                      style={{ color: token.colorText }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                placeholder={'username or email'}
                rules={[{ required: true, message: 'Please enter your username!' }]}
              />

              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  autoComplete: 'current-password',
                  className: 'bbg-auth-input',
                  prefix: (
                    <LockOutlined
                      style={{ color: token.colorText }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                placeholder={'Password'}
                rules={[{ required: true, message: 'Please enter your password!' }]}
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
                      style={{ color: token.colorText }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                name="mobile"
                placeholder={'Mobile Number'}
                rules={[
                  { required: true, message: 'Please enter your mobile number!' },
                  { pattern: /^1\d{10}$/, message: 'Invalid mobile number format!' },
                ]}
              />
              <ProFormCaptcha
                fieldProps={{
                  size: 'large',
                  prefix: (
                    <LockOutlined
                      style={{ color: token.colorText }}
                      className={'prefixIcon'}
                    />
                  ),
                }}
                captchaProps={{ size: 'large' }}
                placeholder={'Please enter the verification code.'}
                captchaTextRender={(timing, count) => {
                  if (timing) return `${count} ${'Get verification code'}`
                  return 'Get verification code'
                }}
                name="captcha"
                rules={[{ required: true, message: 'Please enter the verification code' }]}
                onGetCaptcha={async () => {
                  message.success('Verification code successfully obtained! The code is: 1234')
                }}
              />
            </>
          )}

          <div style={{ marginBlockEnd: 24 }}>
            <NavLink to={'/send-confirmation'} className="btn btn-primary">
              Confirm Account
            </NavLink>
            <a style={{ float: 'right' }} onClick={() => navigate('/forgot-password')}>
              Forgot Password
            </a>
          </div>
        </LoginFormPage>
      </div>
    )
  }

  // logged === true -> redirect happens in useEffect
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
