import { useNavigate } from 'react-router-dom'
import NavButton from '../button/NavButton'
import PropTypes from 'prop-types'

const UtilityCard = ({ image, onClick, btnText, provider, title }) => {
  const giftcardImage = provider.split(' ')[0].toLowerCase() || provider.split('-')[0].toLowerCase()

  return (
    <div className="border max-w-lg border-gray-100/20 rounded p-1 md:p-4">
      <img
        onClick={onClick}
        src={`/images/providers/${giftcardImage}.png`}
        alt="gift card one"
        className="borde md:h-60 h-32 w-full bg-gray-200/20 hover:bg-transparent rounded-lg cursor-pointer"
      />

      <div className="text-center">
        <h5 className="text-lg font-semibold text-white my-2.5 md:my-5">{title}</h5>
        <NavButton onClick={onClick} className="text-gray-200">
          {' '}
          {btnText}
        </NavButton>
      </div>
    </div>
  )
}

UtilityCard.propTypes = {
  image: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string,
  provider: PropTypes.string,
  onClick: PropTypes.func,
}

export default UtilityCard
