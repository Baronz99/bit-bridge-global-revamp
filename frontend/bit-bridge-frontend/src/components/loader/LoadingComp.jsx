import { Spin } from 'antd'
import PropTypes from 'prop-types'

const LoadingComp = ({ className }) => {
  return (
    <div className={` h-96 w-full flex justify-center bg-gray-200 items-center ${className}`}>
      <Spin tip="Loading..."></Spin>
    </div>
  )
}

LoadingComp.propTypes = {
  className: PropTypes.string,
}

export default LoadingComp
