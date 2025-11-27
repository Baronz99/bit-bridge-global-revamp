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
import logo from '../../../assets/logos/2.png'
import { useDispatch, useSelector } from 'react-redux'

import { userSignUp } from '../../../redux/actions/auth'
import { SET_LOADING } from '../../../redux/app'

export const AdminSignup = () => {
  const { token } = theme.useToken()
  const { loading } = useSelector((state) => state.auth)
  const [loginType, setLoginType] = useState('phone')
  const dispatch = useDispatch()
  const navigate = useNavigate()

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
            dispatch(userSignUp({ user: values })).then((result) => {
              if (userSignUp.fulfilled.match(result)) {
                dispatch(SET_LOADING(false))
                navigate('/dashboard/home')
              } else if (userSignUp.rejected.match(result)) {
                dispatch(SET_LOADING(false))
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
            // width: "500px",
            justifyContent: 'center',
          }}
          subTitle="Nigerians Largest trading and exchange platform"
          actions={
            <Space>
              Already have an account? <NavLink to={'/login'}>Login</NavLink>
              <AlipayCircleOutlined style={iconStyles} />
              <TaobaoCircleOutlined style={iconStyles} />
              <WeiboCircleOutlined style={iconStyles} />
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
          </>

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

const ASignup = () => (
  <ConfigProvider locale={enUS}>
    <AdminSignup />
  </ConfigProvider>
)

export default ASignup
