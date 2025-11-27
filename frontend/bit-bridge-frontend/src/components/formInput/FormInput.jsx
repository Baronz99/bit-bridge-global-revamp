import { Form, Input, InputNumber } from 'antd'
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
  return (
    <>
      <Form.Item
        className={`formInput ${className}`}
        name={name}
        // normalize={(value) => typeof value === "string" ? value?.trim() : value}

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

          // ...(billerType === "phone_no" ? [
          //     {
          //       validator: (_,value) => {
          //         if(!value) return Promise.resolve()
          //           const valueStr = value.toString()
          //         if(valueStr.length !==11) {
          //           return Promise.reject("please enter your 11-digit number")
          //       }
          //       return Promise.resolve();
          //     }
          //   }
          //   ] : []
          // )
        ]}
        label={label}
        type={type}
      >
        {type == 'text' ? (
          <Input
            disabled={disabled}
            name={name}
            style={{ width: '100%' }}
            value={value}
            onChange={onChange}
            className={`w-full bg-red-800 p-2.5 `}
            placeholder={placeholder}
          />
        ) : type === 'password' ? (
          <Input.Password placeholder={placeholder} className="" />
        ) : type === 'hidden' ? (
          <Input
            disabled={disabled}
            type="hidden"
            name={name}
            style={{ width: '100%' }}
            value={value}
            onChange={onChange}
            className={`w-full bg-red-800 p-2.5 hidden `}
            placeholder={placeholder}
          />
        ) : (
          <InputNumber
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            className={` w-full font-medium`}
          />
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
  value: PropTypes.string,
  type: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.string,
  label: PropTypes.string,
  billerType: PropTypes.string,
}
export default FormInput
