import { ArrowRightOutlined, LoadingOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'
import './button-style.scss'

const AppButton = ({
  className = '',
  children,
  disabled = false,
  type = 'button',
  icon,
  btnType = '',
  size = 'large',
  onClick,
  loading = false,
}) => {
  const sizeClass = size === 'small' ? 'app-button--small' : size === 'middle' ? 'app-button--middle' : ''

  return (
    <button
      disabled={disabled || loading}
      className={`app-button ${btnType} ${sizeClass} ${className} border px-6 text-gray-200 border-non button ${disabled || loading ? 'opacity-50 cursor-not-allowed hover:bg-blue-500 !bg-blue-500 border-gray-400 !text-gray-200' : 'border-alt'}`.trim()}
      onClick={onClick}
      type={type}
    >
      {loading ? <LoadingOutlined spin /> : icon ? <ArrowRightOutlined /> : null}
      <span>{loading ? 'Processing...' : children}</span>
    </button>
  )
}

AppButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  icon: PropTypes.bool,
  btnType: PropTypes.string,
  size: PropTypes.oneOf(['small', 'middle', 'large']),
  onClick: PropTypes.func,
  loading: PropTypes.bool,
}

export default AppButton
