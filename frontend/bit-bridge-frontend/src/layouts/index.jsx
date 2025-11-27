import PropTypes from 'prop-types'
import Footer from '../components/footer/Footer'

const MainLayout = ({ children }) => {
  return (
    <div className="mt-36">
      {children}
      <Footer />
    </div>
  )
}
MainLayout.propTypes = {
  children: PropTypes.node,
}

export default MainLayout
