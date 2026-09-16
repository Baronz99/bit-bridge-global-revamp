import { ShoppingCartOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'

const CartButton = ({ children, onClick }) => {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex min-h-12 w-full max-w-xl items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-white hover:bg-primary/80"
      >
        <ShoppingCartOutlined />
        <span>{children}</span>
      </button>
    </div>
  )
}

CartButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
}

export default CartButton
