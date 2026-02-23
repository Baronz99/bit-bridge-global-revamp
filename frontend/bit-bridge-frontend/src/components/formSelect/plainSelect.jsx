import { Select } from 'antd'
import PropTypes from 'prop-types'
import './style.scss'
const PlainSelect = ({ options, placeholder = 'Search to Select', className, onChange, value }) => (
  <Select
    showSearch
    value={value}
    onChange={onChange}
    popupClassName="plain-select-dropdown"
    style={{
      height: 40,
    }}
    placeholder={placeholder}
    optionFilterProp="label"
    filterSort={(optionA, optionB) =>
      (optionA?.label ?? '').toLowerCase().localeCompare((optionB?.label ?? '').toLowerCase())
    }
    options={options}
    className={`plain-select ${className || ''}`}
  />
)

PlainSelect.propTypes = {
  options: PropTypes.array,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}
export default PlainSelect
