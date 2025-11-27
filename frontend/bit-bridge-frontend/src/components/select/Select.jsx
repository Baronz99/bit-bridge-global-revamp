import { Select, Space } from 'antd'
import PropTypes from 'prop-types'

const SelectInput = ({ options, placeholder, className, onChange, defaultValue }) => {
  return (
    <Space wrap>
      <Select
        placeholder={placeholder}
        defaultValue={defaultValue}
        // variant="borderless"
        style={{ flex: 1 }}
        onChange={onChange}
        options={options}
        // className={`${className} h-12 order-gray-600 rounded brder w-full`}
      />
    </Space>
  )
}

SelectInput.propTypes = {
  options: PropTypes.array,
  onChange: PropTypes.func,
  className: PropTypes.func,
  defaultValue: PropTypes.string,
}
export default SelectInput

// import React from 'react';
// import { Select, Space } from 'antd';
// import PropTypes from 'prop-types';
// const handleChange = (value) => {
// };
// const SelectInput = ({options,placeholder, className, onChange, defaultValue}) => (
//   <Space wrap>
//     <Select
//      placeholder={placeholder}
//       defaultValue={defaultValue}
//       variant="borderless"
//       options={options}
//       className={`${className}  order-gray-600 rounded border w-full`}
//       onChange={handleChange}

//     />

//   </Space>

// );

// SelectInput.propTypes= {
//     options: PropTypes.array,
//     onChange: PropTypes.func ,
//     className: PropTypes.func ,
//     defaultValue: PropTypes.string
// }
// export default SelectInput;
