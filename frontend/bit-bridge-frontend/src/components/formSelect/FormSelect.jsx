import { Form } from 'antd'
import PropTypes from 'prop-types'
import './style.scss'

const NativeSelectField = ({
  value,
  onChange,
  options,
  placeholder,
  mode,
  disabled,
  loading,
  name,
}) => {
  const isMultiple = mode === 'multiple'

  const normalizedValue = isMultiple
    ? Array.isArray(value)
      ? value.map(String)
      : []
    : value ?? ''

  const handleChange = (event) => {
    if (isMultiple) {
      const nextValue = Array.from(event.target.selectedOptions, (option) => option.value)
      onChange?.(nextValue)
      return
    }

    onChange?.(event.target.value)
  }

  return (
    <div className="app-select-shell">
      <select
        name={name}
        value={normalizedValue}
        onChange={handleChange}
        disabled={disabled || loading}
        multiple={isMultiple}
        className={`app-form-select ${isMultiple ? 'app-form-select--multiple' : ''}`}
        size={isMultiple ? Math.min(Math.max(options?.length || 4, 4), 6) : undefined}
      >
        {!isMultiple && (
          <option value="" disabled>
            {loading ? 'Loading...' : placeholder || 'Select an option'}
          </option>
        )}
        {(options || []).map((option) => (
          <option key={String(option.value)} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {isMultiple && <p className="app-select-hint">Hold Ctrl/Cmd to choose multiple values.</p>}
    </div>
  )
}

NativeSelectField.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.array]),
  onChange: PropTypes.func,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  mode: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  name: PropTypes.string,
}

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
  loading = false,
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
        <NativeSelectField
          name={name}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          mode={mode}
          disabled={disabled}
          loading={loading}
        />
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
  loading: PropTypes.bool,
}
export default FormSelect
