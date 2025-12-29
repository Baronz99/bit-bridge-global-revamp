import './style.scss'
import Spinner from '../spiner/Spinner'
import PropTypes from 'prop-types'

const Loader = ({ isLoaderOpen }) => {
  if (!isLoaderOpen) return null

  return (
    <div className="loader open">
      <Spinner />
    </div>
  )
}
Loader.propTypes = {
  isLoaderOpen: PropTypes.bool,
}
export default Loader
