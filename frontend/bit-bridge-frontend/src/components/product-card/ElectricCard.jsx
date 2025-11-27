import PropTypes from 'prop-types'

const ElectricCard = ({ id, description, name, image, onClick }) => {
  return (
    <div
      onClick={onClick}
      key={id}
      className="cursor-pointer border border-alt md:p-5 p-2 hover:bg-gray-100/10 transition-all ease-linear duration-150 hover:shadow-md shadow-alt rounded-lg flex flex-col sm:flex-row gap-4"
    >
      <img src={image} className="w-16 h-16 m-auto rounded" alt="name" />
      <div>
        <p className="text-center md:text-left">{name}</p>
        <p className="text-center md:text-left">{description}</p>
      </div>
    </div>
  )
}

ElectricCard.propTypes = {
  id: PropTypes.string,
  description: PropTypes.string,
  name: PropTypes.string,
  image: PropTypes.string,
  onClick: PropTypes.func,
}

export default ElectricCard
