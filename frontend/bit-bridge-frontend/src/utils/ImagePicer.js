export const pickLogo = (provider) => {
  switch (provider) {
    case 'mtn':
      return '/images/providers/mtn-nigeria.webp'
    case 'glo':
      return '/images/providers/glo-mobile-bundles-nigeria.webp'
    case '9-mobile':
      return '/images/providers/9mobile-etisalat-data-nigeria.webp'
    case 'airtel':
      return '/images/providers/airtel-data-nigeria.webp'
    case 'ntel':
      return '/images/providers/ntel-nigeria.webp'

    default:
      return '/images/providers/ntn-nigeria.webp'
  }
}
