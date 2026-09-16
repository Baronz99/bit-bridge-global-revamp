import { Form } from 'antd'
import './styles.scss'
import PropTypes from 'prop-types'

const FormInputArea = ({
  placeholder,
  onChange,
  name,
  className,
  required = false,
  label,
}) => {
  return (
    <>
      <Form.Item
        className={`${className} formInput`}
        name={name}
        rules={[
          {
            required: required,
            message: `Please input ${label}!`,
          },
        ]}
        label={label}
      >
        <textarea
          rows={4}
          onChange={onChange}
          placeholder={placeholder}
          className="app-form-control app-form-textarea"
        />
      </Form.Item>
    </>
  )
}

FormInputArea.propTypes = {
  FormInputArea: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
}
export default FormInputArea
