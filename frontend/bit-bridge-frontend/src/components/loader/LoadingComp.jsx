import PropTypes from 'prop-types'

const LoadingComp = ({ className = '' }) => {
  return (
    <div className={`h-96 w-full flex justify-center bg-gray-200 items-center ${className}`.trim()}>
      <div className="inline-flex items-center gap-3 text-sm text-slate-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span>Loading...</span>
      </div>
    </div>
  )
}

LoadingComp.propTypes = {
  className: PropTypes.string,
}

export default LoadingComp
