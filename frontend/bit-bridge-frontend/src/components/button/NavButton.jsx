import './button-style.scss'
import PropTypes from 'prop-types'

const NavButton = ({ children, onClick, className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`app-button ${className} button font-medium md:h-10 navbtn bg-alt border-none px-4 rounded-full`.trim()}
    >
      {children}
    </button>
  )
}

NavButton.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  className: PropTypes.string,
}

export default NavButton
