import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleFilled,
  CheckOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import logo from '../../assets/logos/bitbridge-logo-clear.png'
import './PhoneFirstSignup.css'
import { SET_LOADING } from '../../redux/app'
import { userProfile } from '../../redux/actions/auth'
import { completeSignupIntent, requestSignupIntentOtp, verifySignupIntentOtp } from '../../api/signupIntents'
import {
  clearSignupIntentSession,
  loadSignupIntentSession,
  saveSignupIntentSession,
} from '../../utils/signupIntentStorage'
import { setAccessToken, setRefreshToken } from '../../auth/tokenStore'

const { Title, Text, Paragraph, Link } = Typography

const STORAGE_FRIENDLY_ERROR = {
  invalid: 'That code is not correct. Please check and try again.',
  expired: 'This code has expired. Request a new code.',
  blocked: 'Too many attempts. Please wait and try again later.',
  failed: 'We could not send a code right now. Please try again shortly.',
  not_verified: 'Please verify your phone number first.',
  phone_in_use: 'This phone number is already linked to an account. Sign in or contact support.',
  sms_provider_unavailable: 'We could not send a code right now. Please try again shortly.',
}

const getErrorPayload = (error) => {
  const data = error?.response?.data
  if (!data) return {}
  if (typeof data === 'string') return { message: data }
  return data
}

const getFriendlyErrorMessage = (error, fallback) => {
  const payload = getErrorPayload(error)
  const code = String(payload?.status || payload?.reason || payload?.error_code || '').trim()
  const messageText = String(payload?.message || '').trim()
  const status = error?.response?.status

  if (status === 429 || code === 'throttled' || code === 'cooldown') {
    const seconds = payload?.retry_after_seconds || payload?.resend_available_in_seconds
    return seconds
      ? `Please wait ${seconds} seconds before requesting another code.`
      : 'Please wait before requesting another code.'
  }

  if (code === 'phone_in_use' || /already linked to an account|already in use/i.test(messageText)) {
    return 'This phone number is already linked to an account. Sign in or contact support.'
  }

  if (code === 'expired') {
    return 'This code has expired. Request a new code.'
  }

  if (code === 'invalid') {
    return 'That code is not correct. Please check and try again.'
  }

  if (code === 'sms_provider_unavailable' || /temporarily unavailable/i.test(messageText)) {
    return 'We could not send a code right now. Please try again shortly.'
  }

  if (/already been taken/i.test(messageText)) {
    return 'This email is already linked to an account. Sign in instead.'
  }

  if (code && STORAGE_FRIENDLY_ERROR[code]) return STORAGE_FRIENDLY_ERROR[code]
  if (messageText) return messageText
  if (payload?.error) return payload.error
  if (typeof error?.message === 'string' && error.message) return error.message
  return fallback
}

const extractAuthTokens = (response) => {
  const data = response?.data || {}
  const header = response?.headers?.['bit-refresh-token'] || response?.headers?.['Bit-Refresh-Token']
  return {
    accessToken: data?.access_token || data?.token || data?.jwt || null,
    refreshToken: data?.refresh_token || header || null,
  }
}

const normalizePhone = (value) => String(value || '').trim()

const defaultState = {
  stage: 'phone',
  signup_intent_id: null,
  phone_number: '',
  phone_e164: '',
  otp_expires_at: '',
  expires_at: '',
  debug_otp: '',
  verified_at: '',
}

const steps = [
  { key: 'phone', label: 'Phone' },
  { key: 'verify', label: 'Verify' },
  { key: 'complete', label: 'Account' },
]

const heroBullets = [
  'Fast mobile verification',
  'Account protection designed for trust',
  'Built for people, businesses, and communities',
]

