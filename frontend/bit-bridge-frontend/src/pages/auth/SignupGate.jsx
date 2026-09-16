import OnboardingStart from './OnboardingStart'
import PhoneFirstSignup from './PhoneFirstSignup'
import { isPhoneFirstSignupEnabled } from '../../utils/featureFlags'

const SignupGate = () => (isPhoneFirstSignupEnabled() ? <PhoneFirstSignup /> : <OnboardingStart />)

export default SignupGate

