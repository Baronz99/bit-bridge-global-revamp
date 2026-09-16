import PropTypes from 'prop-types'
import { CloseOutlined } from '@ant-design/icons'
import './drawer.scss'

const DrawerModal = ({ children, open, onClose }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        className="absolute inset-0 bg-slate-950/70"
        onClick={onClose}
      />
      <div className="relative h-full w-[260px] max-w-[85vw] border-r border-slate-800 bg-slate-950 px-4 py-4 shadow-[0_0_40px_rgba(15,23,42,0.7)]">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 bg-black/60 text-slate-100"
          >
            <CloseOutlined />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

DrawerModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  children: PropTypes.node,
}

export default DrawerModal
