import { Button, Drawer } from 'antd'
import PropTypes from 'prop-types'
import './drawer.scss'
import { CloseOutlined } from '@ant-design/icons'
const DrawerModal = ({ children, open, onClose }) => {
  //   const showDrawer = () => {
  //     setOpen(true);
  //   };
  //   const onClose = () => {
  //     setOpen(false);
  //   };
  return (
    <>
      <Drawer
        title={
          <div className="flex justify-end items-center w-full">
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </div>
        }
        closable={false}
        width={150}
        placement={'left'}
        onClose={onClose}
        open={open}
      >
        {children}
      </Drawer>
    </>
  )
}

DrawerModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  children: PropTypes.children,
}

export default DrawerModal
