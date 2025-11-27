import { Button } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'
import './button-style.scss'
const AppButton = ({
  className,
  children,
  disabled = false,
  type,
  icon,
  btnType,
  size = 'large',
  onClick,
  loading = false,
}) => {
  console.log(disabled, 'disabled')
  return (
    <Button
      disabled={disabled}
      //  type="primary"
      className={` ${btnType} ${className} border px-6  text-gray-200 hover:bg-alt border-non button ${disabled || loading ? 'opacity-50 cursor-not-allowed hover:bg-blue-500 !bg-blue-500 border-gray-400 !text-gray-200' : 'border-alt'}`}
      shape="default"
      icon={icon ? <ArrowRightOutlined /> : null}
      onClick={onClick}
      size={size}
      htmlType={type}
    >
      {loading ? 'Processing...' : children}
    </Button>
  )
}

AppButton.propTypes = {
  children: PropTypes.node.isRequired, // `children` must be provided
  size: PropTypes.oneOf(['small', 'middle', 'large']), // Allowable values
  onClick: PropTypes.func, // Optional callback function
}

// ClickButton.defaultProps = {
//   size: "large",
//   onClick: () => {}, // Default is a no-op
// };
export default AppButton
