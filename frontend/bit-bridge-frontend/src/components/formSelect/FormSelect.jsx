import { Form, Select } from 'antd'
import PropTypes from 'prop-types'
import './style.scss'
const FormSelect = ({
  onChange,
  name,
  className,
  options,
  required = false,
  placeholder,
  mode,
  disabled,
  label,
}) => {
  return (
    <>
      <Form.Item
        className={`formInput ${className}`}
        name={name}
        rules={[
          {
            required: required,
            message: `Please input ${label}!`,
          },
        ]}
        label={label}
      >
        <Select
          placeholder={placeholder}
          className="h-12"
          name={name}
          onChange={onChange}
          loading={true}
          disabled={disabled}
          mode={mode}
          // defaultActiveFirstOption={true}

          options={options}
        ></Select>
      </Form.Item>
    </>
  )
}

FormSelect.propTypes = {
  FormInputArea: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  label: PropTypes.string,
  options: PropTypes.array,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  mode: PropTypes.string,
  disabled: PropTypes.bool,
}
export default FormSelect
