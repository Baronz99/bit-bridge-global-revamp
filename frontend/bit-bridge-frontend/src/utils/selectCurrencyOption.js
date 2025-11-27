const selectCurrencyOptions = (curr) => {
  switch (curr) {
    case 'usd':
      return [
        {
          value: 10,
          label: 'USD 10',
        },
        {
          value: 15,
          label: 'USD 15',
        },
        {
          value: 20,
          label: 'USD 20',
        },
        {
          value: 25,
          label: 'USD 25',
        },
        {
          value: 50,
          label: 'USD 50',
        },
      ]
    case 'eur':
      return [
        {
          value: 5,
          label: 'EUR 10',
        },
        {
          value: 15,
          label: 'EUR 15',
        },
        {
          value: 20,
          label: 'EUR 20',
        },
        {
          value: 25,
          label: 'EUR 25',
        },
        {
          value: 50,
          label: 'EUR 50',
        },
      ]

    case 'gbp':
      return [
        {
          value: 5,
          label: 'GBP 10',
        },
        {
          value: 15,
          label: 'GBP 15',
        },
        {
          value: 20,
          label: 'GBP 20',
        },
        {
          value: 25,
          label: 'GBP 25',
        },
        {
          value: 50,
          label: 'GBP 50',
        },
      ]
    case 'ngn':
      return [
        {
          value: 5,
          label: 'NGN 10',
        },
        {
          value: 15,
          label: 'NGN 15',
        },
        {
          value: 20,
          label: 'NGN 20',
        },
        {
          value: 25,
          label: 'NGN 25',
        },
        {
          value: 50,
          label: 'NGN 50',
        },
      ]

    default:
      return [
        {
          value: 10,
          label: 'USD 10',
        },
        {
          value: 15,
          label: 'USD 15',
        },
        {
          value: 20,
          label: 'USD 20',
        },
        {
          value: 25,
          label: 'USD 25',
        },
        {
          value: 50,
          label: 'USD 50',
        },
      ]
  }
}

export default selectCurrencyOptions
