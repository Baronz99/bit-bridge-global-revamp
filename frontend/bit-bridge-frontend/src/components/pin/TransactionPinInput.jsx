const TransactionPinInput = ({
  value,
  onChange,
  disabled = false,
  maxLength = 6,
  className = '',
  name = 'transaction_pin',
  placeholder = '••••',
  allowPaste = false,
}) => {
  const handleChange = (e) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, maxLength)
    onChange(clean)
  }

  return (
    <input
      type="password"
      name={name}
      value={value}
      onChange={handleChange}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder={placeholder}
      className={[
        'w-full h-12 rounded-xl border border-slate-700 bg-slate-950/70',
        'px-4 text-sm text-slate-100 outline-none tracking-widest',
        className,
      ].join(' ')}
      disabled={disabled}
      onPaste={allowPaste ? undefined : (e) => e.preventDefault()}
    />
  )
}

export default TransactionPinInput
