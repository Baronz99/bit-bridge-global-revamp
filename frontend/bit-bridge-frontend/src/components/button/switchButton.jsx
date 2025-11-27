import React, { useState } from 'react'
import { Switch } from 'antd'
import PropTypes from 'prop-types'
// const onChange = checked => {
//   console.log(`switch to ${checked}`);
// };
const SwitchButton = ({ onChange }) => {
  const [checkInput, setCheckForminput] = useState(false)
  //   console.log(checkInput)
  return <Switch className="bg-red-900 switch-button" onChange={onChange} />
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

SwitchButton.propType = {
  onChange: PropTypes.func,
}

export default SwitchButton
