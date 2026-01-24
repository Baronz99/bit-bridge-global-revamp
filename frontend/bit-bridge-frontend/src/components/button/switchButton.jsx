import { Switch } from 'antd'
import PropTypes from 'prop-types'
// const onChange = checked => {
//   console.log(`switch to ${checked}`);
// };
const SwitchButton = ({ onChange, checked, disabled, className }) => {
  return (
    <Switch
      className={`bg-red-900 switch-button ${className || ''}`}
      onChange={onChange}
      checked={checked}
      disabled={disabled}
    />
  )
  //   return (
  //     <input
  //       className="h-10 w-10"
  //       type="checkbox"
  //       //   value={checkInput}
  //       name="checkInput"
  //       onChange={(e) => {
  //         const { checked, value } = e.target

  //         console.log(value, checked)
  //         setCheckForminput((prev) => !prev)
  //       }}
  //     />
  //   )
}

SwitchButton.propTypes = {
  onChange: PropTypes.func,
  checked: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
}

export default SwitchButton
