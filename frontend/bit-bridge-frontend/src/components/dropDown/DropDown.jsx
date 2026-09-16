import { useEffect, useRef, useState } from 'react'
import { LogoutOutlined, SwitcherOutlined, UserOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'
import { useDispatch } from 'react-redux'
import { userLogout } from '../../redux/actions/auth'
import { useNavigate } from 'react-router-dom'
import './style.scss'

const menuItems = [
  { label: 'Switch', key: '1', icon: <SwitcherOutlined /> },
  { label: 'Profile', key: '2', icon: <UserOutlined /> },
  { label: 'Log out', key: '3', icon: <LogoutOutlined />, danger: true },
]

const DropDown = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleMenuClick = (key) => {
    setOpen(false)

    switch (key) {
      case '1':
        toast.info('Navigating to My Account...')
        navigate('/')
        break
      case '2':
        navigate('/dashboard/profile-account')
        break
      case '3':
        toast.info('Logging out...')
        dispatch(userLogout())
        break
      default:
        toast.info('Unknown action')
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="white-bg inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-500"
      >
        <UserOutlined />
        <span>Account</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950 shadow-[0_16px_40px_rgba(2,6,23,0.5)]">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleMenuClick(item.key)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-900 ${item.danger ? 'text-rose-300' : 'text-slate-100'}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default DropDown
