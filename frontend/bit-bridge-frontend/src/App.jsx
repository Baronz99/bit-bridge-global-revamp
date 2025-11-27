import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/HomePage'
import HomeDashboard from './pages/dashboard'
import DashboardLayout from './layouts/Dashboard'
import Account from './pages/dashboard/account'
import GiftCards from './pages/dashboard/gift-card'
import Transactions from './pages/dashboard/transactions'
import Orders from './pages/dashboard/transactions/Orders'
import Trades from './pages/dashboard/transactions/Trades'
import Withdrawals from './pages/dashboard/transactions/Withdrawals'
import Bitcoin from './pages/dashboard/crypto-exchange/Bitcoin'
import Dogecoin from './pages/dashboard/crypto-exchange/Dogecoin'
import MainLayout from './layouts'
import UtilityView from './pages/UtilityServicesPage/UtilityView'
import LoginPage from './pages/auth/Login'

// NEW – onboarding + KYC
import OnboardingStart from './pages/auth/OnboardingStart'
import UseCaseSetup from './pages/auth/UseCaseSetup'
import KycCenter from './pages/dashboard/KycCenter'

import PaymentMenthod from './pages/checkout/PaymentMenthod'

import Loader from './components/modal/Loader'
import { useSelector } from 'react-redux'
import userInitializeData from './hooks/userInitializer'
import { AppToast } from './components/toast'

import AdminHome from './pages/admin'
import AdminDashboardLayout from './layouts/AdminDashBoard'
import Purchases from './pages/admin/purchases/purchases'
import Products from './pages/admin/products/Products'
import Services from './pages/admin/services/Services'
import AddProduct from './pages/admin/AddProducts'
import ALogin from './pages/auth/admin/Login'
import ASignup from './pages/auth/admin/SignUp'
import { lazy, Suspense, useEffect } from 'react'
import LoaderPage from './components/loader/LoaderPage'
import CryptoSell from './pages/dashboard/crypto-exchange/CryptoSell'
import AdminTransactions from './pages/admin/transactions/deposits'
import Users from './pages/admin/users/Users'
import Deposits from './pages/dashboard/transactions/Deposits'
import ConfirmOrder from './pages/ConfirmOrder'
import ViewProduct from './pages/admin/products/View'
import OrderTransact from './pages/dashboard/components/Orders'
import BuyPower from './pages/UtilityServicesPage/BuyPower'
import ViewBuyPower from './pages/UtilityServicesPage/buy-power/ViewBuyPower'
import PowerForm from './pages/UtilityServicesPage/buy-power/PurchaseForm'
import PurchaseDetails from './pages/UtilityServicesPage/buy-power/PurchaseDetails'
import ComfirmPurchase from './pages/UtilityServicesPage/buy-power/ConfirmPurchase'
import ScrollToTop from './hooks/scrollToTop'
import ViewOrder from './pages/admin/purchases/ViewOrder'
import GiftCardOrder from './pages/dashboard/GiftCardOrder'
import ContactUs from './pages/contact-us/ContactUs'
import AboutUs from './pages/about-us/AboutUs'
import TermsCondintion from './pages/policies/TermsCondintion'
import PrivacyPolicies from './pages/policies/PrivacyPolicies'
import PurchaseDataDetails from './pages/PhoneTopUp/buy-data/PurchaseDetails'
import ComfirmDataPurchase from './pages/PhoneTopUp/buy-data/ConfirmPurchase'
import PurchaseCableDetails from './pages/UtilityServicesPage/buy-cable/PurchaseDetails'
import Ethereum from './pages/dashboard/crypto-exchange/Ethereum'
import ForgotPasswordPage from './pages/auth/ForgotPassword'
import ResetPasswordPage from './pages/auth/PasswordReset'
import ComfirmCablePurchase from './pages/UtilityServicesPage/buy-cable/ConfirmPurchase'
import Utility from './pages/dashboard/utility/Utility'
import PowerUtilities from './pages/dashboard/utility/power/PowerUtilities'
import PowerView from './pages/dashboard/utility/power/PowerView'
import DashboardPowerForm from './pages/dashboard/utility/power/PowerForm'
// import DashboardPurchaseDetails from './pages/dashboard/utility/power/PurchaseDetails'
// import DashboardComfirmPurchase from './pages/dashboard/utility/power/ConfirmPurchase'
import MainServices from './pages/services'
import ProductView from './pages/ProductPage/ViewProduct'
import CableUtilities from './pages/dashboard/utility/cable/CableUtilities'
import CableView from './pages/dashboard/utility/cable/PowerView'
import DashboardCableForm from './pages/dashboard/utility/cable/CableForm'
import SiteMap from './pages/policies/SiteMap'
import VulnerabilityDisclosure from './pages/policies/VulnerabilityDisclosure'
import MobileTopUps from './pages/dashboard/utility/mobile-top-up/MobileTops'
import DashboardMobileForm from './pages/dashboard/utility/mobile-top-up/MobileForm'
import MobileView from './pages/dashboard/utility/mobile-top-up/MobileView'
import ViewTransaction from './pages/admin/transactions/ViewTransaction'
import ViewUser from './pages/admin/users/ViewUser'
import ComfirmQuickPurchase from './pages/dashboard/ConfirmQuickPurchase'
import AdminWithdrawalTransactions from './pages/admin/transactions/withdrawals'
import AppRedirect from './pages/AppRedirect'
import ProfileAccountPage from './pages/dashboard/ProfilePage'
import QueryRequest from './pages/admin/query/QueryRequest'
import ConfirmEmail from './pages/auth/ConfirmEmail'
import SendConfirmEmail from './pages/auth/SendConfirmationEmail'
import ConfirmationSuccess from './pages/auth/ConfirmationSuccess'
import ConfirmationError from './pages/auth/ConfirmationError'
import ConfirmPayment from './pages/checkout/ConfirmPayment'
import DashboardPurchaseDetails from './pages/dashboard/PurchaseDetails'
import DashboardComfirmPurchase from './pages/dashboard/ConfirmPurchase'
import VirtualCardApplication from './components/cardView/CardView'
import CheckEmail from './pages/auth/CheckEmail'

