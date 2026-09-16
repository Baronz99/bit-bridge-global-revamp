// src/layouts/DashboardLayout.jsx

import {
  AppstoreOutlined,
  CompassOutlined,
  HomeOutlined,
  LoginOutlined,
  MenuUnfoldOutlined,
  QuestionCircleOutlined,
  TeamOutlined,
  ProfileOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import PropTypes from 'prop-types'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useRef, useState } from 'react'
import { userLogout, userProfile } from '../redux/actions/auth'
import DropDown from '../components/dropDown/DropDown'
import { getWallet } from '../redux/actions/wallet'
import DrawerModal from '../components/drawer/Drawer'
import {
  SET_LOADING,
  setBusinessEntities,
  setBusinessEntitiesLoading,
  setCircleEntities,
  setCircleEntitiesLoading,
  setOwnerMode,
} from '../redux/app'
import LoaderPage from '../components/loader/LoaderPage'
import logoIcon from '../assets/logos/bitbridge-logo-clear.png'
import '../styles/userTheme.css'
import OwnerModeSwitcher from '../components/business/OwnerModeSwitcher'
import { getBusinessEntities } from '../api/business'
import { getCircles } from '../api/circles'
import { toast } from 'react-toastify'
import { SECURITY_LOCK_ACTIVE_EVENT } from '../api/client'
import { isInvestorSandbox } from '../config/sandbox'

