import PropTypes from 'prop-types'

const SwitchButton = ({ onChange, checked, disabled, className = '' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`switch-button relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-alt' : 'bg-red-900'} ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  )
}

SwitchButton.propTypes = {
  onChange: PropTypes.func,
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
}

export default SwitchButton
