import { Form } from 'antd'
import './styles.scss'
import PropTypes from 'prop-types'

const FormInput = ({
  placeholder,
  onChange,
  name,
  className = '',
  value,
  type = 'text',
  disabled,
  billerType,
  required = false,
  label,
}) => {
  const sharedProps = {
    disabled,
    name,
    value,
    onChange,
    placeholder,
    className: 'app-form-control',
  }

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
          ...(billerType === 'phone_no'
            ? [
                {
                  pattern: /^\d{11}$/,
                  message: 'Enter your 11 digits phone number',
                },
              ]
            : []),
        ]}
        label={label}
        type={type}
      >
        {type === 'password' ? (
          <input {...sharedProps} type="password" autoComplete="current-password" />
        ) : type === 'hidden' ? (
          <input {...sharedProps} type="hidden" className="hidden" />
        ) : type === 'number' ? (
          <input {...sharedProps} type="number" inputMode="decimal" />
        ) : (
          <input {...sharedProps} type="text" />
        )}
      </Form.Item>
    </>
  )
}

FormInput.propTypes = {
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string,
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  label: PropTypes.string,
  billerType: PropTypes.string,
}
export default FormInput
