import { NavLink } from 'react-router-dom'
import './nav.scss'
import { Button } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'
import { useEffect, useRef } from 'react'

const Nav = ({ open, setToggle }) => {
  const navRef = useRef()
  const active = 'active text-alt'
  const inActive = 'inactive text-alt'

  // Close when clicking outside the nav (mobile)
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setToggle(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, setToggle])

  return (
    <>
      {/* Backdrop overlay for mobile when menu is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden z-40 transition-opacity"
          onClick={() => setToggle(false)}
        />
      )}

      <div
        ref={navRef}
        className={`navslide md:my-0
          fixed md:static
          h-screen md:h-auto
          top-0
          shadow md:shadow-none
          rounded-none md:rounded-xl
          transition-all duration-200 ease-out
          bg-slate-900/95 md:bg-transparent
          border-r border-slate-800 md:border-none
          ${open ? 'left-0' : '-left-full'}
          text-primary z-50 max-w-xs md:max-w-7xl w-full
        `}
      >
        <Button
          onClick={() => setToggle((prev) => !prev)}
          className="md:hidden mt-6 ml-auto mr-4 flex items-center justify-center bg-slate-800 text-slate-100 border-slate-700"
          shape="circle"
          icon={<CloseOutlined />}
        />

        <ul className="flex px-6 md:px-0 py-10 md:py-4 flex-col md:flex-row gap-6 md:gap-8 text-base md:text-lg font-semibold">
          <li className="font-medium">
            <NavLink className={({ isActive }) => (isActive ? active : inActive)} to="/">
              Home
            </NavLink>
          </li>

          <li>
            <NavLink
              className={({ isActive }) => (isActive ? active : inActive)}
              to="/phone-top-up"
            >
              Phone Top Ups
            </NavLink>
          </li>

          <li>
            <NavLink
              className={({ isActive }) => (isActive ? active : inActive)}
              to="/utility-services"
            >
              Utility &amp; Services
            </NavLink>
          </li>
        </ul>
      </div>
    </>
  )
}

Nav.propTypes = {
  setToggle: PropTypes.func,
  open: PropTypes.bool,
}

export default Nav