const PhoneFirstSignup = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [requestForm] = Form.useForm()
  const [verifyForm] = Form.useForm()
  const [completeForm] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState(() => {
    const saved = loadSignupIntentSession()
    return saved && typeof saved === 'object' ? { ...defaultState, ...saved } : defaultState
  })

  const stage = session.stage || 'phone'
  const currentStep = useMemo(() => {
    if (stage === 'verify') return 1
    if (stage === 'complete') return 2
    return 0
  }, [stage])

  useEffect(() => {
    if (session.signup_intent_id || session.stage !== 'phone' || session.phone_number) {
      saveSignupIntentSession(session)
    } else {
      clearSignupIntentSession()
    }
  }, [session])

  useEffect(() => {
    requestForm.setFieldsValue({ phone_number: session.phone_number })
    verifyForm.setFieldsValue({ code: '' })
    completeForm.setFieldsValue({
      first_name: session.first_name,
      last_name: session.last_name,
      email: session.email,
    })
  }, [completeForm, requestForm, session.email, session.first_name, session.last_name, session.phone_number, verifyForm])

  const updateSession = (next) => {
    setSession((prev) => ({ ...prev, ...next }))
  }

  const resetFlow = () => {
    clearSignupIntentSession()
    setSession(defaultState)
    requestForm.resetFields()
    verifyForm.resetFields()
    completeForm.resetFields()
  }

  const handleRequestOtp = async (values) => {
    const phone_number = normalizePhone(values.phone_number)
    setSubmitting(true)
    dispatch(SET_LOADING(true))

    try {
      const response = await requestSignupIntentOtp({
        phone_number,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
      })
      const data = response?.data || {}
      updateSession({
        stage: 'verify',
        signup_intent_id: data.signup_intent_id,
        phone_number,
        phone_e164: data.phone_e164 || session.phone_e164 || '',
        otp_expires_at: data.expires_at || '',
        expires_at: data.expires_at || '',
        debug_otp: data.debug_otp || '',
      })
      message.success('Code sent.')
      if (data.debug_otp && import.meta.env.DEV) {
        message.info(`Dev OTP: ${data.debug_otp}`)
      }
    } catch (error) {
      message.error(getFriendlyErrorMessage(error, 'Unable to send verification code.'))
    } finally {
      setSubmitting(false)
      dispatch(SET_LOADING(false))
    }
  }

  const handleVerifyOtp = async (values) => {
    if (!session.signup_intent_id) {
      message.error('Please request a code first.')
      return
    }

    setSubmitting(true)
    dispatch(SET_LOADING(true))

    try {
      const response = await verifySignupIntentOtp({
        signup_intent_id: session.signup_intent_id,
        phone_number: session.phone_number,
        code: values.code,
      })
      const data = response?.data || {}
      updateSession({
        stage: 'complete',
        verified_at: data.verified_at || '',
      })
      message.success('Phone verified.')
    } catch (error) {
      message.error(getFriendlyErrorMessage(error, 'Unable to verify the code.'))
    } finally {
      setSubmitting(false)
      dispatch(SET_LOADING(false))
    }
  }

  const storeTokensAndHydrate = async (response) => {
    const { accessToken, refreshToken } = extractAuthTokens(response)
    if (accessToken) setAccessToken(accessToken)
    if (refreshToken) setRefreshToken(refreshToken)

    const hydrateResult = await dispatch(userProfile())
    return !userProfile.rejected.match(hydrateResult)
  }

  const handleComplete = async (values) => {
    if (!session.signup_intent_id) {
      message.error('Please verify your phone number first.')
      return
    }

    setSubmitting(true)
    dispatch(SET_LOADING(true))

    try {
      const response = await completeSignupIntent({
        signup_intent_id: session.signup_intent_id,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        password: values.password,
        password_confirmation: values.password_confirmation,
      })

      await storeTokensAndHydrate(response)
      clearSignupIntentSession()
      resetFlow()
      message.success('Account created successfully.')
      navigate('/dashboard/home', { replace: true })
    } catch (error) {
      message.error(getFriendlyErrorMessage(error, 'Unable to create your account.'))
    } finally {
      setSubmitting(false)
      dispatch(SET_LOADING(false))
    }
  }

  const handleResendCode = async () => {
    if (!session.phone_number) return
    setSubmitting(true)
    dispatch(SET_LOADING(true))
    try {
      const response = await requestSignupIntentOtp({
        phone_number: session.phone_number,
      })
      const data = response?.data || {}
      updateSession({
        stage: 'verify',
        signup_intent_id: data.signup_intent_id || session.signup_intent_id,
        phone_e164: data.phone_e164 || session.phone_e164 || '',
        otp_expires_at: data.expires_at || session.otp_expires_at || '',
        expires_at: data.expires_at || session.expires_at || '',
        debug_otp: data.debug_otp || '',
      })
      message.success('Code resent.')
      if (data.debug_otp && import.meta.env.DEV) {
        message.info(`Dev OTP: ${data.debug_otp}`)
      }
    } catch (error) {
      message.error(getFriendlyErrorMessage(error, 'Unable to resend the code.'))
    } finally {
      setSubmitting(false)
      dispatch(SET_LOADING(false))
    }
  }

  const renderStep = (step, index) => {
    const completed = index < currentStep
    const active = index === currentStep
    const stateClass = completed ? ' is-complete' : active ? ' is-active' : ''

    return (
      <div key={step.key} className={`phone-signup-step${stateClass}`}>
        <div className="phone-signup-step__badge">
          {completed ? <CheckCircleFilled /> : index + 1}
        </div>
        <div className="phone-signup-step__content">
          <Text className="phone-signup-step__label">{step.label}</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="phone-signup-page">
      <div className="phone-signup-shell">
        <Card bordered={false} className="phone-signup-card">
          <div className="phone-signup-card__inner">
            <aside className="phone-signup-hero" aria-label="Secure onboarding">
              <div className="phone-signup-hero__orb" />

              <img src={logo} alt="BITBRIDGE Global" className="phone-signup-hero__logo" />

              <div className="phone-signup-hero__content">
                <Text className="phone-signup-hero__eyebrow">Secure onboarding</Text>
                <Title level={1} className="phone-signup-hero__title">
                  Start securely with BITBRIDGE Global
                </Title>
                <Paragraph className="phone-signup-hero__copy">
                  Secure payments, cards, virtual accounts, and shared money tools for people,
                  businesses, and communities.
                </Paragraph>
              </div>

              <div className="phone-signup-hero__bullets">
                {heroBullets.map((bullet) => (
                  <div key={bullet} className="phone-signup-hero__bullet">
                    <div className="phone-signup-hero__bullet-icon">
                      <CheckOutlined />
                    </div>
                    <Text className="phone-signup-hero__bullet-text">{bullet}</Text>
                  </div>
                ))}
              </div>

              <div className="phone-signup-hero__trust">
                <Text className="phone-signup-hero__trust-title">Trusted onboarding</Text>
                <div className="phone-signup-hero__trust-grid">
                  <Text className="phone-signup-hero__trust-item">Secure payments</Text>
                  <Text className="phone-signup-hero__trust-item">Virtual accounts and cards</Text>
                  <Text className="phone-signup-hero__trust-item">Shared money tools</Text>
                </div>
              </div>
            </aside>

            <div className="phone-signup-form-column">
              <div className="phone-signup-form-header">
                <Text className="phone-signup-form-eyebrow">Account setup</Text>
                <Title level={2} className="phone-signup-form-title">
                  {stage === 'phone' && 'Create your account'}
                  {stage === 'verify' && 'Verify your phone'}
                  {stage === 'complete' && 'Secure your account'}
                </Title>
                <Paragraph className="phone-signup-form-copy">
                  {stage === 'phone' &&
                    'Enter your mobile number. We’ll send a secure verification code.'}
                  {stage === 'verify' &&
                    `Enter the 6-digit code sent to ${session.phone_number || 'your mobile number'}.`}
                  {stage === 'complete' &&
                    'Add your details to finish setting up BITBRIDGE Global.'}
                </Paragraph>
              </div>

              <div className="phone-signup-steps">
                {steps.map((step, index) => renderStep(step, index))}
              </div>

              {stage === 'phone' && (
                <Form form={requestForm} layout="vertical" onFinish={handleRequestOtp} requiredMark={false}>
                  <Form.Item
                    name="phone_number"
                    label="Mobile number"
                    rules={[
                      { required: true, message: 'Enter your mobile number.' },
                      {
                        pattern: /^[0-9+\-\s()]+$/,
                        message: 'Enter a valid phone number.',
                      },
                    ]}
                  >
                    <Input
                      prefix={<PhoneOutlined />}
                      size="large"
                      placeholder="08012345678"
                      autoComplete="tel"
                    />
                  </Form.Item>

                  <Alert
                    type="info"
                    showIcon
                    message="We’ll send a secure code to this number."
                    className="phone-signup-alert"
                  />

                  <div className="phone-signup-actions">
                    <Link
                      onClick={(event) => {
                        event.preventDefault()
                        navigate('/login')
                      }}
                      href="/login"
                      className="phone-signup-link"
                    >
                      Already have an account? Sign in
                    </Link>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      size="large"
                      className="phone-signup-button phone-signup-button--primary"
                    >
                      Continue
                    </Button>
                  </div>
                </Form>
              )}

              {stage === 'verify' && (
                <Form form={verifyForm} layout="vertical" onFinish={handleVerifyOtp} requiredMark={false}>
                  <Alert
                    type="success"
                    showIcon
                    message="Code sent"
                    description={
                      <span>
                        We sent a 6-digit code to <strong>{session.phone_number}</strong>.
                      </span>
                    }
                    className="phone-signup-alert"
                  />

                  {session.debug_otp && import.meta.env.DEV && (
                    <div className="phone-signup-debug">
                      <Text className="phone-signup-debug__label">Dev OTP: </Text>
                      <Text code className="phone-signup-debug__code">
                        {session.debug_otp}
                      </Text>
                    </div>
                  )}

                  <Form.Item
                    name="code"
                    label="Verification code"
                    rules={[
                      { required: true, message: 'Enter the 6-digit code.' },
                      { len: 6, message: 'The code must be 6 digits.' },
                    ]}
                  >
                    <Input
                      prefix={<SafetyOutlined />}
                      size="large"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                    />
                  </Form.Item>

                  <div className="phone-signup-actions">
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      size="large"
                      className="phone-signup-button phone-signup-button--primary"
                    >
                      Verify phone
                    </Button>
                    <div className="phone-signup-actions phone-signup-actions--inline phone-signup-actions--secondary">
                      <Button
                        onClick={handleResendCode}
                        disabled={submitting}
                        className="phone-signup-button"
                      >
                        Resend code
                      </Button>
                      <Button
                        onClick={() => {
                          updateSession({ stage: 'phone' })
                          requestForm.setFieldsValue({ phone_number: session.phone_number })
                        }}
                        className="phone-signup-button"
                      >
                        Change number
                      </Button>
                    </div>
                  </div>
                </Form>
              )}

              {stage === 'complete' && (
                <Form
                  form={completeForm}
                  layout="vertical"
                  onFinish={handleComplete}
                  requiredMark={false}
                >
                  <Alert
                    type="success"
                    showIcon
                    message="Phone verified"
                    description={
                      <span>
                        <strong>{session.phone_number}</strong> is verified. Add your details to finish
                        setting up BITBRIDGE Global.
                      </span>
                    }
                    className="phone-signup-alert"
                  />

                  <Form.Item
                    name="first_name"
                    label="First name"
                    rules={[{ required: true, message: 'Enter your first name.' }]}
                  >
                    <Input prefix={<UserOutlined />} size="large" placeholder="John" autoComplete="given-name" />
                  </Form.Item>

                  <Form.Item
                    name="last_name"
                    label="Last name"
                    rules={[{ required: true, message: 'Enter your last name.' }]}
                  >
                    <Input prefix={<UserOutlined />} size="large" placeholder="Doe" autoComplete="family-name" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="Email address"
                    rules={[
                      { required: true, message: 'Enter your email address.' },
                      { type: 'email', message: 'Enter a valid email address.' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined />}
                      size="large"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: 'Create a password.' },
                      { min: 8, message: 'Use at least 8 characters.' },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      size="large"
                      placeholder="Create a password"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password_confirmation"
                    label="Confirm password"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: 'Confirm your password.' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) return Promise.resolve()
                          return Promise.reject(new Error('Passwords do not match.'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      size="large"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                    />
                  </Form.Item>

                  <div className="phone-signup-footnote">
                    <Text type="secondary">
                      By continuing, you agree to BITBRIDGE Global&apos;s Terms and Privacy Policy.
                    </Text>
                  </div>

                  <div className="phone-signup-actions">
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      size="large"
                      className="phone-signup-button phone-signup-button--primary"
                    >
                      Create account
                    </Button>
                    <div className="phone-signup-actions phone-signup-actions--secondary">
                      <Button
                        onClick={() => updateSession({ stage: 'verify' })}
                        className="phone-signup-button"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default PhoneFirstSignup
