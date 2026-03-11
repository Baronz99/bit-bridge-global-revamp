import { lazy, Suspense } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import './App.css'
import Loader from './components/modal/Loader'
import LoaderPage from './components/loader/LoaderPage'
import userInitializeData from './hooks/userInitializer'
import { AppToast } from './components/toast'
import ScrollToTop from './hooks/scrollToTop'
import useIdleLogout from './hooks/useIdleLogout'
const Home = lazy(() => import('./pages/HomePage'))
const DashboardLayout = lazy(() => import('./layouts/Dashboard'))
const MainLayout = lazy(() => import('./layouts'))
const AdminDashboardLayout = lazy(() => import('./layouts/AdminDashBoard'))
const ViewMobileTopUp = lazy(() => import('./pages/PhoneTopUp/ViewMobileTopUp'))
const PhoneTopUp = lazy(() => import('./pages/PhoneTopUp'))
const UtilityServices = lazy(() => import('./pages/UtilityServicesPage'))
const UtilityView = lazy(() => import('./pages/UtilityServicesPage/UtilityView'))
const PaymentMenthod = lazy(() => import('./pages/checkout/PaymentMenthod'))
const ConfirmOrder = lazy(() => import('./pages/ConfirmOrder'))
const BuyPower = lazy(() => import('./pages/UtilityServicesPage/BuyPower'))
const ViewBuyPower = lazy(() => import('./pages/UtilityServicesPage/buy-power/ViewBuyPower'))
const PowerForm = lazy(() => import('./pages/UtilityServicesPage/buy-power/PurchaseForm'))
const PurchaseDetails = lazy(() => import('./pages/UtilityServicesPage/buy-power/PurchaseDetails'))
const ComfirmPurchase = lazy(() => import('./pages/UtilityServicesPage/buy-power/ConfirmPurchase'))
const ContactUs = lazy(() => import('./pages/contact-us/ContactUs'))
const AboutUs = lazy(() => import('./pages/about-us/AboutUs'))
const TermsCondintion = lazy(() => import('./pages/policies/TermsCondintion'))
const PrivacyPolicies = lazy(() => import('./pages/policies/PrivacyPolicies'))
const PurchaseDataDetails = lazy(() => import('./pages/PhoneTopUp/buy-data/PurchaseDetails'))
const ComfirmDataPurchase = lazy(() => import('./pages/PhoneTopUp/buy-data/ConfirmPurchase'))
const PurchaseCableDetails = lazy(() => import('./pages/UtilityServicesPage/buy-cable/PurchaseDetails'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPasswordPage = lazy(() => import('./pages/auth/PasswordReset'))
const ComfirmCablePurchase = lazy(() => import('./pages/UtilityServicesPage/buy-cable/ConfirmPurchase'))
const MainServices = lazy(() => import('./pages/services'))
const ProductView = lazy(() => import('./pages/ProductPage/ViewProduct'))
const SiteMap = lazy(() => import('./pages/policies/SiteMap'))
const VulnerabilityDisclosure = lazy(() => import('./pages/policies/VulnerabilityDisclosure'))
const AppRedirect = lazy(() => import('./pages/AppRedirect'))
const ConfirmPayment = lazy(() => import('./pages/checkout/ConfirmPayment'))
const LoginPage = lazy(() => import('./pages/auth/Login'))
const OnboardingStart = lazy(() => import('./pages/auth/OnboardingStart'))
const UseCaseSetup = lazy(() => import('./pages/auth/UseCaseSetup'))
const ALogin = lazy(() => import('./pages/auth/admin/Login'))
const ASignup = lazy(() => import('./pages/auth/admin/SignUp'))
const ConfirmEmail = lazy(() => import('./pages/auth/ConfirmEmail'))
const SendConfirmEmail = lazy(() => import('./pages/auth/SendConfirmationEmail'))
const ConfirmationSuccess = lazy(() => import('./pages/auth/ConfirmationSuccess'))
const ConfirmationError = lazy(() => import('./pages/auth/ConfirmationError'))
const CheckEmail = lazy(() => import('./pages/auth/CheckEmail'))
const HomeDashboard = lazy(() => import('./pages/dashboard'))
const Account = lazy(() => import('./pages/dashboard/account'))
const BridgeSend = lazy(() => import('./pages/dashboard/BridgeSend'))
const Transactions = lazy(() => import('./pages/dashboard/transactions'))
const Orders = lazy(() => import('./pages/dashboard/transactions/Orders'))
const Trades = lazy(() => import('./pages/dashboard/transactions/Trades'))
const Withdrawals = lazy(() => import('./pages/dashboard/transactions/Withdrawals'))
const Deposits = lazy(() => import('./pages/dashboard/transactions/Deposits'))
const Bitcoin = lazy(() => import('./pages/dashboard/crypto-exchange/Bitcoin'))
const Dogecoin = lazy(() => import('./pages/dashboard/crypto-exchange/Dogecoin'))
const Ethereum = lazy(() => import('./pages/dashboard/crypto-exchange/Ethereum'))
const CryptoSell = lazy(() => import('./pages/dashboard/crypto-exchange/CryptoSell'))
const KycCenter = lazy(() => import('./pages/dashboard/KycCenter'))
const HomeDashboardOrderTransact = lazy(() => import('./pages/dashboard/components/Orders'))
const Utility = lazy(() => import('./pages/dashboard/utility/Utility'))
const PowerUtilities = lazy(() => import('./pages/dashboard/utility/power/PowerUtilities'))
const PowerView = lazy(() => import('./pages/dashboard/utility/power/PowerView'))
const DashboardPowerForm = lazy(() => import('./pages/dashboard/utility/power/PowerForm'))
const CableUtilities = lazy(() => import('./pages/dashboard/utility/cable/CableUtilities'))
const CableView = lazy(() => import('./pages/dashboard/utility/cable/PowerView'))
const DashboardCableForm = lazy(() => import('./pages/dashboard/utility/cable/CableForm'))
const MobileTopUps = lazy(() => import('./pages/dashboard/utility/mobile-top-up/MobileTops'))
const DashboardMobileForm = lazy(() => import('./pages/dashboard/utility/mobile-top-up/MobileForm'))
const MobileView = lazy(() => import('./pages/dashboard/utility/mobile-top-up/MobileView'))
const ComfirmQuickPurchase = lazy(() => import('./pages/dashboard/ConfirmQuickPurchase'))
const ProfileAccountPage = lazy(() => import('./pages/dashboard/ProfilePage'))
const DashboardPurchaseDetails = lazy(() => import('./pages/dashboard/PurchaseDetails'))
const DashboardComfirmPurchase = lazy(() => import('./pages/dashboard/ConfirmPurchase'))
const VirtualCardApplication = lazy(() => import('./components/cardView/CardView'))
const VirtualAccounts = lazy(() => import('./pages/dashboard/VirtualAccounts'))
const Rewards = lazy(() => import('./pages/dashboard/Rewards'))
const Receipt = lazy(() => import('./pages/dashboard/Receipt'))
const BridgeDashboard = lazy(() => import('./pages/dashboard/BridgeDashboard'))
const TunnelDashboard = lazy(() => import('./pages/dashboard/TunnelDashboard'))
const ActivityCenter = lazy(() => import('./pages/dashboard/ActivityCenter'))
const CoreCenter = lazy(() => import('./pages/dashboard/CoreCenter'))
const CirclesPage = lazy(() => import('./pages/Circles/CirclesPage'))
const CirclesDetailPage = lazy(() => import('./pages/Circles/CirclesDetailPage'))
const AdminHome = lazy(() => import('./pages/admin'))
const Purchases = lazy(() => import('./pages/admin/purchases/purchases'))
const Products = lazy(() => import('./pages/admin/products/Products'))
const Services = lazy(() => import('./pages/admin/services/Services'))
const AddProduct = lazy(() => import('./pages/admin/AddProducts'))
const AdminTransactions = lazy(() => import('./pages/admin/transactions/deposits'))
const AdminWithdrawalTransactions = lazy(() => import('./pages/admin/transactions/withdrawals'))
const Users = lazy(() => import('./pages/admin/users/Users'))
const KycReviews = lazy(() => import('./pages/admin/KycReviews'))
const FxSettings = lazy(() => import('./pages/admin/FxSettings'))
const PricingSpec = lazy(() => import('./pages/admin/PricingSpec'))
const KycReuseReview = lazy(() => import('./pages/admin/KycReuseReview'))
const ViewProduct = lazy(() => import('./pages/admin/products/View'))
const ViewOrder = lazy(() => import('./pages/admin/purchases/ViewOrder'))
const ViewTransaction = lazy(() => import('./pages/admin/transactions/ViewTransaction'))
const ViewUser = lazy(() => import('./pages/admin/users/ViewUser'))
const QueryRequest = lazy(() => import('./pages/admin/query/QueryRequest'))

function App() {
  const { isLoading } = useSelector((state) => state.app)

  // ✅ existing init
  userInitializeData()
  ScrollToTop()

  // ✅ NEW: web idle -> logout
  useIdleLogout({ idleMs: 10 * 60 * 1000, enabled: true })

  return (
    <div className="bg-gray-100 ">
      <Suspense fallback={<LoaderPage />}>
        <AppToast />

        <Routes>
          <Route
            path="/"
            element={
              <MainLayout>
                <Home />
              </MainLayout>
            }
          />
          <Route path="/app-redirect" element={<AppRedirect />} />
          <Route path="/checkout" element={<ConfirmPayment />} />

          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/terms-conditions" element={<TermsCondintion />} />
          <Route path="/privacy-policy" element={<PrivacyPolicies />} />
          <Route path="/vulnerability-disclosure" element={<VulnerabilityDisclosure />} />
          <Route path="/site-map" element={<SiteMap />} />
          <Route path="/about-us" element={<AboutUs />} />

          <Route
            path="/phone-top-up"
            element={
              <MainLayout>
                <PhoneTopUp />
              </MainLayout>
            }
          />
          <Route
            path="/phone-top-up/:id"
            element={
              <MainLayout>
                <ViewMobileTopUp />
              </MainLayout>
            }
          >
            <Route path="payment-details" element={<PurchaseDataDetails />} />
            <Route path="confirm-payment" element={<ComfirmDataPurchase />} />
          </Route>

          <Route
            path="/utility-services"
            element={
              <MainLayout>
                <UtilityServices />
              </MainLayout>
            }
          />
          <Route
            path="/utility-services/:id"
            element={
              <MainLayout>
                <UtilityView />
              </MainLayout>
            }
          >
            <Route path="payment-details" element={<PurchaseCableDetails />} />
            <Route path="confirm-payment" element={<ComfirmCablePurchase />} />
          </Route>

          <Route path="/gift-cards" element={<Navigate to="/" replace />} />

          <Route path="/crypto-exchange" element={<Navigate to="/" replace />} />

          <Route
            path="/services"
            element={
              <MainLayout>
                <Services />
              </MainLayout>
            }
          />

          <Route
            path="/product/:id"
            element={
              <MainLayout>
                <ProductView />
              </MainLayout>
            }
          />

          <Route path="/gift-cards/:id" element={<Navigate to="/" replace />} />

          <Route path="/crypto-exchange/:id" element={<Navigate to="/" replace />} />

          <Route
            path="/checkout/payment-method"
            element={
              <MainLayout>
                <PaymentMenthod />
              </MainLayout>
            }
          />

          <Route
            path="/confirmation-order"
            element={
              <MainLayout>
                <ConfirmOrder />
              </MainLayout>
            }
          />

          <Route
            path="/buy-power"
            element={
              <MainLayout>
                <BuyPower />
              </MainLayout>
            }
          />
          <Route
            path="/buy-power/:id"
            element={
              <MainLayout>
                <ViewBuyPower />
              </MainLayout>
            }
          >
            <Route path="payment-form" element={<PowerForm />} />
            <Route path="payment-details" element={<PurchaseDetails />} />
            <Route path="confirm-payment" element={<ComfirmPurchase />} />
          </Route>

          {/* DASHBOARD ROUTES */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<HomeDashboard />} />

            <Route path="profile-account" element={<ProfileAccountPage />} />
            <Route path="virtual-account" element={<Navigate to="/dashboard/virtual-cards" replace />} />
            <Route path="virtual-cards" element={<VirtualCardApplication />} />
            <Route path="virtual-accounts" element={<VirtualAccounts />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="receipt/:reference" element={<Receipt />} />

            <Route path="bridge" element={<BridgeDashboard />} />
            <Route path="bridge/wallet" element={<Navigate to="/dashboard/bridge" replace />} />
            <Route path="bridge/send" element={<BridgeSend />} />
            <Route path="bridge/utilities" element={<Navigate to="/dashboard/utilities" replace />} />
            <Route path="bridge/circles" element={<Navigate to="/dashboard/shared-groups" replace />} />
            <Route path="bridge/rewards" element={<Navigate to="/dashboard/rewards" replace />} />
            <Route path="tunnel" element={<TunnelDashboard />} />
            <Route path="tunnel/cards" element={<Navigate to="/dashboard/virtual-cards" replace />} />
            <Route path="tunnel/funding" element={<Navigate to="/dashboard/tunnel?panel=funding" replace />} />
            <Route path="tunnel/virtual-accounts" element={<Navigate to="/dashboard/tunnel/funding" replace />} />
            <Route path="tunnel/wallet" element={<Navigate to="/dashboard/tunnel" replace />} />
            <Route path="tunnel/fx" element={<Account />} />
            <Route path="activity" element={<ActivityCenter />} />
            <Route path="activity/transactions" element={<Navigate to="/dashboard/activity?tab=transactions" replace />} />
            <Route path="activity/receipts/:reference" element={<Receipt />} />
            <Route path="core" element={<CoreCenter />} />
            <Route path="core/kyc" element={<Navigate to="/dashboard/kyc" replace />} />
            <Route path="core/profile" element={<Navigate to="/dashboard/profile-account?section=profile" replace />} />
            <Route path="core/security" element={<Navigate to="/dashboard/profile-account?section=security" replace />} />
            <Route path="core/fees" element={<Navigate to="/dashboard/profile-account?section=fees" replace />} />
            <Route path="kyc" element={<KycCenter />} />

            <Route path="home" element={<HomeDashboard />}>
              <Route path="orders-transaction" element={<HomeDashboardOrderTransact />} />
            </Route>

            <Route path="shared-groups" element={<CirclesPage />} />
            <Route path="shared-groups/:id" element={<CirclesDetailPage />} />

            <Route path="approved-gift-cards" element={<Navigate to="/dashboard/activity" replace />} />
            <Route path="wallet" element={<Account />} />
            <Route path="confirm/:id" element={<ComfirmQuickPurchase />} />

            <Route path="utilities" element={<Utility />} />
            <Route path="utilities/buy-power" element={<PowerUtilities />} />
            <Route path="utilities/buy-power/:id" element={<PowerView />}>
              <Route path="powerform" element={<DashboardPowerForm />} />
              <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />
              <Route path="payment-details" element={<DashboardPurchaseDetails />} />
            </Route>

            <Route path="utilities/cable" element={<CableUtilities />} />
            <Route path="utilities/cable/:id" element={<CableView />}>
              <Route path="cableform" element={<DashboardCableForm />} />
              <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />
              <Route path="payment-details" element={<DashboardPurchaseDetails />} />
            </Route>

            <Route path="utilities/mobile-top-up" element={<MobileTopUps />} />
            <Route path="utilities/mobile-top-up/:id" element={<MobileView />}>
              <Route path="mobileform" element={<DashboardMobileForm />} />
              <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />
              <Route path="payment-details" element={<DashboardPurchaseDetails />} />
            </Route>

            <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />

            <Route path="gift-cards" element={<Navigate to="/dashboard/tunnel" replace />} />
            <Route path="transactions" element={<Transactions />}>
              <Route path="orders" element={<Orders />} />
              <Route path="trades" element={<Trades />} />
              <Route path="deposits" element={<Deposits />} />
              <Route path="withdrawals" element={<Withdrawals />} />
            </Route>

            <Route path="crypto-sell" element={<CryptoSell />}>
              <Route path="bitcoin" element={<Bitcoin />} />
              <Route path="dogecoin" element={<Dogecoin />} />
              <Route path="ethereum" element={<Ethereum />} />
            </Route>
          </Route>

          {/* Onboarding routes */}
          <Route path="/onboarding" element={<OnboardingStart />} />
          <Route path="/onboarding/use-case" element={<UseCaseSetup />} />

          {/* AUTH ROUTES */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<OnboardingStart />} />
          <Route path="/check-email" element={<CheckEmail />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset_password" element={<ResetPasswordPage />} />

          {/* ADMIN AUTH */}
          <Route path="/admin/login" element={<ALogin />} />
          <Route path="/admin/signup" element={<ASignup />} />
          <Route path="/confirmation" element={<ConfirmEmail />} />
          <Route path="/send-confirmation" element={<SendConfirmEmail />} />
          <Route path="/confirmation-success" element={<ConfirmationSuccess />} />
          <Route path="/confirmation-error" element={<ConfirmationError />} />

          {/* ADMIN DASHBOARD */}
          <Route path="/admin" element={<AdminDashboardLayout />}>
            <Route path="dashboard" element={<AdminHome />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="query" element={<QueryRequest />} />
            <Route path="purchases/:id" element={<ViewOrder />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ViewProduct />} />
            <Route path="services" element={<MainServices />} />
            <Route path="add-product" element={<AddProduct />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="withdrawals" element={<AdminWithdrawalTransactions />} />
            <Route path="transactions/:id" element={<ViewTransaction />} />
            <Route path="users" element={<Users />} />
            <Route path="users/:id" element={<ViewUser />} />
            <Route path="kyc-reviews" element={<KycReviews />} />
            <Route path="kyc-reuse-review" element={<KycReuseReview />} />
            <Route path="fx-settings" element={<FxSettings />} />
            <Route path="pricing-spec" element={<PricingSpec />} />
          </Route>
        </Routes>

        <Loader isLoaderOpen={isLoading} />
      </Suspense>
    </div>
  )
}

export default App










