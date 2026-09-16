import { AntDesignOutlined } from '@ant-design/icons'
import PropTypes from 'prop-types'

const ButtonCall = ({ children, handleClick }) => {
  return (
    <button
      type="button"
      onClick={handleClick}
      className="my-10 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#6253e1,#04befe)] px-5 py-3 text-white shadow-[0_12px_30px_rgba(4,190,254,0.25)] transition hover:opacity-90"
    >
      <AntDesignOutlined />
      <span>{children ?? 'Register Now'}</span>
    </button>
  )
}

ButtonCall.propTypes = {
  children: PropTypes.node,
  handleClick: PropTypes.func,
}

export default ButtonCall
