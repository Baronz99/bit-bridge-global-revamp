// src/layouts/DashboardLayout.jsx

import {
  HomeOutlined,
  LoginOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  WalletOutlined,
  CreditCardOutlined,
  IdcardOutlined,
} from '@ant-design/icons'
import PropTypes from 'prop-types'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { userLogout } from '../redux/actions/auth'
import DropDown from '../components/dropDown/DropDown'
import { LuUtilityPole } from 'react-icons/lu'
import { getWallet } from '../redux/actions/wallet'
import DrawerModal from '../components/drawer/Drawer'
import { SET_LOADING } from '../redux/app'
import LoaderPage from '../components/loader/LoaderPage'
import logoIcon from '../assets/logos/bitbridge-logo-clear.png'
import '../styles/userTheme.css'

const DashboardLayout = () => {
  const dispatch = useDispatch()
  const sideNavRef = useRef(null)
  const menuRef = useRef(null)
  const { user, loading } = useSelector((state) => state.auth)
  const { themeMode } = useSelector((state) => state.app || {})
  const [open, setOpen] = useState(false)
  const location = useLocation()

  const closeNav = (e) => {
    if (
      sideNavRef.current &&
      !sideNavRef.current.contains(e.target) &&
      !menuRef.current.contains(e.target)
    ) {
      setOpen(false)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', closeNav)
    return () => {
      document.removeEventListener('mousedown', closeNav)
    }
  }, [])

  useEffect(() => {
    dispatch(getWallet())
  }, [dispatch])

  if (loading && !user) {
    return <LoaderPage />
  }

  if (!loading && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const baseNavItem =
    'flex flex-col justify-center items-center gap-1 text-[11px] md:text-xs transition-colors'
  const active = `${baseNavItem} text-alt`
  const normal = `${baseNavItem} text-gray-300 hover:text-alt`
  const sectionTitleClass = 'text-[10px] uppercase tracking-[0.22em] text-slate-500 text-center mb-2'
  const desktopSectionClass = 'px-3 lg:px-4 border-r border-slate-800/70 last:border-r-0'
  const mobileSectionTitleClass = 'text-[10px] uppercase tracking-[0.22em] text-slate-500'

  const navSections = [
    {
      title: 'Bridge',
      items: [
        { to: '/dashboard/bridge/wallet', label: 'Wallet', icon: WalletOutlined },
        { to: '/dashboard/bridge/utilities', label: 'Utilities', icon: LuUtilityPole },
        { to: '/dashboard/bridge/circles', label: 'Circles', icon: UserOutlined },
        { to: '/dashboard/bridge/rewards', label: 'Rewards', icon: LuUtilityPole },
      ],
    },
    {
      title: 'Tunnel',
      items: [
        { to: '/dashboard/tunnel/cards', label: 'Cards', icon: CreditCardOutlined },
        { to: '/dashboard/tunnel/virtual-accounts', label: 'Accounts', icon: WalletOutlined },
        { to: '/dashboard/tunnel/wallet', label: 'Wallet', icon: WalletOutlined },
        { to: '/dashboard/tunnel/fx', label: 'FX', icon: SignalCellularAltIcon },
      ],
    },
    {
      title: 'Activity',
      items: [
        {
          to: '/dashboard/activity/transactions',
          label: 'Transactions',
          icon: SignalCellularAltIcon,
        },
      ],
    },
    {
      title: 'Core',
      items: [
        { to: '/dashboard/core/kyc', label: 'Verification', icon: IdcardOutlined },
        { to: '/dashboard/core/profile', label: 'Profile', icon: UserOutlined },
      ],
    },
  ]

  const renderNavItem = ({ to, label, icon: Icon }, extraClass = '') => (
    <NavLink to={to} className={({ isActive }) => `${isActive ? active : normal} ${extraClass}`.trim()}>
      <Icon className="text-xl" />
      <span>{label}</span>
    </NavLink>
  )

  return (
    <div className="bb-user-theme relative h-screen" data-theme={themeMode || 'dark'}>
      <div className="bb-dashboard-shell max-w-[1500px] m-auto flex flex-col overflow-hidden h-screen">
        <header className="bb-topbar flex justify-between items-center gap-4 rounded-2xl bg-gradient-to-r from-black via-slate-950 to-black border border-slate-800/70 md:py-5 py-3 px-5 md:px-7 mt-3 mb-3 shadow-sm">
          <button
            ref={menuRef}
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-black/70 p-2 text-alt"
            onClick={() => setOpen((prev) => !prev)}
          >
            <MenuUnfoldOutlined className="text-lg" />
          </button>

          <NavLink
            to="/dashboard/home"
            className="flex-1 flex items-center gap-3 text-white"
          >
            <img
              src={logoIcon}
              alt="BitBridge Global logo"
              className="h-9 w-9 md:h-10 md:w-10 object-contain"
            />

            <div className="leading-tight hidden sm:block">
              <div className="text-slate-100 font-semibold tracking-[0.16em] text-[11px] md:text-xs uppercase">
                BIT BRIDGE
              </div>
              <div className="text-slate-400 font-medium tracking-[0.26em] text-[9px] md:text-[10px] uppercase">
                GLOBAL
              </div>
            </div>
          </NavLink>

          <div className="md:flex w-full max-w-5xl items-start justify-between hidden text-gray-200 gap-4">
            <nav className="flex-1 flex justify-center">
              <div className="flex items-start rounded-2xl border border-slate-800/70 bg-black/30 px-3 py-3">
                <div className={desktopSectionClass}>
                  <div className={sectionTitleClass}>Home</div>
                  {renderNavItem({ to: '/dashboard/home', label: 'Home', icon: HomeOutlined })}
                </div>
                {navSections.map((section) => (
                  <div key={section.title} className={desktopSectionClass}>
                    <div className={sectionTitleClass}>{section.title}</div>
                    <div className="flex gap-4 lg:gap-5">
                      {section.items.map((item) => (
                        <div key={item.to}>{renderNavItem(item)}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <DropDown />
          </div>

          <div className="flex gap-4 md:hidden" />
        </header>

        <div className="bb-dashboard-frame flex overflow-hidden mt-0 h-full flex-1 w-full md:px-6">
          <div className="relative">
            <DrawerModal
              open={open}
              onClose={() => {
                setOpen(false)
              }}
            >
              <aside ref={sideNavRef} className="flex flex-col gap-7 text-white">
                <div className="flex flex-col gap-7">
                  <div onClick={() => setOpen(false)}>
                    {renderNavItem({ to: '/dashboard/home', label: 'Home', icon: HomeOutlined }, 'items-start')}
                  </div>

                  {navSections.map((section) => (
                    <div key={section.title} className="flex flex-col gap-4">
                      <div className={mobileSectionTitleClass}>{section.title}</div>
                      <ul className="flex flex-col gap-4">
                        {section.items.map((item) => (
                          <li key={item.to} onClick={() => setOpen(false)}>
                            {renderNavItem(item, 'items-start')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch(userLogout()).then((result) => {
                          dispatch(SET_LOADING(true))

                          if (userLogout.fulfilled.match(result)) {
                            dispatch(SET_LOADING(false))
                            setOpen(false)
                          } else {
                            dispatch(SET_LOADING(false))
                          }
                        })
                      }
                      className="w-full text-left"
                    >
                      <span className={`${normal} items-start`}>
                        <LoginOutlined className="text-xl" />
                        <span>Log Out</span>
                      </span>
                    </button>
                  </div>
                </div>
              </aside>
            </DrawerModal>
          </div>

          <div
            className="bb-dashboard-body dashboard-body md:mt-6 mt-3 w-full flex-1 overflow-y-auto pb-6"
            style={{
              backgroundColor: themeMode === 'light' ? '#f7f4ef' : '#0b1220',
            }}
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

DashboardLayout.propTypes = {
  children: PropTypes.node,
}

export default DashboardLayout
