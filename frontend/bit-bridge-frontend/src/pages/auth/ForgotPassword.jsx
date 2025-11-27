import {
  AlipayCircleOutlined,
  LockOutlined,
  TaobaoCircleOutlined,
  UserOutlined,
  WeiboCircleOutlined,
} from '@ant-design/icons'
import { LoginForm, ProConfigProvider, ProFormText, setAlpha } from '@ant-design/pro-components'
import enUS from 'antd/es/locale/en_US'

import { ConfigProvider, Space, Tabs, theme } from 'antd'
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import logo from '../../assets/logos/2.png'
import { useDispatch, useSelector } from 'react-redux'
import { userPasswordReset, userSignUp } from '../../redux/actions/auth'
import { SET_LOADING } from '../../redux/app'
import { toast } from 'react-toastify'

export const ForgotPassword = () => {
  const { token } = theme.useToken()
  const { loading } = useSelector((state) => state.auth)
  const [loginType, setLoginType] = useState('phone')
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [showMessage, setShowMessage] = useState(false)

  const iconStyles = {
    marginInlineStart: '16px',
    color: setAlpha(token.colorTextBase, 0.2),
    fontSize: '24px',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }

  return (
    <ProConfigProvider hashed={false}>
      <div style={{ backgroundColor: token.colorBgContainer }}>
        <LoginForm
          loading={loading}
          onFinish={(values) => {
            dispatch(SET_LOADING(true))

            dispatch(userPasswordReset(values)).then((result) => {
              if (userPasswordReset.fulfilled.match(result)) {
                dispatch(SET_LOADING(false))
                setShowMessage(true)
                toast('Email sent', { type: 'success' })
              } else {
                dispatch(SET_LOADING(false))
                toast('Email failled sent', { type: 'error' })
              }
            })
          }}
          logo={logo}
          title="BitBridge Global"
          backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"
          containerStyle={{
            backdropFilter: 'blur(4px)',
            height: '100vh',
            display: 'flex',
            objectFit: 'cover',
            // width: "500px",
            justifyContent: 'center',
          }}
          subTitle="Gift Card trading and exchange platform"
          actions={
            <Space>
              Already have an account? <NavLink to={'/login'}>Login</NavLink>
              {/* <AlipayCircleOutlined style={iconStyles} />
              <TaobaoCircleOutlined style={iconStyles} />
              <WeiboCircleOutlined style={iconStyles} /> */}
            </Space>
          }
          submitter={{
            searchConfig: {
              submitText: 'Send Password Reset Link',
            },
          }}
        >
          <Tabs centered activeKey={loginType} onChange={(activeKey) => setLoginType(activeKey)}>
            <Tabs.TabPane key={'account'} tab={'Forgot Password'} />
          </Tabs>
          <>
            <ProFormText
              name="email"
              fieldProps={{
                size: 'large',
                prefix: <UserOutlined className={'prefixIcon'} />,
              }}
              placeholder={'email@example.com'}
              rules={[
                {
                  required: true,
                  message: 'Please enter your email!',
                },
              ]}
            />
          </>

          {showMessage && (
            <div className="bg-green-100 shadow text-green-800 py-3 px-2 rounded-lg">
              <p>A reset link has been sent to you</p>
            </div>
          )}

          <div
            style={{
              marginBlockEnd: 24,
            }}
          ></div>
        </LoginForm>
      </div>
    </ProConfigProvider>
  )
}

const ForgotPasswordPage = () => (
  <ConfigProvider locale={enUS}>
    <ForgotPassword />
  </ConfigProvider>
)

export default ForgotPasswordPage
