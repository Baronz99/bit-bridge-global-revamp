import { Flex, Spin } from 'antd'

const LoaderPage = () => {
  return (
    <div className="bg-gray-900 h-screen flex w-full justify-center items-center">
      <Flex gap="middle" vertical>
        <Spin tip="Loading..."></Spin>
      </Flex>{' '}
    </div>
  )
}

export default LoaderPage
