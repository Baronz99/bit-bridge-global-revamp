import { LoadingOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'

const ClassicBtn = ({
  htmlType = 'button',
  children,
  onclick,
  type = '',
  className = '',
  disabled = false,
  isLoading = false,
}) => (
  <button
    disabled={disabled || isLoading}
    type={htmlType}
    onClick={onclick}
    className={`${disabled || isLoading ? 'cursor-not-allowed opacity-70' : ''} ${type} ${className} font-semibold border-3 items-center my-5 py-0 px-5 h-10 border-theme bg-light hover:bg-theme-dark hover:text-light classic-btn inline-flex justify-center gap-2`.trim()}
  >
    {isLoading ? <LoadingOutlined spin /> : null}
    <span>{children}</span>
  </button>
)

ClassicBtn.propTypes = {
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  onclick: PropTypes.func,
  type: PropTypes.string,
  children: PropTypes.node,
  htmlType: PropTypes.oneOf(['button', 'submit', 'reset']),
}

export default ClassicBtn
