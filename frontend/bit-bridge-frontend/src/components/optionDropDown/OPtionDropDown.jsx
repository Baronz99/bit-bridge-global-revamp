import { useEffect, useRef, useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'

const OptionDropDown = ({ id, handleDel }) => {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center justify-center rounded-full p-1 text-slate-300 hover:bg-slate-800"
        aria-label="More options"
      >
        <MdMoreHoriz />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 min-w-32 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-lg">
          <NavLink
            to={`/admin/products/${id}`}
            className="block px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            View
          </NavLink>
          <button
            type="button"
            onClick={() => {
              handleDel?.()
              setOpen(false)
            }}
            className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-slate-800"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

OptionDropDown.propTypes = {
  handleDel: PropTypes.func,
  id: PropTypes.string,
}

export default OptionDropDown