const DashboardLayout = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const sideNavRef = useRef(null)
  const menuRef = useRef(null)
  const hasFetchedWallet = useRef(false)
  const { user, loading } = useSelector((state) => state.auth)
  const {
    themeMode,
    businessEntities,
    businessEntitiesLoading,
    circleEntities,
    circleEntitiesLoading,
    ownerMode,
    selectedBusinessEntityId,
    selectedCircleId,
  } = useSelector((state) => state.app || {})
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isBusinessSetupRoute =
    location.pathname === '/dashboard/business/onboarding' || location.pathname === '/dashboard/business/kyb'
  const securityLockActive = Boolean(user?.security_lock?.active || user?.security_lock?.security_locked)

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
    if (hasFetchedWallet.current) return
    hasFetchedWallet.current = true
    dispatch(getWallet())
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadBusinessEntities = async () => {
      if (!user) return

      dispatch(setBusinessEntitiesLoading(true))
      try {
        const response = await getBusinessEntities()
        if (!active) return
        const entities = Array.isArray(response?.data?.data) ? response.data.data : []
        dispatch(setBusinessEntities(entities))
      } catch {
        if (!active) return
        dispatch(setBusinessEntities([]))
      } finally {
        if (active) dispatch(setBusinessEntitiesLoading(false))
      }
    }

    loadBusinessEntities()

    return () => {
      active = false
    }
  }, [dispatch, user])

  useEffect(() => {
    const handleSecurityLockActive = () => {
      dispatch(userProfile())
    }

    window.addEventListener(SECURITY_LOCK_ACTIVE_EVENT, handleSecurityLockActive)
    return () => {
      window.removeEventListener(SECURITY_LOCK_ACTIVE_EVENT, handleSecurityLockActive)
    }
  }, [dispatch])

  useEffect(() => {
    let active = true

    const loadCircles = async () => {
      if (!user) return

      dispatch(setCircleEntitiesLoading(true))
      try {
        const response = await getCircles()
        if (!active) return
        const circles = Array.isArray(response?.data) ? response.data : []
        dispatch(setCircleEntities(circles))
      } catch {
        if (!active) return
        dispatch(setCircleEntities([]))
      } finally {
        if (active) dispatch(setCircleEntitiesLoading(false))
      }
    }

    loadCircles()

    return () => {
      active = false
    }
  }, [dispatch, user])

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
  const kycTierLabel = (user?.kyc_level || 'tier_0').replace('_', ' ').toUpperCase()
  const kycTierTone = (user?.kyc_level || 'tier_0') === 'tier_0' ? 'border-amber-900/60 bg-amber-950/25 text-amber-300' : 'border-emerald-900/60 bg-emerald-950/25 text-emerald-300'

  const navSections = [
    { title: 'Bridge', to: '/dashboard/bridge', icon: AppstoreOutlined },
    { title: 'Tunnel', to: '/dashboard/tunnel', icon: CompassOutlined },
    { title: 'Circles', to: '/dashboard/shared-groups', icon: TeamOutlined },
    { title: 'Activity', to: '/dashboard/activity', icon: ProfileOutlined },
    { title: 'Assistance', to: '/dashboard/assistance-center', icon: QuestionCircleOutlined },
    { title: 'Core', to: '/dashboard/core', icon: SafetyOutlined },
  ]

  const handleOwnerModeChange = ({ mode, businessEntityId, circleId }) => {
    if (mode === 'business' && !businessEntityId) {
      toast.info('Activate or select a business account first.')
      return
    }

    if (mode === 'circle' && !circleId) {
      toast.info('Select a circle workspace first.')
      return
    }

    dispatch(setOwnerMode({ mode, businessEntityId, circleId }))
    setOpen(false)

    if (mode === 'business') {
      navigate('/dashboard/business')
      return
    }

    if (mode === 'circle') {
      navigate(`/dashboard/shared-groups/${circleId}`)
      return
    }

    navigate('/dashboard/home')
  }

  const renderNavItem = ({ to, label, icon: Icon }, extraClass = '') => (
    <NavLink to={to} className={({ isActive }) => `${isActive ? active : normal} ${extraClass}`.trim()}>
      <Icon className="text-xl" />
      <span>{label}</span>
    </NavLink>
  )

  const handleActivateBusiness = () => {
    setOpen(false)
    navigate('/dashboard/business/activate')
  }

  const handleBrowseCircles = () => {
    setOpen(false)
    navigate('/dashboard/shared-groups')
  }

  return (
    <div className="bb-user-theme relative h-screen" data-theme={themeMode || 'dark'}>
      <div className="bb-dashboard-shell max-w-[1500px] m-auto flex flex-col overflow-hidden h-screen">
        {!isBusinessSetupRoute ? (
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

          <div className="hidden w-full max-w-6xl items-center justify-between gap-4 text-gray-200 md:flex">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] ${kycTierTone}`}><SafetyOutlined className="text-sm" /><span>{kycTierLabel}</span></div>
            <nav className="flex-1 flex justify-center">
              <div className="flex items-start rounded-2xl border border-slate-800/70 bg-black/30 px-3 py-3">
                <div className={desktopSectionClass}>
                  <div className={sectionTitleClass}>Home</div>
                  {renderNavItem({ to: '/dashboard/home', label: 'Home', icon: HomeOutlined })}
                </div>
                {navSections.map((section) => (
                  <div key={section.title} className={desktopSectionClass}>
                    <div className={sectionTitleClass}>{section.title}</div>
                    {renderNavItem({ to: section.to, label: section.title, icon: section.icon })}
                  </div>
                ))}
              </div>
            </nav>

            <div className="flex items-center gap-3">
              <OwnerModeSwitcher
                compact
                value={{ mode: ownerMode, businessEntityId: selectedBusinessEntityId, circleId: selectedCircleId }}
                businesses={businessEntities}
                circles={circleEntities}
                loading={businessEntitiesLoading}
                circlesLoading={circleEntitiesLoading}
                onChange={handleOwnerModeChange}
                onActivateBusiness={handleActivateBusiness}
                onBrowseCircles={handleBrowseCircles}
              />
              <DropDown />
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden"><div className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${kycTierTone}`}><SafetyOutlined className="text-[11px]" /><span>{kycTierLabel}</span></div></div>
          {isInvestorSandbox ? <div className="hidden sm:block rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-medium tracking-[0.08em] text-cyan-200">Investor Sandbox · Simulated funds</div> : null}
        </header>
        ) : null}

        <div className={`bb-dashboard-frame flex overflow-hidden mt-0 h-full flex-1 w-full ${isBusinessSetupRoute ? '' : 'md:px-6'}`}>
          {!isBusinessSetupRoute ? <div className="relative">
            <DrawerModal
              open={open}
              onClose={() => {
                setOpen(false)
              }}
            >
              <aside ref={sideNavRef} className="flex flex-col gap-7 text-white">
                <div className="flex flex-col gap-7">
                  <OwnerModeSwitcher
                    value={{ mode: ownerMode, businessEntityId: selectedBusinessEntityId, circleId: selectedCircleId }}
                    businesses={businessEntities}
                    circles={circleEntities}
                    loading={businessEntitiesLoading}
                    circlesLoading={circleEntitiesLoading}
                    onChange={handleOwnerModeChange}
                    onActivateBusiness={handleActivateBusiness}
                    onBrowseCircles={handleBrowseCircles}
                  />

                  <div onClick={() => setOpen(false)}>
                    {renderNavItem({ to: '/dashboard/home', label: 'Home', icon: HomeOutlined }, 'items-start')}
                  </div>

                  {navSections.map((section) => (
                    <div key={section.title} className="flex flex-col gap-4">
                      <div className={mobileSectionTitleClass}>{section.title}</div>
                      <div onClick={() => setOpen(false)}>
                        {renderNavItem({ to: section.to, label: section.title, icon: section.icon }, 'items-start')}
                      </div>
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
          </div> : null}

          <div
            className={`bb-dashboard-body dashboard-body w-full flex-1 overflow-y-auto pb-6 ${isBusinessSetupRoute ? '' : 'md:mt-6 mt-3'}`}
            style={{
              backgroundColor: themeMode === 'light' ? '#f7f4ef' : '#0b1220',
            }}
          >
            {securityLockActive ? (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-slate-100">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Some outgoing actions are temporarily unavailable.</p>
                    <p className="mt-1 text-sm text-slate-300/85">Review your security settings to manage protected account access while balances, activity, and deposits remain available.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/profile?section=security')}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Review security
                  </button>
                </div>
              </div>
            ) : null}
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




