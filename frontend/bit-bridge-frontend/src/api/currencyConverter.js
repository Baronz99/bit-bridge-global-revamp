const converter = async ({ fromCurr = 'usd', amount = 1, toCurr = 'usd' }) => {
  const api = 'https://api.coingecko.com/api/v3/exchange_rates'

  try {
    let currencyRates

    const storedRate = localStorage.getItem('currencyRate')
    const rateTimeStamp = localStorage.getItem('rateTimestamp')

    const currentTime = new Date().getTime()
    const rateExpiresin = 3 * 60 * 1000 //1 hour at 1000 millisec per second

    if (storedRate && rateTimeStamp && currentTime - rateTimeStamp < rateExpiresin) {
      currencyRates = JSON.parse(storedRate)
    } else {
      const res = await fetch(api)

      if (!res.ok) {
        throw new Error(`Failed to fetch exchange rates: ${res.status}`)
      }

      const rawRates = await res.json()

      currencyRates = rawRates.rates

      // const currentTime = new Date().getTime()

      localStorage.setItem('currencyRate', JSON.stringify(currencyRates))
      localStorage.setItem('rateTimestamp', currentTime)
    }

    const fromRate = currencyRates[fromCurr].value
    const toRate = currencyRates[toCurr].value
    const naira = currencyRates['ngn'].value
    const usd = currencyRates['usd'].value

    const calc = ((toRate / fromRate) * amount).toFixed(8)
    // console.log(`Converted ${amount} ${fromCurr} to ${calc} ${toCurr}`);

    // const currArrays = Object.values(currencyRates)
    return {
      calc: toCurr === 'btc' ? calc : Number(calc).toFixed(2),
      dollarRate: Number(currencyRates['usd'].value / currencyRates['ngn'].value)?.toFixed(2),
      nairaRate: Number(currencyRates['ngn'].value / currencyRates['usd'].value)?.toFixed(2),
      naira,
      usd,
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error.message)
    throw error
  }
}

export { converter }
