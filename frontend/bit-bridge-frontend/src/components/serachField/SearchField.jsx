import './search.scss'
import PropTypes from 'prop-types'
import { useState } from 'react'

const SearchField = ({ className = '' }) => {
  const [value, setValue] = useState('')

  const handleSearch = () => {
    console.log('search', value)
  }

  return (
    <div className={`${className} search-field flex items-stretch overflow-hidden rounded-md border border-slate-700`.trim()}>
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="input search text"
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
      />
      <button
        type="button"
        onClick={handleSearch}
        className="bg-primary px-4 text-sm font-medium text-white hover:bg-alt"
      >
        Search
      </button>
    </div>
  )
}

SearchField.propTypes = {
  className: PropTypes.string,
}

export default SearchField
