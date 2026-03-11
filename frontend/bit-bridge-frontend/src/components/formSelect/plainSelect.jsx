import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import './style.scss'

const normalizeText = (value) => String(value ?? '').toLowerCase().trim()

const PlainSelect = ({ options = [], placeholder = 'Search to Select', className, onChange, value }) => {
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value ?? '')) || null,
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const term = normalizeText(query)
    const sorted = [...options].sort((a, b) =>
      String(a?.label ?? '').localeCompare(String(b?.label ?? ''))
    )

    if (!term) return sorted

    return sorted.filter((option) => {
      const label = normalizeText(option?.label)
      const optionValue = normalizeText(option?.value)
      return label.includes(term) || optionValue.includes(term)
    })
  }, [options, query])

  useEffect(() => {
    if (!open) return undefined

    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <div ref={containerRef} className={`plain-select-shell ${className || ''}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="plain-select-trigger"
      >
        <span className={selectedOption ? 'plain-select-trigger__value' : 'plain-select-trigger__placeholder'}>
          {selectedOption?.label || placeholder}
        </span>
        <span className={`plain-select-trigger__chevron ${open ? 'plain-select-trigger__chevron--open' : ''}`}>
          v
        </span>
      </button>

      {open && (
        <div className="plain-select-dropdown-native">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="plain-select-search"
            autoFocus
          />

          <div className="plain-select-options">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const active = String(option.value) === String(value ?? '')
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => {
                      onChange?.(option.value)
                      setOpen(false)
                    }}
                    className={`plain-select-option ${active ? 'plain-select-option--active' : ''}`}
                  >
                    {option.label}
                  </button>
                )
              })
            ) : (
              <div className="plain-select-empty">No matching options</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

PlainSelect.propTypes = {
  options: PropTypes.array,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
}

export default PlainSelect
