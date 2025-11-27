import PropTypes from 'prop-types'

const DetailsCard = ({ label, value }) => {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-gray-600">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  )
}

DetailsCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string,
}

export default DetailsCard
