import { Button } from 'antd'
import './button-style.scss'
import PropTypes from 'prop-types'

const NavButton = ({ children, onClick, className }) => {
  return (
    <Button
      onClick={onClick}
      className={`${className} button font-medium md:h-10  navbtn bg-alt border-none px-0`}
      shape="round"
    >
      {children}
    </Button>
  )
}

NavButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  className: PropTypes.string,
}
export default NavButton
