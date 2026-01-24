const nairaFormat = (amount, currency = 'NGN') => {
  const numericAmount = Number(amount)
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0
  const cur = (currency || 'NGN').toUpperCase()

  try {
    const curr = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: cur,
      currencyDisplay: 'narrowSymbol',
    })

    return curr.format(safeAmount)
  } catch (error) {
    console.error(`Invalid currency code: ${cur}. Defaulting to NGN.`)
    return `${cur} ${safeAmount.toFixed(2)}`
  }
}

export default nairaFormat
