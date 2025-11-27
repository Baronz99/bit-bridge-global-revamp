import { LockOutlined } from '@ant-design/icons'
import { LoginForm, ProConfigProvider, ProFormText, setAlpha } from '@ant-design/pro-components'
import enUS from 'antd/es/locale/en_US'

import { ConfigProvider, Space, Tabs, theme } from 'antd'
import { useState } from 'react'
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import logo from '../../assets/logos/2.png'
import { useDispatch, useSelector } from 'react-redux'
import { changePasswordReset } from '../../redux/actions/auth'
import { SET_LOADING } from '../../redux/app'
import { toast } from 'react-toastify'

export const ResetPassword = () => {
  const { token } = theme.useToken()
  const [query] = useSearchParams()

  // read from link: /reset_password?password_token=...&email=...
  const email = query.get('email')
  const passwordToken = query.get('password_token')

  const { loading } = useSelector((state) => state.auth)
  const [loginType, setLoginType] = useState('account')
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const iconStyles = {
    marginInlineStart: '16px',
    color: setAlpha(token.colorTextBase, 0.2),
    fontSize: '24px',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }

  const handleFinish = (values) => {
    // basic frontend check
    if (values.password !== values.confirm_password) {
      toast('Passwords do not match', { type: 'error' })
      return
    }

    dispatch(SET_LOADING(true))

    dispatch(
      changePasswordReset({
        user: {
          password_token: passwordToken,
          password: values.password,
          confirm_password: values.confirm_password,
          // email is NOT required by the backend for this action,
          // but we can still send it if you like:
          // email,
        },
      })
    ).then((result) => {
      dispatch(SET_LOADING(false))

      if (changePasswordReset.fulfilled.match(result)) {
        toast('Password updated', { type: 'success' })
        navigate('/login')
      } else {
        toast('Password update failed', { type: 'error' })
      }
    })
  }

  return (
    <ProConfigProvider hashed={false}>
      <div style={{ backgroundColor: token.colorBgContainer }}>
        <LoginForm
          loading={loading}
          onFinish={handleFinish}
          logo={logo}
          title="BitBridge Global"
          backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"
          containerStyle={{
            backdropFilter: 'blur(4px)',
            height: '100vh',
            display: 'flex',
            objectFit: 'cover',
            justifyContent: 'center',
          }}
          subTitle="Utility bills payment platform"
          actions={
            <Space>
              Already have an account? <NavLink to={'/login'}>Login</NavLink>
            </Space>
          }
          submitter={{
            searchConfig: {
              submitText: 'Save Password',
            },
          }}
        >
          <Tabs centered activeKey={loginType} onChange={(activeKey) => setLoginType(activeKey)}>
            <Tabs.TabPane key={'account'} tab={'RESET PASSWORD'} />
          </Tabs>

          {/* Optional: show which email we are resetting for */}
          {email && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              Resetting password for <b>{email}</b>
            </div>
          )}

          {/* New password */}
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />,
              strengthText:
                'Password should contain numbers, letters, and special characters, at least 8 characters long.',
              statusRender: (value) => {
                const getStatus = () => {
                  if (value && value.length > 12) return 'ok'
                  if (value && value.length > 6) return 'pass'
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
            placeholder={'New password'}
            rules={[
              {
                required: true,
                message: 'Please enter your new password!',
              },
            ]}
          />

          {/* Confirm password */}
          <ProFormText.Password
            name="confirm_password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />,
            }}
            placeholder={'Confirm new password'}
            rules={[
              {
                required: true,
                message: 'Please confirm your password!',
              },
            ]}
          />

          <div
            style={{
              marginBlockEnd: 24,
            }}
          />
        </LoginForm>
      </div>
    </ProConfigProvider>
  )
}

const ResetPasswordPage = () => (
  <ConfigProvider locale={enUS}>
    <ResetPassword />
  </ConfigProvider>
)

export default ResetPasswordPage
