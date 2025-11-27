import { Input } from 'antd'
import './search.scss'
import PropTypes from 'prop-types'
const { Search } = Input
// const suffix = (
//   <AudioOutlined
//     style={{
//       fontSize: 16,
//       color: '#1677ff',
//     }}
//   />
// );
const onSearch = (value, _e, info) => console.log(info?.source, value)
const SearchField = ({ className }) => (
  <Search
    placeholder="input search text"
    className={`${className} search-field`}
    onSearch={onSearch}
    enterButton
  />
)

SearchField.propTypes = {
  className: PropTypes.string,
}
export default SearchField
