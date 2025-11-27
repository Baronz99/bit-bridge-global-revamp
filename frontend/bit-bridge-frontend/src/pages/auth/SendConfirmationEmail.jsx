import { LoginForm, ProConfigProvider, ProFormText, setAlpha } from '@ant-design/pro-components'

import { ConfigProvider, Space, Tabs, theme } from 'antd'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/logos/2.png'
import { useDispatch, useSelector } from 'react-redux'
import { sendUserConfirmation, userSignUp } from '../../redux/actions/auth'
import { SET_LOADING } from '../../redux/app'
import { MdOutlineAlternateEmail } from 'react-icons/md'
import { toast } from 'react-toastify'

export const SendConfirmEmail = () => {
  const { token } = theme.useToken()
  const { loading } = useSelector((state) => state.auth)
  const [loginType, setLoginType] = useState('phone')
  const dispatch = useDispatch()
  const navigate = useNavigate()

  console.log(loading)

  return (
    <ProConfigProvider hashed={false}>
      <div
        className=""
        style={{
          height: '100vh',
          backgroundColor: token.colorBgContainer,
        }}
      >
        <LoginForm
          loading={loading}
          onFinish={(values) => {
            dispatch(SET_LOADING(true))

            dispatch(sendUserConfirmation(values.email)).then((result) => {
              if (sendUserConfirmation.fulfilled.match(result)) {
                dispatch(SET_LOADING(false))
                toast(result?.payload?.message || 'Email sent', { type: 'success' })

                navigate('/confirmation')
              } else {
                dispatch(SET_LOADING(false))
                toast(result?.payload?.message || 'Email Confirmation failed', { type: 'error' })
              }
            })
          }}
          // backgroundImageUrl="https://mdn.alipayobjects.com/huamei_gcee1x/afts/img/A*y0ZTS6WLwvgAAAAAAAAAAAAADml6AQ/fmt.webp"

          // backgroundVideoUrl="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/jXRBRK_VAwoAAAAAAAAAAAAAK4eUAQBr"

          logo={logo}
          title={<NavLink to={'/'}> BitBridge Global</NavLink>}
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
              submitText: 'Send Email Confirmation', // Change button text to Sign Up
            },
          }}
        >
          <Tabs centered activeKey={loginType} onChange={(activeKey) => setLoginType(activeKey)}>
            <Tabs.TabPane key={'account'} tab={'Recieve Email Confirmation'} />
          </Tabs>
          <>
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

export default SendConfirmEmail
