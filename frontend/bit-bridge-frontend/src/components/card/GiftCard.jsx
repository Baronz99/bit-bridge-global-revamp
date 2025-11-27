import { useNavigate } from 'react-router-dom'
import NavButton from '../button/NavButton'
import PropTypes from 'prop-types'

const GiftCard = ({ image, onClick, id, provider, title }) => {
  const giftcardImage = provider.split(' ')[0].toLowerCase() || provider.split('-')[0].toLowerCase()
  return (
    <div className="border border-gray-100/20 rounded p-4">
      <img
        src={`/images/providers/${giftcardImage}.webp`}
        alt="gift card one"
        className="borde rounded-lg"
      />

      <div className="text-center">
        <h5 className="text-lg font-semibold text-white my-5">{title}</h5>
        <NavButton onClick={onClick} className="text-gray-200">
          {' '}
          Buy gift card
        </NavButton>
      </div>
    </div>
  )
}

GiftCard.propTypes = {
  image: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string,
  provider: PropTypes.string,
  onClick: PropTypes.func,
}

export default GiftCard
