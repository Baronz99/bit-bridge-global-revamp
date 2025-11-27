import { ShoppingCartOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import PropTypes from 'prop-types'
import { useState } from 'react'

const CartButton = ({ text, children, onClick }) => {
  const [size] = useState('large')
  return (
    <div>
      <Button
        onClick={onClick}
        className="py-5 max-w-xl w-full text-white bg-primary hover:bg-primary/80"
        shape="default"
        icon={<ShoppingCartOutlined />}
        size={size}
      >
        {children}
      </Button>
    </div>
  )
}

CartButton.propTypes = {
  text: PropTypes.string,
  children: PropTypes.node,
}

export default CartButton
