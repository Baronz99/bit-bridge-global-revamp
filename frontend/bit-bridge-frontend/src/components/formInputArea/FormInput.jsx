import { Form, Input } from 'antd'
import './styles.scss'
import PropTypes from 'prop-types'
const { TextArea } = Input
const FormInputArea = ({
  placeholder,
  onChange,
  name,
  className,
  value,

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
        <TextArea rows={4} onChange={onChange} cols={6} placeholder={placeholder} />
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
  value: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
}
export default FormInputArea
