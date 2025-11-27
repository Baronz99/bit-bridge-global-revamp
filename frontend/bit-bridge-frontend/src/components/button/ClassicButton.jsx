import { SyncOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import PropTypes from 'prop-types'

const ClassicBtn = ({
  htmlType,
  children,
  onclick,
  type,
  className,
  disabled = false,
  isLoading,
}) => (
  <Button
    disabled={disabled}
    htmlType={htmlType}
    loading={isLoading && { icon: <SyncOutlined spin /> }}
    onClick={onclick}
    className={`${disabled && 'cursor-not-allowed'} ${type} ${className}  font-semibold border-3 items-center block my-5 py-0 px-5 h-10 border-theme bg-light hover:bg-theme-dark hover:text-light classic-btn`}
  >
    {children}
  </Button>
)
ClassicBtn.propTypes = {
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  onclick: PropTypes.func,
  type: PropTypes.string,
  children: PropTypes.node,
  htmlType: PropTypes.string,
}

export default ClassicBtn
