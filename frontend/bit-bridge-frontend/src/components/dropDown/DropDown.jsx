import {
  GiftOutlined,
  LogoutOutlined,
  SettingOutlined,
  SwitcherOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Dropdown, message, Space } from 'antd'
import { useDispatch } from 'react-redux'
import { userLogout } from '../../redux/actions/auth'
import { useNavigate } from 'react-router-dom'
import './style.scss'

const DropDown = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // const handleButtonClick = (e) => {
  //     message.info('Click on left button.');
  //   };
  const handleMenuClick = (e) => {
    switch (e.key) {
      case '1':
        // Navigate to My Account
        message.info('Navigating to My Account...')
        navigate('/') // Use a routing library like react-router-dom
        break

      case '2':
        navigate('/dashboard/profile-account')
        break

      case '3':
        // Log out
        message.info('Logging out...')
        dispatch(userLogout())

        // Example: Perform logout action here
        break

      default:
        message.info('Unknown action')
    }
  }

  const items = [
    {
      label: 'Switch',
      key: '1',
      icon: <SwitcherOutlined />,
    },
    {
      label: 'Profile',
      key: '2',
      icon: <UserOutlined />,
      // danger: true
      // disabled: true,
    },

    {
      label: 'Log out',
      key: '3',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ]

  const menuProps = {
    items,
    onClick: handleMenuClick,
  }
  return (
    <Space wrap>
      <Dropdown.Button menu={menuProps} icon={<UserOutlined />} className="white-bg">
        Account
      </Dropdown.Button>
    </Space>
  )
}
export default DropDown
