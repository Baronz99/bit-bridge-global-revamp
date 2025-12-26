const TransactionPinInput = ({
  value,
  onChange,
  disabled = false,
  maxLength = 4,
  className = '',
  name = 'transaction_pin',
  placeholder = '••••',
  allowPaste = false,
  autoComplete = 'new-password', // better default for PIN than one-time-code
  ariaLabel = 'Transaction PIN',
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
      pattern="\d*"
      maxLength={maxLength}
      autoComplete={autoComplete}
      placeholder={placeholder}
      aria-label={ariaLabel}
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
