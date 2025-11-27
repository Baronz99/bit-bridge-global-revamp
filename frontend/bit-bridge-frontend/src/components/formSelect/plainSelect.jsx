import { Select } from 'antd'
import PropTypes from 'prop-types'
import './style.scss'
const PlainSelect = ({ options, placeholder = 'Search to Select', className, onChange }) => (
  <Select
    showSearch
    onChange={onChange}
    style={{
      height: 40,
    }}
    placeholder={placeholder}
    optionFilterProp="label"
    filterSort={(optionA, optionB) =>
      (optionA?.label ?? '').toLowerCase().localeCompare((optionB?.label ?? '').toLowerCase())
    }
    options={options}
    className={className}
  />
)

PlainSelect.propTypes = {
  options: PropTypes.array,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
}
export default PlainSelect
