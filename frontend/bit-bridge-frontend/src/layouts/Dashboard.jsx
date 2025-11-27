// src/layouts/DashboardLayout.jsx

import {
  HomeOutlined,
  LoginOutlined,
  MenuUnfoldOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import PropTypes from 'prop-types'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { userLogout } from '../redux/actions/auth'
import DropDown from '../components/dropDown/DropDown'
import logo from '../assets/logos/logo-mod.png'
import { LuUtilityPole } from 'react-icons/lu'
import { getWallet } from '../redux/actions/wallet'
import DrawerModal from '../components/drawer/Drawer'
import { SET_LOADING } from '../redux/app'
import LoaderPage from '../components/loader/LoaderPage'

const DashboardLayout = () => {
  const dispatch = useDispatch()
  const sideNavRef = useRef(null)
  const menuRef = useRef(null)
  const { user, loading } = useSelector((state) => state.auth)
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
    // we intentionally ignore deps to keep behaviour stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    dispatch(getWallet())
  }, [dispatch])

  if (loading) {
    return <LoaderPage />
  }

  if (!loading && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // keep the same basic structure you had, just refined styles
  const baseNavItem =
    'flex flex-col justify-center items-center gap-1 text-[11px] md:text-xs transition-colors'
  const active = `${baseNavItem} text-alt`
  const normal = `${baseNavItem} text-gray-300 hover:text-alt`

  return (
    <div className="relative h-screen bg-slate-950">
      <div className="max-w-[1500px] m-auto flex flex-col overflow-hidden h-screen">
        {/* TOP BAR (refined, but same structure) */}
        <header className="flex justify-between items-center gap-4 rounded-2xl bg-gradient-to-r from-black via-slate-950 to-black border border-slate-800/70 md:py-5 py-3 px-5 md:px-7 mt-3 mb-3 shadow-sm">
          {/* Mobile menu button */}
          <button
            ref={menuRef}
            type="button"
            className="lg:hidden inline-flex items-center justify-center rounded-full border border-slate-700/70 bg-black/70 p-2 text-alt"
            onClick={() => setOpen((prev) => !prev)}
          >
            <MenuUnfoldOutlined className="text-lg" />
          </button>

          {/* Logo */}
          <NavLink to="/dashboard" className="text-3xl text-white flex-1">
            <img
              src={logo}
              alt="BitBridge Global"
              className="h-9 md:h-11 w-auto object-contain"
            />
          </NavLink>

          {/* Desktop nav */}
          <div className="md:flex w-full max-w-3xl items-center justify-between hidden text-gray-200">
            <nav className="flex-1 flex justify-center">
              <ul className="flex gap-7 lg:gap-9">
                <li>
                  <NavLink
                    to="/dashboard/home"
                    className={({ isActive }) => (isActive ? active : normal)}
                  >
                    <HomeOutlined className="text-xl" />
                    <span>Home</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/dashboard/wallet"
                    className={({ isActive }) => (isActive ? active : normal)}
                  >
                    <WalletOutlined className="text-xl" />
                    <span>Wallet</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/dashboard/utilities"
                    className={({ isActive }) => (isActive ? active : normal)}
                  >
                    <LuUtilityPole className="text-xl" />
                    <span>Utility</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/dashboard/transactions/orders"
                    className={({ isActive }) => (isActive ? active : normal)}
                  >
                    <SignalCellularAltIcon className="text-2xl" />
                    <span>Transaction</span>
                  </NavLink>
                </li>
              </ul>
            </nav>

            {/* User profile dropdown (unchanged behaviour) */}
            <DropDown />
          </div>

          {/* Right spacer on mobile to balance the flex layout */}
          <div className="flex gap-4 md:hidden" />
        </header>

        {/* CONTENT + MOBILE DRAWER */}
        <div className="flex overflow-hidden mt-0 h-full flex-1 w-full md:px-6">
          <div className="relative">
            <DrawerModal
              open={open}
              onClose={() => {
                setOpen(false)
              }}
            >
              <aside ref={sideNavRef} className="flex flex-col gap-7 text-white">
                <ul className="flex flex-col gap-7">
                  <li onClick={() => setOpen(false)}>
                    <NavLink
                      to="/dashboard/home"
                      className={({ isActive }) => (isActive ? active : normal)}
                    >
                      <HomeOutlined className="text-xl" />
                      <span>Home</span>
                    </NavLink>
                  </li>
                  <li onClick={() => setOpen(false)}>
                    <NavLink
                      to="/dashboard/wallet"
                      className={({ isActive }) => (isActive ? active : normal)}
                    >
                      <WalletOutlined className="text-xl" />
                      <span>Wallet</span>
                    </NavLink>
                  </li>
                  <li onClick={() => setOpen(false)}>
                    <NavLink
                      to="/dashboard/utilities"
                      className={({ isActive }) => (isActive ? active : normal)}
                    >
                      <LuUtilityPole className="text-xl" />
                      <span>Utility</span>
                    </NavLink>
                  </li>
                  <li onClick={() => setOpen(false)}>
                    <NavLink
                      to="/dashboard/transactions/orders"
                      className={({ isActive }) => (isActive ? active : normal)}
                    >
                      <SignalCellularAltIcon className="text-2xl" />
                      <span>Transaction</span>
                    </NavLink>
                  </li>
                  <li>
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
                      <span className={normal}>
                        <LoginOutlined className="text-xl" />
                        <span>Log Out</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </aside>
            </DrawerModal>
          </div>

          {/* Page body */}
          <div className="md:mt-6 mt-3 w-full flex-1 overflow-y-auto pb-6">
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
