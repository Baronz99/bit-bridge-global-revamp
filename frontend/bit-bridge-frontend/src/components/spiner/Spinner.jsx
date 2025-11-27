import { Alert, Flex, Spin } from 'antd'
const contentStyle = {
  padding: 50,
  background: 'rgba(0, 0, 0, 0.05)',
  borderRadius: 4,
}
const content = <div style={contentStyle} />
const Spinner = () => (
  <Flex gap="middle" vertical>
    <Spin tip="Loading...">
      {/* <Alert
        message="Alert message title"
        description="Further details about the context of this alert."
        type="info"
      /> */}
    </Spin>
  </Flex>
)
export default Spinner
