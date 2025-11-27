// src/components/ShadowValue.jsx
import { useSelector } from 'react-redux'
import PropTypes from 'prop-types'

/**
 * Hide/Privacy wrapper:
 * - When hide mode is ON → shows placeholder (like ••••••)
 * - When OFF → shows the real value (children)
 */
const ShadowValue = ({ children, placeholder = '••••••', className = '' }) => {
  const { shadowMode } = useSelector((state) => state.app || {})

  if (shadowMode) {
    return <span className={className}>{placeholder}</span>
  }

  return <span className={className}>{children}</span>
}

ShadowValue.propTypes = {
  children: PropTypes.node,
  placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  className: PropTypes.string,
}

export default ShadowValue
