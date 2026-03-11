import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { CloseOutlined } from '@ant-design/icons'
import './style.scss'

const AppModal = ({
  children,
  isModalOpen,
  handleCancel,
  title,
  className = '',
}) => {
  useEffect(() => {
    if (!isModalOpen) return undefined

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        handleCancel?.()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [handleCancel, isModalOpen])

  if (!isModalOpen) return null

  return (
    <div className="app-modal-backdrop" onClick={handleCancel} role="presentation">
      <div
        className={`app-modal ${className}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <div className="app-modal__header">
          {title ? (
            <h2 id="app-modal-title" className="app-modal__title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="app-modal__close"
            onClick={handleCancel}
            aria-label="Close modal"
          >
            <CloseOutlined />
          </button>
        </div>
        <div className="app-modal__body">{children}</div>
      </div>
    </div>
  )
}

AppModal.propTypes = {
  children: PropTypes.node,
  isModalOpen: PropTypes.bool,
  handleCancel: PropTypes.func,
  title: PropTypes.node,
  className: PropTypes.string,
}

export default AppModal
