import { Dropdown, Space } from 'antd'
import { MdMoreHoriz } from 'react-icons/md'
import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'
const OptionDropDown = ({ id, handleDel }) => {
  const items = [
    {
      label: (
        <NavLink to={`/admin/products/${id}`} rel="noopener noreferrer">
          View
        </NavLink>
      ),
      key: '0',
    },
    {
      label: (
        <a onClick={handleDel} rel="noopener noreferrer">
          Delete
        </a>
      ),
      key: '1',
    },
    // {
    //   type: 'divider',
    // },
  ]

  return (
    <Dropdown
      menu={{
        items,
      }}
      trigger={['click']}
      placement="topRight"
    >
      <a onClick={(e) => e.preventDefault()}>
        <Space>
          <MdMoreHoriz />
        </Space>
      </a>
    </Dropdown>
  )
}
OptionDropDown.propTypes = {
  handleDel: PropTypes.func,
  id: PropTypes.string,
}
export default OptionDropDown
