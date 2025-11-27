import PropTypes from 'prop-types'
import { splitString } from '../../utils'

const CableCard = ({ id, description, name, provider, image, onClick }) => {
  const imgaeString = splitString(provider)

  return (
    <div
      onClick={onClick}
      key={id}
      className="cursor-pointer border border-alt p-5 rounded-lg flex flex-col sm:flex-row gap-4"
    >
      <img src={image} className="w-16 h-16" alt="name" />
      <div>
        <p>{name}</p>
        <p>{description}</p>
      </div>
    </div>
  )
}

CableCard.propTypes = {
  id: PropTypes.string,
  description: PropTypes.string,
  name: PropTypes.string,
  image: PropTypes.string,
  onClick: PropTypes.func,
}

export default CableCard