const ViewMobileTopUp = lazy(() => import('./pages/PhoneTopUp/ViewMobileTopUp'))
const PhoneTopUp = lazy(() => import('./pages/PhoneTopUp'))
const GiftCardPage = lazy(() => import('./pages/GiftCardPage'))
const UtilityServices = lazy(() => import('./pages/UtilityServicesPage'))
const ViewGiftCard = lazy(() => import('./pages/GiftCardPage/ViewGiftCard'))
const CryptoExchangePage = lazy(() => import('./pages/cryptoExchangePage'))

function App() {
  const { isLoading } = useSelector((state) => state.app)

  // useEffect(() => {
  // const script =   document.createElement('script');
  // script.src = "https://sdk.monnify.com/plugin/monnify.js"
  // script.async = true;
  // document.body.appendChild(script)
  // }, [])

  userInitializeData()

  ScrollToTop()
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

          <Route
            path="/gift-cards"
            element={
              <MainLayout>
                <GiftCardPage />
              </MainLayout>
            }
          />

          <Route
            path="/crypto-exchange"
            element={
              <MainLayout>
                <CryptoExchangePage />
              </MainLayout>
            }
          />

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

          <Route
            path="/gift-cards/:id"
            element={
              <MainLayout>
                <ViewGiftCard />
              </MainLayout>
            }
          />

          <Route
            path="/crypto-exchange/:id"
            element={
              <MainLayout>
                <ViewGiftCard />
              </MainLayout>
            }
          />

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
            <Route path="virtual-account" element={<VirtualCardApplication />} />

            {/* NEW – KYC center */}
            <Route path="kyc" element={<KycCenter />} />

            <Route path="home" element={<HomeDashboard />}>
              <Route path="orders-transaction" element={<OrderTransact />} />
            </Route>

            <Route path="approved-gift-cards" element={<GiftCardOrder />} />
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

            {/* mobile top up  */}
            <Route path="utilities/mobile-top-up" element={<MobileTopUps />} />
            <Route path="utilities/mobile-top-up/:id" element={<MobileView />}>
              <Route path="mobileform" element={<DashboardMobileForm />} />
              <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />
              <Route path="payment-details" element={<DashboardPurchaseDetails />} />
            </Route>

            <Route path="confirm-payment" element={<DashboardComfirmPurchase />} />

            <Route path="gift-cards" element={<GiftCards />} />
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

          {/* NEW – Onboarding routes */}
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
          </Route>
        </Routes>

        <Loader isLoaderOpen={isLoading} />
      </Suspense>
    </div>
  )
}

export default App
